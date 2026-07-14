'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PACKET_PATH = path.join(
  ROOT,
  'control-center/SEM-GOV-001D-UI3-I2_CANONICAL_FIXTURE_METADATA_PROJECTION_INSPECTION_AND_CONTRACT.v1.md'
);

const REQUIRED_SECTIONS = [
  'A. Authority and inspection result',
  'B. Start point',
  'C. Scope',
  'D. Controlling contracts',
  'E. Read-only inspection findings',
  'F. Blocker registry',
  'G. Sealed recommended future projection fields',
  'H. Logo and emblem law',
  'I. Contract law — Source A and Source B',
  'J. EST-001 authorization blocker',
  'K. Service-unavailable and missing-projection law',
  'L. Deferred work',
  'M. Prohibited work in UI3-I2',
  'N. Definition of Done'
];

const INTERNAL_FIELDS = [
  'fixture_uid',
  'scout_fixture_id',
  'home_team_scout_id',
  'away_team_scout_id'
];

const DISPLAY_FIELDS = [
  'sport',
  'competition_id',
  'competition_name',
  'kickoff_at',
  'timezone',
  'home_team_name',
  'away_team_name',
  'metadata_fresh_at'
];

const PROHIBITED_FIELDS = [
  'full FIP body',
  'raw_json',
  'raw provider payload',
  'odds',
  'H2H',
  'injuries',
  'weather',
  'lineups',
  'validation hashes',
  'independent Edge logo acquisition'
];

const FORBIDDEN_RUNTIME_FILES = [
  'backend/services/fixtureMetadataProjectionService.js',
  'backend/services/canonicalFixtureMetadataService.js',
  'supabase/migrations/20261009000001_fixture_display_metadata.sql'
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

test('UI3-I2 packet exists with PASS WITH BLOCKER and blocked gates', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /SEM-GOV-001D-UI3-I2/);
  assert.match(packet, /0e9d578b423d89c46bad3a4bbc78faac86aa776e/);
  assert.match(packet, /\*\*PASS WITH BLOCKER\*\*/);
  assert.match(packet, /NEW GOVERNED METADATA PROJECTION REQUIRED/i);
  assert.match(packet, /scout_edge_marriage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /supabase_storage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /unified_lifecycle_governor.*\*\*BLOCKED\*\*/);
  assert.match(packet, /NOT APPLIED/i);
  for (const section of REQUIRED_SECTIONS) {
    assert.ok(packet.includes(section), `missing section ${section}`);
  }
});

test('raw_fixtures is explicitly rejected as canonical Source B', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /raw_fixtures.*REJECTED|REJECTED.*raw_fixtures/i);
  assert.match(packet, /not approved canonical metadata authority/i);
  assert.match(packet, /raw provider payloads/i);
  assert.match(packet, /provider ingestion/i);
});

test('Scout FIP is named canonical fixture metadata authority', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /FIP-001/);
  assert.match(packet, /Scout FIP/i);
  assert.match(packet, /fixture identity/i);
  assert.match(packet, /league/i);
  assert.match(packet, /kickoff/i);
  assert.match(packet, /home team/i);
  assert.match(packet, /away team/i);
});

test('new bounded metadata projection requirement is sealed', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /bounded fixture-display metadata projection/i);
  assert.match(packet, /fixture_uid.*canonical metadata projection.*NOT PROVEN|NOT PROVEN.*fixture_uid/i);
  assert.match(packet, /Source B/i);
  assert.match(packet, /EFI-001/);
});

test('exact allowed and prohibited fields are documented', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  for (const field of INTERNAL_FIELDS) {
    assert.match(packet, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const field of DISPLAY_FIELDS) {
    assert.match(packet, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const field of PROHIBITED_FIELDS) {
    assert.match(packet, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  assert.match(packet, /venue/i);
  assert.match(packet, /country/i);
  assert.match(packet, /home_team_emblem_ref/i);
  assert.match(packet, /away_team_emblem_ref/i);
});

test('logo ownership remains Scout; Edge placement only', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /Scout.*emblem|emblem.*Scout/i);
  assert.match(packet, /Edge may.*map.*emblem|map optional Scout-governed emblem/i);
  assert.match(packet, /Edge must not.*independently acquire|must not.*independently acquire.*logo/i);
  assert.match(packet, /Missing optional emblem.*must not.*invalidate/i);
});

test('EST-001 authorization blocker is recorded', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /EST-001/);
  assert.match(packet, /does \*\*not\*\* yet explicitly authorize/i);
  assert.match(packet, /separate storage-policy/i);
  assert.match(packet, /full FIP must not be permanently copied/i);
});

test('UI3 and UI4 remain blocked or not started; migration not applied', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /UI3.*NOT STARTED|Production UI3.*BLOCKED/i);
  assert.match(packet, /UI4.*NOT STARTED/i);
  assert.match(packet, /predictions.*PROHIBITED|PROHIBITED.*predictions/i);
  assert.match(packet, /mock.*PROHIBITED|PROHIBITED.*mock/i);
  assert.match(packet, /public_fixture_id.*BLOCKED/i);
});

test('no runtime, frontend or migration files are added', () => {
  for (const rel of FORBIDDEN_RUNTIME_FILES) {
    assert.ok(!fs.existsSync(path.join(ROOT, rel)), `unexpected runtime file ${rel}`);
  }
  const packetMtime = fs.statSync(PACKET_PATH).mtimeMs;
  const publicDir = path.join(ROOT, 'public');
  const supabaseMigrations = path.join(ROOT, 'supabase/migrations');
  assert.ok(fs.existsSync(publicDir));
  assert.ok(fs.existsSync(supabaseMigrations));
  const migrationFiles = fs.readdirSync(supabaseMigrations);
  assert.doesNotMatch(
    migrationFiles.join('\n'),
    /fixture_display_metadata|fixture_metadata_projection/i
  );
});

test('ledger registers SEM-GOV-001D-UI3-I2 with blocked gates', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const task = ledger.tasks.find((t) => t.task_id === 'SEM-GOV-001D-UI3-I2');
  assert.ok(task, 'SEM-GOV-001D-UI3-I2 task missing');
  assert.match(task.status, /TESTED|PROPOSED|APPROVED/i);
  assert.equal(ledger.scout_edge_marriage_gate, 'BLOCKED');
  assert.equal(ledger.supabase_storage_gate, 'BLOCKED');
  assert.equal(ledger.unified_lifecycle_governor, 'BLOCKED');
});

test('project register mirrors SEM-GOV-001D-UI3-I2', () => {
  const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
  const project = register.projects.find((p) => p.project_id === 'SEM-GOV-001D-UI3-I2');
  assert.ok(project);
  assert.match(project.current_status, /TESTED|PROPOSED|APPROVED/i);
});
