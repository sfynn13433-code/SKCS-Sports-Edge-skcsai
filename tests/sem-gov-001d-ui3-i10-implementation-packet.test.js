'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PACKET_PATH = path.join(
  ROOT,
  'control-center/SEM-GOV-001D-UI3-I10_MIGRATION_READINESS_AND_CONTROLLED_APPLY_PACKET.v1.md'
);
const REPORT_PATH = path.join(
  ROOT,
  'reports/ui3-i10/migration-readiness.json'
);
const LIFECYCLE_MIGRATION_PATH = path.join(
  ROOT,
  'supabase/migrations/20261008000001_sem_gov_001b_lifecycle_persistence.sql'
);

const REQUIRED_SECTIONS = [
  'A. Authority and start HEAD',
  'B. Two-gate law',
  'C. Files implemented',
  'D. Migration order (sealed)',
  'E. Lifecycle RLS correction',
  'F. Static readiness result',
  'G. Live read-only inspection result',
  'H. Capacity note',
  'I. Proposed migration-apply command (NOT EXECUTED)',
  'J. Test matrix and results',
  'K. Prohibited work (deferred)',
  'L. FUTURE_SECURITY_NOTE',
  'M. Definition of Done',
  'N. Inspection decision'
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

test('UI3-I10 packet records PASS WITH CORRECTION and blocked gates', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /SEM-GOV-001D-UI3-I10/);
  assert.match(packet, /bf12011b21dfd6172b8f64c64f3a01d7ac653f88/);
  assert.match(packet, /Gate A decision.*\*\*PASS\*\*/);
  assert.match(packet, /Gate B decision.*\*\*HOLD\*\*/);
  assert.match(packet, /scout_edge_marriage_gate.*\*\*BLOCKED\*\*/);
  for (const section of REQUIRED_SECTIONS) {
    assert.ok(packet.includes(section), `missing section ${section}`);
  }
});

test('readiness checker and report exist', () => {
  assert.ok(
    fs.existsSync(
      path.join(ROOT, 'scripts/check-ui3-i10-migration-readiness.js')
    )
  );
  assert.ok(fs.existsSync(REPORT_PATH));
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  assert.equal(report.task, 'SEM-GOV-001D-UI3-I10');
  assert.equal(report.decision, 'PASS');
  assert.equal(report.live.inspected, true);
  assert.equal(report.live.snapshot.targetTableInventory.length, 0);
  assert.equal(report.live.snapshot.migrationHistory.length, 0);
});

test('lifecycle migration includes RLS on all six tables', () => {
  const sql = fs.readFileSync(LIFECYCLE_MIGRATION_PATH, 'utf8');
  for (const table of [
    'fixture_lifecycle_current',
    'fixture_identity_aliases',
    'fixture_lifecycle_transition_events',
    'fixture_lifecycle_rollover_events',
    'lifecycle_daily_admission_counters',
    'lifecycle_admission_idempotency'
  ]) {
    assert.match(
      sql,
      new RegExp(
        `ALTER TABLE public\\.${table}[\\s\\S]*ENABLE ROW LEVEL SECURITY`,
        'i'
      )
    );
  }
  assert.doesNotMatch(sql, /CREATE POLICY/i);
});

test('readiness report redacts credentials', () => {
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /secret-password|password@/i);
  assert.ok(report.live.connectionTarget.host);
  assert.equal(
    Object.hasOwn(report.live.connectionTarget, 'password'),
    false
  );
});

test('ledger registers UI3-I10 task', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const task = ledger.tasks.find((entry) => entry.task_id === 'SEM-GOV-001D-UI3-I10');
  assert.ok(task, 'missing SEM-GOV-001D-UI3-I10 ledger task');
  assert.equal(task.status, 'TESTED');
  assert.ok(task.blocked_by.includes('SEM-GOV-001D-UI3-I9'));
});

test('project register includes UI3-I10', () => {
  const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
  const project = register.projects.find((entry) => entry.project_id === 'SEM-GOV-001D-UI3-I10');
  assert.ok(project, 'missing SEM-GOV-001D-UI3-I10 project');
  assert.equal(project.current_status, 'TESTED');
});
