-- SEM-GOV-001D-UI3-I5 — D3 fixture display metadata (AUTHOR ONLY — NOT APPLIED BY I5 CLOSURE)
-- Parent design: SEM-GOV-001D-UI3-I4 (25 physical columns)
-- Requires: public.fixture_lifecycle_current from 20261008000001_sem_gov_001b_lifecycle_persistence.sql

CREATE TABLE IF NOT EXISTS public.fixture_display_metadata (
    fixture_uid UUID PRIMARY KEY,
    sport TEXT NOT NULL,

    scout_fixture_id TEXT NOT NULL,
    fip_id TEXT NOT NULL,
    fip_schema_version TEXT NOT NULL,
    fip_validation_hash TEXT NOT NULL,
    intake_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    home_team_scout_id TEXT NOT NULL,
    away_team_scout_id TEXT NOT NULL,

    competition_id TEXT NOT NULL,
    competition_name TEXT NOT NULL,
    kickoff_at TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
    home_team_name TEXT NOT NULL,
    away_team_name TEXT NOT NULL,
    venue TEXT NULL,
    country TEXT NULL,
    home_team_emblem_ref TEXT NULL,
    away_team_emblem_ref TEXT NULL,
    metadata_fresh_at TIMESTAMPTZ NOT NULL,

    lifecycle_closed_at TIMESTAMPTZ NULL,
    purge_eligible_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fixture_display_metadata_fixture_fk
        FOREIGN KEY (fixture_uid)
        REFERENCES public.fixture_lifecycle_current (fixture_uid)
        ON DELETE CASCADE,

    CONSTRAINT fixture_display_metadata_sport_football_chk
        CHECK (sport = 'football'),

    CONSTRAINT fixture_display_metadata_timezone_chk
        CHECK (timezone = 'Africa/Johannesburg'),

    CONSTRAINT fixture_display_metadata_required_strings_chk
        CHECK (
            length(trim(scout_fixture_id)) > 0
            AND length(trim(fip_id)) > 0
            AND length(trim(fip_schema_version)) > 0
            AND length(trim(fip_validation_hash)) > 0
            AND length(trim(intake_id)) > 0
            AND length(trim(idempotency_key)) > 0
            AND length(trim(home_team_scout_id)) > 0
            AND length(trim(away_team_scout_id)) > 0
            AND length(trim(competition_id)) > 0
            AND length(trim(competition_name)) > 0
            AND length(trim(home_team_name)) > 0
            AND length(trim(away_team_name)) > 0
        ),

    CONSTRAINT fixture_display_metadata_optional_trim_chk
        CHECK (
            venue IS NULL OR length(trim(venue)) > 0
            AND country IS NULL OR length(trim(country)) > 0
            AND home_team_emblem_ref IS NULL OR length(trim(home_team_emblem_ref)) > 0
            AND away_team_emblem_ref IS NULL OR length(trim(away_team_emblem_ref)) > 0
        ),

    CONSTRAINT fixture_display_metadata_purge_order_chk
        CHECK (
            purge_eligible_at IS NULL
            OR lifecycle_closed_at IS NULL
            OR purge_eligible_at >= lifecycle_closed_at
        ),

    CONSTRAINT fixture_display_metadata_idempotency_unique
        UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_fixture_display_metadata_purge
    ON public.fixture_display_metadata (purge_eligible_at)
    WHERE purge_eligible_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fixture_display_metadata_kickoff
    ON public.fixture_display_metadata (kickoff_at);

CREATE INDEX IF NOT EXISTS idx_fixture_display_metadata_competition
    ON public.fixture_display_metadata (competition_id);

ALTER TABLE public.fixture_display_metadata ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- ROLLBACK (NON-EXECUTING — manual only)
-- DROP TABLE IF EXISTS public.fixture_display_metadata;
-- ---------------------------------------------------------------------------
