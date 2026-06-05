'use strict';

const crypto = require('crypto');
const { preflightSimulator } = require('../semantic-layer/preflightSimulator');
const { gatekeeper } = require('../semantic-layer/gatekeeperAdapter');
const { verificationController } = require('../semantic-layer/verificationController');
const { controlPlaneEvaluator } = require('../semantic-layer/controlPlaneEvaluator');
const { buildDecisionFingerprint } = require('../semantic-layer/decisionFingerprintService');
const { truthLogger } = require('../services/systemTruthLogger');
const { errorMemory } = require('../semantic-layer/errorMemoryLayer');

function fail(stage, reason, traceId, extra = {}) {
    return {
        success: false,
        traceId,
        trace_id: traceId,
        stage,
        reason,
        ...extra
    };
}

function normalizeBoolean(value) {
    return value === true || String(value).trim().toLowerCase() === 'true';
}

function stageStart(timings, key) {
    timings[key] = timings[key] || {};
    timings[key].startedAt = Date.now();
}

function stageEnd(timings, key) {
    if (!timings[key]) {
        timings[key] = {};
    }
    timings[key].endedAt = Date.now();
    const startedAt = timings[key].startedAt || timings.startedAt;
    timings[key].durationMs = Math.max(0, timings[key].endedAt - startedAt);
}

function buildStageMetrics(stageTimings, totalDurationMs) {
    return {
        preflight_ms: Number(stageTimings.preflight?.durationMs || 0),
        gatekeeper_ms: Number(stageTimings.gatekeeper?.durationMs || 0),
        verification_ms: Number(stageTimings.verification?.durationMs || 0),
        control_plane_ms: Number(stageTimings.control_plane?.durationMs || 0),
        execution_ms: Number(stageTimings.execution?.durationMs || 0),
        fingerprint_ms: Number(stageTimings.fingerprint?.durationMs || 0),
        logging_ms: Number(stageTimings.logging?.durationMs || 0),
        memory_ms: Number(stageTimings.memory?.durationMs || 0),
        total_duration_ms: Number(totalDurationMs || 0)
    };
}

