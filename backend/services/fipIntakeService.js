'use strict';

const crypto = require('node:crypto');

const FIP_SCHEMA_VERSION = '1.0.0';
const HASH_ALGORITHM = 'scout-fip-sha256-v1';
const SCOUT_FIP_ORIGIN = 'SCOUT_FIP';
const PROOF_FIXTURE_MODE = 'PROOF_FIXTURE';

const MAX_VALIDATION_AGE_MS = 30 * 60 * 1000;
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_KICKOFF_HORIZON_MS = 48 * 60 * 60 * 1000;

const FORBIDDEN_ORIGIN_VALUES = new Set([
  'BUILD_LIVE_DATA',
  'BUILDLIVEDATA',
  'PIPELINE_MANUAL_INJECTION',
  'POST_API_PIPELINE_RUN_MATCHES',
  'POST /API/PIPELINE/RUN { MATCHES }',
  'WORKSPACE_CANDIDATE',
  'SUPABASE_FIP_REPLAY',
  'SUPABASE_REPLAY',
  'API_SPORTS',
  'API-SPORTS',
  'BIG_BALLS',
  'THESPORTSDB',
  'THE_SPORTS_DB',
  'ODDS_API',
  'EXTERNAL_PROVIDER'
]);

function stableClone(value) {
  if (Array.isArray(value)) {
    return value.map(stableClone);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableClone(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableClone(value));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeToken(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function hasPath(value, path) {
  const parts = path.split('.');
  let cursor = value;

  for (const part of parts) {
    if (
      !cursor ||
      typeof cursor !== 'object' ||
      !Object.prototype.hasOwnProperty.call(cursor, part)
    ) {
      return false;
    }
    cursor = cursor[part];
  }

  return true;
}

function getPath(value, path) {
  const parts = path.split('.');
  let cursor = value;

  for (const part of parts) {
    if (
      !cursor ||
      typeof cursor !== 'object' ||
      !Object.prototype.hasOwnProperty.call(cursor, part)
    ) {
      return undefined;
    }
    cursor = cursor[part];
  }

  return cursor;
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function computeFipHash(fipPayload) {
  const clone = deepClone(fipPayload || {});
  clone.validation = clone.validation && typeof clone.validation === 'object'
    ? clone.validation
    : {};
  clone.validation.hash = '';

  return crypto
    .createHash('sha256')
    .update(stableStringify(clone), 'utf8')
    .digest('hex');
}

function computeIdempotencyKey({ fipId, validationHash, fipSchemaVersion }) {
  return crypto
    .createHash('sha256')
    .update(`${fipId}|${validationHash}|${fipSchemaVersion}`, 'utf8')
    .digest('hex');
}

function buildIntakeId({ fipId, validationHash, receivedAt }) {
  return `efi-${crypto
    .createHash('sha256')
    .update(`${fipId || 'UNKNOWN'}|${validationHash || 'NO_HASH'}|${receivedAt}`, 'utf8')
    .digest('hex')
    .slice(0, 24)}`;
}

function collectOriginCandidates(fipPayload) {
  return [
    fipPayload?.source,
    fipPayload?.origin,
    fipPayload?.sports_truth_origin,
    fipPayload?.metadata?.source,
    fipPayload?.metadata?.origin,
    fipPayload?.metadata?.sports_truth_origin,
    fipPayload?.transport?.source,
    fipPayload?.transport?.origin,
    fipPayload?.provenance?.source,
    fipPayload?.provenance?.origin
  ].filter((value) => value !== undefined && value !== null);
}

function detectForbiddenOrigin(fipPayload) {
  for (const candidate of collectOriginCandidates(fipPayload)) {
    const raw = String(candidate).trim();
    const normalized = normalizeToken(raw);

    if (FORBIDDEN_ORIGIN_VALUES.has(raw.toUpperCase()) || FORBIDDEN_ORIGIN_VALUES.has(normalized)) {
      return raw;
    }
  }

  return null;
}

function createBaseEvidence(fipPayload, options) {
  const receivedAt = options.receivedAt || new Date().toISOString();
  const fipId = fipPayload?.fip_id || null;
  const validationHash = fipPayload?.validation?.hash || null;
  const idempotencyKey = fipId && validationHash
    ? computeIdempotencyKey({
        fipId,
        validationHash,
        fipSchemaVersion: fipPayload?.fip_schema_version || FIP_SCHEMA_VERSION
      })
    : null;

  return {
    intake_id: buildIntakeId({ fipId, validationHash, receivedAt }),
    received_at: receivedAt,
    fip_id: fipId,
    fip_schema_version: fipPayload?.fip_schema_version || null,
    validation_hash: validationHash,
    idempotency_key: idempotencyKey,
    caller: options.caller || 'UNKNOWN',
    governed_mode: options.governedMode || PROOF_FIXTURE_MODE,
    scout_edge_marriage_gate: options.scoutEdgeMarriageGate || 'BLOCKED',
    supabase_storage_gate: options.supabaseStorageGate || 'BLOCKED',
    sports_truth_origin: SCOUT_FIP_ORIGIN
  };
}

function rejectIntake(code, message, fipPayload, options, details = {}) {
  return {
    accepted: false,
    result: 'REJECTED',
    rejection_code: code,
    message,
    evidence: {
      ...createBaseEvidence(fipPayload, options),
      result: 'REJECTED',
      rejection_code: code,
      details
    },
    envelope: null
  };
}

function validateRequiredFields(fipPayload) {
  const requiredPaths = [
    'fip_schema_version',
    'fip_id',
    'proof_mode',
    'validation.status',
    'validation.algorithm',
    'validation.hash',
    'validation.validated_at',
    'fixture.fixture_id',
    'fixture.sport',
    'fixture.kickoff_time',
    'fixture.home_team',
    'fixture.away_team',
    'markets',
    'context'
  ];

  for (const path of requiredPaths) {
    if (!hasPath(fipPayload, path)) {
      return { ok: false, path, reason: 'missing' };
    }

    const value = getPath(fipPayload, path);
    const requiresValue = !['markets', 'context'].includes(path);

    if (requiresValue && isBlank(value)) {
      return { ok: false, path, reason: 'blank' };
    }
  }

  if (
    !fipPayload.markets ||
    typeof fipPayload.markets !== 'object' ||
    Array.isArray(fipPayload.markets)
  ) {
    return { ok: false, path: 'markets', reason: 'not_object' };
  }

  if (
    !fipPayload.context ||
    typeof fipPayload.context !== 'object' ||
    Array.isArray(fipPayload.context)
  ) {
    return { ok: false, path: 'context', reason: 'not_object' };
  }

  return { ok: true };
}

function parseTimestamp(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  const utcIsoPattern =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;
  const match = normalized.match(utcIsoPattern);

  if (!match) {
    return null;
  }

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    millisecondText = ''
  ] = match;

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(millisecondText.padEnd(3, '0'));

  const timestampMs = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond
  );

  if (!Number.isFinite(timestampMs)) {
    return null;
  }

  const parsed = new Date(timestampMs);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour ||
    parsed.getUTCMinutes() !== minute ||
    parsed.getUTCSeconds() !== second ||
    parsed.getUTCMilliseconds() !== millisecond
  ) {
    return null;
  }

  return timestampMs;
}

function validateFreshness(fipPayload, options = {}) {
  const receivedAt = options.receivedAt || new Date().toISOString();
  const receivedAtMs = parseTimestamp(receivedAt);
  const validatedAtMs = parseTimestamp(fipPayload?.validation?.validated_at);
  const kickoffAtMs = parseTimestamp(fipPayload?.fixture?.kickoff_time);

  if (receivedAtMs === null) {
    return {
      ok: false,
      code: 'FIP_TIME_INVALID',
      message: 'Edge intake receivedAt must be a valid ISO-8601 timestamp.',
      details: {
        field: 'receivedAt',
        value: receivedAt
      }
    };
  }

  if (validatedAtMs === null) {
    return {
      ok: false,
      code: 'FIP_TIME_INVALID',
      message: 'Scout FIP validation.validated_at must be a valid ISO-8601 timestamp.',
      details: {
        field: 'validation.validated_at',
        value: fipPayload?.validation?.validated_at || null
      }
    };
  }

  if (kickoffAtMs === null) {
    return {
      ok: false,
      code: 'FIP_TIME_INVALID',
      message: 'Scout FIP fixture.kickoff_time must be a valid ISO-8601 timestamp.',
      details: {
        field: 'fixture.kickoff_time',
        value: fipPayload?.fixture?.kickoff_time || null
      }
    };
  }

  const futureValidationSkewMs = validatedAtMs - receivedAtMs;
  if (futureValidationSkewMs > MAX_FUTURE_CLOCK_SKEW_MS) {
    return {
      ok: false,
      code: 'FIP_TIME_INVALID',
      message: 'Scout FIP validation time exceeds the permitted future clock-skew allowance.',
      details: {
        validated_at: fipPayload.validation.validated_at,
        received_at: receivedAt,
        future_skew_ms: futureValidationSkewMs,
        maximum_future_skew_ms: MAX_FUTURE_CLOCK_SKEW_MS
      }
    };
  }

  const validationAgeMs = receivedAtMs - validatedAtMs;
  if (validationAgeMs > MAX_VALIDATION_AGE_MS) {
    return {
      ok: false,
      code: 'FIP_STALE',
      message: 'Scout FIP validation is older than the permitted freshness window.',
      details: {
        validated_at: fipPayload.validation.validated_at,
        received_at: receivedAt,
        validation_age_ms: validationAgeMs,
        maximum_validation_age_ms: MAX_VALIDATION_AGE_MS
      }
    };
  }

  const kickoffDelayMs = kickoffAtMs - receivedAtMs;
  if (kickoffDelayMs <= 0) {
    return {
      ok: false,
      code: 'FIP_STALE',
      message: 'Scout FIP fixture has already started or reached kickoff.',
      details: {
        kickoff_time: fipPayload.fixture.kickoff_time,
        received_at: receivedAt,
        kickoff_delay_ms: kickoffDelayMs
      }
    };
  }

  if (kickoffDelayMs > MAX_KICKOFF_HORIZON_MS) {
    return {
      ok: false,
      code: 'FIP_STALE',
      message: 'Scout FIP fixture kickoff exceeds the permitted intake horizon.',
      details: {
        kickoff_time: fipPayload.fixture.kickoff_time,
        received_at: receivedAt,
        kickoff_delay_ms: kickoffDelayMs,
        maximum_kickoff_horizon_ms: MAX_KICKOFF_HORIZON_MS
      }
    };
  }

  return {
    ok: true,
    receivedAt
  };
}

function mapToEdgeAnalysisEnvelope(fipPayload, evidence) {
  const fixture = fipPayload.fixture;
  const markets = fipPayload.markets;
  const context = fipPayload.context;

  const matchId = fixture.match_id || fixture.fixture_id;
  const sharpOdds =
    markets.sharp_odds && typeof markets.sharp_odds === 'object'
      ? markets.sharp_odds
      : markets;

  const contextualIntelligence =
    context.contextual_intelligence && typeof context.contextual_intelligence === 'object'
      ? context.contextual_intelligence
      : context;

  return {
    match_info: {
      match_id: matchId,
      fixture_id: fixture.fixture_id,
      sport: fixture.sport,
      home_team: fixture.home_team,
      away_team: fixture.away_team,
      kickoff_time: fixture.kickoff_time || fixture.starts_at || null,
      competition: fixture.competition || null,
      country: fixture.country || null,
      sports_truth_origin: SCOUT_FIP_ORIGIN
    },
    sharp_odds: sharpOdds,
    contextual_intelligence: contextualIntelligence,
    metadata: {
      sports_truth_origin: SCOUT_FIP_ORIGIN,
      fip_id: fipPayload.fip_id,
      fip_schema_version: fipPayload.fip_schema_version,
      validation_algorithm: fipPayload.validation.algorithm,
      validation_hash: fipPayload.validation.hash,
      idempotency_key: evidence.idempotency_key,
      intake_id: evidence.intake_id,
      proof_mode: fipPayload.proof_mode,
      scout_edge_marriage_gate: evidence.scout_edge_marriage_gate,
      supabase_storage_gate: evidence.supabase_storage_gate
    }
  };
}

function receiveValidatedFip(fipPayload, options = {}) {
  if (!fipPayload || typeof fipPayload !== 'object' || Array.isArray(fipPayload)) {
    return rejectIntake(
      'INVALID_PAYLOAD',
      'FIP intake requires an object payload.',
      fipPayload,
      options
    );
  }

  const forbiddenOrigin = detectForbiddenOrigin(fipPayload);
  if (forbiddenOrigin) {
    return rejectIntake(
      'FORBIDDEN_ORIGIN',
      'FIP intake rejected a forbidden non-Scout source.',
      fipPayload,
      options,
      { forbidden_origin: forbiddenOrigin }
    );
  }

  if (fipPayload.fip_schema_version !== FIP_SCHEMA_VERSION) {
    return rejectIntake(
      'UNSUPPORTED_SCHEMA_VERSION',
      'FIP intake only accepts Scout FIP schema version 1.0.0.',
      fipPayload,
      options,
      { expected: FIP_SCHEMA_VERSION, actual: fipPayload.fip_schema_version || null }
    );
  }

  if (fipPayload.proof_mode !== PROOF_FIXTURE_MODE) {
    return rejectIntake(
      'UNSUPPORTED_PROOF_MODE',
      'EFI-001-I1 only accepts PROOF_FIXTURE mode.',
      fipPayload,
      options,
      { expected: PROOF_FIXTURE_MODE, actual: fipPayload.proof_mode || null }
    );
  }

  if (fipPayload.validation?.status !== 'VALIDATED') {
    return rejectIntake(
      'VALIDATION_STATUS_NOT_VALIDATED',
      'Scout FIP validation.status must be VALIDATED.',
      fipPayload,
      options,
      { actual: fipPayload.validation?.status || null }
    );
  }

  if (fipPayload.validation?.algorithm !== HASH_ALGORITHM) {
    return rejectIntake(
      'UNSUPPORTED_HASH_ALGORITHM',
      'Scout FIP validation.algorithm is not supported.',
      fipPayload,
      options,
      { expected: HASH_ALGORITHM, actual: fipPayload.validation?.algorithm || null }
    );
  }

  const required = validateRequiredFields(fipPayload);
  if (!required.ok) {
    return rejectIntake(
      'REQUIRED_FIELD_MISSING',
      'Scout FIP payload is missing a required EFI-001 field.',
      fipPayload,
      options,
      required
    );
  }

  const expectedHash = computeFipHash(fipPayload);
  if (fipPayload.validation.hash !== expectedHash) {
    return rejectIntake(
      'HASH_MISMATCH',
      'Scout FIP validation.hash does not match the canonical payload hash.',
      fipPayload,
      options,
      {
        expected: expectedHash,
        actual: fipPayload.validation.hash
      }
    );
  }

  const freshness = validateFreshness(fipPayload, options);
  if (!freshness.ok) {
    return rejectIntake(
      freshness.code,
      freshness.message,
      fipPayload,
      {
        ...options,
        receivedAt: freshness.receivedAt || options.receivedAt
      },
      freshness.details
    );
  }

  if (
    options.governedMode === 'AUTHORIZED_PRODUCTION' &&
    options.scoutEdgeMarriageGate !== 'CLEARED'
  ) {
    return rejectIntake(
      'PRODUCTION_GATE_BLOCKED',
      'Production Scout FIP intake is blocked until explicit marriage gate clearance.',
      fipPayload,
      options,
      {
        scout_edge_marriage_gate: options.scoutEdgeMarriageGate || 'BLOCKED'
      }
    );
  }

  const evidence = {
    ...createBaseEvidence(fipPayload, options),
    result: 'ACCEPTED',
    rejection_code: null
  };

  return {
    accepted: true,
    result: 'ACCEPTED',
    rejection_code: null,
    message: 'Scout FIP accepted by EFI-001 fail-closed intake boundary.',
    evidence,
    envelope: mapToEdgeAnalysisEnvelope(fipPayload, evidence)
  };
}

module.exports = {
  FIP_SCHEMA_VERSION,
  HASH_ALGORITHM,
  SCOUT_FIP_ORIGIN,
  PROOF_FIXTURE_MODE,
  MAX_VALIDATION_AGE_MS,
  MAX_FUTURE_CLOCK_SKEW_MS,
  MAX_KICKOFF_HORIZON_MS,
  receiveValidatedFip,
  validateFreshness,
  computeFipHash,
  computeIdempotencyKey,
  stableStringify
};
