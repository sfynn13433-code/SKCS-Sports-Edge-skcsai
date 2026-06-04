-- =========================================================
-- SKCS Public Read Reference RLS Policies
-- Shared reference and read-heavy team data stays readable
-- to anon/authenticated clients while backend writes remain
-- service-role only.
-- =========================================================

DO $$
DECLARE
    v_table_name text;
    v_tables text[] := ARRAY[
        'leagues',
        'teams',
        'matches',
        'team_stats',
        'injuries',
        'news_mentions'
    ];
BEGIN
    FOREACH v_table_name IN ARRAY v_tables LOOP
        IF to_regclass(format('public.%I', v_table_name)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table_name);

            IF NOT EXISTS (
                SELECT 1
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename = v_table_name
                  AND policyname = v_table_name || '_public_read'
            ) THEN
                EXECUTE format(
                    'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
                    v_table_name || '_public_read',
                    v_table_name
                );
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename = v_table_name
                  AND policyname = v_table_name || '_service_role_all'
            ) THEN
                EXECUTE format(
                    'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
                    v_table_name || '_service_role_all',
                    v_table_name
                );
            END IF;
        END IF;
    END LOOP;
END
$$;
