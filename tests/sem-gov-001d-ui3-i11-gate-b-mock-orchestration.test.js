'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  PROOF_FIXTURE_MODE
} = require('../backend/services/fipIntakeService');

const {
  TEST_NOW,
  TEST_CALLER,
  TEST_FIXTURE_UID,
  TEST_SCOUT_FIXTURE_ID,
  buildCanonicalFip,
  computeSubmittedBodyHash,
  signAuthenticationContext
} = require('./helpers/ui3-i11-gate-b-hmac');

const {
  RUNTIME_GATES,
  createGateBHarness,
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

const PACKET_PATH = path.join(
  ROOT,
  'control-center',
  'SEM-GOV-001D-UI3-I11_GATE_B_MOCK_ONLY_ORCHESTRATION_PROOF_PACKET.v1.md'
);

const FORBIDDEN_STORED_KEYS = new Set([
  'fullfip',
  'fipbody',
  'fip_body',
  'fip_json',
  'rawjson',
  'raw_json',
  'raw_fip',
  'validated_fip',
  'scoutpayload',
  'scout_payload',
  'providerpayload',
  'provider_payload',
  'credentials',
  'authorization',
  'bearertoken',
  'bearer_token',
  'secret',
  'markets',
  'context',
  'envelope',
  'canonical_fip'
]);

function collectForbiddenKeys(value, found = []) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectForbiddenKeys(item, found);
    }
    return found;
  }

  if (!value || typeof value !== 'object') {
    return found;
  }

  for (const [key, item] of Object.entries(value)) {
    const normalized = String(key)
      .replace(/[\s_-]+/g, '')
      .toLowerCase();

    if (
      FORBIDDEN_STORED_KEYS.has(key.toLowerCase()) ||
      FORBIDDEN_STORED_KEYS.has(normalized)
    ) {
      found.push(key);
    }

    collectForbiddenKeys(item, found);
  }

  return found;
}

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
  return `# SEM-GOV-001D-UI3-I11 — Gate B Mock-Only Orchestration Proof Packet

| Field | Value |
|---|---|
| Packet ID | SEM-GOV-001D-UI3-I11-GATE-B |
| Gate | **B** — Mock-only orchestration proof |
| Start HEAD | \`${evidence.startHead}\` |
| Code required | **YES** |
| Gate B decision | **PASS** |
| Full marriage proof decision | **HOLD** |
| Security preflight | **PASS** — HMAC bodyHash bound to actual submitted canonical FIP object |
| Runtime services changed | **NO** |
| External database/network activity | **NONE** |
| \`scout_edge_marriage_gate\` | **BLOCKED** (unchanged runtime state) |
| \`unified_lifecycle_governor\` | **BLOCKED** (unchanged runtime state) |
| \`supabase_storage_gate\` | **BLOCKED** (unchanged runtime state) |

---

## A. Scope and authority

Gate A authorized only a mock orchestration proof with injected test dependencies. Gate B used the existing production composition and HMAC implementation, a deterministic test secret, injected test-only gates, and a fully in-memory database. It did not create a route, connect to Supabase, Scout, Neon, or any external service, change feature-flag configuration, clear a governance gate, implement D1, implement R1, or start I12.

## B. Security preflight

The preflight built valid FIP A and valid modified FIP B. FIP B received a recomputed canonical FIP validation hash. Authentication was signed with the submitted-body SHA-256 hash of FIP A, while FIP B was submitted with that unchanged signature.

| Check | Result |
|---|---|
| FIP B canonical validation | PASS |
| Signed FIP A body hash differs from submitted FIP B body hash | PASS |
| FIP B rejected | PASS |
| Metadata writes after rejection | 0 |
| Evidence writes after rejection | 0 |
| Rejection code | \`${evidence.securityPreflight.rejectionCode}\` |

**Security decision:** PASS. Gate B orchestration was allowed to continue only after this preflight passed.

## C. Mock orchestration proof

| Check | Result |
|---|---|
| Existing \`createGovernedFipIntakeComposition\` used | PASS |
| Real HMAC-SHA256 helper logic used | PASS |
| Deterministic test secret only | PASS |
| Injected test-only gates | PASS |
| Fixture identity resolution | PASS |
| Lifecycle parent confirmation | PASS |
| D3 display metadata in-memory persistence | PASS — 1 row |
| Intake evidence in-memory persistence | PASS — 1 row |
| EdgeAnalysisEnvelope emitted | PASS |
| Idempotent second submission | PASS — no additional rows |
| Raw FIP, markets, context, envelope, secrets stored | NO |
| External connection count | 0 |
| External database residue | false |

## D. Evidence identity

- FIP ID: \`${evidence.orchestration.fipId}\`
- Scout fixture ID: \`${evidence.orchestration.scoutFixtureId}\`
- Fixture UID: \`${evidence.orchestration.fixtureUid}\`
- FIP validation hash: \`${evidence.orchestration.fipValidationHash}\`
- Submitted body hash: \`${evidence.orchestration.submittedBodyHash}\`
- Intake ID: \`${evidence.orchestration.intakeId}\`
- Idempotency key: \`${evidence.orchestration.idempotencyKey}\`

## E. Preserved boundaries

- No Supabase or external database connection
- No Scout or Neon connection
- No HTTP route
- No SQL or migration change
- No feature-flag configuration change
- No governance gate clearance
- No D1 prediction implementation
- No R1 provenance implementation
- No production wiring
- No runtime service change
- No repair of pre-existing \`control:assets\` failures
- \`evidence/\` and \`evidence-home1-scratch/\` remain preserved
- I12 not started

## F. Runtime gate state

\`scout_edge_marriage_gate\`, \`unified_lifecycle_governor\`, and \`supabase_storage_gate\` remain **BLOCKED** in runtime governance. The CLEARED values used by the proof were injected test-only values held inside the test process and did not modify configuration or governance state.

## G. Definition of Done

- [x] Security preflight rejects FIP B signed for FIP A
- [x] Rejected preflight creates zero metadata and evidence writes
- [x] Correctly signed FIP completes the isolated composition chain
- [x] Exactly one in-memory metadata row and one in-memory evidence row are created
- [x] Idempotent resubmission creates no additional rows
- [x] EdgeAnalysisEnvelope is emitted
- [x] No external connection, route, SQL, migration, runtime service, D1, R1, or production wiring change
- [x] Runtime gates remain BLOCKED
- [x] Full marriage proof remains HOLD
- [x] I12 not started

## H. Decision

**PASS — MOCK-ONLY GATE B.**

This is not marriage-gate clearance, a live Scout-to-Edge proof, a Supabase write proof, production activation, D1 completion, or R1 completion. Full marriage proof remains **HOLD**.
`;
}

