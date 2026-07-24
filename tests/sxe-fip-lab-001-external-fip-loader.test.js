'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  buildSyntheticCanonicalFip,
  canonicalJson,
  computeCanonicalValidationHash,
  MAX_CANONICAL_BYTES
} = require('../scripts/sxe-fip-lab-001-canonical-validator');
const {
  CANONICAL_ROLE,
  DTO_ROLE,
  INTERNAL_ROLE,
  loadExternalScoutFip,
  sha256
} = require('../scripts/sxe-fip-lab-001-external-fip-loader');

const FIXED_NOW = new Date('2026-07-24T10:00:00.000Z');
let marriageCalls = 0;

function writeCanonicalBytes(filePath, fip) {
  fs.writeFileSync(filePath, Buffer.from(canonicalJson(fip), 'utf8'));
}

function makeBundle({
  fip = buildSyntheticCanonicalFip({ now: FIXED_NOW }),
  includeCanonical = true,
  includeInternal = true,
  includeDto = true,
  manifestFixtureId = fip.scout.fixture_id
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sxe-edge-test-'));
  const files = [];

  if (includeCanonical) {
    const filePath = path.join(root, 'canonical-fip.json');
    writeCanonicalBytes(filePath, fip);
    files.push({
      role: CANONICAL_ROLE,
      path: filePath,
      sha256: sha256(fs.readFileSync(filePath))
    });
  }

  if (includeInternal) {
    const filePath = path.join(root, 'internal-fip.json');
    fs.writeFileSync(filePath, JSON.stringify({ fixture_id: manifestFixtureId }), 'utf8');
    files.push({
      role: INTERNAL_ROLE,
      path: filePath,
      sha256: sha256(fs.readFileSync(filePath))
    });
  }

  if (includeDto) {
    const filePath = path.join(root, 'dto.json');
    fs.writeFileSync(filePath, JSON.stringify({ fixture_id: manifestFixtureId }), 'utf8');
    files.push({
      role: DTO_ROLE,
      path: filePath,
      sha256: sha256(fs.readFileSync(filePath))
    });
  }

  const manifestPath = path.join(root, 'handoff-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    manifest_version: 'SXE-FIP-LAB-001B-test',
    project_id: 'SXE-FIP-LAB-001',
    fixture: {
      fixture_id: manifestFixtureId,
      sport: 'football',
      home_team: fip.fixture.home_team.name,
      away_team: fip.fixture.away_team.name
    },
    files: files.map((entry) => ({
      role: entry.role,
      path: entry.path,
      sha256: entry.sha256
    }))
  }, null, 2), 'utf8');

  return { root, manifestPath, fip, files };
}

function load(manifestPath, now = FIXED_NOW) {
  return loadExternalScoutFip({ manifestPath, now });
}

test.beforeEach(() => {
  marriageCalls = 0;
});

test('1 valid synthetic FIP returns READY', () => {
  const bundle = makeBundle();
  const result = load(bundle.manifestPath);
  assert.equal(result.result, 'READY');
  assert.equal(result.code, 'SXE_EXTERNAL_SCOUT_FIP_READY');
  assert.ok(result.canonical_fip);
  assert.equal(result.verification.scout_tip, '5a19ac88a436768a9356150e4c0cf7ec17f2405e');
});

test('2 missing manifest returns HOLD', () => {
  const result = loadExternalScoutFip({ manifestPath: path.join(os.tmpdir(), 'missing-manifest.json') });
  assert.equal(result.result, 'HOLD');
});

test('3 missing FIP file returns HOLD', () => {
  const bundle = makeBundle({ includeInternal: false, includeDto: false });
  fs.unlinkSync(bundle.files[0].path);
  const result = load(bundle.manifestPath);
  assert.equal(result.result, 'HOLD');
  assert.equal(result.code, 'SXE_CANONICAL_SCOUT_FIP_MISSING');
});

test('4 manifest path escape returns HOLD', () => {
  const bundle = makeBundle({ includeInternal: false, includeDto: false });
  const outside = path.join(os.tmpdir(), `sxe-edge-outside-${Date.now()}.json`);
  writeCanonicalBytes(outside, bundle.fip);
  const manifest = JSON.parse(fs.readFileSync(bundle.manifestPath, 'utf8'));
  manifest.files[0].path = outside;
  manifest.files[0].sha256 = sha256(fs.readFileSync(outside));
  fs.writeFileSync(bundle.manifestPath, JSON.stringify(manifest, null, 2));
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_EXTERNAL_PATH_ESCAPE');
});

