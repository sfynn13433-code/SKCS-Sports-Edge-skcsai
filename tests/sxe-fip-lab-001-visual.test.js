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
const serverModule = require('../scripts/sxe-fip-lab-001-external-marriage-server');

const ROOT = path.resolve(__dirname, '..');
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
  return { manifestPath, holdManifestPath: path.join(root, 'hold-manifest.json'), root };
}

test('external visual server binds only to loopback and rejects production mode', () => {
  assert.equal(serverModule.assertStartupGuards('127.0.0.1'), '127.0.0.1');
  assert.throws(() => serverModule.assertStartupGuards('0.0.0.0'), /127\.0\.0\.1/);
  const prior = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.throws(() => serverModule.assertStartupGuards('127.0.0.1'), /production/i);
  } finally {
    if (prior === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prior;
  }
});

test('external local page declares the production warning', () => {
  const html = fs.readFileSync(path.join(ROOT, 'local-tools', 'sxe-fip-lab-001', 'index.html'), 'utf8');
  assert.match(html, /LOCAL CONTROLLED TEST — NOT PRODUCTION/);
  assert.doesNotMatch(html, /synthetic prediction for Arsenal versus Chelsea/i);
});

test('loopback GET and POST use synthetic manifest only', async (t) => {
  const { manifestPath } = writeSyntheticManifest();
  const instance = await serverModule.startServer({
    host: '127.0.0.1',
    port: 0,
    manifestPath
  });
  t.after(() => new Promise((resolve) => instance.server.close(resolve)));

  assert.equal(instance.host, '127.0.0.1');
  assert.notEqual(instance.port, 0);

  const pageResponse = await fetch(`${instance.baseUrl}/`);
  assert.equal(pageResponse.status, 200);

  const healthResponse = await fetch(`${instance.baseUrl}/api/health`);
  const health = await healthResponse.json();
  assert.equal(health.bind, '127.0.0.1');
  assert.equal(health.production_authorized, false);
  assert.equal(health.public_route_used, false);

  const runResponse = await fetch(`${instance.baseUrl}/api/run`, { method: 'POST' });
  const payload = await runResponse.json();
  assert.equal(runResponse.status, 200);
  assert.ok(payload.result === 'HOLD' || payload.ok === true);
  assert.equal(payload.safety.public_route_used, false);
});

test('invalid manifest returns HOLD through loopback server', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sxe-edge-test-'));
  const manifestPath = path.join(root, 'bad-manifest.json');
  fs.writeFileSync(manifestPath, '{"files":[]}', 'utf8');

  const instance = await serverModule.startServer({
    host: '127.0.0.1',
    port: 0,
    manifestPath
  });
  t.after(() => new Promise((resolve) => instance.server.close(resolve)));

  const runResponse = await fetch(`${instance.baseUrl}/api/run`, { method: 'POST' });
  const payload = await runResponse.json();
  assert.equal(payload.result, 'HOLD');
});
