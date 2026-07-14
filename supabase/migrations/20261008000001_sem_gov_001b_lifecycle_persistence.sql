-- SEM-GOV-001B-I4 — Lifecycle persistence tables (AUTHOR ONLY — NOT APPLIED BY I4 CLOSURE)
-- Capacity law: 50 admissions/day SAST, 180d transition retention (CAP2 sealed)
-- pgcrypto already established in prior migrations (gen_random_uuid)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- TABLE 1: fixture_lifecycle_current
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fixture_lifecycle_current (
    fixture_uid UUID PRIMARY KEY,
    sport TEXT NOT NULL,
    lifecycle_state TEXT NOT NULL,
    lifecycle_stage TEXT NOT NULL,
    day_label TEXT NOT NULL,
    kickoff_at TIMESTAMPTZ NOT NULL,
    engine_stage SMALLINT NULL,
    publication_eligible BOOLEAN NOT NULL DEFAULT false,
    hold_category TEXT NULL,
    elimination_category TEXT NULL,
    evidence_fresh_at TIMESTAMPTZ NULL,
    scout_fip_id TEXT NULL,
    scout_validation_hash TEXT NULL,
    transition_version BIGINT NOT NULL DEFAULT 1,
    archive_closed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fixture_lifecycle_current_sport_football_chk
        CHECK (sport = 'football'),
    CONSTRAINT fixture_lifecycle_current_state_chk
        CHECK (lifecycle_state IN (
            'VISIBLE', 'UNDER_REVIEW', 'HELD', 'ELIMINATED',
            'FINAL_APPROVED', 'CANCELLED', 'POSTPONED', 'ARCHIVED'
        )),
    CONSTRAINT fixture_lifecycle_current_stage_chk
        CHECK (lifecycle_stage IN (
            'ADMITTED', 'EVIDENCE_REVIEW', 'CONTEXT_REVIEW',
            'STABILITY_REVIEW', 'PUBLICATION_REVIEW', 'FINAL_DECISION'
        )),
    CONSTRAINT fixture_lifecycle_current_day_label_chk
        CHECK (day_label IN (
            'TODAY', 'DAY_2', 'DAY_3', 'DAY_4', 'DAY_5', 'DAY_6', 'DAY_7', 'DAY_8'
        )),
    CONSTRAINT fixture_lifecycle_current_engine_stage_chk
        CHECK (engine_stage IS NULL OR (engine_stage >= 1 AND engine_stage <= 6)),
    CONSTRAINT fixture_lifecycle_current_transition_version_chk
        CHECK (transition_version >= 1)
);

CREATE INDEX IF NOT EXISTS idx_fixture_lifecycle_current_funnel
    ON public.fixture_lifecycle_current (sport, day_label, lifecycle_state);

CREATE INDEX IF NOT EXISTS idx_fixture_lifecycle_current_kickoff
    ON public.fixture_lifecycle_current (kickoff_at);

CREATE INDEX IF NOT EXISTS idx_fixture_lifecycle_current_active_archive
    ON public.fixture_lifecycle_current (lifecycle_state, day_label)
    WHERE lifecycle_state IN ('VISIBLE', 'UNDER_REVIEW', 'HELD');

-- ---------------------------------------------------------------------------
-- TABLE 2: fixture_identity_aliases
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fixture_identity_aliases (
    alias_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixture_uid UUID NOT NULL,
    alias_namespace TEXT NOT NULL,
    alias_value TEXT NOT NULL,
    source_system TEXT NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fixture_identity_aliases_fixture_fk
        FOREIGN KEY (fixture_uid) REFERENCES public.fixture_lifecycle_current (fixture_uid)
        ON DELETE RESTRICT,
    CONSTRAINT fixture_identity_aliases_unique_ns_value
        UNIQUE (alias_namespace, alias_value),
    CONSTRAINT fixture_identity_aliases_seen_order_chk
        CHECK (first_seen_at <= last_seen_at)
);

CREATE INDEX IF NOT EXISTS idx_fixture_identity_aliases_fixture_uid
    ON public.fixture_identity_aliases (fixture_uid);

