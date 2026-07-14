'use strict';

const crypto = require('node:crypto');

const LIFECYCLE_TIMEZONE = 'Africa/Johannesburg';
const LIFECYCLE_FEATURE_FLAG = 'LIFECYCLE_GOVERNOR_ENABLED';
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PROCESSING_TOLERANCE_MS = 15 * 60 * 1000;

const LIFECYCLE_STATES = Object.freeze([
  'VISIBLE',
  'UNDER_REVIEW',
  'HELD',
  'ELIMINATED',
  'FINAL_APPROVED',
  'CANCELLED',
  'POSTPONED',
  'ARCHIVED'
]);

const LIFECYCLE_STAGES = Object.freeze([
  'ADMITTED',
  'EVIDENCE_REVIEW',
  'CONTEXT_REVIEW',
  'STABILITY_REVIEW',
  'PUBLICATION_REVIEW',
  'FINAL_DECISION'
]);

const DAY_LABELS = Object.freeze([
  'TODAY',
  'DAY_2',
  'DAY_3',
  'DAY_4',
  'DAY_5',
  'DAY_6',
  'DAY_7',
  'DAY_8'
]);

const GOVERNED_REASON_CATEGORIES = Object.freeze([
  'TIMING_WINDOW',
  'INSUFFICIENT_EVIDENCE',
  'CONFIDENCE_THRESHOLD',
  'VOLATILITY_ELEVATED',
  'MARKET_CONFLICT',
  'CONTROL_PLANE_HOLD',
  'SEMANTIC_ALIGNMENT',
  'SPORT_NOT_ACTIVE',
  'PUBLICATION_DEFERRED',
  'MATCH_CANCELLED',
  'MATCH_POSTPONED',
  'APPROVED'
]);

const REJECTION_CODES = Object.freeze({
  LIFECYCLE_GATE_BLOCKED: 'LIFECYCLE_GATE_BLOCKED',
  LIFECYCLE_FEATURE_DISABLED: 'LIFECYCLE_FEATURE_DISABLED',
  LIFECYCLE_INPUT_INVALID: 'LIFECYCLE_INPUT_INVALID',
  LIFECYCLE_STATE_INVALID: 'LIFECYCLE_STATE_INVALID',
  LIFECYCLE_STAGE_INVALID: 'LIFECYCLE_STAGE_INVALID',
  LIFECYCLE_REASON_REQUIRED: 'LIFECYCLE_REASON_REQUIRED',
  LIFECYCLE_REASON_INVALID: 'LIFECYCLE_REASON_INVALID',
  LIFECYCLE_TRANSITION_NOT_ALLOWED: 'LIFECYCLE_TRANSITION_NOT_ALLOWED',
  LIFECYCLE_STAGE_REGRESSION_NOT_ALLOWED: 'LIFECYCLE_STAGE_REGRESSION_NOT_ALLOWED',
  SPORT_NOT_ACTIVE: 'SPORT_NOT_ACTIVE',
  FIXTURE_OUTSIDE_ADMISSION_WINDOW: 'FIXTURE_OUTSIDE_ADMISSION_WINDOW',
  FIXTURE_ALREADY_STARTED: 'FIXTURE_ALREADY_STARTED',
  FIXTURE_PROCESSING_TOLERANCE_EXPIRED: 'FIXTURE_PROCESSING_TOLERANCE_EXPIRED',
  TRANSITION_EVENT_INVALID: 'TRANSITION_EVENT_INVALID',
  ROLLOVER_KEY_INVALID: 'ROLLOVER_KEY_INVALID',
  ROLLOVER_ALREADY_APPLIED: 'ROLLOVER_ALREADY_APPLIED',
  ROLLOVER_DATE_GAP: 'ROLLOVER_DATE_GAP'
});

const LEGAL_STATE_TRANSITIONS = Object.freeze({
  __ADMISSION__: Object.freeze(['VISIBLE']),
  VISIBLE: Object.freeze(['UNDER_REVIEW', 'HELD', 'ELIMINATED', 'CANCELLED', 'POSTPONED']),
  UNDER_REVIEW: Object.freeze(['HELD', 'ELIMINATED', 'FINAL_APPROVED', 'CANCELLED', 'POSTPONED']),
  HELD: Object.freeze(['UNDER_REVIEW', 'ELIMINATED', 'CANCELLED', 'POSTPONED']),
  FINAL_APPROVED: Object.freeze(['HELD', 'CANCELLED', 'POSTPONED', 'ARCHIVED']),
  POSTPONED: Object.freeze(['VISIBLE', 'UNDER_REVIEW', 'CANCELLED', 'ARCHIVED']),
  CANCELLED: Object.freeze(['ARCHIVED']),
  ELIMINATED: Object.freeze(['ARCHIVED']),
  ARCHIVED: Object.freeze([])
});

