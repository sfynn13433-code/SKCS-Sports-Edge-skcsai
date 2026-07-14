'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PACKET_PATH = path.join(
  ROOT,
  'control-center',
  'SEM-GOV-001B_LIFECYCLE_GOVERNOR_FOUNDATION_IMPLEMENTATION_PACKET.v1.md'
);
const PARENT_CONTRACT_PATH = path.join(
  ROOT,
  'control-center',
  'SEM-GOV-001B_FOOTBALL_LIFECYCLE_PERSISTENCE_CONTRACT.v1.md'
);

const FUTURE_FILES = [
  'backend/services/lifecycleGovernor.js',
  'backend/services/lifecyclePersistenceService.js',
  'backend/services/lifecycleRolloverService.js',
  'tests/lifecycle-governor.test.js',
  'tests/lifecycle-persistence-service.test.js',
  'tests/lifecycle-rollover-service.test.js'
];

const PROTECTED_RUNTIME_FILES = [
  'backend/services/fipIntakeService.js',
  'backend/services/aiPipeline.js',
  'backend/services/syncService.js',
  'backend/routes/scheduler.js',
  'backend/routes/pipeline.js',
  'backend/db.js',
  'backend/database.js'
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

test('SEM-GOV-001B-I2 packet exists with design-only boundary and blocked gates', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /SEM-GOV-001B-I2/);
  assert.match(packet, /a3da67a1b5e6f9a803e3156c4878d37a2b61a12c/);
  assert.match(packet, /Design-only/i);
  assert.match(packet, /scout_edge_marriage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /supabase_storage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /unified_lifecycle_governor.*\*\*BLOCKED\*\*/);
  assert.match(packet, /SEM-GOV-001B_FOOTBALL_LIFECYCLE_PERSISTENCE_CONTRACT\.v1/);
});

test('packet documents future file plan and forbids creating them in I2', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  for (const rel of FUTURE_FILES) {
    assert.ok(packet.includes(rel), `packet must list future file: ${rel}`);
    assert.equal(
      fs.existsSync(path.join(ROOT, rel)),
      false,
      `future file must not exist during I2: ${rel}`
    );
  }
  assert.match(packet, /MUST NOT\*\* be created/i);
});

test('packet names protected runtime surfaces without modifying them', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  for (const rel of PROTECTED_RUNTIME_FILES) {
    assert.ok(packet.includes(rel), `packet must protect: ${rel}`);
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `protected file should exist: ${rel}`);
  }
  assert.match(packet, /predictions_raw/);
  assert.match(packet, /direct1x2_prediction_final/);
  assert.match(packet, /fixture_context_cache/);
});

test('gate reader design uses canonical ledger through controlCenterReadService', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /controlCenterReadService/);
  assert.match(packet, /EDGE_BUILD_CONTROL_LEDGER\.v1\.json/);
  assert.match(packet, /readLifecycleGovernorGate/);
  assert.match(packet, /unifiedLifecycleGovernor/);
  assert.match(packet, /scoutEdgeMarriageGate/);
  assert.match(packet, /supabaseStorageGate/);
  assert.match(packet, /LIFECYCLE_GATE_BLOCKED/);
  assert.match(packet, /LIFECYCLE_GOVERNOR_ENABLED.*default \*\*false\*\*/i);
  assert.match(packet, /refresh-safe runtime reading|immutable startup snapshot/i);
});

test('packet defines future pure governor contract and persistence adapter', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  for (const fn of [
    'evaluateGovernorGate',
    'calculateSastWindow',
    'calculateDayLabel',
    'evaluateAdmission',
    'evaluateTransition',
    'buildTransitionEvent',
    'calculateRolloverPlan'
  ]) {
    assert.ok(packet.includes(fn), `missing future function: ${fn}`);
  }
  for (const method of [
    'findFixtureByAlias',
    'allocateFixtureUid',
    'insertAlias',
    'loadCurrentLifecycle',
    'appendTransitionEvent',
    'updateCurrentProjection',
    'loadLastRollover',
    'appendRolloverEvent'
  ]) {
    assert.ok(packet.includes(method), `missing persistence method: ${method}`);
  }
  assert.match(packet, /gateReader/);
  assert.match(packet, /persistenceAdapter/);
  assert.match(packet, /transactionRunner/);
  assert.match(packet, /No direct.*process\.env/i);
});

