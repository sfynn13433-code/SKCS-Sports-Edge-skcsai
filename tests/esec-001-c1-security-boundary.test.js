'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(
    path.join(ROOT, relativePath),
    'utf8'
  );
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

test('ESEC-001-C1 historical inspection evidence remains preserved', () => {
  const report = readJson(
    'reports/esec-001/security-boundary-inspection.json'
  );

  const packet = read(
    'control-center/ESEC-001_C1_SECURITY_BOUNDARY_INSPECTION_AND_CONTRACT.v1.md'
  );

  assert.equal(report.task, 'ESEC-001');
  assert.equal(report.miniProject, 'ESEC-001-C1');
  assert.equal(report.result, 'PASS_WITH_CRITICAL_BLOCKERS');
  assert.equal(report.findingCount, 8);
  assert.equal(report.criticalFindingCount, 5);
  assert.equal(report.highFindingCount, 3);

  assert.deepEqual(
    report.findings.map((finding) => finding.state),
    Array(8).fill('OPEN')
  );

  assert.equal(report.runtimeRemediationAuthorized, false);
  assert.equal(report.e2eExecutionAuthorized, false);
  assert.equal(report.scoutTransportAuthorized, false);
  assert.equal(report.gateClearanceAuthorized, false);

  assert.match(packet, /PASS WITH CRITICAL BLOCKERS/);
  assert.match(packet, /ESEC-001-I1/);
  assert.match(packet, /ESEC REMAINS PARTIAL/);
});

test('ESEC-001-C1 is historical while I1 is the active proof', () => {
  const packageJson = readJson('package.json');

  assert.equal(
    packageJson.scripts['test:esec-001-c1'],
    'node --test tests/esec-001-c1-security-boundary.test.js'
  );

  assert.match(
    packageJson.scripts['test:esec-001-i1'],
    /esec-001-i1-governance\.test\.js/
  );
});
