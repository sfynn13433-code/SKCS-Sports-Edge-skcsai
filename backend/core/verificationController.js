'use strict';

const { query } = require('../db');
const {
    SIGNAL_TYPES,
    SIGNAL_STATUS,
    FAILURE_TYPES,
    createVerificationSignal,
    isVerificationSignal
} = require('./verificationSignalContract');
const {
    CONTROL_STATES,
    evaluateControlPlane,
    summarizeSignals
} = require('../semantic-layer/controlPlaneEvaluator');

function isMissingSchemaError(error = {}) {
    const message = String(error?.message || '');
    return /does not exist|column .* does not exist|relation .* does not exist/i.test(message);
}

const SYSTEM_STATES = Object.freeze({
    UNKNOWN: 'UNKNOWN',
    HEALTHY: 'HEALTHY',
    WARN: 'WARN',
    DEGRADED: 'DEGRADED',
    CRITICAL: 'CRITICAL',
    BLOCKED: 'BLOCKED'
});

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function mapControlStateToSystemState(controlState) {
    switch (String(controlState || '').trim().toUpperCase()) {
        case CONTROL_STATES.PASS:
            return SYSTEM_STATES.HEALTHY;
        case CONTROL_STATES.WARN:
            return SYSTEM_STATES.WARN;
        case CONTROL_STATES.DEGRADED:
            return SYSTEM_STATES.DEGRADED;
        case CONTROL_STATES.FAIL:
            return SYSTEM_STATES.CRITICAL;
        default:
            return SYSTEM_STATES.UNKNOWN;
    }
}

function mapSystemStateToControlState(systemState) {
    switch (String(systemState || '').trim().toUpperCase()) {
        case SYSTEM_STATES.HEALTHY:
            return CONTROL_STATES.PASS;
        case SYSTEM_STATES.WARN:
            return CONTROL_STATES.WARN;
        case SYSTEM_STATES.DEGRADED:
            return CONTROL_STATES.DEGRADED;
        case SYSTEM_STATES.CRITICAL:
        case SYSTEM_STATES.BLOCKED:
            return CONTROL_STATES.FAIL;
        default:
            return CONTROL_STATES.PASS;
    }
}

function hasMeaningfulDeepContext(deepContext) {
    if (!deepContext || typeof deepContext !== 'object') {
        return false;
    }

    const standings = deepContext.standings;
    const h2h = deepContext.h2h;

    if (standings && typeof standings === 'object') {
        if (standings.home || standings.away) return true;
    }

    if (h2h && typeof h2h === 'object') {
        const recentMatches = Array.isArray(h2h.recent_matches) ? h2h.recent_matches : [];
        if (recentMatches.length > 0) return true;
        if (Number.isFinite(Number(h2h.total_matches)) && Number(h2h.total_matches) > 0) return true;
    }

    return false;
}

class VerificationController {
    constructor() {
        this.reset();
        void this.hydrateFromLatestSystemHealthState().catch((error) => {
            console.warn('[verificationController] Startup hydration failed:', error.message);
        });
    }

    reset() {
        this._signals = new Map();
        this._history = [];
        this._hydratedFromSystemHealthState = false;
        this._latest = {
            state: SYSTEM_STATES.UNKNOWN,
            controlState: CONTROL_STATES.PASS,
            reasons: [],
            actions: {
                allowWrite: true,
                allowPublish: true,
                useFallback: false
            },
            signals: [],
            pipelineMetrics: null,
            lastUpdatedAt: null,
            controlPlane: null
        };
    }

    _pushHistory(snapshot) {
        this._history.unshift(clone(snapshot));
        if (this._history.length > 25) {
            this._history.length = 25;
        }
    }

    _normalizeSignals(signals) {
        return signals
            .filter(Boolean)
            .map((signal) => {
                if (isVerificationSignal(signal) && signal.severity) {
                    return createVerificationSignal(signal);
                }
                return createVerificationSignal({
                    source: signal.source || signal.type || 'unknown',
                    type: signal.type || signal.source || SIGNAL_TYPES.api,
                    status: signal.status || SIGNAL_STATUS.PASS,
                    failureType: signal.failureType || FAILURE_TYPES.UNKNOWN,
                    severity: signal.severity || SYSTEM_STATES.UNKNOWN,
                    reason: signal.reason || signal.message || '',
                    metadata: signal.metadata || {},
                    timestamp: signal.timestamp || new Date().toISOString()
                });
            });
    }

