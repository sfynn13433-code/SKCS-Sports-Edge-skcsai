'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const governor = require('../backend/services/lifecycleGovernor');

const {
  LIFECYCLE_TIMEZONE,
  PROCESSING_TOLERANCE_MS,
  LIFECYCLE_STAGES,
  LEGAL_STATE_TRANSITIONS,
  REJECTION_CODES,
  normalizeFeatureFlag,
  evaluateGovernorGate,
  calculateSastWindow,
  calculateDayLabel,
  evaluateAdmission,
  evaluateTransition,
  buildTransitionEvent,
  calculateRolloverPlan
} = governor;

function authorizedReader(status = 'APPROVED') {
  return {
    async readLifecycleGovernorGate() {
      return {
        unifiedLifecycleGovernor: status,
        scoutEdgeMarriageGate: 'BLOCKED',
        supabaseStorageGate: 'BLOCKED',
        source: 'EDGE_BUILD_CONTROL_LEDGER.v1.json'
      };
    }
  };
}

test('feature flag normalization accepts only boolean true or string true', () => {
  assert.equal(normalizeFeatureFlag(true), true);
  assert.equal(normalizeFeatureFlag('true'), true);
  assert.equal(normalizeFeatureFlag(' TRUE '), true);
  for (const value of [false, undefined, null, '', 'false', '1', 'yes', 1]) {
    assert.equal(normalizeFeatureFlag(value), false);
  }
});

test('governor gate fails closed for missing, throwing, malformed or blocked readers', async () => {
  assert.deepEqual(
    await evaluateGovernorGate({ featureFlagEnabled: true }),
    { allowed: false, code: REJECTION_CODES.LIFECYCLE_GATE_BLOCKED }
  );

  assert.deepEqual(
    await evaluateGovernorGate({
      gateReader: { async readLifecycleGovernorGate() { throw new Error('no ledger'); } },
      featureFlagEnabled: true
    }),
    { allowed: false, code: REJECTION_CODES.LIFECYCLE_GATE_BLOCKED }
  );

  assert.deepEqual(
    await evaluateGovernorGate({
      gateReader: { async readLifecycleGovernorGate() { return {}; } },
      featureFlagEnabled: true
    }),
    { allowed: false, code: REJECTION_CODES.LIFECYCLE_GATE_BLOCKED }
  );

  assert.equal(
    (await evaluateGovernorGate({
      gateReader: authorizedReader('BLOCKED'),
      featureFlagEnabled: true
    })).code,
    REJECTION_CODES.LIFECYCLE_GATE_BLOCKED
  );
});

