'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONTRACT_PATH = path.join(
  ROOT,
  'control-center',
  'EPRV-001_EXTERNAL_PROVIDER_REMOVAL_INSPECTION_CONTRACT.v1.md'
);

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

const inspectedSurfaces = [
  'backend/server-express.js',
  'backend/services/dataProvider.js',
  'backend/services/dataProviders.js',
  'backend/services/contextIngestionService.js',
  'backend/services/contextEnrichmentService.js',
  'backend/services/footballHighlightsService.js',
  'backend/services/oddsApiPipeline.js',
  'backend/services/skcsHeartbeat.js',
  'backend/services/hybridSportsDataService.js',
  'backend/utils/rapidApiWaterfall.js',
  'backend/apiClients.js',
  'backend/services/aiPipeline.js',
  'scripts/import-today-snapshot-pipeline.js'
];

test('EPRV-001-C1 contract exists and keeps provider removal partial', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');

  assert.match(contract, /EPRV-001 — External Sports Provider Removal Inspection Contract v1/);
  assert.ok(contract.includes('| **EPRV task state after packet** | **PARTIAL** |'));
  assert.ok(contract.includes('| **Scout ↔ Edge marriage gate** | **BLOCKED** (unchanged) |'));
  assert.ok(contract.includes('| **Supabase storage gate** | **BLOCKED** (unchanged) |'));
  assert.ok(contract.includes('| **Runtime provider removal** | **FORBIDDEN** in this packet |'));
});

test('contract names every inspected provider acquisition surface', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');

  for (const file of inspectedSurfaces) {
    assert.ok(contract.includes(file), `missing inspected provider surface ${file}`);
    assert.ok(fs.existsSync(path.join(ROOT, file)), `inspected surface missing from repository ${file}`);
  }
});

test('contract records the live prediction acquisition chain', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');

  for (const required of [
    'backend/services/aiPipeline.js',
    'getPredictionInputs',
    'backend/services/dataProvider.js',
    'buildLiveData',
    'external sports-provider acquisition/fallback chain'
  ]) {
    assert.ok(contract.includes(required), `missing live acquisition chain evidence: ${required}`);
  }
});

test('contract records provider and context markers without authorizing removal', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');

  for (const required of [
    'TheSportsDB',
    'API-Sports',
    'Odds API',
    'RapidAPI',
    'SportsData.io',
    'CricketData',
    'Big Balls Data',
    'SportSRC',
    'ESPN Hidden API',
    'FootballData.org',
    'weather',
    'injury',
    'H2H',
    'team-news'
  ]) {
    assert.ok(contract.includes(required), `missing provider/context marker: ${required}`);
  }
});

test('contract forbids runtime edits, provider deletion, SQL, Supabase, E2E, and gate clearance', () => {
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');

  for (const forbidden of [
    'editing `backend/services/dataProvider.js`',
    'editing `backend/services/aiPipeline.js`',
    'deleting provider code',
    'disabling provider code',
    'wiring FIP into runtime prediction execution',
    'SQL execution',
    'Supabase mutation',
    'migration creation',
    'E2E proof',
    'gate clearance',
    'cleanup programme reopening'
  ]) {
    assert.ok(contract.includes(forbidden), `missing forbidden boundary: ${forbidden}`);
  }
});

test('ledger registers EPRV-001-C1 while keeping global gates blocked', () => {
  const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
  const task = ledger.tasks.find((entry) => entry.task_id === 'EPRV-001');

  assert.equal(ledger.scout_edge_marriage_gate, 'BLOCKED');
  assert.equal(ledger.supabase_storage_gate, 'BLOCKED');
  assert.ok(task);
  assert.equal(task.status, 'PARTIAL');
  assert.ok(
    task.related_contracts.includes('EPRV-001_EXTERNAL_PROVIDER_REMOVAL_INSPECTION_CONTRACT.v1')
  );
  assert.ok(
    task.affected_files.includes('control-center/EPRV-001_EXTERNAL_PROVIDER_REMOVAL_INSPECTION_CONTRACT.v1.md')
  );
  assert.match(task.next_action, /separately authorized/i);
});

test('project register mirrors EPRV-001 partial state', () => {
  const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
  const project = register.projects.find((entry) => entry.project_id === 'EPRV-001');

  assert.ok(project);
  assert.equal(project.current_status, 'PARTIAL');
  assert.ok(
    project.related_contracts.includes('EPRV-001_EXTERNAL_PROVIDER_REMOVAL_INSPECTION_CONTRACT.v1')
  );
  assert.ok(project.current_evidence.some((line) => /EPRV-001-C1 sealed/.test(line)));
});

test('package control-center test suite includes EPRV-001-C1 proof', () => {
  const pkg = readJson('package.json');

  assert.equal(
    pkg.scripts['test:eprv-provider-removal-contract'],
    'node --test tests/eprv-provider-removal-contract.test.js'
  );
  assert.ok(
    pkg.scripts['test:control-center'].includes('tests/eprv-provider-removal-contract.test.js')
  );
});
