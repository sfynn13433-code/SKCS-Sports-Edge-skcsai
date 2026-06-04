-- =========================================================
-- SKCS Public Read Config RLS Policies
-- Enable RLS on shared config tables while keeping them
-- readable by anon/authenticated clients and writable only
-- by service role.
-- =========================================================

DO $$
DECLARE
    v_table_name text;
    v_policies text[] := ARRAY[
        'canonical_betting_markets',
        'skcs_subscription_plans',
        'secondary_market_allowlist',
        'tier_rules',
        'acca_rules',
        'canonical_bookmakers'
    ];
BEGIN
    FOREACH v_table_name IN ARRAY v_policies LOOP
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