    _actionTemplate(state) {
        switch (state) {
            case SYSTEM_STATES.CRITICAL:
            case SYSTEM_STATES.BLOCKED:
                return {
                    allowWrite: false,
                    allowPublish: false,
                    useFallback: false
                };
            case SYSTEM_STATES.DEGRADED:
                return {
                    allowWrite: true,
                    allowPublish: true,
                    useFallback: true
                };
            case SYSTEM_STATES.WARN:
                return {
                    allowWrite: true,
                    allowPublish: true,
                    useFallback: false
                };
            case SYSTEM_STATES.HEALTHY:
                return {
                    allowWrite: true,
                    allowPublish: true,
                    useFallback: false
                };
            case SYSTEM_STATES.UNKNOWN:
            default:
                return {
                    allowWrite: true,
                    allowPublish: true,
                    useFallback: false
                };
        }
    }

    configureControlPlaneThresholds(thresholds = {}) {
        this._controlPlaneThresholds = thresholds && typeof thresholds === 'object' ? thresholds : {};
        return this._controlPlaneThresholds;
    }

    async hydrateFromLatestSystemHealthState(forceRefresh = false) {
        if (!forceRefresh && this._hydratedFromSystemHealthState === true) {
            return this.getSnapshot();
        }

        if (this._hydrationPromise) {
            return this._hydrationPromise;
        }

        this._hydrationPromise = (async () => {
            let latestRow = null;
            try {
                const { rows } = await query(
                    `SELECT *
                     FROM public.system_health_state
                     ORDER BY recorded_at DESC
                     LIMIT 1`
                );
                latestRow = rows?.[0] || null;
            } catch (error) {
                if (!isMissingSchemaError(error)) {
                    console.warn('[verificationController] Failed to hydrate system health snapshot:', error.message);
                }
                return this.getSnapshot();
            }

            if (!latestRow) {
                this._hydratedFromSystemHealthState = true;
                return this.getSnapshot();
            }

            const systemState = String(latestRow.current_state || latestRow.state || SYSTEM_STATES.UNKNOWN).trim().toUpperCase();
            const controlState = mapSystemStateToControlState(systemState);
            const actions = {
                allowWrite: latestRow.allow_write !== false,
                allowPublish: latestRow.allow_publish !== false,
                useFallback: latestRow.use_fallback === true
            };
            const reasons = Array.isArray(latestRow.reasons) ? latestRow.reasons : [];
            const controlPlane = {
                state: controlState,
                controlState,
                reasons,
                actions,
                healthScore: Number.isFinite(Number(latestRow.state_score)) ? Number(latestRow.state_score) : null,
                summary: latestRow.snapshot?.pipelineMetrics || latestRow.snapshot?.pipeline_metrics || null,
                drift: latestRow.snapshot?.drift || {
                    trend: 'stable',
                    effectiveViolations: 0,
                    violationRate: 0,
                    smoothing: 1
                }
            };
            const snapshot = {
                state: systemState,
                controlState,
                reasons,
                actions,
                signals: Array.isArray(latestRow.signals) ? latestRow.signals : [],
                pipelineMetrics: latestRow.snapshot?.pipelineMetrics || latestRow.snapshot?.pipeline_metrics || null,
                healthScore: Number.isFinite(Number(latestRow.state_score)) ? Number(latestRow.state_score) : null,
                controlPlane,
                lastUpdatedAt: latestRow.updated_at || latestRow.recorded_at || null,
                source: 'hydrated_system_health_state',
                recordedAt: latestRow.recorded_at || null,
                transitionReason: latestRow.transition_reason || (reasons[0] || null)
            };

            this._latest = snapshot;
            this._pushHistory(snapshot);
            this._hydratedFromSystemHealthState = true;
            return this.getSnapshot();
        })().finally(() => {
            this._hydrationPromise = null;
        });

        return this._hydrationPromise;
    }

