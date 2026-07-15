'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  DOMAIN_CODES: AUTH_DOMAIN_CODES,
  computeSubmittedBodyHash
} = require(
  '../backend/services/fipIntakeM2MAuthenticator'
);

const {
  TEST_NOW,
  TEST_CALLER,
  buildCanonicalFip,
  signAuthenticationContext
} = require(
  './helpers/ui3-i11-gate-b-hmac'
);

const {
  RUNTIME_GATES,
  createGateBHarness,
  executeBodyHashBindingPreflight
} = require(
  './helpers/ui3-i11-gate-b-harness'
);

const ROOT = path.resolve(__dirname, '..');

const START_HEAD =
  '8db9f7d37836457aa04d17c06225c7e088b49085';

const EVIDENCE_PATH = path.join(
  ROOT,
  'reports',
  'ui3-i11',
  'gate-b-c1-hmac-body-hash-binding-evidence.json'
);

const PACKET_PATH = path.join(
  ROOT,
  'control-center',
  'SEM-GOV-001D-UI3-I11_GATE_B_C1_HMAC_BODY_HASH_BINDING_CORRECTION_PACKET.v1.md'
);

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), {
    recursive: true
  });

  fs.writeFileSync(
    filePath,
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8'
  );
}

function buildPacket(evidence) {
  return `# SEM-GOV-001D-UI3-I11 Gate B-C1 — HMAC Submitted-Body Hash Binding Correction

| Field | Value |
|---|---|
| Packet ID | SEM-GOV-001D-UI3-I11-GATE-B-C1 |
| Start HEAD | \`${evidence.startHead}\` |
| Code required | **YES** |
| Correction result | **PASS** |
| Gate B rerun required | **YES** |
| Full marriage proof | **HOLD** |
| Runtime services changed | HMAC authenticator and governed intake adapter only |
| HTTP route change | **NO** |
| SQL or migration change | **NO** |
| Runtime governance gates | **BLOCKED** |

## A. Proven defect

Gate B proved that a valid HMAC signature over FIP A's caller-supplied body hash could authenticate distinct valid FIP B.

The authentication signature was valid for the supplied authentication context, but the supplied authentication body hash was not compared with an independently recomputed hash of the actual FIP submitted to the intake adapter.

## B. Correction

The governed intake adapter now computes:

\`SHA256_HEX(stableStringify(actual_submitted_fip_object))\`

The independently computed hash is passed separately to the HMAC authenticator.

The authenticator performs a constant-time comparison between:

- \`context.auth.bodyHash\`
- the independently computed actual submitted-body hash

A mismatch returns:

\`${evidence.securityCorrection.rejectionCode}\`

The mismatch is rejected before:

- secret lookup
- nonce lookup
- nonce reservation
- canonical FIP validation
- fixture identity resolution
- lifecycle confirmation
- D3 persistence
- evidence persistence

## C. Security proof

| Check | Result |
|---|---|
| Modified FIP B independently valid | PASS |
| Signature still bound to FIP A body hash | PASS |
| FIP A and FIP B body hashes differ | PASS |
| FIP B rejected | PASS |
| Rejection code | \`${evidence.securityCorrection.rejectionCode}\` |
| Nonce reservations | ${evidence.securityCorrection.nonceReservations} |
| Identity calls | ${evidence.securityCorrection.downstreamCalls.identity} |
| Lifecycle calls | ${evidence.securityCorrection.downstreamCalls.lifecycle} |
| D3 calls | ${evidence.securityCorrection.downstreamCalls.d3} |
| Evidence calls | ${evidence.securityCorrection.downstreamCalls.evidence} |
| Metadata writes | ${evidence.securityCorrection.metadataWrites} |
| Evidence writes | ${evidence.securityCorrection.evidenceWrites} |

## D. Regression proof

A correctly signed FIP remains accepted.

Replay protection remains active:

- First valid submission: accepted
- First valid submission nonce reservation: one
- Same signed context replayed: rejected
- Replay rejection code: \`${evidence.regressionProof.replayRejectionCode}\`
- Additional metadata writes after replay: zero
- Additional evidence writes after replay: zero

## E. Preserved boundaries

- No Supabase or external database connection
- No Scout or Neon connection
- No HTTP route
- No SQL or migration
- No feature-flag configuration change
- No governance gate clearance
- No D1 prediction implementation
- No R1 provenance implementation
- No production wiring
- No \`control:assets\` repair
- No I12 work
- \`evidence/\` preserved
- \`evidence-home1-scratch/\` preserved

## F. Runtime gate state

- \`scout_edge_marriage_gate\`: **BLOCKED**
- \`unified_lifecycle_governor\`: **BLOCKED**
- \`supabase_storage_gate\`: **BLOCKED**

The CLEARED values used by focused tests are injected test-only dependencies and do not alter runtime governance.

## G. Definition of Done

- [x] Actual submitted-body hash independently recomputed
- [x] Constant-time body-hash comparison added
- [x] Dedicated mismatch code added
- [x] Mismatch rejected before nonce processing
- [x] Mismatch produces zero downstream calls and writes
- [x] Correctly signed intake remains accepted
- [x] Replay protection remains active
- [x] Runtime governance gates remain BLOCKED
- [x] Full marriage proof remains HOLD
- [x] No out-of-scope implementation

## H. Decision

**PASS — HMAC SUBMITTED-BODY HASH BINDING CORRECTED.**

This correction does not clear Gate B by itself. The unchanged Gate B security preflight, mock orchestration test, and governance test must all pass afterward.
`;
}

