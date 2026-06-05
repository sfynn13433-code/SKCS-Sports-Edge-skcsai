-- ============================================================================
-- SKCS Runtime Truth Mirror
-- Reuses existing runtime anchors:
--   - prediction_publish_runs for publish-flow lineage
--   - system_health_state for control-plane state
--   - semantic_violations for drift/blocked semantics
-- Adds execution-trace persistence and controlled rule-change history.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- TABLE: pipeline_executions
-- Append-only execution trace ledger for executeOperation() runs.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pipeline_executions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trace_id uuid NOT NULL UNIQUE,
    publish_run_id bigint REFERENCES public.prediction_publish_runs(id) ON DELETE SET NULL,
    operation text NOT NULL,
    caller text NOT NULL,
    final_decision text NOT NULL CHECK (final_decision IN ('SUCCESS', 'HALTED', 'ERROR')),
    halted_at text,
    full_trace jsonb NOT NULL DEFAULT '{}'::jsonb,
    metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
    decision_fingerprint jsonb,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_executions_trace_id
    ON public.pipeline_executions (trace_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_executions_publish_run_id
    ON public.pipeline_executions (publish_run_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_executions_final_decision
    ON public.pipeline_executions (final_decision, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_executions_started_at
    ON public.pipeline_executions (started_at DESC);

ALTER TABLE public.pipeline_executions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'pipeline_executions'
          AND policyname = 'pipeline_executions_service_role_all'
    ) THEN
        CREATE POLICY pipeline_executions_service_role_all
            ON public.pipeline_executions
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- TABLE: decision_fingerprints
-- Derived, queryable decision fingerprints for execution runs and outputs.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.decision_fingerprints (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trace_id uuid NOT NULL UNIQUE,
    pipeline_execution_id bigint NOT NULL REFERENCES public.pipeline_executions(id) ON DELETE CASCADE,
    prediction_id bigint REFERENCES public.direct1x2_prediction_final(id) ON DELETE SET NULL,
    fingerprint jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_fingerprints_trace_id
    ON public.decision_fingerprints (trace_id);

CREATE INDEX IF NOT EXISTS idx_decision_fingerprints_pipeline_execution_id
    ON public.decision_fingerprints (pipeline_execution_id);

CREATE INDEX IF NOT EXISTS idx_decision_fingerprints_prediction_id
    ON public.decision_fingerprints (prediction_id);

CREATE INDEX IF NOT EXISTS idx_decision_fingerprints_created_at
    ON public.decision_fingerprints (created_at DESC);

ALTER TABLE public.decision_fingerprints ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'decision_fingerprints'
          AND policyname = 'decision_fingerprints_service_role_all'
    ) THEN
        CREATE POLICY decision_fingerprints_service_role_all
            ON public.decision_fingerprints
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- TABLE: rule_change_history
-- Controlled adaptation ledger for approved rule modifications.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rule_change_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    change_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    pipeline_execution_id bigint REFERENCES public.pipeline_executions(id) ON DELETE SET NULL,
    trace_id uuid,
    source text NOT NULL,
    action text NOT NULL,
    target text NOT NULL,
    previous_state jsonb NOT NULL DEFAULT '{}'::jsonb,
    new_state jsonb NOT NULL DEFAULT '{}'::jsonb,
    approved_by text,
    approval_method text,
    reason text,
    version text NOT NULL DEFAULT 'v1',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rule_change_history_created_at
    ON public.rule_change_history (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rule_change_history_source_target
    ON public.rule_change_history (source, target, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rule_change_history_trace_id
    ON public.rule_change_history (trace_id);

ALTER TABLE public.rule_change_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'rule_change_history'
          AND policyname = 'rule_change_history_service_role_all'
    ) THEN
        CREATE POLICY rule_change_history_service_role_all
            ON public.rule_change_history
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- VIEWS: operational trace visibility
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_recent_hard_stops AS
SELECT
    pe.id,
    pe.trace_id,
    pe.publish_run_id,
    pe.operation,
    pe.caller,
    pe.final_decision,
    pe.halted_at,
    pe.metrics,
    pe.started_at,
    pe.completed_at,
    pe.created_at,
    pe.updated_at
FROM public.pipeline_executions pe
WHERE pe.final_decision <> 'SUCCESS'
ORDER BY pe.started_at DESC;

CREATE OR REPLACE VIEW public.v_decision_trace AS
SELECT
    pe.id AS pipeline_execution_id,
    pe.trace_id,
    pe.publish_run_id,
    pe.operation,
    pe.caller,
    pe.final_decision,
    pe.halted_at,
    pe.full_trace,
    pe.metrics,
    pe.decision_fingerprint,
    pe.started_at,
    pe.completed_at,
    pe.created_at,
    pe.updated_at,
    df.id AS fingerprint_id,
    df.prediction_id,
    df.fingerprint AS decision_fingerprint_row,
    df.created_at AS fingerprint_created_at
FROM public.pipeline_executions pe
LEFT JOIN public.decision_fingerprints df
    ON df.pipeline_execution_id = pe.id;

CREATE OR REPLACE VIEW public.v_rule_changes_summary AS
SELECT
    date_trunc('day', rch.created_at) AS day_bucket,
    rch.source,
    rch.action,
    rch.target,
    count(*) AS change_count,
    max(rch.created_at) AS last_changed_at
FROM public.rule_change_history rch
GROUP BY 1, 2, 3, 4
ORDER BY day_bucket DESC, change_count DESC;

CREATE OR REPLACE VIEW public.v_execution_truth_mirror AS
SELECT
    pe.id AS pipeline_execution_id,
    pe.trace_id,
    pe.publish_run_id,
    pr.trigger_source,
    pr.run_scope,
    pr.status AS publish_run_status,
    pe.operation,
    pe.caller,
    pe.final_decision,
    pe.halted_at,
    pe.full_trace,
    pe.metrics,
    pe.decision_fingerprint,
    pe.started_at,
    pe.completed_at,
    pe.created_at,
    pe.updated_at
FROM public.pipeline_executions pe
LEFT JOIN public.prediction_publish_runs pr
    ON pr.id = pe.publish_run_id;

-- Optional, denormalized convenience columns for the live prediction layer.
ALTER TABLE public.predictions_raw
    ADD COLUMN IF NOT EXISTS decision_fingerprint jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.direct1x2_prediction_final
    ADD COLUMN IF NOT EXISTS decision_fingerprint jsonb NOT NULL DEFAULT '{}'::jsonb;
