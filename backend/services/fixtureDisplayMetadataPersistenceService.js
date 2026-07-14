'use strict';

const crypto = require('node:crypto');

const DOMAIN_CODES = Object.freeze({
  DISPLAY_METADATA_GATE_BLOCKED: 'DISPLAY_METADATA_GATE_BLOCKED',
  DISPLAY_METADATA_FEATURE_DISABLED: 'DISPLAY_METADATA_FEATURE_DISABLED',
  DISPLAY_METADATA_INPUT_INVALID: 'DISPLAY_METADATA_INPUT_INVALID',
  DISPLAY_METADATA_LIFECYCLE_MISSING: 'DISPLAY_METADATA_LIFECYCLE_MISSING',
  DISPLAY_METADATA_NOT_FOUND: 'DISPLAY_METADATA_NOT_FOUND',
  DISPLAY_METADATA_STALE_UPDATE: 'DISPLAY_METADATA_STALE_UPDATE',
  DISPLAY_METADATA_PROVENANCE_CONFLICT: 'DISPLAY_METADATA_PROVENANCE_CONFLICT',
  DISPLAY_METADATA_IDEMPOTENCY_DUPLICATE: 'DISPLAY_METADATA_IDEMPOTENCY_DUPLICATE',
  DISPLAY_METADATA_PURGE_TIMESTAMP_INVALID: 'DISPLAY_METADATA_PURGE_TIMESTAMP_INVALID',
  DISPLAY_METADATA_PERSISTENCE_UNAVAILABLE: 'DISPLAY_METADATA_PERSISTENCE_UNAVAILABLE'
});

const FIXED_TIMEZONE = 'Africa/Johannesburg';
const RETENTION_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const PG_UNIQUE_VIOLATION = '23505';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FORBIDDEN_PERSISTENCE_FIELDS = new Set([
  'fip_body',
  'fip_json',
  'raw_json',
  'raw_fip',
  'validated_fip',
  'scout_payload',
  'provider_payload',
  'raw_provider',
  'evidence_archive'
]);

const INTERNAL_SELECT_COLUMNS = [
  'fixture_uid',
  'sport',
  'scout_fixture_id',
  'fip_id',
  'fip_schema_version',
  'fip_validation_hash',
  'intake_id',
  'idempotency_key',
  'home_team_scout_id',
  'away_team_scout_id',
  'competition_id',
  'competition_name',
  'kickoff_at',
  'timezone',
  'home_team_name',
  'away_team_name',
  'venue',
  'country',
  'home_team_emblem_ref',
  'away_team_emblem_ref',
  'metadata_fresh_at',
  'lifecycle_closed_at',
  'purge_eligible_at',
  'created_at',
  'updated_at'
].join(', ');

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
  if (value === null || value === undefined) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeOptionalString(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredString(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

function rejectForbiddenFields(input) {
  if (!input || typeof input !== 'object') return null;
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_PERSISTENCE_FIELDS.has(String(key).toLowerCase())) {
      return DOMAIN_CODES.DISPLAY_METADATA_INPUT_INVALID;
    }
  }
  return null;
}