test(
  'Gate B-C1 binds HMAC authentication to the actual submitted FIP before all downstream work',
  async () => {
    const preflight =
      await executeBodyHashBindingPreflight();

    assert.equal(
      preflight.fipBValidation.accepted,
      true
    );

    assert.notEqual(
      preflight.signedBodyHash,
      preflight.actualSubmittedBodyHash
    );

    assert.equal(preflight.passed, true);

    assert.equal(
      preflight.submittedResult.accepted,
      false
    );

    assert.equal(
      preflight.submittedResult.result,
      'REJECTED'
    );

    assert.equal(
      preflight.submittedResult
        .rejection_code,
      AUTH_DOMAIN_CODES
        .FIP_AUTH_BODY_HASH_MISMATCH
    );

    assert.deepEqual(
      preflight.submittedResult
        .downstream_calls,
      {
        identity: 0,
        lifecycle: 0,
        d3: 0,
        evidence: 0
      }
    );

    assert.deepEqual(
      preflight.writeCounts,
      {
        fixture_display_metadata: 0,
        fip_intake_evidence: 0
      }
    );

    assert.deepEqual(
      preflight.nonceReservations,
      []
    );

    const validHarness = createGateBHarness();
    const validFip = buildCanonicalFip();

    const validContext =
      signAuthenticationContext({
        fipPayload: validFip,
        nonce:
          'ui3-i11-gate-b-c1-valid-0001'
      });

    assert.equal(
      validContext.auth.bodyHash,
      computeSubmittedBodyHash(validFip)
    );

    const firstValidResult =
      await validHarness.composition
        .receiveValidatedFip(
          validFip,
          validContext
        );

    assert.equal(
      firstValidResult.accepted,
      true
    );

    assert.equal(
      firstValidResult.result,
      'ACCEPTED'
    );

    const afterFirstValid =
      validHarness.db.snapshot();

    const nonceAfterFirstValid =
      validHarness.nonceStore.snapshot();

    assert.equal(
      nonceAfterFirstValid.length,
      1
    );

    assert.deepEqual(
      afterFirstValid.writeCounts,
      {
        fixture_display_metadata: 1,
        fip_intake_evidence: 1
      }
    );

    const replayResult =
      await validHarness.composition
        .receiveValidatedFip(
          validFip,
          validContext
        );

    assert.equal(
      replayResult.accepted,
      false
    );

    assert.equal(
      replayResult.rejection_code,
      AUTH_DOMAIN_CODES
        .FIP_AUTH_REPLAY_DETECTED
    );

    assert.deepEqual(
      replayResult.downstream_calls,
      {
        identity: 0,
        lifecycle: 0,
        d3: 0,
        evidence: 0
      }
    );

    const afterReplay =
      validHarness.db.snapshot();

    assert.deepEqual(
      afterReplay.writeCounts,
      afterFirstValid.writeCounts
    );

    assert.deepEqual(
      afterReplay.tableCounts,
      afterFirstValid.tableCounts
    );

    assert.equal(
      validHarness.nonceStore
        .snapshot().length,
      1
    );

    const evidence = {
      task: 'SEM-GOV-001D-UI3-I11',
      miniProject:
        'SEM-GOV-001D-UI3-I11-GATE-B-C1',
      operation:
        'HMAC_SUBMITTED_BODY_HASH_BINDING_CORRECTION',
      startHead: START_HEAD,
      generatedAt: TEST_NOW,
      generatedBy:
        'tests/sem-gov-001d-ui3-i11-gate-b-c1-body-hash-binding.test.js',
      result: 'PASS',
      decision:
        'BODY_HASH_BINDING_CORRECTED',
      codeRequired: true,
      fullMarriageProofDecision: 'HOLD',
      bodyHashDefinition:
        'SHA256_HEX(stableStringify(actual_submitted_fip_object))',

      securityCorrection: {
        bodyHashBoundToSubmittedPayload:
          true,
        comparison:
          'CRYPTO_TIMING_SAFE_EQUAL',
        fipBValidationAccepted:
          preflight.fipBValidation.accepted,
        signedFipABodyHash:
          preflight.signedBodyHash,
        actualSubmittedFipBBodyHash:
          preflight.actualSubmittedBodyHash,
        hashesDiffer:
          preflight.signedBodyHash !==
          preflight.actualSubmittedBodyHash,
        submittedFipBRejected:
          preflight.submittedResult
            .accepted === false,
        rejectionCode:
          preflight.submittedResult
            .rejection_code,
        nonceReservations:
          preflight.nonceReservations.length,
        downstreamCalls:
          preflight.submittedResult
            .downstream_calls,
        metadataWrites:
          preflight.writeCounts
            .fixture_display_metadata,
        evidenceWrites:
          preflight.writeCounts
            .fip_intake_evidence
      },

      regressionProof: {
        callerIdentityRef: TEST_CALLER,
        validBodyHash:
          validContext.auth.bodyHash,
        validSubmissionAccepted:
          firstValidResult.accepted,
        validSubmissionResult:
          firstValidResult.result,
        nonceReservationsAfterValid:
          nonceAfterFirstValid.length,
        replayRejected:
          replayResult.accepted === false,
        replayRejectionCode:
          replayResult.rejection_code,
        metadataWritesAfterValid:
          afterFirstValid.writeCounts
            .fixture_display_metadata,
        evidenceWritesAfterValid:
          afterFirstValid.writeCounts
            .fip_intake_evidence,
        additionalMetadataWritesAfterReplay:
          afterReplay.writeCounts
            .fixture_display_metadata -
          afterFirstValid.writeCounts
            .fixture_display_metadata,
        additionalEvidenceWritesAfterReplay:
          afterReplay.writeCounts
            .fip_intake_evidence -
          afterFirstValid.writeCounts
            .fip_intake_evidence
      },

      currentRuntimeGates: {
        ...RUNTIME_GATES
      },

      boundaries: {
        mockOnly: true,
        supabaseConnection: false,
        externalDatabaseConnection: false,
        scoutConnection: false,
        neonConnection: false,
        httpRoute: false,
        sqlOrMigrationChange: false,
        featureFlagConfigurationChange:
          false,
        governanceGateClearance: false,
        d1PredictionImplementation: false,
        r1ProvenanceImplementation: false,
        productionWiring: false,
        controlAssetsRepair: false,
        i12Started: false
      },

      changedRuntimeFiles: [
        'backend/services/fipIntakeM2MAuthenticator.js',
        'backend/services/governedFipIntakeAdapter.js'
      ],

      credentialsRecorded: false,
      testSecretOnly: true,

      preservedUntrackedDirectories: [
        'evidence/',
        'evidence-home1-scratch/'
      ],

      nextAction:
        'RERUN_COMPLETE_GATE_B_MOCK_ONLY_PROOF'
    };

    writeJson(EVIDENCE_PATH, evidence);

    fs.writeFileSync(
      PACKET_PATH,
      buildPacket(evidence),
      'utf8'
    );
  }
);
