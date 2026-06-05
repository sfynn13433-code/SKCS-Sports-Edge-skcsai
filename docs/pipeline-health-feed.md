# SKCS Pipeline Health Feed

This document defines the telemetry feed for Blocker #7.

The feed is a **facts-only aggregation layer**. It reports operational telemetry, but it does not decide health state. `controlPlaneEvaluator` remains the only authority for `PASS`, `WARN`, `DEGRADED`, and `FAIL`.

## Purpose

- Aggregate runtime facts across AI usage, fallback behavior, latency, tokens, and semantic drift.
- Give operators and dashboards a measurable view of pipeline behavior.
- Feed the existing control plane with signals, not thresholds.

## Inputs

- `ai_pipeline_telemetry`
- `blocked_ai_calls_log`
- `semantic_violations`
- cron and job execution metadata

## Outputs

- total AI calls
- fallback count
- average latency
- token usage
- semantic violation count
- last activity time

## Hard rule

Do **not** compute `PASS`, `WARN`, `DEGRADED`, or `FAIL` in this feed.
Do **not** duplicate threshold logic outside `controlPlaneEvaluator.js`.

## Suggested view shape

```sql
CREATE OR REPLACE VIEW v_pipeline_health_feed AS
WITH ai_metrics AS (
    SELECT
        pipeline_name,
        COUNT(*) AS total_ai_calls,
        SUM(CASE WHEN status = 'fallback' THEN 1 ELSE 0 END) AS fallback_count,
        AVG(latency_ms) AS avg_latency_ms,
        SUM(total_tokens) AS total_tokens_used,
        MAX(created_at) AS last_ai_call
    FROM public.ai_pipeline_telemetry
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY pipeline_name
),
semantic_metrics AS (
    SELECT
        pipeline,
        COUNT(*) AS semantic_violation_count,
        MAX(occurred_at) AS last_violation_at
    FROM public.semantic_violations
    WHERE occurred_at >= NOW() - INTERVAL '24 hours'
    GROUP BY pipeline
)
SELECT
    COALESCE(a.pipeline_name, s.pipeline) AS pipeline,
    COALESCE(a.total_ai_calls, 0) AS total_ai_calls,
    COALESCE(a.fallback_count, 0) AS fallback_count,
    ROUND(COALESCE(a.avg_latency_ms, 0)::numeric, 2) AS avg_latency_ms,
    COALESCE(a.total_tokens_used, 0) AS total_tokens_used,
    COALESCE(s.semantic_violation_count, 0) AS semantic_violation_count,
    GREATEST(
        COALESCE(a.last_ai_call, 'epoch'::timestamptz),
        COALESCE(s.last_violation_at, 'epoch'::timestamptz)
    ) AS last_activity_at
FROM ai_metrics a
FULL OUTER JOIN semantic_metrics s
    ON a.pipeline_name = s.pipeline;
```

## How it is used

- Dashboards can display trend lines and operational load.
- Alerting should still trigger from `system_health_state` transitions, not from this feed directly.
- The feed can help operators understand why the control plane changed state, but it must not decide the state itself.

