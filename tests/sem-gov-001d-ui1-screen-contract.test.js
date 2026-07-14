'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PACKET_PATH = path.join(
  ROOT,
  'control-center/SEM-GOV-001D-UI1_SPORTS_MATCH_HUB_INFORMATION_ARCHITECTURE_AND_SCREEN_CONTRACT.v1.md'
);

const REQUIRED_SECTIONS = [
  'A. Authority and status',
  'B. Start point',
  'C. Scope',
  'D. Controlling contracts',
  'E. Current UI baseline',
  'F. Page disposition map',
  'G. Canonical navigation',
  'H. Home screen contract',
  'I. Sports Match Hub screen contract',
  'J. Fixture detail contract',
  'K. History contract',
  'L. Help and How It Works contract',
  'M. System unavailable contract',
  'N. Day-navigation contract',
  'O. Lifecycle-state language',
  'P. Lifecycle-stage language',
  'Q. Fixture-card contract',
  'R. Filter and search contract',
  'S. UI-state contract',
  'T. API read-model contract',
  'U. Responsive-design contract',
  'V. Accessibility contract',
  'W. Visual direction',
  'X. Trust, safety and product-language rules',
  'Y. Implementation sequence, prohibited work and Definition of Done'
];

const CANONICAL_DAY_TOKENS = [
  'TODAY',
  'DAY_2',
  'DAY_3',
  'DAY_4',
  'DAY_5',
  'DAY_6',
  'DAY_7',
  'DAY_8'
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

test('UI1 packet exists with PROPOSED status and blocked gates', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /SEM-GOV-001D-UI1/);
  assert.match(packet, /2d4c6a3df20dc0d6575d72b7713232933dff51f5/);
  assert.match(packet, /\*\*PROPOSED\*\*/);
  assert.match(packet, /scout_edge_marriage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /supabase_storage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /unified_lifecycle_governor.*\*\*BLOCKED\*\*/);
  assert.match(packet, /NOT APPLIED/i);
  for (const section of REQUIRED_SECTIONS) {
    assert.ok(packet.includes(section), `missing section ${section}`);
  }
});

test('canonical navigation and lifecycle mappings are present', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /Sports Match Hub/);
  assert.match(packet, /Match Intelligence/);
  assert.match(packet, /Home/);
  assert.match(packet, /Listed/);
  assert.match(packet, /Under Review/);
  assert.match(packet, /Review Complete/);
  assert.match(packet, /Not Publishing/);
});

test('day-token sequence matches lifecycle authority without DAY_1', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.doesNotMatch(packet, /\bDAY_1\b/);
  for (const token of CANONICAL_DAY_TOKENS) {
    assert.match(packet, new RegExp(`\`${token}\``));
  }
  assert.match(packet, /Africa\/Johannesburg/);
  assert.match(packet, /Tomorrow/);
  assert.match(packet, /lifecycleGovernor\.js/);
});

test('fixture_uid is internal and trust language prohibits guarantees', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /fixture_uid/);
  assert.match(packet, /DO NOT EXPOSE|Prohibited/i);
  assert.match(packet, /no guarantee|not guaranteed/i);
  assert.doesNotMatch(packet, /sure win/i);
});

test('UI2 UI3 UI4 are not activated', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /UI2.*NOT STARTED/i);
  assert.match(packet, /UI3.*NOT STARTED/i);
  assert.match(packet, /UI4.*NOT STARTED/i);
  assert.match(packet, /no live API|design only/i);
});

test('ledger registers SEM-GOV-001D-UI1 with blocked gates', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const task = ledger.tasks.find((t) => t.task_id === 'SEM-GOV-001D-UI1');
  assert.ok(task, 'SEM-GOV-001D-UI1 task missing');
  assert.equal(ledger.scout_edge_marriage_gate, 'BLOCKED');
  assert.equal(ledger.supabase_storage_gate, 'BLOCKED');
  assert.equal(ledger.unified_lifecycle_governor, 'BLOCKED');
});

test('project register mirrors SEM-GOV-001D-UI1', () => {
  const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
  const project = register.projects.find((p) => p.project_id === 'SEM-GOV-001D-UI1');
  assert.ok(project);
  assert.equal(project.current_status, 'PROPOSED');
});

test('UI1 does not list frontend implementation files as in-scope changes', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.doesNotMatch(packet, /modified.*public\/index\.html/i);
  assert.match(packet, /prediction-centric/);
  assert.match(packet, /no production UI mutation/i);
});