const ARCHIVABLE_STATES = new Set([
  'FINAL_APPROVED',
  'POSTPONED',
  'CANCELLED',
  'ELIMINATED'
]);

function normalizeToken(value) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeFeatureFlag(value) {
  if (value === true) return true;
  if (typeof value !== 'string') return false;
  return value.trim().toLowerCase() === 'true';
}

function isAuthorizedGateStatus(value) {
  return new Set(['APPROVED', 'OPEN', 'CLEARED']).has(normalizeToken(value));
}

function toValidDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function assertCanonicalTimezone(timezone) {
  if (timezone !== LIFECYCLE_TIMEZONE) {
    throw new TypeError(`Unsupported lifecycle timezone: ${timezone}`);
  }
}

function sastDateParts(dateInput) {
  const date = toValidDate(dateInput);
  if (!date) return null;
  const shifted = new Date(date.getTime() + SAST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate()
  };
}

function sastMidnightUtc(parts) {
  return new Date(Date.UTC(parts.year, parts.month, parts.day) - SAST_OFFSET_MS);
}

function addSastCalendarDays(date, days) {
  const parts = sastDateParts(date);
  if (!parts) return null;
  return new Date(
    Date.UTC(parts.year, parts.month, parts.day + days) - SAST_OFFSET_MS
  );
}

function formatSastDateKey(dateInput) {
  const parts = sastDateParts(dateInput);
  if (!parts) return null;
  const year = String(parts.year).padStart(4, '0');
  const month = String(parts.month + 1).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) return null;
  return { year, month: month - 1, day };
}