test('packet documents fail-closed order and full future test matrix', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /Exact fail-closed order/i);
  assert.match(packet, /ledger unreadable or malformed/i);
  assert.match(packet, /feature flag disabled/i);
  assert.match(packet, /no DB call/i);
  const matrixCases = [
    'Gate blocked',
    'Flag disabled',
    'Football-only',
    'Eight-day SAST',
    'Kickoff cutoff',
    '15-minute tolerance',
    'Immutable UUID',
    'Alias conflict',
    'Stage regression',
    'Reason required',
    'Deterministic idempotency',
    'Stale version',
    'Postponed vs cancelled',
    'Rollover duplicate',
    'ROLLOVER_DATE_GAP',
    'Transaction rollback',
    'Protected-table non-interaction'
  ];
  for (const item of matrixCases) {
    assert.ok(packet.includes(item) || packet.toLowerCase().includes(item.toLowerCase()),
      `missing test matrix item: ${item}`);
  }
});

test('packet defines implementation sequence with I3-I5 and SEM-GOV-001C blocked', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /SEM-GOV-001B-I3/);
  assert.match(packet, /SEM-GOV-001B-I4/);
  assert.match(packet, /SEM-GOV-001B-I5/);
  assert.match(packet, /SEM-GOV-001C/);
  assert.match(packet, /Do not start|BLOCKED/i);
});

test('ledger registers SEM-GOV-001B-I2 APPROVED with blocked gates and empty tables', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const task = ledger.tasks.find((entry) => entry.task_id === 'SEM-GOV-001B-I2');
  assert.equal(ledger.scout_edge_marriage_gate, 'BLOCKED');
  assert.equal(ledger.supabase_storage_gate, 'BLOCKED');
  assert.equal(ledger.unified_lifecycle_governor, 'BLOCKED');
  assert.ok(task);
  assert.equal(task.status, 'APPROVED');
  assert.deepEqual(task.affected_tables, []);
  assert.ok(
    task.related_contracts.includes('SEM-GOV-001B_FOOTBALL_LIFECYCLE_PERSISTENCE_CONTRACT.v1')
  );
  assert.ok(
    task.affected_files.includes(
      'control-center/SEM-GOV-001B_LIFECYCLE_GOVERNOR_FOUNDATION_IMPLEMENTATION_PACKET.v1.md'
    )
  );
  assert.match(task.next_action, /I2.*sealed/i);
  assert.match(task.next_action, /I3.*blocked/i);
});

test('project register mirrors SEM-GOV-001B-I2 ledger state', () => {
  const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
  const project = register.projects.find((entry) => entry.project_id === 'SEM-GOV-001B-I2');
  assert.ok(project);
  assert.equal(project.current_status, 'APPROVED');
  assert.ok(
    project.related_contracts.includes('SEM-GOV-001B_FOOTBALL_LIFECYCLE_PERSISTENCE_CONTRACT.v1')
  );
  assert.match(project.next_action, /I2.*sealed/i);
  assert.match(project.next_action, /I3.*blocked/i);
});

test('package control-center test suite includes SEM-GOV-001B-I2 proof', () => {
  const pkg = readJson('package.json');
  assert.ok(
    pkg.scripts['test:control-center'].includes('tests/sem-gov-001b-governor-foundation-packet.test.js')
  );
});

test('SEM-GOV-001B contract regression: parent contract still sealed', () => {
  const contract = fs.readFileSync(PARENT_CONTRACT_PATH, 'utf8');
  assert.match(contract, /SEM-GOV-001B — Football Lifecycle Persistence Contract v1/);
  assert.match(contract, /unified_lifecycle_governor.*\*\*BLOCKED\*\*/);
});

test('SEM-GOV-001A regression: parent programme task remains registered', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const taskA = ledger.tasks.find((entry) => entry.task_id === 'SEM-GOV-001A');
  assert.ok(taskA);
  assert.equal(taskA.status, 'APPROVED');
  assert.ok(
    fs.existsSync(
      path.join(ROOT, 'control-center', 'SEM-GOV-001_UNIFIED_SPORTS_INTELLIGENCE_LIFECYCLE_CONTRACT.v1.md')
    )
  );
});
