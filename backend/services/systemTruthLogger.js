'use strict';

const { query } = require('../db');

const records = [];
const MAX_RECORDS = 250;

function deriveFinalDecision(record = {}) {
    if (String(record.finalDecision || '').trim()) {
        return String(record.finalDecision).trim().toUpperCase();
    }

    if (record.error) {
        return 'ERROR';
    }

    const haltedStages = new Set(['preflight', 'gatekeeper', 'control_plane']);
    if (!record.result && haltedStages.has(String(record.stage || '').toLowerCase())) {
        return 'HALTED';
    }

    return 'SUCCESS';
}

async function persistExecutionTrace(entry) {
    if (!entry?.trace_id && !entry?.traceId) {
        return null;
    }

    const traceId = String(entry.trace_id || entry.traceId).trim();
    if (!traceId) {
        return null;
    }

    const pipelineTrace = entry.pipelineTrace && typeof entry.pipelineTrace === 'object'
        ? entry.pipelineTrace
        : {
            trace_id: traceId,
            operation: entry.context?.operation || entry.operation || 'unknown',
            caller: entry.context?.caller || entry.caller || null,
            final_decision: deriveFinalDecision(entry),
            halted_at: entry.haltedAt || (deriveFinalDecision(entry) === 'HALTED' ? entry.stage || null : null),
            full_trace: entry,
            metrics: entry.stageMetrics || entry.metrics || {},
            decision_fingerprint: entry.fingerprint || null,
            started_at: entry.context?.started_at || null,
            completed_at: entry.completed_at || entry.recordedAt || new Date().toISOString()
        };

    const finalDecision = deriveFinalDecision(entry);
    const haltedAt = entry.haltedAt || pipelineTrace.halted_at || null;
    const publishRunId = entry.context?.publish_run_id || entry.context?.publishRunId || null;
    const startedAt = pipelineTrace.started_at || entry.context?.started_at || entry.recordedAt || new Date().toISOString();
    const completedAt = pipelineTrace.completed_at || entry.completed_at || entry.recordedAt || new Date().toISOString();
    const operation = String(entry.context?.operation || entry.operation || pipelineTrace.operation || 'unknown');
    const caller = String(entry.context?.caller || entry.caller || pipelineTrace.caller || 'unknown');

    const executionRes = await query(
        `INSERT INTO public.pipeline_executions (
            trace_id,
            publish_run_id,
            operation,
            caller,
            final_decision,
            halted_at,
            full_trace,
            metrics,
            decision_fingerprint,
            started_at,
            completed_at,
            updated_at
        ) VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7::jsonb,
            $8::jsonb,
            $9::jsonb,
            $10::timestamptz,
            $11::timestamptz,
            NOW()
        )
        ON CONFLICT (trace_id) DO UPDATE SET
            publish_run_id = COALESCE(EXCLUDED.publish_run_id, public.pipeline_executions.publish_run_id),
            operation = EXCLUDED.operation,
            caller = EXCLUDED.caller,
            final_decision = EXCLUDED.final_decision,
            halted_at = EXCLUDED.halted_at,
            full_trace = EXCLUDED.full_trace,
            metrics = EXCLUDED.metrics,
            decision_fingerprint = EXCLUDED.decision_fingerprint,
            started_at = LEAST(public.pipeline_executions.started_at, EXCLUDED.started_at),
            completed_at = EXCLUDED.completed_at,
            updated_at = NOW()
        RETURNING id`,
        [
            traceId,
            publishRunId,
            operation,
            caller,
            finalDecision,
            haltedAt,
            JSON.stringify(pipelineTrace.full_trace || entry),
            JSON.stringify(pipelineTrace.metrics || entry.stageMetrics || entry.metrics || {}),
            JSON.stringify(pipelineTrace.decision_fingerprint || entry.fingerprint || null),
            startedAt,
            completedAt
        ]
    ).catch((error) => {
        throw error;
    });

    const executionId = executionRes?.rows?.[0]?.id || null;

    if (executionId && entry.fingerprint && typeof entry.fingerprint === 'object') {
        try {
            await query(
                `INSERT INTO public.decision_fingerprints (
                    trace_id,
                    pipeline_execution_id,
                    prediction_id,
                    fingerprint,
                    created_at
                ) VALUES (
                    $1,
                    $2,
                    $3,
                    $4::jsonb,
                    NOW()
                )
                ON CONFLICT (trace_id) DO UPDATE SET
                    pipeline_execution_id = EXCLUDED.pipeline_execution_id,
                    prediction_id = EXCLUDED.prediction_id,
                    fingerprint = EXCLUDED.fingerprint`,
                [
                    traceId,
                    executionId,
                    entry.fingerprint.prediction_id || null,
                    JSON.stringify(entry.fingerprint)
                ]
            );
        } catch (fingerprintError) {
            console.warn('[TRUTH_LOG] Failed to persist decision fingerprint:', fingerprintError.message);
        }
    }

    return traceId;
}

async function write(record) {
    const entry = {
        recordedAt: new Date().toISOString(),
        ...record
    };

    records.push(entry);
    if (records.length > MAX_RECORDS) {
        records.splice(0, records.length - MAX_RECORDS);
    }

    console.log('[TRUTH_LOG]', JSON.stringify(entry, null, 2));
    void persistExecutionTrace(entry).catch((error) => {
        console.warn('[TRUTH_LOG] Failed to persist execution trace:', error.message);
    });
    return entry;
}

function getRecentRecords() {
    return records.slice();
}

function getRecentTraces(limit = 25) {
    return records.slice(-Math.max(1, Number(limit) || 25));
}

module.exports = {
    truthLogger: { write, getRecentRecords, getRecentTraces, persistExecutionTrace }
};
