'use strict';

const { query } = require('../db');

const records = [];
const MAX_RECORDS = 250;
let truthLedgerSchemaPromise = null;
let warnedMissingTruthLedger = false;

function isMissingSchemaError(error = {}) {
    const message = String(error?.message || '');
    return /does not exist|undefined column|relation .* does not exist|column .* does not exist/i.test(message);
}

async function getTruthLedgerSchemaStatus() {
    if (!truthLedgerSchemaPromise) {
        truthLedgerSchemaPromise = (async () => {
            const { rows } = await query(`
                SELECT
                    to_regclass('public.pipeline_executions') AS pipeline_executions,
                    to_regclass('public.decision_fingerprints') AS decision_fingerprints,
                    EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'pipeline_executions'
                          AND column_name IN ('data_contract_id', 'data_contract_version', 'raw_response_snapshot')
                        GROUP BY table_name
                        HAVING COUNT(*) = 3
                    ) AS pipeline_executions_has_contract_columns,
                    EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'decision_fingerprints'
                          AND column_name IN ('data_contract_id', 'data_contract_version')
                        GROUP BY table_name
                        HAVING COUNT(*) = 2
                    ) AS decision_fingerprints_has_contract_columns
            `);
            const row = rows?.[0] || {};
            return {
                pipelineExecutionsExists: Boolean(row.pipeline_executions),
                decisionFingerprintsExists: Boolean(row.decision_fingerprints),
                pipelineExecutionsHasContractColumns: Boolean(row.pipeline_executions_has_contract_columns),
                decisionFingerprintsHasContractColumns: Boolean(row.decision_fingerprints_has_contract_columns)
            };
        })().catch((error) => {
            truthLedgerSchemaPromise = null;
            throw error;
        });
    }

    return truthLedgerSchemaPromise;
}

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
    const dataContractId = String(entry.data_contract_id || entry.context?.data_contract_id || entry.context?.contract_id || '').trim() || null;
    const dataContractVersion = String(entry.data_contract_version || entry.context?.data_contract_version || entry.context?.contract_version || 'skcs:sportsdataio:soccer:contract:v1.1').trim();
    const rawResponseSnapshot = entry.raw_response_snapshot ?? entry.context?.raw_response_snapshot ?? entry.result ?? null;
    const schema = await getTruthLedgerSchemaStatus();

    if (!schema.pipelineExecutionsExists) {
        if (!warnedMissingTruthLedger) {
            warnedMissingTruthLedger = true;
            console.warn('[TRUTH_LOG] pipeline_executions table is unavailable; skipping persistence until the truth mirror migration is deployed.');
        }
        truthLedgerSchemaPromise = null;
        return null;
    }

    const executionColumns = [
        'trace_id',
        'publish_run_id',
        'operation',
        'caller',
        'final_decision',
        'halted_at',
        'full_trace',
        'metrics',
        'decision_fingerprint',
        'started_at',
        'completed_at',
        'updated_at'
    ];
    const executionValues = [
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
        completedAt,
        new Date().toISOString()
    ];
    const executionUpdates = [
        'publish_run_id = COALESCE(EXCLUDED.publish_run_id, public.pipeline_executions.publish_run_id)',
        'operation = EXCLUDED.operation',
        'caller = EXCLUDED.caller',
        'final_decision = EXCLUDED.final_decision',
        'halted_at = EXCLUDED.halted_at',
        'full_trace = EXCLUDED.full_trace',
        'metrics = EXCLUDED.metrics',
        'decision_fingerprint = EXCLUDED.decision_fingerprint',
        'started_at = LEAST(public.pipeline_executions.started_at, EXCLUDED.started_at)',
        'completed_at = EXCLUDED.completed_at',
        'updated_at = NOW()'
    ];

    if (schema.pipelineExecutionsHasContractColumns) {
        executionColumns.splice(2, 0, 'data_contract_id', 'data_contract_version', 'raw_response_snapshot');
        executionValues.splice(2, 0, dataContractId, dataContractVersion, JSON.stringify(rawResponseSnapshot ?? {}));
        executionUpdates.splice(1, 0,
            'data_contract_id = COALESCE(EXCLUDED.data_contract_id, public.pipeline_executions.data_contract_id)',
            'data_contract_version = EXCLUDED.data_contract_version',
            'raw_response_snapshot = EXCLUDED.raw_response_snapshot'
        );
    }

    const executionPlaceholders = executionColumns.map((_, index) => `$${index + 1}`).join(',\n            ');
    const executionRes = await query(
        `INSERT INTO public.pipeline_executions (
            ${executionColumns.join(',\n            ')}
        ) VALUES (
            ${executionPlaceholders}
        )
        ON CONFLICT (trace_id) DO UPDATE SET
            ${executionUpdates.join(',\n            ')}
        RETURNING id`,
        executionValues
    ).catch((error) => {
        throw error;
    });

    const executionId = executionRes?.rows?.[0]?.id || null;

    if (executionId && entry.fingerprint && typeof entry.fingerprint === 'object' && schema.decisionFingerprintsExists) {
        try {
            const fingerprintColumns = [
                'trace_id',
                'pipeline_execution_id',
                'prediction_id',
                'fingerprint',
                'created_at'
            ];
            const fingerprintValues = [
                traceId,
                executionId,
                entry.fingerprint.prediction_id || null,
                JSON.stringify(entry.fingerprint),
                new Date().toISOString()
            ];
            const fingerprintUpdates = [
                'pipeline_execution_id = EXCLUDED.pipeline_execution_id',
                'prediction_id = EXCLUDED.prediction_id',
                'fingerprint = EXCLUDED.fingerprint'
            ];

            if (schema.decisionFingerprintsHasContractColumns) {
                fingerprintColumns.splice(2, 0, 'data_contract_id', 'data_contract_version');
                fingerprintValues.splice(2, 0, dataContractId, dataContractVersion);
                fingerprintUpdates.unshift(
                    'data_contract_id = COALESCE(EXCLUDED.data_contract_id, public.decision_fingerprints.data_contract_id)',
                    'data_contract_version = EXCLUDED.data_contract_version'
                );
            }

            const fingerprintPlaceholders = fingerprintColumns.map((_, index) => `$${index + 1}`).join(',\n                    ');
            await query(
                `INSERT INTO public.decision_fingerprints (
                    ${fingerprintColumns.join(',\n                    ')}
                ) VALUES (
                    ${fingerprintPlaceholders}
                )
                ON CONFLICT (trace_id) DO UPDATE SET
                    ${fingerprintUpdates.join(',\n                    ')}`,
                fingerprintValues
            );
        } catch (fingerprintError) {
            console.warn('[TRUTH_LOG] Failed to persist decision fingerprint:', fingerprintError.message);
        }
    } else if (executionId && entry.fingerprint && typeof entry.fingerprint === 'object' && !schema.decisionFingerprintsExists && !warnedMissingTruthLedger) {
        warnedMissingTruthLedger = true;
        console.warn('[TRUTH_LOG] decision_fingerprints table is unavailable; persisted execution trace without derived fingerprint.');
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
