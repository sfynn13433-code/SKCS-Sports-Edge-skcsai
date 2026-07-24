'use strict';

const crypto = require('node:crypto');

const SCOUT_FIP_SCHEMA_VERSION = '1.0.0';
const SCOUT_FIP_HASH_ALGORITHM = 'scout-fip-sha256-v1';
const MAX_CANONICAL_BYTES = 256 * 1024;
const REQUIRED_SPORT = 'football';
const MAX_FUTURE_KICKOFF_MS = 48 * 60 * 60 * 1000;
const SCOUT_PUBLISHED_TIP = '5a19ac88a436768a9356150e4c0cf7ec17f2405e';

const REQUIRED_FIELD_PATHS = [
  'fip_id',
  'fip_schema_version',
  'validation.status',
  'validation.hash',
  'validation.hash_algorithm',
  'scout.fixture_id',
  'provenance.scout_run_id',
  'provenance.source_system',
  'provenance.assembled_at',
  'provenance.internal_fip_sha256',
  'fixture.sport',
  'fixture.league_id',
  'fixture.league',
  'fixture.kickoff_utc',
  'fixture.status',
  'fixture.home_team.id',
  'fixture.home_team.name',
  'fixture.away_team.id',
  'fixture.away_team.name',
  'markets',
  'context'
];

const ELIGIBLE_STATUS_TOKENS = new Set([
  'upcoming',
  'scheduled',
  'not_started',
  'not started',
  'pending'
]);

const INELIGIBLE_STATUS_TOKENS = new Set([
  'started',
  'live',
  'in_play',
  'in progress',
  'finished',
  'complete',
  'completed',
  'postponed',
  'cancelled',
  'abandoned',
  'unknown'
]);

function sortForCanonicalJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortForCanonicalJson);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortForCanonicalJson(value[key])])
  );
}

function canonicalJson(value) {
  return JSON.stringify(sortForCanonicalJson(value));
}

