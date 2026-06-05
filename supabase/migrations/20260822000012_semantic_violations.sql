-- =========================================================
-- SKCS Semantic Violations Ledger
-- Append-only governance ledger for semantic enforcement events.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.semantic_violations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    pipeline text NOT NULL,
    violation_type text NOT NULL,
    severity text NOT NULL DEFAULT 'warning',
    rule_id text NOT NULL,
    field_path text,
    raw_value jsonb,
    context jsonb NOT NULL DEFAULT '{}'::jsonb,
    game_id bigint,
    message text NOT NULL DEFAULT '',
    resolved boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_semantic_violations_time
    ON public.semantic_violations (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_semantic_violations_pipeline
    ON public.semantic_violations (pipeline, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_semantic_violations_type
    ON public.semantic_violations (violation_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_semantic_violations_game
    ON public.semantic_violations (game_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_semantic_violations_resolved
    ON public.semantic_violations (resolved, occurred_at DESC)
    WHERE resolved = false;

ALTER TABLE public.semantic_violations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'semantic_violations'
          AND policyname = 'semantic_violations_service_role_all'
    ) THEN
        CREATE POLICY semantic_violations_service_role_all
            ON public.semantic_violations
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;
