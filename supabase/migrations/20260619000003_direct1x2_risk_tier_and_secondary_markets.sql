DO $$
BEGIN
    IF to_regclass('public.direct1x2_prediction_final') IS NULL
       AND to_regclass('public.predictions_final') IS NOT NULL THEN
        ALTER TABLE public.predictions_final RENAME TO direct1x2_prediction_final;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'risk_tier_enum'
          AND typnamespace = 'public'::regnamespace
    ) THEN
        CREATE TYPE public.risk_tier_enum AS ENUM (
            'HIGH_CONFIDENCE',
            'MODERATE_RISK',
            'HIGH_RISK',
            'EXTREME_RISK'
        );
    END IF;
END
$$;

DO $$
BEGIN
    IF to_regclass('public.direct1x2_prediction_final') IS NOT NULL THEN
        ALTER TABLE public.direct1x2_prediction_final
            ADD COLUMN IF NOT EXISTS fixture_id TEXT,
            ADD COLUMN IF NOT EXISTS home_team TEXT,
            ADD COLUMN IF NOT EXISTS away_team TEXT,
            ADD COLUMN IF NOT EXISTS prediction TEXT,
            ADD COLUMN IF NOT EXISTS confidence NUMERIC,
            ADD COLUMN IF NOT EXISTS match_date TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS risk_tier public.risk_tier_enum,
            ADD COLUMN IF NOT EXISTS secondary_markets JSONB NOT NULL DEFAULT '[]'::JSONB,
            ADD COLUMN IF NOT EXISTS edgemind_report TEXT;
    END IF;
END
$$;

DO $$
BEGIN
    IF to_regclass('public.direct1x2_prediction_final') IS NOT NULL THEN
        UPDATE public.direct1x2_prediction_final
        SET confidence = total_confidence
        WHERE confidence IS NULL
          AND total_confidence IS NOT NULL;

        UPDATE public.direct1x2_prediction_final
        SET risk_tier = CASE
            WHEN confidence >= 80 THEN 'HIGH_CONFIDENCE'::public.risk_tier_enum
            WHEN confidence >= 70 THEN 'MODERATE_RISK'::public.risk_tier_enum
            WHEN confidence >= 59 THEN 'HIGH_RISK'::public.risk_tier_enum
            ELSE 'EXTREME_RISK'::public.risk_tier_enum
        END
        WHERE risk_tier IS NULL
          AND confidence IS NOT NULL;
    END IF;
END
$$;

DO $$
BEGIN
    IF to_regclass('public.direct1x2_prediction_final') IS NOT NULL
       AND NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'confidence_range'
              AND conrelid = 'public.direct1x2_prediction_final'::regclass
       ) THEN
        ALTER TABLE public.direct1x2_prediction_final
            ADD CONSTRAINT confidence_range
            CHECK (confidence BETWEEN 0 AND 100);
    END IF;
END
$$;

DO $$
BEGIN
    IF to_regclass('public.direct1x2_prediction_final') IS NOT NULL
       AND NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'secondary_markets_length'
              AND conrelid = 'public.direct1x2_prediction_final'::regclass
       ) THEN
        ALTER TABLE public.direct1x2_prediction_final
            ADD CONSTRAINT secondary_markets_length
            CHECK (jsonb_array_length(secondary_markets) <= 4);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_direct1x2_match_date
    ON public.direct1x2_prediction_final (match_date);

CREATE INDEX IF NOT EXISTS idx_direct1x2_risk_tier
    ON public.direct1x2_prediction_final (risk_tier);
