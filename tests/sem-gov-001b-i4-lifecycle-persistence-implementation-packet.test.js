'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PACKET_PATH = path.join(
  ROOT,
  'control-center/SEM-GOV-001B-I4_LIFECYCLE_PERSISTENCE_IMPLEMENTATION_PACKET.v1.md'
);
const MIGRATION_PATH = path.join(
  ROOT,
  'supabase/migrations/20261008000001_sem_gov_001b_lifecycle_persistence.sql'
);

const REQUIRED_SECTIONS = [
  'A. Authority and status',
  'B. Start point',
  'C. Scope',
  'D. Controlling contracts',
  'E. Supabase Free-Tier supremacy',
  'F. Allowed files',
  'G. Prohibited files',
  'H. Exact six-table schema',
  'I. Exact indexes and constraints',
  'J. Persistence service public interface',
  'K. Gate-before-database law',
  'L. Admission transaction sequence',
  'M. Transition transaction sequence',
  'N. Durable idempotency law',
  'O. Daily admission-cap law',
  'P. Error contract',
  'Q. Resource and query limits',
  'R. Migration non-execution boundary',
  'S. Rollback design',
  'T. Test matrix',
  'U. Deferred work',
  'V. Definition of Done'
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

test('I4 implementation packet exists with blocked gates and not-applied migration', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /SEM-GOV-001B-I4/);
  assert.match(packet, /1f87a1ab7bb9b5b32b44906662768c827b7eb2cc/);
  assert.match(packet, /scout_edge_marriage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /supabase_storage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /unified_lifecycle_governor.*\*\*BLOCKED\*\*/);
  assert.match(packet, /NOT APPLIED/i);
  assert.match(packet, /TESTED STATICALLY/i);
  for (const section of REQUIRED_SECTIONS) {
    assert.ok(packet.includes(section), `missing section ${section}`);
  }
});

test('allowed implementation files exist', () => {
  for (const rel of [
    'backend/services/lifecyclePersistenceService.js',
    'tests/lifecycle-persistence-service.test.js',
    MIGRATION_PATH.replace(`${ROOT}${path.sep}`, '').replace(/\\/g, '/')
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `missing ${rel}`);
  }
});

test('packet documents 50/day and 180-day retention law', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /50/);
  assert.match(packet, /180-day|180d/i);
  assert.match(packet, /SEM-GOV-001B-I4_CAP2|SEM-GOV-001B-I4-CAP2/);
  assert.match(packet, /lifecycle_admission_idempotency/);
});

test('packet defers I4-PURGE, I5 and SEM-GOV-001C', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /I4-PURGE/);
  assert.match(packet, /I5/);
  assert.match(packet, /SEM-GOV-001C/);
  assert.match(packet, /no production caller/i);
  assert.match(packet, /Production activation.*BLOCKED/i);
});

test('ledger registers SEM-GOV-001B-I4 with blocked gates', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const task = ledger.tasks.find((t) => t.task_id === 'SEM-GOV-001B-I4');
  assert.ok(task, 'SEM-GOV-001B-I4 task missing');
  assert.equal(ledger.scout_edge_marriage_gate, 'BLOCKED');
  assert.equal(ledger.supabase_storage_gate, 'BLOCKED');
  assert.equal(ledger.unified_lifecycle_governor, 'BLOCKED');
});

test('project register mirrors SEM-GOV-001B-I4', () => {
  const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
  const project = register.projects.find((p) => p.project_id === 'SEM-GOV-001B-I4');
  assert.ok(project);
});
