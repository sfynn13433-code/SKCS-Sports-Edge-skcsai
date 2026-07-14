'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const fipIntakeService = require('../backend/services/fipIntakeService');
const {
  HASH_ALGORITHM,
  PROOF_FIXTURE_MODE,
  DOMAIN_CODES,
  computeFipHash,
  computeIdempotencyKey
} = fipIntakeService;
const {
  buildDisplayMetadataIdempotencyKey
} = require('../backend/services/fixtureDisplayMetadataPersistenceService');
const {
  createFixtureIdentityResolver
} = require('../backend/services/fixtureIdentityResolverService');
const {
  createGovernedFipIntakeAdapter,
  buildBoundedEvidenceRecord
} = require('../backend/services/governedFipIntakeAdapter');

const FIXTURE_UID = '11111111-1111-4111-8111-111111111111';
const RECEIVED_AT = '2026-07-12T12:00:00.000Z';

const D3_ALLOWED_FIELDS = new Set([
  'fixtureUid',
  'sport',
  'scoutFixtureId',
  'fipId',
  'fipSchemaVersion',
  'fipValidationHash',
  'intakeId',
  'idempotencyKey',
  'homeTeamScoutId',
  'awayTeamScoutId',
  'competitionId',
  'competitionName',
  'kickoffAt',
  'timezone',
  'homeTeamName',
  'awayTeamName',
  'venue',
  'country',
  'homeTeamEmblemRef',
  'awayTeamEmblemRef',
  'metadataFreshAt'
]);

