-- =========================================================
-- SKCS AI Governance Layer
-- Migration 04: ai_pipeline_telemetry + ai_usage_daily
--               + blocked_ai_calls_log + rollup + budget check
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------
-- 1) Raw AI telemetry ledger
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_pipeline_telemetry (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recorded_at timestamptz NOT NULL DEFAULT now(),

    pipeline_name text NOT NULL,
    task_name text NOT NULL,
    model text NOT NULL,

    success boolean NOT NULL DEFAULT false,
    finish_reason text,
    status text,
    partial boolean NOT NULL DEFAULT false,
    ceiling_type text,

    input_tokens integer NOT NULL DEFAULT 0,
    output_tokens integer NOT NULL DEFAULT 0,
    total_tokens integer GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,

    cost_estimate numeric,
    latency_ms integer,

    input_class text,
    knowledge_context text,
    budget_class text,
    monthly_risk text,

    avg_input_tokens integer,
    p95_input_tokens integer,
    max_input_tokens integer,
    avg_output_tokens integer,
    p95_output_tokens integer,
    max_output_tokens integer,

    fixture_id text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT ai_pipeline_telemetry_finish_reason_check CHECK (
        finish_reason IS NULL OR finish_reason IN (
            'stop',
            'length',
            'content_filter',
            'budget_blocked',
            'error',
            'timeout',
            'other'
        )
    ),
    CONSTRAINT ai_pipeline_telemetry_status_check CHECK (
        status IS NULL OR status IN (
            'complete',
            'cached',
            'blocked',
            'partial_failed',
            'retry_pending',
            'failed'
        )
    ),
    CONSTRAINT ai_pipeline_telemetry_input_class_check CHECK (
        input_class IS NULL OR input_class IN ('XS', 'S', 'M', 'L', 'XL')
    ),
    CONSTRAINT ai_pipeline_telemetry_knowledge_context_check CHECK (
        knowledge_context IS NULL OR knowledge_context IN ('static', 'retrieved', 'hybrid')
    ),
    CONSTRAINT ai_pipeline_telemetry_budget_class_check CHECK (
        budget_class IS NULL OR budget_class IN ('Critical', 'Important', 'Optional')
    ),
    CONSTRAINT ai_pipeline_telemetry_monthly_risk_check CHECK (
        monthly_risk IS NULL OR monthly_risk IN ('Low', 'Medium', 'High')
    ),
    CONSTRAINT ai_pipeline_telemetry_ceiling_type_check CHECK (
        ceiling_type IS NULL OR ceiling_type IN ('daily', 'monthly', 'per_task', 'input', 'output', 'hard_cap')
    )
);

