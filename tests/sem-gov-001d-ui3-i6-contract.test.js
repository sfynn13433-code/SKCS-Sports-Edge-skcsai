'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PACKET_PATH = path.join(
  ROOT,
  'control-center/SEM-GOV-001D-UI3-I6_EFI_001_GOVERNED_INTAKE_INSPECTION_AND_ADAPTER_CONTRACT.v1.md'
);

const REQUIRED_SECTIONS = [
  'A. Authority and start point',
  'B. Exact inspection scope',
  'C. Current runtime findings',
  'D. `fipIntakeService` classification',
  'E. Callers and route map',
  'F. Accepted FIP source and forbidden sources',
  'G. Canonical hash verification findings',
  'H. Schema-version law',
  'I. Authentication and authorization design',
  'J. Identity-resolution law',
  'K. Lifecycle-before-D3 ordering',
  'L. FIP-to-D3 DTO crosswalk',
  'M. FIP-to-EdgeAnalysisEnvelope crosswalk status',
  'N. Idempotency, replay and retry law',
  'O. Intake evidence design',
  'P. Domain error contract',
  'Q. Resource limits',
  'R. Fail-closed behaviour',
  'S. Prohibited surfaces',
  'T. Implementation file plan',
  'U. Test matrix',
  'V. Blockers and deferred work',
  'W. Definition of Done',
  'X. Inspection decision'
];

const DTO_FIELDS = [
  'fixtureUid',
  'scoutFixtureId',
  'fipId',
  'fipValidationHash',
  'intakeId',
  'homeTeamScoutId',
  'awayTeamScoutId',
  'competitionId',
  'competitionName',
  'kickoffAt',
  'metadataFreshAt',
  'idempotencyKey'
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

test('UI3-I6 packet records PASS WITH BLOCKER and blocked gates', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /SEM-GOV-001D-UI3-I6/);
  assert.match(packet, /f905e7b9c8564f21a2d46b514dbf495e2e29c3e2/);
  assert.match(packet, /\*\*PASS WITH BLOCKER\*\*/);
  assert.match(packet, /scout_edge_marriage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /supabase_storage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /unified_lifecycle_governor.*\*\*BLOCKED\*\*/);
  for (const section of REQUIRED_SECTIONS) {
    assert.ok(packet.includes(section), `missing section ${section}`);
  }
});

test('fipIntakeService classified partial proof-only; hash law proven', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /PARTIAL.*PROOF-ONLY ISOLATED FOUNDATION/i);
  assert.match(packet, /Hash law: PROVEN/i);
  assert.match(packet, /stableClone/);
  assert.match(packet, /SHA-256\(fip_id.*validation\.hash.*fip_schema_version\)/i);
  const service = fs.readFileSync(
    path.join(ROOT, 'backend/services/fipIntakeService.js'),
    'utf8'
  );
  assert.match(service, /receiveValidatedFip/);
  assert.match(service, /computeFipHash/);
});

test('no FIP intake route; buildLiveData still forbidden origin', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /No FIP intake HTTP route/i);
  assert.match(packet, /buildLiveData/);
  const routesDir = path.join(ROOT, 'backend/routes');
  const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith('.js'));
  const routeText = routeFiles
    .map((f) => fs.readFileSync(path.join(routesDir, f), 'utf8'))
    .join('\n');
  assert.doesNotMatch(routeText, /receiveValidatedFip/);
  assert.doesNotMatch(routeText, /fipIntake/);
});

test('lifecycle-before-D3 sequence and identity law sealed', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /scout\.fixture_id/);
  assert.match(packet, /fixture_identity_aliases/);
  assert.match(packet, /alias_namespace = 'scout_fixture_id'/);
  assert.match(packet, /Lifecycle-before-D3/i);
  assert.match(packet, /upsertFromValidatedIntake/);
  assert.match(packet, /must complete successfully.*before step 8/i);
  assert.match(packet, /Forbidden.*scout\.fixture_id.*fixture_uid/);
});

test('D3 DTO crosswalk documents all required fields with blockers', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  for (const field of DTO_FIELDS) {
    assert.match(packet, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(packet, /fixtureUid.*BLOCKER/i);
  assert.match(packet, /No full FIP body|PROHIBITED.*D3 boundary/i);
});

test('runtime services unchanged in I6', () => {
  const service = fs.readFileSync(
    path.join(ROOT, 'backend/services/fipIntakeService.js'),
    'utf8'
  );
  assert.match(service, /module\.exports/);
  const d3 = fs.readFileSync(
    path.join(ROOT, 'backend/services/fixtureDisplayMetadataPersistenceService.js'),
    'utf8'
  );
  assert.match(d3, /createFixtureDisplayMetadataPersistenceService/);
});

test('ledger and project register mirror SEM-GOV-001D-UI3-I6', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const task = ledger.tasks.find((t) => t.task_id === 'SEM-GOV-001D-UI3-I6');
  assert.ok(task, 'SEM-GOV-001D-UI3-I6 task missing');
  assert.match(task.status, /TESTED|PROPOSED|APPROVED/i);
  assert.equal(ledger.scout_edge_marriage_gate, 'BLOCKED');
  assert.equal(ledger.supabase_storage_gate, 'BLOCKED');
  assert.equal(ledger.unified_lifecycle_governor, 'BLOCKED');

  const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
  const project = register.projects.find((p) => p.project_id === 'SEM-GOV-001D-UI3-I6');
  assert.ok(project);
  assert.match(project.current_status, /TESTED|PROPOSED|APPROVED/i);
});
