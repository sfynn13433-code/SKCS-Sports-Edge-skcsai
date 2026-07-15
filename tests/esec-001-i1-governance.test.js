'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(
    path.join(ROOT, relativePath),
    'utf8'
  );
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

test('I1 implementation report and contract record source closure with RLS open', () => {
  const report = readJson(
    'reports/esec-001/fail-closed-authentication-implementation.json'
  );

  const contract = read(
    'control-center/ESEC-001_I1_FAIL_CLOSED_AUTHENTICATION_AND_CREDENTIAL_BOUNDARY_IMPLEMENTATION.v1.md'
  );

  assert.equal(report.task, 'ESEC-001');
  assert.equal(report.miniProject, 'ESEC-001-I1');
  assert.equal(report.result, 'PASS_SOURCE_AND_TEST_CLOSURE');
  assert.equal(report.esec001Status, 'PARTIAL');
  assert.equal(report.e2e001Status, 'BLOCKED');
  assert.equal(report.secretValuesRecorded, false);
  assert.equal(report.externalConnections, 0);

  assert.equal(
    report.verification.activeI1Proof.result,
    'PASS'
  );

  assert.equal(
    report.verification.activeI1Proof.passed,
    32
  );

  assert.equal(
    report.verification.historicalC1Proof.passed,
    2
  );

  assert.equal(
    report.verification.broadControlCenterSuite.result,
    'HOLD_REPOSITORY_WIDE_GOVERNANCE_DRIFT'
  );

  assert.equal(
    report.verification
      .broadControlCenterSuite
      .packetSpecificDeferredCandidates
      .length,
    3
  );

  assert.deepEqual(
    report.findings
      .filter((finding) => finding.state === 'OPEN_EXCLUDED')
      .map((finding) => finding.id),
    ['RLS-001']
  );

  assert.equal(
    report.runtimeGates.scout_edge_marriage_gate,
    'BLOCKED'
  );

  assert.equal(
    report.runtimeGates.unified_lifecycle_governor,
    'BLOCKED'
  );

  assert.equal(
    report.runtimeGates.supabase_storage_gate,
    'BLOCKED'
  );

  assert.match(contract, /AUTH-001 \| SOURCE_CLOSED_TESTED/);
  assert.match(contract, /RLS-001 \| OPEN_EXCLUDED/);
  assert.match(contract, /No E2E execution/);
  assert.match(contract, /No `?control:assets`? execution/);
});

test('canonical ledger and generated register expose the I1 result', () => {
  const ledger = readJson(
    'control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json'
  );

  const register = readJson(
    'control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json'
  );

  const esecTask = ledger.tasks.find(
    (entry) => entry.task_id === 'ESEC-001'
  );

  const esecProject = register.projects.find(
    (entry) => entry.project_id === 'ESEC-001'
  );

  assert.ok(esecTask, 'missing ESEC-001 ledger task');
  assert.ok(esecProject, 'missing ESEC-001 project');

  assert.equal(esecTask.status, 'PARTIAL');
  assert.equal(esecProject.current_status, 'PARTIAL');

  assert.ok(
    esecTask.open_gaps.some(
      (gap) => gap.includes('RLS-001')
    )
  );

  assert.ok(
    esecTask.proof_required.includes(
      'npm run test:esec-001-i1 passes'
    )
  );

  assert.match(esecTask.next_action, /RLS-001 remains OPEN/);
  assert.equal(esecProject.next_action, esecTask.next_action);

  const backlog = read(
    'control-center/EDGE_PROJECT_BACKLOG.md'
  );

  assert.match(
    backlog,
    /ESEC-001-I1 source-and-test remediation PASS/
  );

  assert.match(backlog, /RLS-001 remains OPEN/);
});

test('C1 proof is read-only historical evidence', () => {
  const c1Source = read(
    'tests/esec-001-c1-security-boundary.test.js'
  );

  const c1Report = readJson(
    'reports/esec-001/security-boundary-inspection.json'
  );

  assert.doesNotMatch(
    c1Source,
    /fs\.writeFileSync|function writeJson|writeJson\(/
  );

  assert.equal(c1Report.miniProject, 'ESEC-001-C1');
  assert.equal(c1Report.findingCount, 8);
  assert.deepEqual(
    c1Report.findings.map((finding) => finding.state),
    Array(8).fill('OPEN')
  );
});

test('Control Center and package scripts use the active I1 proof', () => {
  const controlCenter = read(
    'control-center/EDGE_CONTROL_CENTER.md'
  );

  const packageJson = readJson('package.json');

  assert.match(
    controlCenter,
    /\| ESEC-001 \| Subscriber and Security Boundary \| PARTIAL \(I1 source\/test remediation passed; RLS and runtime proof open\) \|/
  );

  assert.match(
    controlCenter,
    /ESEC-001-I1 source remediation closure/
  );

  assert.equal(
    packageJson.scripts['test:esec-001-i1'],
    'node --test tests/esec-001-i1-auth-boundary.test.js tests/esec-001-i1-browser-auth-boundary.test.js tests/esec-001-i1-legacy-cron-boundary.test.js tests/esec-001-i1-scheduler-caller-boundary.test.js tests/esec-001-i1-scheduler-route-boundary.test.js tests/esec-001-i1-db-credential-boundary.test.js tests/esec-001-i1-governance.test.js'
  );
});