function sha256Hex(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256Upper(bytes) {
  return sha256Hex(bytes).toUpperCase();
}

function hasPath(value, dottedPath) {
  let cursor = value;

  for (const part of dottedPath.split('.')) {
    if (
      !cursor
      || typeof cursor !== 'object'
      || !Object.prototype.hasOwnProperty.call(cursor, part)
    ) {
      return false;
    }
    cursor = cursor[part];
  }

  return true;
}

function getPath(value, dottedPath) {
  let cursor = value;

  for (const part of dottedPath.split('.')) {
    if (
      !cursor
      || typeof cursor !== 'object'
      || !Object.prototype.hasOwnProperty.call(cursor, part)
    ) {
      return undefined;
    }
    cursor = cursor[part];
  }

  return cursor;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeStatusToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeStatusKey(value) {
  return normalizeStatusToken(value).replace(/\s+/g, '_');
}

function computeCanonicalValidationHash(fip) {
  const copy = JSON.parse(JSON.stringify(fip));
  if (copy.validation) {
    copy.validation.hash = '';
  }
  return sha256Hex(Buffer.from(canonicalJson(copy), 'utf8'));
}

function hold(code, message, details = {}) {
  return {
    ok: false,
    result: 'HOLD',
    code,
    message,
    details
  };
}

function validateCanonicalScoutFip(fip, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const nowMs = now.getTime();
  if (Number.isNaN(nowMs)) {
    return hold('SXE_CANONICAL_KICKOFF_INELIGIBLE', 'Injectable clock is not a valid Date.');
  }

  const manifestFixtureId = options.manifestFixtureId || null;

  if (!fip || typeof fip !== 'object' || Array.isArray(fip)) {
    return hold('SXE_CANONICAL_JSON_INVALID', 'Canonical Scout FIP must be a JSON object.');
  }

  const missing = REQUIRED_FIELD_PATHS.filter((field) => !hasPath(fip, field));
  if (missing.length > 0) {
    return hold(
      'SXE_CANONICAL_IDENTITY_UNRESOLVED',
      'Canonical Scout FIP is missing required fields.',
      { missing_fields: missing }
    );
  }

  const payloadBytes = Buffer.byteLength(canonicalJson(fip), 'utf8');
  if (payloadBytes >= MAX_CANONICAL_BYTES) {
    return hold('SXE_EXTERNAL_FIP_TOO_LARGE', 'Canonical Scout FIP exceeds the 256 KB intake bound.', {
      bytes: payloadBytes
    });
  }

  if (fip.fip_schema_version !== SCOUT_FIP_SCHEMA_VERSION) {
    return hold('SXE_CANONICAL_SCHEMA_UNSUPPORTED', 'Unsupported fip_schema_version.');
  }

  if (fip.validation.status !== 'VALIDATED') {
    return hold('SXE_CANONICAL_STATUS_INELIGIBLE', 'validation.status must be VALIDATED.');
  }

  if (fip.validation.hash_algorithm !== SCOUT_FIP_HASH_ALGORITHM) {
    return hold('SXE_CANONICAL_HASH_ALGORITHM_UNSUPPORTED', 'Unsupported validation.hash_algorithm.');
  }

  const expectedHash = computeCanonicalValidationHash(fip);
  const actualHash = String(fip.validation.hash || '').trim().toLowerCase();
  if (actualHash !== expectedHash) {
    return hold('SXE_CANONICAL_HASH_MISMATCH', 'Canonical validation.hash does not match recomputed Scout law.');
  }

  if (fip.provenance.source_system !== 'SCOUT') {
    return hold('SXE_CANONICAL_SOURCE_INVALID', 'provenance.source_system must be SCOUT.');
  }

  if (fip.fixture.sport !== REQUIRED_SPORT) {
    return hold('SXE_CANONICAL_SPORT_INVALID', 'fixture.sport must be football.');
  }

  const scoutFixtureId = String(fip.scout.fixture_id || '').trim();
  if (!scoutFixtureId) {
    return hold('SXE_CANONICAL_IDENTITY_UNRESOLVED', 'scout.fixture_id is required.');
  }

  if (manifestFixtureId && String(manifestFixtureId).trim() !== scoutFixtureId) {
    return hold('SXE_CANONICAL_IDENTITY_UNRESOLVED', 'Manifest fixture identity conflicts with scout.fixture_id.');
  }

  const homeId = String(fip.fixture.home_team.id || '').trim();
  const awayId = String(fip.fixture.away_team.id || '').trim();
  const homeName = String(fip.fixture.home_team.name || '').trim();
  const awayName = String(fip.fixture.away_team.name || '').trim();
  const leagueId = String(fip.fixture.league_id || '').trim();
  const leagueName = String(fip.fixture.league || '').trim();

  if (!homeId || !awayId || !homeName || !awayName || !leagueId || !leagueName) {
    return hold('SXE_CANONICAL_IDENTITY_UNRESOLVED', 'Fixture team and league identity is incomplete.');
  }

  if (homeId === awayId) {
    return hold('SXE_CANONICAL_IDENTITY_UNRESOLVED', 'Home and away team IDs must differ.');
  }

  const statusRaw = fip.fixture.status;
  if (statusRaw === undefined || statusRaw === null || String(statusRaw).trim() === '') {
    return hold('SXE_CANONICAL_STATUS_INELIGIBLE', 'fixture.status is missing.');
  }

  const statusToken = normalizeStatusToken(statusRaw);
  const statusKey = normalizeStatusKey(statusRaw);

  if (INELIGIBLE_STATUS_TOKENS.has(statusToken) || INELIGIBLE_STATUS_TOKENS.has(statusKey)) {
    return hold('SXE_CANONICAL_STATUS_INELIGIBLE', 'Fixture status is not eligible for Edge intake.');
  }

  if (!ELIGIBLE_STATUS_TOKENS.has(statusToken) && !ELIGIBLE_STATUS_TOKENS.has(statusKey)) {
    return hold('SXE_CANONICAL_STATUS_INELIGIBLE', 'Fixture status is not an allowed not-started state.');
  }

  const kickoffMs = Date.parse(fip.fixture.kickoff_utc);
  if (Number.isNaN(kickoffMs)) {
    return hold('SXE_CANONICAL_KICKOFF_INELIGIBLE', 'fixture.kickoff_utc is not a valid timestamp.');
  }

  if (kickoffMs <= nowMs) {
    return hold('SXE_CANONICAL_KICKOFF_INELIGIBLE', 'Fixture kickoff must be strictly in the future.');
  }

  if (kickoffMs > nowMs + MAX_FUTURE_KICKOFF_MS) {
    return hold('SXE_CANONICAL_KICKOFF_INELIGIBLE', 'Fixture kickoff is more than 48 hours ahead.');
  }

  return {
    ok: true,
    verification: {
      canonical_validation_hash: expectedHash,
      schema_version: SCOUT_FIP_SCHEMA_VERSION,
      sport: REQUIRED_SPORT,
      kickoff_utc: fip.fixture.kickoff_utc,
      scout_tip: SCOUT_PUBLISHED_TIP
    }
  };
}

function buildSyntheticCanonicalFip(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const kickoff = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const fixtureId = options.fixtureId || 'sxe-edge-synthetic-fixture-001';
  const internalHash = sha256Hex(Buffer.from(`synthetic-internal|${fixtureId}`, 'utf8'));

  const fip = {
    fip_id: `SCOUT-FIP-SYNTHETIC-${sha256Hex(Buffer.from(fixtureId, 'utf8')).slice(0, 16)}`,
    fip_schema_version: SCOUT_FIP_SCHEMA_VERSION,
    validation: {
      status: 'VALIDATED',
      hash: '',
      hash_algorithm: SCOUT_FIP_HASH_ALGORITHM
    },
    scout: { fixture_id: fixtureId },
    provenance: {
      scout_run_id: 'sxe-edge-synthetic-run-001',
      source_system: 'SCOUT',
      assembled_at: now.toISOString(),
      internal_fip_sha256: internalHash
    },
    fixture: {
      sport: REQUIRED_SPORT,
      league_id: 'sxe-synthetic-league-001',
      league: 'Synthetic Test League',
      kickoff_utc: kickoff.toISOString(),
      status: 'upcoming',
      home_team: { id: 'sxe-home-001', name: 'Synthetic Home XI' },
      away_team: { id: 'sxe-away-001', name: 'Synthetic Away XI' }
    },
    markets: {
      status: 'UNAVAILABLE',
      reason: 'Synthetic test fixture — no market truth',
      direct_1x2: { home: null, draw: null, away: null }
    },
    context: {
      synthetic_test_evidence: true,
      note: 'Portable Edge intake test only'
    }
  };

  fip.validation.hash = computeCanonicalValidationHash(fip);
  return fip;
}

module.exports = {
  SCOUT_FIP_SCHEMA_VERSION,
  SCOUT_FIP_HASH_ALGORITHM,
  MAX_CANONICAL_BYTES,
  REQUIRED_SPORT,
  MAX_FUTURE_KICKOFF_MS,
  SCOUT_PUBLISHED_TIP,
  REQUIRED_FIELD_PATHS,
  sortForCanonicalJson,
  canonicalJson,
  sha256Hex,
  sha256Upper,
  computeCanonicalValidationHash,
  validateCanonicalScoutFip,
  buildSyntheticCanonicalFip,
  getPath,
  hasPath
};