CREATE INDEX IF NOT EXISTS idx_ai_pipeline_telemetry_recorded_at
    ON public.ai_pipeline_telemetry (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_pipeline_telemetry_pipeline_time
    ON public.ai_pipeline_telemetry (pipeline_name, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_pipeline_telemetry_task_time
    ON public.ai_pipeline_telemetry (task_name, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_pipeline_telemetry_model_time
    ON public.ai_pipeline_telemetry (model, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_pipeline_telemetry_fixture
    ON public.ai_pipeline_telemetry (fixture_id);

CREATE INDEX IF NOT EXISTS idx_ai_pipeline_telemetry_status
    ON public.ai_pipeline_telemetry (status);

CREATE INDEX IF NOT EXISTS idx_ai_pipeline_telemetry_ceiling
    ON public.ai_pipeline_telemetry (ceiling_type)
    WHERE ceiling_type IS NOT NULL;

ALTER TABLE public.ai_pipeline_telemetry ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'ai_pipeline_telemetry'
          AND policyname = 'ai_pipeline_telemetry_service_role_all'
    ) THEN
        CREATE POLICY ai_pipeline_telemetry_service_role_all
            ON public.ai_pipeline_telemetry
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;

-- ---------------------------------------------------------
-- 2) Daily usage rollup for fast pre-flight checks
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
    id bigserial PRIMARY KEY,
    usage_date date NOT NULL,
    pipeline_name text NOT NULL,
    task_name text NOT NULL,
    model text NOT NULL,

    total_calls integer NOT NULL DEFAULT 0,
    successful_calls integer NOT NULL DEFAULT 0,
    blocked_calls integer NOT NULL DEFAULT 0,
    total_input_tokens bigint NOT NULL DEFAULT 0,
    total_output_tokens bigint NOT NULL DEFAULT 0,
    total_tokens bigint GENERATED ALWAYS AS (total_input_tokens + total_output_tokens) STORED,

    avg_input_tokens numeric,
    p95_input_tokens integer,
    max_input_tokens integer,
    avg_output_tokens numeric,
    p95_output_tokens integer,
    max_output_tokens integer,

    total_cost_estimate numeric NOT NULL DEFAULT 0,
    month_cumulative_tokens bigint,
    month_cumulative_cost numeric,

    last_updated timestamptz NOT NULL DEFAULT now(),
    UNIQUE (usage_date, pipeline_name, task_name, model)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_date
    ON public.ai_usage_daily (usage_date, pipeline_name, task_name, model);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_pipeline_time
    ON public.ai_usage_daily (pipeline_name, usage_date DESC);

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'ai_usage_daily'
          AND policyname = 'ai_usage_daily_service_role_all'
    ) THEN
        CREATE POLICY ai_usage_daily_service_role_all
            ON public.ai_usage_daily
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;

-- ---------------------------------------------------------
-- 3) Blocked call log
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocked_ai_calls_log (
    id bigserial PRIMARY KEY,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    pipeline_name text NOT NULL,
    task_name text NOT NULL,
    model text NOT NULL,
    reason text NOT NULL,
    requested_input_tokens integer,
    requested_output_tokens integer,
    budget_class text,
    ceiling_type text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_blocked_ai_calls_log_recorded_at
    ON public.blocked_ai_calls_log (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_blocked_ai_calls_log_pipeline
    ON public.blocked_ai_calls_log (pipeline_name, task_name, model, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_blocked_ai_calls_log_ceiling
    ON public.blocked_ai_calls_log (ceiling_type)
    WHERE ceiling_type IS NOT NULL;

ALTER TABLE public.blocked_ai_calls_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'blocked_ai_calls_log'
          AND policyname = 'blocked_ai_calls_log_service_role_all'
    ) THEN
        CREATE POLICY blocked_ai_calls_log_service_role_all
            ON public.blocked_ai_calls_log
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;

-- ---------------------------------------------------------
-- 4) Roll up telemetry into daily usage rows
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aggregate_ai_usage_daily(p_date date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_date date := COALESCE(p_date, current_date - 1);
BEGIN
    WITH daily_agg AS (
        SELECT
            t.pipeline_name,
            t.task_name,
            t.model,
            COUNT(*)::integer AS total_calls,
            SUM(CASE WHEN t.success THEN 1 ELSE 0 END)::integer AS successful_calls,
            SUM(CASE WHEN NOT t.success THEN 1 ELSE 0 END)::integer AS blocked_calls,
            COALESCE(SUM(t.input_tokens), 0)::bigint AS total_input_tokens,
            COALESCE(SUM(t.output_tokens), 0)::bigint AS total_output_tokens,
            ROUND(AVG(t.input_tokens)::numeric, 2) AS avg_input_tokens,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY t.input_tokens)::integer AS p95_input_tokens,
            MAX(t.input_tokens)::integer AS max_input_tokens,
            ROUND(AVG(t.output_tokens)::numeric, 2) AS avg_output_tokens,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY t.output_tokens)::integer AS p95_output_tokens,
            MAX(t.output_tokens)::integer AS max_output_tokens,
            COALESCE(SUM(t.cost_estimate), 0)::numeric AS total_cost_estimate
        FROM public.ai_pipeline_telemetry t
        WHERE t.recorded_at >= v_date::timestamptz
          AND t.recorded_at < (v_date + 1)::timestamptz
        GROUP BY t.pipeline_name, t.task_name, t.model
    ),
    upserted AS (
        INSERT INTO public.ai_usage_daily (
            usage_date,
            pipeline_name,
            task_name,
            model,
            total_calls,
            successful_calls,
            blocked_calls,
            total_input_tokens,
            total_output_tokens,
            avg_input_tokens,
            p95_input_tokens,
            max_input_tokens,
            avg_output_tokens,
            p95_output_tokens,
            max_output_tokens,
            total_cost_estimate,
            month_cumulative_tokens,
            month_cumulative_cost,
            last_updated
        )
        SELECT
            v_date,
            da.pipeline_name,
            da.task_name,
            da.model,
            da.total_calls,
            da.successful_calls,
            da.blocked_calls,
            da.total_input_tokens,
            da.total_output_tokens,
            da.avg_input_tokens,
            da.p95_input_tokens,
            da.max_input_tokens,
            da.avg_output_tokens,
            da.p95_output_tokens,
            da.max_output_tokens,
            da.total_cost_estimate,
            NULL,
            NULL,
            now()
        FROM daily_agg da
        ON CONFLICT (usage_date, pipeline_name, task_name, model) DO UPDATE
        SET
            total_calls = EXCLUDED.total_calls,
            successful_calls = EXCLUDED.successful_calls,
            blocked_calls = EXCLUDED.blocked_calls,
            total_input_tokens = EXCLUDED.total_input_tokens,
            total_output_tokens = EXCLUDED.total_output_tokens,
            avg_input_tokens = EXCLUDED.avg_input_tokens,
            p95_input_tokens = EXCLUDED.p95_input_tokens,
            max_input_tokens = EXCLUDED.max_input_tokens,
            avg_output_tokens = EXCLUDED.avg_output_tokens,
            p95_output_tokens = EXCLUDED.p95_output_tokens,
            max_output_tokens = EXCLUDED.max_output_tokens,
            total_cost_estimate = EXCLUDED.total_cost_estimate,
            last_updated = now()
        RETURNING usage_date, pipeline_name, task_name, model
    )
    UPDATE public.ai_usage_daily d
    SET
        month_cumulative_tokens = monthly.month_cumulative_tokens,
        month_cumulative_cost = monthly.month_cumulative_cost,
        last_updated = now()
    FROM (
        SELECT
            u.usage_date,
            u.pipeline_name,
            u.task_name,
            u.model,
            COALESCE(SUM(m.total_tokens), 0)::bigint AS month_cumulative_tokens,
            COALESCE(SUM(m.total_cost_estimate), 0)::numeric AS month_cumulative_cost
        FROM public.ai_usage_daily u
        JOIN public.ai_usage_daily m
          ON m.pipeline_name = u.pipeline_name
         AND m.task_name = u.task_name
         AND m.model = u.model
         AND m.usage_date >= date_trunc('month', u.usage_date)::date
         AND m.usage_date <= u.usage_date
        WHERE u.usage_date = v_date
        GROUP BY u.usage_date, u.pipeline_name, u.task_name, u.model
    ) monthly
    WHERE d.usage_date = monthly.usage_date
      AND d.pipeline_name = monthly.pipeline_name
      AND d.task_name = monthly.task_name
      AND d.model = monthly.model;
