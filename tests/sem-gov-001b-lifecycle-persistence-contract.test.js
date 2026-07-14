'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONTRACT_PATH = path.join(
  ROOT,
  'control-center',
  'SEM-GOV-001B_FOOTBALL_LIFECYCLE_PERSISTENCE_CONTRACT.v1.md'
);

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

test('SEM-GOV-001B contract exists and keeps all governance gates blocked', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  assert.match(contract, /SEM-GOV-001B — Football Lifecycle Persistence Contract v1/);
  assert.match(contract, /unified_lifecycle_governor.*\*\*BLOCKED\*\*/);
  assert.match(contract, /scout_edge_marriage_gate/);
  assert.match(contract, /supabase_storage_gate.*\*\*BLOCKED\*\*/);
  assert.match(contract, /LIFECYCLE_GOVERNOR_ENABLED.*default \*\*false\*\*/);
});

test('contract documents exactly six stages and eight states without alteration', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  for (const stage of [
    'ADMITTED',
    'EVIDENCE_REVIEW',
    'CONTEXT_REVIEW',
    'STABILITY_REVIEW',
    'PUBLICATION_REVIEW',
    'FINAL_DECISION'
  ]) {
    assert.ok(contract.includes(stage), `missing lifecycle stage token: ${stage}`);
  }
  for (const state of [
    'VISIBLE',
    'UNDER_REVIEW',
    'HELD',
    'ELIMINATED',
    'FINAL_APPROVED',
    'CANCELLED',
    'POSTPONED',
    'ARCHIVED'
  ]) {
    assert.ok(contract.includes(state), `missing lifecycle state: ${state}`);
  }
});

test('fixture_uid is an immutable Edge-minted UUID; FIP and provider IDs are aliases only', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  assert.match(contract, /Edge-minted immutable UUID/i);
  assert.match(contract, /Generated exactly once by Edge at first governed admission/);
  assert.match(contract, /IMMUTABLE/);
  assert.match(contract, /fip_id.*aliases or provenance references only/i);
  assert.match(contract, /UNIQUE\(alias_namespace, alias_value\)/);
  assert.match(contract, /FIXTURE_IDENTITY_CONFLICT/);
  assert.match(contract, /FIXTURE_ALIAS_CONFLICT/);
  assert.match(contract, /No automatic cross-provider merge/);
});

test('contract documents exact eight-day SAST admission window', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  assert.match(contract, /TODAY/);
  assert.match(contract, /DAY_8/);
  assert.match(contract, /Africa\/Johannesburg/);
  assert.match(contract, /window_start \+ 8 calendar days at 00:00:00 \(exclusive\)/);
  assert.match(contract, /FIXTURE_OUTSIDE_ADMISSION_WINDOW/);
});

test('admission at kickoff forbidden; fifteen-minute tolerance for already-admitted only', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  assert.match(contract, /FIXTURE_ALREADY_STARTED/);
  assert.match(contract, /Prohibited at or after scheduled kickoff/);
  assert.match(contract, /15 minutes/);
  assert.match(contract, /already admitted/i);
  assert.match(contract, /2-hour.*not.*lifecycle admission/i);
  assert.match(contract, /6-hour.*not.*lifecycle admission/i);
  assert.match(contract, /24-hour.*not.*lifecycle admission/i);
});

test('existing 48-hour FIP horizon remains unchanged until SEM-GOV-001C', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  assert.match(contract, /MAX_KICKOFF_HORIZON_MS/);
  assert.match(contract, /remains \*\*unchanged\*\* during 001B/i);
  assert.match(contract, /Supersession only through tested SEM-GOV-001C integration/);
});

test('legal transition matrix exists and unspecified transitions fail closed', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  const pairs = [
    'VISIBLE → UNDER_REVIEW',
    'VISIBLE → HELD',
    'VISIBLE → ELIMINATED',
    'UNDER_REVIEW → FINAL_APPROVED',
    'HELD → UNDER_REVIEW',
    'FINAL_APPROVED → ARCHIVED',
    'POSTPONED → VISIBLE',
    'CANCELLED → ARCHIVED',
    'ELIMINATED → ARCHIVED'
  ];
  for (const pair of pairs) {
    assert.ok(contract.includes(pair), `missing legal transition: ${pair}`);
  }
  assert.match(contract, /LIFECYCLE_TRANSITION_NOT_ALLOWED/);
  assert.match(contract, /fail closed/i);
});

