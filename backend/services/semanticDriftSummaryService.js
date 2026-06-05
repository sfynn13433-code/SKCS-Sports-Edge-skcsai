'use strict';

const { query } = require('../db');
const verificationController = require('../core/verificationController');
const { CONTROL_STATES } = require('../semantic-layer/controlPlaneEvaluator');

const DEFAULT_WINDOW_HOURS = Math.max(1, Number(process.env.SEMANTIC_DRIFT_SUMMARY_WINDOW_HOURS || 24));

function toIsoString(value) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function defaultSince(hours = DEFAULT_WINDOW_HOURS) {
    return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function readJson(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_error) {
        return {};
    }
}

function normalizeSummaryPayload(payload = {}) {
    const summary = readJson(payload);
    const bySeverity = summary.by_severity && typeof summary.by_severity === 'object' ? summary.by_severity : {};
    const byType = summary.by_type && typeof summary.by_type === 'object' ? summary.by_type : {};
    const driftVelocity = summary.drift_velocity && typeof summary.drift_velocity === 'object' ? summary.drift_velocity : {};
    const window = summary.window && typeof summary.window === 'object' ? summary.window : {};
    const totalViolations = Number(summary.total_violations || 0);
    const warningViolations = Number(summary.warning_violations ?? bySeverity.warning ?? 0);
    const criticalViolations = Number(summary.critical_violations ?? bySeverity.critical ?? 0);
    const blockedViolations = Number(summary.blocked_violations ?? bySeverity.blocked ?? 0);
    const trend = String(driftVelocity.trend || 'stable').trim().toLowerCase() || 'stable';
    const recentCriticals = Array.isArray(summary.recent_criticals) ? summary.recent_criticals : [];

    return {
        ...summary,
        window,
        by_severity: bySeverity,
        by_type: byType,
        drift_velocity: {
            per_hour_last_24h: Array.isArray(driftVelocity.per_hour_last_24h) ? driftVelocity.per_hour_last_24h : [],
            trend
        },
        total_violations: totalViolations,
        critical_violations: criticalViolations,
        warning_violations: warningViolations,
        blocked_violations: blockedViolations,
        degraded_flag: Boolean(summary.degraded_flag),
        canonical_integrity_broken: Boolean(summary.canonical_integrity_broken),
        recent_criticals: recentCriticals,
        pipeline: String(summary.pipeline || 'unknown').trim() || 'unknown',
        provider: summary.provider == null ? null : String(summary.provider).trim() || null
    };
}

function mapControlStateToSystemState(controlState) {
    switch (String(controlState || '').trim().toUpperCase()) {
        case CONTROL_STATES.PASS:
            return 'HEALTHY';
        case CONTROL_STATES.WARN:
            return 'WARN';
        case CONTROL_STATES.DEGRADED:
            return 'DEGRADED';
        case CONTROL_STATES.FAIL:
            return 'CRITICAL';
        default:
            return 'UNKNOWN';
    }
}

function buildControlInput(summary = {}, options = {}) {
    const sinceIso = options.since ? toIsoString(options.since) : null;
    const windowStart = sinceIso || toIsoString(defaultSince());
    const windowHours = Math.max(
        1,
        Number(options.windowHours || Math.round((Date.now() - new Date(windowStart).getTime()) / (60 * 60 * 1000)) || DEFAULT_WINDOW_HOURS)
    );
    const batchSize = Math.max(100, windowHours * 100);

    return {
        pipeline: summary.pipeline || options.pipeline || 'semanticDrift',
        provider: summary.provider || options.provider || null,
        totalViolations: summary.total_violations,
        criticalViolations: summary.critical_violations,
        warningViolations: summary.warning_violations,
        blockedViolations: summary.blocked_violations,
        degradedFlag: summary.degraded_flag,
        canonicalIntegrityBroken: summary.canonical_integrity_broken,
        trend: summary.drift_velocity?.trend || 'stable',
        driftVelocity: summary.drift_velocity,
        recentCriticals: summary.recent_criticals,
        batchSize
    };
}

async function fetchSemanticDriftSummary(options = {}) {
    const since = options.since ? new Date(options.since) : defaultSince();
    const sinceIso = toIsoString(since) || toIsoString(defaultSince());
    const pipeline = options.pipeline ? String(options.pipeline).trim() || null : null;
    const provider = options.provider ? String(options.provider).trim() || null : null;

    const { rows } = await query(
        'SELECT public.get_semantic_violation_summary($1::timestamptz, $2::text, $3::text) AS summary',
        [sinceIso, pipeline, provider]
    );

    const rawSummary = rows?.[0]?.summary || rows?.[0]?.get_semantic_violation_summary || rows?.[0] || {};
    const summary = normalizeSummaryPayload(rawSummary);
    const controlDecision = verificationController.evaluateControlPlane(buildControlInput(summary, {
        since: sinceIso,
        pipeline,
        provider
    }));

    return {
        summary,
        controlDecision,
        systemState: mapControlStateToSystemState(controlDecision.state),
        since: sinceIso
    };
}

module.exports = {
    buildControlInput,
    defaultSince,
    fetchSemanticDriftSummary,
    mapControlStateToSystemState,
    normalizeSummaryPayload
};
