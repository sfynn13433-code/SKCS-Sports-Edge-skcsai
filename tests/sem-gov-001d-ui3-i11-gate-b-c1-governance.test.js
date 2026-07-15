'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const C1_EVIDENCE_PATH = path.join(
  ROOT,
  'reports',
  'ui3-i11',
  'gate-b-c1-hmac-body-hash-binding-evidence.json'
);

const GATE_B_EVIDENCE_PATH = path.join(
  ROOT,
  'reports',
  'ui3-i11',
  'mock-orchestration-evidence.json'
);

const C1_PACKET_PATH = path.join(
  ROOT,
  'control-center',
  'SEM-GOV-001D-UI3-I11_GATE_B_C1_HMAC_BODY_HASH_BINDING_CORRECTION_PACKET.v1.md'
);

const GATE_B_PACKET_PATH = path.join(
  ROOT,
  'control-center',
  'SEM-GOV-001D-UI3-I11_GATE_B_MOCK_ONLY_ORCHESTRATION_PROOF_PACKET.v1.md'
);

const PACKAGE_PATH = path.join(
  ROOT,
  'package.json'
);

const EXPECTED_SCRIPT = [
  'node --test tests/fip-intake-m2m-authenticator.test.js',
  'node --test tests/sem-gov-001d-ui3-i11-gate-b-c1-body-hash-binding.test.js',
  'npm run test:sem-gov-001d-ui3-i11-gate-b',
  'node --test tests/sem-gov-001d-ui3-i11-gate-b-c1-governance.test.js'
].join(' && ');

function readJson(filePath) {
  return JSON.parse(
    fs.readFileSync(filePath, 'utf8')
  );
}

test(
  'Gate B-C1 evidence proves bounded body-hash correction',
  () => {
    assert.equal(
      fs.existsSync(C1_EVIDENCE_PATH),
      true
    );

    const evidence =
      readJson(C1_EVIDENCE_PATH);

    assert.equal(
      evidence.result,
      'PASS'
    );

    assert.equal(
      evidence.decision,
      'BODY_HASH_BINDING_CORRECTED'
    );

    assert.equal(
      evidence.codeRequired,
      true
    );

    assert.equal(
      evidence.fullMarriageProofDecision,
      'HOLD'
    );

    assert.equal(
      evidence.securityCorrection
        .bodyHashBoundToSubmittedPayload,
      true
    );

    assert.equal(
      evidence.securityCorrection
        .comparison,
      'CRYPTO_TIMING_SAFE_EQUAL'
    );

    assert.equal(
      evidence.securityCorrection
        .submittedFipBRejected,
      true
    );

    assert.equal(
      evidence.securityCorrection
        .rejectionCode,
      'FIP_AUTH_BODY_HASH_MISMATCH'
    );

    assert.equal(
      evidence.securityCorrection
        .nonceReservations,
      0
    );

    assert.deepEqual(
      evidence.securityCorrection
        .downstreamCalls,
      {
        identity: 0,
        lifecycle: 0,
        d3: 0,
        evidence: 0
      }
    );

    assert.equal(
      evidence.securityCorrection
        .metadataWrites,
      0
    );

    assert.equal(
      evidence.securityCorrection
        .evidenceWrites,
      0
    );
  }
);

test(
  'Gate B-C1 preserves valid HMAC and replay protection',
  () => {
    const evidence =
      readJson(C1_EVIDENCE_PATH);

    assert.equal(
      evidence.regressionProof
        .validSubmissionAccepted,
      true
    );

    assert.equal(
      evidence.regressionProof
        .nonceReservationsAfterValid,
      1
    );

    assert.equal(
      evidence.regressionProof
        .replayRejected,
      true
    );

    assert.equal(
      evidence.regressionProof
        .replayRejectionCode,
      'FIP_AUTH_REPLAY_DETECTED'
    );

    assert.equal(
      evidence.regressionProof
        .additionalMetadataWritesAfterReplay,
      0
    );

    assert.equal(
      evidence.regressionProof
        .additionalEvidenceWritesAfterReplay,
      0
    );
  }
);

