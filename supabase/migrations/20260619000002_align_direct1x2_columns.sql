DO $$
BEGIN
    IF to_regclass('public.direct1x2_prediction_final') IS NOT NULL THEN
        ALTER TABLE public.direct1x2_prediction_final
            ADD COLUMN IF NOT EXISTS plan_visibility JSONB NOT NULL DEFAULT '[]'::JSONB,
            ADD COLUMN IF NOT EXISTS sport TEXT,
            ADD COLUMN IF NOT EXISTS market_type TEXT,
            ADD COLUMN IF NOT EXISTS recommendation TEXT,
            ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS edgemind_report TEXT,
            ADD COLUMN IF NOT EXISTS secondary_insights JSONB NOT NULL DEFAULT '[]'::JSONB;

        UPDATE public.direct1x2_prediction_final
        SET secondary_insights = '[]'::JSONB
        WHERE secondary_insights IS NULL;
    END IF;
END
$$;