    evaluateControlPlane(summary = {}, options = {}) {
        const mergedOptions = {
            ...options,
            pipelineThresholds: {
                ...(this._controlPlaneThresholds || {}),
                ...((options && options.pipelineThresholds) || {})
            }
        };
        return evaluateControlPlane(summary, mergedOptions);
    }

    _commit(signals) {
        const normalizedSignals = this._normalizeSignals(signals);
        if (normalizedSignals.length === 0) {
            this._latest = {
                state: SYSTEM_STATES.UNKNOWN,
                reasons: [],
                actions: this._actionTemplate(SYSTEM_STATES.UNKNOWN),
                signals: [],
                lastUpdatedAt: this._latest.lastUpdatedAt || null
            };
            return this.getSnapshot();
        }

        const evaluation = evaluateControlPlane(summarizeSignals(normalizedSignals), {
            pipelineThresholds: this._controlPlaneThresholds || {}
        });
        const reasons = Array.isArray(evaluation.reasons) && evaluation.reasons.length > 0
            ? evaluation.reasons
            : normalizedSignals
                .filter((signal) => signal.severity !== SYSTEM_STATES.HEALTHY && signal.severity !== SYSTEM_STATES.UNKNOWN)
                .map((signal) => `[${signal.severity}] ${signal.reason || signal.source}`);

        const systemState = mapControlStateToSystemState(evaluation.state);
        const snapshot = {
            state: systemState,
            controlState: evaluation.state,
            reasons,
            actions: evaluation.actions || this._actionTemplate(systemState),
            signals: normalizedSignals,
            healthScore: evaluation.healthScore,
            controlPlane: evaluation,
            lastUpdatedAt: new Date().toISOString()
        };

        this._latest = snapshot;
        this._pushHistory(snapshot);
        void this.persistSystemState(snapshot).catch((error) => {
            console.warn('[verificationController] Failed to persist system health state:', error.message);
        });
        return this.getSnapshot();
    }

