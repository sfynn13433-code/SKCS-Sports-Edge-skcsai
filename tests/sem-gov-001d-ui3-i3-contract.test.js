'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PACKET_PATH = path.join(
  ROOT,
  'control-center/SEM-GOV-001D-UI3-I3_SOURCE_B_STORAGE_POLICY_AND_RETENTION_CONTRACT.v1.md'
);
const EST_PATH = path.join(
  ROOT,
  'control-center/EST-001_SUPABASE_STORAGE_AND_FIP_RETENTION_CONTRACT.v1.md'
);

const REQUIRED_SECTIONS = [
  'A. Authority and policy decision',
  'B. Start point',
  'C. Scope',
  'D. Controlling contracts',
  'E. D3 — DERIVED FIXTURE DISPLAY STATE',
  'F. Retention and purge law',
  'G. Allowed D3 fields',
  'H. Capacity proof',
  'I. Source A and Source B join law',
  'J. EST-001 amendment summary',
  'K. Prohibited work in UI3-I3',
  'L. Definition of Done'
];

const DISPLAY_FIELDS = [
  'sport',
  'competition_id',
  'competition_name',
  'kickoff_at',
  'home_team_name',
  'away_team_name',
  'metadata_fresh_at'
];

const PROHIBITED_ITEMS = [
  'full FIP body',
  'raw_json',
  'provider payload',
  'odds',
  'H2H',
  'injuries',
  'weather',
  'lineups',
  'metadata version history',
  'independent Edge logo acquisition',
  'raw_fixtures'
];

const FORBIDDEN_RUNTIME_FILES = [
  'supabase/migrations/20261010000001_fixture_display_metadata.sql',
  'backend/services/fixtureDisplayMetadataService.js',
  'backend/services/d3PurgeService.js'
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

test('UI3-I3 packet records PASS WITH CORRECTION and blocked gates', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /SEM-GOV-001D-UI3-I3/);
  assert.match(packet, /6c34745ca638045231ba2fa9fc7f4365c07337ca/);
  assert.match(packet, /\*\*PASS WITH CORRECTION\*\*/);
  assert.match(packet, /D3.*DERIVED FIXTURE DISPLAY STATE/i);
  assert.match(packet, /scout_edge_marriage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /supabase_storage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /unified_lifecycle_governor.*\*\*BLOCKED\*\*/);
  for (const section of REQUIRED_SECTIONS) {
    assert.ok(packet.includes(section), `missing section ${section}`);
  }
});

test('EST-001 explicitly recognizes D3', () => {
  const est = fs.readFileSync(EST_PATH, 'utf8');
  assert.match(est, /D3.*DERIVED FIXTURE DISPLAY STATE/i);
  assert.match(est, /fixture_display_metadata/);
  assert.match(est, /SEM-GOV-001D-UI3-I3/);
  assert.match(est, /does not permit a full Scout mirror|not a Scout mirror/i);
});

test('Scout remains canonical authority; one-row upsert law documented', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /Scout remains canonical sports-truth and replay authority/i);
  assert.match(packet, /One row maximum per `fixture_uid`/i);
  assert.match(packet, /Idempotent upsert/i);
  assert.match(packet, /no append-only metadata history/i);
  assert.match(packet, /FIP-001/);
});

test('8-day active plus 30-day closed retention documented; 180-day D3 prohibited', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /eight-day lifecycle window/i);
  assert.match(packet, /30 days.*after lifecycle archive|Maximum \*\*30 days\*\* after lifecycle/i);
  assert.match(packet, /180-day D3 retention.*PROHIBITED|PROHIBITED.*180-day D3/i);
  assert.match(packet, /Indefinite retention.*PROHIBITED|No permanent metadata archive/i);
  const est = fs.readFileSync(EST_PATH, 'utf8');
  assert.match(est, /30 days.*archive\/closure|archive\/closure.*30 days|post-closure.*30 days/i);
});

test('capacity proof preserves at least 20 MB headroom below 380 MB', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /357\.10 MB/);
  assert.match(packet, /359\.50 MB/);
  assert.match(packet, /20\.50 MB/);
  assert.match(packet, /380 MB/);
  assert.match(packet, /1,900|1900/);
  assert.match(packet, /50.*8.*400|400.*active/i);
  assert.match(packet, /50.*30.*1,500|1,500.*closed/i);
  assert.match(packet, /Capacity verdict.*PASS/i);
});

test('exact allowed and prohibited fields are documented', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /fixture_uid/);
  assert.match(packet, /scout_fixture_id/);
  assert.match(packet, /home_team_emblem_ref/);
  assert.match(packet, /purge_eligible_at/);
  for (const field of DISPLAY_FIELDS) {
    assert.match(packet, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const item of PROHIBITED_ITEMS) {
    assert.match(packet, new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
});

test('no runtime apply or unauthorized migration files', () => {
  for (const rel of FORBIDDEN_RUNTIME_FILES) {
    if (rel === 'supabase/migrations/20261010000001_fixture_display_metadata.sql') {
      assert.ok(!fs.existsSync(path.join(ROOT, rel)), `unexpected runtime file ${rel}`);
    }
  }
  const authorizedMigration = path.join(
    ROOT,
    'supabase/migrations/20261010000001_sem_gov_001d_ui3_i4_fixture_display_metadata.sql'
  );
  if (fs.existsSync(authorizedMigration)) {
    const sql = fs.readFileSync(authorizedMigration, 'utf8');
    assert.match(sql, /NOT APPLIED/i);
  }
});

test('UI3 and UI4 remain blocked or not started; migration not applied', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /UI3.*NOT STARTED|UI3.*BLOCKED/i);
  assert.match(packet, /UI4.*NOT STARTED/i);
  assert.match(packet, /NOT APPLIED/i);
  assert.match(packet, /No migration or table creation is authorized/i);
});

test('ledger registers SEM-GOV-001D-UI3-I3 with blocked gates', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const task = ledger.tasks.find((t) => t.task_id === 'SEM-GOV-001D-UI3-I3');
  assert.ok(task, 'SEM-GOV-001D-UI3-I3 task missing');
  assert.match(task.status, /TESTED|PROPOSED|APPROVED/i);
  assert.equal(ledger.scout_edge_marriage_gate, 'BLOCKED');
  assert.equal(ledger.supabase_storage_gate, 'BLOCKED');
  assert.equal(ledger.unified_lifecycle_governor, 'BLOCKED');
});

test('project register mirrors SEM-GOV-001D-UI3-I3', () => {
  const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
  const project = register.projects.find((p) => p.project_id === 'SEM-GOV-001D-UI3-I3');
  assert.ok(project);
  assert.match(project.current_status, /TESTED|PROPOSED|APPROVED/i);
});