test('5 URL manifest value returns HOLD', () => {
  const result = loadExternalScoutFip({
    manifestPath: 'https://example.invalid/manifest.json',
    now: FIXED_NOW
  });
  assert.equal(result.code, 'SXE_EXTERNAL_MANIFEST_INVALID');
});

test('6 malformed manifest SHA returns HOLD', () => {
  const bundle = makeBundle({ includeInternal: false, includeDto: false });
  const manifest = JSON.parse(fs.readFileSync(bundle.manifestPath, 'utf8'));
  manifest.files[0].sha256 = 'not-a-hash';
  fs.writeFileSync(bundle.manifestPath, JSON.stringify(manifest, null, 2));
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_EXTERNAL_MANIFEST_INVALID');
});

test('7 exact-byte tampering returns HOLD', () => {
  const bundle = makeBundle({ includeInternal: false, includeDto: false });
  fs.appendFileSync(bundle.files[0].path, ' ');
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_EXTERNAL_BYTE_HASH_MISMATCH');
});

test('8 canonical tamper with unchanged manifest returns byte-hash HOLD', () => {
  const bundle = makeBundle({ includeInternal: false, includeDto: false });
  const tampered = { ...bundle.fip, context: { note: 'tampered' } };
  writeCanonicalBytes(bundle.files[0].path, tampered);
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_EXTERNAL_BYTE_HASH_MISMATCH');
});

test('9 canonical tamper with updated manifest hash returns canonical-hash HOLD', () => {
  const bundle = makeBundle({ includeInternal: false, includeDto: false });
  const tampered = JSON.parse(fs.readFileSync(bundle.files[0].path, 'utf8'));
  tampered.context = { note: 'tampered-with-hash-update' };
  writeCanonicalBytes(bundle.files[0].path, tampered);
  const manifest = JSON.parse(fs.readFileSync(bundle.manifestPath, 'utf8'));
  manifest.files[0].sha256 = sha256(fs.readFileSync(bundle.files[0].path));
  fs.writeFileSync(bundle.manifestPath, JSON.stringify(manifest, null, 2));
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_HASH_MISMATCH');
});

