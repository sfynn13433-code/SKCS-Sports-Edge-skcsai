-- SEM-GOV-001D-UI3-I8 — R2 bounded FIP intake evidence (AUTHOR ONLY — NOT APPLIED BY I8 CLOSURE)
-- Parent design: EST-001 R2 intake audit class; I7 buildBoundedEvidenceRecord interface
-- Table name correction: EST-001 reserves fip_intake_events; I8 implements fip_intake_evidence per sealed I7/I8 packet

CREATE TABLE IF NOT EXISTS public.fip_intake_evidence (
    evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intake_id TEXT NOT NULL,
    fip_id TEXT NOT NULL,
    fip_schema_version TEXT NOT NULL,
    fip_validation_hash TEXT NOT NULL,
    scout_fixture_id TEXT NOT NULL,
    fixture_uid UUID NULL,
    scout_run_id TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    validated_at TIMESTAMPTZ NOT NULL,
    outcome TEXT NOT NULL,
    rejection_code TEXT NULL,
    governed_mode TEXT NOT NULL,
    caller_identity_ref TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    purge_eligible_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fip_intake_evidence_outcome_chk
        CHECK (outcome IN ('ACCEPTED', 'REJECTED')),

    CONSTRAINT fip_intake_evidence_required_strings_chk
        CHECK (
            length(trim(intake_id)) > 0
            AND length(trim(fip_id)) > 0
            AND length(trim(fip_schema_version)) > 0
            AND length(trim(fip_validation_hash)) > 0
            AND length(trim(scout_fixture_id)) > 0
            AND length(trim(scout_run_id)) > 0
            AND length(trim(governed_mode)) > 0
            AND length(trim(caller_identity_ref)) > 0
            AND length(trim(idempotency_key)) > 0
        ),

    CONSTRAINT fip_intake_evidence_rejection_code_chk
        CHECK (
            (outcome = 'ACCEPTED' AND rejection_code IS NULL)
            OR (outcome = 'REJECTED' AND rejection_code IS NOT NULL AND length(trim(rejection_code)) > 0)
        ),

    CONSTRAINT fip_intake_evidence_validated_clock_skew_chk
        CHECK (validated_at <= received_at + interval '5 minutes'),

    CONSTRAINT fip_intake_evidence_purge_order_chk
        CHECK (purge_eligible_at >= recorded_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fip_intake_evidence_accepted_idempotency
    ON public.fip_intake_evidence (idempotency_key)
    WHERE outcome = 'ACCEPTED';

CREATE INDEX IF NOT EXISTS idx_fip_intake_evidence_purge
    ON public.fip_intake_evidence (purge_eligible_at);

CREATE INDEX IF NOT EXISTS idx_fip_intake_evidence_received_at
    ON public.fip_intake_evidence (received_at);

ALTER TABLE public.fip_intake_evidence ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- ROLLBACK (NON-EXECUTING — manual only)
-- DROP TABLE IF EXISTS public.fip_intake_evidence;
-- ---------------------------------------------------------------------------
