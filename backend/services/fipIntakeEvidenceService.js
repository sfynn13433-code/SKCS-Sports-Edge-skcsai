'use strict';

const crypto = require('node:crypto');
const { computeIdempotencyKey } = require('./fipIntakeService');

const DOMAIN_CODES = Object.freeze({
  FIP_MARRIAGE_GATE_BLOCKED: 'FIP_MARRIAGE_GATE_BLOCKED',
  FIP_FEATURE_DISABLED: 'FIP_FEATURE_DISABLED',
  FIP_INTAKE_EVIDENCE_INVALID: 'FIP_INTAKE_EVIDENCE_INVALID',
  FIP_IDEMPOTENCY_DUPLICATE: 'FIP_IDEMPOTENCY_DUPLICATE',
  FIP_INTAKE_EVIDENCE_UNAVAILABLE: 'FIP_INTAKE_EVIDENCE_UNAVAILABLE',
  FIP_INTAKE_EVIDENCE_INTEGRITY_ERROR: 'FIP_INTAKE_EVIDENCE_INTEGRITY_ERROR',
  FIP_INTAKE_EVIDENCE_RETENTION_UNRESOLVED: 'FIP_INTAKE_EVIDENCE_RETENTION_UNRESOLVED'
});

const ALLOWED_OUTCOMES = new Set(['ACCEPTED', 'REJECTED']);
const PROOF_FIXTURE_MODE = 'PROOF_FIXTURE';
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const PG_UNIQUE_VIOLATION = '23505';
const IDEMPOTENCY_KEY_RE = /^[a-f0-9]{64}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FORBIDDEN_EVIDENCE_FIELDS = new Set([
  'fullfip',
  'fipbody',
  'fip_body',
  'rawjson',
  'raw_json',
  'providerpayload',
  'provider_payload',
  'scoutpayload',
  'credentials',
  'authorization',
  'bearertoken',
  'bearer_token',
  'secret',
  'stack',
  'sqlerror',
  'sql_error',
  'markets',
  'context',
  'envelope',
  'canonical_fip'
]);

