'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const START_HEAD =
  '85e710e53c12727d9c9bffeceb8157327f862274';

const NEXT_ACTION =
  'SEM-GOV-001D-UI3-I11 is closed as TESTED with Gate B PASS_MOCK_ONLY and Gate B-C1 PASS. Next perform a separate E2E-001 execution-readiness blocker reconciliation. Do not authorize live proof execution, runtime activation, I12, D1, R1, Scout transport, or governance-gate clearance in this closure.';

const PATHS = {
  ledger: path.join(
    ROOT,
    'control-center',
    'EDGE_BUILD_CONTROL_LEDGER.v1.json'
  ),

  register: path.join(
    ROOT,
    'control-center',
    'EDGE_MASTER_PROJECT_REGISTER.v1.json'
  ),

  backlog: path.join(
    ROOT,
    'control-center',
    'EDGE_PROJECT_BACKLOG.md'
  ),

  gateB: path.join(
    ROOT,
    'reports',
    'ui3-i11',
    'mock-orchestration-evidence.json'
  ),

  gateBC1: path.join(
    ROOT,
    'reports',
    'ui3-i11',
    'gate-b-c1-hmac-body-hash-binding-evidence.json'
  ),

  closureEvidence: path.join(
    ROOT,
    'reports',
    'ui3-i11',
    'gate-c-formal-closure-evidence.json'
  ),

  closurePacket: path.join(
    ROOT,
    'control-center',
    'SEM-GOV-001D-UI3-I11_GATE_C_FORMAL_CLOSURE_AND_E2E_READINESS_PACKET.v1.md'
  ),

  packageJson: path.join(
    ROOT,
    'package.json'
  )
};

const EXPECTED_GATES = {
  scout_edge_marriage_gate: 'BLOCKED',
  unified_lifecycle_governor: 'BLOCKED',
  supabase_storage_gate: 'BLOCKED'
};

