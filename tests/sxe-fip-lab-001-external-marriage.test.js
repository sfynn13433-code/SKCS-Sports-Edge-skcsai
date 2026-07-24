'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  buildSyntheticCanonicalFip,
  canonicalJson
} = require('../scripts/sxe-fip-lab-001-canonical-validator');
const { sha256 } = require('../scripts/sxe-fip-lab-001-external-fip-loader');
const {
  runMarriageFlow
} = require('../scripts/sxe-fip-lab-001-external-marriage-runner');

const FIXED_NOW = new Date('2026-07-24T10:00:00.000Z');

function writeSyntheticManifest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sxe-edge-test-'));
  const fip = buildSyntheticCanonicalFip({ now: FIXED_NOW });
  const fipPath = path.join(root, 'canonical-fip.json');
  fs.writeFileSync(fipPath, Buffer.from(canonicalJson(fip), 'utf8'));
  const manifestPath = path.join(root, 'handoff-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    manifest_version: 'SXE-FIP-LAB-001B-test',
    project_id: 'SXE-FIP-LAB-001',
    fixture: {
      fixture_id: fip.scout.fixture_id,
      sport: 'football',
      home_team: fip.fixture.home_team.name,
      away_team: fip.fixture.away_team.name
    },
    files: [{
      role: 'CANONICAL_SCOUT_FIP',
      path: fipPath,
      sha256: sha256(fs.readFileSync(fipPath))
    }]
  }, null, 2), 'utf8');
  return { root, manifestPath, fip };
}

function holdManifest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sxe-edge-test-'));
  const manifestPath = path.join(root, 'handoff-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    manifest_version: 'SXE-FIP-LAB-001B-test',
    project_id: 'SXE-FIP-LAB-001',
    fixture: { fixture_id: 'hold-only-fixture' },
    files: [{
      role: 'INTERNAL_SCOUT_FIP',
      path: path.join(root, 'internal.json'),
      sha256: sha256(Buffer.from('{"fixture_id":"hold-only-fixture"}', 'utf8'))
    }]
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'internal.json'), '{"fixture_id":"hold-only-fixture"}', 'utf8');
  return manifestPath;
}

test('HOLD does not invoke marriage function', async () => {
  let marriageCalls = 0;
  const payload = await runMarriageFlow({
    manifestPath: holdManifest(),
    now: FIXED_NOW,
    runMarriage: async () => {
      marriageCalls += 1;
      return { ok: true };
    }
  });
  assert.equal(payload.result, 'HOLD');
  assert.equal(marriageCalls, 0);
  assert.equal(payload.safety.marriage_invocations, 0);
  assert.equal(payload.prediction, null);
});

test('READY invokes marriage function exactly once with verified FIP', async () => {
  const { manifestPath, fip } = writeSyntheticManifest();
  let marriageCalls = 0;
  let receivedFip;

  const payload = await runMarriageFlow({
    manifestPath,
    now: FIXED_NOW,
    runMarriage: async ({ externalFip }) => {
      marriageCalls += 1;
      receivedFip = externalFip;
      return {
        ok: true,
        result: 'SYNTHETIC_TEST_OK',
        source_package: { selected_role: 'CANONICAL_SCOUT_FIP' },
        runtime: { inserted_count: 1 },
        filters: [{ is_valid: true }, { is_valid: true }],
        safety: {
          provider_fallback_calls: 0,
          network_calls: 0,
          production_database_write: false,
          public_route_used: false,
          deployment_performed: false
        }
      };
    }
  });

  assert.equal(marriageCalls, 1);
  assert.equal(payload.ok, true);
  assert.equal(payload.safety.marriage_invocations, 1);
  assert.equal(receivedFip.scout.fixture_id, fip.scout.fixture_id);
  assert.notEqual(receivedFip, fip);
  assert.deepEqual(receivedFip.scout, fip.scout);
});

test('READY synthetic path uses injectable marriage without provider fallback', async () => {
  const { manifestPath } = writeSyntheticManifest();
  const payload = await runMarriageFlow({
    manifestPath,
    now: FIXED_NOW,
    runMarriage: async () => ({
      ok: true,
      filters: [],
      safety: { provider_fallback_calls: 0, network_calls: 0, production_database_write: false }
    })
  });
  assert.equal(payload.safety.provider_fallback_calls, 0);
  assert.equal(payload.safety.network_calls, 0);
  assert.equal(payload.safety.production_database_write, false);
});
