'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FIP_SCHEMA_VERSION,
  HASH_ALGORITHM,
  SCOUT_FIP_ORIGIN,
  PROOF_FIXTURE_MODE,
  receiveValidatedFip,
  computeFipHash
} = require('../backend/services/fipIntakeService');

const {
  STORAGE_CLASSES,
  DEFAULT_SUPABASE_LIMIT_BYTES,
  evaluateSupabaseBudget,
  buildEstStorageRecords,
  detectForbiddenFullFipBody,
  estimateBytes
} = require('../backend/services/fipStoragePolicyService');

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }

  return target;
}

function buildValidFip(overrides = {}) {
  const fip = {
    fip_schema_version: FIP_SCHEMA_VERSION,
    fip_id: 'E2E-001-PROOF-001',
    proof_mode: PROOF_FIXTURE_MODE,
    sports_truth_origin: SCOUT_FIP_ORIGIN,
    validation: {
      status: 'VALIDATED',
      algorithm: HASH_ALGORITHM,
      hash: ''
    },
    fixture: {
      fixture_id: 'E2E-001-PROOF-001',
      match_id: 'E2E-001-PROOF-001',
      sport: 'football',
      home_team: 'Scout Home FC',
      away_team: 'Scout Away FC',
      kickoff_time: '2026-07-12T18:00:00Z',
      competition: 'EST Proof League',
      country: 'ZA'
    },
    markets: {
      sharp_odds: {
        home: 2.1,
        draw: 3.2,
        away: 3.5
      }
    },
    context: {
      contextual_intelligence: {
        form_note: 'proof fixture only',
        injury_note: null,
        weather: null
      }
    },
    metadata: {
      sports_truth_origin: SCOUT_FIP_ORIGIN,
      source: SCOUT_FIP_ORIGIN
    }
  };

  deepMerge(fip, overrides);
  fip.validation.hash = computeFipHash(fip);
  return fip;
}

function proofOptions(overrides = {}) {
  return {
    caller: 'EST-001-I1-test',
    governedMode: PROOF_FIXTURE_MODE,
    scoutEdgeMarriageGate: 'BLOCKED',
    supabaseStorageGate: 'BLOCKED',
    receivedAt: '2026-07-12T12:00:00.000Z',
    ...overrides
  };
}

function acceptedIntake() {
  const fip = buildValidFip();
  const result = receiveValidatedFip(fip, proofOptions());

  assert.equal(result.accepted, true);
  return { fip, result };
}

