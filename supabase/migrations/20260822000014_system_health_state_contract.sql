-- =========================================================
-- SKCS System Health State Contract Update
-- Adds richer snapshot fields for historical control-plane audits.
-- =========================================================

ALTER TABLE public.system_health_state
    ADD COLUMN IF NOT EXISTS state_score numeric,
    ADD COLUMN IF NOT EXISTS transition_reason text,
    ADD COLUMN IF NOT EXISTS active_violations jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS active_degradations jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS last_transition timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_system_health_state_last_transition'
    ) THEN
        CREATE INDEX idx_system_health_state_last_transition
            ON public.system_health_state (last_transition DESC NULLS LAST);
    END IF;
END
$$;