const INTERNAL_SELECT_COLUMNS = [
  'evidence_id',
  'intake_id',
  'fip_id',
  'fip_schema_version',
  'fip_validation_hash',
  'scout_fixture_id',
  'fixture_uid',
  'scout_run_id',
  'received_at',
  'validated_at',
  'outcome',
  'rejection_code',
  'governed_mode',
  'caller_identity_ref',
  'idempotency_key',
  'recorded_at',
  'purge_eligible_at'
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

function normalizeRequiredString(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalUuid(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return UUID_RE.test(trimmed) ? trimmed : null;
}

function rejectForbiddenFields(input) {
  if (!input || typeof input !== 'object') return null;
  for (const key of Object.keys(input)) {
    const normalized = String(key).replace(/[\s_-]+/g, '').toLowerCase();
    if (FORBIDDEN_EVIDENCE_FIELDS.has(normalized)) {
      return DOMAIN_CODES.FIP_INTAKE_EVIDENCE_INVALID;
    }
  }
  return null;
}

function buildCanonicalIdempotencyKey({ fipId, fipValidationHash, fipSchemaVersion }) {
  return computeIdempotencyKey({ fipId, validationHash: fipValidationHash, fipSchemaVersion });
}

function mapRowToRecord(row) {
  if (!row) return null;
  return {
    intakeId: row.intake_id,
    fipId: row.fip_id,
    fipSchemaVersion: row.fip_schema_version,
    fipValidationHash: row.fip_validation_hash,
    scoutFixtureId: row.scout_fixture_id,
    fixtureUid: row.fixture_uid || null,
    scoutRunId: row.scout_run_id,
    receivedAt: row.received_at,
    validatedAt: row.validated_at,
    outcome: row.outcome,
    rejectionCode: row.rejection_code || null,
    governedMode: row.governed_mode,
    callerIdentityRef: row.caller_identity_ref,
    idempotencyKey: row.idempotency_key,
    evidenceId: row.evidence_id,
    recordedAt: row.recorded_at,
    purgeEligibleAt: row.purge_eligible_at
  };
}

function mapPersistenceError(err, context = {}) {
  if (!err || typeof err !== 'object') {
    return DOMAIN_CODES.FIP_INTAKE_EVIDENCE_UNAVAILABLE;
  }
  if (err.code === PG_UNIQUE_VIOLATION) {
  const constraint = String(err.constraint || '');
    if (
      constraint.includes('fip_intake_evidence_accepted_idempotency') ||
      context.operation === 'insert'
    ) {
      return DOMAIN_CODES.FIP_IDEMPOTENCY_DUPLICATE;
    }
  }
  return DOMAIN_CODES.FIP_INTAKE_EVIDENCE_UNAVAILABLE;
}

function calculatePurgeEligibleAt(recordedAt, governedMode, retentionPolicy) {
  if (!retentionPolicy || typeof retentionPolicy.getRetentionDays !== 'function') {
    return null;
  }
  const days = retentionPolicy.getRetentionDays(governedMode);
  if (!Number.isFinite(days) || days <= 0) {
    return null;
  }
  const purge = new Date(recordedAt.getTime());
  purge.setUTCDate(purge.getUTCDate() + days);
  return purge;
}

function validateEvidenceRecord(input = {}) {
  const forbidden = rejectForbiddenFields(input);
  if (forbidden) {
    return errResult(forbidden);
  }

  const outcome = String(input.outcome || '').trim().toUpperCase();
  if (!ALLOWED_OUTCOMES.has(outcome)) {
    return errResult(DOMAIN_CODES.FIP_INTAKE_EVIDENCE_INVALID, { field: 'outcome' });
  }

  const receivedAt = toValidDate(input.receivedAt);
  const validatedAt = toValidDate(input.validatedAt);
  if (!receivedAt || !validatedAt) {
    return errResult(DOMAIN_CODES.FIP_INTAKE_EVIDENCE_INVALID, { field: 'timestamps' });
  }

  if (validatedAt.getTime() > receivedAt.getTime() + MAX_CLOCK_SKEW_MS) {
    return errResult(DOMAIN_CODES.FIP_INTAKE_EVIDENCE_INVALID, { field: 'validatedAt' });
  }

  const fixtureUid = normalizeOptionalUuid(input.fixtureUid);
  if (input.fixtureUid !== null && input.fixtureUid !== undefined && String(input.fixtureUid).trim() && !fixtureUid) {
    return errResult(DOMAIN_CODES.FIP_INTAKE_EVIDENCE_INVALID, { field: 'fixtureUid' });
  }

  const rejectionCode =
    outcome === 'ACCEPTED' ? null : normalizeRequiredString(input.rejectionCode);
  if (outcome === 'REJECTED' && !rejectionCode) {
    return errResult(DOMAIN_CODES.FIP_INTAKE_EVIDENCE_INVALID, { field: 'rejectionCode' });
  }
  if (outcome === 'ACCEPTED' && input.rejectionCode) {
    return errResult(DOMAIN_CODES.FIP_INTAKE_EVIDENCE_INVALID, { field: 'rejectionCode' });
  }

  const fipId = normalizeRequiredString(input.fipId);
  const fipSchemaVersion = normalizeRequiredString(input.fipSchemaVersion);
  const fipValidationHash = normalizeRequiredString(input.fipValidationHash);
  const idempotencyKey = normalizeRequiredString(input.idempotencyKey);

  const canonicalKey = buildCanonicalIdempotencyKey({
    fipId,
    fipValidationHash,
    fipSchemaVersion
  });

  if (!idempotencyKey || !IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
    return errResult(DOMAIN_CODES.FIP_INTAKE_EVIDENCE_INVALID, { field: 'idempotencyKey' });
  }

  if (idempotencyKey !== canonicalKey) {
    return errResult(DOMAIN_CODES.FIP_INTAKE_EVIDENCE_INVALID, {
      field: 'idempotencyKey',
      reason: 'canonical_mismatch'
    });
  }

  const normalized = {
    intake_id: normalizeRequiredString(input.intakeId),
    fip_id: fipId,
    fip_schema_version: fipSchemaVersion,
    fip_validation_hash: fipValidationHash,
    scout_fixture_id: normalizeRequiredString(input.scoutFixtureId),
    fixture_uid: fixtureUid,
    scout_run_id: normalizeRequiredString(input.scoutRunId),
    received_at: receivedAt,
    validated_at: validatedAt,
    outcome,
    rejection_code: rejectionCode,
    governed_mode: normalizeRequiredString(input.governedMode),
    caller_identity_ref: normalizeRequiredString(input.callerIdentityRef),
    idempotency_key: idempotencyKey
  };

  const requiredKeys = [
    'intake_id',
    'fip_id',
    'fip_schema_version',
    'fip_validation_hash',
    'scout_fixture_id',
    'scout_run_id',
    'governed_mode',
    'caller_identity_ref'
  ];
  for (const key of requiredKeys) {
    if (!normalized[key]) {
      return errResult(DOMAIN_CODES.FIP_INTAKE_EVIDENCE_INVALID, { field: key });
    }
  }

  return okResult({ row: normalized, record: mapRowToRecord({
    intake_id: normalized.intake_id,
    fip_id: normalized.fip_id,
    fip_schema_version: normalized.fip_schema_version,
    fip_validation_hash: normalized.fip_validation_hash,
    scout_fixture_id: normalized.scout_fixture_id,
    fixture_uid: normalized.fixture_uid,
    scout_run_id: normalized.scout_run_id,
    received_at: normalized.received_at,
    validated_at: normalized.validated_at,
    outcome: normalized.outcome,
    rejection_code: normalized.rejection_code,
    governed_mode: normalized.governed_mode,
    caller_identity_ref: normalized.caller_identity_ref,
    idempotency_key: normalized.idempotency_key
  }) });
}

function createFipIntakeEvidenceService(deps = {}) {
  assertDependency('db', deps.db);
  assertDependency('gateReader', deps.gateReader);
  assertDependency('clock', deps.clock);
  assertDependency('retentionPolicy', deps.retentionPolicy);

  const db = deps.db;
  const gateReader = deps.gateReader;
  const clock = deps.clock;
  const retentionPolicy = deps.retentionPolicy;
  const featureFlagEnabled = deps.featureFlagEnabled;

  async function evaluatePreDbGate() {
    if (featureFlagEnabled === false) {
      return errResult(DOMAIN_CODES.FIP_FEATURE_DISABLED);
    }

    const gates = await gateReader.readGates();
    if (gates.supabaseStorageGate !== 'CLEARED') {
      return errResult(DOMAIN_CODES.FIP_MARRIAGE_GATE_BLOCKED);
    }

    return okResult({ gates });
  }

  async function insertEvidence(client, row, purgeEligibleAt) {
    try {
      const result = await client.query(
        `INSERT INTO fip_intake_evidence (
          intake_id, fip_id, fip_schema_version, fip_validation_hash,
          scout_fixture_id, fixture_uid, scout_run_id, received_at, validated_at,
          outcome, rejection_code, governed_mode, caller_identity_ref,
          idempotency_key, recorded_at, purge_eligible_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
        RETURNING evidence_id`,
        [
          row.intake_id,
          row.fip_id,
          row.fip_schema_version,
          row.fip_validation_hash,
          row.scout_fixture_id,
          row.fixture_uid,
          row.scout_run_id,
          row.received_at,
          row.validated_at,
          row.outcome,
          row.rejection_code,
          row.governed_mode,
          row.caller_identity_ref,
          row.idempotency_key,
          row.recorded_at,
          purgeEligibleAt
        ]
      );
      return okResult({ evidenceId: result.rows[0]?.evidence_id || null });
    } catch (err) {
      return errResult(mapPersistenceError(err, { operation: 'insert' }));
    }
  }

  async function recordIntakeEvidence(record) {
    const gate = await evaluatePreDbGate();
    if (!gate.ok) {
      return gate;
    }

    const validated = validateEvidenceRecord(record);
    if (!validated.ok) {
      return validated;
    }

    const recordedAt = toValidDate(clock.now()) || new Date();
    const purgeEligibleAt = calculatePurgeEligibleAt(
      recordedAt,
      validated.row.governed_mode,
      retentionPolicy
    );
    if (!purgeEligibleAt) {
      return errResult(DOMAIN_CODES.FIP_INTAKE_EVIDENCE_RETENTION_UNRESOLVED);
    }

    const row = {
      ...validated.row,
      recorded_at: recordedAt
    };

    const inserted = await insertEvidence(db, row, purgeEligibleAt);
    if (!inserted.ok) {
      return inserted;
    }

    return okResult({
      evidenceId: inserted.evidenceId,
      purgeEligibleAt,
      record: validated.record
    });
  }

  async function findAcceptedByIdempotencyKey(idempotencyKey) {
    const gate = await evaluatePreDbGate();
    if (!gate.ok) {
      return gate;
    }

    const key = normalizeRequiredString(idempotencyKey);
    if (!key || !IDEMPOTENCY_KEY_RE.test(key)) {
      return errResult(DOMAIN_CODES.FIP_INTAKE_EVIDENCE_INVALID, { field: 'idempotencyKey' });
    }

    try {
      const result = await db.query(
        `SELECT ${INTERNAL_SELECT_COLUMNS}
         FROM fip_intake_evidence
         WHERE idempotency_key = $1 AND outcome = 'ACCEPTED'`,
        [key]
      );

      if (result.rows.length === 0) {
        return okResult({ found: false, record: null });
      }

      if (result.rows.length > 1) {
        return errResult(DOMAIN_CODES.FIP_INTAKE_EVIDENCE_INTEGRITY_ERROR, {
          idempotency_key: key,
          match_count: result.rows.length
        });
      }

      return okResult({ found: true, record: mapRowToRecord(result.rows[0]) });
    } catch (err) {
      return errResult(mapPersistenceError(err, { operation: 'select' }));
    }
  }

  return {
    recordIntakeEvidence,
    findAcceptedByIdempotencyKey
  };
}

function createEst001RetentionPolicy() {
  return {
    getRetentionDays(governedMode) {
      return String(governedMode || '').trim().toUpperCase() === PROOF_FIXTURE_MODE
        ? 365
        : 90;
    }
  };
}

module.exports = {
  DOMAIN_CODES,
  ALLOWED_OUTCOMES,
  FORBIDDEN_EVIDENCE_FIELDS,
  INTERNAL_SELECT_COLUMNS,
  createFipIntakeEvidenceService,
  createEst001RetentionPolicy,
  validateEvidenceRecord,
  calculatePurgeEligibleAt,
  buildCanonicalIdempotencyKey,
  mapRowToRecord,
  mapPersistenceError
};
