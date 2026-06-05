'use strict';

const { query } = require('../db');
const verificationController = require('../core/verificationController');
const { truthLogger } = require('./systemTruthLogger');

function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function summarizeFeedRows(rows = []) {
    const feed = Array.isArray(rows) ? rows : [];
    const totals = feed.reduce((acc, row) => {
        acc.total_ai_calls += toNumber(row.total_ai_calls, 0);
        acc.successful_calls += toNumber(row.successful_calls, 0);
        acc.fallback_calls += toNumber(row.fallback_calls, 0);
        acc.blocked_calls += toNumber(row.blocked_calls, 0);
        acc.blocked_call_count += toNumber(row.blocked_call_count, 0);
        acc.semantic_violation_count += toNumber(row.semantic_violation_count, 0);
        acc.critical_violation_count += toNumber(row.critical_violation_count, 0);
        acc.total_input_tokens += toNumber(row.total_input_tokens, 0);
        acc.total_output_tokens += toNumber(row.total_output_tokens, 0);
        acc.total_tokens_used += toNumber(row.total_tokens_used, 0);
        acc.total_cost_estimate += toNumber(row.total_cost_estimate, 0);
        acc.max_latency_ms = Math.max(acc.max_latency_ms, toNumber(row.max_latency_ms, 0));
        acc.last_activity_at = row.last_activity_at && (!acc.last_activity_at || row.last_activity_at > acc.last_activity_at)
            ? row.last_activity_at
            : acc.last_activity_at;
        return acc;
    }, {
        total_ai_calls: 0,
        successful_calls: 0,
        fallback_calls: 0,
        blocked_calls: 0,
        blocked_call_count: 0,
        semantic_violation_count: 0,
        critical_violation_count: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_tokens_used: 0,
        total_cost_estimate: 0,
        max_latency_ms: 0,
        last_activity_at: null
    });

    return {
        measurement_window_hours: 24,
        observed_at: new Date().toISOString(),
        pipeline_count: feed.length,
        totals,
        pipelines: feed
    };
}

async function fetchPipelineHealthFeed() {
    const { rows } = await query(
        `SELECT *
         FROM public.v_pipeline_health_feed
         ORDER BY pipeline_name ASC`
    );
    return Array.isArray(rows) ? rows : [];
}

async function refreshPipelineHealthState(options = {}) {
    const rows = await fetchPipelineHealthFeed();
    const summary = summarizeFeedRows(rows);
    const latestTrace = truthLogger.getRecentTraces(1)[0] || null;
    const snapshot = verificationController.recordPipelineMetrics({
        source: options.source || 'pipelineHealthFeed',
        measurement_window_hours: summary.measurement_window_hours,
        observed_at: summary.observed_at,
        pipeline_count: summary.pipeline_count,
        totals: summary.totals,
        pipelines: summary.pipelines,
        latest_trace_id: latestTrace?.traceId || latestTrace?.trace_id || null,
        latest_stage_metrics: latestTrace?.stageMetrics || null
    });

    return {
        feed: rows,
        summary,
        snapshot,
        latestTrace
    };
}

module.exports = {
    fetchPipelineHealthFeed,
    refreshPipelineHealthState,
    summarizeFeedRows
};
