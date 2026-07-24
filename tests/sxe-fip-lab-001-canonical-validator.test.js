'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildSyntheticCanonicalFip,
  computeCanonicalValidationHash,
  validateCanonicalScoutFip,
  SCOUT_FIP_HASH_ALGORITHM,
  MAX_CANONICAL_BYTES
} = require('../scripts/sxe-fip-lab-001-canonical-validator');

test('synthetic canonical FIP passes Scout validation law', () => {
  const now = new Date('2026-07-24T10:00:00.000Z');
  const fip = buildSyntheticCanonicalFip({ now });
  const result = validateCanonicalScoutFip(fip, { now });
  assert.equal(result.ok, true);
  assert.equal(result.verification.schema_version, '1.0.0');
});

test('tampered validation hash fails canonical recomputation', () => {
  const now = new Date('2026-07-24T10:00:00.000Z');
  const fip = buildSyntheticCanonicalFip({ now });
  fip.validation.hash = 'deadbeef';
  const result = validateCanonicalScoutFip(fip, { now });
  assert.equal(result.result, 'HOLD');
  assert.equal(result.code, 'SXE_CANONICAL_HASH_MISMATCH');
});

test('markets.status UNAVAILABLE remains acceptable', () => {
  const now = new Date('2026-07-24T10:00:00.000Z');
  const fip = buildSyntheticCanonicalFip({ now });
  fip.markets = { status: 'UNAVAILABLE', reason: 'test' };
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const result = validateCanonicalScoutFip(fip, { now });
  assert.equal(result.ok, true);
});

test('payload at 256 KB boundary fails', () => {
  const now = new Date('2026-07-24T10:00:00.000Z');
  const fip = buildSyntheticCanonicalFip({ now });
  fip.context = { pad: 'x'.repeat(MAX_CANONICAL_BYTES) };
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const result = validateCanonicalScoutFip(fip, { now });
  assert.equal(result.code, 'SXE_EXTERNAL_FIP_TOO_LARGE');
});

test('hash algorithm must be scout-fip-sha256-v1', () => {
  const now = new Date('2026-07-24T10:00:00.000Z');
  const fip = buildSyntheticCanonicalFip({ now });
  fip.validation.hash_algorithm = 'sha256';
  fip.validation.hash = computeCanonicalValidationHash(fip);
  const result = validateCanonicalScoutFip(fip, { now });
  assert.equal(result.code, 'SXE_CANONICAL_HASH_ALGORITHM_UNSUPPORTED');
});
