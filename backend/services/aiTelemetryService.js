'use strict';

const { query } = require('../db');

function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toInteger(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

function normalizeStatus(status, success) {
    const raw = String(status || '').trim().toLowerCase();
    const allowed = new Set(['complete', 'cached', 'blocked', 'partial_failed', 'retry_pending', 'failed']);
    if (allowed.has(raw)) return raw;
    return success ? 'complete' : 'failed';
}

function normalizeTelemetry(input = {}) {
    const metadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
    const success = input.success === true;
    return {
        pipeline_name: String(input.pipeline_name || metadata.pipeline_name || 'aiPipeline').trim() || 'aiPipeline',
        task_name: String(input.task_name || metadata.task_name || 'generateInsight').trim() || 'generateInsight',
        model: String(input.model || metadata.model || 'unknown').trim() || 'unknown',
        success,
        finish_reason: input.finish_reason || (success ? 'stop' : 'error'),
        status: normalizeStatus(input.status, success),
        partial: input.partial === true,
        ceiling_type: input.ceiling_type || metadata.ceiling_type || null,
        input_tokens: toInteger(input.input_tokens ?? metadata.input_tokens ?? 0, 0),
        output_tokens: toInteger(input.output_tokens ?? metadata.output_tokens ?? 0, 0),
        cost_estimate: input.cost_estimate ?? metadata.cost_estimate ?? null,
        latency_ms: toInteger(input.latency_ms ?? metadata.latency_ms ?? 0, 0),
        input_class: input.input_class || metadata.input_class || null,
        knowledge_context: input.knowledge_context || metadata.knowledge_context || null,
        budget_class: input.budget_class || metadata.budget_class || null,
        monthly_risk: input.monthly_risk || metadata.monthly_risk || null,
        fixture_id: input.fixture_id || metadata.fixture_id || null,
        metadata: {
            ...metadata,
            provider: input.provider || metadata.provider || null,
            fallback: input.fallback === true || metadata.fallback === true,
            provider_chain: input.provider_chain || metadata.provider_chain || null,
            prompt_chars: Number.isFinite(Number(input.prompt_chars ?? metadata.prompt_chars))
                ? Number(input.prompt_chars ?? metadata.prompt_chars)
                : null,
            response_chars: Number.isFinite(Number(input.response_chars ?? metadata.response_chars))
                ? Number(input.response_chars ?? metadata.response_chars)
                : null,
            error: input.error || metadata.error || null
        }
    };
}

async function recordAiTelemetry(input = {}) {
    const entry = normalizeTelemetry(input);
    try {
        await query(
            `INSERT INTO public.ai_pipeline_telemetry (
                pipeline_name,
                task_name,
                model,
                success,
                finish_reason,
                status,
                partial,
                ceiling_type,
                input_tokens,
                output_tokens,
                cost_estimate,
                latency_ms,
                input_class,
                knowledge_context,
                budget_class,
                monthly_risk,
                fixture_id,
                metadata
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13, $14, $15, $16,
                $17, $18::jsonb
            )`,
            [
                entry.pipeline_name,
                entry.task_name,
                entry.model,
                entry.success,
                entry.finish_reason,
                entry.status,
                entry.partial,
                entry.ceiling_type,
                entry.input_tokens,
                entry.output_tokens,
                entry.cost_estimate,
                entry.latency_ms,
                entry.input_class,
                entry.knowledge_context,
                entry.budget_class,
                entry.monthly_risk,
                entry.fixture_id,
                JSON.stringify(entry.metadata)
            ]
        );
        return entry;
    } catch (error) {
        console.warn('[aiTelemetryService] Failed to record AI telemetry:', error.message);
        return null;
    }
}

async function recordBlockedAiCall(input = {}) {
    const entry = normalizeTelemetry({
        ...input,
        success: false,
        status: 'blocked',
        partial: false
    });
    try {
        await query(
            `INSERT INTO public.blocked_ai_calls_log (
                pipeline_name,
                task_name,
                model,
                reason,
                requested_input_tokens,
                requested_output_tokens,
                budget_class,
                ceiling_type,
                metadata
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb
            )`,
            [
                entry.pipeline_name,
                entry.task_name,
                entry.model,
                String(input.reason || input.error || 'blocked').trim(),
                entry.input_tokens || null,
                entry.output_tokens || null,
                entry.budget_class,
                entry.ceiling_type,
                JSON.stringify(entry.metadata)
            ]
        );
        return entry;
    } catch (error) {
        console.warn('[aiTelemetryService] Failed to record blocked AI call:', error.message);
        return null;
    }
}

module.exports = {
    recordAiTelemetry,
    recordBlockedAiCall
};