test('governor gate checks feature flag only after authorization', async () => {
  const disabled = await evaluateGovernorGate({
    gateReader: authorizedReader(),
    featureFlagEnabled: false
  });
  assert.equal(disabled.allowed, false);
  assert.equal(disabled.code, REJECTION_CODES.LIFECYCLE_FEATURE_DISABLED);

  const allowed = await evaluateGovernorGate({
    gateReader: authorizedReader(),
    featureFlagEnabled: 'true'
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.gates.source, 'EDGE_BUILD_CONTROL_LEDGER.v1.json');
});

test('SAST window is deterministic and eight calendar days', () => {
  const result = calculateSastWindow({
    evaluationTime: new Date('2026-07-14T22:30:00.000Z')
  });
  assert.equal(result.timezone, LIFECYCLE_TIMEZONE);
  assert.equal(result.windowStart.toISOString(), '2026-07-14T22:00:00.000Z');
  assert.equal(result.windowEnd.toISOString(), '2026-07-22T22:00:00.000Z');
});

test('all eight SAST day labels and exclusive end boundary', () => {
  const evaluationTime = new Date('2026-07-14T10:00:00.000Z');
  const expected = ['TODAY', 'DAY_2', 'DAY_3', 'DAY_4', 'DAY_5', 'DAY_6', 'DAY_7', 'DAY_8'];

  expected.forEach((label, index) => {
    const kickoffAt = new Date(Date.UTC(2026, 6, 14 + index, 10, 0, 0));
    assert.equal(calculateDayLabel({ kickoffAt, evaluationTime }), label);
  });

  assert.equal(
    calculateDayLabel({
      kickoffAt: new Date('2026-07-13T21:59:59.999Z'),
      evaluationTime
    }),
    null
  );
  assert.equal(
    calculateDayLabel({
      kickoffAt: new Date('2026-07-21T22:00:00.000Z'),
      evaluationTime
    }),
    null
  );
});

test('admission is football-only and rejects new fixtures at kickoff', () => {
  const gateResult = { allowed: true };
  const evaluationTime = new Date('2026-07-14T10:00:00.000Z');

  assert.equal(evaluateAdmission({
    sport: 'cricket',
    kickoffAt: new Date('2026-07-14T11:00:00.000Z'),
    evaluationTime,
    gateResult
  }).code, REJECTION_CODES.SPORT_NOT_ACTIVE);

  assert.equal(evaluateAdmission({
    sport: 'football',
    kickoffAt: evaluationTime,
    evaluationTime,
    gateResult
  }).code, REJECTION_CODES.FIXTURE_ALREADY_STARTED);

  const allowed = evaluateAdmission({
    sport: ' Football ',
    kickoffAt: new Date('2026-07-14T11:00:00.000Z'),
    evaluationTime,
    gateResult
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.dayLabel, 'TODAY');
});

test('existing fixture processing tolerance is inclusive through exactly 15 minutes', () => {
  const kickoffAt = new Date('2026-07-14T10:00:00.000Z');
  const gateResult = { allowed: true };
  const base = {
    sport: 'football',
    kickoffAt,
    gateResult,
    existingFixtureUid: 'fixture-1'
  };

  assert.equal(evaluateAdmission({
    ...base,
    evaluationTime: new Date(kickoffAt.getTime() - 1)
  }).processingCandidate, true);

  assert.equal(evaluateAdmission({
    ...base,
    evaluationTime: kickoffAt
  }).processingCandidate, true);

  assert.equal(evaluateAdmission({
    ...base,
    evaluationTime: new Date(kickoffAt.getTime() + PROCESSING_TOLERANCE_MS - 1)
  }).processingCandidate, true);

  assert.equal(evaluateAdmission({
    ...base,
    evaluationTime: new Date(kickoffAt.getTime() + PROCESSING_TOLERANCE_MS)
  }).processingCandidate, true);

  assert.equal(evaluateAdmission({
    ...base,
    evaluationTime: new Date(kickoffAt.getTime() + PROCESSING_TOLERANCE_MS + 1)
  }).processingCandidate, false);
});

test('every legal state transition is accepted with a valid reason', () => {
  const evaluationTime = new Date('2026-07-14T10:00:00.000Z');

  for (const [fromState, targets] of Object.entries(LEGAL_STATE_TRANSITIONS)) {
    for (const toState of targets) {
      const current = fromState === '__ADMISSION__'
        ? null
        : {
            lifecycle_state: fromState,
            lifecycle_stage: 'ADMITTED',
            transition_version: 1,
            kickoff_at: '2026-07-14T12:00:00.000Z'
          };

      const result = evaluateTransition({
        current,
        requested: {
          to_state: toState,
          to_stage: fromState === '__ADMISSION__' ? 'ADMITTED' : 'ADMITTED',
          reason_category: toState === 'FINAL_APPROVED' ? 'APPROVED' : 'TIMING_WINDOW',
          source_actor: 'TEST'
        },
        evaluationTime
      });

      assert.equal(result.allowed, true, `${fromState} -> ${toState}`);
    }
  }
});

test('illegal transition, missing reason and stage regression fail closed', () => {
  const evaluationTime = new Date('2026-07-14T10:00:00.000Z');
  const current = {
    lifecycle_state: 'VISIBLE',
    lifecycle_stage: 'PUBLICATION_REVIEW',
    transition_version: 1,
    kickoff_at: '2026-07-14T12:00:00.000Z'
  };

  assert.equal(evaluateTransition({
    current,
    requested: {
      to_state: 'FINAL_APPROVED',
      reason_category: 'APPROVED',
      source_actor: 'TEST'
    },
    evaluationTime
  }).code, REJECTION_CODES.LIFECYCLE_TRANSITION_NOT_ALLOWED);

  assert.equal(evaluateTransition({
    current,
    requested: {
      to_state: 'UNDER_REVIEW',
      source_actor: 'TEST'
    },
    evaluationTime
  }).code, REJECTION_CODES.LIFECYCLE_REASON_REQUIRED);

  assert.equal(evaluateTransition({
    current,
    requested: {
      to_state: 'UNDER_REVIEW',
      to_stage: 'EVIDENCE_REVIEW',
      reason_category: 'TIMING_WINDOW',
      source_actor: 'TEST'
    },
    evaluationTime
  }).code, REJECTION_CODES.LIFECYCLE_STAGE_REGRESSION_NOT_ALLOWED);
});

test('POSTPONED and CANCELLED remain distinct and postponement revokes publication eligibility', () => {
  const current = {
    lifecycle_state: 'FINAL_APPROVED',
    lifecycle_stage: 'FINAL_DECISION',
    transition_version: 4,
    kickoff_at: '2026-07-14T12:00:00.000Z'
  };
  const evaluationTime = new Date('2026-07-14T10:00:00.000Z');

  const postponed = evaluateTransition({
    current,
    requested: {
      to_state: 'POSTPONED',
      reason_category: 'MATCH_POSTPONED',
      source_actor: 'SCOUT'
    },
    evaluationTime
  });
  const cancelled = evaluateTransition({
    current,
    requested: {
      to_state: 'CANCELLED',
      reason_category: 'MATCH_CANCELLED',
      source_actor: 'SCOUT'
    },
    evaluationTime
  });

  assert.equal(postponed.allowed, true);
  assert.equal(postponed.effects.publication_eligible, false);
  assert.equal(postponed.effects.governed_revocation_required, true);
  assert.equal(cancelled.allowed, true);
  assert.notEqual(postponed.toState, cancelled.toState);
});

test('stage advancement is restricted to the governed review and publication path', () => {
  const evaluationTime = new Date('2026-07-14T08:00:00.000Z');
  const kickoffAt = new Date('2026-07-14T12:00:00.000Z');

  const visibleAdvance = evaluateTransition({
    current: {
      lifecycle_state: 'VISIBLE',
      lifecycle_stage: 'ADMITTED',
      transition_version: 1,
      kickoff_at: kickoffAt
    },
    requested: {
      to_state: 'HELD',
      to_stage: 'EVIDENCE_REVIEW',
      reason_category: 'CONTROL_PLANE_HOLD',
      source_actor: 'governor'
    },
    evaluationTime
  });

  assert.deepEqual(visibleAdvance, {
    allowed: false,
    code: REJECTION_CODES.LIFECYCLE_TRANSITION_NOT_ALLOWED
  });

  const heldAdvance = evaluateTransition({
    current: {
      lifecycle_state: 'HELD',
      lifecycle_stage: 'EVIDENCE_REVIEW',
      transition_version: 2,
      kickoff_at: kickoffAt
    },
    requested: {
      to_state: 'UNDER_REVIEW',
      to_stage: 'CONTEXT_REVIEW',
      reason_category: 'APPROVED',
      source_actor: 'operator'
    },
    evaluationTime
  });

  assert.equal(heldAdvance.allowed, true);
  assert.equal(heldAdvance.toState, 'UNDER_REVIEW');
  assert.equal(heldAdvance.toStage, 'CONTEXT_REVIEW');

  const postponedAdvance = evaluateTransition({
    current: {
      lifecycle_state: 'POSTPONED',
      lifecycle_stage: 'EVIDENCE_REVIEW',
      transition_version: 3,
      kickoff_at: kickoffAt
    },
    requested: {
      to_state: 'VISIBLE',
      to_stage: 'CONTEXT_REVIEW',
      reason_category: 'MATCH_POSTPONED',
      source_actor: 'sports_truth'
    },
    evaluationTime
  });

  assert.deepEqual(postponedAdvance, {
    allowed: false,
    code: REJECTION_CODES.LIFECYCLE_TRANSITION_NOT_ALLOWED
  });

  const postponedReset = evaluateTransition({
    current: {
      lifecycle_state: 'POSTPONED',
      lifecycle_stage: 'EVIDENCE_REVIEW',
      transition_version: 3,
      kickoff_at: kickoffAt
    },
    requested: {
      to_state: 'VISIBLE',
      to_stage: 'ADMITTED',
      reason_category: 'MATCH_POSTPONED',
      source_actor: 'sports_truth'
    },
    evaluationTime
  });

  assert.equal(postponedReset.allowed, true);
  assert.equal(postponedReset.toStage, 'ADMITTED');

  for (const lifecycleState of ['ELIMINATED', 'CANCELLED', 'ARCHIVED']) {
    const result = evaluateTransition({
      current: {
        lifecycle_state: lifecycleState,
        lifecycle_stage: 'EVIDENCE_REVIEW',
        transition_version: 4,
        kickoff_at: kickoffAt
      },
      requested: {
        to_state: 'ARCHIVED',
        to_stage: 'CONTEXT_REVIEW',
        reason_category: 'TIMING_WINDOW',
        source_actor: 'rollover_job'
      },
      evaluationTime
    });

    assert.equal(result.allowed, false);
  }

  const reviewAdvance = evaluateTransition({
    current: {
      lifecycle_state: 'UNDER_REVIEW',
      lifecycle_stage: 'PUBLICATION_REVIEW',
      transition_version: 5,
      kickoff_at: kickoffAt
    },
    requested: {
      to_state: 'FINAL_APPROVED',
      to_stage: 'FINAL_DECISION',
      reason_category: 'APPROVED',
      source_actor: 'governor'
    },
    evaluationTime
  });

  assert.equal(reviewAdvance.allowed, true);
  assert.equal(reviewAdvance.toStage, 'FINAL_DECISION');
});

test('transition evaluation does not mutate its inputs', () => {
  const current = Object.freeze({
    lifecycle_state: 'VISIBLE',
    lifecycle_stage: 'ADMITTED',
    transition_version: 1,
    kickoff_at: '2026-07-14T12:00:00.000Z'
  });
  const requested = Object.freeze({
    to_state: 'UNDER_REVIEW',
    to_stage: 'EVIDENCE_REVIEW',
    reason_category: 'TIMING_WINDOW',
    source_actor: 'TEST'
  });

  const beforeCurrent = JSON.stringify(current);
  const beforeRequested = JSON.stringify(requested);

  assert.equal(evaluateTransition({
    current,
    requested,
    evaluationTime: new Date('2026-07-14T10:00:00.000Z')
  }).allowed, true);

  assert.equal(JSON.stringify(current), beforeCurrent);
  assert.equal(JSON.stringify(requested), beforeRequested);
});

test('transition event uses exact deterministic SHA-256 formula', () => {
  const input = {
    fixtureUid: 'fixture-123',
    transitionVersion: 2,
    fromState: 'VISIBLE',
    toState: 'UNDER_REVIEW',
    fromStage: 'ADMITTED',
    toStage: 'EVIDENCE_REVIEW',
    reasonCategory: 'TIMING_WINDOW',
    sourceActor: 'SCOUT',
    sourceRef: 'run-1',
    occurredAt: new Date('2026-07-14T10:00:00.999Z')
  };

  const event = buildTransitionEvent(input);
  const canonical = [
    'fixture-123',
    'UNDER_REVIEW',
    'EVIDENCE_REVIEW',
    'TIMING_WINDOW',
    'SCOUT',
    'run-1',
    Math.floor(input.occurredAt.getTime() / 1000)
  ].join('|');

  const expected = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  assert.equal(event.idempotency_key, expected);
  assert.equal(buildTransitionEvent({
    ...input,
    occurredAt: new Date('2026-07-14T10:00:00.001Z')
  }).idempotency_key, expected);

  assert.notEqual(buildTransitionEvent({
    ...input,
    sourceRef: 'run-2'
  }).idempotency_key, expected);
});

test('rollover plan is deterministic, rejects duplicates and gaps, and does not mutate input', () => {
  const projections = [
    { fixture_uid: 'b', day_label: 'DAY_2', lifecycle_state: 'VISIBLE', kickoff_at: '2026-07-15T12:00:00Z' },
    { fixture_uid: 'a', day_label: 'TODAY', lifecycle_state: 'FINAL_APPROVED', kickoff_at: '2026-07-14T12:00:00Z' }
  ];
  const before = JSON.stringify(projections);

  const result = calculateRolloverPlan({
    rolloverKey: '2026-07-15',
    lastRolloverKey: '2026-07-14',
    currentProjections: projections
  });

  assert.equal(result.allowed, true);
  assert.deepEqual(result.archiveTransitions.map((x) => x.fixture_uid), ['a']);
  assert.deepEqual(result.relabelMap, { b: 'TODAY' });
  assert.equal(JSON.stringify(projections), before);

  assert.equal(calculateRolloverPlan({
    rolloverKey: '2026-07-14',
    lastRolloverKey: '2026-07-14',
    currentProjections: []
  }).code, REJECTION_CODES.ROLLOVER_ALREADY_APPLIED);

  assert.equal(calculateRolloverPlan({
    rolloverKey: '2026-07-16',
    lastRolloverKey: '2026-07-14',
    currentProjections: []
  }).code, REJECTION_CODES.ROLLOVER_DATE_GAP);
});

test('module is isolated from DB, Supabase, SQL and protected pipeline modules', () => {
  const source = require('node:fs').readFileSync(
    require.resolve('../backend/services/lifecycleGovernor'),
    'utf8'
  );

  for (const forbidden of [
    "require('../db')",
    "require('../database')",
    '@supabase/supabase-js',
    "require('pg')",
    'predictions_raw',
    'direct1x2_prediction_final',
    'fixture_context_cache',
    'aiPipeline',
    'fipIntakeService',
    'syncService'
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