test(
  'complete unchanged Gate B proof passes after correction',
  () => {
    assert.equal(
      fs.existsSync(GATE_B_EVIDENCE_PATH),
      true
    );

    const gateB =
      readJson(GATE_B_EVIDENCE_PATH);

    assert.equal(gateB.result, 'PASS');

    assert.equal(
      gateB.decision,
      'PASS_MOCK_ONLY'
    );

    assert.equal(
      gateB.fullMarriageProofDecision,
      'HOLD'
    );

    assert.equal(
      gateB.securityPreflight.result,
      'PASS'
    );

    assert.equal(
      gateB.securityPreflight
        .submittedFipBRejected,
      true
    );

    assert.equal(
      gateB.securityPreflight
        .rejectionCode,
      'FIP_AUTH_BODY_HASH_MISMATCH'
    );

    assert.equal(
      gateB.securityPreflight
        .bodyHashBoundToSubmittedPayload,
      true
    );

    assert.equal(
      gateB.securityPreflight
        .metadataWrites,
      0
    );

    assert.equal(
      gateB.securityPreflight
        .evidenceWrites,
      0
    );

    assert.equal(
      gateB.orchestration.accepted,
      true
    );

    assert.equal(
      gateB.orchestration
        .edgeAnalysisEnvelopeEmitted,
      true
    );

    assert.equal(
      gateB.orchestration
        .secondSubmissionIdempotent,
      true
    );
  }
);

test(
  'runtime gates and prohibited boundaries remain unchanged',
  () => {
    const c1 = readJson(C1_EVIDENCE_PATH);
    const gateB =
      readJson(GATE_B_EVIDENCE_PATH);

    const expectedGates = {
      scout_edge_marriage_gate:
        'BLOCKED',
      unified_lifecycle_governor:
        'BLOCKED',
      supabase_storage_gate:
        'BLOCKED'
    };

    assert.deepEqual(
      c1.currentRuntimeGates,
      expectedGates
    );

    assert.deepEqual(
      gateB.currentRuntimeGates,
      expectedGates
    );

    assert.deepEqual(
      c1.changedRuntimeFiles,
      [
        'backend/services/fipIntakeM2MAuthenticator.js',
        'backend/services/governedFipIntakeAdapter.js'
      ]
    );

    assert.equal(
      c1.boundaries.httpRoute,
      false
    );

    assert.equal(
      c1.boundaries
        .sqlOrMigrationChange,
      false
    );

    assert.equal(
      c1.boundaries
        .featureFlagConfigurationChange,
      false
    );

    assert.equal(
      c1.boundaries
        .governanceGateClearance,
      false
    );

    assert.equal(
      c1.boundaries
        .d1PredictionImplementation,
      false
    );

    assert.equal(
      c1.boundaries
        .r1ProvenanceImplementation,
      false
    );

    assert.equal(
      c1.boundaries.productionWiring,
      false
    );

    assert.equal(
      c1.boundaries.controlAssetsRepair,
      false
    );

    assert.equal(
      c1.boundaries.i12Started,
      false
    );
  }
);

test(
  'Gate B-C1 and Gate B packets preserve the correct decisions',
  () => {
    assert.equal(
      fs.existsSync(C1_PACKET_PATH),
      true
    );

    assert.equal(
      fs.existsSync(GATE_B_PACKET_PATH),
      true
    );

    const c1Packet =
      fs.readFileSync(
        C1_PACKET_PATH,
        'utf8'
      );

    const gateBPacket =
      fs.readFileSync(
        GATE_B_PACKET_PATH,
        'utf8'
      );

    assert.match(
      c1Packet,
      /Correction result \| \*\*PASS\*\*/i
    );

    assert.match(
      c1Packet,
      /FIP_AUTH_BODY_HASH_MISMATCH/
    );

    assert.match(
      c1Packet,
      /constant-time/i
    );

    assert.match(
      gateBPacket,
      /Gate B decision \| \*\*PASS\*\*/i
    );

    assert.match(
      gateBPacket,
      /Full marriage proof decision \| \*\*HOLD\*\*/i
    );

    assert.doesNotMatch(
      gateBPacket,
      /Full marriage proof decision \| \*\*PASS\*\*/i
    );
  }
);

test(
  'package script enforces correction proof before complete Gate B rerun',
  () => {
    const packageJson =
      readJson(PACKAGE_PATH);

    assert.equal(
      packageJson.scripts[
        'test:sem-gov-001d-ui3-i11-gate-b-c1'
      ],
      EXPECTED_SCRIPT
    );
  }
);
