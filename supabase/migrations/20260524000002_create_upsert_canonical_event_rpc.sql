-- 1. Destroy the old version of the function first
DROP FUNCTION IF EXISTS public.upsert_canonical_event CASCADE;

-- 2. Build the new version
CREATE OR REPLACE FUNCTION public.upsert_canonical_event(
    p_provider_name TEXT,
    p_provider_event_id TEXT,
    p_sport TEXT,
    p_competition_name TEXT,
    p_season TEXT,
    p_start_time_utc TIMESTAMPTZ,
    p_status TEXT,
    p_raw_payload JSONB
) RETURNS void AS $$
BEGIN
    INSERT INTO public.canonical_events (
        provider_name, 
        provider_event_id, 
        sport, 
        competition_name, 
        season, 
        start_time_utc, 
        status, 
        raw_provider_data, 
        updated_at
    ) 
    VALUES (
        p_provider_name, 
        p_provider_event_id, 
        p_sport, 
        p_competition_name, 
        p_season, 
        p_start_time_utc, 
        p_status, 
        p_raw_payload, 
        now()
    )
    ON CONFLICT (provider_name, sport, provider_event_id) 
    DO UPDATE SET 
        start_time_utc = EXCLUDED.start_time_utc,
        status = EXCLUDED.status,
        raw_provider_data = EXCLUDED.raw_provider_data,
        updated_at = now();
END;
$$ LANGUAGE plpgsql;
