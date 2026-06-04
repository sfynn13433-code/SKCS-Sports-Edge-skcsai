-- =========================================================
-- SKCS System Health State Ledger
-- Append-only runtime snapshot table for Layer 5 decisions.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.system_health_state (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recorded_at timestamptz NOT NULL DEFAULT now(),

    state text NOT NULL CHECK (state IN (
        'UNKNOWN',
        'HEALTHY',
        'WARN',
        'DEGRADED',
        'CRITICAL',
        'BLOCKED'
    )),

    pipeline_state text NOT NULL DEFAULT 'UNKNOWN' CHECK (pipeline_state IN (
        'UNKNOWN',
        'HEALTHY',
        'WARN',
        'DEGRADED',
        'CRITICAL',
        'BLOCKED'
    )),
    enrichment_state text NOT NULL DEFAULT 'UNKNOWN' CHECK (enrichment_state IN (
        'UNKNOWN',
        'HEALTHY',
        'WARN',
        'DEGRADED',
        'CRITICAL',
        'BLOCKED'
    )),
    quota_state text NOT NULL DEFAULT 'UNKNOWN' CHECK (quota_state IN (
        'UNKNOWN',
        'HEALTHY',
        'WARN',
        'DEGRADED',
        'CRITICAL',
        'BLOCKED'
    )),
    api_state text NOT NULL DEFAULT 'UNKNOWN' CHECK (api_state IN (
        'UNKNOWN',
        'HEALTHY',
        'WARN',
        'DEGRADED',
        'CRITICAL',
        'BLOCKED'
    )),
    db_state text NOT NULL DEFAULT 'UNKNOWN' CHECK (db_state IN (
        'UNKNOWN',
        'HEALTHY',
        'WARN',
        'DEGRADED',
        'CRITICAL',
        'BLOCKED'
    )),

    reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
    allow_publish boolean NOT NULL DEFAULT true,
    allow_write boolean NOT NULL DEFAULT true,
    use_fallback boolean NOT NULL DEFAULT false,

    signals jsonb NOT NULL DEFAULT '[]'::jsonb,
    snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_system_health_state_recorded_at
    ON public.system_health_state (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_health_state_state
    ON public.system_health_state (state, recorded_at DESC);

ALTER TABLE public.system_health_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'system_health_state'
          AND policyname = 'system_health_state_service_role_all'
    ) THEN
        CREATE POLICY system_health_state_service_role_all
            ON public.system_health_state
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;
