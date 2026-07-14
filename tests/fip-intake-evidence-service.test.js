'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { computeIdempotencyKey } = require('../backend/services/fipIntakeService');
const {
  DOMAIN_CODES,
  INTERNAL_SELECT_COLUMNS,
  FORBIDDEN_EVIDENCE_FIELDS,
  createFipIntakeEvidenceService,
  createEst001RetentionPolicy,
  validateEvidenceRecord,
  calculatePurgeEligibleAt,
  mapPersistenceError
} = require('../backend/services/fipIntakeEvidenceService');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION_PATH = path.join(
  ROOT,
  'supabase/migrations/20261011000001_sem_gov_001d_ui3_i8_fip_intake_evidence.sql'
);

const FIXTURE_UID = '11111111-1111-4111-8111-111111111111';
const FIP_ID = 'scout-fip-i8-001';
const FIP_SCHEMA_VERSION = '1.0.0';
const FIP_VALIDATION_HASH = 'a'.repeat(64);
const IDEMPOTENCY_KEY = computeIdempotencyKey({
  fipId: FIP_ID,
  validationHash: FIP_VALIDATION_HASH,
  fipSchemaVersion: FIP_SCHEMA_VERSION
});

function clearedGateReader() {
  return {
    async readGates() {
      return { supabaseStorageGate: 'CLEARED' };
    }
  };
}

function blockedGateReader() {
  return {
    async readGates() {
      return { supabaseStorageGate: 'BLOCKED' };
    }
  };
}

function fixedClock(iso = '2026-07-14T12:00:00.000Z') {
  const value = new Date(iso);
  return { now: () => value };
}

function baseEvidence(overrides = {}) {
  return {
    intakeId: 'intake-i8-001',
    fipId: FIP_ID,
    fipSchemaVersion: FIP_SCHEMA_VERSION,
    fipValidationHash: FIP_VALIDATION_HASH,
    scoutFixtureId: 'scout-fixture-001',
    fixtureUid: FIXTURE_UID,
    scoutRunId: 'scout-run-001',
    receivedAt: '2026-07-14T11:59:00.000Z',
    validatedAt: '2026-07-14T12:00:00.000Z',
    outcome: 'ACCEPTED',
    rejectionCode: null,
    governedMode: 'PRODUCTION',
    callerIdentityRef: 'caller-ref-001',
    idempotencyKey: IDEMPOTENCY_KEY,
    ...overrides
  };
}

class MemoryEvidenceStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.rows = [];
    this.queryLog = [];
    this.failNext = null;
  }

  log(sql) {
    this.queryLog.push(String(sql).replace(/\s+/g, ' ').trim());
  }

  async query(sql, params = []) {
    this.log(sql);
    if (this.failNext) {
      const err = this.failNext;
      this.failNext = null;
      throw err;
    }

    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (normalized.startsWith('INSERT INTO fip_intake_evidence')) {
      const acceptedDuplicate = this.rows.find(
        (row) => row.idempotency_key === params[13] && row.outcome === 'ACCEPTED'
      );
      if (acceptedDuplicate) {
        const err = new Error('duplicate accepted idempotency');
        err.code = '23505';
        err.constraint = 'idx_fip_intake_evidence_accepted_idempotency';
        throw err;
      }

      const row = {
        evidence_id: `evidence-${this.rows.length + 1}`,
        intake_id: params[0],
        fip_id: params[1],
        fip_schema_version: params[2],
        fip_validation_hash: params[3],
        scout_fixture_id: params[4],
        fixture_uid: params[5],
        scout_run_id: params[6],
        received_at: params[7],
        validated_at: params[8],
        outcome: params[9],
        rejection_code: params[10],
        governed_mode: params[11],
        caller_identity_ref: params[12],
        idempotency_key: params[13],
        recorded_at: params[14],
        purge_eligible_at: params[15]
      };
      this.rows.push(row);
      return { rows: [{ evidence_id: row.evidence_id }] };
    }

    if (
      normalized.includes('FROM fip_intake_evidence') &&
      normalized.includes("outcome = 'ACCEPTED'")
    ) {
      const matches = this.rows.filter(
        (row) => row.idempotency_key === params[0] && row.outcome === 'ACCEPTED'
      );
      return { rows: matches };
    }

    throw new Error(`Unexpected SQL in memory store: ${normalized}`);
  }
}