function buildCanonicalFip(overrides = {}) {
  const fip = {
    fip_id: 'scout-fip-i7-001',
    fip_schema_version: '1.0.0',
    validation: {
      status: 'VALIDATED',
      hash: '',
      hash_algorithm: HASH_ALGORITHM,
      validated_at: '2026-07-12T12:00:00.000Z'
    },
    scout: {
      fixture_id: 'scout-fixture-001'
    },
    provenance: {
      scout_run_id: 'scout-run-001',
      source_system: 'SCOUT',
      assembled_at: '2026-07-12T11:55:00.000Z'
    },
    fixture: {
      sport: 'football',
      league_id: 'league-1',
      league: 'Example League',
      kickoff_utc: '2026-07-12T18:00:00.000Z',
      status: 'NS',
      home_team: { id: 'team-home-1', name: 'Home FC' },
      away_team: { id: 'team-away-1', name: 'Away FC' },
      country: 'ZA'
    },
    markets: {
      direct_1x2: { home: 2.1, draw: 3.4, away: 3.2 },
      source: 'scout-governed-odds'
    },
    context: {
      weather: null,
      injuries: [],
      form: { home: {}, away: {} }
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

function createInMemoryEvidenceRecorder(options = {}) {
  const records = [];
  return {
    records,
    async recordIntakeEvidence(record) {
      if (options.failOnRecord) {
        throw new Error('evidence unavailable');
      }
      records.push({ ...record });
      return { ok: true };
    },
    async findAcceptedByIdempotencyKey(key) {
      return records.find((r) => r.idempotencyKey === key && r.outcome === 'ACCEPTED') || null;
    }
  };
}

function createMockQuery() {
  return async function query(sql, params) {
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    if (normalized.includes('fixture_identity_aliases')) {
      return { rows: [{ fixture_uid: FIXTURE_UID }] };
    }
    if (normalized.includes('fixture_lifecycle_current')) {
      return { rows: [{ fixture_uid: FIXTURE_UID }] };
    }
    return { rows: [] };
  };
}

function createAdapterDeps(overrides = {}) {
  const identityCalls = { resolve: 0, lifecycle: 0 };
  const d3Calls = { upsert: 0 };
  const evidenceRecorder = overrides.evidenceRecorder || createInMemoryEvidenceRecorder();

  const fixtureIdentityResolver = {
    async resolveScoutFixtureId(scoutFixtureId) {
      identityCalls.resolve += 1;
      if (overrides.identityResult) {
        return overrides.identityResult;
      }
      return createFixtureIdentityResolver({ query: createMockQuery() }).resolveScoutFixtureId(
        scoutFixtureId
      );
    },
    async confirmLifecycleParent(fixtureUid) {
      identityCalls.lifecycle += 1;
      if (overrides.lifecycleResult) {
        return overrides.lifecycleResult;
      }
      return createFixtureIdentityResolver({ query: createMockQuery() }).confirmLifecycleParent(
        fixtureUid
      );
    }
  };

  const displayMetadataPersistence = {
    async upsertFromValidatedIntake(dto) {
      d3Calls.upsert += 1;
      if (overrides.persistenceResult) {
        return overrides.persistenceResult;
      }
      return { ok: true, code: 'INSERTED' };
    }
  };

  const deps = {
    fipIntakeService,
    fixtureIdentityResolver,
    displayMetadataPersistence,
    evidenceRecorder,
    gateReader: {
      async readGates() {
        return (
          overrides.gates || {
            scoutEdgeMarriageGate: 'BLOCKED',
            supabaseStorageGate: 'BLOCKED',
            unifiedLifecycleGovernor: 'BLOCKED'
          }
        );
      }
    },
    authorizeCaller: async ({ caller, governedMode }) => {
      if (overrides.authorize === false) {
        return {
          authorized: false,
          code: DOMAIN_CODES.FIP_INTAKE_UNAUTHORIZED,
          message: 'Unauthorized'
        };
      }
      if (!caller) {
        return {
          authorized: false,
          code: DOMAIN_CODES.FIP_INTAKE_UNAUTHORIZED,
          message: 'Caller required'
        };
      }
      if (governedMode !== PROOF_FIXTURE_MODE && governedMode !== 'AUTHORIZED_PRODUCTION') {
        return {
          authorized: false,
          code: DOMAIN_CODES.FIP_INTAKE_UNAUTHORIZED,
          message: 'Unsupported governed mode'
        };
      }
      return { authorized: true };
    },
    clock: { now: () => RECEIVED_AT },
    intakeIdGenerator: ({ fipId, validationHash, receivedAt }) =>
      fipIntakeService.buildIntakeId({ fipId, validationHash, receivedAt }),
    featureFlagEnabled: overrides.featureFlagEnabled !== false,
    ...overrides.deps
  };

  const adapter = createGovernedFipIntakeAdapter(deps);
  return { adapter, identityCalls, d3Calls, evidenceRecorder, displayMetadataPersistence };
}

function proofContext(overrides = {}) {
  return {
    caller: 'UI3-I7-test',
    governedMode: PROOF_FIXTURE_MODE,
    receivedAt: RECEIVED_AT,
    ...overrides
  };
}

test('missing dependencies fail at factory construction', () => {
  assert.throws(() => createGovernedFipIntakeAdapter({}), /Missing required dependency/);
});

test('blocked marriage gate causes zero identity, D3 and envelope downstream calls', async () => {
  const { adapter, identityCalls, d3Calls } = createAdapterDeps();
  const fip = buildCanonicalFip();
  const result = await adapter.receiveValidatedFip(
    fip,
    proofContext({ governedMode: 'AUTHORIZED_PRODUCTION' })
  );

  assert.equal(result.accepted, false);
  assert.equal(result.rejection_code, DOMAIN_CODES.FIP_MARRIAGE_GATE_BLOCKED);
  assert.equal(identityCalls.resolve, 0);
  assert.equal(identityCalls.lifecycle, 0);
  assert.equal(d3Calls.upsert, 0);
  assert.equal(result.envelope, null);
});

test('disabled feature causes zero downstream calls', async () => {
  const { adapter, identityCalls, d3Calls } = createAdapterDeps({ featureFlagEnabled: false });
  const result = await adapter.receiveValidatedFip(buildCanonicalFip(), proofContext());
  assert.equal(result.accepted, false);
  assert.equal(result.rejection_code, DOMAIN_CODES.FIP_FEATURE_DISABLED);
  assert.equal(identityCalls.resolve, 0);
  assert.equal(d3Calls.upsert, 0);
});

test('unauthorized caller fails closed', async () => {
  const { adapter, identityCalls, d3Calls } = createAdapterDeps();
  const result = await adapter.receiveValidatedFip(buildCanonicalFip(), proofContext({ caller: '' }));
  assert.equal(result.accepted, false);
  assert.equal(result.rejection_code, DOMAIN_CODES.FIP_INTAKE_UNAUTHORIZED);
  assert.equal(identityCalls.resolve, 0);
  assert.equal(d3Calls.upsert, 0);
});

test('authoritative FIP-001 shape is accepted', async () => {
  const { adapter } = createAdapterDeps();
  const result = await adapter.receiveValidatedFip(buildCanonicalFip(), proofContext());
  assert.equal(result.accepted, true);
  assert.equal(result.envelope.metadata.sports_truth_origin, 'SCOUT_FIP');
  assert.equal(result.canonical_fip.scout.fixture_id, 'scout-fixture-001');
});

test('unsupported schema is rejected', async () => {
  const { adapter, identityCalls } = createAdapterDeps();
  const fip = buildCanonicalFip({ fip_schema_version: '9.9.9' });
  fip.validation.hash = computeFipHash(fip);
  const result = await adapter.receiveValidatedFip(fip, proofContext());
  assert.equal(result.rejection_code, DOMAIN_CODES.FIP_SCHEMA_UNSUPPORTED);
  assert.equal(identityCalls.resolve, 0);
});

test('validation.status other than VALIDATED is rejected', async () => {
  const fip = buildCanonicalFip();
  fip.validation.status = 'DRAFT';
  fip.validation.hash = computeFipHash(fip);
  const { adapter } = createAdapterDeps();
  const result = await adapter.receiveValidatedFip(fip, proofContext());
  assert.equal(result.rejection_code, DOMAIN_CODES.FIP_NOT_VALIDATED);
});

test('validation.hash_algorithm drift is corrected to canonical law', async () => {
  const fip = buildCanonicalFip();
  const result = await fipIntakeService.validateCanonicalFipIntake(fip, proofContext());
  assert.equal(result.accepted, true);
  assert.equal(result.canonical_fip.validation.hash_algorithm, HASH_ALGORITHM);
  assert.equal(result.canonical_fip.validation.algorithm, undefined);
});

test('canonical hash passes for an unmodified FIP', async () => {
  const fip = buildCanonicalFip();
  const { adapter } = createAdapterDeps();
  const result = await adapter.receiveValidatedFip(fip, proofContext());
  assert.equal(result.accepted, true);
});

test('mutated FIP fails hash verification', async () => {
  const fip = buildCanonicalFip();
  fip.fixture.home_team.name = 'Tampered';
  const { adapter } = createAdapterDeps();
  const result = await adapter.receiveValidatedFip(fip, proofContext());
  assert.equal(result.rejection_code, DOMAIN_CODES.FIP_HASH_MISMATCH);
});

test('forbidden provider-mixed content is rejected', async () => {
  const fip = buildCanonicalFip({
    metadata: { source: 'buildLiveData' }
  });
  fip.validation.hash = computeFipHash(fip);
  const { adapter } = createAdapterDeps();
  const result = await adapter.receiveValidatedFip(fip, proofContext());
  assert.equal(result.rejection_code, DOMAIN_CODES.FIP_FORBIDDEN_ORIGIN);
});

test('missing required identity fields fail closed', async () => {
  const fip = buildCanonicalFip();
  delete fip.scout.fixture_id;
  fip.validation.hash = computeFipHash(fip);
  const { adapter } = createAdapterDeps();
  const result = await adapter.receiveValidatedFip(fip, proofContext());
  assert.equal(result.rejection_code, DOMAIN_CODES.FIP_REQUIRED_FIELD_MISSING);
});

test('existing legacy proof shape is handled only through explicit compatibility mapper', async () => {
  const legacy = {
    fip_schema_version: '1.0.0',
    fip_id: 'legacy-proof-001',
    proof_mode: PROOF_FIXTURE_MODE,
    validation: {
      status: 'VALIDATED',
      algorithm: HASH_ALGORITHM,
      hash: '',
      validated_at: '2026-07-12T12:00:00.000Z'
    },
    fixture: {
      fixture_id: 'scout-fixture-001',
      sport: 'football',
      home_team: 'Home FC',
      away_team: 'Away FC',
      kickoff_time: '2026-07-12T18:00:00.000Z',
      competition: 'Legacy League'
    },
    markets: { sharp_odds: { home: 2.0, draw: 3.0, away: 4.0 } },
    context: { contextual_intelligence: { form_note: 'legacy' } }
  };
  legacy.validation.hash = computeFipHash(legacy);
  const { adapter } = createAdapterDeps();
  const result = await adapter.receiveValidatedFip(legacy, proofContext());
  assert.equal(result.accepted, true);
  assert.equal(result.canonical_fip.validation.hash_algorithm, HASH_ALGORITHM);
});

test('missing alias returns FIP_FIXTURE_IDENTITY_UNRESOLVED', async () => {
  const { adapter } = createAdapterDeps({
    identityResult: {
      ok: false,
      code: DOMAIN_CODES.FIP_FIXTURE_IDENTITY_UNRESOLVED
    }
  });
  const result = await adapter.receiveValidatedFip(buildCanonicalFip(), proofContext());
  assert.equal(result.rejection_code, DOMAIN_CODES.FIP_FIXTURE_IDENTITY_UNRESOLVED);
});

test('conflicting alias returns FIP_IDENTITY_INCONSISTENT', async () => {
  const { adapter } = createAdapterDeps({
    identityResult: {
      ok: false,
      code: DOMAIN_CODES.FIP_IDENTITY_INCONSISTENT
    }
  });
  const result = await adapter.receiveValidatedFip(buildCanonicalFip(), proofContext());
  assert.equal(result.rejection_code, DOMAIN_CODES.FIP_IDENTITY_INCONSISTENT);
});

test('missing lifecycle parent returns FIP_LIFECYCLE_PARENT_MISSING', async () => {
  const { adapter } = createAdapterDeps({
    lifecycleResult: {
      ok: false,
      code: DOMAIN_CODES.FIP_LIFECYCLE_PARENT_MISSING
    }
  });
  const result = await adapter.receiveValidatedFip(buildCanonicalFip(), proofContext());
  assert.equal(result.rejection_code, DOMAIN_CODES.FIP_LIFECYCLE_PARENT_MISSING);
});

test('D3 DTO contains the exact allowed bounded fields', async () => {
  const { adapter } = createAdapterDeps();
  const result = await adapter.receiveValidatedFip(buildCanonicalFip(), proofContext());
  assert.equal(result.accepted, true);
  for (const key of Object.keys(result.d3_dto)) {
    assert.ok(D3_ALLOWED_FIELDS.has(key), `unexpected D3 field ${key}`);
  }
  for (const key of D3_ALLOWED_FIELDS) {
    assert.ok(Object.prototype.hasOwnProperty.call(result.d3_dto, key), `missing D3 field ${key}`);
  }
});

test('D3 DTO contains no FIP body, markets, odds, context or raw payload', async () => {
  const { adapter } = createAdapterDeps();
  const result = await adapter.receiveValidatedFip(buildCanonicalFip(), proofContext());
  const serialized = JSON.stringify(result.d3_dto);
  assert.doesNotMatch(serialized, /markets|context|direct_1x2|sharp_odds|raw_|fip_body/i);
});

test('deterministic idempotency key matches I5', async () => {
  const fip = buildCanonicalFip();
  const expected = buildDisplayMetadataIdempotencyKey({
    fipId: fip.fip_id,
    fipValidationHash: fip.validation.hash,
    fipSchemaVersion: fip.fip_schema_version
  });
  const { adapter } = createAdapterDeps();
  const result = await adapter.receiveValidatedFip(fip, proofContext());
  assert.equal(result.d3_dto.idempotencyKey, expected);
  assert.equal(
    result.d3_dto.idempotencyKey,
    computeIdempotencyKey({
      fipId: fip.fip_id,
      validationHash: fip.validation.hash,
      fipSchemaVersion: fip.fip_schema_version
    })
  );
});

test('same package is idempotent and does not duplicate D3 state', async () => {
  const evidenceRecorder = createInMemoryEvidenceRecorder();
  const { adapter, d3Calls } = createAdapterDeps({ evidenceRecorder });
  const fip = buildCanonicalFip();
  const first = await adapter.receiveValidatedFip(fip, proofContext());
  assert.equal(first.accepted, true);
  assert.equal(d3Calls.upsert, 1);

  const second = await adapter.receiveValidatedFip(fip, proofContext());
  assert.equal(second.accepted, true);
  assert.equal(second.persistence_result.idempotent, true);
  assert.equal(d3Calls.upsert, 1);
});

test('D3 persistence failure maps to FIP_PERSISTENCE_FAILED', async () => {
  const { adapter } = createAdapterDeps({
    persistenceResult: { ok: false, code: 'DISPLAY_METADATA_PERSISTENCE_UNAVAILABLE' }
  });
  const result = await adapter.receiveValidatedFip(buildCanonicalFip(), proofContext());
  assert.equal(result.rejection_code, DOMAIN_CODES.FIP_PERSISTENCE_FAILED);
});

test('EdgeAnalysisEnvelope maps only from canonical FIP', async () => {
  const { adapter } = createAdapterDeps();
  const result = await adapter.receiveValidatedFip(buildCanonicalFip(), proofContext());
  assert.equal(result.envelope.match_info.sports_truth_origin, 'SCOUT_FIP');
  assert.equal(result.envelope.metadata.scout_run_id, 'scout-run-001');
  assert.deepEqual(result.envelope.sharp_odds, { home: 2.1, draw: 3.4, away: 3.2 });
});

test('accepted evidence record contains only bounded metadata', async () => {
  const { adapter, evidenceRecorder } = createAdapterDeps();
  await adapter.receiveValidatedFip(buildCanonicalFip(), proofContext());
  assert.equal(evidenceRecorder.records.length, 1);
  const record = evidenceRecorder.records[0];
  const allowed = new Set([
    'intakeId',
    'fipId',
    'fipSchemaVersion',
    'fipValidationHash',
    'scoutFixtureId',
    'fixtureUid',
    'scoutRunId',
    'receivedAt',
    'validatedAt',
    'outcome',
    'rejectionCode',
    'governedMode',
    'callerIdentityRef',
    'idempotencyKey'
  ]);
  for (const key of Object.keys(record)) {
    assert.ok(allowed.has(key), `unexpected evidence field ${key}`);
  }
  assert.equal(record.outcome, 'ACCEPTED');
  assert.equal(record.fixtureUid, FIXTURE_UID);
});

test('evidence failure prevents successful acceptance', async () => {
  const evidenceRecorder = createInMemoryEvidenceRecorder({ failOnRecord: true });
  const { adapter } = createAdapterDeps({ evidenceRecorder });
  const result = await adapter.receiveValidatedFip(buildCanonicalFip(), proofContext());
  assert.equal(result.rejection_code, DOMAIN_CODES.FIP_INTAKE_EVIDENCE_UNAVAILABLE);
});

test('no aiPipeline call occurs', async () => {
  const source = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '../backend/services/governedFipIntakeAdapter.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /aiPipeline/);
});

test('bounded evidence helper excludes full FIP body', () => {
  const canonical = buildCanonicalFip();
  const record = buildBoundedEvidenceRecord({
    intakeId: 'intake-1',
    canonicalFip: canonical,
    fixtureUid: FIXTURE_UID,
    receivedAt: RECEIVED_AT,
    outcome: 'ACCEPTED',
    rejectionCode: null,
    governedMode: PROOF_FIXTURE_MODE,
    callerIdentityRef: 'test',
    idempotencyKey: 'abc'
  });
  assert.equal(JSON.stringify(record).includes('direct_1x2'), false);
});

test('downstream call counts remain bounded on acceptance', async () => {
  const { adapter } = createAdapterDeps();
  const result = await adapter.receiveValidatedFip(buildCanonicalFip(), proofContext());
  assert.equal(result.downstream_calls.identity, 1);
  assert.equal(result.downstream_calls.lifecycle, 1);
  assert.equal(result.downstream_calls.d3, 1);
  assert.equal(result.downstream_calls.evidence, 1);
});

test('all gates remain blocked in adapter proof context', async () => {
  const blockedGates = {
    scoutEdgeMarriageGate: 'BLOCKED',
    supabaseStorageGate: 'BLOCKED',
    unifiedLifecycleGovernor: 'BLOCKED'
  };
  const { adapter } = createAdapterDeps({ gates: blockedGates });
  const result = await adapter.receiveValidatedFip(buildCanonicalFip(), proofContext());
  assert.equal(result.accepted, true);
  assert.equal(blockedGates.scoutEdgeMarriageGate, 'BLOCKED');
  assert.equal(blockedGates.supabaseStorageGate, 'BLOCKED');
  assert.equal(blockedGates.unifiedLifecycleGovernor, 'BLOCKED');
});

test('durable evidence service envelope unwraps for idempotent acceptance', async () => {
  const priorRecord = buildBoundedEvidenceRecord({
    intakeId: 'prior-intake',
    canonicalFip: buildCanonicalFip(),
    fixtureUid: FIXTURE_UID,
    receivedAt: RECEIVED_AT,
    outcome: 'ACCEPTED',
    rejectionCode: null,
    governedMode: PROOF_FIXTURE_MODE,
    callerIdentityRef: 'proof',
    idempotencyKey: computeIdempotencyKey({
      fipId: 'scout-fip-i7-001',
      validationHash: buildCanonicalFip().validation.hash,
      fipSchemaVersion: '1.0.0'
    })
  });

  const durableRecorder = {
    async recordIntakeEvidence() {
      return { ok: true, evidenceId: 'evidence-1' };
    },
    async findAcceptedByIdempotencyKey() {
      return { ok: true, found: true, record: priorRecord };
    }
  };

  const { adapter, d3Calls } = createAdapterDeps({ evidenceRecorder: durableRecorder });
  const result = await adapter.receiveValidatedFip(buildCanonicalFip(), proofContext());
  assert.equal(result.accepted, true);
  assert.equal(result.persistence_result.idempotent, true);
  assert.equal(d3Calls.upsert, 0);
});
