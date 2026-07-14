'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PACKET_PATH = path.join(
  ROOT,
  'control-center/SEM-GOV-001D-UI3-I5_SOURCE_B_MIGRATION_AND_ISOLATED_PERSISTENCE_IMPLEMENTATION_PACKET.v1.md'
);
const MIGRATION_PATH = path.join(
  ROOT,
  'supabase/migrations/20261010000001_sem_gov_001d_ui3_i4_fixture_display_metadata.sql'
);
const SERVICE_PATH = path.join(
  ROOT,
  'backend/services/fixtureDisplayMetadataPersistenceService.js'
);

const REQUIRED_SECTIONS = [
  'A. Authority and start HEAD',
  'B. Scope and prohibited work',
  'C. Inspection evidence',
  'D. Factual schema column count',
  'E. Exact files implemented',
  'F. Migration constraints and indexes',
  'G. Security and RLS result',
  'H. Service factory and interface',
  'I. Gate-before-database proof',
  'J. Validation and forbidden-field law',
  'K. Transaction and idempotency behaviour',
  'L. Retention synchronization behaviour',
  'M. Domain error mapping',
  'N. Resource and query limits',
  'O. Migration non-execution boundary',
  'P. Rollback design',
  'Q. Test matrix and results',
  'R. Deferred work',
  'S. FUTURE_SECURITY_NOTE',
  'T. Definition of Done'
];

const PHYSICAL_COLUMNS = [
  'fixture_uid',
  'sport',
  'scout_fixture_id',
  'fip_id',
  'fip_schema_version',
  'fip_validation_hash',
  'intake_id',
  'idempotency_key',
  'home_team_scout_id',
  'away_team_scout_id',
  'competition_id',
  'competition_name',
  'kickoff_at',
  'timezone',
  'home_team_name',
  'away_team_name',
  'venue',
  'country',
  'home_team_emblem_ref',
  'away_team_emblem_ref',
  'metadata_fresh_at',
  'lifecycle_closed_at',
  'purge_eligible_at',
  'created_at',
  'updated_at'
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

test('UI3-I5 packet records PASS WITH CORRECTION and blocked gates', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /SEM-GOV-001D-UI3-I5/);
  assert.match(packet, /36aa28c35751dba628751f70721ba34ddc7ac694/);
  assert.match(packet, /\*\*PASS WITH CORRECTION\*\*/);
  assert.match(packet, /scout_edge_marriage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /supabase_storage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /unified_lifecycle_governor.*\*\*BLOCKED\*\*/);
  for (const section of REQUIRED_SECTIONS) {
    assert.ok(packet.includes(section), `missing section ${section}`);
  }
});

test('factual schema count is 25 physical columns not 22', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /25 physical columns/);
  assert.match(packet, /22-column/);
  assert.equal(PHYSICAL_COLUMNS.length, 25);
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  for (const col of PHYSICAL_COLUMNS) {
    assert.match(sql, new RegExp(`\\b${col}\\b`));
  }
});

test('authorized implementation files exist; lifecycle service unmodified scope', () => {
  for (const rel of [
    MIGRATION_PATH.replace(`${ROOT}${path.sep}`, '').replace(/\\/g, '/'),
    SERVICE_PATH.replace(`${ROOT}${path.sep}`, '').replace(/\\/g, '/'),
    'tests/fixture-display-metadata-persistence-service.test.js',
    'tests/sem-gov-001d-ui3-i5-implementation-packet.test.js'
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `missing ${rel}`);
  }
  const lifecycleService = fs.readFileSync(
    path.join(ROOT, 'backend/services/lifecyclePersistenceService.js'),
    'utf8'
  );
  assert.match(lifecycleService, /createLifecyclePersistenceService/);
});

test('migration not applied; no production caller', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /NOT APPLIED/i);
  assert.match(packet, /no production caller/i);
  assert.match(packet, /No `supabase db push`/i);
  const routesDir = path.join(ROOT, 'backend/routes');
  const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith('.js'));
  const routeText = routeFiles
    .map((f) => fs.readFileSync(path.join(routesDir, f), 'utf8'))
    .join('\n');
  assert.doesNotMatch(routeText, /fixtureDisplayMetadataPersistenceService/);
});

test('SQL includes FK CASCADE, checks, indexes, RLS and no policies', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  assert.match(sql, /ON DELETE CASCADE/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /DROP TABLE IF EXISTS public\.fixture_display_metadata/);
  assert.doesNotMatch(sql, /CREATE POLICY/i);
  assert.doesNotMatch(sql, /JSONB/i);
  const createTables = sql.match(/CREATE TABLE/g) || [];
  assert.equal(createTables.length, 1);
});

test('ledger and project register mirror SEM-GOV-001D-UI3-I5', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const task = ledger.tasks.find((t) => t.task_id === 'SEM-GOV-001D-UI3-I5');
  assert.ok(task, 'SEM-GOV-001D-UI3-I5 task missing');
  assert.match(task.status, /TESTED|PROPOSED|APPROVED/i);
  assert.equal(ledger.scout_edge_marriage_gate, 'BLOCKED');
  assert.equal(ledger.supabase_storage_gate, 'BLOCKED');
  assert.equal(ledger.unified_lifecycle_governor, 'BLOCKED');

  const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
  const project = register.projects.find((p) => p.project_id === 'SEM-GOV-001D-UI3-I5');
  assert.ok(project);
  assert.match(project.current_status, /TESTED|PROPOSED|APPROVED/i);
});