function buildDisplayMetadataIdempotencyKey({ fipId, fipValidationHash, fipSchemaVersion }) {
  const canonical = [
    String(fipId || '').trim(),
    String(fipValidationHash || '').trim(),
    String(fipSchemaVersion || '').trim()
  ].join('|');
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function provenanceMatches(row, normalized) {
  return (
    row.fip_id === normalized.fip_id &&
    row.fip_validation_hash === normalized.fip_validation_hash &&
    row.fip_schema_version === normalized.fip_schema_version
  );
}

function mapPersistenceError(err, context = {}) {
  if (!err || typeof err !== 'object') {
    return DOMAIN_CODES.DISPLAY_METADATA_PERSISTENCE_UNAVAILABLE;
  }
  if (err.code === PG_UNIQUE_VIOLATION) {
    const constraint = String(err.constraint || '');
    if (
      constraint.includes('fixture_display_metadata_idempotency_unique') ||
      context.operation === 'insert' ||
      context.operation === 'update'
    ) {
      return DOMAIN_CODES.DISPLAY_METADATA_IDEMPOTENCY_DUPLICATE;
    }
  }
  return DOMAIN_CODES.DISPLAY_METADATA_PERSISTENCE_UNAVAILABLE;
}

function normalizeIntakeDto(input = {}) {
  const forbidden = rejectForbiddenFields(input);
  if (forbidden) {
    return errResult(forbidden);
  }

  if (String(input.sport || '').trim().toLowerCase() !== 'football') {
    return errResult(DOMAIN_CODES.DISPLAY_METADATA_INPUT_INVALID);
  }

  const fixtureUid = String(input.fixtureUid || '').trim();
  if (!isValidUuid(fixtureUid)) {
    return errResult(DOMAIN_CODES.DISPLAY_METADATA_INPUT_INVALID);
  }

  const kickoffAt = toValidDate(input.kickoffAt);
  const metadataFreshAt = toValidDate(input.metadataFreshAt);
  if (!kickoffAt || !metadataFreshAt) {
    return errResult(DOMAIN_CODES.DISPLAY_METADATA_INPUT_INVALID);
  }

  const timezone = String(input.timezone || FIXED_TIMEZONE).trim();
  if (timezone !== FIXED_TIMEZONE) {
    return errResult(DOMAIN_CODES.DISPLAY_METADATA_INPUT_INVALID);
  }

  const normalized = {
    fixture_uid: fixtureUid,
    sport: 'football',
    scout_fixture_id: normalizeRequiredString(input.scoutFixtureId),
    fip_id: normalizeRequiredString(input.fipId),
    fip_schema_version: normalizeRequiredString(input.fipSchemaVersion),
    fip_validation_hash: normalizeRequiredString(input.fipValidationHash),
    intake_id: normalizeRequiredString(input.intakeId),
    home_team_scout_id: normalizeRequiredString(input.homeTeamScoutId),
    away_team_scout_id: normalizeRequiredString(input.awayTeamScoutId),
    competition_id: normalizeRequiredString(input.competitionId),
    competition_name: normalizeRequiredString(input.competitionName),
    kickoff_at: kickoffAt,
    timezone: FIXED_TIMEZONE,
    home_team_name: normalizeRequiredString(input.homeTeamName),
    away_team_name: normalizeRequiredString(input.awayTeamName),
    venue: normalizeOptionalString(input.venue),
    country: normalizeOptionalString(input.country),
    home_team_emblem_ref: normalizeOptionalString(input.homeTeamEmblemRef),
    away_team_emblem_ref: normalizeOptionalString(input.awayTeamEmblemRef),
    metadata_fresh_at: metadataFreshAt
  };

  const requiredKeys = [
    'scout_fixture_id',
    'fip_id',
    'fip_schema_version',
    'fip_validation_hash',
    'intake_id',
    'home_team_scout_id',
    'away_team_scout_id',
    'competition_id',
    'competition_name',
    'home_team_name',
    'away_team_name'
  ];
  for (const key of requiredKeys) {
    if (!normalized[key]) {
      return errResult(DOMAIN_CODES.DISPLAY_METADATA_INPUT_INVALID);
    }
  }

  const idempotencyKey = buildDisplayMetadataIdempotencyKey({
    fipId: normalized.fip_id,
    fipValidationHash: normalized.fip_validation_hash,
    fipSchemaVersion: normalized.fip_schema_version
  });

  if (
    input.idempotencyKey !== undefined &&
    input.idempotencyKey !== null &&
    String(input.idempotencyKey).trim() !== idempotencyKey
  ) {
    return errResult(DOMAIN_CODES.DISPLAY_METADATA_INPUT_INVALID);
  }

  normalized.idempotency_key = idempotencyKey;
  return okResult({ row: normalized });
}

function createFixtureDisplayMetadataPersistenceService(deps = {}) {
  assertDependency('db', deps.db);
  assertDependency('governor', deps.governor);
  assertDependency('gateReader', deps.gateReader);
  assertDependency('clock', deps.clock);

  const db = deps.db;
  const governor = deps.governor;
  const gateReader = deps.gateReader;
  const featureFlagEnabled = deps.featureFlagEnabled;
  const clock = deps.clock;

  async function evaluatePreDbGate() {
    const gateResult = await governor.evaluateGovernorGate({
      gateReader,
      featureFlagEnabled,
      refresh: Boolean(deps.refreshGate)
    });
    if (!gateResult.allowed) {
      const code =
        gateResult.code === governor.REJECTION_CODES?.LIFECYCLE_FEATURE_DISABLED
          ? DOMAIN_CODES.DISPLAY_METADATA_FEATURE_DISABLED
          : DOMAIN_CODES.DISPLAY_METADATA_GATE_BLOCKED;
      return errResult(code);
    }
    return okResult();
  }

  async function lifecycleParentExists(client, fixtureUid) {
    const result = await client.query(
      `SELECT fixture_uid
       FROM fixture_lifecycle_current
       WHERE fixture_uid = $1`,
      [fixtureUid]
    );
    return result.rows.length === 1;
  }

  async function loadByFixtureUid(client, fixtureUid) {
    const result = await client.query(
      `SELECT ${INTERNAL_SELECT_COLUMNS}
       FROM fixture_display_metadata
       WHERE fixture_uid = $1`,
      [fixtureUid]
    );
    if (result.rows.length === 0) {
      return okResult({ found: false });
    }
    return okResult({ found: true, row: result.rows[0] });
  }

  async function insertRow(client, row) {
    try {
      await client.query(
        `INSERT INTO fixture_display_metadata (
          fixture_uid, sport, scout_fixture_id, fip_id, fip_schema_version,
          fip_validation_hash, intake_id, idempotency_key, home_team_scout_id,
          away_team_scout_id, competition_id, competition_name, kickoff_at,
          timezone, home_team_name, away_team_name, venue, country,
          home_team_emblem_ref, away_team_emblem_ref, metadata_fresh_at,
          lifecycle_closed_at, purge_eligible_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, NULL, NULL, now(), now()
        )`,
        [
          row.fixture_uid,
          row.sport,
          row.scout_fixture_id,
          row.fip_id,
          row.fip_schema_version,
          row.fip_validation_hash,
          row.intake_id,
          row.idempotency_key,
          row.home_team_scout_id,
          row.away_team_scout_id,
          row.competition_id,
          row.competition_name,
          row.kickoff_at,
          row.timezone,
          row.home_team_name,
          row.away_team_name,
          row.venue,
          row.country,
          row.home_team_emblem_ref,
          row.away_team_emblem_ref,
          row.metadata_fresh_at
        ]
      );
      return okResult({ action: 'INSERT' });
    } catch (err) {
      return errResult(mapPersistenceError(err, { operation: 'insert' }));
    }
  }

  async function replaceRow(client, row) {
    try {
      const result = await client.query(
        `UPDATE fixture_display_metadata
         SET scout_fixture_id = $2,
             fip_id = $3,
             fip_schema_version = $4,
             fip_validation_hash = $5,
             intake_id = $6,
             idempotency_key = $7,
             home_team_scout_id = $8,
             away_team_scout_id = $9,
             competition_id = $10,
             competition_name = $11,
             kickoff_at = $12,
             timezone = $13,
             home_team_name = $14,
             away_team_name = $15,
             venue = $16,
             country = $17,
             home_team_emblem_ref = $18,
             away_team_emblem_ref = $19,
             metadata_fresh_at = $20,
             updated_at = now()
         WHERE fixture_uid = $1`,
        [
          row.fixture_uid,
          row.scout_fixture_id,
          row.fip_id,
          row.fip_schema_version,
          row.fip_validation_hash,
          row.intake_id,
          row.idempotency_key,
          row.home_team_scout_id,
          row.away_team_scout_id,
          row.competition_id,
          row.competition_name,
          row.kickoff_at,
          row.timezone,
          row.home_team_name,
          row.away_team_name,
          row.venue,
          row.country,
          row.home_team_emblem_ref,
          row.away_team_emblem_ref,
          row.metadata_fresh_at
        ]
      );
      if (result.rowCount !== 1) {
        return errResult(DOMAIN_CODES.DISPLAY_METADATA_NOT_FOUND);
      }
      return okResult({ action: 'UPDATE' });
    } catch (err) {
      return errResult(mapPersistenceError(err, { operation: 'update' }));
    }
  }

  async function upsertFromValidatedIntake(input = {}) {
    const gate = await evaluatePreDbGate();
    if (!gate.ok) {
      return gate;
    }

    const normalized = normalizeIntakeDto(input);
    if (!normalized.ok) {
      return normalized;
    }
    const row = normalized.row;

    try {
      return await db.withTransaction(async (client) => {
        const parentExists = await lifecycleParentExists(client, row.fixture_uid);
        if (!parentExists) {
          throw Object.assign(
            new Error(DOMAIN_CODES.DISPLAY_METADATA_LIFECYCLE_MISSING),
            { domainCode: DOMAIN_CODES.DISPLAY_METADATA_LIFECYCLE_MISSING }
          );
        }

        const existing = await loadByFixtureUid(client, row.fixture_uid);
        if (!existing.ok) {
          throw Object.assign(new Error(existing.code), { domainCode: existing.code });
        }

        if (!existing.found) {
          const inserted = await insertRow(client, row);
          if (!inserted.ok) {
            throw Object.assign(new Error(inserted.code), { domainCode: inserted.code });
          }
          return okResult({
            fixtureUid: row.fixture_uid,
            action: inserted.action,
            idempotencyKey: row.idempotency_key
          });
        }

        const current = existing.row;
        if (current.idempotency_key === row.idempotency_key) {
          if (!provenanceMatches(current, row)) {
            throw Object.assign(
              new Error(DOMAIN_CODES.DISPLAY_METADATA_PROVENANCE_CONFLICT),
              { domainCode: DOMAIN_CODES.DISPLAY_METADATA_PROVENANCE_CONFLICT }
            );
          }
          return okResult({
            fixtureUid: row.fixture_uid,
            action: 'NO_OP',
            idempotencyKey: row.idempotency_key
          });
        }

        const currentFresh = toValidDate(current.metadata_fresh_at);
        const incomingFresh = row.metadata_fresh_at;
        if (!currentFresh || incomingFresh.getTime() <= currentFresh.getTime()) {
          throw Object.assign(
            new Error(DOMAIN_CODES.DISPLAY_METADATA_STALE_UPDATE),
            { domainCode: DOMAIN_CODES.DISPLAY_METADATA_STALE_UPDATE }
          );
        }

        const updated = await replaceRow(client, row);
        if (!updated.ok) {
          throw Object.assign(new Error(updated.code), { domainCode: updated.code });
        }
        return okResult({
          fixtureUid: row.fixture_uid,
          action: updated.action,
          idempotencyKey: row.idempotency_key
        });
      });
    } catch (err) {
      if (err.domainCode) {
        return errResult(err.domainCode);
      }
      return errResult(mapPersistenceError(err));
    }
  }

  async function synchronizeRetentionFromLifecycle({ fixtureUid, lifecycleClosedAt } = {}) {
    const gate = await evaluatePreDbGate();
    if (!gate.ok) {
      return gate;
    }

    const uid = String(fixtureUid || '').trim();
    if (!isValidUuid(uid)) {
      return errResult(DOMAIN_CODES.DISPLAY_METADATA_INPUT_INVALID);
    }

    const closedAt = toValidDate(lifecycleClosedAt);
    if (!closedAt) {
      return errResult(DOMAIN_CODES.DISPLAY_METADATA_INPUT_INVALID);
    }

    const purgeEligibleAt = new Date(closedAt.getTime() + RETENTION_DAYS_MS);
    if (purgeEligibleAt.getTime() < closedAt.getTime()) {
      return errResult(DOMAIN_CODES.DISPLAY_METADATA_PURGE_TIMESTAMP_INVALID);
    }

    try {
      return await db.withTransaction(async (client) => {
        const existing = await loadByFixtureUid(client, uid);
        if (!existing.ok) {
          throw Object.assign(new Error(existing.code), { domainCode: existing.code });
        }
        if (!existing.found) {
          throw Object.assign(
            new Error(DOMAIN_CODES.DISPLAY_METADATA_NOT_FOUND),
            { domainCode: DOMAIN_CODES.DISPLAY_METADATA_NOT_FOUND }
          );
        }

        const result = await client.query(
          `UPDATE fixture_display_metadata
           SET lifecycle_closed_at = $2,
               purge_eligible_at = $3,
               updated_at = now()
           WHERE fixture_uid = $1`,
          [uid, closedAt, purgeEligibleAt]
        );
        if (result.rowCount !== 1) {
          throw Object.assign(
            new Error(DOMAIN_CODES.DISPLAY_METADATA_NOT_FOUND),
            { domainCode: DOMAIN_CODES.DISPLAY_METADATA_NOT_FOUND }
          );
        }

        return okResult({
          fixtureUid: uid,
          lifecycleClosedAt: closedAt,
          purgeEligibleAt
        });
      });
    } catch (err) {
      if (err.domainCode) {
        return errResult(err.domainCode);
      }
      return errResult(mapPersistenceError(err));
    }
  }

  async function getByFixtureUid(fixtureUid) {
    const gate = await evaluatePreDbGate();
    if (!gate.ok) {
      return gate;
    }

    const uid = String(fixtureUid || '').trim();
    if (!isValidUuid(uid)) {
      return errResult(DOMAIN_CODES.DISPLAY_METADATA_INPUT_INVALID);
    }

    try {
      const existing = await loadByFixtureUid(db, uid);
      if (!existing.ok) {
        return errResult(existing.code || DOMAIN_CODES.DISPLAY_METADATA_PERSISTENCE_UNAVAILABLE);
      }
      if (!existing.found) {
        return errResult(DOMAIN_CODES.DISPLAY_METADATA_NOT_FOUND);
      }
      return okResult({ row: existing.row });
    } catch {
      return errResult(DOMAIN_CODES.DISPLAY_METADATA_PERSISTENCE_UNAVAILABLE);
    }
  }

  return {
    DOMAIN_CODES,
    FORBIDDEN_PERSISTENCE_FIELDS,
    buildDisplayMetadataIdempotencyKey,
    upsertFromValidatedIntake,
    synchronizeRetentionFromLifecycle,
    getByFixtureUid,
    loadByFixtureUid,
    insertRow,
    replaceRow
  };
}

module.exports = {
  DOMAIN_CODES,
  FORBIDDEN_PERSISTENCE_FIELDS,
  FIXED_TIMEZONE,
  RETENTION_DAYS_MS,
  buildDisplayMetadataIdempotencyKey,
  createFixtureDisplayMetadataPersistenceService
};
