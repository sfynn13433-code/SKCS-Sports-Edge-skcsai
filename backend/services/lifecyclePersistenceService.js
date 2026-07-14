'use strict';

const crypto = require('node:crypto');

const DOMAIN_CODES = Object.freeze({
  LIFECYCLE_GATE_BLOCKED: 'LIFECYCLE_GATE_BLOCKED',
  LIFECYCLE_FEATURE_DISABLED: 'LIFECYCLE_FEATURE_DISABLED',
  LIFECYCLE_INPUT_INVALID: 'LIFECYCLE_INPUT_INVALID',
  LIFECYCLE_NOT_FOUND: 'LIFECYCLE_NOT_FOUND',
  SPORT_NOT_ACTIVE: 'SPORT_NOT_ACTIVE',
  FIXTURE_OUTSIDE_ADMISSION_WINDOW: 'FIXTURE_OUTSIDE_ADMISSION_WINDOW',
  FIXTURE_ALREADY_STARTED: 'FIXTURE_ALREADY_STARTED',
  FIXTURE_IDENTITY_CONFLICT: 'FIXTURE_IDENTITY_CONFLICT',
  FIXTURE_ALIAS_CONFLICT: 'FIXTURE_ALIAS_CONFLICT',
  LIFECYCLE_DUPLICATE_EVENT: 'LIFECYCLE_DUPLICATE_EVENT',
  LIFECYCLE_STALE_VERSION: 'LIFECYCLE_STALE_VERSION',
  DAILY_ADMISSION_CAP_REACHED: 'DAILY_ADMISSION_CAP_REACHED',
  ADMISSION_CAP_STATE_UNAVAILABLE: 'ADMISSION_CAP_STATE_UNAVAILABLE',
  LIFECYCLE_PERSISTENCE_UNAVAILABLE: 'LIFECYCLE_PERSISTENCE_UNAVAILABLE',
  ROLLOVER_ALREADY_APPLIED: 'ROLLOVER_ALREADY_APPLIED',
  LIFECYCLE_ROLLOVER_SNAPSHOT_TOO_LARGE: 'LIFECYCLE_ROLLOVER_SNAPSHOT_TOO_LARGE',
  ADMISSION_CEILING_INVALID: 'ADMISSION_CEILING_INVALID'
});

const GOVERNED_ADMISSION_OUTCOMES = Object.freeze(['ADMITTED']);
const DEFAULT_ADMISSION_CEILING = 50;
const MAX_SCHEMA_ADMISSION_CEILING = 50;
const MAX_ROLLOVER_SNAPSHOT_BYTES = 2048;
const PG_UNIQUE_VIOLATION = '23505';

const FORBIDDEN_PERSISTENCE_FIELDS = new Set([
  'fip_body',
  'fip_json',
  'validated_fip',
  'scout_payload',
  'provider_payload',
  'raw_provider',
  'evidence_archive'
]);

function assertDependency(name, value) {
  if (value === null || value === undefined) {
    throw new TypeError(`Missing required dependency: ${name}`);
  }
}

function errResult(code, extra = {}) {
  return { ok: false, code, ...extra };
}

function okResult(extra = {}) {
  return { ok: true, ...extra };
}

function toValidDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeCeiling(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_ADMISSION_CEILING;
  }
  if (numeric > MAX_SCHEMA_ADMISSION_CEILING) {
    throw new Error(DOMAIN_CODES.ADMISSION_CEILING_INVALID);
  }
  return Math.max(0, Math.floor(numeric));
}

function rejectForbiddenFields(input) {
  if (!input || typeof input !== 'object') return null;
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_PERSISTENCE_FIELDS.has(String(key).toLowerCase())) {
      return DOMAIN_CODES.LIFECYCLE_INPUT_INVALID;
    }
  }
  return null;
}