function createService(overrides = {}) {
  const store = overrides.store || new MemoryEvidenceStore();
  const service = createFipIntakeEvidenceService({
    db: store,
    gateReader: overrides.gateReader || clearedGateReader(),
    clock: overrides.clock || fixedClock(),
    retentionPolicy: overrides.retentionPolicy || createEst001RetentionPolicy(),
    featureFlagEnabled: overrides.featureFlagEnabled
  });
  return { service, store };
}

test('missing service dependencies fail at factory construction', () => {
  assert.throws(() => createFipIntakeEvidenceService({}), /Missing required dependency: db/);
  assert.throws(
    () => createFipIntakeEvidenceService({ db: {} }),
    /Missing required dependency: gateReader/
  );
  assert.throws(
    () =>
      createFipIntakeEvidenceService({
        db: {},
        gateReader: clearedGateReader()
      }),
    /Missing required dependency: clock/
  );
  assert.throws(
    () =>
      createFipIntakeEvidenceService({
        db: {},
        gateReader: clearedGateReader(),
        clock: fixedClock()
      }),
    /Missing required dependency: retentionPolicy/
  );
});

test('blocked gate causes zero DB calls', async () => {
  const { service, store } = createService({ gateReader: blockedGateReader() });
  const result = await service.recordIntakeEvidence(baseEvidence());
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.FIP_MARRIAGE_GATE_BLOCKED);
  assert.equal(store.queryLog.length, 0);
});

test('disabled feature causes zero DB calls', async () => {
  const { service, store } = createService({ featureFlagEnabled: false });
  const result = await service.recordIntakeEvidence(baseEvidence());
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.FIP_FEATURE_DISABLED);
  assert.equal(store.queryLog.length, 0);
});

test('invalid evidence causes zero DB calls', async () => {
  const { service, store } = createService();
  const result = await service.recordIntakeEvidence(baseEvidence({ outcome: 'MAYBE' }));
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.FIP_INTAKE_EVIDENCE_INVALID);
  assert.equal(store.queryLog.length, 0);
});

test('forbidden payload fields cause zero DB calls', async () => {
  const { service, store } = createService();
  const result = await service.recordIntakeEvidence(baseEvidence({ fipBody: { markets: {} } }));
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.FIP_INTAKE_EVIDENCE_INVALID);
  assert.equal(store.queryLog.length, 0);
});

test('ACCEPTED record requires NULL rejection code', () => {
  const result = validateEvidenceRecord(baseEvidence({ rejectionCode: 'X' }));
  assert.equal(result.ok, false);
  assert.equal(result.field, 'rejectionCode');
});

test('REJECTED record requires a rejection code', () => {
  const result = validateEvidenceRecord(
    baseEvidence({ outcome: 'REJECTED', rejectionCode: null, fixtureUid: null })
  );
  assert.equal(result.ok, false);
  assert.equal(result.field, 'rejectionCode');
});

test('fixture_uid may be NULL for an early rejection', () => {
  const result = validateEvidenceRecord(
    baseEvidence({
      outcome: 'REJECTED',
      rejectionCode: 'FIP_IDENTITY_UNRESOLVED',
      fixtureUid: null
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.row.fixture_uid, null);
});

test('fixture_uid must be a valid UUID when present', () => {
  const result = validateEvidenceRecord(baseEvidence({ fixtureUid: 'not-a-uuid' }));
  assert.equal(result.ok, false);
  assert.equal(result.field, 'fixtureUid');
});

test('deterministic idempotency key matches I5/I7', () => {
  const result = validateEvidenceRecord(baseEvidence());
  assert.equal(result.ok, true);
  assert.equal(result.row.idempotency_key, IDEMPOTENCY_KEY);
});

test('conflicting incoming key rejects', () => {
  const result = validateEvidenceRecord(
    baseEvidence({ idempotencyKey: 'b'.repeat(64) })
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'canonical_mismatch');
});

test('accepted evidence insert succeeds', async () => {
  const { service, store } = createService();
  const result = await service.recordIntakeEvidence(baseEvidence());
  assert.equal(result.ok, true);
  assert.ok(result.evidenceId);
  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0].outcome, 'ACCEPTED');
  assert.equal(store.rows[0].rejection_code, null);
});

