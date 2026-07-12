'use strict';

const crypto = require('node:crypto');

const STORAGE_CLASSES = Object.freeze({
  R1_PROVENANCE_REFERENCE: 'R1_PROVENANCE_REFERENCE',
  R2_INTAKE_AUDIT_EVENT: 'R2_INTAKE_AUDIT_EVENT',
  D1_DERIVED_PREDICTION: 'D1_DERIVED_PREDICTION'
});

const SCOUT_FIP_ORIGIN = 'SCOUT_FIP';
const DEFAULT_SUPABASE_LIMIT_BYTES = 500 * 1024 * 1024;
const WARNING_THRESHOLD = 0.8;
const CRITICAL_THRESHOLD = 0.95;

const FORBIDDEN_FULL_FIP_KEYS = new Set([
  'full_fip',
  'full_fip_body',
  'fip_body',
  'fip_payload',
  'raw_fip',
  'raw_fip_payload',
  'scout_fip_body',
  'scout_fip_payload',
  'scout_archive_copy',
  'scout_mirror',
  'provider_payload',
  'provider_raw_payload',
  'raw_provider_payload'
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

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(String(value), 'utf8')
    .digest('hex');
}

function addDays(isoDate, days) {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function estimateBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function normalizeStorageMode(value) {
  const mode = String(value || 'PROOF_FIXTURE').trim().toUpperCase();
  return mode || 'PROOF_FIXTURE';
}

function getAuditRetentionDays(storageMode) {
  return normalizeStorageMode(storageMode) === 'PROOF_FIXTURE' ? 365 : 90;
}

function detectForbiddenFullFipBody(value, path = '$') {
  if (!value || typeof value !== 'object') {
    return null;
  }

  if (
    Object.prototype.hasOwnProperty.call(value, 'fip_schema_version') &&
    Object.prototype.hasOwnProperty.call(value, 'validation') &&
    Object.prototype.hasOwnProperty.call(value, 'fixture') &&
    Object.prototype.hasOwnProperty.call(value, 'markets') &&
    Object.prototype.hasOwnProperty.call(value, 'context')
  ) {
    return {
      path,
      reason: 'FULL_FIP_SHAPE_FORBIDDEN'
    };
  }

  for (const [key, childValue] of Object.entries(value)) {
    if (childValue === undefined || childValue === null) {
      continue;
    }

    const normalizedKey = key.trim().toLowerCase();

    if (FORBIDDEN_FULL_FIP_KEYS.has(normalizedKey)) {
      return {
        path: `${path}.${key}`,
        reason: 'FORBIDDEN_FULL_FIP_KEY'
      };
    }

    const nested = detectForbiddenFullFipBody(childValue, `${path}.${key}`);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function assertNoForbiddenPayload(record, label) {
  const violation = detectForbiddenFullFipBody(record);

  if (violation) {
    throw new Error(
      `${label} contains forbidden full FIP body or Scout mirror data at ${violation.path}: ${violation.reason}`
    );
  }
}

function evaluateSupabaseBudget({
  usedBytes = 0,
  limitBytes = DEFAULT_SUPABASE_LIMIT_BYTES
} = {}) {
  const safeLimit = Number(limitBytes) > 0 ? Number(limitBytes) : DEFAULT_SUPABASE_LIMIT_BYTES;
  const safeUsed = Math.max(0, Number(usedBytes) || 0);
  const ratio = safeUsed / safeLimit;

  let level = 'OK';

  if (ratio >= 1) {
    level = 'HARD_BLOCK';
  } else if (ratio >= CRITICAL_THRESHOLD) {
    level = 'CRITICAL';
  } else if (ratio >= WARNING_THRESHOLD) {
    level = 'WARNING';
  }

  return {
    level,
    used_bytes: safeUsed,
    limit_bytes: safeLimit,
    used_ratio: Number(ratio.toFixed(6)),
    warning_threshold: WARNING_THRESHOLD,
    critical_threshold: CRITICAL_THRESHOLD,
    block_full_fip_body_writes: true,
    block_all_new_est_records: level === 'HARD_BLOCK'
  };
}

function requireEvidenceValue(evidence, key) {
  if (
    !Object.prototype.hasOwnProperty.call(evidence, key) ||
    evidence[key] === null ||
    evidence[key] === undefined ||
    String(evidence[key]).trim() === ''
  ) {
    throw new Error(`Missing required EST-001 evidence field: ${key}`);
  }

  return evidence[key];
}

function createR1ProvenanceReference(intakeResult, options = {}) {
  const evidence = intakeResult.evidence || {};
  const envelopeMetadata = intakeResult.envelope?.metadata || {};
  const matchInfo = intakeResult.envelope?.match_info || {};

  const record = {
    storage_class: STORAGE_CLASSES.R1_PROVENANCE_REFERENCE,
    fip_id: requireEvidenceValue(evidence, 'fip_id'),
    fip_schema_version: requireEvidenceValue(evidence, 'fip_schema_version'),
    validation_hash: requireEvidenceValue(evidence, 'validation_hash'),
    fixture_id: matchInfo.fixture_id || matchInfo.match_id || null,
    match_id: matchInfo.match_id || matchInfo.fixture_id || null,
    intake_id: requireEvidenceValue(evidence, 'intake_id'),
    idempotency_key: requireEvidenceValue(evidence, 'idempotency_key'),
    sports_truth_origin: SCOUT_FIP_ORIGIN,
    validation_algorithm: envelopeMetadata.validation_algorithm || 'scout-fip-sha256-v1',
    replay_source: 'SCOUT_BY_FIP_ID_AND_HASH',
    replay_allowed_from_supabase_body: false,
    full_fip_body_persisted: false,
    created_at: options.createdAt || evidence.received_at || new Date().toISOString(),
    retention_policy: {
      rule: 'CO_TERMINUS_WITH_PREDICTION_PLUS_180_DAYS_POST_SETTLEMENT',
      source_of_truth: 'Scout canonical archive',
      edge_storage_role: 'minimal provenance reference only'
    }
  };

  record.storage_record_hash = sha256(stableStringify(record));
  assertNoForbiddenPayload(record, 'R1 provenance record');
  return record;
}

function createR2AuditEvent(intakeResult, options = {}) {
  const evidence = intakeResult.evidence || {};
  const now = options.createdAt || evidence.received_at || new Date().toISOString();
  const governedMode = evidence.governed_mode || options.governedMode || 'PROOF_FIXTURE';
  const retentionDays = getAuditRetentionDays(governedMode);

  const record = {
    storage_class: STORAGE_CLASSES.R2_INTAKE_AUDIT_EVENT,
    intake_id: evidence.intake_id || null,
    fip_id: evidence.fip_id || null,
    fip_schema_version: evidence.fip_schema_version || null,
    validation_hash: evidence.validation_hash || null,
    idempotency_key: evidence.idempotency_key || null,
    result: intakeResult.result || evidence.result || 'UNKNOWN',
    accepted: Boolean(intakeResult.accepted),
    rejection_code: intakeResult.rejection_code || evidence.rejection_code || null,
    caller: evidence.caller || options.caller || 'UNKNOWN',
    governed_mode: governedMode,
    scout_edge_marriage_gate: evidence.scout_edge_marriage_gate || options.scoutEdgeMarriageGate || 'BLOCKED',
    supabase_storage_gate: evidence.supabase_storage_gate || options.supabaseStorageGate || 'BLOCKED',
    sports_truth_origin: SCOUT_FIP_ORIGIN,
    created_at: now,
    retention_days: retentionDays,
    retention_expires_at: addDays(now, retentionDays),
    full_fip_body_persisted: false,
    scout_mirror_persisted: false
  };

  record.storage_record_hash = sha256(stableStringify(record));
  assertNoForbiddenPayload(record, 'R2 audit record');
  return record;
}

function createBlockedDecision({
  intakeResult,
  rejectionCode,
  message,
  details = {},
  options = {}
}) {
  const now = options.createdAt || intakeResult?.evidence?.received_at || new Date().toISOString();

  return {
    allowed: false,
    result: 'BLOCKED',
    rejection_code: rejectionCode,
    message,
    records: {
      r1_provenance_reference: null,
      r2_intake_audit_event: null,
      d1_derived_prediction_reference: null
    },
    storage_policy: {
      canonical_truth_owner: 'Scout',
      edge_storage_role: 'minimal operational evidence only',
      full_fip_body_persistence: 'FORBIDDEN',
      scout_mirror_persistence: 'FORBIDDEN',
      replay_source: 'SCOUT_BY_FIP_ID_AND_HASH',
      created_at: now,
      details
    }
  };
}

function buildEstStorageRecords(intakeResult, options = {}) {
  const forbiddenCandidate = {
    full_fip: options.fullFip,
    full_fip_body: options.fullFipBody,
    fip_payload: options.fipPayload,
    scout_fip_body: options.scoutFipBody,
    scout_mirror: options.scoutMirror,
    provider_payload: options.providerPayload
  };

  const violation = detectForbiddenFullFipBody(forbiddenCandidate);

  if (violation) {
    return createBlockedDecision({
      intakeResult,
      rejectionCode: 'FULL_FIP_BODY_FORBIDDEN',
      message: 'EST-001 forbids persisting full Scout FIP bodies, Scout mirrors, or provider payloads in Supabase.',
      details: violation,
      options
    });
  }

  const budget = evaluateSupabaseBudget({
    usedBytes: options.usedBytes,
    limitBytes: options.limitBytes
  });

  if (budget.block_all_new_est_records) {
    return createBlockedDecision({
      intakeResult,
      rejectionCode: 'SUPABASE_STORAGE_HARD_BLOCK',
      message: 'Supabase storage usage is at or above the hard block threshold.',
      details: budget,
      options
    });
  }

  if (!intakeResult || typeof intakeResult !== 'object') {
    return createBlockedDecision({
      intakeResult,
      rejectionCode: 'INVALID_INTAKE_RESULT',
      message: 'EST-001 storage enforcement requires an EFI intake result object.',
      options
    });
  }

  const r2Audit = createR2AuditEvent(intakeResult, options);

  if (!intakeResult.accepted) {
    return {
      allowed: true,
      result: 'AUDIT_ONLY',
      rejection_code: null,
      records: {
        r1_provenance_reference: null,
        r2_intake_audit_event: r2Audit,
        d1_derived_prediction_reference: null
      },
      storage_policy: {
        canonical_truth_owner: 'Scout',
        edge_storage_role: 'rejected intake audit only',
        full_fip_body_persistence: 'FORBIDDEN',
        scout_mirror_persistence: 'FORBIDDEN',
        replay_source: 'SCOUT_BY_FIP_ID_AND_HASH',
        supabase_budget: budget
      }
    };
  }

  const r1Provenance = createR1ProvenanceReference(intakeResult, options);

  const decision = {
    allowed: true,
    result: 'R1_R2_READY',
    rejection_code: null,
    records: {
      r1_provenance_reference: r1Provenance,
      r2_intake_audit_event: r2Audit,
      d1_derived_prediction_reference: null
    },
    storage_policy: {
      canonical_truth_owner: 'Scout',
      edge_storage_role: 'minimal operational evidence only',
      full_fip_body_persistence: 'FORBIDDEN',
      scout_mirror_persistence: 'FORBIDDEN',
      replay_source: 'SCOUT_BY_FIP_ID_AND_HASH',
      replay_allowed_from_supabase_body: false,
      supabase_budget: budget
    }
  };

  assertNoForbiddenPayload(decision.records, 'EST storage records');
  return decision;
}

module.exports = {
  STORAGE_CLASSES,
  SCOUT_FIP_ORIGIN,
  DEFAULT_SUPABASE_LIMIT_BYTES,
  evaluateSupabaseBudget,
  buildEstStorageRecords,
  createR1ProvenanceReference,
  createR2AuditEvent,
  detectForbiddenFullFipBody,
  estimateBytes
};
