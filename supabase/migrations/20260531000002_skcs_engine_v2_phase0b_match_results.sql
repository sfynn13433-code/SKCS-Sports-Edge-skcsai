-- SKCS Engine V2 — Phase 0b: Normalized match results spine
-- See docs/SKCS_ENGINE_V2_PHASE0_DESIGN.md (provider-ID first; not events text)

CREATE TABLE IF NOT EXISTS public.match_results (
    id                  BIGSERIAL PRIMARY KEY,
    sport               TEXT NOT NULL DEFAULT 'football',
    fixture_id          TEXT NOT NULL,
    source_table        TEXT NOT NULL,
    source_id           TEXT NOT NULL,
    skcs_home_team_id   UUID REFERENCES public.skcs_teams (skcs_team_id),
    skcs_away_team_id   UUID REFERENCES public.skcs_teams (skcs_team_id),
    home_team_name      TEXT,
    away_team_name      TEXT,
    league_id           TEXT,
    league_name         TEXT,
    season              TEXT,
    home_score          INTEGER NOT NULL CHECK (home_score >= 0),
    away_score          INTEGER NOT NULL CHECK (away_score >= 0),
    status_raw          TEXT,
    status_normalized   TEXT NOT NULL DEFAULT 'finished'
        CHECK (status_normalized IN ('finished', 'abandoned', 'cancelled', 'awarded')),
    played_at           TIMESTAMPTZ NOT NULL,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT match_results_source_unique UNIQUE (source_table, source_id),
    CONSTRAINT match_results_fixture_sport_unique UNIQUE (sport, fixture_id)
);

COMMENT ON TABLE public.match_results IS
    'One row per completed match. Foundation for refresh_team_strength and V2 grading.';

