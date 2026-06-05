-- ============================================================================
-- SKCS SportsDataIO Contract Alignment
-- Adds versioned contract registry, correction ledger, and additive runtime
-- fields for contract-aware execution traces.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- TABLE: public.data_contracts
-- Versioned source-of-truth registry for provider contract snapshots.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_contracts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contract_id text NOT NULL UNIQUE,
    provider text NOT NULL,
    sport text NOT NULL,
    version text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    contract_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    notes text,
    effective_from timestamptz,
    effective_to timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT data_contracts_status_check CHECK (status IN ('active', 'deprecated', 'retired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_contracts_provider_sport_version
    ON public.data_contracts (provider, sport, version);

CREATE INDEX IF NOT EXISTS idx_data_contracts_provider_status
    ON public.data_contracts (provider, status, updated_at DESC);

ALTER TABLE public.data_contracts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'data_contracts'
          AND policyname = 'data_contracts_service_role_all'
    ) THEN
        CREATE POLICY data_contracts_service_role_all
            ON public.data_contracts
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- TABLE: public.correction_log
-- Append-only ledger for post-close corrections and contract-driven rewrites.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.correction_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trace_id uuid,
    pipeline_execution_id bigint,
    contract_id text,
    data_contract_version text NOT NULL,
    provider text NOT NULL,
    sport text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    game_id bigint,
    correction_type text NOT NULL,
    correction_reason text NOT NULL DEFAULT '',
    before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
    after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
    raw_response_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    observed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT correction_log_correction_type_check CHECK (
        correction_type IN ('identity', 'status', 'score', 'membership', 'metadata', 'schema', 'other')
    )
);

CREATE INDEX IF NOT EXISTS idx_correction_log_trace_id
    ON public.correction_log (trace_id);

CREATE INDEX IF NOT EXISTS idx_correction_log_pipeline_execution_id
    ON public.correction_log (pipeline_execution_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_correction_log_contract_id
    ON public.correction_log (contract_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_correction_log_entity
    ON public.correction_log (entity_type, entity_id, observed_at DESC);

ALTER TABLE public.correction_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'correction_log'
          AND policyname = 'correction_log_service_role_all'
    ) THEN
        CREATE POLICY correction_log_service_role_all
            ON public.correction_log
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;

DO $$
BEGIN
    IF to_regclass('public.pipeline_executions') IS NOT NULL THEN
        ALTER TABLE public.pipeline_executions
            ADD COLUMN IF NOT EXISTS data_contract_id text,
            ADD COLUMN IF NOT EXISTS data_contract_version text NOT NULL DEFAULT 'skcs:sportsdataio:soccer:contract:v1.1',
            ADD COLUMN IF NOT EXISTS raw_response_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;
    END IF;
END
$$;

DO $$
BEGIN
    IF to_regclass('public.decision_fingerprints') IS NOT NULL THEN
        ALTER TABLE public.decision_fingerprints
            ADD COLUMN IF NOT EXISTS data_contract_id text,
            ADD COLUMN IF NOT EXISTS data_contract_version text NOT NULL DEFAULT 'skcs:sportsdataio:soccer:contract:v1.1';
    END IF;
END
$$;

DO $$
BEGIN
    IF to_regclass('public.pipeline_executions') IS NOT NULL
       AND to_regclass('public.data_contracts') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'pipeline_executions_data_contract_id_fkey'
       ) THEN
        ALTER TABLE public.pipeline_executions
            ADD CONSTRAINT pipeline_executions_data_contract_id_fkey
            FOREIGN KEY (data_contract_id)
            REFERENCES public.data_contracts(contract_id)
            ON DELETE SET NULL;
    END IF;
END
$$;

DO $$
BEGIN
    IF to_regclass('public.decision_fingerprints') IS NOT NULL
       AND to_regclass('public.data_contracts') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'decision_fingerprints_data_contract_id_fkey'
       ) THEN
        ALTER TABLE public.decision_fingerprints
            ADD CONSTRAINT decision_fingerprints_data_contract_id_fkey
            FOREIGN KEY (data_contract_id)
            REFERENCES public.data_contracts(contract_id)
            ON DELETE SET NULL;
    END IF;
END
$$;

DO $$
BEGIN
    IF to_regclass('public.pipeline_executions') IS NOT NULL
       AND to_regclass('public.correction_log') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'correction_log_pipeline_execution_id_fkey'
       ) THEN
        ALTER TABLE public.correction_log
            ADD CONSTRAINT correction_log_pipeline_execution_id_fkey
            FOREIGN KEY (pipeline_execution_id)
            REFERENCES public.pipeline_executions(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

DO $$
BEGIN
    IF to_regclass('public.data_contracts') IS NOT NULL
       AND to_regclass('public.correction_log') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'correction_log_contract_id_fkey'
       ) THEN
        ALTER TABLE public.correction_log
            ADD CONSTRAINT correction_log_contract_id_fkey
            FOREIGN KEY (contract_id)
            REFERENCES public.data_contracts(contract_id)
            ON DELETE SET NULL;
    END IF;
END
$$;
