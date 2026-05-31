-- SKCS Engine V2 — Phase 0: Team identity foundation
-- See docs/SKCS_ENGINE_V2_ADR.md

-- Master team roster (one row per real-world club per sport)
CREATE TABLE IF NOT EXISTS public.skcs_teams (
    skcs_team_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sport              TEXT NOT NULL DEFAULT 'football'
        CHECK (sport IN ('football', 'soccer')),
    canonical_name     TEXT NOT NULL,
    normalized_name    TEXT GENERATED ALWAYS AS (lower(trim(canonical_name))) STORED,
    country            TEXT,
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT skcs_teams_sport_canonical_unique UNIQUE (sport, normalized_name)
);

COMMENT ON TABLE public.skcs_teams IS
    'SKCS Engine V2 master team identity. One UUID per real-world club.';

-- Provider ID → SKCS team (many rows per skcs_team_id)
CREATE TABLE IF NOT EXISTS public.team_identity_map (
    id                 BIGSERIAL PRIMARY KEY,
    skcs_team_id       UUID NOT NULL REFERENCES public.skcs_teams (skcs_team_id) ON DELETE CASCADE,
    provider           TEXT NOT NULL,
    provider_team_id   TEXT NOT NULL,
    provider_team_name TEXT,
    sport              TEXT NOT NULL DEFAULT 'football',
    is_primary         BOOLEAN NOT NULL DEFAULT false,
    confidence         NUMERIC(4, 3) DEFAULT 1.000
        CHECK (confidence >= 0 AND confidence <= 1),
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT team_identity_map_provider_unique UNIQUE (sport, provider, provider_team_id)
);

COMMENT ON TABLE public.team_identity_map IS
    'Maps external provider team IDs to skcs_team_id. Never use provider IDs in strength models.';

CREATE INDEX IF NOT EXISTS idx_team_identity_map_skcs_team
    ON public.team_identity_map (skcs_team_id);

CREATE INDEX IF NOT EXISTS idx_team_identity_map_provider_name
    ON public.team_identity_map (sport, lower(trim(provider_team_name)));

-- Searchable aliases (Man City, Manchester City FC, etc.)
CREATE TABLE IF NOT EXISTS public.team_aliases (
    id                 BIGSERIAL PRIMARY KEY,
    skcs_team_id       UUID NOT NULL REFERENCES public.skcs_teams (skcs_team_id) ON DELETE CASCADE,
    alias              TEXT NOT NULL,
    normalized_alias   TEXT GENERATED ALWAYS AS (lower(trim(alias))) STORED,
    sport              TEXT NOT NULL DEFAULT 'football',
    source             TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT team_aliases_sport_alias_unique UNIQUE (sport, normalized_alias)
);

CREATE INDEX IF NOT EXISTS idx_team_aliases_skcs_team
    ON public.team_aliases (skcs_team_id);

-- Seed identity map from existing canonical_entities (football) when present
DO $$
BEGIN
    IF to_regclass('public.canonical_entities') IS NOT NULL THEN
        INSERT INTO public.skcs_teams (sport, canonical_name, country)
        SELECT
            CASE WHEN lower(ce.sport) IN ('soccer') THEN 'football' ELSE lower(ce.sport) END,
            ce.name,
            ce.country
        FROM public.canonical_entities ce
        WHERE lower(ce.sport) IN ('football', 'soccer')
        ON CONFLICT (sport, normalized_name) DO NOTHING;

        INSERT INTO public.team_identity_map (
            skcs_team_id,
            provider,
            provider_team_id,
            provider_team_name,
            sport,
            is_primary,
            metadata
        )
        SELECT
            st.skcs_team_id,
            'canonical_entities',
            ce.provider_id,
            ce.name,
            st.sport,
            true,
            jsonb_build_object('seeded_from', 'canonical_entities', 'entity_id', ce.id::text)
        FROM public.canonical_entities ce
        INNER JOIN public.skcs_teams st
            ON st.normalized_name = lower(trim(ce.name))
           AND st.sport = CASE WHEN lower(ce.sport) IN ('soccer') THEN 'football' ELSE lower(ce.sport) END
        WHERE lower(ce.sport) IN ('football', 'soccer')
        ON CONFLICT (sport, provider, provider_team_id) DO NOTHING;

        INSERT INTO public.team_aliases (skcs_team_id, alias, sport, source)
        SELECT st.skcs_team_id, st.canonical_name, st.sport, 'canonical_name'
        FROM public.skcs_teams st
        ON CONFLICT (sport, normalized_alias) DO NOTHING;
    END IF;
END $$;

-- Register or fetch skcs_team_id for a provider team (deterministic)
CREATE OR REPLACE FUNCTION public.upsert_skcs_team_from_provider(
    p_sport TEXT,
    p_provider TEXT,
    p_provider_team_id TEXT,
    p_provider_team_name TEXT DEFAULT NULL,
    p_country TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_sport TEXT := CASE WHEN lower(coalesce(p_sport, '')) IN ('soccer') THEN 'football' ELSE lower(coalesce(p_sport, 'football')) END;
    v_team_id UUID;
    v_name TEXT := coalesce(nullif(trim(p_provider_team_name), ''), 'Team ' || p_provider_team_id);
BEGIN
    IF p_provider IS NULL OR p_provider_team_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT skcs_team_id INTO v_team_id
    FROM public.team_identity_map
    WHERE sport = v_sport
      AND provider = p_provider
      AND provider_team_id = p_provider_team_id
    LIMIT 1;

    IF v_team_id IS NOT NULL THEN
        RETURN v_team_id;
    END IF;

    INSERT INTO public.skcs_teams (sport, canonical_name, country)
    VALUES (v_sport, v_name, p_country)
    ON CONFLICT (sport, normalized_name) DO UPDATE SET updated_at = now()
    RETURNING skcs_team_id INTO v_team_id;

    INSERT INTO public.team_identity_map (
        skcs_team_id, provider, provider_team_id, provider_team_name, sport, is_primary
    )
    VALUES (v_team_id, p_provider, p_provider_team_id, p_provider_team_name, v_sport, true)
    ON CONFLICT (sport, provider, provider_team_id) DO NOTHING;

    RETURN v_team_id;
END;
$$;

-- Production resolver: provider ID only (text ignored — see SKCS_ENGINE_V2_PHASE0_DESIGN.md)
CREATE OR REPLACE FUNCTION public.resolve_skcs_team_id(
    p_sport TEXT,
    p_provider TEXT,
    p_provider_team_id TEXT,
    p_team_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_sport TEXT := CASE WHEN lower(coalesce(p_sport, '')) IN ('soccer') THEN 'football' ELSE lower(coalesce(p_sport, 'football')) END;
    v_team_id UUID;
BEGIN
    IF p_provider IS NULL OR p_provider_team_id IS NULL OR trim(p_provider_team_id) = '' THEN
        RETURN NULL;
    END IF;

    SELECT skcs_team_id INTO v_team_id
    FROM public.team_identity_map
    WHERE sport = v_sport
      AND provider = p_provider
      AND provider_team_id = trim(p_provider_team_id)
    LIMIT 1;

    RETURN v_team_id;
END;
$$;

COMMENT ON FUNCTION public.resolve_skcs_team_id IS
    'Provider-ID only. p_team_name is ignored. Use upsert_skcs_team_from_provider before resolve on ingest.';

COMMENT ON TABLE public.team_aliases IS
    'UI/search enrichment only. Not used by resolve_skcs_team_id or V2 ingest.';
