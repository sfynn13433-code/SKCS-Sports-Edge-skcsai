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
const APPLY_RESULT_PATH = path.join(
  ROOT,
  'reports/ui3-i10/controlled-apply-result.json'
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
  'E. Lifecycle RLS correction (Gate A)',
  'F. Static readiness result (Gate A)',
  'G. Live read-only inspection result (Gate A)',
  'H. Gate B controlled apply result',
  'I. Capacity note',
  'J. Test matrix and results',
  'K. Prohibited work (still deferred)',
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
  assert.match(packet, /21e436da4ff16946519d8a6842b99bf7ae684328/);
  assert.match(packet, /Gate A decision.*\*\*PASS\*\*/);
  assert.match(packet, /Gate B decision.*\*\*PASS WITH CORRECTION\*\*/);
  assert.match(packet, /scout_edge_marriage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /unified_lifecycle_governor.*\*\*BLOCKED\*\*/);
  assert.match(packet, /supabase_storage_gate.*\*\*BLOCKED\*\*/);
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
});

test('controlled apply script, test, and Gate B reports exist', () => {
  assert.ok(
    fs.existsSync(
      path.join(ROOT, 'scripts/apply-ui3-i10-controlled-migrations.js')
    )
  );
  assert.ok(
    fs.existsSync(
      path.join(
        ROOT,
        'tests/sem-gov-001d-ui3-i10-controlled-apply.test.js'
      )
    )
  );
  assert.ok(fs.existsSync(APPLY_RESULT_PATH));

  const result = JSON.parse(fs.readFileSync(APPLY_RESULT_PATH, 'utf8'));
  assert.equal(result.task, 'SEM-GOV-001D-UI3-I10');
  assert.equal(result.operation, 'GATE_B_CONTROLLED_APPLY');
  assert.equal(result.result, 'PASS');
  assert.equal(result.migrations.length, 3);
  assert.equal(result.postApply.tables.length, 8);
  assert.equal(result.postApply.policies.length, 0);
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

test('readiness and apply reports redact credentials', () => {
  const readiness = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const apply = JSON.parse(fs.readFileSync(APPLY_RESULT_PATH, 'utf8'));
  const serialized = JSON.stringify({ readiness, apply });
  assert.doesNotMatch(serialized, /secret-password|password@/i);
  assert.ok(readiness.live.connectionTarget.host);
  assert.equal(
    Object.hasOwn(readiness.live.connectionTarget, 'password'),
    false
  );
  assert.equal(
    Object.hasOwn(apply.connectionTarget, 'password'),
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
