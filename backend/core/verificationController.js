'use strict';

const { query } = require('../db');
const {
    SIGNAL_TYPES,
    SIGNAL_STATUS,
    FAILURE_TYPES,
    createVerificationSignal,
    isVerificationSignal
} = require('./verificationSignalContract');

const SYSTEM_STATES = Object.freeze({
    UNKNOWN: 'UNKNOWN',
    HEALTHY: 'HEALTHY',
    WARN: 'WARN',
    DEGRADED: 'DEGRADED',
    CRITICAL: 'CRITICAL',
    BLOCKED: 'BLOCKED'
});

const STATE_RANK = Object.freeze({
    UNKNOWN: 0,
    HEALTHY: 1,
    WARN: 2,
    DEGRADED: 3,
    CRITICAL: 4,
    BLOCKED: 5
});

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function latestBySeverity(signals) {
    return signals.reduce((current, signal) => {
        const currentRank = STATE_RANK[current.severity] ?? 0;
        const nextRank = STATE_RANK[signal.severity] ?? 0;
        return nextRank > currentRank ? signal : current;
    }, createVerificationSignal({
        source: 'init',
        type: SIGNAL_TYPES.api,
        status: SIGNAL_STATUS.PASS,
        severity: SYSTEM_STATES.UNKNOWN,
        reason: 'No signals recorded yet.'
    }));
}

class VerificationController {
    constructor() {
        this.reset();
    }

    reset() {
        this._signals = new Map();
        this._history = [];
        this._latest = {
            state: SYSTEM_STATES.UNKNOWN,
            reasons: [],
            actions: {
                allowWrite: true,
                allowPublish: true,
                useFallback: false
            },
            signals: [],
            lastUpdatedAt: null
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

        const highest = latestBySeverity(normalizedSignals);
        const reasons = normalizedSignals
            .filter((signal) => signal.severity !== SYSTEM_STATES.HEALTHY && signal.severity !== SYSTEM_STATES.UNKNOWN)
            .map((signal) => `[${signal.severity}] ${signal.reason || signal.source}`);

        const snapshot = {
            state: highest.severity,
            reasons,
            actions: this._actionTemplate(highest.severity),
            signals: normalizedSignals,
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
        const signalStateFor = (type) => {
            const match = signals.find((signal) => signal?.type === type);
            return String(match?.severity || SYSTEM_STATES.UNKNOWN);
        };

        const snapshotPayload = {
            state: String(snapshot.state || SYSTEM_STATES.UNKNOWN),
            reasons: Array.isArray(snapshot.reasons) ? snapshot.reasons : [],
            actions: snapshot.actions && typeof snapshot.actions === 'object' ? snapshot.actions : this._actionTemplate(SYSTEM_STATES.UNKNOWN),
            signals,
            lastUpdatedAt: snapshot.lastUpdatedAt || null
        };

        const { rows } = await query(
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
            [
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
            ]
        );

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

        if (!contextPayload || (!hasResults && !contextPayload?.deep_context)) {
            severity = SYSTEM_STATES.DEGRADED;
            reason = 'Enrichment payload is missing primary results context.';
            failureType = FAILURE_TYPES.DATA_FAIL;
        }

        if (ageHours !== null && ageHours > 24) {
            severity = severity === SYSTEM_STATES.HEALTHY ? SYSTEM_STATES.DEGRADED : severity;
            reason = `Context data is stale (${ageHours.toFixed(1)}h old).`;
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
