'use strict';

const CONTROL_STATES = Object.freeze({
    PASS: 'PASS',
    WARN: 'WARN',
    DEGRADED: 'DEGRADED',
    FAIL: 'FAIL'
});

const DEFAULT_THRESHOLDS = Object.freeze({
    warnViolations: 5,
    degradedViolations: 10,
    failViolations: 20,
    warnViolationRate: 0.01,
    degradedViolationRate: 0.03,
    failViolationRate: 0.05,
    warnCriticalViolations: 1,
    degradedCriticalViolations: 1,
    failCriticalViolations: 2,
    warnBlockedViolations: 1,
    degradedBlockedViolations: 1,
    failBlockedViolations: 1,
    warnConfidenceCap: 92,
    degradedConfidenceCap: 75,
    smoothingByTrend: {
        rising: 1.15,
        stable: 1.0,
        falling: 0.9
    }
});

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function normalizeTrend(value) {
    const key = String(value || '').trim().toLowerCase();
    if (key === 'rising' || key === 'up' || key === 'increasing') return 'rising';
    if (key === 'falling' || key === 'down' || key === 'decreasing') return 'falling';
    return 'stable';
}

function mergeThresholds(base, overrides) {
    const merged = { ...base, ...(overrides || {}) };
    merged.smoothingByTrend = {
        ...base.smoothingByTrend,
        ...((overrides && overrides.smoothingByTrend) || {})
    };
    return merged;
}

function derivePipelineThresholds(pipeline, options = {}) {
    const defaultThresholds = mergeThresholds(DEFAULT_THRESHOLDS, options.thresholds || {});
    const pipelineOverrides = options.pipelineThresholds || {};
    const match = pipeline && pipelineOverrides && pipelineOverrides[pipeline]
        ? pipelineOverrides[pipeline]
        : null;
    return mergeThresholds(defaultThresholds, match || {});
}

function summarizeSignals(signals = []) {
    const normalizedSignals = Array.isArray(signals) ? signals.filter(Boolean) : [];
    const severityCounts = normalizedSignals.reduce((acc, signal) => {
        const severity = String(signal?.severity || 'UNKNOWN').trim().toUpperCase();
        acc[severity] = (acc[severity] || 0) + 1;
        return acc;
    }, {});

    const typeCounts = normalizedSignals.reduce((acc, signal) => {
        const type = String(signal?.type || 'unknown').trim().toLowerCase();
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});

    const pipelineCounts = normalizedSignals.reduce((acc, signal) => {
        const pipeline = String(signal?.metadata?.pipeline || signal?.source || 'unknown').trim();
        acc[pipeline] = (acc[pipeline] || 0) + 1;
        return acc;
    }, {});

    const criticalSignals = normalizedSignals.filter((signal) => {
        const severity = String(signal?.severity || '').trim().toUpperCase();
        return severity === CONTROL_STATES.FAIL || severity === 'CRITICAL' || severity === 'BLOCKED';
    });

    const trend = normalizeTrend(
        normalizedSignals.find((signal) => signal?.metadata?.trend)?.metadata?.trend
        || normalizedSignals.find((signal) => signal?.metadata?.driftTrend)?.metadata?.driftTrend
    );

    return {
        pipeline: normalizedSignals.find((signal) => signal?.metadata?.pipeline)?.metadata?.pipeline
            || normalizedSignals[0]?.source
            || 'unknown',
        provider: normalizedSignals.find((signal) => signal?.metadata?.provider)?.metadata?.provider || null,
        totalViolations: normalizedSignals.length,
        criticalViolations: criticalSignals.length,
        warningViolations: normalizedSignals.filter((signal) => String(signal?.severity || '').trim().toUpperCase() === 'WARN').length,
        blockedViolations: normalizedSignals.filter((signal) => String(signal?.severity || '').trim().toUpperCase() === 'BLOCKED').length,
        degradedFlag: normalizedSignals.some((signal) => signal?.metadata?.degradedFlag === true || signal?.metadata?.forceDegraded === true),
        canonicalIntegrityBroken: normalizedSignals.some((signal) => signal?.rule_id === 'IDENTITY_REQUIRED' || signal?.violation_type === 'MISSING_CANONICAL_ID'),
        recentCriticals: criticalSignals.slice(0, 10),
        trend,
        driftVelocity: normalizedSignals.find((signal) => signal?.metadata?.driftVelocity)?.metadata?.driftVelocity || null,
        batchSize: normalizedSignals.find((signal) => Number.isFinite(Number(signal?.metadata?.batchSize)))?.metadata?.batchSize || null,
        severityCounts,
        typeCounts,
        pipelineCounts,
        signals: normalizedSignals
    };
}

