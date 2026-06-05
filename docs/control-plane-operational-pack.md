# SKCS Control Plane Operational Pack

This file is now an index for the split operational docs:

- `docs/pipeline-health-feed.md`
- `docs/alert-routing-degraded-state.md`
- `docs/runbook_degraded_states.md`

The canonical content lives in those three documents. The sections below remain as a historical combined reference.

## 1. Pipeline Metrics / Health Feed

The pipeline health feed is a **telemetry aggregation layer only**.

It collects facts from the runtime ledgers and job telemetry, but it does not decide the system state.
The control plane evaluator remains the single source of truth for `PASS`, `WARN`, `DEGRADED`, and `FAIL`.
Execution traces are stored in `pipeline_executions`; the control-plane snapshot is stored in `system_health_state`.

### 1.1 Feed inputs

- `ai_pipeline_telemetry`
- `blocked_ai_calls_log`
- `semantic_violations`
- cron and job execution metadata

### 1.2 Feed outputs

The feed should expose:

- total AI calls
- fallback count
- average latency
- token usage
- semantic violation count
- last activity time

### 1.3 Important constraint

The feed must **not** compute health bands or thresholds.
It should return raw operational facts so `controlPlaneEvaluator` can make the decision.

### 1.4 Suggested shape

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

## 2. Alert Routing + Degraded-State Protocol

Alerts must be triggered from **state transitions** in the control plane, not from the health feed directly.

### 2.1 Routing policy

- `PASS -> WARN`: send a warning to the team channel
- `WARN -> DEGRADED`: send a higher-priority warning and suppress deep pre-match enrichment
- `DEGRADED -> FAIL`: send a critical alert to the on-call route
- `FAIL -> PASS`: send a recovery notice

### 2.2 Alert payload requirements

Every alert should include:

- previous state
- new state
- transition reason
- active violations
- top affected pipeline
- timestamp
- dashboard link

### 2.3 Degraded-state behavior

When the control plane enters `DEGRADED`:

- short-circuit deep enrichment
- use fallback models
- cap confidence
- suppress hallucination-prone UI text
- keep the pipeline alive in minimal mode

When the control plane enters `FAIL`:

- block publication
- halt risky downstream jobs
- notify on-call
- require recovery through a new healthy snapshot or controller reset path

### 2.4 Key constraint

No new evaluator should be added here.
Routing should only react to the state already produced by `verificationController` and persisted in `system_health_state`.

## 3. Production Readiness Runbook

This runbook describes how operators respond to control-plane alerts.

### 3.1 How to read alerts

- `PASS`: normal operation
- `WARN`: drift detected, investigate soon
- `DEGRADED`: fallback mode active
- `FAIL`: block and recover

### 3.2 First things to check

1. Semantic drift dashboard
2. Latest `system_health_state` snapshot
3. `semantic_violations`
4. Pipeline telemetry and fallback counts

### 3.3 Response by state

#### WARN

- Review the rule failure heatmap
- Check whether a new provider field needs registry updates
- Monitor for escalation

#### DEGRADED

- Confirm that deep enrichment is being suppressed
- Check if a provider outage or semantic drift spike caused the fallback
- Let the controller recover naturally after the issue clears, or create a new healthy snapshot through the supported reset path

#### FAIL

- Stop automated publishing
- Investigate canonical identity or quota failures first
- Quarantine bad batches if needed
- Restore the upstream cause
- Release the system only after the control plane returns to a healthy snapshot

### 3.4 Recovery rule

Do **not** mutate historical health rows in place.
Recovery should happen through a new healthy control-plane snapshot or a controlled reset routine that preserves audit history.

### 3.5 Rollback notes

If a deployment introduces forbidden context or schema drift:

- revert the faulty deployment
- re-run the affected ingestion or grading job
- verify the drift summary has settled
- confirm the control plane state has returned to `PASS`

## 4. Summary

- Telemetry feeds collect facts.
- The control plane evaluates state.
- Alerts react to state transitions.
- The runbook tells humans what to do next.

