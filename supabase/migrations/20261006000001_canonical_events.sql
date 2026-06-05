-- ============================================================================
-- SKCS Canonical Events Table
-- Restores the canonical football ingest target expected by upsert_canonical_event.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.canonical_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider_name text NOT NULL,
    provider_event_id text NOT NULL,
    sport text NOT NULL DEFAULT 'football',
    competition_name text,
    season text,
    start_time_utc timestamptz,
    status text,
    raw_provider_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT canonical_events_provider_sport_event_unique UNIQUE (provider_name, sport, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_canonical_events_start_time_utc
    ON public.canonical_events (start_time_utc DESC);

CREATE INDEX IF NOT EXISTS idx_canonical_events_provider_sport
    ON public.canonical_events (provider_name, sport);

ALTER TABLE public.canonical_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'canonical_events'
          AND policyname = 'canonical_events_service_role_all'
    ) THEN
        CREATE POLICY canonical_events_service_role_all
            ON public.canonical_events
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;