function scoreSummary(summary, thresholds) {
    const trend = normalizeTrend(summary.trend);
    const smoothing = thresholds.smoothingByTrend[trend] ?? 1.0;
    const effectiveViolations = summary.totalViolations * smoothing;
    const batchSize = Math.max(1, toNumber(summary.batchSize, summary.totalViolations || 1));
    const violationRate = summary.violationRate != null
        ? clamp(toNumber(summary.violationRate, 0), 0, 1)
        : clamp(effectiveViolations / batchSize, 0, 1);

    let score = 100;
    score -= summary.totalViolations * 1.5;
    score -= summary.warningViolations * 0.75;
    score -= summary.criticalViolations * 8;
    score -= summary.blockedViolations * 12;
    score -= violationRate * 100;
    if (trend === 'rising') score -= 5;
    if (trend === 'falling') score += 3;
    if (summary.degradedFlag) score -= 10;
    if (summary.canonicalIntegrityBroken) score -= 15;
    score = clamp(Math.round(score), 0, 100);

    return {
        score,
        effectiveViolations,
        violationRate,
        trend,
        smoothing
    };
}

function deriveActionProfile(state, thresholds, summary, scoreInfo) {
    switch (state) {
        case CONTROL_STATES.FAIL:
            return {
                allowWrite: false,
                allowPublish: false,
                allowEnrichment: false,
                useFallback: false,
                useBaselineModel: false,
                capConfidence: true,
                confidenceCap: 0,
                quarantine: true,
                state
            };
        case CONTROL_STATES.DEGRADED:
            return {
                allowWrite: true,
                allowPublish: true,
                allowEnrichment: false,
                useFallback: true,
                useBaselineModel: true,
                capConfidence: true,
                confidenceCap: thresholds.degradedConfidenceCap,
                quarantine: false,
                state
            };
        case CONTROL_STATES.WARN:
            return {
                allowWrite: true,
                allowPublish: true,
                allowEnrichment: true,
                useFallback: false,
                useBaselineModel: false,
                capConfidence: true,
                confidenceCap: thresholds.warnConfidenceCap,
                quarantine: false,
                state
            };
        case CONTROL_STATES.PASS:
        default:
            return {
                allowWrite: true,
                allowPublish: true,
                allowEnrichment: true,
                useFallback: false,
                useBaselineModel: false,
                capConfidence: false,
                confidenceCap: null,
                quarantine: false,
                state
            };
    }
}