-- ---------------------------------------------------------------------------
-- TABLE 3: fixture_lifecycle_transition_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fixture_lifecycle_transition_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixture_uid UUID NOT NULL,
    transition_version BIGINT NOT NULL,
    from_state TEXT NULL,
    to_state TEXT NOT NULL,
    from_stage TEXT NULL,
    to_stage TEXT NULL,
    reason_category TEXT NOT NULL,
    reason_detail_safe TEXT NULL,
    source_actor TEXT NOT NULL,
    source_ref TEXT NULL,
    scout_fip_id TEXT NULL,
    scout_validation_hash TEXT NULL,
    idempotency_key TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archive_closed_at TIMESTAMPTZ NULL,
    CONSTRAINT fixture_lifecycle_transition_events_fixture_fk
        FOREIGN KEY (fixture_uid) REFERENCES public.fixture_lifecycle_current (fixture_uid)
        ON DELETE RESTRICT,
    CONSTRAINT fixture_lifecycle_transition_events_version_chk
        CHECK (transition_version >= 1),
    CONSTRAINT fixture_lifecycle_transition_events_from_state_chk
        CHECK (from_state IS NULL OR from_state IN (
            'VISIBLE', 'UNDER_REVIEW', 'HELD', 'ELIMINATED',
            'FINAL_APPROVED', 'CANCELLED', 'POSTPONED', 'ARCHIVED'
        )),
    CONSTRAINT fixture_lifecycle_transition_events_to_state_chk
        CHECK (to_state IN (
            'VISIBLE', 'UNDER_REVIEW', 'HELD', 'ELIMINATED',
            'FINAL_APPROVED', 'CANCELLED', 'POSTPONED', 'ARCHIVED'
        )),
    CONSTRAINT fixture_lifecycle_transition_events_from_stage_chk
        CHECK (from_stage IS NULL OR from_stage IN (
            'ADMITTED', 'EVIDENCE_REVIEW', 'CONTEXT_REVIEW',
            'STABILITY_REVIEW', 'PUBLICATION_REVIEW', 'FINAL_DECISION'
        )),
    CONSTRAINT fixture_lifecycle_transition_events_to_stage_chk
        CHECK (to_stage IS NULL OR to_stage IN (
            'ADMITTED', 'EVIDENCE_REVIEW', 'CONTEXT_REVIEW',
            'STABILITY_REVIEW', 'PUBLICATION_REVIEW', 'FINAL_DECISION'
        )),
    CONSTRAINT fixture_lifecycle_transition_events_idempotency_uniq
        UNIQUE (fixture_uid, idempotency_key),
    CONSTRAINT fixture_lifecycle_transition_events_fixture_version_uniq
        UNIQUE (fixture_uid, transition_version)
);

CREATE INDEX IF NOT EXISTS idx_fixture_lifecycle_transition_events_archive_closed
    ON public.fixture_lifecycle_transition_events (archive_closed_at)
    WHERE archive_closed_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- TABLE 4: fixture_lifecycle_rollover_events (storage only — worker is I5)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fixture_lifecycle_rollover_events (
    rollover_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rollover_key DATE NOT NULL UNIQUE,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    fixtures_archived_count INTEGER NOT NULL DEFAULT 0,
    fixtures_carried_forward INTEGER NOT NULL DEFAULT 0,
    day8_admitted_count INTEGER NOT NULL DEFAULT 0,
    snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT fixture_lifecycle_rollover_events_counts_chk
        CHECK (
            fixtures_archived_count >= 0
            AND fixtures_carried_forward >= 0
            AND day8_admitted_count >= 0
        )
);

-- ---------------------------------------------------------------------------
-- TABLE 5: lifecycle_daily_admission_counters
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lifecycle_daily_admission_counters (
    admission_date_sast DATE PRIMARY KEY,
    admitted_count INTEGER NOT NULL DEFAULT 0,
    ceiling INTEGER NOT NULL DEFAULT 50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    transition_version INTEGER NOT NULL DEFAULT 1,
    last_fixture_uid UUID NULL,
    last_idempotency_key TEXT NULL,
    CONSTRAINT lifecycle_daily_admission_counters_admitted_chk
        CHECK (admitted_count >= 0),
    CONSTRAINT lifecycle_daily_admission_counters_ceiling_chk
        CHECK (ceiling >= 0 AND ceiling <= 50),
    CONSTRAINT lifecycle_daily_admission_counters_count_ceiling_chk
        CHECK (admitted_count <= ceiling),
    CONSTRAINT lifecycle_daily_admission_counters_version_chk
        CHECK (transition_version >= 1)
);

-- ---------------------------------------------------------------------------
-- TABLE 6: lifecycle_admission_idempotency
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lifecycle_admission_idempotency (
    admission_idempotency_key TEXT PRIMARY KEY,
    fixture_uid UUID NOT NULL,
    admission_date_sast DATE NOT NULL,
    outcome TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT lifecycle_admission_idempotency_fixture_fk
        FOREIGN KEY (fixture_uid) REFERENCES public.fixture_lifecycle_current (fixture_uid)
        ON DELETE RESTRICT,
    CONSTRAINT lifecycle_admission_idempotency_outcome_chk
        CHECK (outcome IN ('ADMITTED'))
);

-- ---------------------------------------------------------------------------
-- ROLLBACK (NON-EXECUTING — manual only, I4 lifecycle tables)
-- DROP TABLE IF EXISTS public.lifecycle_admission_idempotency;
-- DROP TABLE IF EXISTS public.lifecycle_daily_admission_counters;
-- DROP TABLE IF EXISTS public.fixture_lifecycle_transition_events;
-- DROP TABLE IF EXISTS public.fixture_identity_aliases;
-- DROP TABLE IF EXISTS public.fixture_lifecycle_rollover_events;
-- DROP TABLE IF EXISTS public.fixture_lifecycle_current;
-- ---------------------------------------------------------------------------
