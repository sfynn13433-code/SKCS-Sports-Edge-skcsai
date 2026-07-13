'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FIP_SCHEMA_VERSION,
  HASH_ALGORITHM,
  SCOUT_FIP_ORIGIN,
  PROOF_FIXTURE_MODE,
  receiveValidatedFip,
  computeFipHash,
  computeIdempotencyKey,
  MAX_VALIDATION_AGE_MS,
  MAX_FUTURE_CLOCK_SKEW_MS,
  MAX_KICKOFF_HORIZON_MS
} = require('../backend/services/fipIntakeService');

function buildValidFip(overrides = {}) {
  const fip = {
    fip_schema_version: FIP_SCHEMA_VERSION,
    fip_id: 'E2E-001-PROOF-001',
    proof_mode: PROOF_FIXTURE_MODE,
    sports_truth_origin: SCOUT_FIP_ORIGIN,
    validation: {
      status: 'VALIDATED',
      algorithm: HASH_ALGORITHM,
      hash: '',
      validated_at: '2026-07-12T12:00:00.000Z'
    },
    fixture: {
      fixture_id: 'E2E-001-PROOF-001',
      match_id: 'E2E-001-PROOF-001',
      sport: 'football',
      home_team: 'Scout Home FC',
      away_team: 'Scout Away FC',
      kickoff_time: '2026-07-12T18:00:00Z',
      competition: 'EFI Proof League',
      country: 'ZA'
    },
    markets: {
      sharp_odds: {
        home: 2.1,
        draw: 3.2,
        away: 3.5
      },
      market_timestamp: '2026-07-12T12:00:00Z'
    },
    context: {
      contextual_intelligence: {
        form_note: 'proof fixture only',
        injury_note: null,
        weather: null
      },
      scout_profile_version: 'proof-v1'
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

function proofOptions(overrides = {}) {
  return {
    caller: 'EFI-001-I1-test',
    governedMode: PROOF_FIXTURE_MODE,
    scoutEdgeMarriageGate: 'BLOCKED',
    supabaseStorageGate: 'BLOCKED',
    receivedAt: '2026-07-12T12:00:00.000Z',
    ...overrides
  };
}

test('accepts a validated canonical Scout FIP proof fixture and maps Edge analysis envelope', () => {
  const fip = buildValidFip();
  const result = receiveValidatedFip(fip, proofOptions());

  assert.equal(result.accepted, true);
  assert.equal(result.result, 'ACCEPTED');
  assert.equal(result.rejection_code, null);

  assert.equal(result.envelope.match_info.match_id, 'E2E-001-PROOF-001');
  assert.equal(result.envelope.match_info.sports_truth_origin, SCOUT_FIP_ORIGIN);
  assert.deepEqual(result.envelope.sharp_odds, fip.markets.sharp_odds);
  assert.equal(result.envelope.contextual_intelligence.weather, null);

  assert.equal(result.envelope.metadata.sports_truth_origin, SCOUT_FIP_ORIGIN);
  assert.equal(result.envelope.metadata.fip_schema_version, FIP_SCHEMA_VERSION);
  assert.equal(result.envelope.metadata.validation_hash, fip.validation.hash);
  assert.equal(result.envelope.metadata.scout_edge_marriage_gate, 'BLOCKED');
  assert.equal(result.envelope.metadata.supabase_storage_gate, 'BLOCKED');

  assert.equal(
    result.evidence.idempotency_key,
    computeIdempotencyKey({
      fipId: fip.fip_id,
      validationHash: fip.validation.hash,
      fipSchemaVersion: FIP_SCHEMA_VERSION
    })
  );
});

test('rejects unsupported FIP schema versions', () => {
  const fip = buildValidFip({
    fip_schema_version: '2.0.0'
  });
  fip.validation.hash = computeFipHash(fip);

  const result = receiveValidatedFip(fip, proofOptions());

  assert.equal(result.accepted, false);
  assert.equal(result.rejection_code, 'UNSUPPORTED_SCHEMA_VERSION');
  assert.equal(result.envelope, null);
});

test('rejects FIP payloads that are not Scout VALIDATED', () => {
  const fip = buildValidFip({
    validation: {
      status: 'DRAFT'
    }
  });
  fip.validation.hash = computeFipHash(fip);

  const result = receiveValidatedFip(fip, proofOptions());

  assert.equal(result.accepted, false);
  assert.equal(result.rejection_code, 'VALIDATION_STATUS_NOT_VALIDATED');
});

test('rejects tampered FIP payload hash mismatch', () => {
  const fip = buildValidFip();
  fip.fixture.home_team = 'Tampered Home FC';

  const result = receiveValidatedFip(fip, proofOptions());

  assert.equal(result.accepted, false);
  assert.equal(result.rejection_code, 'HASH_MISMATCH');
});

test('rejects missing required fixture identity', () => {
  const fip = buildValidFip();
  delete fip.fixture.fixture_id;
  fip.validation.hash = computeFipHash(fip);

  const result = receiveValidatedFip(fip, proofOptions());

  assert.equal(result.accepted, false);
  assert.equal(result.rejection_code, 'REQUIRED_FIELD_MISSING');
  assert.equal(result.evidence.details.path, 'fixture.fixture_id');
});

test('rejects forbidden provider/manual/workspace origins', () => {
  const fip = buildValidFip({
    metadata: {
      source: 'buildLiveData'
    }
  });
  fip.validation.hash = computeFipHash(fip);

  const result = receiveValidatedFip(fip, proofOptions());

  assert.equal(result.accepted, false);
  assert.equal(result.rejection_code, 'FORBIDDEN_ORIGIN');
});

test('rejects production intake while the marriage gate remains blocked', () => {
  const fip = buildValidFip();

  const result = receiveValidatedFip(
    fip,
    proofOptions({
      governedMode: 'AUTHORIZED_PRODUCTION',
      scoutEdgeMarriageGate: 'BLOCKED'
    })
  );

  assert.equal(result.accepted, false);
  assert.equal(result.rejection_code, 'PRODUCTION_GATE_BLOCKED');
  assert.equal(result.envelope, null);
});

test('rejects FIP validation older than the 30-minute freshness window', () => {
  const fip = buildValidFip({
    validation: {
      validated_at: '2026-07-12T11:29:59.999Z'
    }
  });
  fip.validation.hash = computeFipHash(fip);

  const result = receiveValidatedFip(fip, proofOptions());

  assert.equal(result.accepted, false);
  assert.equal(result.rejection_code, 'FIP_STALE');
  assert.equal(result.envelope, null);
  assert.ok(result.evidence.details.validation_age_ms > MAX_VALIDATION_AGE_MS);
});

test('rejects FIP validation beyond the five-minute future clock-skew allowance', () => {
  const fip = buildValidFip({
    validation: {
      validated_at: '2026-07-12T12:05:00.001Z'
    }
  });
  fip.validation.hash = computeFipHash(fip);

  const result = receiveValidatedFip(fip, proofOptions());

  assert.equal(result.accepted, false);
  assert.equal(result.rejection_code, 'FIP_TIME_INVALID');
  assert.equal(result.envelope, null);
  assert.ok(
    result.evidence.details.future_skew_ms > MAX_FUTURE_CLOCK_SKEW_MS
  );
});

test('rejects malformed freshness timestamps', () => {
  const fip = buildValidFip({
    validation: {
      validated_at: 'not-a-timestamp'
    }
  });
  fip.validation.hash = computeFipHash(fip);

  const result = receiveValidatedFip(fip, proofOptions());

  assert.equal(result.accepted, false);
  assert.equal(result.rejection_code, 'FIP_TIME_INVALID');
  assert.equal(result.evidence.details.field, 'validation.validated_at');
});

test('rejects a parseable timestamp that is not UTC ISO-8601', () => {
  const fip = buildValidFip({
    validation: {
      validated_at: '2026-07-12 12:00:00'
    }
  });
  fip.validation.hash = computeFipHash(fip);

  const result = receiveValidatedFip(fip, proofOptions());

  assert.equal(result.accepted, false);
  assert.equal(result.rejection_code, 'FIP_TIME_INVALID');
  assert.equal(result.evidence.details.field, 'validation.validated_at');
});

test('rejects an impossible UTC ISO-8601 calendar timestamp', () => {
  const fip = buildValidFip({
    validation: {
      validated_at: '2026-02-30T12:00:00.000Z'
    }
  });
  fip.validation.hash = computeFipHash(fip);

  const result = receiveValidatedFip(fip, proofOptions());

  assert.equal(result.accepted, false);
  assert.equal(result.rejection_code, 'FIP_TIME_INVALID');
  assert.equal(result.evidence.details.field, 'validation.validated_at');
});

test('rejects a fixture that has already reached kickoff', () => {
  const fip = buildValidFip({
    fixture: {
      kickoff_time: '2026-07-12T12:00:00.000Z'
    }
  });
  fip.validation.hash = computeFipHash(fip);

  const result = receiveValidatedFip(fip, proofOptions());

  assert.equal(result.accepted, false);
  assert.equal(result.rejection_code, 'FIP_STALE');
  assert.equal(result.envelope, null);
  assert.ok(result.evidence.details.kickoff_delay_ms <= 0);
});

test('rejects a fixture beyond the 48-hour kickoff horizon', () => {
  const fip = buildValidFip({
    fixture: {
      kickoff_time: '2026-07-14T12:00:00.001Z'
    }
  });
  fip.validation.hash = computeFipHash(fip);

  const result = receiveValidatedFip(fip, proofOptions());

  assert.equal(result.accepted, false);
  assert.equal(result.rejection_code, 'FIP_STALE');
  assert.equal(result.envelope, null);
  assert.ok(
    result.evidence.details.kickoff_delay_ms > MAX_KICKOFF_HORIZON_MS
  );
});
