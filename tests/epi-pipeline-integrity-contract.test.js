'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const CONTRACT_PATH = path.join(
ROOT,
'control-center',
'EPI-001_PREDICTION_PIPELINE_INTEGRITY_CONTRACT.v1.md'
);
function read(rel) {
return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function readJson(rel) {
return JSON.parse(read(rel));
}
const protectedPipelineFiles = [
'backend/services/aiPipeline.js',
'backend/services/aiScoring.js',
'backend/services/filterEngine.js',
'backend/services/direct1x2Engine.js',
'backend/services/marketIntelligence.js',
'backend/services/accaBuilder.js'
];
test('EPI-001-C1 contract exists and keeps gates blocked', () => {
const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
assert.match(contract, /EPI-001 — Prediction Pipeline Integrity Contract v1/);
assert.match(contract, /Scout ↔ Edge marriage gate\*\* \| \*\*BLOCKED\*\*/);
assert.match(contract, /Supabase storage gate\*\* \| \*\*BLOCKED\*\*/);
assert.match(contract, /Runtime implementation\*\* \| \*\*FORBIDDEN\*\*/);
});
test('contract names every protected prediction pipeline surface', () => {
const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
for (const file of protectedPipelineFiles) {
assert.ok(contract.includes(file), `missing protected surface ${file}`);
assert.ok(fs.existsSync(path.join(ROOT, file)), `protected surface missing from repository ${file}`);
}
});
test('contract preserves prediction, filtering, market, ACCA, and publication invariants', () => {
const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
for (const required of [
'predictions_raw',
'predictions_filtered',
'Direct 1X2',
'Market priority tiers',
'Conflict detection',
'ACCA leg construction',
'Same-match-combination',
'Prediction provenance fields'
]) {
assert.ok(contract.includes(required), `missing invariant: ${required}`);
}
});
test('contract records risk surfaces without authorizing repair', () => {
const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
assert.ok(contract.includes('getPredictionInputs()'));
assert.ok(contract.includes('analyzeWithDolphin()'));
assert.ok(contract.includes('These are **findings**, not repairs.'));
assert.ok(contract.includes('Provider/acquisition risk surfaces are documented but not removed'));
});
test('contract forbids runtime, SQL, Supabase, migration, provider-removal, E2E, and gate-clearance work', () => {
const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
for (const forbidden of [
'editing `aiPipeline.js`',
'SQL execution',
'Supabase mutation',
'migration creation',
'route wiring',
'E2E proof',
'provider removal',
'gate clearance',
'cleanup programme reopening'
]) {
assert.ok(contract.includes(forbidden), `missing forbidden boundary: ${forbidden}`);
}
});
test('ledger registers EPI-001-C1 without clearing global gates', () => {
const ledger = readJson('control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json');
const task = ledger.tasks.find((entry) => entry.task_id === 'EPI-001');
assert.equal(ledger.scout_edge_marriage_gate, 'BLOCKED');
assert.equal(ledger.supabase_storage_gate, 'BLOCKED');
assert.ok(task);
assert.equal(task.status, 'TESTED');
assert.ok(
task.related_contracts.includes('EPI-001_PREDICTION_PIPELINE_INTEGRITY_CONTRACT.v1')
);
assert.ok(
task.affected_files.includes('control-center/EPI-001_PREDICTION_PIPELINE_INTEGRITY_CONTRACT.v1.md')
);
assert.match(task.next_action, /separately authorized/i);
});
test('project register mirrors EPI-001 ledger state', () => {
const register = readJson('control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json');
const project = register.projects.find((entry) => entry.project_id === 'EPI-001');
assert.ok(project);
assert.equal(project.current_status, 'TESTED');
assert.ok(
project.related_contracts.includes('EPI-001_PREDICTION_PIPELINE_INTEGRITY_CONTRACT.v1')
);
assert.ok(project.current_evidence.some((line) => /EPI-001-C1 sealed/.test(line)));
});
test('package control-center test suite includes EPI-001-C1 proof', () => {
const pkg = readJson('package.json');
assert.equal(
pkg.scripts['test:epi-pipeline-integrity'],
'node --test tests/epi-pipeline-integrity-contract.test.js'
);
assert.ok(
pkg.scripts['test:control-center'].includes('tests/epi-pipeline-integrity-contract.test.js')
);
});
