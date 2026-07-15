'use strict';

const {
  PROOF_FIXTURE_MODE,
  validateCanonicalFipIntake
} = require('../../backend/services/fipIntakeService');

const {
  createGovernedFipIntakeComposition
} = require('../../backend/services/governedFipIntakeComposition');

const {
  createInMemoryDatabase
} = require('./ui3-i11-in-memory-database');

const {
  TEST_NOW,
  TEST_CALLER,
  TEST_SECRET,
  TEST_FIXTURE_UID,
  TEST_SCOUT_FIXTURE_ID,
  buildCanonicalFip,
  cloneModifyAndRehash,
  computeSubmittedBodyHash,
  signAuthenticationContext,
  createTestSecretResolver,
  createInMemoryNonceStore,
  createInjectedTestGateReader,
  createInjectedTestGovernor,
  createTestClock,
  createTestIntakeIdGenerator
} = require('./ui3-i11-gate-b-hmac');

const RUNTIME_GATES = Object.freeze({
  scout_edge_marriage_gate: 'BLOCKED',
  unified_lifecycle_governor: 'BLOCKED',
  supabase_storage_gate: 'BLOCKED'
});

function createGateBHarness() {
  const db = createInMemoryDatabase({
    fixtureUid: TEST_FIXTURE_UID,
    scoutFixtureId: TEST_SCOUT_FIXTURE_ID,
    now: TEST_NOW
  });

  const gateReader = createInjectedTestGateReader();
  const governor = createInjectedTestGovernor();
  const nonceStore = createInMemoryNonceStore();
  const clock = createTestClock();

  const composition = createGovernedFipIntakeComposition({
    db,
    gateReader,
    governor,
    clock,
    intakeIdGenerator: createTestIntakeIdGenerator(),
    secretResolver: createTestSecretResolver({
      callerIdentityRef: TEST_CALLER,
      secret: TEST_SECRET
    }),
    nonceStore,
    featureFlagEnabled: true,
    refreshGate: false
  });

  return {
    composition,
    db,
    gateReader,
    governor,
    nonceStore,
    clock
  };
}

async function executeBodyHashBindingPreflight() {
  const harness = createGateBHarness();

  const fipA = buildCanonicalFip();
  const fipB = cloneModifyAndRehash(
    fipA,
    (modified) => {
      modified.fixture.home_team.name =
        'Gate B Home FC — modified payload B';
    }
  );

  const fipBValidation = validateCanonicalFipIntake(
    fipB,
    {
      caller: TEST_CALLER,
      governedMode: PROOF_FIXTURE_MODE,
      receivedAt: TEST_NOW,
      scoutEdgeMarriageGate: 'CLEARED',
      supabaseStorageGate: 'CLEARED'
    }
  );

  const contextSignedForFipA = signAuthenticationContext({
    fipPayload: fipB,
    bodyHashSource: fipA,
    nonce: 'ui3-i11-preflight-0001'
  });

  const submittedResult =
    await harness.composition.receiveValidatedFip(
      fipB,
      contextSignedForFipA
    );

  const databaseSnapshot = harness.db.snapshot();
  const writeCounts = harness.db.getWriteCounts();

  const rejected = submittedResult.accepted === false;
  const zeroMetadataWrites =
    writeCounts.fixture_display_metadata === 0;
  const zeroEvidenceWrites =
    writeCounts.fip_intake_evidence === 0;

  return {
    passed:
      fipBValidation.accepted === true &&
      computeSubmittedBodyHash(fipA) !==
        computeSubmittedBodyHash(fipB) &&
      rejected &&
      zeroMetadataWrites &&
      zeroEvidenceWrites,
    fipA,
    fipB,
    fipBValidation,
    signedBodyHash: contextSignedForFipA.auth.bodyHash,
    actualSubmittedBodyHash:
      computeSubmittedBodyHash(fipB),
    submittedResult,
    databaseSnapshot,
    writeCounts,
    nonceReservations:
      harness.nonceStore.snapshot(),
    injectedTestGates:
      harness.gateReader.snapshot(),
    currentRuntimeGates: {
      ...RUNTIME_GATES
    }
  };
}

module.exports = {
  RUNTIME_GATES,
  createGateBHarness,
  executeBodyHashBindingPreflight
};
