'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PACKET_PATH = path.join(
  ROOT,
  'control-center/SEM-GOV-001D-UI3-I9_PRODUCTION_COMPOSITION_AND_M2M_AUTH_FOUNDATION_PACKET.v1.md'
);

const REQUIRED_SECTIONS = [
  'A. Authority and start HEAD',
  'B. Inspection findings',
  'C. Files implemented',
  'D. M2M authentication design',
  'E. Composition design',
  'F. Fail-closed behaviour',
  'G. Compatibility corrections',
  'H. Migration and network boundary',
  'I. Test matrix and results',
  'J. Prohibited work (deferred)',
  'K. FUTURE_SECURITY_NOTE',
  'L. Definition of Done',
  'M. Inspection decision'
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

test('UI3-I9 packet records PASS and blocked gates', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /SEM-GOV-001D-UI3-I9/);
  assert.match(packet, /c072d34a7151ce473d27e218f665bded574749f5/);
  assert.match(packet, /\*\*PASS\*\*/);
  assert.match(packet, /scout_edge_marriage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /supabase_storage_gate.*\*\*BLOCKED\*\*/);
  assert.match(packet, /unified_lifecycle_governor.*\*\*BLOCKED\*\*/);
  for (const section of REQUIRED_SECTIONS) {
    assert.ok(packet.includes(section), `missing section ${section}`);
  }
});

test('authorized implementation files exist; adapter unchanged scope', () => {
  for (const rel of [
    'backend/services/fipIntakeM2MAuthenticator.js',
    'backend/services/governedFipIntakeComposition.js',
    'tests/fip-intake-m2m-authenticator.test.js',
    'tests/governed-fip-intake-composition.test.js'
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `missing ${rel}`);
  }

  const composition = fs.readFileSync(
    path.join(ROOT, 'backend/services/governedFipIntakeComposition.js'),
    'utf8'
  );
  const authenticator = fs.readFileSync(
    path.join(ROOT, 'backend/services/fipIntakeM2MAuthenticator.js'),
    'utf8'
  );

  assert.match(composition, /createGovernedFipIntakeComposition/);
  assert.match(composition, /createEst001RetentionPolicy/);
  assert.match(composition, /productionRouteMounted: false/);
  assert.doesNotMatch(composition, /process\.env/);
  assert.doesNotMatch(composition, /aiPipeline/);
  assert.doesNotMatch(authenticator, /process\.env/);
});

test('no route, secret, or network boundary preserved in packet', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /No HTTP route/i);
  assert.match(packet, /No secrets committed/i);
  assert.match(packet, /feature flag defaults disabled/i);
  assert.match(packet, /NOT APPLIED/i);
});

test('ledger registers UI3-I9 task', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const task = ledger.tasks.find((entry) => entry.task_id === 'SEM-GOV-001D-UI3-I9');
  assert.ok(task, 'missing SEM-GOV-001D-UI3-I9 ledger task');
  assert.equal(task.status, 'TESTED');
  assert.ok(task.blocked_by.includes('SEM-GOV-001D-UI3-I8'));
});

test('project register includes UI3-I9', () => {
  const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
  const project = register.projects.find((entry) => entry.project_id === 'SEM-GOV-001D-UI3-I9');
  assert.ok(project, 'missing SEM-GOV-001D-UI3-I9 project');
  assert.equal(project.current_status, 'TESTED');
});
