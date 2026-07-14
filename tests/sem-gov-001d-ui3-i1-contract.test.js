'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PACKET_PATH = path.join(
  ROOT,
  'control-center/SEM-GOV-001D-UI3-I1_LIFECYCLE_READ_MODEL_API_INSPECTION_AND_CONTRACT.v1.md'
);
const SERVER_PATH = path.join(ROOT, 'backend/server-express.js');

const REQUIRED_SECTIONS = [
  'A. Authority and inspection result',
  'B. Start point',
  'C. Scope',
  'D. Controlling contracts',
  'E. Read-only inspection findings',
  'F. Blocker registry',
  'G. Sealed public API contract',
  'H. Two-source read-model law',
  'I. Prohibited sources and fallbacks',
  'J. Prohibited exposure fields',
  'K. Service-unavailable contract',
  'L. Deferred work',
  'M. Prohibited work in UI3-I1',
  'N. Definition of Done'
];

const PROHIBITED_PUBLIC_FIELDS = [
  'fixture_uid',
  'scout_fip_id',
  'scout_validation_hash',
  'engine_stage',
  'transition_version',
  'reason_detail_safe'
];

const PROHIBITED_SOURCES = [
  'raw_fixtures',
  'predictions',
  'provider tables',
  'sports-match-hub-mock-data',
  'Direct Scout',
  'mock fallback'
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

test('UI3-I1 packet exists with PASS WITH BLOCKER and blocked gates', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /SEM-GOV-001D-UI3-I1/);
  assert.match(packet, /4d0404d27ef38b0fc895165e4b00600a8b105458/);
  assert.match(packet, /\*\*PASS WITH BLOCKER\*\*/);
  assert.match(packet, /scout_edge_marriage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /supabase_storage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /unified_lifecycle_governor.*\*\*BLOCKED\*\*/);
  assert.match(packet, /NOT APPLIED/i);
  for (const section of REQUIRED_SECTIONS) {
    assert.ok(packet.includes(section), `missing section ${section}`);
  }
});

test('UI3 and UI4 implementation remain NOT STARTED or BLOCKED', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /UI3.*NOT STARTED/i);
  assert.match(packet, /UI3.*BLOCKED/i);
  assert.match(packet, /UI4.*NOT STARTED/i);
  assert.match(packet, /Production UI3 implementation.*BLOCKED/i);
});

test('both lifecycle endpoint paths are documented', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /GET \/api\/lifecycle\/fixtures/);
  assert.match(packet, /GET \/api\/lifecycle\/fixtures\/\{opaque_public_id\}/);
});

test('two-source read-model requirement is documented', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /Source A/i);
  assert.match(packet, /Source B/i);
  assert.match(packet, /governed lifecycle projection/i);
  assert.match(packet, /canonical fixture metadata projection/i);
  assert.match(packet, /fixture_uid/);
});

test('unsafe fallback sources are prohibited', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  for (const source of PROHIBITED_SOURCES) {
    assert.match(packet, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  assert.match(packet, /service-unavailable/i);
  assert.match(packet, /without querying unsafe fallback sources/i);
});

test('all internal prohibited fields are documented', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  for (const field of PROHIBITED_PUBLIC_FIELDS) {
    assert.match(packet, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(packet, /DO NOT EXPOSE|must \*\*never\*\* appear|Prohibited exposure/i);
});

test('no backend lifecycle route or read-model service implementation exists', () => {
  const server = fs.readFileSync(SERVER_PATH, 'utf8');
  assert.doesNotMatch(server, /\/api\/lifecycle/);
  const routesDir = path.join(ROOT, 'backend/routes');
  const routeFiles = fs.readdirSync(routesDir);
  for (const file of routeFiles) {
    const filePath = path.join(routesDir, file);
    if (!fs.statSync(filePath).isFile()) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    assert.doesNotMatch(content, /\/api\/lifecycle/);
  }
  const readModelCandidates = [
    'backend/services/lifecycleReadModelService.js',
    'backend/services/lifecycleReadModel.js',
    'backend/services/lifecycleFixtureReadService.js'
  ];
  for (const rel of readModelCandidates) {
    assert.ok(!fs.existsSync(path.join(ROOT, rel)), `unexpected read-model service ${rel}`);
  }
});

test('ledger registers SEM-GOV-001D-UI3-I1 with blocked gates', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const task = ledger.tasks.find((t) => t.task_id === 'SEM-GOV-001D-UI3-I1');
  assert.ok(task, 'SEM-GOV-001D-UI3-I1 task missing');
  assert.match(task.status, /PASS_WITH_BLOCKER|PASS WITH BLOCKER|PROPOSED|TESTED/i);
  assert.equal(ledger.scout_edge_marriage_gate, 'BLOCKED');
  assert.equal(ledger.supabase_storage_gate, 'BLOCKED');
  assert.equal(ledger.unified_lifecycle_governor, 'BLOCKED');
});

test('project register mirrors SEM-GOV-001D-UI3-I1', () => {
  const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
  const project = register.projects.find((p) => p.project_id === 'SEM-GOV-001D-UI3-I1');
  assert.ok(project);
  assert.match(project.current_status, /PASS_WITH_BLOCKER|PASS WITH BLOCKER|PROPOSED|TESTED/i);
});