function nextDateKey(key) {
  const parts = parseDateKey(key);
  if (!parts) return null;
  const next = new Date(Date.UTC(parts.year, parts.month, parts.day + 1));
  return `${String(next.getUTCFullYear()).padStart(4, '0')}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

async function evaluateGovernorGate({
  gateReader,
  featureFlagEnabled,
  refresh = true
} = {}) {
  if (!gateReader || typeof gateReader.readLifecycleGovernorGate !== 'function') {
    return { allowed: false, code: REJECTION_CODES.LIFECYCLE_GATE_BLOCKED };
  }

  let gates;
  try {
    gates = await gateReader.readLifecycleGovernorGate({ refresh });
  } catch {
    return { allowed: false, code: REJECTION_CODES.LIFECYCLE_GATE_BLOCKED };
  }

  if (
    !gates ||
    typeof gates !== 'object' ||
    gates.source !== 'EDGE_BUILD_CONTROL_LEDGER.v1.json' ||
    typeof gates.unifiedLifecycleGovernor !== 'string'
  ) {
    return { allowed: false, code: REJECTION_CODES.LIFECYCLE_GATE_BLOCKED };
  }

  if (!isAuthorizedGateStatus(gates.unifiedLifecycleGovernor)) {
    return { allowed: false, code: REJECTION_CODES.LIFECYCLE_GATE_BLOCKED };
  }

  if (!normalizeFeatureFlag(featureFlagEnabled)) {
    return { allowed: false, code: REJECTION_CODES.LIFECYCLE_FEATURE_DISABLED };
  }

  return {
    allowed: true,
    code: null,
    gates: {
      unifiedLifecycleGovernor: gates.unifiedLifecycleGovernor,
      scoutEdgeMarriageGate: gates.scoutEdgeMarriageGate ?? null,
      supabaseStorageGate: gates.supabaseStorageGate ?? null,
      source: gates.source
    }
  };
}

function calculateSastWindow({
  evaluationTime,
  timezone = LIFECYCLE_TIMEZONE
} = {}) {
  assertCanonicalTimezone(timezone);
  const evaluation = toValidDate(evaluationTime);
  if (!evaluation) {
    throw new TypeError('evaluationTime must be a valid date');
  }

  const start = sastMidnightUtc(sastDateParts(evaluation));
  const end = addSastCalendarDays(start, 8);

  return {
    windowStart: start,
    windowEnd: end,
    timezone: LIFECYCLE_TIMEZONE
  };
}

function calculateDayLabel({ kickoffAt, evaluationTime } = {}) {
  const kickoff = toValidDate(kickoffAt);
  const evaluation = toValidDate(evaluationTime);
  if (!kickoff || !evaluation) return null;

  const { windowStart, windowEnd } = calculateSastWindow({ evaluationTime: evaluation });
  if (kickoff < windowStart || kickoff >= windowEnd) return null;

  const kickoffKey = sastDateParts(kickoff);
  const startKey = sastDateParts(windowStart);
  const kickoffDay = Date.UTC(kickoffKey.year, kickoffKey.month, kickoffKey.day);
  const startDay = Date.UTC(startKey.year, startKey.month, startKey.day);
  const offset = Math.round((kickoffDay - startDay) / DAY_MS);

  return DAY_LABELS[offset] || null;
}

function evaluateAdmission(input = {}) {
  const gateResult = input.gateResult;
  if (!gateResult || gateResult.allowed !== true) {
    return {
      allowed: false,
      code: gateResult?.code || REJECTION_CODES.LIFECYCLE_GATE_BLOCKED
    };
  }

  if (String(input.sport || '').trim().toLowerCase() !== 'football') {
    return { allowed: false, code: REJECTION_CODES.SPORT_NOT_ACTIVE };
  }

  const kickoff = toValidDate(input.kickoffAt);
  const evaluation = toValidDate(input.evaluationTime);
  if (!kickoff || !evaluation) {
    return { allowed: false, code: REJECTION_CODES.LIFECYCLE_INPUT_INVALID };
  }

  const dayLabel = calculateDayLabel({ kickoffAt: kickoff, evaluationTime: evaluation });
  if (!dayLabel) {
    return {
      allowed: false,
      code: REJECTION_CODES.FIXTURE_OUTSIDE_ADMISSION_WINDOW
    };
  }

  const existingFixtureUid = String(input.existingFixtureUid || '').trim();
  if (!existingFixtureUid && kickoff <= evaluation) {
    return { allowed: false, code: REJECTION_CODES.FIXTURE_ALREADY_STARTED };
  }

  const processingToleranceEnd = new Date(kickoff.getTime() + PROCESSING_TOLERANCE_MS);
  const processingCandidate = existingFixtureUid
    ? evaluation <= processingToleranceEnd
    : true;

  return {
    allowed: true,
    code: null,
    dayLabel,
    existingFixture: Boolean(existingFixtureUid),
    processingCandidate,
    processingToleranceEnd
  };
}

function validateState(value, allowNull = false) {
  if (allowNull && (value === null || value === undefined || value === '')) return null;
  const normalized = normalizeToken(value);
  return LIFECYCLE_STATES.includes(normalized) ? normalized : null;
}

function validateStage(value, allowNull = false) {
  if (allowNull && (value === null || value === undefined || value === '')) return null;
  const normalized = normalizeToken(value);
  return LIFECYCLE_STAGES.includes(normalized) ? normalized : null;
}

function stageIndex(stage) {
  return LIFECYCLE_STAGES.indexOf(stage);
}

function evaluateTransition(input = {}) {
  const currentInput = input.current;
  const requestedInput = input.requested;
  const evaluation = toValidDate(input.evaluationTime);

  if (!requestedInput || typeof requestedInput !== 'object' || !evaluation) {
    return { allowed: false, code: REJECTION_CODES.LIFECYCLE_INPUT_INVALID };
  }

  const reasonCategory = normalizeToken(requestedInput.reason_category);
  if (!reasonCategory) {
    return { allowed: false, code: REJECTION_CODES.LIFECYCLE_REASON_REQUIRED };
  }
  if (!GOVERNED_REASON_CATEGORIES.includes(reasonCategory)) {
    return { allowed: false, code: REJECTION_CODES.LIFECYCLE_REASON_INVALID };
  }

  const currentState = currentInput
    ? validateState(currentInput.lifecycle_state)
    : null;
  if (currentInput && !currentState) {
    return { allowed: false, code: REJECTION_CODES.LIFECYCLE_STATE_INVALID };
  }

  const toState = validateState(requestedInput.to_state);
  if (!toState) {
    return { allowed: false, code: REJECTION_CODES.LIFECYCLE_STATE_INVALID };
  }

  const currentStage = currentInput
    ? validateStage(currentInput.lifecycle_stage, true)
    : null;
  if (currentInput && currentInput.lifecycle_stage && !currentStage) {
    return { allowed: false, code: REJECTION_CODES.LIFECYCLE_STAGE_INVALID };
  }

  let toStage;
  if (requestedInput.to_stage === undefined || requestedInput.to_stage === null || requestedInput.to_stage === '') {
    toStage = currentStage;
  } else {
    toStage = validateStage(requestedInput.to_stage);
    if (!toStage) {
      return { allowed: false, code: REJECTION_CODES.LIFECYCLE_STAGE_INVALID };
    }
  }

  const transitionKey = currentState || '__ADMISSION__';
  const legalTargets = LEGAL_STATE_TRANSITIONS[transitionKey] || [];
  if (!legalTargets.includes(toState)) {
    return {
      allowed: false,
      code: REJECTION_CODES.LIFECYCLE_TRANSITION_NOT_ALLOWED
    };
  }

  if (!currentState && toStage && toStage !== 'ADMITTED') {
    return {
      allowed: false,
      code: REJECTION_CODES.LIFECYCLE_STAGE_REGRESSION_NOT_ALLOWED
    };
  }

  const currentStageIndex = currentStage === null ? null : stageIndex(currentStage);
  const toStageIndex = toStage === null ? null : stageIndex(toStage);
  const stageChanged =
    currentStage !== null &&
    toStage !== null &&
    currentStage !== toStage;
  const stageAdvanced =
    stageChanged &&
    toStageIndex > currentStageIndex;
  const stageRegressed =
    stageChanged &&
    toStageIndex < currentStageIndex;

  const allowedPostponedReset =
    currentState === 'POSTPONED' &&
    toStage === 'ADMITTED' &&
    ['MATCH_POSTPONED', 'TIMING_WINDOW'].includes(reasonCategory);

  if (stageRegressed && !allowedPostponedReset) {
    return {
      allowed: false,
      code: REJECTION_CODES.LIFECYCLE_STAGE_REGRESSION_NOT_ALLOWED
    };
  }

  if (toState === 'HELD' && stageChanged) {
    return {
      allowed: false,
      code: REJECTION_CODES.LIFECYCLE_TRANSITION_NOT_ALLOWED
    };
  }

  if (
    stageAdvanced &&
    !['UNDER_REVIEW', 'FINAL_APPROVED'].includes(toState)
  ) {
    return {
      allowed: false,
      code: REJECTION_CODES.LIFECYCLE_TRANSITION_NOT_ALLOWED
    };
  }

  if (
    stageAdvanced &&
    ['ELIMINATED', 'CANCELLED', 'ARCHIVED'].includes(currentState)
  ) {
    return {
      allowed: false,
      code: REJECTION_CODES.LIFECYCLE_TRANSITION_NOT_ALLOWED
    };
  }

  const kickoff = currentInput ? toValidDate(currentInput.kickoff_at) : null;
  const processingToleranceEnd = kickoff
    ? new Date(kickoff.getTime() + PROCESSING_TOLERANCE_MS)
    : null;
  const processingCandidate = processingToleranceEnd
    ? evaluation <= processingToleranceEnd
    : null;

  const effects = {
    publication_eligible:
      toState === 'FINAL_APPROVED'
        ? true
        : (['POSTPONED', 'CANCELLED', 'ELIMINATED', 'ARCHIVED'].includes(toState)
          ? false
          : undefined),
    governed_revocation_required: toState === 'POSTPONED'
  };

  return {
    allowed: true,
    code: null,
    fromState: currentState,
    toState,
    fromStage: currentStage,
    toStage,
    reasonCategory,
    sourceActor: String(requestedInput.source_actor || '').trim() || null,
    processingCandidate,
    processingToleranceEnd,
    effects
  };
}

function buildTransitionEvent(input = {}) {
  const fixtureUid = String(input.fixtureUid || '').trim();
  const transitionVersion = Number(input.transitionVersion);
  const fromState = validateState(input.fromState, true);
  const toState = validateState(input.toState);
  const fromStage = validateStage(input.fromStage, true);
  const toStage = validateStage(input.toStage, true);
  const reasonCategory = normalizeToken(input.reasonCategory);
  const sourceActor = String(input.sourceActor || '').trim();
  const sourceRef = String(input.sourceRef || '').trim();
  const occurredAt = toValidDate(input.occurredAt);

  if (
    !fixtureUid ||
    !Number.isInteger(transitionVersion) ||
    transitionVersion < 1 ||
    !toState ||
    !reasonCategory ||
    !GOVERNED_REASON_CATEGORIES.includes(reasonCategory) ||
    !sourceActor ||
    !occurredAt
  ) {
    throw new TypeError(REJECTION_CODES.TRANSITION_EVENT_INVALID);
  }

  const epochSecond = Math.floor(occurredAt.getTime() / 1000);
  const canonical = [
    fixtureUid,
    toState,
    toStage || '',
    reasonCategory,
    sourceActor,
    sourceRef,
    epochSecond
  ].join('|');

  const idempotencyKey = crypto
    .createHash('sha256')
    .update(canonical, 'utf8')
    .digest('hex');

  return Object.freeze({
    fixture_uid: fixtureUid,
    transition_version: transitionVersion,
    from_state: fromState,
    to_state: toState,
    from_stage: fromStage,
    to_stage: toStage,
    reason_category: reasonCategory,
    source_actor: sourceActor,
    source_ref: sourceRef || null,
    occurred_at: occurredAt.toISOString(),
    idempotency_key: idempotencyKey
  });
}

function calculateRolloverPlan({
  rolloverKey,
  currentProjections = [],
  lastRolloverKey = null
} = {}) {
  if (!parseDateKey(rolloverKey) || !Array.isArray(currentProjections)) {
    return {
      allowed: false,
      code: REJECTION_CODES.ROLLOVER_KEY_INVALID,
      archiveTransitions: [],
      relabelMap: {},
      snapshot: null
    };
  }

  if (lastRolloverKey !== null && lastRolloverKey !== undefined && lastRolloverKey !== '') {
    if (!parseDateKey(lastRolloverKey)) {
      return {
        allowed: false,
        code: REJECTION_CODES.ROLLOVER_KEY_INVALID,
        archiveTransitions: [],
        relabelMap: {},
        snapshot: null
      };
    }

    if (rolloverKey === lastRolloverKey) {
      return {
        allowed: false,
        code: REJECTION_CODES.ROLLOVER_ALREADY_APPLIED,
        archiveTransitions: [],
        relabelMap: {},
        snapshot: null
      };
    }

    if (rolloverKey !== nextDateKey(lastRolloverKey)) {
      return {
        allowed: false,
        code: REJECTION_CODES.ROLLOVER_DATE_GAP,
        expectedRolloverKey: nextDateKey(lastRolloverKey),
        archiveTransitions: [],
        relabelMap: {},
        snapshot: null
      };
    }
  }

  const projections = currentProjections.map((row) => ({ ...row }));
  const archiveTransitions = [];
  const relabelMap = {};

  for (const projection of projections) {
    const fixtureUid = String(projection.fixture_uid || '').trim();
    const dayLabel = normalizeToken(projection.day_label);
    const state = validateState(projection.lifecycle_state);
    if (!fixtureUid || !DAY_LABELS.includes(dayLabel) || !state) continue;

    if (dayLabel === 'TODAY' && ARCHIVABLE_STATES.has(state)) {
      archiveTransitions.push({
        fixture_uid: fixtureUid,
        from_state: state,
        to_state: 'ARCHIVED',
        reason_category: 'TIMING_WINDOW',
        source_actor: 'LIFECYCLE_ROLLOVER'
      });
      continue;
    }

    const index = DAY_LABELS.indexOf(dayLabel);
    if (index > 0) {
      relabelMap[fixtureUid] = DAY_LABELS[index - 1];
    }
  }

  archiveTransitions.sort((a, b) => a.fixture_uid.localeCompare(b.fixture_uid));
  const orderedRelabelMap = Object.fromEntries(
    Object.entries(relabelMap).sort(([a], [b]) => a.localeCompare(b))
  );

  const counts = Object.fromEntries(DAY_LABELS.map((label) => [label, 0]));
  for (const projection of projections) {
    const label = normalizeToken(projection.day_label);
    if (Object.prototype.hasOwnProperty.call(counts, label)) counts[label] += 1;
  }

  const snapshot = Object.freeze({
    rollover_key: rolloverKey,
    previous_rollover_key: lastRolloverKey || null,
    current_projection_count: projections.length,
    fixtures_archived_count: archiveTransitions.length,
    fixtures_carried_forward: Object.keys(orderedRelabelMap).length,
    day8_admitted_count: 0,
    funnel_counts_before: Object.freeze({ ...counts })
  });

  return {
    allowed: true,
    code: null,
    archiveTransitions,
    relabelMap: orderedRelabelMap,
    snapshot
  };
}

module.exports = {
  LIFECYCLE_TIMEZONE,
  LIFECYCLE_FEATURE_FLAG,
  PROCESSING_TOLERANCE_MS,
  LIFECYCLE_STATES,
  LIFECYCLE_STAGES,
  DAY_LABELS,
  GOVERNED_REASON_CATEGORIES,
  LEGAL_STATE_TRANSITIONS,
  REJECTION_CODES,
  normalizeFeatureFlag,
  isAuthorizedGateStatus,
  evaluateGovernorGate,
  calculateSastWindow,
  calculateDayLabel,
  evaluateAdmission,
  evaluateTransition,
  buildTransitionEvent,
  calculateRolloverPlan,
  formatSastDateKey
};