test('rejected evidence insert succeeds', async () => {
  const { service, store } = createService();
  const result = await service.recordIntakeEvidence(
    baseEvidence({
      outcome: 'REJECTED',
      rejectionCode: 'FIP_INTAKE_UNAUTHORIZED',
      fixtureUid: null
    })
  );
  assert.equal(result.ok, true);
  assert.equal(store.rows[0].outcome, 'REJECTED');
  assert.equal(store.rows[0].rejection_code, 'FIP_INTAKE_UNAUTHORIZED');
});

test('duplicate accepted key maps to FIP_IDEMPOTENCY_DUPLICATE', async () => {
  const { service } = createService();
  const first = await service.recordIntakeEvidence(baseEvidence());
  assert.equal(first.ok, true);
  const second = await service.recordIntakeEvidence(baseEvidence());
  assert.equal(second.ok, false);
  assert.equal(second.code, DOMAIN_CODES.FIP_IDEMPOTENCY_DUPLICATE);
});

test('findAcceptedByIdempotencyKey returns found false', async () => {
  const { service } = createService();
  const result = await service.findAcceptedByIdempotencyKey(IDEMPOTENCY_KEY);
  assert.equal(result.ok, true);
  assert.equal(result.found, false);
  assert.equal(result.record, null);
});

test('findAcceptedByIdempotencyKey returns bounded accepted metadata', async () => {
  const { service } = createService();
  await service.recordIntakeEvidence(baseEvidence());
  const result = await service.findAcceptedByIdempotencyKey(IDEMPOTENCY_KEY);
  assert.equal(result.ok, true);
  assert.equal(result.found, true);
  assert.equal(result.record.intakeId, 'intake-i8-001');
  assert.equal(result.record.fipId, FIP_ID);
  assert.equal(result.record.idempotencyKey, IDEMPOTENCY_KEY);
  assert.ok(result.record.evidenceId);
});

test('multiple accepted rows maps to integrity error', async () => {
  const store = new MemoryEvidenceStore();
  store.rows.push(
  {
    evidence_id: 'dup-1',
    intake_id: 'intake-1',
    fip_id: FIP_ID,
    fip_schema_version: FIP_SCHEMA_VERSION,
    fip_validation_hash: FIP_VALIDATION_HASH,
    scout_fixture_id: 'scout-fixture-001',
    fixture_uid: FIXTURE_UID,
    scout_run_id: 'scout-run-001',
    received_at: new Date('2026-07-14T11:59:00.000Z'),
    validated_at: new Date('2026-07-14T12:00:00.000Z'),
    outcome: 'ACCEPTED',
    rejection_code: null,
    governed_mode: 'PRODUCTION',
    caller_identity_ref: 'caller-ref-001',
    idempotency_key: IDEMPOTENCY_KEY,
    recorded_at: new Date('2026-07-14T12:00:00.000Z'),
    purge_eligible_at: new Date('2026-10-12T12:00:00.000Z')
  },
  {
    evidence_id: 'dup-2',
    intake_id: 'intake-2',
    fip_id: FIP_ID,
    fip_schema_version: FIP_SCHEMA_VERSION,
    fip_validation_hash: FIP_VALIDATION_HASH,
    scout_fixture_id: 'scout-fixture-001',
    fixture_uid: FIXTURE_UID,
    scout_run_id: 'scout-run-001',
    received_at: new Date('2026-07-14T11:59:00.000Z'),
    validated_at: new Date('2026-07-14T12:00:00.000Z'),
    outcome: 'ACCEPTED',
    rejection_code: null,
    governed_mode: 'PRODUCTION',
    caller_identity_ref: 'caller-ref-001',
    idempotency_key: IDEMPOTENCY_KEY,
    recorded_at: new Date('2026-07-14T12:00:00.000Z'),
    purge_eligible_at: new Date('2026-10-12T12:00:00.000Z')
  }
  );
  const { service } = createService({ store });
  const result = await service.findAcceptedByIdempotencyKey(IDEMPOTENCY_KEY);
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.FIP_INTAKE_EVIDENCE_INTEGRITY_ERROR);
});