function readJson(filePath) {
  return JSON.parse(
    fs.readFileSync(filePath, 'utf8')
  );
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

test(
  'Gate C formally closes I11 mock-only work and hands off to blocked E2E readiness reconciliation',
  () => {
    const ledger = readJson(PATHS.ledger);
    const register = readJson(PATHS.register);
    const gateB = readJson(PATHS.gateB);
    const gateBC1 = readJson(PATHS.gateBC1);
    const packageJson =
      readJson(PATHS.packageJson);

    const i11 = ledger.tasks.find(
      (task) =>
        task.task_id ===
        'SEM-GOV-001D-UI3-I11'
    );

    const e2e = ledger.tasks.find(
      (task) => task.task_id === 'E2E-001'
    );

    const project = register.projects.find(
      (entry) =>
        entry.project_id ===
        'SEM-GOV-001D-UI3-I11'
    );

    assert.ok(i11);
    assert.ok(e2e);
    assert.ok(project);

    assert.equal(
      ledger.scout_edge_marriage_gate,
      'BLOCKED'
    );

    assert.equal(
      ledger.unified_lifecycle_governor,
      'BLOCKED'
    );

    assert.equal(
      ledger.supabase_storage_gate,
      'BLOCKED'
    );

    assert.equal(i11.status, 'TESTED');

    assert.match(
      i11.completion_definition,
      /CLOSED AS TESTED/
    );

    assert.match(
      i11.completion_definition,
      /Gate B PASS_MOCK_ONLY/
    );

    assert.match(
      i11.completion_definition,
      /Gate B-C1 correction PASS/
    );

    assert.equal(
      i11.next_action,
      NEXT_ACTION
    );

    assert.equal(
      i11.open_gaps.includes(
        'E2E-001 execution-readiness blocker reconciliation'
      ),
      true
    );

    assert.equal(e2e.status, 'BLOCKED');

    assert.equal(
      project.current_status,
      'TESTED'
    );

    assert.equal(
      project.next_action,
      NEXT_ACTION
    );

    assert.deepEqual(
      project.current_evidence,
      i11.current_evidence
    );

    const backlog = fs.readFileSync(
      PATHS.backlog,
      'utf8'
    );

    assert.match(
      backlog,
      new RegExp(
        `SEM-GOV-001D-UI3-I11.*${NEXT_ACTION.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&'
        )}`
      )
    );

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
        .bodyHashBoundToSubmittedPayload,
      true
    );

    assert.equal(gateBC1.result, 'PASS');

    assert.equal(
      gateBC1.decision,
      'BODY_HASH_BINDING_CORRECTED'
    );

    assert.equal(
      gateBC1.fullMarriageProofDecision,
      'HOLD'
    );

    assert.deepEqual(
      gateB.currentRuntimeGates,
      EXPECTED_GATES
    );

    assert.deepEqual(
      gateBC1.currentRuntimeGates,
      EXPECTED_GATES
    );

    assert.equal(
      packageJson.scripts[
        'test:sem-gov-001d-ui3-i11-gate-c'
      ],
      'node --test tests/sem-gov-001d-ui3-i11-gate-c-closure.test.js'
    );

    const evidence = {
      task: 'SEM-GOV-001D-UI3-I11',
      miniProject:
        'SEM-GOV-001D-UI3-I11-GATE-C',
      operation:
        'FORMAL_CLOSURE_AND_E2E_READINESS_HANDOFF',
      startHead: START_HEAD,
      generatedAt:
        '2026-07-15T00:00:00.000Z',
      result: 'PASS',
      decision:
        'I11_CLOSED_TESTED_MOCK_ONLY',
      codeRequired: true,

      gateA: {
        result: 'PASS_WITH_CORRECTION'
      },

      gateB: {
        result: gateB.result,
        decision: gateB.decision,
        securityPreflight:
          gateB.securityPreflight.result,
        bodyHashBoundToSubmittedPayload:
          gateB.securityPreflight
            .bodyHashBoundToSubmittedPayload
      },

      gateBC1: {
        result: gateBC1.result,
        decision: gateBC1.decision
      },

      fullMarriageProofDecision: 'HOLD',
      e2e001Status: e2e.status,
      runtimeActivationAuthorized: false,
      liveProofExecutionAuthorized: false,
      i12Started: false,
      d1Started: false,
      r1Started: false,
      externalConnections: 0,

      currentRuntimeGates: {
        ...EXPECTED_GATES
      },

      runtimeFilesChanged: [],

      preservedUntrackedDirectories: [
        'evidence/',
        'evidence-home1-scratch/'
      ],

      nextAction: NEXT_ACTION
    };

    writeJson(
      PATHS.closureEvidence,
      evidence
    );

    const packet = `# SEM-GOV-001D-UI3-I11 Gate C — Formal Closure and E2E-001 Readiness Handoff

| Field | Value |
|---|---|
| Start HEAD | \`${START_HEAD}\` |
| Code required | **YES** |
| Gate A | **PASS WITH CORRECTION** |
| Gate B | **PASS_MOCK_ONLY** |
| Gate B-C1 | **PASS** |
| I11 final state | **CLOSED AS TESTED — MOCK ONLY** |
| Full live marriage proof | **HOLD** |
| E2E-001 | **BLOCKED** |
| Live proof authorization | **NO** |
| Runtime activation | **NO** |
| I12 | **NOT STARTED** |
| D1 | **NOT STARTED** |
| R1 | **NOT STARTED** |
| External connections | **0** |

## Closure decision

SEM-GOV-001D-UI3-I11 mock-only work is formally closed.

The authenticated submitted-body hash is bound to the actual FIP payload. The complete mock-only composition proof passes, valid HMAC authentication remains functional, nonce replay remains rejected, and no external system was contacted.

## Preserved runtime state

- \`scout_edge_marriage_gate\`: **BLOCKED**
- \`unified_lifecycle_governor\`: **BLOCKED**
- \`supabase_storage_gate\`: **BLOCKED**

## Explicit non-authorizations

This closure does not authorize:

- live Scout-to-Edge proof execution
- Scout transport
- an HTTP intake route
- runtime feature-flag enablement
- D1 prediction integration
- R1 provenance integration
- I12
- any governance-gate clearance
- production activation

## Next action

${NEXT_ACTION}

## Decision

**PASS — I11 CLOSED AS TESTED, MOCK-ONLY. FULL LIVE MARRIAGE PROOF REMAINS HOLD.**
`;

    fs.writeFileSync(
      PATHS.closurePacket,
      packet,
      'utf8'
    );
  }
);
