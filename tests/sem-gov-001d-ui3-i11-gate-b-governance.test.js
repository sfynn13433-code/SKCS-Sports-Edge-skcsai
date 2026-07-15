'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const EVIDENCE_PATH = path.join(
  ROOT,
  'reports',
  'ui3-i11',
  'mock-orchestration-evidence.json'
);

const PACKET_PATH = path.join(
  ROOT,
  'control-center',
  'SEM-GOV-001D-UI3-I11_GATE_B_MOCK_ONLY_ORCHESTRATION_PROOF_PACKET.v1.md'
);

const PACKAGE_PATH = path.join(
  ROOT,
  'package.json'
);

const EXPECTED_SCRIPT = [
  'node --test tests/sem-gov-001d-ui3-i11-gate-b-security-preflight.test.js',
  'node --test tests/sem-gov-001d-ui3-i11-gate-b-mock-orchestration.test.js',
  'node --test tests/sem-gov-001d-ui3-i11-gate-b-governance.test.js'
].join(' && ');

function readJson(filePath) {
  return JSON.parse(
    fs.readFileSync(filePath, 'utf8')
  );
}

test(
  'UI3-I11 Gate B evidence records a passed security preflight and mock-only proof',
  () => {
    assert.equal(fs.existsSync(EVIDENCE_PATH), true);

    const evidence = readJson(EVIDENCE_PATH);

    assert.equal(
      evidence.task,
      'SEM-GOV-001D-UI3-I11'
    );
    assert.equal(evidence.gate, 'B');
    assert.equal(evidence.result, 'PASS');
    assert.equal(
      evidence.decision,
      'PASS_MOCK_ONLY'
    );
    assert.equal(evidence.codeRequired, true);
    assert.equal(
      evidence.fullMarriageProofDecision,
      'HOLD'
    );

    assert.equal(
      evidence.securityPreflight.result,
      'PASS'
    );
    assert.equal(
      evidence.securityPreflight.fipBValidationAccepted,
      true
    );
    assert.equal(
      evidence.securityPreflight.hashesDiffer,
      true
    );
    assert.equal(
      evidence.securityPreflight.submittedFipBRejected,
      true
    );
    assert.equal(
      evidence.securityPreflight.bodyHashBoundToSubmittedPayload,
      true
    );
    assert.equal(
      evidence.securityPreflight.metadataWrites,
      0
    );
    assert.equal(
      evidence.securityPreflight.evidenceWrites,
      0
    );
    assert.equal(
      typeof evidence.securityPreflight.rejectionCode,
      'string'
    );
    assert.notEqual(
      evidence.securityPreflight.rejectionCode.length,
      0
    );
  }
);

test(
  'UI3-I11 Gate B proves the bounded in-memory orchestration result',
  () => {
    const evidence = readJson(EVIDENCE_PATH);

    assert.equal(
      evidence.orchestration.authentication,
      'HMAC_SHA256'
    );
    assert.equal(
      evidence.orchestration.accepted,
      true
    );
    assert.equal(
      evidence.orchestration.edgeAnalysisEnvelopeEmitted,
      true
    );
    assert.equal(
      evidence.orchestration.displayMetadataAction,
      'INSERT'
    );
    assert.equal(
      evidence.orchestration.secondSubmissionAccepted,
      true
    );
    assert.equal(
      evidence.orchestration.secondSubmissionIdempotent,
      true
    );
    assert.equal(
      evidence.orchestration.additionalRowsOnSecondSubmission,
      0
    );

    assert.equal(
      evidence.inMemoryDatabase.fixtureDisplayMetadataRows,
      1
    );
    assert.equal(
      evidence.inMemoryDatabase.fipIntakeEvidenceRows,
      1
    );
    assert.equal(
      evidence.inMemoryDatabase.fixtureDisplayMetadataWrites,
      1
    );
    assert.equal(
      evidence.inMemoryDatabase.fipIntakeEvidenceWrites,
      1
    );
    assert.equal(
      evidence.inMemoryDatabase.externalConnectionCount,
      0
    );
    assert.equal(
      evidence.inMemoryDatabase.externalDatabaseResidue,
      false
    );
    assert.equal(
      evidence.inMemoryDatabase.inMemoryRowsDiscardedAtProcessExit,
      true
    );
    assert.deepEqual(
      evidence.inMemoryDatabase.forbiddenStoredKeys,
      []
    );
  }
);

test(
  'UI3-I11 Gate B preserves runtime gates and all prohibited boundaries',
  () => {
    const evidence = readJson(EVIDENCE_PATH);

    assert.deepEqual(
      evidence.currentRuntimeGates,
      {
        scout_edge_marriage_gate: 'BLOCKED',
        unified_lifecycle_governor: 'BLOCKED',
        supabase_storage_gate: 'BLOCKED'
      }
    );

    assert.deepEqual(
      evidence.injectedTestOnlyGates,
      {
        testOnly: true,
        scoutEdgeMarriageGate: 'CLEARED',
        supabaseStorageGate: 'CLEARED',
        unifiedLifecycleGovernor: 'CLEARED'
      }
    );

    assert.deepEqual(
      evidence.boundaries,
      {
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
      }
    );

    assert.deepEqual(
      evidence.changedRuntimeFiles,
      []
    );
    assert.equal(evidence.credentialsRecorded, false);
    assert.equal(evidence.testSecretOnly, true);
    assert.deepEqual(
      evidence.preservedUntrackedDirectories,
      [
        'evidence/',
        'evidence-home1-scratch/'
      ]
    );
  }
);

test(
  'UI3-I11 Gate B packet states PASS mock-only while full marriage remains HOLD',
  () => {
    assert.equal(fs.existsSync(PACKET_PATH), true);

    const packet = fs.readFileSync(
      PACKET_PATH,
      'utf8'
    );

    assert.match(
      packet,
      /Gate B decision \| \*\*PASS\*\*/i
    );
    assert.match(
      packet,
      /Full marriage proof decision \| \*\*HOLD\*\*/i
    );
    assert.match(
      packet,
      /Security preflight \| \*\*PASS\*\*/i
    );
    assert.match(
      packet,
      /mock-only/i
    );
    assert.match(
      packet,
      /scout_edge_marriage_gate.*BLOCKED/is
    );
    assert.match(
      packet,
      /unified_lifecycle_governor.*BLOCKED/is
    );
    assert.match(
      packet,
      /supabase_storage_gate.*BLOCKED/is
    );
    assert.match(
      packet,
      /No Supabase or external database connection/i
    );
    assert.match(packet, /No HTTP route/i);
    assert.match(packet, /No D1 prediction implementation/i);
    assert.match(packet, /No R1 provenance implementation/i);
    assert.match(packet, /I12 not started/i);
    assert.doesNotMatch(
      packet,
      /full marriage proof decision \| \*\*PASS\*\*/i
    );
    assert.doesNotMatch(
      packet,
      /production activation.*authorized/i
    );
    assert.doesNotMatch(
      packet,
      /PENDING_SECURITY_PREFLIGHT/i
    );
  }
);

test(
  'package script enforces security preflight before orchestration and governance',
  () => {
    const packageJson = readJson(PACKAGE_PATH);

    assert.equal(
      packageJson.scripts[
        'test:sem-gov-001d-ui3-i11-gate-b'
      ],
      EXPECTED_SCRIPT
    );
  }
);
