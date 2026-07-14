'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PACKET_PATH = path.join(
  ROOT,
  'control-center/SEM-GOV-001D-UI3-I8_DURABLE_INTAKE_EVIDENCE_STORAGE_IMPLEMENTATION_PACKET.v1.md'
);
const MIGRATION_PATH = path.join(
  ROOT,
  'supabase/migrations/20261011000001_sem_gov_001d_ui3_i8_fip_intake_evidence.sql'
);
const SERVICE_PATH = path.join(ROOT, 'backend/services/fipIntakeEvidenceService.js');

const REQUIRED_SECTIONS = [
  'A. Authority and start HEAD',
  'B. Inspection findings',
  'C. Factual table and column count',
  'D. Outcome law',
  'E. Idempotency law',
  'F. fixture_uid / FK decision',
  'G. Retention-policy finding',
  'H. Security and RLS design',
  'I. Service factory and interface',
  'J. Gate-before-database proof',
  'K. Input validation and forbidden fields',
  'L. Query and transaction behaviour',
  'M. Domain error mapping',
  'N. I7 adapter integration',
  'O. Migration non-execution boundary',
  'P. Rollback design',
  'Q. Resource and storage estimate',
  'R. Test matrix and results',
  'S. Prohibited work (deferred)',
  'T. FUTURE_SECURITY_NOTE',
  'U. Definition of Done',
  'V. Inspection decision'
];

const PHYSICAL_COLUMNS = [
  'evidence_id',
  'intake_id',
  'fip_id',
  'fip_schema_version',
  'fip_validation_hash',
  'scout_fixture_id',
  'fixture_uid',
  'scout_run_id',
  'received_at',
  'validated_at',
  'outcome',
  'rejection_code',
  'governed_mode',
  'caller_identity_ref',
  'idempotency_key',
  'recorded_at',
  'purge_eligible_at'
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

test('UI3-I8 packet records PASS WITH CORRECTION and blocked gates', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /SEM-GOV-001D-UI3-I8/);
  assert.match(packet, /e99ee91cdaa90a9086373ebbeda849134130eee7/);
  assert.match(packet, /\*\*PASS WITH CORRECTION\*\*/);
  assert.match(packet, /scout_edge_marriage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /supabase_storage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /unified_lifecycle_governor.*\*\*BLOCKED\*\*/);
  for (const section of REQUIRED_SECTIONS) {
    assert.ok(packet.includes(section), `missing section ${section}`);
  }
});

test('factual schema count is 17 physical columns', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /17 physical columns/);
  assert.equal(PHYSICAL_COLUMNS.length, 17);
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  for (const col of PHYSICAL_COLUMNS) {
    assert.match(sql, new RegExp(`\\b${col}\\b`));
  }
});

test('authorized implementation files exist; prohibited services unmodified scope', () => {
  for (const rel of [
    'supabase/migrations/20261011000001_sem_gov_001d_ui3_i8_fip_intake_evidence.sql',
    'backend/services/fipIntakeEvidenceService.js',
    'tests/fip-intake-evidence-service.test.js',
    'control-center/SEM-GOV-001D-UI3-I8_DURABLE_INTAKE_EVIDENCE_STORAGE_IMPLEMENTATION_PACKET.v1.md',
    'tests/sem-gov-001d-ui3-i8-implementation-packet.test.js'
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `missing ${rel}`);
  }

  const intake = fs.readFileSync(path.join(ROOT, 'backend/services/fipIntakeService.js'), 'utf8');
  const d3 = fs.readFileSync(
    path.join(ROOT, 'backend/services/fixtureDisplayMetadataPersistenceService.js'),
    'utf8'
  );
  const lifecycle = fs.readFileSync(
    path.join(ROOT, 'backend/services/lifecyclePersistenceService.js'),
    'utf8'
  );
  assert.match(intake, /createFipIntakeService|computeIdempotencyKey/);
  assert.match(d3, /createFixtureDisplayMetadataPersistenceService/);
  assert.match(lifecycle, /createLifecyclePersistenceService/);
  assert.doesNotMatch(fs.readFileSync(SERVICE_PATH, 'utf8'), /aiPipeline/);
});

test('migration not applied; retention sealed from EST-001', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /NOT APPLIED/i);
  assert.match(packet, /90 days/);
  assert.match(packet, /365 days/);
  assert.match(packet, /fip_intake_evidence/);
  assert.match(packet, /no foreign key/i);
});

test('ledger registers UI3-I8 task', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const task = ledger.tasks.find((entry) => entry.task_id === 'SEM-GOV-001D-UI3-I8');
  assert.ok(task, 'missing SEM-GOV-001D-UI3-I8 ledger task');
  assert.equal(task.status, 'TESTED');
  assert.ok(task.blocked_by.includes('SEM-GOV-001D-UI3-I7'));
});

test('project register includes UI3-I8', () => {
  const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
  const project = register.projects.find((entry) => entry.project_id === 'SEM-GOV-001D-UI3-I8');
  assert.ok(project, 'missing SEM-GOV-001D-UI3-I8 project');
  assert.equal(project.current_status, 'TESTED');
});

test('adapter includes durable evidence envelope unwrap', () => {
  const adapter = fs.readFileSync(
    path.join(ROOT, 'backend/services/governedFipIntakeAdapter.js'),
    'utf8'
  );
  assert.match(adapter, /invokeEvidenceRecorder/);
  assert.doesNotMatch(adapter, /createFipIntakeEvidenceService/);
  assert.doesNotMatch(adapter, /require\(['"]\.\/db/);
});
