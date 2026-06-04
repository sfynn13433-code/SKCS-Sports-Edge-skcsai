-- =========================================================
-- SKCS AI Governance RLS Policies
-- Keep the AI governance tables protected while leaving the
-- rest of the development schema unchanged.
-- =========================================================

ALTER TABLE public.ai_pipeline_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_ai_calls_log ENABLE ROW LEVEL SECURITY;

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