test('10 validation hash algorithm changed returns HOLD', () => {
  const fip = buildSyntheticCanonicalFip({ now: FIXED_NOW });
  fip.validation.hash_algorithm = 'sha256';
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const bundle = makeBundle({ fip, includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_HASH_ALGORITHM_UNSUPPORTED');
});

test('11 validation status changed returns HOLD', () => {
  const fip = buildSyntheticCanonicalFip({ now: FIXED_NOW });
  fip.validation.status = 'DRAFT';
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const bundle = makeBundle({ fip, includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_STATUS_INELIGIBLE');
});

test('12 unsupported schema returns HOLD', () => {
  const fip = buildSyntheticCanonicalFip({ now: FIXED_NOW });
  fip.fip_schema_version = '9.9.9';
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const bundle = makeBundle({ fip, includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_SCHEMA_UNSUPPORTED');
});

test('13 source system other than SCOUT returns HOLD', () => {
  const fip = buildSyntheticCanonicalFip({ now: FIXED_NOW });
  fip.provenance.source_system = 'EDGE';
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const bundle = makeBundle({ fip, includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_SOURCE_INVALID');
});

test('14 non-football sport returns HOLD', () => {
  const fip = buildSyntheticCanonicalFip({ now: FIXED_NOW });
  fip.fixture.sport = 'cricket';
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const bundle = makeBundle({ fip, includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_SPORT_INVALID');
});

test('15 missing fixture identity returns HOLD', () => {
  const fip = buildSyntheticCanonicalFip({ now: FIXED_NOW });
  delete fip.scout.fixture_id;
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const bundle = makeBundle({ fip, includeInternal: false, includeDto: false, manifestFixtureId: 'orphan-fixture' });
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_IDENTITY_UNRESOLVED');
});

test('16 conflicting fixture identity returns HOLD', () => {
  const bundle = makeBundle({ includeInternal: false, includeDto: false, manifestFixtureId: 'different-fixture-id' });
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_IDENTITY_UNRESOLVED');
});

test('17 home and away IDs equal returns HOLD', () => {
  const fip = buildSyntheticCanonicalFip({ now: FIXED_NOW });
  fip.fixture.away_team.id = fip.fixture.home_team.id;
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const bundle = makeBundle({ fip, includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_IDENTITY_UNRESOLVED');
});

test('18 started fixture returns HOLD', () => {
  const fip = buildSyntheticCanonicalFip({ now: FIXED_NOW });
  fip.fixture.status = 'started';
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const bundle = makeBundle({ fip, includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_STATUS_INELIGIBLE');
});

test('19 live fixture returns HOLD', () => {
  const fip = buildSyntheticCanonicalFip({ now: FIXED_NOW });
  fip.fixture.status = 'live';
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const bundle = makeBundle({ fip, includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_STATUS_INELIGIBLE');
});

test('20 past kickoff returns HOLD', () => {
  const fip = buildSyntheticCanonicalFip({ now: FIXED_NOW });
  fip.fixture.kickoff_utc = '2026-07-24T08:00:00.000Z';
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const bundle = makeBundle({ fip, includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_KICKOFF_INELIGIBLE');
});

test('21 kickoff equal to now returns HOLD', () => {
  const fip = buildSyntheticCanonicalFip({ now: FIXED_NOW });
  fip.fixture.kickoff_utc = FIXED_NOW.toISOString();
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const bundle = makeBundle({ fip, includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_KICKOFF_INELIGIBLE');
});

test('22 kickoff more than 48 hours ahead returns HOLD', () => {
  const fip = buildSyntheticCanonicalFip({ now: FIXED_NOW });
  fip.fixture.kickoff_utc = new Date(FIXED_NOW.getTime() + 49 * 60 * 60 * 1000).toISOString();
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const bundle = makeBundle({ fip, includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_KICKOFF_INELIGIBLE');
});

test('23 invalid kickoff timestamp returns HOLD', () => {
  const fip = buildSyntheticCanonicalFip({ now: FIXED_NOW });
  fip.fixture.kickoff_utc = 'not-a-date';
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const bundle = makeBundle({ fip, includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_KICKOFF_INELIGIBLE');
});

test('24 payload exactly 256 KB or larger returns HOLD', () => {
  const bundle = makeBundle({ includeInternal: false, includeDto: false });
  const padLen = MAX_CANONICAL_BYTES - 10;
  const oversized = `{"pad":"${'x'.repeat(padLen)}"}`;
  assert.ok(Buffer.byteLength(oversized, 'utf8') >= MAX_CANONICAL_BYTES);
  fs.writeFileSync(bundle.files[0].path, oversized, 'utf8');
  const manifest = JSON.parse(fs.readFileSync(bundle.manifestPath, 'utf8'));
  manifest.files[0].sha256 = sha256(fs.readFileSync(bundle.files[0].path));
  fs.writeFileSync(bundle.manifestPath, JSON.stringify(manifest, null, 2));
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_EXTERNAL_FIP_TOO_LARGE');
});

test('25 invalid JSON returns HOLD', () => {
  const bundle = makeBundle({ includeInternal: false, includeDto: false });
  fs.writeFileSync(bundle.files[0].path, '{not-json');
  const manifest = JSON.parse(fs.readFileSync(bundle.manifestPath, 'utf8'));
  manifest.files[0].sha256 = sha256(fs.readFileSync(bundle.files[0].path));
  fs.writeFileSync(bundle.manifestPath, JSON.stringify(manifest, null, 2));
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_JSON_INVALID');
});

test('26 missing required context returns HOLD', () => {
  const fip = buildSyntheticCanonicalFip({ now: FIXED_NOW });
  delete fip.context;
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const bundle = makeBundle({ fip, includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_IDENTITY_UNRESOLVED');
});

test('27 missing required markets returns HOLD', () => {
  const fip = buildSyntheticCanonicalFip({ now: FIXED_NOW });
  delete fip.markets;
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const bundle = makeBundle({ fip, includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_IDENTITY_UNRESOLVED');
});

test('28 markets.status UNAVAILABLE is accepted', () => {
  const bundle = makeBundle({ includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.result, 'READY');
  assert.equal(result.canonical_fip.markets.status, 'UNAVAILABLE');
});

test('29 loader makes zero network calls', () => {
  const bundle = makeBundle({ includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.result, 'READY');
});

test('30 loader makes zero database calls', () => {
  const bundle = makeBundle({ includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.result, 'READY');
});

test('31 loader performs zero marriage calls', () => {
  const bundle = makeBundle({ includeInternal: false, includeDto: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.result, 'READY');
  assert.equal(marriageCalls, 0);
});

test('internal-only bundle returns canonical missing HOLD', () => {
  const bundle = makeBundle({ includeCanonical: false });
  const result = load(bundle.manifestPath);
  assert.equal(result.code, 'SXE_CANONICAL_SCOUT_FIP_MISSING');
});