async function executeOperation(context = {}) {
    const traceId = crypto.randomUUID();
    const startTime = Date.now();
    const stageTimings = {
        startedAt: startTime
    };
    const dryRun = normalizeBoolean(context.dry_run || context.dryRun);
    const strictMode = normalizeBoolean(context.strict_mode || process.env.SKCS_PIPELINE_STRICT);
    let stage = 'init';
    const operationContext = {
        ...context,
        trace_id: context.trace_id || traceId,
        traceId,
        dry_run: dryRun,
        strict_mode: strictMode
    };
    const pipelineTrace = {
        trace_id: traceId,
        operation: String(operationContext.operation || operationContext.name || 'unknown'),
        caller: operationContext.caller || operationContext.source || null,
        started_at: new Date(startTime).toISOString(),
        stages: {},
        metrics: null,
        final_decision: 'RUNNING',
        halted_at: null,
        completed_at: null
    };

    try {
        stage = 'preflight';
        stageStart(stageTimings, 'preflight');
        const preflight = await preflightSimulator.run(operationContext);
        stageEnd(stageTimings, 'preflight');
        pipelineTrace.stages.preflight = preflight;
        if (!preflight.allowed) {
            const metrics = buildStageMetrics(stageTimings, Date.now() - startTime);
            pipelineTrace.metrics = metrics;
            pipelineTrace.final_decision = 'HALTED';
            pipelineTrace.halted_at = 'preflight';
            pipelineTrace.completed_at = new Date().toISOString();
            await truthLogger.write({
                traceId,
                trace_id: traceId,
                stage,
                context: operationContext,
                preflight,
                stageMetrics: metrics,
                pipelineTrace,
                dryRun,
                strictMode,
                result: null,
                finalDecision: 'HALTED',
                haltedAt: 'preflight'
            });
            return fail('PREFLIGHT', preflight.reason || 'Preflight rejected execution.', traceId, {
                preflight,
                stageMetrics: metrics,
                finalDecision: 'HALTED',
                haltedAt: 'preflight'
            });
        }

        stage = 'gatekeeper';
        stageStart(stageTimings, 'gatekeeper');
        const gate = await gatekeeper.getExecutionConstraints(operationContext);
        stageEnd(stageTimings, 'gatekeeper');
        pipelineTrace.stages.gatekeeper = gate;
        if (!gate.proceed) {
            const metrics = buildStageMetrics(stageTimings, Date.now() - startTime);
            pipelineTrace.metrics = metrics;
            pipelineTrace.final_decision = 'HALTED';
            pipelineTrace.halted_at = 'gatekeeper';
            pipelineTrace.completed_at = new Date().toISOString();
            await truthLogger.write({
                traceId,
                trace_id: traceId,
                stage,
                context: operationContext,
                gate,
                stageMetrics: metrics,
                pipelineTrace,
                dryRun,
                strictMode,
                result: null,
                finalDecision: 'HALTED',
                haltedAt: 'gatekeeper'
            });
            return fail('GATEKEEPER', gate.reason || 'Gatekeeper rejected execution.', traceId, {
                gate,
                stageMetrics: metrics,
                finalDecision: 'HALTED',
                haltedAt: 'gatekeeper'
            });
        }

        operationContext.constraints = gate.constraints || gate;

        stage = 'verification';
        stageStart(stageTimings, 'verification');
        const verificationSnapshot = await verificationController.verify(operationContext);
        stageEnd(stageTimings, 'verification');
        pipelineTrace.stages.verification = verificationSnapshot;

        stage = 'control_plane';
        stageStart(stageTimings, 'control_plane');
        const health = await controlPlaneEvaluator.evaluate(operationContext);
        stageEnd(stageTimings, 'control_plane');
        pipelineTrace.stages.control_plane = health;
        if (String(health.state || '').trim().toUpperCase() === 'FAIL') {
            const metrics = buildStageMetrics(stageTimings, Date.now() - startTime);
            pipelineTrace.metrics = metrics;
            pipelineTrace.final_decision = 'HALTED';
            pipelineTrace.halted_at = 'control_plane';
            pipelineTrace.completed_at = new Date().toISOString();
            await truthLogger.write({
                traceId,
                trace_id: traceId,
                stage,
                context: operationContext,
                gate,
                health,
                verification: verificationSnapshot,
                stageMetrics: metrics,
                pipelineTrace,
                dryRun,
                strictMode,
                result: null,
                finalDecision: 'HALTED',
                haltedAt: 'control_plane'
            });
            return fail('CONTROL_PLANE', 'System FAIL state', traceId, {
                gate,
                health,
                verification: verificationSnapshot,
                stageMetrics: metrics,
                finalDecision: 'HALTED',
                haltedAt: 'control_plane'
            });
        }

        stage = 'execution';
        if (typeof operationContext.execute !== 'function') {
            throw new Error('Missing execution function');
        }

        let result = null;
        if (!dryRun) {
            stageStart(stageTimings, 'execution');
            result = await operationContext.execute(operationContext.payload, gate.constraints || gate);
            stageEnd(stageTimings, 'execution');
        }
        pipelineTrace.stages.execution = {
            dryRun,
            resultType: Array.isArray(result) ? 'array' : typeof result
        };

        stage = 'fingerprint';
        stageStart(stageTimings, 'fingerprint');
        const fingerprint = buildDecisionFingerprint({
            traceId,
            context: operationContext,
            gate,
            health,
            result,
            verification: verificationSnapshot,
            preflight,
            dryRun,
            strictMode,
            stageTimings
        });
        stageEnd(stageTimings, 'fingerprint');
        pipelineTrace.stages.fingerprint = fingerprint;

        stage = 'logging';
        stageStart(stageTimings, 'logging');
        const metrics = buildStageMetrics(stageTimings, Date.now() - startTime);
        pipelineTrace.metrics = metrics;
        pipelineTrace.final_decision = 'SUCCESS';
        pipelineTrace.completed_at = new Date().toISOString();
        await truthLogger.write({
            traceId,
            trace_id: traceId,
            context: operationContext,
            result,
            fingerprint,
            health,
            verification: verificationSnapshot,
            preflight,
            dryRun,
            strictMode,
            stageMetrics: metrics,
            durationMs: Date.now() - startTime,
            pipelineTrace,
            finalDecision: 'SUCCESS'
        });
        stageEnd(stageTimings, 'logging');

        stage = 'memory';
        stageStart(stageTimings, 'memory');
        errorMemory.observe({
            traceId,
            trace_id: traceId,
            context: operationContext,
            result,
            health,
            verification: verificationSnapshot,
            fingerprint,
            stageMetrics: metrics
        });
        stageEnd(stageTimings, 'memory');

        return {
            success: true,
            traceId,
            trace_id: traceId,
            dryRun,
            result,
            fingerprint,
            stageMetrics: metrics,
            finalDecision: 'SUCCESS',
            haltedAt: null
        };
    } catch (err) {
        const metrics = buildStageMetrics(stageTimings, Date.now() - startTime);
        pipelineTrace.metrics = metrics;
        pipelineTrace.final_decision = 'ERROR';
        pipelineTrace.halted_at = stage;
        pipelineTrace.completed_at = new Date().toISOString();
        await truthLogger.write({
            traceId,
            trace_id: traceId,
            context: operationContext,
            error: err.message,
            stage,
            dryRun,
            strictMode,
            stageMetrics: metrics,
            durationMs: Date.now() - startTime,
            pipelineTrace,
            finalDecision: 'ERROR',
            haltedAt: stage
        });

        if (typeof errorMemory.observeFailure === 'function') {
            errorMemory.observeFailure({
                traceId,
                trace_id: traceId,
                context: operationContext,
                error: err.message,
                stage,
                stageMetrics: metrics
            });
        }

        return {
            success: false,
            traceId,
            trace_id: traceId,
            error: err.message,
            stage,
            stageMetrics: metrics,
            finalDecision: 'ERROR',
            haltedAt: stage
        };
    }
}

module.exports = { executeOperation };
