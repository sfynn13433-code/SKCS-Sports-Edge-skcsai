'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  executeBodyHashBindingPreflight
} = require('./helpers/ui3-i11-gate-b-harness');

const ROOT = path.resolve(__dirname, '..');
const START_HEAD =
  '22f90670063e8e162147e80e452e2443ce2834f5';

const EVIDENCE_PATH = path.join(
  ROOT,
  'reports',
  'ui3-i11',
  'mock-orchestration-evidence.json'
);

function diagnostic(outcome) {
  return JSON.stringify(
    {
      decision: outcome.passed
        ? 'PROCEED_TO_MOCK_ORCHESTRATION'
        : 'HOLD_WITH_CORRECTION_REQUIRED',
      fipBValidationAccepted:
        outcome.fipBValidation.accepted,
      signedBodyHash:
        outcome.signedBodyHash,
      actualSubmittedBodyHash:
        outcome.actualSubmittedBodyHash,
      submittedAccepted:
        outcome.submittedResult.accepted,
      rejectionCode:
        outcome.submittedResult.rejection_code || null,
      writeCounts:
        outcome.writeCounts,
      downstreamCalls:
        outcome.submittedResult.downstream_calls || null
    },
    null,
    2
  );
}

function writePreflightEvidence(outcome) {
  const passed = outcome.passed === true;

  const evidence = {
    task: 'SEM-GOV-001D-UI3-I11',
    gate: 'B',
    operation: 'BODY_HASH_SECURITY_PREFLIGHT',
    startHead: START_HEAD,
    generatedAt: '2026-07-15T10:00:00.000Z',
    generatedBy:
      'tests/sem-gov-001d-ui3-i11-gate-b-security-preflight.test.js',
    result: passed
      ? 'SECURITY_PREFLIGHT_PASS'
      : 'HOLD_WITH_CORRECTION_REQUIRED',
    decision: passed
      ? 'PROCEED_TO_MOCK_ORCHESTRATION'
      : 'HOLD_WITH_CORRECTION_REQUIRED',
    codeRequired: true,
    fullMarriageProofDecision: 'HOLD',
    bodyHashDefinition:
      'SHA256_HEX(stableStringify(actual_submitted_fip_object))',
    securityPreflight: {
      result: passed ? 'PASS' : 'FAIL',
      fipBValidationAccepted:
        outcome.fipBValidation.accepted,
      signedFipABodyHash:
        outcome.signedBodyHash,
      actualSubmittedFipBBodyHash:
        outcome.actualSubmittedBodyHash,
      hashesDiffer:
        outcome.signedBodyHash !==
          outcome.actualSubmittedBodyHash,
      submittedFipBRejected:
        outcome.submittedResult.accepted === false,
      submittedFipBAccepted:
        outcome.submittedResult.accepted === true,
      rejectionCode:
        outcome.submittedResult.rejection_code || null,
      metadataWrites:
        outcome.writeCounts.fixture_display_metadata,
      evidenceWrites:
        outcome.writeCounts.fip_intake_evidence,
      bodyHashBoundToSubmittedPayload: passed
    },
    orchestration: {
      result: passed
        ? 'AUTHORIZED_NEXT_IN_SAME_GATE_B_RUN'
        : 'NOT_RUN'
    },
    currentRuntimeGates:
      outcome.currentRuntimeGates,
    injectedTestOnlyGates: {
      testOnly: true,
      ...outcome.injectedTestGates
    },
    boundaries: {
      mockOnly: true,
      supabaseConnection: false,
      externalDatabaseConnection: false,
      scoutConnection: false,
      neonConnection: false,
      httpRoute: false,
      sqlOrMigrationChange: false,
      featureFlagConfigurationChange: false,
      governanceGateClearance: false,
      d1PredictionImplementation: false,
      r1ProvenanceImplementation: false,
      productionWiring: false,
      runtimeServiceChanges: false,
      controlAssetsRepair: false,
      i12Started: false
    },
    changedRuntimeFiles: [],
    credentialsRecorded: false,
    testSecretOnly: true,
    preservedUntrackedDirectories: [
      'evidence/',
      'evidence-home1-scratch/'
    ],
    nextAction: passed
      ? 'RUN_GATE_B_MOCK_ONLY_ORCHESTRATION'
      : 'OPEN_SEPARATE_BODY_HASH_BINDING_CORRECTION_MINI_PROJECT'
  };

  fs.mkdirSync(path.dirname(EVIDENCE_PATH), {
    recursive: true
  });
  fs.writeFileSync(
    EVIDENCE_PATH,
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8'
  );
}

test(
  'UI3-I11 Gate B security preflight binds HMAC bodyHash to the actual submitted FIP',
  async () => {
    const outcome =
      await executeBodyHashBindingPreflight();

    writePreflightEvidence(outcome);

    assert.equal(
      outcome.fipBValidation.accepted,
      true,
      'FIP B must be independently valid after its canonical validation hash is recomputed.'
    );

    assert.notEqual(
      outcome.signedBodyHash,
      outcome.actualSubmittedBodyHash,
      'The preflight must sign FIP A and submit a distinct valid FIP B.'
    );

    assert.equal(
      outcome.submittedResult.accepted,
      false,
      `HOLD WITH CORRECTION REQUIRED: a signature bound to FIP A authenticated FIP B.\n${diagnostic(outcome)}`
    );

    assert.equal(
      outcome.submittedResult.result,
      'REJECTED',
      diagnostic(outcome)
    );

    assert.equal(
      typeof outcome.submittedResult.rejection_code,
      'string',
      diagnostic(outcome)
    );

    assert.notEqual(
      outcome.submittedResult.rejection_code.length,
      0,
      diagnostic(outcome)
    );

    assert.deepEqual(
      outcome.writeCounts,
      {
        fixture_display_metadata: 0,
        fip_intake_evidence: 0
      },
      `Rejected body-hash mismatch must produce zero metadata and evidence writes.\n${diagnostic(outcome)}`
    );

    assert.equal(
      outcome.passed,
      true,
      diagnostic(outcome)
    );
  }
);