    async persistSystemState(snapshot = this.getSnapshot()) {
        if (!snapshot || typeof snapshot !== 'object') {
            return null;
        }

        const signals = Array.isArray(snapshot.signals) ? snapshot.signals : [];
        const reasons = Array.isArray(snapshot.reasons) ? snapshot.reasons : [];
        const activeViolations = signals.filter((signal) => {
            const severity = String(signal?.severity || '').trim().toUpperCase();
            return severity && severity !== SYSTEM_STATES.HEALTHY && severity !== SYSTEM_STATES.UNKNOWN;
        });
        const activeDegradations = signals.filter((signal) => {
            const severity = String(signal?.severity || '').trim().toUpperCase();
            return severity === SYSTEM_STATES.WARN
                || severity === SYSTEM_STATES.DEGRADED
                || severity === SYSTEM_STATES.CRITICAL
                || severity === SYSTEM_STATES.BLOCKED;
        });
        const signalStateFor = (type) => {
            const match = signals.find((signal) => signal?.type === type);
            return String(match?.severity || SYSTEM_STATES.UNKNOWN);
        };

        let previousState = null;
        let previousTransition = null;
        let previousRecordedAt = null;
        try {
            const { rows: previousRows } = await query(
                `SELECT state, last_transition, recorded_at
                 FROM public.system_health_state
                 ORDER BY recorded_at DESC
                 LIMIT 1`
            );
            previousState = previousRows?.[0]?.state || null;
            previousTransition = previousRows?.[0]?.last_transition || null;
            previousRecordedAt = previousRows?.[0]?.recorded_at || null;
        } catch (error) {
            if (!isMissingSchemaError(error)) {
                console.warn('[verificationController] Failed to inspect previous health state:', error.message);
            }
            try {
                const { rows: previousRows } = await query(
                    `SELECT state, recorded_at
                     FROM public.system_health_state
                     ORDER BY recorded_at DESC
                     LIMIT 1`
                );
                previousState = previousRows?.[0]?.state || null;
                previousRecordedAt = previousRows?.[0]?.recorded_at || null;
            } catch (fallbackError) {
                console.warn('[verificationController] Failed to inspect previous health state:', fallbackError.message);
            }
        }

        const nowIso = new Date().toISOString();
        const transitionReason = reasons[0]
            || snapshot.controlPlane?.reasons?.[0]
            || snapshot.controlState
            || 'Control plane snapshot updated.';
        const lastTransition = previousState !== snapshot.state
            ? nowIso
            : previousTransition
                || previousRecordedAt
                || nowIso;

        const snapshotPayload = {
            state: String(snapshot.state || SYSTEM_STATES.UNKNOWN),
            controlState: snapshot.controlState || null,
            reasons,
            actions: snapshot.actions && typeof snapshot.actions === 'object' ? snapshot.actions : this._actionTemplate(SYSTEM_STATES.UNKNOWN),
            signals,
            pipelineMetrics: snapshot.pipelineMetrics && typeof snapshot.pipelineMetrics === 'object'
                ? snapshot.pipelineMetrics
                : null,
            healthScore: Number.isFinite(Number(snapshot.healthScore)) ? Number(snapshot.healthScore) : null,
            controlPlane: snapshot.controlPlane || null,
            lastUpdatedAt: snapshot.lastUpdatedAt || null,
            transitionReason,
            activeViolations,
            activeDegradations,
            lastTransition,
            updatedAt: nowIso
        };

        const richParams = [
            snapshotPayload.state,
            Number.isFinite(Number(snapshotPayload.healthScore)) ? Number(snapshotPayload.healthScore) : null,
            transitionReason,
            signalStateFor(SIGNAL_TYPES.pipeline),
            signalStateFor(SIGNAL_TYPES.enrichment),
            signalStateFor(SIGNAL_TYPES.quota),
            signalStateFor(SIGNAL_TYPES.api),
            signalStateFor(SIGNAL_TYPES.db),
            JSON.stringify(snapshotPayload.reasons),
            JSON.stringify(snapshotPayload.activeViolations),
            JSON.stringify(snapshotPayload.activeDegradations),
            lastTransition,
            Boolean(snapshotPayload.actions.allowPublish),
            Boolean(snapshotPayload.actions.allowWrite),
            Boolean(snapshotPayload.actions.useFallback),
            JSON.stringify(signals),
            JSON.stringify(snapshotPayload),
            snapshotPayload.updatedAt
        ];

        const legacyParams = [
            snapshotPayload.state,
            signalStateFor(SIGNAL_TYPES.pipeline),
            signalStateFor(SIGNAL_TYPES.enrichment),
            signalStateFor(SIGNAL_TYPES.quota),
            signalStateFor(SIGNAL_TYPES.api),
            signalStateFor(SIGNAL_TYPES.db),
            JSON.stringify(snapshotPayload.reasons),
            Boolean(snapshotPayload.actions.allowPublish),
            Boolean(snapshotPayload.actions.allowWrite),
            Boolean(snapshotPayload.actions.useFallback),
            JSON.stringify(signals),
            JSON.stringify(snapshotPayload)
        ];

        let rows;
        try {
            ({ rows } = await query(
                `INSERT INTO public.system_health_state (
                    recorded_at,
                    state,
                    state_score,
                    transition_reason,
                    pipeline_state,
                    enrichment_state,
                    quota_state,
                    api_state,
                    db_state,
                    reasons,
                    active_violations,
                    active_degradations,
                    last_transition,
                    allow_publish,
                    allow_write,
                    use_fallback,
                    signals,
                    snapshot,
                    updated_at
                ) VALUES (
                    NOW(),
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9::jsonb,
                    $10::jsonb,
                    $11::jsonb,
                    $12::timestamptz,
                    $13,
                    $14,
                    $15,
                    $16::jsonb,
                    $17::jsonb,
                    $18::timestamptz
                )
                RETURNING *`,
                richParams
            ));
        } catch (error) {
            if (!isMissingSchemaError(error)) {
                throw error;
            }
            ({ rows } = await query(
                `INSERT INTO public.system_health_state (
                    recorded_at,
                    state,
                    pipeline_state,
                    enrichment_state,
                    quota_state,
                    api_state,
                    db_state,
                    reasons,
                    allow_publish,
                    allow_write,
                    use_fallback,
                    signals,
                    snapshot
                ) VALUES (
                    NOW(),
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7::jsonb,
                    $8,
                    $9,
                    $10,
                    $11::jsonb,
                    $12::jsonb
                )
                RETURNING *`,
                legacyParams
            ));
        }

        return rows?.[0] || null;
    }