function evaluateControlPlane(summary = {}, options = {}) {
    const normalizedSummary = {
        totalViolations: toNumber(summary.totalViolations ?? summary.total_violations, 0),
        criticalViolations: toNumber(summary.criticalViolations ?? summary.critical_violations, 0),
        warningViolations: toNumber(summary.warningViolations ?? summary.warning_violations, 0),
        blockedViolations: toNumber(summary.blockedViolations ?? summary.blocked_violations, 0),
        degradedFlag: Boolean(summary.degradedFlag ?? summary.degraded_flag),
        canonicalIntegrityBroken: Boolean(summary.canonicalIntegrityBroken ?? summary.canonical_integrity_broken),
        pipeline: String(summary.pipeline || summary.source || 'unknown').trim() || 'unknown',
        provider: summary.provider || null,
        trend: normalizeTrend(summary.trend),
        driftVelocity: summary.driftVelocity || summary.drift_velocity || null,
        recentCriticals: Array.isArray(summary.recentCriticals || summary.recent_criticals)
            ? (summary.recentCriticals || summary.recent_criticals)
            : [],
        batchSize: summary.batchSize ?? summary.batch_size ?? null,
        violationRate: summary.violationRate ?? summary.violation_rate ?? null
    };

    const thresholds = derivePipelineThresholds(normalizedSummary.pipeline, options);
    const scoreInfo = scoreSummary(normalizedSummary, thresholds);
    const reasons = [];

    if (normalizedSummary.canonicalIntegrityBroken) {
        reasons.push('Canonical identity is broken.');
    }
    if (normalizedSummary.degradedFlag) {
        reasons.push('Summary marked degraded.');
    }
    if (normalizedSummary.criticalViolations > 0) {
        reasons.push(`Critical violations present: ${normalizedSummary.criticalViolations}.`);
    }
    if (normalizedSummary.blockedViolations > 0) {
        reasons.push(`Blocked semantic violations present: ${normalizedSummary.blockedViolations}.`);
    }

    let state = CONTROL_STATES.PASS;

    if (normalizedSummary.canonicalIntegrityBroken || scoreInfo.score < 35) {
        state = CONTROL_STATES.FAIL;
    } else if (
        normalizedSummary.degradedFlag
        || normalizedSummary.criticalViolations >= thresholds.degradedCriticalViolations
        || normalizedSummary.blockedViolations >= thresholds.degradedBlockedViolations
        || scoreInfo.effectiveViolations >= thresholds.degradedViolations
        || scoreInfo.violationRate >= thresholds.degradedViolationRate
    ) {
        state = CONTROL_STATES.DEGRADED;
    } else if (
        scoreInfo.effectiveViolations >= thresholds.warnViolations
        || scoreInfo.violationRate >= thresholds.warnViolationRate
        || normalizedSummary.warningViolations > 0
        || normalizedSummary.recentCriticals.length > 0
    ) {
        state = CONTROL_STATES.WARN;
    }

    if (
        state === CONTROL_STATES.FAIL
        && !normalizedSummary.canonicalIntegrityBroken
        && scoreInfo.trend === 'falling'
        && normalizedSummary.criticalViolations === 0
        && normalizedSummary.blockedViolations === 0
        && scoreInfo.score >= 35
    ) {
        state = CONTROL_STATES.DEGRADED;
        reasons.push('Anomaly smoothing downgraded an isolated spike.');
    }

    if (state === CONTROL_STATES.WARN && scoreInfo.trend === 'rising' && scoreInfo.score < 60) {
        state = CONTROL_STATES.DEGRADED;
        reasons.push('Rising drift trend escalated warning to degraded.');
    }

    if (state === CONTROL_STATES.PASS && scoreInfo.score < 90 && normalizedSummary.totalViolations > 0) {
        state = CONTROL_STATES.WARN;
    }

    const actions = deriveActionProfile(state, thresholds, normalizedSummary, scoreInfo);

    return {
        state,
        reasons,
        actions,
        healthScore: scoreInfo.score,
        thresholds,
        summary: normalizedSummary,
        drift: {
            trend: scoreInfo.trend,
            effectiveViolations: scoreInfo.effectiveViolations,
            violationRate: scoreInfo.violationRate,
            smoothing: scoreInfo.smoothing
        }
    };
}

function evaluate() {
    try {
        const verificationController = require('../core/verificationController');
        const snapshot = verificationController.getSnapshot ? verificationController.getSnapshot() : {};
        return snapshot?.controlPlane || {
            state: snapshot?.state || CONTROL_STATES.PASS,
            reasons: Array.isArray(snapshot?.reasons) ? snapshot.reasons : [],
            actions: snapshot?.actions || deriveActionProfile(CONTROL_STATES.PASS, DEFAULT_THRESHOLDS, {}, {
                score: 100,
                effectiveViolations: 0,
                violationRate: 0,
                trend: 'stable',
                smoothing: 1
            }),
            healthScore: Number.isFinite(Number(snapshot?.healthScore)) ? Number(snapshot.healthScore) : 100,
            summary: snapshot?.pipelineMetrics || null,
            drift: snapshot?.controlPlane?.drift || {
                trend: 'stable',
                effectiveViolations: 0,
                violationRate: 0,
                smoothing: 1
            }
        };
    } catch {
        return {
            state: CONTROL_STATES.PASS,
            reasons: [],
            actions: deriveActionProfile(CONTROL_STATES.PASS, DEFAULT_THRESHOLDS, {}, {
                score: 100,
                effectiveViolations: 0,
                violationRate: 0,
                trend: 'stable',
                smoothing: 1
            }),
            healthScore: 100,
            summary: null,
            drift: {
                trend: 'stable',
                effectiveViolations: 0,
                violationRate: 0,
                smoothing: 1
            }
        };
    }
}

module.exports = {
    CONTROL_STATES,
    DEFAULT_THRESHOLDS,
    evaluateControlPlane,
    summarizeSignals,
    evaluate,
    controlPlaneEvaluator: {
        CONTROL_STATES,
        DEFAULT_THRESHOLDS,
        evaluateControlPlane,
        summarizeSignals,
        evaluate
    }
};
