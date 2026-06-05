-- ============================================================================
-- SKCS Runtime Truth Mirror Alignment
-- Non-destructive migration that deploys the execution truth ledger,
-- decision fingerprint store, and additive control-plane contract fields.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- TABLE: public.pipeline_executions
-- Canonical append-only execution ledger for executeOperation() runs.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pipeline_executions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trace_id uuid NOT NULL UNIQUE,
    publish_run_id bigint,
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

DO $$
BEGIN
    IF to_regclass('public.prediction_publish_runs') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'pipeline_executions_publish_run_id_fkey'
       ) THEN
        ALTER TABLE public.pipeline_executions
            ADD CONSTRAINT pipeline_executions_publish_run_id_fkey
            FOREIGN KEY (publish_run_id)
            REFERENCES public.prediction_publish_runs(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- TABLE: public.decision_fingerprints
-- Derived, queryable fingerprints for execution runs and downstream traces.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.decision_fingerprints (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trace_id uuid NOT NULL UNIQUE,
    pipeline_execution_id bigint NOT NULL,
    prediction_id bigint,
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

DO $$
BEGIN
    IF to_regclass('public.pipeline_executions') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'decision_fingerprints_pipeline_execution_id_fkey'
       ) THEN
        ALTER TABLE public.decision_fingerprints
            ADD CONSTRAINT decision_fingerprints_pipeline_execution_id_fkey
            FOREIGN KEY (pipeline_execution_id)
            REFERENCES public.pipeline_executions(id)
            ON DELETE CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF to_regclass('public.direct1x2_prediction_final') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'decision_fingerprints_prediction_id_fkey'
       ) THEN
        ALTER TABLE public.decision_fingerprints
            ADD CONSTRAINT decision_fingerprints_prediction_id_fkey
            FOREIGN KEY (prediction_id)
            REFERENCES public.direct1x2_prediction_final(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- TABLE: public.system_health_state
-- Additive alignment with the richer control-plane contract.
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.system_health_state
    ADD COLUMN IF NOT EXISTS current_state text NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN IF NOT EXISTS state_score numeric,
    ADD COLUMN IF NOT EXISTS transition_reason text,
    ADD COLUMN IF NOT EXISTS active_violations jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS active_degradations jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS last_transition timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
    IF to_regclass('public.system_health_state') IS NOT NULL THEN
        UPDATE public.system_health_state
        SET current_state = COALESCE(current_state, state, 'UNKNOWN'),
            state_score = COALESCE(state_score, 100),
            transition_reason = COALESCE(transition_reason, reasons->>0),
            active_violations = COALESCE(active_violations, '[]'::jsonb),
            active_degradations = COALESCE(active_degradations, '[]'::jsonb),
            last_transition = COALESCE(last_transition, recorded_at),
            updated_at = COALESCE(updated_at, recorded_at, NOW())
        WHERE current_state IS NULL
           OR state_score IS NULL
           OR transition_reason IS NULL
           OR active_violations IS NULL
           OR active_degradations IS NULL
           OR last_transition IS NULL
           OR updated_at IS NULL;
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.sync_system_health_state_current_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.current_state := COALESCE(NULLIF(NEW.current_state, ''), NEW.state, 'UNKNOWN');
    NEW.active_violations := COALESCE(NEW.active_violations, '[]'::jsonb);
    NEW.active_degradations := COALESCE(NEW.active_degradations, '[]'::jsonb);
    NEW.updated_at := COALESCE(NEW.updated_at, NOW());
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF to_regclass('public.system_health_state') IS NOT NULL THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_system_health_state_current_state ON public.system_health_state';
        EXECUTE 'CREATE TRIGGER trg_sync_system_health_state_current_state BEFORE INSERT OR UPDATE ON public.system_health_state FOR EACH ROW EXECUTE FUNCTION public.sync_system_health_state_current_state()';
    END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- OPTIONAL COMPATIBILITY COLUMNS
-- Keeps the downstream publication layer aligned with the truth mirror payload.
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.predictions_raw
    ADD COLUMN IF NOT EXISTS decision_fingerprint jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS public.direct1x2_prediction_final
    ADD COLUMN IF NOT EXISTS decision_fingerprint jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- VIEWS: execution trace visibility
-- ----------------------------------------------------------------------------
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

CREATE OR REPLACE VIEW public.v_execution_truth_mirror AS
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
    pe.updated_at
FROM public.pipeline_executions pe;
