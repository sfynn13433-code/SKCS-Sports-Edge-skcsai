'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PACKET_PATH = path.join(
  ROOT,
  'control-center/SEM-GOV-001D-UI3-I7_GOVERNED_FIP_INTAKE_ADAPTER_IMPLEMENTATION_PACKET.v1.md'
);

const REQUIRED_SECTIONS = [
  'A. Authority and start HEAD',
  'B. Inspection findings',
  'C. Exact runtime files modified or created',
  'D. Existing-service correction strategy',
  'E. Authoritative FIP shape',
  'F. Compatibility boundary',
  'G. Canonical hash implementation',
  'H. Identity resolver queries and results',
  'I. Lifecycle-parent requirement',
  'J. D3 DTO mapper',
  'K. D3 persistence orchestration',
  'L. EdgeAnalysisEnvelope mapping',
  'M. Intake evidence interface',
  'N. Idempotency law',
  'O. Gate-before-downstream proof',
  'P. Domain errors',
  'Q. Resource limits',
  'R. Test matrix and results',
  'S. No-route / no-network / no-apply boundary',
  'T. Prohibited work (deferred)',
  'U. FUTURE_SECURITY_NOTE',
  'V. Definition of Done',
  'W. Inspection decision'
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

test('UI3-I7 packet records PASS WITH CORRECTION and blocked gates', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /SEM-GOV-001D-UI3-I7/);
  assert.match(packet, /ddf6f8438179b295ba8f826ceb474622e0b38b8c/);
  assert.match(packet, /\*\*PASS WITH CORRECTION\*\*/);
  assert.match(packet, /scout_edge_marriage_gate.*\*\*BLOCKED\*\*/);
  for (const section of REQUIRED_SECTIONS) {
    assert.ok(packet.includes(section), `missing section ${section}`);
  }
});

test('adapter and resolver services exist; persistence service unchanged scope', () => {
  const adapter = fs.readFileSync(
    path.join(ROOT, 'backend/services/governedFipIntakeAdapter.js'),
    'utf8'
  );
  const resolver = fs.readFileSync(
    path.join(ROOT, 'backend/services/fixtureIdentityResolverService.js'),
    'utf8'
  );
  const intake = fs.readFileSync(
    path.join(ROOT, 'backend/services/fipIntakeService.js'),
    'utf8'
  );
  const d3 = fs.readFileSync(
    path.join(ROOT, 'backend/services/fixtureDisplayMetadataPersistenceService.js'),
    'utf8'
  );
  assert.match(adapter, /createGovernedFipIntakeAdapter/);
  assert.match(adapter, /receiveValidatedFip/);
  assert.doesNotMatch(adapter, /aiPipeline/);
  assert.match(resolver, /scout_fixture_id/);
  assert.match(resolver, /fixture_identity_aliases/);
  assert.match(intake, /validation\.hash_algorithm/);
  assert.match(intake, /normalizeLegacyProofFip/);
  assert.match(intake, /mapValidatedFipToD3Dto/);
  assert.match(d3, /createFixtureDisplayMetadataPersistenceService/);
});

test('no HTTP route and migrations remain not applied narrative', () => {
  const packet = fs.readFileSync(PACKET_PATH, 'utf8');
  assert.match(packet, /No HTTP route added/);
  assert.match(packet, /NOT APPLIED/);
  const routesDir = path.join(ROOT, 'backend/routes');
  const routeText = fs
    .readdirSync(routesDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path.join(routesDir, f), 'utf8'))
    .join('\n');
  assert.doesNotMatch(routeText, /governedFipIntakeAdapter/);
});

test('ledger and project register mirror SEM-GOV-001D-UI3-I7', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const task = ledger.tasks.find((t) => t.task_id === 'SEM-GOV-001D-UI3-I7');
  assert.ok(task, 'SEM-GOV-001D-UI3-I7 task missing');
  assert.match(task.status, /TESTED|PROPOSED|APPROVED/i);
  assert.equal(ledger.scout_edge_marriage_gate, 'BLOCKED');

  const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
  const project = register.projects.find((p) => p.project_id === 'SEM-GOV-001D-UI3-I7');
  assert.ok(project);
});
