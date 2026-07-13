'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONTRACT_PATH = path.join(
  ROOT,
  'control-center',
  'SEM-GOV-001_UNIFIED_SPORTS_INTELLIGENCE_LIFECYCLE_CONTRACT.v1.md'
);

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

test('SEM-GOV-001A contract exists and keeps lifecycle governor blocked', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  assert.match(contract, /SEM-GOV-001 — Unified Sports Intelligence Lifecycle Contract v1/);
  assert.match(contract, /unified_lifecycle_governor.*\*\*BLOCKED\*\*/);
  assert.match(contract, /One platform language\./);
  assert.match(contract, /One fixture lifecycle\./);
  assert.match(contract, /One source of truth\./);
});

test('contract documents canonical lifecycle stages and states', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  for (const stage of [
    'Fixture Admitted',
    'Evidence Review',
    'Context Review',
    'Stability Review',
    'Publication Review',
    'Final Decision'
  ]) {
    assert.ok(contract.includes(stage), `missing lifecycle stage: ${stage}`);
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

test('contract documents rolling eight-day funnel and Help contract', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  assert.match(contract, /Today/);
  assert.match(contract, /Day 8/);
  assert.match(contract, /Help \/ How It Works/);
  assert.match(contract, /calendar day and lifecycle stage are \*\*not the same thing\*\*/i);
});

test('contract documents public boundary and safe explanation taxonomy', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  for (const category of [
    'TIMING_WINDOW',
    'INSUFFICIENT_EVIDENCE',
    'CONFIDENCE_THRESHOLD',
    'VOLATILITY_ELEVATED',
    'MARKET_CONFLICT',
    'SEMANTIC_ALIGNMENT',
    'APPROVED'
  ]) {
    assert.ok(contract.includes(category), `missing category: ${category}`);
  }
  assert.match(contract, /must not reveal/i);
  assert.match(contract, /provisional/i);
  assert.match(contract, /48-hour/i);
});

test('contract forbids runtime, SQL, Supabase, and UI implementation in SEM-GOV-001A', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  for (const forbidden of [
    'No SQL',
    'runtime code',
    'UI changes',
    'Clear `scout_edge_marriage_gate`'
  ]) {
    assert.ok(contract.includes(forbidden), `missing forbidden boundary: ${forbidden}`);
  }
});

test('ledger registers SEM-GOV-001A without clearing global gates', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const task = ledger.tasks.find((entry) => entry.task_id === 'SEM-GOV-001A');
  assert.equal(ledger.scout_edge_marriage_gate, 'BLOCKED');
  assert.equal(ledger.supabase_storage_gate, 'BLOCKED');
  assert.equal(ledger.unified_lifecycle_governor, 'BLOCKED');
  assert.ok(task);
  assert.equal(task.status, 'APPROVED');
  assert.ok(
    task.related_contracts.includes('SEM-GOV-001_UNIFIED_SPORTS_INTELLIGENCE_LIFECYCLE_CONTRACT.v1')
  );
  assert.ok(
    task.affected_files.includes('control-center/SEM-GOV-001_UNIFIED_SPORTS_INTELLIGENCE_LIFECYCLE_CONTRACT.v1.md')
  );
  assert.match(task.next_action, /SEM-GOV-001B/i);
});

test('project register mirrors SEM-GOV-001A ledger state', () => {
  const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
  const project = register.projects.find((entry) => entry.project_id === 'SEM-GOV-001A');
  assert.ok(project);
  assert.equal(project.current_status, 'APPROVED');
  assert.ok(
    project.related_contracts.includes('SEM-GOV-001_UNIFIED_SPORTS_INTELLIGENCE_LIFECYCLE_CONTRACT.v1')
  );
  assert.ok(project.current_evidence.some((line) => /SEM-GOV-001A-C1 sealed/.test(line)));
});

test('package control-center test suite includes SEM-GOV-001A proof', () => {
  const pkg = readJson('package.json');
  assert.ok(
    pkg.scripts['test:control-center'].includes('tests/sem-gov-001-lifecycle-contract.test.js')
  );
});
