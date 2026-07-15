'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const START_HEAD =
  'c14f839cb6482c7d58dd04bdac5705bbd94e57fb';

const NEXT_ACTION =
  'E2E-001-C2 readiness remains PASS WITH BLOCKERS after ESEC-001-C1. ESEC-001 is PARTIAL with eight open security findings. Next separately authorize ESEC-001-I1 fail-closed authentication and credential-boundary remediation. Do not execute the live proof, authorize Scout transport, implement D1 or R1, alter provider runtime, enable routes or feature flags, or clear any runtime governance gate.';

const EXPECTED_GATES = {
  scout_edge_marriage_gate: 'BLOCKED',
  unified_lifecycle_governor: 'BLOCKED',
  supabase_storage_gate: 'BLOCKED'
};

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

  controlledApply: path.join(
    ROOT,
    'reports',
    'ui3-i10',
    'controlled-apply-result.json'
  ),

  gateC: path.join(
    ROOT,
    'reports',
    'ui3-i11',
    'gate-c-formal-closure-evidence.json'
  ),

  evidence: path.join(
    ROOT,
    'reports',
    'e2e-001',
    'execution-readiness-reconciliation.json'
  ),

  packet: path.join(
    ROOT,
    'control-center',
    'E2E-001_C2_EXECUTION_READINESS_BLOCKER_RECONCILIATION.v1.md'
  ),

  packageJson: path.join(
    ROOT,
    'package.json'
  )
};

const FOUNDATION_FILES = [
  'backend/services/fipIntakeService.js',
  'backend/services/governedFipIntakeAdapter.js',
  'backend/services/governedFipIntakeComposition.js',
  'backend/services/fipIntakeM2MAuthenticator.js',
  'backend/services/fipIntakeEvidenceService.js',
  'backend/services/fixtureDisplayMetadataPersistenceService.js'
];

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

function getTask(ledger, taskId) {
  const task = ledger.tasks.find(
    (entry) => entry.task_id === taskId
  );

  assert.ok(task, `${taskId} missing from ledger`);

  return task;
}

function walkJavaScriptFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const results = [];

  for (const entry of fs.readdirSync(
    directory,
    { withFileTypes: true }
  )) {
    const fullPath = path.join(
      directory,
      entry.name
    );

    if (entry.isDirectory()) {
      results.push(
        ...walkJavaScriptFiles(fullPath)
      );
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.js')
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

test(
  'E2E-001-C2 reconciles readiness and remains fail-closed',
  () => {
    const ledger = readJson(PATHS.ledger);
    const register = readJson(PATHS.register);
    const controlledApply =
      readJson(PATHS.controlledApply);
    const gateC = readJson(PATHS.gateC);
    const packageJson =
      readJson(PATHS.packageJson);

    assert.deepEqual(
      {
        scout_edge_marriage_gate:
          ledger.scout_edge_marriage_gate,
        unified_lifecycle_governor:
          ledger.unified_lifecycle_governor,
        supabase_storage_gate:
          ledger.supabase_storage_gate
      },
      EXPECTED_GATES
    );

    const fip = getTask(ledger, 'FIP-001');
    const efi = getTask(ledger, 'EFI-001');
    const est = getTask(ledger, 'EST-001');
    const esec = getTask(ledger, 'ESEC-001');
    const epi = getTask(ledger, 'EPI-001');
    const eprv = getTask(ledger, 'EPRV-001');
    const e2e = getTask(ledger, 'E2E-001');

    assert.equal(fip.status, 'APPROVED');
    assert.equal(efi.status, 'TESTED');
    assert.equal(est.status, 'TESTED');
    assert.equal(esec.status, 'PARTIAL');
    assert.equal(epi.status, 'TESTED');
    assert.equal(eprv.status, 'PARTIAL');
    assert.equal(e2e.status, 'BLOCKED');

    assert.equal(e2e.next_action, NEXT_ACTION);

    assert.equal(
      e2e.open_gaps.includes(
        'ESEC-001-C1 inspection is complete, but ESEC-001 remains PARTIAL with five CRITICAL and three HIGH findings requiring ESEC-001-I1 remediation'
      ),
      true
    );

    assert.equal(
      e2e.open_gaps.includes(
        'EPRV-001 remains PARTIAL and direct external sports-truth acquisition remains reachable'
      ),
      true
    );

    const project = register.projects.find(
      (entry) => entry.project_id === 'E2E-001'
    );

    assert.ok(project);
    assert.equal(project.current_status, 'BLOCKED');
    assert.equal(project.next_action, NEXT_ACTION);

    assert.deepEqual(
      project.current_evidence,
      e2e.current_evidence
    );

    const backlog = fs.readFileSync(
      PATHS.backlog,
      'utf8'
    );

    assert.equal(
      backlog.includes(NEXT_ACTION),
      true
    );

    assert.equal(controlledApply.result, 'PASS');

    const appliedTables =
      controlledApply.postApply.tables.map(
        (table) => table.table_name
      );

    assert.equal(appliedTables.length, 8);

    assert.equal(
      appliedTables.includes(
        'fip_intake_evidence'
      ),
      true
    );

    assert.equal(
      appliedTables.includes(
        'fip_provenance_refs'
      ),
      false
    );

    assert.equal(
      appliedTables.includes(
        'fip_prediction_links'
      ),
      false
    );

    assert.equal(gateC.result, 'PASS');

    assert.equal(
      gateC.decision,
      'I11_CLOSED_TESTED_MOCK_ONLY'
    );

    assert.equal(
      gateC.fullMarriageProofDecision,
      'HOLD'
    );

    assert.equal(
      gateC.liveProofExecutionAuthorized,
      false
    );

    assert.equal(
      gateC.runtimeActivationAuthorized,
      false
    );

    assert.deepEqual(
      gateC.currentRuntimeGates,
      EXPECTED_GATES
    );

    for (const relativePath of FOUNDATION_FILES) {
      assert.equal(
        fs.existsSync(
          path.join(ROOT, relativePath)
        ),
        true,
        `${relativePath} missing`
      );
    }

    const productionSurfaceFiles = [
      path.join(
        ROOT,
        'backend',
        'server-express.js'
      ),
      ...walkJavaScriptFiles(
        path.join(ROOT, 'backend', 'routes')
      )
    ];

    const productionRouteReferences =
      productionSurfaceFiles.filter(
        (filePath) => {
          const source = fs.readFileSync(
            filePath,
            'utf8'
          );

          return (
            source.includes(
              'createGovernedFipIntakeComposition'
            ) ||
            source.includes(
              'governedFipIntakeComposition'
            )
          );
        }
      );

    assert.deepEqual(
      productionRouteReferences,
      []
    );

    assert.equal(
      packageJson.scripts[
        'test:e2e-001-c2'
      ],
      'node --test tests/e2e-001-c2-execution-readiness.test.js'
    );

    const readinessMatrix = [
      {
        id: 'FIP-001',
        status: 'SATISFIED_FOUNDATION',
        evidence:
          'Committed canonical FIP authority is registered.'
      },
      {
        id: 'EFI-001',
        status: 'SATISFIED_MOCK_ONLY',
        evidence:
          'Fail-closed intake, adapter, composition and HMAC foundation are tested; no production receive route exists.'
      },
      {
        id: 'EST-001-R2',
        status: 'SATISFIED_SCHEMA_ONLY',
        evidence:
          'public.fip_intake_evidence exists with RLS; runtime gates remain blocked.'
      },
      {
        id: 'ESEC-001',
        status: 'BLOCKED',
        evidence:
          'Inspection complete; task remains PARTIAL with five CRITICAL and three HIGH findings requiring ESEC-001-I1 remediation.'
      },
      {
        id: 'EPI-001-D1-R1',
        status: 'BLOCKED',
        evidence:
          'Pipeline contract is tested, but governed D1 prediction and R1 provenance integration are absent.'
      },
      {
        id: 'EPRV-001',
        status: 'BLOCKED',
        evidence:
          'Task remains PARTIAL and external acquisition is still reachable.'
      },
      {
        id: 'SCOUT-TRANSPORT-SAMPLE',
        status: 'BLOCKED',
        evidence:
          'No controlled Scout sample or governed transport is authorized.'
      },
      {
        id: 'LIVE-PROOF-AUTHORIZATION',
        status: 'BLOCKED',
        evidence:
          'Proof-mode route, feature flag, storage/lifecycle authorization and rollback approval are absent.'
      }
    ];

    const remainingBlockers =
      readinessMatrix.filter(
        (entry) => entry.status === 'BLOCKED'
      );

    assert.equal(remainingBlockers.length, 5);

    const evidence = {
      task: 'E2E-001',
      miniProject: 'E2E-001-C2',
      operation:
        'EXECUTION_READINESS_BLOCKER_RECONCILIATION',
      startHead: START_HEAD,
      generatedAt:
        '2026-07-15T00:00:00.000Z',
      result: 'PASS_WITH_BLOCKERS',
      decision:
        'EXECUTION_READINESS_RECONCILED_LIVE_PROOF_BLOCKED',
      codeRequired: true,

      planningStatementsSuperseded: [
        {
          statement:
            'EFI-001 runtime intake boundary not implemented',
          correctedState:
            'Intake foundation TESTED; production route and Scout transport remain absent.'
        },
        {
          statement:
            'EST-001 schema not implemented',
          correctedState:
            'R2 evidence and lifecycle/display schemas applied; R1/D1 integration remains absent.'
        },
        {
          statement:
            'public.fip_intake_events is canonical',
          correctedState:
            'public.fip_intake_evidence is canonical.'
        }
      ],

      readinessMatrix,
      remainingBlockerCount:
        remainingBlockers.length,
      remainingBlockers,

      executionReady: false,
      e2e001Status: 'BLOCKED',
      esec001Status: 'PARTIAL',
      esec001InspectionDecision:
        'SECURITY_BOUNDARY_INSPECTED_REMEDIATION_REQUIRED',
      fullMarriageProofDecision: 'HOLD',
      liveProofExecutionAuthorized: false,
      scoutTransportAuthorized: false,
      productionRouteAuthorized: false,
      runtimeActivationAuthorized: false,
      d1Implemented: false,
      r1Implemented: false,
      externalConnections: 0,

      nextAuthorizedMiniProject: {
        id: 'ESEC-001-I1',
        mode:
          'FAIL_CLOSED_AUTHENTICATION_AND_CREDENTIAL_BOUNDARY_REMEDIATION',
        runtimeChangesAuthorized: false,
        separatelyAuthorized: false
      },

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

    writeJson(PATHS.evidence, evidence);

    const matrixRows = readinessMatrix.map(
      (entry) =>
        `| ${entry.id} | ${entry.status} | ${entry.evidence} |`
    );

    const packet = [
      '# E2E-001-C2 — Execution-Readiness Blocker Reconciliation',
      '',
      '| Field | Value |',
      '|---|---|',
      `| Start HEAD | \`${START_HEAD}\` |`,
      '| Code required | **YES** |',
      '| Reconciliation result | **PASS WITH BLOCKERS** |',
      '| E2E-001 | **BLOCKED** |',
      '| ESEC-001 | **PARTIAL — 8 OPEN FINDINGS** |',
      '| Execution ready | **NO** |',
      '| Full marriage proof | **HOLD** |',
      '| Live proof authorized | **NO** |',
      '| Runtime activation | **NO** |',
      '| External connections | **0** |',
      '',
      '## Readiness matrix',
      '',
      '| Area | State | Evidence |',
      '|---|---|---|',
      ...matrixRows,
      '',
      '## Corrected planning state',
      '',
      '- EFI intake is no longer wholly unimplemented: the isolated fail-closed foundation and mock composition proof are tested.',
      '- EST storage is no longer wholly unimplemented: the bounded R2 evidence schema is applied, but R1 provenance and D1 prediction linkage remain absent.',
      '- `public.fip_intake_evidence` supersedes the earlier `public.fip_intake_events` planning reference.',
      '',
      '## Preserved runtime state',
      '',
      '- `scout_edge_marriage_gate`: **BLOCKED**',
      '- `unified_lifecycle_governor`: **BLOCKED**',
      '- `supabase_storage_gate`: **BLOCKED**',
      '',
      '## Next governed mini-project',
      '',
      '**ESEC-001-I1 — Fail-Closed Authentication and Credential-Boundary Remediation.**',
      '',
      'ESEC-001-I1 requires separate authorization. It is not started by this correction and does not authorize E2E proof, Scout transport, D1, R1, provider removal, or gate clearance.',
      '',
      '## Decision',
      '',
      '**PASS WITH BLOCKERS — READINESS RECONCILED; LIVE E2E PROOF REMAINS BLOCKED.**',
      ''
    ].join('\n');

    fs.writeFileSync(
      PATHS.packet,
      packet,
      'utf8'
    );
  }
);