test('append-only events, current projection, idempotency and optimistic concurrency documented', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  assert.match(contract, /fixture_lifecycle_current/);
  assert.match(contract, /fixture_lifecycle_transition_events/);
  assert.match(contract, /append-only/i);
  assert.match(contract, /idempotency_key/);
  assert.match(contract, /LIFECYCLE_DUPLICATE_EVENT/);
  assert.match(contract, /transition_version/);
  assert.match(contract, /LIFECYCLE_STALE_VERSION/);
  assert.match(contract, /LIFECYCLE_REASON_REQUIRED/);
});

test('rollover law is idempotent with catch-up support', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  assert.match(contract, /rollover_key/);
  assert.match(contract, /ROLLOVER_ALREADY_APPLIED/);
  assert.match(contract, /ROLLOVER_DATE_GAP/);
  assert.match(contract, /catch-up/i);
  assert.match(contract, /00:00 SAST/);
});

test('football-only SPORT_NOT_ACTIVE and postponed/cancelled separation', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  assert.match(contract, /SPORT_NOT_ACTIVE/);
  assert.match(contract, /sport = football/);
  assert.match(contract, /`POSTPONED` and `CANCELLED` remain separate/);
  assert.match(contract, /publication_eligible.*false/i);
});

test('full FIP and Scout evidence persistence remains forbidden', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  assert.match(contract, /Full validated FIP JSON body/);
  assert.match(contract, /Forbidden on lifecycle tables/);
  assert.match(contract, /No R1\/R2 or lifecycle persistence migration/);
  assert.match(contract, /Schema reserved only/);
});

test('contract forbids runtime, SQL, Supabase, API and UI implementation in SEM-GOV-001B-C1', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  for (const forbidden of [
    'runtime code',
    'SQL migrations',
    'Supabase migrations',
    'API routes',
    'Clear `scout_edge_marriage_gate`',
    'Start SEM-GOV-001C'
  ]) {
    assert.ok(contract.includes(forbidden) || contract.toLowerCase().includes(forbidden.toLowerCase()),
      `missing forbidden boundary: ${forbidden}`);
  }
});

test('ledger registers SEM-GOV-001B without clearing global gates', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const task = ledger.tasks.find((entry) => entry.task_id === 'SEM-GOV-001B');
  assert.equal(ledger.scout_edge_marriage_gate, 'BLOCKED');
  assert.equal(ledger.supabase_storage_gate, 'BLOCKED');
  assert.equal(ledger.unified_lifecycle_governor, 'BLOCKED');
  assert.ok(task);
  assert.equal(task.status, 'APPROVED');
  assert.ok(
    task.related_contracts.includes('SEM-GOV-001B_FOOTBALL_LIFECYCLE_PERSISTENCE_CONTRACT.v1')
  );
  assert.ok(
    task.affected_files.includes('control-center/SEM-GOV-001B_FOOTBALL_LIFECYCLE_PERSISTENCE_CONTRACT.v1.md')
  );
});

test('project register mirrors SEM-GOV-001B ledger state', () => {
  const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
  const project = register.projects.find((entry) => entry.project_id === 'SEM-GOV-001B');
  assert.ok(project);
  assert.equal(project.current_status, 'APPROVED');
  assert.ok(
    project.related_contracts.includes('SEM-GOV-001B_FOOTBALL_LIFECYCLE_PERSISTENCE_CONTRACT.v1')
  );
  assert.ok(project.current_evidence.some((line) => /SEM-GOV-001B-C1 sealed/.test(line)));
});

test('package control-center test suite includes SEM-GOV-001B proof', () => {
  const pkg = readJson('package.json');
  assert.ok(
    pkg.scripts['test:control-center'].includes('tests/sem-gov-001b-lifecycle-persistence-contract.test.js')
  );
});

test('SEM-GOV-001A regression: parent contract and task remain registered', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const taskA = ledger.tasks.find((entry) => entry.task_id === 'SEM-GOV-001A');
  assert.ok(taskA);
  assert.equal(taskA.status, 'APPROVED');
  assert.ok(fs.existsSync(path.join(ROOT, 'control-center', 'SEM-GOV-001_UNIFIED_SPORTS_INTELLIGENCE_LIFECYCLE_CONTRACT.v1.md')));
  const pkg = readJson('package.json');
  assert.ok(pkg.scripts['test:control-center'].includes('tests/sem-gov-001-lifecycle-contract.test.js'));
});