test('retention calculation follows the sealed EST-001 policy', () => {
  const recordedAt = new Date('2026-07-14T12:00:00.000Z');
  const policy = createEst001RetentionPolicy();
  const productionPurge = calculatePurgeEligibleAt(recordedAt, 'PRODUCTION', policy);
  const proofPurge = calculatePurgeEligibleAt(recordedAt, 'PROOF_FIXTURE', policy);
  assert.equal(productionPurge.toISOString(), '2026-10-12T12:00:00.000Z');
  assert.equal(proofPurge.toISOString(), '2027-07-14T12:00:00.000Z');
});

test('unresolved retention policy fails closed', async () => {
  const { service, store } = createService({
    retentionPolicy: {
      getRetentionDays() {
        return null;
      }
    }
  });
  const result = await service.recordIntakeEvidence(baseEvidence());
  assert.equal(result.ok, false);
  assert.equal(result.code, DOMAIN_CODES.FIP_INTAKE_EVIDENCE_RETENTION_UNRESOLVED);
  assert.equal(store.queryLog.length, 0);
});

test('explicit SQL columns only on insert', async () => {
  const { service, store } = createService();
  await service.recordIntakeEvidence(baseEvidence());
  const insertSql = store.queryLog.find((sql) => sql.startsWith('INSERT INTO fip_intake_evidence'));
  assert.ok(insertSql);
  assert.match(insertSql, /intake_id, fip_id, fip_schema_version/);
  assert.doesNotMatch(insertSql, /\*/);
});

test('find query uses explicit columns and no SELECT *', async () => {
  const { service, store } = createService();
  await service.findAcceptedByIdempotencyKey(IDEMPOTENCY_KEY);
  const selectSql = store.queryLog[0];
  assert.match(selectSql, new RegExp(`SELECT ${INTERNAL_SELECT_COLUMNS.replace(/,/g, ',\\s*')}`));
  assert.doesNotMatch(selectSql, /SELECT \*/);
});

test('no full FIP or raw payload enters SQL', async () => {
  const { service, store } = createService();
  await service.recordIntakeEvidence(baseEvidence());
  const joined = store.queryLog.join(' ');
  assert.doesNotMatch(joined, /fip_body|raw_json|provider_payload|markets|context/i);
});

test('mapPersistenceError maps unique violation to idempotency duplicate', () => {
  assert.equal(
    mapPersistenceError({ code: '23505', constraint: 'idx_fip_intake_evidence_accepted_idempotency' }),
    DOMAIN_CODES.FIP_IDEMPOTENCY_DUPLICATE
  );
  assert.equal(mapPersistenceError({ code: 'XX000' }), DOMAIN_CODES.FIP_INTAKE_EVIDENCE_UNAVAILABLE);
});

test('migration creates exactly one table', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  const createMatches = sql.match(/CREATE TABLE/gi) || [];
  assert.equal(createMatches.length, 1);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.fip_intake_evidence/);
});

test('migration includes outcome checks', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  assert.match(sql, /outcome IN \('ACCEPTED', 'REJECTED'\)/);
});

test('migration includes rejection-code consistency check', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  assert.match(sql, /outcome = 'ACCEPTED' AND rejection_code IS NULL/);
  assert.match(sql, /outcome = 'REJECTED' AND rejection_code IS NOT NULL/);
});

test('migration includes accepted partial unique idempotency index', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS idx_fip_intake_evidence_accepted_idempotency/);
  assert.match(sql, /WHERE outcome = 'ACCEPTED'/);
});

test('migration enables RLS and creates no anon/authenticated policies', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(sql, /CREATE POLICY/i);
});

test('migration includes no JSONB or payload columns', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  assert.doesNotMatch(sql, /JSONB/i);
  assert.doesNotMatch(sql, /fip_body|raw_json|provider_payload/i);
});

test('migration remains unapplied by I8 closure', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  assert.match(sql, /NOT APPLIED/i);
});

test('forbidden evidence field list is sealed', () => {
  assert.ok(FORBIDDEN_EVIDENCE_FIELDS.has('fipbody'));
  assert.ok(FORBIDDEN_EVIDENCE_FIELDS.has('providerpayload'));
  assert.ok(FORBIDDEN_EVIDENCE_FIELDS.has('bearertoken'));
});
