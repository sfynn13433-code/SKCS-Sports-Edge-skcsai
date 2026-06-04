-- =========================================================
-- SKCS Service-Role RLS Policies
-- Enable RLS on backend-owned operational tables while keeping
-- the public development schema unchanged.
-- =========================================================

DO $$
DECLARE
    v_table_name text;
    v_policy_name text;
    v_tables text[] := ARRAY[
        'prediction_publish_runs',
        'rapidapi_cache',
        'rapidapi_quota_usage',
        'blocked_api_calls_log',
        'scheduling_logs',
        'scheduler_run_locks',
        'fixture_processing_log',
        'fixture_weekly_publication_log',
        'context_enrichment_queue',
        'api_usage_logs'
    ];
BEGIN
    FOREACH v_table_name IN ARRAY v_tables LOOP
        IF to_regclass(format('public.%I', v_table_name)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table_name);

            v_policy_name := v_table_name || '_service_role_all';

            IF NOT EXISTS (
                SELECT 1
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename = v_table_name
                  AND policyname = v_policy_name
            ) THEN
                EXECUTE format(
                    'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
                    v_policy_name,
                    v_table_name
                );
            END IF;
        END IF;
    END LOOP;
END
$$;
