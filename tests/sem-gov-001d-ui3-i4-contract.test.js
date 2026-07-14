'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PACKET_PATH = path.join(
  ROOT,
  'control-center/SEM-GOV-001D-UI3-I4_SOURCE_B_SCHEMA_AND_PERSISTENCE_IMPLEMENTATION_DESIGN.v1.md'
);

const REQUIRED_SECTIONS = [
  'A. Authority and start point',
  'B. Inspection evidence',
  'C. Scope',
  'D. Exact proposed table schema',
  'E. Column classification',
  'F. Foreign-key and deletion law',
  'G. Idempotent upsert and stale-update law',
  'H. EFI-001 intake boundary',
  'I. Retention and purge timestamp law',
  'J. RLS and security design',
  'K. Persistence-service interface design',
  'L. Transaction sequence',
  'M. Domain error contract',
  'N. Resource and query limits',
  'O. Migration and rollback sequence',
  'P. Implementation file plan',
  'Q. Test matrix',
  'R. Prohibited work in UI3-I4',
  'S. Deferred work',
  'T. Definition of Done'
];

const SCHEMA_COLUMNS = [
  'fixture_uid UUID PRIMARY KEY',
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
  'metadata_fresh_at',
  'lifecycle_closed_at',
  'purge_eligible_at'
];

const FORBIDDEN_RUNTIME_FILES = [
  'supabase/migrations/20261010000001_sem_gov_001d_ui3_i4_fixture_display_metadata.sql',
  'backend/services/fixtureDisplayMetadataPersistenceService.js',
  'backend/services/fixtureDisplayMetadataService.js'
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

test('UI3-I4 packet records PASS WITH CORRECTION and blocked gates', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /SEM-GOV-001D-UI3-I4/);
  assert.match(packet, /1aca21fb95ed60dd6a767ad7b7ea9ce581be6458/);
  assert.match(packet, /\*\*PASS WITH CORRECTION\*\*/);
  assert.match(packet, /fixture_display_metadata/);
  assert.match(packet, /scout_edge_marriage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /supabase_storage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /unified_lifecycle_governor.*\*\*BLOCKED\*\*/);
  for (const section of REQUIRED_SECTIONS) {
    assert.ok(packet.includes(section), `missing section ${section}`);
  }
});

test('proposed schema seals FK CASCADE, checks, indexes, and RLS', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /ON DELETE CASCADE/i);
  assert.match(packet, /REFERENCES public\.fixture_lifecycle_current/i);
  assert.match(packet, /CHECK \(sport = 'football'\)/);
  assert.match(packet, /CHECK \(timezone = 'Africa\/Johannesburg'\)/);
  assert.match(packet, /purge_eligible_at >= lifecycle_closed_at/);
  assert.match(packet, /idx_fixture_display_metadata_purge/);
  assert.match(packet, /idx_fixture_display_metadata_kickoff/);
  assert.match(packet, /ENABLE ROW LEVEL SECURITY/);
  for (const col of SCHEMA_COLUMNS) {
    assert.match(packet, new RegExp(col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('idempotency and stale-update law aligned with EFI-001', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /SHA-256\(fip_id.*fip_validation_hash.*fip_schema_version\)/);
  assert.match(packet, /DISPLAY_METADATA_STALE_UPDATE/);
  assert.match(packet, /NO_OP/);
  assert.match(packet, /fip_body/);
  assert.match(packet, /raw_json/);
  assert.match(packet, /no append-only metadata history/i);
});

test('retention sync law: closed plus 30 days; lifecycle migration not applied', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /lifecycle_closed_at.*archive_closed_at|archive_closed_at.*lifecycle_closed_at/i);
  assert.match(packet, /30 days/);
  assert.match(packet, /NOT APPLIED/);
  assert.match(packet, /NOT CREATED/);
  assert.match(packet, /NOT IMPLEMENTED/);
});

test('persistence service interface mirrors lifecycle gate-before-DB pattern', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /createFixtureDisplayMetadataPersistenceService/);
  assert.match(packet, /upsertFromValidatedIntake/);
  assert.match(packet, /synchronizeRetentionFromLifecycle/);
  assert.match(packet, /evaluatePreDbGate|gate-before-database|Gate-before-database/i);
});

test('I4 design packet boundary preserved; I5 migration authored not applied', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /NOT CREATED|NOT IMPLEMENTED/);
  const migrationPath = path.join(
    ROOT,
    'supabase/migrations/20261010000001_sem_gov_001d_ui3_i4_fixture_display_metadata.sql'
  );
  if (fs.existsSync(migrationPath)) {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    assert.match(sql, /NOT APPLIED/i);
  }
  assert.ok(
    fs.existsSync(path.join(ROOT, 'backend/services/fixtureDisplayMetadataPersistenceService.js'))
  );
});

test('ledger and project register mirror SEM-GOV-001D-UI3-I4', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const task = ledger.tasks.find((t) => t.task_id === 'SEM-GOV-001D-UI3-I4');
  assert.ok(task, 'SEM-GOV-001D-UI3-I4 task missing');
  assert.match(task.status, /TESTED|PROPOSED|APPROVED/i);
  assert.equal(ledger.scout_edge_marriage_gate, 'BLOCKED');
  assert.equal(ledger.supabase_storage_gate, 'BLOCKED');
  assert.equal(ledger.unified_lifecycle_governor, 'BLOCKED');

  const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
  const project = register.projects.find((p) => p.project_id === 'SEM-GOV-001D-UI3-I4');
  assert.ok(project);
  assert.match(project.current_status, /TESTED|PROPOSED|APPROVED/i);
});
