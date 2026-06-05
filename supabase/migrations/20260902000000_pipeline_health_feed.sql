-- =========================================================
-- SKCS Pipeline Health Feed
-- Facts-only telemetry view for runtime observability.
-- =========================================================

CREATE OR REPLACE VIEW public.v_pipeline_health_feed AS
WITH ai_metrics AS (
    SELECT
        t.pipeline_name,
        COUNT(*)::integer AS total_ai_calls,
        SUM(CASE WHEN t.success THEN 1 ELSE 0 END)::integer AS successful_calls,
        SUM(CASE WHEN COALESCE((t.metadata->>'fallback')::boolean, false) THEN 1 ELSE 0 END)::integer AS fallback_calls,
        SUM(CASE WHEN t.status = 'blocked' OR t.finish_reason = 'budget_blocked' THEN 1 ELSE 0 END)::integer AS blocked_calls,
        ROUND(AVG(t.latency_ms)::numeric, 2) AS avg_latency_ms,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY t.latency_ms)::numeric(12, 2) AS p95_latency_ms,
        MAX(t.latency_ms)::integer AS max_latency_ms,
        COALESCE(SUM(t.input_tokens), 0)::bigint AS total_input_tokens,
        COALESCE(SUM(t.output_tokens), 0)::bigint AS total_output_tokens,
        COALESCE(SUM(t.total_tokens), 0)::bigint AS total_tokens_used,
        COALESCE(SUM(COALESCE(t.cost_estimate, 0)), 0)::numeric AS total_cost_estimate,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT t.model), NULL) AS models_used,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT t.task_name), NULL) AS tasks_used,
        MAX(t.recorded_at) AS last_ai_call
    FROM public.ai_pipeline_telemetry t
    WHERE t.recorded_at >= NOW() - INTERVAL '24 hours'
    GROUP BY t.pipeline_name
),
blocked_metrics AS (
    SELECT
        b.pipeline_name,
        COUNT(*)::integer AS blocked_call_count,
        MAX(b.recorded_at) AS last_blocked_call
    FROM public.blocked_ai_calls_log b
    WHERE b.recorded_at >= NOW() - INTERVAL '24 hours'
    GROUP BY b.pipeline_name
),
semantic_metrics AS (
    SELECT
        s.pipeline AS pipeline_name,
        COUNT(*)::integer AS semantic_violation_count,
        SUM(CASE WHEN LOWER(s.severity) IN ('critical', 'blocked') THEN 1 ELSE 0 END)::integer AS critical_violation_count,
        MAX(s.occurred_at) AS last_violation_at
    FROM public.semantic_violations s
    WHERE s.occurred_at >= NOW() - INTERVAL '24 hours'
    GROUP BY s.pipeline
),
combined AS (
    SELECT
        COALESCE(a.pipeline_name, b.pipeline_name, s.pipeline_name) AS pipeline_name,
        COALESCE(a.total_ai_calls, 0) AS total_ai_calls,
        COALESCE(a.successful_calls, 0) AS successful_calls,
        COALESCE(a.fallback_calls, 0) AS fallback_calls,
        COALESCE(a.blocked_calls, 0) AS blocked_calls,
        COALESCE(a.avg_latency_ms, 0) AS avg_latency_ms,
        COALESCE(a.p95_latency_ms, 0) AS p95_latency_ms,
        COALESCE(a.max_latency_ms, 0) AS max_latency_ms,
        COALESCE(a.total_input_tokens, 0) AS total_input_tokens,
        COALESCE(a.total_output_tokens, 0) AS total_output_tokens,
        COALESCE(a.total_tokens_used, 0) AS total_tokens_used,
        COALESCE(a.total_cost_estimate, 0) AS total_cost_estimate,
        COALESCE(a.models_used, ARRAY[]::text[]) AS models_used,
        COALESCE(a.tasks_used, ARRAY[]::text[]) AS tasks_used,
        COALESCE(b.blocked_call_count, 0) AS blocked_call_count,
        COALESCE(s.semantic_violation_count, 0) AS semantic_violation_count,
        COALESCE(s.critical_violation_count, 0) AS critical_violation_count,
        a.last_ai_call,
        b.last_blocked_call,
        s.last_violation_at
    FROM ai_metrics a
    FULL OUTER JOIN blocked_metrics b
        ON a.pipeline_name = b.pipeline_name
    FULL OUTER JOIN semantic_metrics s
        ON COALESCE(a.pipeline_name, b.pipeline_name) = s.pipeline_name
)
SELECT
    pipeline_name,
    total_ai_calls,
    successful_calls,
    fallback_calls,
    blocked_calls,
    avg_latency_ms,
    p95_latency_ms,
    max_latency_ms,
    total_input_tokens,
    total_output_tokens,
    total_tokens_used,
    total_cost_estimate,
    models_used,
    tasks_used,
    blocked_call_count,
    semantic_violation_count,
    critical_violation_count,
    ROUND(
        CASE
            WHEN total_ai_calls = 0 THEN 0
            ELSE (fallback_calls::numeric / NULLIF(total_ai_calls, 0)) * 100
        END,
        2
    ) AS fallback_rate_pct,
    ROUND(
        CASE
            WHEN total_ai_calls = 0 THEN 0
            ELSE (semantic_violation_count::numeric / NULLIF(total_ai_calls, 0)) * 100
        END,
        2
    ) AS semantic_violation_rate_pct,
    GREATEST(
        COALESCE(last_ai_call, 'epoch'::timestamptz),
        COALESCE(last_blocked_call, 'epoch'::timestamptz),
        COALESCE(last_violation_at, 'epoch'::timestamptz)
    ) AS last_activity_at
FROM combined;

GRANT SELECT ON public.v_pipeline_health_feed TO service_role;