CREATE INDEX IF NOT EXISTS idx_match_results_played_at
    ON public.match_results (played_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_results_league_season
    ON public.match_results (league_id, season);

CREATE INDEX IF NOT EXISTS idx_match_results_teams
    ON public.match_results (skcs_home_team_id, skcs_away_team_id);

-- Unified finished status (fixes FT vs finished vs Match Finished split)
CREATE OR REPLACE FUNCTION public.normalize_match_status(p_status TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN lower(trim(coalesce(p_status, ''))) IN (
            'ft', 'finished', 'match finished', 'full time', 'complete', 'completed', 'final'
        ) THEN 'finished'
        WHEN lower(trim(coalesce(p_status, ''))) IN ('canc', 'cancelled', 'canceled') THEN 'cancelled'
        WHEN lower(trim(coalesce(p_status, ''))) IN ('abd', 'abandoned') THEN 'abandoned'
        WHEN lower(trim(coalesce(p_status, ''))) IN ('awd', 'awarded') THEN 'awarded'
        ELSE 'finished'
    END;
$$;

-- Primary ingest: football_canonical_events API-Sports JSON
CREATE OR REPLACE FUNCTION public.ingest_match_results_from_football_canonical(
    p_provider TEXT DEFAULT 'api-sports',
    p_limit INTEGER DEFAULT 10000
)
RETURNS TABLE (processed BIGINT, with_team_ids BIGINT, without_team_ids BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_processed BIGINT := 0;
    v_with_ids BIGINT := 0;
    v_without_ids BIGINT := 0;
    r RECORD;
    v_home UUID;
    v_away UUID;
    v_home_pid TEXT;
    v_away_pid TEXT;
    v_status TEXT;
    v_home_score INTEGER;
    v_away_score INTEGER;
BEGIN
    IF to_regclass('public.football_canonical_events') IS NULL THEN
        RAISE EXCEPTION 'public.football_canonical_events does not exist';
    END IF;

    FOR r IN
        SELECT
            fce.provider_event_id,
            fce.competition_name,
            fce.season,
            fce.start_time_utc,
            fce.status,
            fce.raw_provider_data AS payload
        FROM public.football_canonical_events fce
        WHERE fce.raw_provider_data IS NOT NULL
        ORDER BY fce.start_time_utc DESC NULLS LAST
        LIMIT p_limit
    LOOP
        v_home_pid := coalesce(
            r.payload #>> '{teams,home,id}',
            r.payload #>> '{teams,home,team_id}'
        );
        v_away_pid := coalesce(
            r.payload #>> '{teams,away,id}',
            r.payload #>> '{teams,away,team_id}'
        );
        v_status := coalesce(
            r.payload #>> '{fixture,status,short}',
            r.payload #>> '{fixture,status,long}',
            r.status
        );

        IF public.normalize_match_status(v_status) <> 'finished' THEN
            CONTINUE;
        END IF;

        v_home_score := nullif(r.payload #>> '{goals,home}', '')::integer;
        v_away_score := nullif(r.payload #>> '{goals,away}', '')::integer;
        IF v_home_score IS NULL OR v_away_score IS NULL THEN
            CONTINUE;
        END IF;

        IF v_home_pid IS NOT NULL THEN
            v_home := public.upsert_skcs_team_from_provider(
                'football',
                p_provider,
                v_home_pid,
                r.payload #>> '{teams,home,name}'
            );
        END IF;
        IF v_away_pid IS NOT NULL THEN
            v_away := public.upsert_skcs_team_from_provider(
                'football',
                p_provider,
                v_away_pid,
                r.payload #>> '{teams,away,name}'
            );
        END IF;

        INSERT INTO public.match_results (
            sport,
            fixture_id,
            source_table,
            source_id,
            skcs_home_team_id,
            skcs_away_team_id,
            home_team_name,
            away_team_name,
            league_id,
            league_name,
            season,
            home_score,
            away_score,
            status_raw,
            status_normalized,
            played_at,
            metadata
        )
        VALUES (
            'football',
            r.provider_event_id,
            'football_canonical_events',
            r.provider_event_id,
            v_home,
            v_away,
            r.payload #>> '{teams,home,name}',
            r.payload #>> '{teams,away,name}',
            coalesce(r.payload #>> '{league,id}', r.payload #>> '{league,league_id}'),
            coalesce(r.payload #>> '{league,name}', r.competition_name),
            coalesce(r.payload #>> '{league,season}', r.season),
            v_home_score,
            v_away_score,
            v_status,
            'finished',
            coalesce(
                nullif(r.payload #>> '{fixture,date}', '')::timestamptz,
                r.start_time_utc
            ),
            jsonb_build_object(
                'ingest', 'ingest_match_results_from_football_canonical',
                'provider', p_provider
            )
        )
        ON CONFLICT (source_table, source_id) DO UPDATE SET
            home_score = EXCLUDED.home_score,
            away_score = EXCLUDED.away_score,
            skcs_home_team_id = COALESCE(EXCLUDED.skcs_home_team_id, match_results.skcs_home_team_id),
            skcs_away_team_id = COALESCE(EXCLUDED.skcs_away_team_id, match_results.skcs_away_team_id),
            league_id = COALESCE(EXCLUDED.league_id, match_results.league_id),
            league_name = COALESCE(EXCLUDED.league_name, match_results.league_name),
            season = COALESCE(EXCLUDED.season, match_results.season),
            status_raw = EXCLUDED.status_raw,
            updated_at = now();

        v_processed := v_processed + 1;
        IF v_home IS NOT NULL AND v_away IS NOT NULL THEN
            v_with_ids := v_with_ids + 1;
        ELSE
            v_without_ids := v_without_ids + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_processed, v_with_ids, v_without_ids;
END;
$$;

COMMENT ON FUNCTION public.ingest_match_results_from_football_canonical IS
    'Phase 0b primary path: provider team IDs from football_canonical_events JSON.';

-- DEPRECATED: events text names are not reliable for identity (audit 2026-05-31)
CREATE OR REPLACE FUNCTION public.ingest_match_results_from_events(
    p_sport_key TEXT DEFAULT 'football',
    p_limit INTEGER DEFAULT 5000
)
RETURNS TABLE (processed BIGINT, with_team_ids BIGINT, without_team_ids BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_processed BIGINT := 0;
    v_with_ids BIGINT := 0;
    v_without_ids BIGINT := 0;
    r RECORD;
    v_home UUID;
    v_away UUID;
BEGIN
    IF to_regclass('public.events') IS NULL THEN
        RAISE EXCEPTION 'public.events does not exist';
    END IF;

    FOR r IN
        SELECT
            e.id::text AS source_id,
            e.id::text AS fixture_id,
            e.sport_key,
            e.home_team,
            e.away_team,
            e.home_score,
            e.away_score,
            e.status,
            e.commence_time
        FROM public.events e
        WHERE e.sport_key = p_sport_key
          AND e.home_score IS NOT NULL
          AND e.away_score IS NOT NULL
          AND public.normalize_match_status(e.status) = 'finished'
        ORDER BY e.commence_time DESC
        LIMIT p_limit
    LOOP
        v_home := NULL;
        v_away := NULL;

        INSERT INTO public.match_results (
            sport,
            fixture_id,
            source_table,
            source_id,
            skcs_home_team_id,
            skcs_away_team_id,
            home_team_name,
            away_team_name,
            league_id,
            league_name,
            home_score,
            away_score,
            status_raw,
            status_normalized,
            played_at,
            metadata
        )
        VALUES (
            'football',
            r.fixture_id,
            'events',
            r.source_id,
            v_home,
            v_away,
            r.home_team,
            r.away_team,
            r.sport_key,
            r.sport_key,
            r.home_score,
            r.away_score,
            r.status,
            'finished',
            r.commence_time,
            jsonb_build_object('ingest', 'ingest_match_results_from_events')
        )
        ON CONFLICT (source_table, source_id) DO UPDATE SET
            home_score = EXCLUDED.home_score,
            away_score = EXCLUDED.away_score,
            status_raw = EXCLUDED.status_raw,
            status_normalized = EXCLUDED.status_normalized,
            skcs_home_team_id = COALESCE(EXCLUDED.skcs_home_team_id, match_results.skcs_home_team_id),
            skcs_away_team_id = COALESCE(EXCLUDED.skcs_away_team_id, match_results.skcs_away_team_id),
            updated_at = now();

        v_processed := v_processed + 1;
        IF v_home IS NOT NULL AND v_away IS NOT NULL THEN
            v_with_ids := v_with_ids + 1;
        ELSE
            v_without_ids := v_without_ids + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_processed, v_with_ids, v_without_ids;
END;
$$;

COMMENT ON FUNCTION public.ingest_match_results_from_events IS
    'Deprecated: scores only; skcs_team_id always NULL. Use ingest_match_results_from_football_canonical.';