test(
  'UI3-I11 Gate B proves mock-only orchestration after the security preflight passes',
  async () => {
    const preflight =
      await executeBodyHashBindingPreflight();

    assert.equal(
      preflight.passed,
      true,
      'Gate B orchestration is prohibited until the bodyHash security preflight passes.'
    );

    const harness = createGateBHarness();
    const fip = buildCanonicalFip();

    const firstContext = signAuthenticationContext({
      fipPayload: fip,
      nonce: 'ui3-i11-orchestration-0001'
    });

    const firstResult =
      await harness.composition.receiveValidatedFip(
        fip,
        firstContext
      );

    assert.equal(firstResult.accepted, true);
    assert.equal(firstResult.result, 'ACCEPTED');
    assert.equal(firstResult.rejection_code, null);
    assert.equal(
      firstResult.envelope.metadata.sports_truth_origin,
      'SCOUT_FIP'
    );
    assert.equal(
      firstResult.envelope.match_info.fixture_id,
      TEST_SCOUT_FIXTURE_ID
    );
    assert.equal(
      firstResult.canonical_fip.validation.hash,
      fip.validation.hash
    );
    assert.equal(
      firstResult.persistence_result.action,
      'INSERT'
    );

    const firstSnapshot = harness.db.snapshot();

    assert.deepEqual(
      firstSnapshot.tableCounts,
      {
        fixture_identity_aliases: 1,
        fixture_lifecycle_current: 1,
        fixture_display_metadata: 1,
        fip_intake_evidence: 1
      }
    );

    assert.deepEqual(
      firstSnapshot.writeCounts,
      {
        fixture_display_metadata: 1,
        fip_intake_evidence: 1
      }
    );

    assert.equal(
      firstSnapshot.externalConnectionCount,
      0
    );

    assert.deepEqual(
      collectForbiddenKeys(
        firstSnapshot.tables.fixture_display_metadata
      ),
      []
    );

    assert.deepEqual(
      collectForbiddenKeys(
        firstSnapshot.tables.fip_intake_evidence
      ),
      []
    );

    const secondContext = signAuthenticationContext({
      fipPayload: fip,
      nonce: 'ui3-i11-orchestration-0002'
    });

    const secondResult =
      await harness.composition.receiveValidatedFip(
        fip,
        secondContext
      );

    assert.equal(secondResult.accepted, true);
    assert.deepEqual(
      secondResult.persistence_result,
      {
        ok: true,
        code: 'NO_OP',
        idempotent: true
      }
    );

    const finalSnapshot = harness.db.snapshot();

    assert.deepEqual(
      finalSnapshot.tableCounts,
      firstSnapshot.tableCounts
    );

    assert.deepEqual(
      finalSnapshot.writeCounts,
      firstSnapshot.writeCounts
    );

    const metadataRow =
      finalSnapshot.tables.fixture_display_metadata[0];
    const evidenceRow =
      finalSnapshot.tables.fip_intake_evidence[0];

    assert.equal(
      metadataRow.fixture_uid,
      TEST_FIXTURE_UID
    );
    assert.equal(
      evidenceRow.fixture_uid,
      TEST_FIXTURE_UID
    );
    assert.equal(
      metadataRow.fip_validation_hash,
      fip.validation.hash
    );
    assert.equal(
      evidenceRow.fip_validation_hash,
      fip.validation.hash
    );
    assert.equal(
      metadataRow.idempotency_key,
      evidenceRow.idempotency_key
    );

    const evidence = {
      task: 'SEM-GOV-001D-UI3-I11',
      gate: 'B',
      operation: 'MOCK_ONLY_ORCHESTRATION_PROOF',
      startHead: START_HEAD,
      generatedAt: TEST_NOW,
      generatedBy:
        'tests/sem-gov-001d-ui3-i11-gate-b-mock-orchestration.test.js',
      result: 'PASS',
      decision: 'PASS_MOCK_ONLY',
      codeRequired: true,
      fullMarriageProofDecision: 'HOLD',
      bodyHashDefinition:
        'SHA256_HEX(stableStringify(actual_submitted_fip_object))',
      securityPreflight: {
        result: 'PASS',
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
          preflight.submittedResult.accepted === false,
        rejectionCode:
          preflight.submittedResult.rejection_code,
        metadataWrites:
          preflight.writeCounts.fixture_display_metadata,
        evidenceWrites:
          preflight.writeCounts.fip_intake_evidence,
        bodyHashBoundToSubmittedPayload: true
      },
      orchestration: {
        mode: PROOF_FIXTURE_MODE,
        callerIdentityRef: TEST_CALLER,
        authentication: 'HMAC_SHA256',
        accepted: firstResult.accepted,
        fipId: fip.fip_id,
        scoutFixtureId: TEST_SCOUT_FIXTURE_ID,
        fixtureUid: TEST_FIXTURE_UID,
        fipValidationHash: fip.validation.hash,
        submittedBodyHash:
          computeSubmittedBodyHash(fip),
        intakeId: firstResult.evidence.intakeId,
        idempotencyKey:
          firstResult.evidence.idempotencyKey,
        displayMetadataAction:
          firstResult.persistence_result.action,
        edgeAnalysisEnvelopeEmitted:
          Boolean(firstResult.envelope),
        secondSubmissionAccepted:
          secondResult.accepted,
        secondSubmissionIdempotent:
          secondResult.persistence_result.idempotent,
        additionalRowsOnSecondSubmission: 0
      },
      inMemoryDatabase: {
        implementation:
          'tests/helpers/ui3-i11-in-memory-database.js',
        fixtureDisplayMetadataRows:
          finalSnapshot.tableCounts.fixture_display_metadata,
        fipIntakeEvidenceRows:
          finalSnapshot.tableCounts.fip_intake_evidence,
        fixtureDisplayMetadataWrites:
          finalSnapshot.writeCounts.fixture_display_metadata,
        fipIntakeEvidenceWrites:
          finalSnapshot.writeCounts.fip_intake_evidence,
        externalConnectionCount:
          finalSnapshot.externalConnectionCount,
        externalDatabaseResidue: false,
        inMemoryRowsDiscardedAtProcessExit: true,
        forbiddenStoredKeys: []
      },
      injectedTestOnlyGates: {
        testOnly: true,
        ...harness.gateReader.snapshot()
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
      nextAction:
        'CLOSE_GATE_B_MOCK_ONLY_GOVERNANCE_IF_ALL_FOCUSED_CHECKS_PASS'
    };

    writeJson(EVIDENCE_PATH, evidence);
    fs.writeFileSync(
      PACKET_PATH,
      buildPacket(evidence),
      'utf8'
    );
  }
);