function buildAdmissionIdempotencyKey({
  sport,
  aliasNamespace,
  aliasValue,
  kickoffAt,
  admissionDateSast
}) {
  const kickoff = toValidDate(kickoffAt);
  if (!kickoff) {
    throw new TypeError('kickoffAt must be a valid date');
  }
  const epochSecond = Math.floor(kickoff.getTime() / 1000);
  const canonical = [
    String(sport || '').trim().toLowerCase(),
    String(aliasNamespace || '').trim(),
    String(aliasValue || '').trim(),
    String(epochSecond),
    String(admissionDateSast || '').trim()
  ].join('|');
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function mapPersistenceError(err, context = {}) {
  if (!err || typeof err !== 'object') {
    return DOMAIN_CODES.LIFECYCLE_PERSISTENCE_UNAVAILABLE;
  }
  if (err.code === DOMAIN_CODES.DAILY_ADMISSION_CAP_REACHED) {
    return DOMAIN_CODES.DAILY_ADMISSION_CAP_REACHED;
  }
  if (err.code === DOMAIN_CODES.ADMISSION_CAP_STATE_UNAVAILABLE) {
    return DOMAIN_CODES.ADMISSION_CAP_STATE_UNAVAILABLE;
  }
  if (err.code === PG_UNIQUE_VIOLATION) {
    const constraint = String(err.constraint || '');
    if (constraint.includes('fixture_identity_aliases_unique')) {
      return DOMAIN_CODES.FIXTURE_ALIAS_CONFLICT;
    }
    if (constraint.includes('lifecycle_admission_idempotency_pkey')) {
      return DOMAIN_CODES.LIFECYCLE_DUPLICATE_EVENT;
    }
    if (constraint.includes('fixture_lifecycle_transition_events_idempotency')) {
      return DOMAIN_CODES.LIFECYCLE_DUPLICATE_EVENT;
    }
    if (constraint.includes('fixture_lifecycle_rollover_events_rollover_key')) {
      return DOMAIN_CODES.ROLLOVER_ALREADY_APPLIED;
    }
    if (context.operation === 'alias') {
      return DOMAIN_CODES.FIXTURE_ALIAS_CONFLICT;
    }
    if (context.operation === 'admission_idempotency') {
      return DOMAIN_CODES.LIFECYCLE_DUPLICATE_EVENT;
    }
    if (context.operation === 'transition_event') {
      return DOMAIN_CODES.LIFECYCLE_DUPLICATE_EVENT;
    }
    if (context.operation === 'rollover') {
      return DOMAIN_CODES.ROLLOVER_ALREADY_APPLIED;
    }
  }
  return DOMAIN_CODES.LIFECYCLE_PERSISTENCE_UNAVAILABLE;
}

function createLifecyclePersistenceService(deps = {}) {
  assertDependency('db', deps.db);
  assertDependency('governor', deps.governor);
  assertDependency('gateReader', deps.gateReader);
  assertDependency('uuidGenerator', deps.uuidGenerator);
  assertDependency('clock', deps.clock);

  const db = deps.db;
  const governor = deps.governor;
  const gateReader = deps.gateReader;
  const featureFlagEnabled = deps.featureFlagEnabled;
  const uuidGenerator = deps.uuidGenerator;
  const clock = deps.clock;
  const admissionCeiling = normalizeCeiling(
    deps.admissionCeiling ?? DEFAULT_ADMISSION_CEILING
  );

  if (admissionCeiling > MAX_SCHEMA_ADMISSION_CEILING) {
    throw new Error(DOMAIN_CODES.ADMISSION_CEILING_INVALID);
  }

  async function evaluatePreDbGate() {
    return governor.evaluateGovernorGate({
      gateReader,
      featureFlagEnabled,
      refresh: Boolean(deps.refreshGate)
    });
  }

  function currentEvaluationTime(input) {
    return toValidDate(input?.evaluationTime) || toValidDate(clock.now()) || new Date();
  }

  function admissionDateSast(evaluationTime) {
    return governor.formatSastDateKey(evaluationTime);
  }

  async function findFixtureByAlias(client, { aliasNamespace, aliasValue }) {
    const namespace = String(aliasNamespace || '').trim();
    const value = String(aliasValue || '').trim();
    if (!namespace || !value) {
      return errResult(DOMAIN_CODES.LIFECYCLE_INPUT_INVALID);
    }

    const result = await client.query(
      `SELECT fixture_uid
       FROM fixture_identity_aliases
       WHERE alias_namespace = $1 AND alias_value = $2`,
      [namespace, value]
    );

    if (result.rows.length > 1) {
      return errResult(DOMAIN_CODES.FIXTURE_IDENTITY_CONFLICT);
    }
    if (result.rows.length === 1) {
      return okResult({ fixtureUid: result.rows[0].fixture_uid, found: true });
    }
    return okResult({ fixtureUid: null, found: false });
  }

  async function findAdmissionByIdempotencyKey(client, admissionIdempotencyKey) {
    const key = String(admissionIdempotencyKey || '').trim();
    if (!key) {
      return errResult(DOMAIN_CODES.LIFECYCLE_INPUT_INVALID);
    }

    const result = await client.query(
      `SELECT admission_idempotency_key, fixture_uid, admission_date_sast, outcome
       FROM lifecycle_admission_idempotency
       WHERE admission_idempotency_key = $1`,
      [key]
    );

    if (result.rows.length === 0) {
      return okResult({ found: false });
    }
    const row = result.rows[0];
    return okResult({
      found: true,
      fixtureUid: row.fixture_uid,
      outcome: row.outcome,
      admissionDateSast: row.admission_date_sast
    });
  }

  function allocateFixtureUid() {
    return uuidGenerator.v4();
  }

  async function insertAlias(client, {
    fixtureUid,
    aliasNamespace,
    aliasValue,
    sourceSystem,
    seenAt
  }) {
    const seen = toValidDate(seenAt) || new Date();
    try {
      await client.query(
        `INSERT INTO fixture_identity_aliases (
          fixture_uid, alias_namespace, alias_value, source_system, first_seen_at, last_seen_at
        ) VALUES ($1, $2, $3, $4, $5, $5)`,
        [
          fixtureUid,
          String(aliasNamespace || '').trim(),
          String(aliasValue || '').trim(),
          String(sourceSystem || '').trim(),
          seen
        ]
      );
      return okResult();
    } catch (err) {
      return errResult(mapPersistenceError(err, { operation: 'alias' }));
    }
  }

  async function loadCurrentLifecycle(client, { fixtureUid }) {
    const uid = String(fixtureUid || '').trim();
    if (!uid) {
      return errResult(DOMAIN_CODES.LIFECYCLE_INPUT_INVALID);
    }

    const result = await client.query(
      `SELECT fixture_uid, sport, lifecycle_state, lifecycle_stage, day_label, kickoff_at,
              engine_stage, publication_eligible, hold_category, elimination_category,
              evidence_fresh_at, scout_fip_id, scout_validation_hash, transition_version,
              archive_closed_at, created_at, updated_at
       FROM fixture_lifecycle_current
       WHERE fixture_uid = $1`,
      [uid]
    );

    if (result.rows.length === 0) {
      return errResult(DOMAIN_CODES.LIFECYCLE_NOT_FOUND);
    }
    return okResult({ projection: result.rows[0] });
  }

  async function appendTransitionEvent(client, { event }) {
    if (!event || typeof event !== 'object') {
      return errResult(DOMAIN_CODES.LIFECYCLE_INPUT_INVALID);
    }

    try {
      const result = await client.query(
        `INSERT INTO fixture_lifecycle_transition_events (
          event_id, fixture_uid, transition_version, from_state, to_state, from_stage, to_stage,
          reason_category, reason_detail_safe, source_actor, source_ref, scout_fip_id,
          scout_validation_hash, idempotency_key, occurred_at, archive_closed_at
        ) VALUES (
          COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
        RETURNING event_id`,
        [
          event.event_id || null,
          event.fixture_uid,
          event.transition_version,
          event.from_state ?? null,
          event.to_state,
          event.from_stage ?? null,
          event.to_stage ?? null,
          event.reason_category,
          event.reason_detail_safe ?? null,
          event.source_actor,
          event.source_ref ?? null,
          event.scout_fip_id ?? null,
          event.scout_validation_hash ?? null,
          event.idempotency_key,
          toValidDate(event.occurred_at) || new Date(),
          event.archive_closed_at ?? null
        ]
      );
      return okResult({ eventId: result.rows[0].event_id });
    } catch (err) {
      return errResult(mapPersistenceError(err, { operation: 'transition_event' }));
    }
  }

  async function updateCurrentProjection(client, {
    fixtureUid,
    projection,
    expectedVersion
  }) {
    const expected = Number(expectedVersion);
    if (!Number.isFinite(expected)) {
      return errResult(DOMAIN_CODES.LIFECYCLE_INPUT_INVALID);
    }

    const result = await client.query(
      `UPDATE fixture_lifecycle_current
       SET sport = $2,
           lifecycle_state = $3,
           lifecycle_stage = $4,
           day_label = $5,
           kickoff_at = $6,
           engine_stage = $7,
           publication_eligible = $8,
           hold_category = $9,
           elimination_category = $10,
           evidence_fresh_at = $11,
           scout_fip_id = $12,
           scout_validation_hash = $13,
           archive_closed_at = $14,
           updated_at = now(),
           transition_version = transition_version + 1
       WHERE fixture_uid = $1 AND transition_version = $15`,
      [
        fixtureUid,
        projection.sport,
        projection.lifecycle_state,
        projection.lifecycle_stage,
        projection.day_label,
        projection.kickoff_at,
        projection.engine_stage ?? null,
        Boolean(projection.publication_eligible),
        projection.hold_category ?? null,
        projection.elimination_category ?? null,
        projection.evidence_fresh_at ?? null,
        projection.scout_fip_id ?? null,
        projection.scout_validation_hash ?? null,
        projection.archive_closed_at ?? null,
        expected
      ]
    );

    if (result.rowCount !== 1) {
      return errResult(DOMAIN_CODES.LIFECYCLE_STALE_VERSION);
    }
    return okResult({ transitionVersion: expected + 1 });
  }

  async function insertAdmissionIdempotency(client, record) {
    try {
      await client.query(
        `INSERT INTO lifecycle_admission_idempotency (
          admission_idempotency_key, fixture_uid, admission_date_sast, outcome
        ) VALUES ($1, $2, $3, $4)`,
        [
          record.admission_idempotency_key,
          record.fixture_uid,
          record.admission_date_sast,
          record.outcome
        ]
      );
      return okResult();
    } catch (err) {
      return errResult(mapPersistenceError(err, { operation: 'admission_idempotency' }));
    }
  }

  async function lockOrCreateDailyCounter(client, admissionDate) {
    const ceiling = admissionCeiling;
    try {
      await client.query(
        `INSERT INTO lifecycle_daily_admission_counters (
          admission_date_sast, admitted_count, ceiling, transition_version
        ) VALUES ($1, 0, $2, 1)
        ON CONFLICT (admission_date_sast) DO NOTHING`,
        [admissionDate, ceiling]
      );

      const locked = await client.query(
        `SELECT admission_date_sast, admitted_count, ceiling, transition_version
         FROM lifecycle_daily_admission_counters
         WHERE admission_date_sast = $1
         FOR UPDATE`,
        [admissionDate]
      );

      if (locked.rows.length !== 1) {
        const unavailable = new Error('counter row missing after lock');
        unavailable.code = DOMAIN_CODES.ADMISSION_CAP_STATE_UNAVAILABLE;
        throw unavailable;
      }

      const row = locked.rows[0];
      if (Number(row.ceiling) > MAX_SCHEMA_ADMISSION_CEILING) {
        return errResult(DOMAIN_CODES.ADMISSION_CEILING_INVALID);
      }

      return okResult({ counter: row });
    } catch (err) {
      if (err.code === DOMAIN_CODES.ADMISSION_CAP_STATE_UNAVAILABLE) {
        return errResult(DOMAIN_CODES.ADMISSION_CAP_STATE_UNAVAILABLE);
      }
      return errResult(DOMAIN_CODES.ADMISSION_CAP_STATE_UNAVAILABLE);
    }
  }

  async function incrementDailyCounter(client, {
    admissionDateSast: admissionDate,
    fixtureUid,
    admissionIdempotencyKey
  }) {
    const result = await client.query(
      `UPDATE lifecycle_daily_admission_counters
       SET admitted_count = admitted_count + 1,
           updated_at = now(),
           transition_version = transition_version + 1,
           last_fixture_uid = $2,
           last_idempotency_key = $3
       WHERE admission_date_sast = $1
         AND admitted_count < ceiling
       RETURNING admitted_count, ceiling`,
      [admissionDate, fixtureUid, admissionIdempotencyKey]
    );

    if (result.rowCount !== 1) {
      const capErr = new Error('daily admission cap reached');
      capErr.code = DOMAIN_CODES.DAILY_ADMISSION_CAP_REACHED;
      throw capErr;
    }

    return okResult({
      admittedCount: result.rows[0].admitted_count,
      ceiling: result.rows[0].ceiling
    });
  }

  async function loadLastRollover(client) {
    const result = await client.query(
      `SELECT rollover_id, rollover_key, executed_at, fixtures_archived_count,
              fixtures_carried_forward, day8_admitted_count, snapshot_json
       FROM fixture_lifecycle_rollover_events
       ORDER BY rollover_key DESC
       LIMIT 1`
    );
    if (result.rows.length === 0) {
      return okResult({ rollover: null });
    }
    return okResult({ rollover: result.rows[0] });
  }

  function validateRolloverSnapshot(snapshot) {
    const serialized = JSON.stringify(snapshot ?? {});
    if (Buffer.byteLength(serialized, 'utf8') > MAX_ROLLOVER_SNAPSHOT_BYTES) {
      return errResult(DOMAIN_CODES.LIFECYCLE_ROLLOVER_SNAPSHOT_TOO_LARGE);
    }
    return okResult({ snapshotJson: serialized });
  }

  async function appendRolloverEvent(client, { rollover }) {
    const snapshotCheck = validateRolloverSnapshot(rollover.snapshot);
    if (!snapshotCheck.ok) {
      return snapshotCheck;
    }

    try {
      const result = await client.query(
        `INSERT INTO fixture_lifecycle_rollover_events (
          rollover_id, rollover_key, executed_at, fixtures_archived_count,
          fixtures_carried_forward, day8_admitted_count, snapshot_json
        ) VALUES (
          COALESCE($1::uuid, gen_random_uuid()), $2, COALESCE($3::timestamptz, now()),
          $4, $5, $6, $7::jsonb
        )
        RETURNING rollover_id`,
        [
          rollover.rollover_id || null,
          rollover.rollover_key,
          rollover.executed_at || null,
          Number(rollover.fixtures_archived_count) || 0,
          Number(rollover.fixtures_carried_forward) || 0,
          Number(rollover.day8_admitted_count) || 0,
          snapshotCheck.snapshotJson
        ]
      );
      return okResult({ rolloverId: result.rows[0].rollover_id });
    } catch (err) {
      return errResult(mapPersistenceError(err, { operation: 'rollover' }));
    }
  }

  async function insertCurrentProjection(client, projection) {
    try {
      await client.query(
        `INSERT INTO fixture_lifecycle_current (
          fixture_uid, sport, lifecycle_state, lifecycle_stage, day_label, kickoff_at,
          engine_stage, publication_eligible, hold_category, elimination_category,
          evidence_fresh_at, scout_fip_id, scout_validation_hash, transition_version,
          archive_closed_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now(), now()
        )`,
        [
          projection.fixture_uid,
          projection.sport,
          projection.lifecycle_state,
          projection.lifecycle_stage,
          projection.day_label,
          projection.kickoff_at,
          projection.engine_stage ?? null,
          Boolean(projection.publication_eligible),
          projection.hold_category ?? null,
          projection.elimination_category ?? null,
          projection.evidence_fresh_at ?? null,
          projection.scout_fip_id ?? null,
          projection.scout_validation_hash ?? null,
          projection.transition_version ?? 1,
          projection.archive_closed_at ?? null
        ]
      );
      return okResult();
    } catch (err) {
      return errResult(DOMAIN_CODES.LIFECYCLE_PERSISTENCE_UNAVAILABLE);
    }
  }

  async function admitFixture(input = {}) {
    const forbidden = rejectForbiddenFields(input);
    if (forbidden) {
      return errResult(forbidden);
    }

    const gateResult = await evaluatePreDbGate();
    if (!gateResult.allowed) {
      return errResult(gateResult.code || DOMAIN_CODES.LIFECYCLE_GATE_BLOCKED);
    }

    const evaluationTime = currentEvaluationTime(input);
    const admissionEval = governor.evaluateAdmission({
      sport: input.sport,
      kickoffAt: input.kickoffAt,
      evaluationTime,
      gateResult: { allowed: true },
      existingFixtureUid: input.existingFixtureUid || null
    });

    if (!admissionEval.allowed) {
      return errResult(admissionEval.code || DOMAIN_CODES.LIFECYCLE_INPUT_INVALID);
    }

    const aliasNamespace = String(input.aliasNamespace || '').trim();
    const aliasValue = String(input.aliasValue || '').trim();
    const sourceSystem = String(input.sourceSystem || '').trim();
    const sourceActor = String(input.sourceActor || 'governor').trim();

    if (!aliasNamespace || !aliasValue || !sourceSystem) {
      return errResult(DOMAIN_CODES.LIFECYCLE_INPUT_INVALID);
    }

    const dateSast = admissionDateSast(evaluationTime);
    let idempotencyKey;
    try {
      idempotencyKey = buildAdmissionIdempotencyKey({
        sport: input.sport,
        aliasNamespace,
        aliasValue,
        kickoffAt: input.kickoffAt,
        admissionDateSast: dateSast
      });
    } catch {
      return errResult(DOMAIN_CODES.LIFECYCLE_INPUT_INVALID);
    }

    try {
      return await db.withTransaction(async (client) => {
        const aliasLookup = await findFixtureByAlias(client, { aliasNamespace, aliasValue });
        if (!aliasLookup.ok) {
          throw Object.assign(new Error(aliasLookup.code), { domainCode: aliasLookup.code });
        }
        if (aliasLookup.found) {
          return okResult({
            fixtureUid: aliasLookup.fixtureUid,
            reused: true,
            admissionIdempotencyKey: idempotencyKey
          });
        }

        const idemLookup = await findAdmissionByIdempotencyKey(client, idempotencyKey);
        if (!idemLookup.ok) {
          throw Object.assign(new Error(idemLookup.code), { domainCode: idemLookup.code });
        }
        if (idemLookup.found) {
          return okResult({
            fixtureUid: idemLookup.fixtureUid,
            reused: true,
            admissionIdempotencyKey: idempotencyKey
          });
        }

        const counterLock = await lockOrCreateDailyCounter(client, dateSast);
        if (!counterLock.ok) {
          throw Object.assign(new Error(counterLock.code), { domainCode: counterLock.code });
        }

        if (Number(counterLock.counter.admitted_count) >= Number(counterLock.counter.ceiling)) {
          throw Object.assign(
            new Error(DOMAIN_CODES.DAILY_ADMISSION_CAP_REACHED),
            { domainCode: DOMAIN_CODES.DAILY_ADMISSION_CAP_REACHED }
          );
        }

        const fixtureUid = allocateFixtureUid();
        const kickoffAt = toValidDate(input.kickoffAt);
        const occurredAt = evaluationTime;

        const projection = {
          fixture_uid: fixtureUid,
          sport: 'football',
          lifecycle_state: 'VISIBLE',
          lifecycle_stage: 'ADMITTED',
          day_label: admissionEval.dayLabel,
          kickoff_at: kickoffAt,
          engine_stage: null,
          publication_eligible: false,
          hold_category: null,
          elimination_category: null,
          evidence_fresh_at: input.evidenceFreshAt ?? null,
          scout_fip_id: input.scoutFipId ?? null,
          scout_validation_hash: input.scoutValidationHash ?? null,
          transition_version: 1,
          archive_closed_at: null
        };

        const currentInsert = await insertCurrentProjection(client, projection);
        if (!currentInsert.ok) {
          throw Object.assign(new Error(currentInsert.code), { domainCode: currentInsert.code });
        }

        const aliasInsert = await insertAlias(client, {
          fixtureUid,
          aliasNamespace,
          aliasValue,
          sourceSystem,
          seenAt: occurredAt
        });
        if (!aliasInsert.ok) {
          throw Object.assign(new Error(aliasInsert.code), { domainCode: aliasInsert.code });
        }

        const transitionEvent = governor.buildTransitionEvent({
          fixtureUid,
          transitionVersion: 1,
          fromState: null,
          toState: 'VISIBLE',
          fromStage: null,
          toStage: 'ADMITTED',
          reasonCategory: input.reasonCategory || 'APPROVED',
          sourceActor,
          sourceRef: input.sourceRef || null,
          occurredAt
        });

        const eventInsert = await appendTransitionEvent(client, {
          event: {
            ...transitionEvent,
            scout_fip_id: input.scoutFipId ?? null,
            scout_validation_hash: input.scoutValidationHash ?? null
          }
        });
        if (!eventInsert.ok) {
          throw Object.assign(new Error(eventInsert.code), { domainCode: eventInsert.code });
        }

        const idemInsert = await insertAdmissionIdempotency(client, {
          admission_idempotency_key: idempotencyKey,
          fixture_uid: fixtureUid,
          admission_date_sast: dateSast,
          outcome: 'ADMITTED'
        });
        if (!idemInsert.ok) {
          throw Object.assign(new Error(idemInsert.code), { domainCode: idemInsert.code });
        }

        const counterIncrement = await incrementDailyCounter(client, {
          admissionDateSast: dateSast,
          fixtureUid,
          admissionIdempotencyKey: idempotencyKey
        });
        if (!counterIncrement.ok) {
          throw Object.assign(
            new Error(counterIncrement.code),
            { domainCode: counterIncrement.code }
          );
        }

        return okResult({
          fixtureUid,
          reused: false,
          eventId: eventInsert.eventId,
          admissionIdempotencyKey: idempotencyKey,
          admittedCount: counterIncrement.admittedCount,
          ceiling: counterIncrement.ceiling
        });
      });
    } catch (err) {
      if (err.domainCode) {
        return errResult(err.domainCode);
      }
      return errResult(mapPersistenceError(err));
    }
  }

  async function applyTransition(input = {}) {
    const forbidden = rejectForbiddenFields(input);
    if (forbidden) {
      return errResult(forbidden);
    }

    const gateResult = await evaluatePreDbGate();
    if (!gateResult.allowed) {
      return errResult(gateResult.code || DOMAIN_CODES.LIFECYCLE_GATE_BLOCKED);
    }

    const evaluationTime = currentEvaluationTime(input);
    const fixtureUid = String(input.fixtureUid || '').trim();
    if (!fixtureUid) {
      return errResult(DOMAIN_CODES.LIFECYCLE_INPUT_INVALID);
    }

    try {
      return await db.withTransaction(async (client) => {
        const current = await loadCurrentLifecycle(client, { fixtureUid });
        if (!current.ok) {
          throw Object.assign(new Error(current.code), { domainCode: current.code });
        }

        const transitionEval = governor.evaluateTransition({
          current: current.projection,
          requested: input.requested || {},
          evaluationTime
        });

        if (!transitionEval.allowed) {
          throw Object.assign(
            new Error(transitionEval.code),
            { domainCode: transitionEval.code }
          );
        }

        const expectedVersion = Number(current.projection.transition_version);
        const occurredAt = toValidDate(input.occurredAt) || evaluationTime;
        const transitionEvent = governor.buildTransitionEvent({
          fixtureUid,
          transitionVersion: expectedVersion + 1,
          fromState: transitionEval.fromState,
          toState: transitionEval.toState,
          fromStage: transitionEval.fromStage,
          toStage: transitionEval.toStage,
          reasonCategory: transitionEval.reasonCategory,
          sourceActor: transitionEval.sourceActor || input.requested?.source_actor,
          sourceRef: input.requested?.source_ref || null,
          occurredAt
        });

        const eventInsert = await appendTransitionEvent(client, {
          event: {
            ...transitionEvent,
            scout_fip_id: input.scoutFipId ?? current.projection.scout_fip_id ?? null,
            scout_validation_hash:
              input.scoutValidationHash ?? current.projection.scout_validation_hash ?? null,
            archive_closed_at: transitionEval.toState === 'ARCHIVED' ? occurredAt : null
          }
        });
        if (!eventInsert.ok) {
          throw Object.assign(new Error(eventInsert.code), { domainCode: eventInsert.code });
        }

        const nextProjection = {
          sport: current.projection.sport,
          lifecycle_state: transitionEval.toState,
          lifecycle_stage: transitionEval.toStage ?? current.projection.lifecycle_stage,
          day_label: input.dayLabel ?? current.projection.day_label,
          kickoff_at: current.projection.kickoff_at,
          engine_stage: input.engineStage ?? current.projection.engine_stage,
          publication_eligible:
            transitionEval.effects?.publication_eligible !== undefined
              ? transitionEval.effects.publication_eligible
              : current.projection.publication_eligible,
          hold_category:
            transitionEval.toState === 'HELD'
              ? input.requested?.hold_category ?? current.projection.hold_category
              : null,
          elimination_category:
            transitionEval.toState === 'ELIMINATED'
              ? input.requested?.elimination_category ?? current.projection.elimination_category
              : null,
          evidence_fresh_at: input.evidenceFreshAt ?? current.projection.evidence_fresh_at,
          scout_fip_id: input.scoutFipId ?? current.projection.scout_fip_id,
          scout_validation_hash:
            input.scoutValidationHash ?? current.projection.scout_validation_hash,
          archive_closed_at:
            transitionEval.toState === 'ARCHIVED' ? occurredAt : current.projection.archive_closed_at
        };

        const projectionUpdate = await updateCurrentProjection(client, {
          fixtureUid,
          projection: nextProjection,
          expectedVersion
        });
        if (!projectionUpdate.ok) {
          throw Object.assign(
            new Error(projectionUpdate.code),
            { domainCode: projectionUpdate.code }
          );
        }

        return okResult({
          fixtureUid,
          eventId: eventInsert.eventId,
          transitionVersion: projectionUpdate.transitionVersion
        });
      });
    } catch (err) {
      if (err.domainCode) {
        return errResult(err.domainCode);
      }
      return errResult(mapPersistenceError(err));
    }
  }

  return {
    DOMAIN_CODES,
    DEFAULT_ADMISSION_CEILING,
    MAX_ROLLOVER_SNAPSHOT_BYTES,
    buildAdmissionIdempotencyKey,
    admitFixture,
    applyTransition,
    findFixtureByAlias,
    findAdmissionByIdempotencyKey,
    allocateFixtureUid,
    insertAlias,
    loadCurrentLifecycle,
    appendTransitionEvent,
    updateCurrentProjection,
    insertAdmissionIdempotency,
    lockOrCreateDailyCounter,
    incrementDailyCounter,
    loadLastRollover,
    appendRolloverEvent,
    validateRolloverSnapshot
  };
}

module.exports = {
  DOMAIN_CODES,
  DEFAULT_ADMISSION_CEILING,
  MAX_SCHEMA_ADMISSION_CEILING,
  MAX_ROLLOVER_SNAPSHOT_BYTES,
  buildAdmissionIdempotencyKey,
  createLifecyclePersistenceService
};