    evaluate(snapshot = {}) {
        const signals = [];

        if (snapshot.pipelineStatus) {
            signals.push(this._evaluatePipelineStatus(snapshot.pipelineStatus));
        }
        if (snapshot.enrichmentStatus) {
            signals.push(this._evaluateEnrichmentStatus(snapshot.enrichmentStatus));
        }
        if (snapshot.quotaStatus) {
            signals.push(this._evaluateQuotaStatus(snapshot.quotaStatus));
        }
        if (snapshot.dbHealth) {
            signals.push(this._evaluateDbHealth(snapshot.dbHealth));
        }
        if (snapshot.apiHealth) {
            signals.push(this._evaluateApiHealth(snapshot.apiHealth));
        }

        return this._commit(signals);
    }

    recordPipelineMetrics(metrics = {}) {
        const currentSnapshot = this.getSnapshot();
        const nextSnapshot = {
            ...currentSnapshot,
            pipelineMetrics: metrics && typeof metrics === 'object' ? clone(metrics) : null,
            lastUpdatedAt: new Date().toISOString()
        };

        this._latest = nextSnapshot;
        this._pushHistory(nextSnapshot);
        void this.persistSystemState(nextSnapshot).catch((error) => {
            console.warn('[verificationController] Failed to persist pipeline metrics snapshot:', error.message);
        });
        return this.getSnapshot();
    }

    _evaluatePipelineStatus(payload = {}) {
        const confidence = Number(payload?.confidence);
        let severity = SYSTEM_STATES.HEALTHY;
        let reason = 'Pipeline payload is structurally valid.';
        let failureType = FAILURE_TYPES.UNKNOWN;

        if (!payload || typeof payload !== 'object') {
            severity = SYSTEM_STATES.CRITICAL;
            reason = 'Prediction payload is missing or invalid.';
            failureType = FAILURE_TYPES.STRUCTURAL_FAIL;
        } else if (!String(payload.match_id || '').trim() || !String(payload.prediction || '').trim()) {
            severity = SYSTEM_STATES.CRITICAL;
            reason = 'Prediction payload violates structural schema.';
            failureType = FAILURE_TYPES.STRUCTURAL_FAIL;
        } else if (Number.isFinite(confidence) && (confidence < 0 || confidence > 100)) {
            severity = SYSTEM_STATES.BLOCKED;
            reason = `Confidence score (${confidence}) is out of bounds.`;
            failureType = FAILURE_TYPES.STRUCTURAL_FAIL;
        } else if (Number.isFinite(confidence) && confidence < 59) {
            severity = SYSTEM_STATES.WARN;
            reason = 'Prediction is in the extreme-risk band and should not be treated as fully trusted.';
            failureType = FAILURE_TYPES.DATA_FAIL;
        }

        return createVerificationSignal({
            source: 'aiPipeline',
            type: SIGNAL_TYPES.pipeline,
            status: severity === SYSTEM_STATES.HEALTHY ? SIGNAL_STATUS.PASS : SIGNAL_STATUS.WARN,
            failureType,
            severity,
            reason,
            metadata: {
                match_id: payload?.match_id || null,
                confidence: Number.isFinite(confidence) ? confidence : null
            }
        });
    }