END;
$$;

-- ---------------------------------------------------------
-- 5) Pre-flight budget check using only daily rollups
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_ai_budget(
    p_pipeline_name text,
    p_task_name text,
    p_model text,
    p_daily_call_limit integer DEFAULT NULL,
    p_daily_token_limit integer DEFAULT NULL,
    p_monthly_cost_limit numeric DEFAULT NULL,
    p_monthly_token_limit bigint DEFAULT NULL
)
RETURNS TABLE (
    allowed boolean,
    reason text,
    daily_calls bigint,
    daily_tokens bigint,
    daily_cost numeric,
    mtd_calls bigint,
    mtd_tokens bigint,
    mtd_cost numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH today AS (
        SELECT
            COALESCE(SUM(total_calls), 0)::bigint AS daily_calls,
            COALESCE(SUM(total_tokens), 0)::bigint AS daily_tokens,
            COALESCE(SUM(total_cost_estimate), 0)::numeric AS daily_cost
        FROM public.ai_usage_daily
        WHERE usage_date = current_date
          AND pipeline_name = p_pipeline_name
          AND task_name = p_task_name
          AND model = p_model
    ),
    month_to_date AS (
        SELECT
            COALESCE(SUM(total_calls), 0)::bigint AS mtd_calls,
            COALESCE(SUM(total_tokens), 0)::bigint AS mtd_tokens,
            COALESCE(SUM(total_cost_estimate), 0)::numeric AS mtd_cost
        FROM public.ai_usage_daily
        WHERE usage_date >= date_trunc('month', current_date)::date
          AND usage_date <= current_date
          AND pipeline_name = p_pipeline_name
          AND task_name = p_task_name
          AND model = p_model
    )
    SELECT
        CASE
            WHEN p_daily_call_limit IS NOT NULL AND today.daily_calls >= p_daily_call_limit THEN false
            WHEN p_daily_token_limit IS NOT NULL AND today.daily_tokens >= p_daily_token_limit THEN false
            WHEN p_monthly_token_limit IS NOT NULL AND month_to_date.mtd_tokens >= p_monthly_token_limit THEN false
            WHEN p_monthly_cost_limit IS NOT NULL AND month_to_date.mtd_cost >= p_monthly_cost_limit THEN false
            ELSE true
        END AS allowed,
        CASE
            WHEN p_daily_call_limit IS NOT NULL AND today.daily_calls >= p_daily_call_limit THEN 'daily_call_limit'
            WHEN p_daily_token_limit IS NOT NULL AND today.daily_tokens >= p_daily_token_limit THEN 'daily_token_limit'
            WHEN p_monthly_token_limit IS NOT NULL AND month_to_date.mtd_tokens >= p_monthly_token_limit THEN 'monthly_token_limit'
            WHEN p_monthly_cost_limit IS NOT NULL AND month_to_date.mtd_cost >= p_monthly_cost_limit THEN 'monthly_cost_limit'
            ELSE 'ok'
        END AS reason,
        today.daily_calls,
        today.daily_tokens,
        today.daily_cost,
        month_to_date.mtd_calls,
        month_to_date.mtd_tokens,
        month_to_date.mtd_cost
    FROM today, month_to_date;
END;
$$;

-- ---------------------------------------------------------
-- 6) Helper to record blocked AI calls
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_blocked_ai_call(
    p_pipeline_name text,
    p_task_name text,
    p_model text,
    p_reason text,
    p_requested_input_tokens integer DEFAULT NULL,
    p_requested_output_tokens integer DEFAULT NULL,
    p_budget_class text DEFAULT NULL,
    p_ceiling_type text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id bigint;
BEGIN
    INSERT INTO public.blocked_ai_calls_log (
        pipeline_name,
        task_name,
        model,
        reason,
        requested_input_tokens,
        requested_output_tokens,
        budget_class,
        ceiling_type,
        metadata
    )
    VALUES (
        p_pipeline_name,
        p_task_name,
        p_model,
        p_reason,
        p_requested_input_tokens,
        p_requested_output_tokens,
        p_budget_class,
        p_ceiling_type,
        COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- ---------------------------------------------------------
-- 7) Optional rollup schedule note
-- ---------------------------------------------------------
-- Recommended cron:
-- SELECT aggregate_ai_usage_daily(current_date - 1);
-- Run at ~00:05 SAST (or your chosen business timezone) so the rollup
-- completes after the day boundary and stays aligned with your budget reset.