test('builds minimal R1 provenance and R2 audit records from accepted EFI intake', () => {
  const { result } = acceptedIntake();

  const decision = buildEstStorageRecords(result, {
    createdAt: '2026-07-12T12:00:00.000Z',
    usedBytes: 1000,
    limitBytes: DEFAULT_SUPABASE_LIMIT_BYTES
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.result, 'R1_R2_READY');

  const r1 = decision.records.r1_provenance_reference;
  const r2 = decision.records.r2_intake_audit_event;

  assert.equal(r1.storage_class, STORAGE_CLASSES.R1_PROVENANCE_REFERENCE);
  assert.equal(r1.fip_id, 'E2E-001-PROOF-001');
  assert.equal(r1.validation_hash, result.evidence.validation_hash);
  assert.equal(r1.replay_source, 'SCOUT_BY_FIP_ID_AND_HASH');
  assert.equal(r1.full_fip_body_persisted, false);

  assert.equal(r2.storage_class, STORAGE_CLASSES.R2_INTAKE_AUDIT_EVENT);
  assert.equal(r2.accepted, true);
  assert.equal(r2.result, 'ACCEPTED');
  assert.equal(r2.full_fip_body_persisted, false);
  assert.equal(r2.scout_mirror_persisted, false);

  assert.equal(decision.records.d1_derived_prediction_reference, null);
});

test('does not include full FIP body, markets, context, or sharp odds inside EST records', () => {
  const { result } = acceptedIntake();
  const decision = buildEstStorageRecords(result, {
    createdAt: '2026-07-12T12:00:00.000Z'
  });

  const serializedRecords = JSON.stringify(decision.records);

  assert.equal(serializedRecords.includes('sharp_odds'), false);
  assert.equal(serializedRecords.includes('contextual_intelligence'), false);
  assert.equal(serializedRecords.includes('"markets"'), false);
  assert.equal(serializedRecords.includes('"context"'), false);
  assert.equal(serializedRecords.includes('"fixture"'), false);

  assert.ok(estimateBytes(decision.records.r1_provenance_reference) < 3000);
  assert.ok(estimateBytes(decision.records.r2_intake_audit_event) < 3000);
});

test('blocks attempts to pass a full FIP body for Supabase persistence', () => {
  const { fip, result } = acceptedIntake();

  const decision = buildEstStorageRecords(result, {
    fullFipBody: fip,
    createdAt: '2026-07-12T12:00:00.000Z'
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.result, 'BLOCKED');
  assert.equal(decision.rejection_code, 'FULL_FIP_BODY_FORBIDDEN');
  assert.equal(decision.records.r1_provenance_reference, null);
  assert.equal(decision.records.r2_intake_audit_event, null);
});

test('detects forbidden Scout mirror and provider payload keys', () => {
  assert.deepEqual(
    detectForbiddenFullFipBody({
      scout_mirror: {
        fip_id: 'bad'
      }
    }),
    {
      path: '$.scout_mirror',
      reason: 'FORBIDDEN_FULL_FIP_KEY'
    }
  );

  assert.deepEqual(
    detectForbiddenFullFipBody({
      wrapper: {
        provider_payload: {
          raw: true
        }
      }
    }),
    {
      path: '$.wrapper.provider_payload',
      reason: 'FORBIDDEN_FULL_FIP_KEY'
    }
  );
});

test('creates audit-only storage decision for rejected EFI intake', () => {
  const rejected = receiveValidatedFip(
    buildValidFip({
      validation: {
        status: 'DRAFT'
      }
    }),
    proofOptions()
  );

  assert.equal(rejected.accepted, false);

  const decision = buildEstStorageRecords(rejected, {
    createdAt: '2026-07-12T12:00:00.000Z'
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.result, 'AUDIT_ONLY');
  assert.equal(decision.records.r1_provenance_reference, null);
  assert.equal(decision.records.r2_intake_audit_event.accepted, false);
  assert.equal(
    decision.records.r2_intake_audit_event.rejection_code,
    'VALIDATION_STATUS_NOT_VALIDATED'
  );
});

test('applies Supabase 80/95/100 storage thresholds without allowing full FIP writes', () => {
  assert.equal(
    evaluateSupabaseBudget({
      usedBytes: DEFAULT_SUPABASE_LIMIT_BYTES * 0.79,
      limitBytes: DEFAULT_SUPABASE_LIMIT_BYTES
    }).level,
    'OK'
  );

  assert.equal(
    evaluateSupabaseBudget({
      usedBytes: DEFAULT_SUPABASE_LIMIT_BYTES * 0.8,
      limitBytes: DEFAULT_SUPABASE_LIMIT_BYTES
    }).level,
    'WARNING'
  );

  assert.equal(
    evaluateSupabaseBudget({
      usedBytes: DEFAULT_SUPABASE_LIMIT_BYTES * 0.95,
      limitBytes: DEFAULT_SUPABASE_LIMIT_BYTES
    }).level,
    'CRITICAL'
  );

  const hardBlock = evaluateSupabaseBudget({
    usedBytes: DEFAULT_SUPABASE_LIMIT_BYTES,
    limitBytes: DEFAULT_SUPABASE_LIMIT_BYTES
  });

  assert.equal(hardBlock.level, 'HARD_BLOCK');
  assert.equal(hardBlock.block_full_fip_body_writes, true);
  assert.equal(hardBlock.block_all_new_est_records, true);
});

test('blocks all new EST records at Supabase hard block threshold', () => {
  const { result } = acceptedIntake();

  const decision = buildEstStorageRecords(result, {
    usedBytes: DEFAULT_SUPABASE_LIMIT_BYTES,
    limitBytes: DEFAULT_SUPABASE_LIMIT_BYTES,
    createdAt: '2026-07-12T12:00:00.000Z'
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.rejection_code, 'SUPABASE_STORAGE_HARD_BLOCK');
  assert.equal(decision.records.r1_provenance_reference, null);
  assert.equal(decision.records.r2_intake_audit_event, null);
});