    _evaluateEnrichmentStatus(contextPayload = {}) {
        let severity = SYSTEM_STATES.HEALTHY;
        let reason = 'Context enrichment is present and fresh.';
        let failureType = FAILURE_TYPES.UNKNOWN;

        const hasResults = Array.isArray(contextPayload?.results)
            ? contextPayload.results.length > 0
            : !!contextPayload?.results;

        const updatedAt = contextPayload?.updated_at ? new Date(contextPayload.updated_at) : null;
        const ageHours = updatedAt && !Number.isNaN(updatedAt.getTime())
            ? (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60)
            : null;
        const hasDeepContext = hasMeaningfulDeepContext(contextPayload?.deep_context);

        if (!contextPayload || (!hasResults && !hasDeepContext)) {
            severity = SYSTEM_STATES.DEGRADED;
            reason = 'Pre-match context payload is missing primary results context.';
            failureType = FAILURE_TYPES.DATA_FAIL;
        }

        if (ageHours !== null && ageHours > 24) {
            severity = severity === SYSTEM_STATES.HEALTHY ? SYSTEM_STATES.DEGRADED : severity;
            reason = `Pre-match context data is stale (${ageHours.toFixed(1)}h old).`;
            failureType = FAILURE_TYPES.DATA_FAIL;
        }

        if (Number.isFinite(Number(contextPayload?.staleLeagues)) && Number(contextPayload.staleLeagues) > 2) {
            severity = SYSTEM_STATES.DEGRADED;
            reason = `Multiple leagues are stale (${Number(contextPayload.staleLeagues)}).`;
            failureType = FAILURE_TYPES.DATA_FAIL;
        }

        return createVerificationSignal({
            source: 'contextEnrichment',
            type: SIGNAL_TYPES.enrichment,
            status: severity === SYSTEM_STATES.HEALTHY ? SIGNAL_STATUS.PASS : SIGNAL_STATUS.WARN,
            failureType,
            severity,
            reason,
            metadata: {
                hasResults,
                ageHours: ageHours === null ? null : Number(ageHours.toFixed(2)),
                source: contextPayload?.source || null
            }
        });
    }

    _evaluateQuotaStatus(quotaStatus = {}) {
        let severity = SYSTEM_STATES.HEALTHY;
        let reason = 'Quota remains available.';
        let failureType = FAILURE_TYPES.UNKNOWN;

        const remainingToday = quotaStatus?.remainingToday;
        const remainingPerMinute = quotaStatus?.remainingPerMinute;
        const exhaustedToday = quotaStatus?.exhaustedToday === true;
        const exhaustedPerMinute = quotaStatus?.exhaustedPerMinute === true;
        const hardStop = quotaStatus?.hardStop === true;
        const bufferBelow10percent = quotaStatus?.bufferBelow10percent === true;
        const bufferBelow5percent = quotaStatus?.bufferBelow5percent === true;

        if (hardStop) {
            severity = SYSTEM_STATES.BLOCKED;
            reason = 'Quota has reached a hard stop.';
            failureType = FAILURE_TYPES.QUOTA_FAIL;
        } else if (exhaustedToday || exhaustedPerMinute) {
            severity = SYSTEM_STATES.DEGRADED;
            reason = 'Quota is exhausted but fallback behavior may continue.';
            failureType = FAILURE_TYPES.QUOTA_FAIL;
        } else if (bufferBelow5percent) {
            severity = SYSTEM_STATES.WARN;
            reason = 'Quota buffer is critically low (<5%).';
            failureType = FAILURE_TYPES.QUOTA_WARN;
        } else if (bufferBelow10percent) {
            severity = SYSTEM_STATES.WARN;
            reason = 'Quota buffer is low (<10%).';
            failureType = FAILURE_TYPES.QUOTA_WARN;
        }

        return createVerificationSignal({
            source: 'quotaPlanner',
            type: SIGNAL_TYPES.quota,
            status: severity === SYSTEM_STATES.HEALTHY ? SIGNAL_STATUS.PASS : SIGNAL_STATUS.WARN,
            failureType,
            severity,
            reason,
            metadata: {
                remainingToday: remainingToday == null ? null : Number(remainingToday),
                remainingPerMinute: remainingPerMinute == null ? null : Number(remainingPerMinute),
                exhaustedToday,
                exhaustedPerMinute,
                hardStop
            }
        });
    }

