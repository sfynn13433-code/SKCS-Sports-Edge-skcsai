'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const REPORT_PATH = path.join(
  ROOT,
  'reports',
  'ui3-i11',
  'marriage-proof-inspection.json'
);

const PACKET_PATH = path.join(
  ROOT,
  'control-center',
  'SEM-GOV-001D-UI3-I11_CONTRACT_RECONCILIATION_AND_MOCK_PROOF_AUTHORIZATION_PACKET.v1.md'
);

function readReport() {
  return JSON.parse(
    fs.readFileSync(REPORT_PATH, 'utf8')
  );
}

test('I11 Gate A evidence exists and records PASS WITH CORRECTION', () => {
  assert.equal(fs.existsSync(REPORT_PATH), true);

  const report = readReport();

  assert.equal(
    report.task,
    'SEM-GOV-001D-UI3-I11'
  );

  assert.equal(report.gate, 'A');
  assert.equal(
    report.result,
    'PASS_WITH_CORRECTION'
  );

  assert.equal(
    report.fullMarriageProofDecision,
    'HOLD'
  );
});

test('I11 authorizes mock proof only', () => {
  const report = readReport();

  assert.equal(
    report.mockOnlyProofAuthorized,
    true
  );

  assert.equal(
    report.liveDatabaseProofAuthorized,
    false
  );

  assert.equal(
    report.scoutTransportAuthorized,
    false
  );

  assert.equal(
    report.productionRouteAuthorized,
    false
  );

  assert.equal(
    report.featureFlagEnablementAuthorized,
    false
  );

  assert.equal(
    report.gateClearanceAuthorized,
    false
  );

  assert.equal(
    report.runtimeWritesAuthorized,
    false
  );
});

test('all runtime gates remain blocked', () => {
  const report = readReport();

  assert.deepEqual(
    report.currentRuntimeGates,
    {
      scout_edge_marriage_gate: 'BLOCKED',
      unified_lifecycle_governor: 'BLOCKED',
      supabase_storage_gate: 'BLOCKED'
    }
  );
});

test('proof kickoff window uses the contract intersection', () => {
  const report = readReport();

  assert.deepEqual(
    report.reconciliation.proofKickoffWindowHours,
    {
      minimum: 24,
      maximum: 48,
      decision: 'USE_INTERSECTION'
    }
  );
});

test('implemented evidence table is canonical for I11', () => {
  const report = readReport();

  assert.equal(
    report.reconciliation.canonicalEvidenceTable,
    'public.fip_intake_evidence'
  );

  assert.equal(
    report.reconciliation.supersededEvidenceTableReference,
    'public.fip_intake_events'
  );
});

test('I10 schema state supersedes the I9 static state', () => {
  const report = readReport();

  assert.equal(
    report.reconciliation.migrationsApplied,
    true
  );

  assert.equal(
    report.reconciliation.schemaOnly,
    true
  );

  assert.equal(
    report.reconciliation.runtimeActivated,
    false
  );
});

test('I11 packet preserves the live execution HOLD', () => {
  assert.equal(fs.existsSync(PACKET_PATH), true);

  const packet = fs.readFileSync(
    PACKET_PATH,
    'utf8'
  );

  assert.match(
    packet,
    /PASS WITH CORRECTION/i
  );

  assert.match(
    packet,
    /mock-only/i
  );

  assert.match(
    packet,
    /full marriage proof.*HOLD/is
  );

  assert.match(
    packet,
    /scout_edge_marriage_gate.*BLOCKED/is
  );

  assert.match(
    packet,
    /unified_lifecycle_governor.*BLOCKED/is
  );

  assert.match(
    packet,
    /supabase_storage_gate.*BLOCKED/is
  );

  assert.doesNotMatch(
    packet,
    /production activation.*authorized/i
  );
});

test('I11 inspection introduces no runtime changes or credentials', () => {
  const report = readReport();

  assert.equal(
    report.introducedRuntimeChanges,
    false
  );

  assert.equal(
    report.credentialsRecorded,
    false
  );
});