    _evaluateApiHealth(apiHealth = {}) {
        let severity = SYSTEM_STATES.HEALTHY;
        let reason = 'API probe returned usable data.';
        let failureType = FAILURE_TYPES.UNKNOWN;

        if (apiHealth.empty === true || apiHealth.invalidJson === true) {
            severity = SYSTEM_STATES.CRITICAL;
            reason = apiHealth.empty === true
                ? 'API probe returned an empty payload.'
                : 'API probe returned invalid JSON.';
            failureType = FAILURE_TYPES.STRUCTURAL_FAIL;
        }

        return createVerificationSignal({
            source: 'apiProbe',
            type: SIGNAL_TYPES.api,
            status: severity === SYSTEM_STATES.HEALTHY ? SIGNAL_STATUS.PASS : SIGNAL_STATUS.FAIL,
            failureType,
            severity,
            reason,
            metadata: {
                empty: apiHealth.empty === true,
                invalidJson: apiHealth.invalidJson === true,
                provider: apiHealth.provider || null
            }
        });
    }

    _evaluateDbHealth(dbHealth = {}) {
        let severity = SYSTEM_STATES.HEALTHY;
        let reason = 'Database probe is healthy.';
        let failureType = FAILURE_TYPES.UNKNOWN;

        if (dbHealth.connection === false || dbHealth.connected === false) {
            severity = SYSTEM_STATES.CRITICAL;
            reason = 'Database connection probe failed.';
            failureType = FAILURE_TYPES.HEALTH_FAIL;
        } else if (Number.isFinite(Number(dbHealth.writeLatencyMs)) && Number(dbHealth.writeLatencyMs) > 1000) {
            severity = SYSTEM_STATES.WARN;
            reason = `Database write latency is elevated (${Number(dbHealth.writeLatencyMs)}ms).`;
            failureType = FAILURE_TYPES.HEALTH_WARN;
        }

        return createVerificationSignal({
            source: 'dbHealth',
            type: SIGNAL_TYPES.db,
            status: severity === SYSTEM_STATES.HEALTHY ? SIGNAL_STATUS.PASS : SIGNAL_STATUS.WARN,
            failureType,
            severity,
            reason,
            metadata: {
                connection: dbHealth.connection !== false && dbHealth.connected !== false,
                writeLatencyMs: Number.isFinite(Number(dbHealth.writeLatencyMs)) ? Number(dbHealth.writeLatencyMs) : null,
                diskUsagePct: Number.isFinite(Number(dbHealth.diskUsagePct)) ? Number(dbHealth.diskUsagePct) : null
            }
        });
    }

    evaluatePipelineOutput(payload = {}) {
        return this._commit([this._evaluatePipelineStatus(payload)]);
    }

    evaluateEnrichmentState(contextPayload = {}) {
        return this._commit([this._evaluateEnrichmentStatus(contextPayload)]);
    }

    evaluateQuotaState(quotaStatus = {}) {
        return this._commit([this._evaluateQuotaStatus(quotaStatus)]);
    }

    evaluateApiHealth(apiHealth = {}) {
        return this._commit([this._evaluateApiHealth(apiHealth)]);
    }

    evaluateDbHealth(dbHealth = {}) {
        return this._commit([this._evaluateDbHealth(dbHealth)]);
    }

    getSnapshot() {
        return clone(this._latest);
    }

    getHistory() {
        return clone(this._history);
    }

    enforce(evaluationState = this.getSnapshot()) {
        const state = String(evaluationState?.state || SYSTEM_STATES.UNKNOWN);
        if (state === SYSTEM_STATES.CRITICAL || state === SYSTEM_STATES.BLOCKED) {
            console.error('[SKCS ENFORCEMENT] Pipeline halted:', evaluationState?.reasons || []);
            throw new Error(`SKCS_ENFORCEMENT_HALT: ${(evaluationState?.reasons || []).join(' | ') || state}`);
        }

        if (state === SYSTEM_STATES.DEGRADED) {
            console.warn('[SKCS ENFORCEMENT] Operating in degraded state:', evaluationState?.reasons || []);
        }

        if (state === SYSTEM_STATES.WARN) {
            console.warn('[SKCS ENFORCEMENT] Operating with warnings:', evaluationState?.reasons || []);
        }

        return evaluationState;
    }
}

module.exports = new VerificationController();
module.exports.SYSTEM_STATES = SYSTEM_STATES;
module.exports.SIGNAL_TYPES = SIGNAL_TYPES;
module.exports.SIGNAL_STATUS = SIGNAL_STATUS;
module.exports.FAILURE_TYPES = FAILURE_TYPES;
