DO $$
BEGIN
    IF to_regclass('public.direct1x2_prediction_final') IS NULL
       AND to_regclass('public.predictions_final') IS NOT NULL THEN
        ALTER TABLE public.predictions_final RENAME TO direct1x2_prediction_final;
    END IF;
END
$$;

DO $$
DECLARE
    v_relkind "char";
BEGIN
    SELECT c.relkind
    INTO v_relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'predictions_final'
    LIMIT 1;

    IF v_relkind = 'v' THEN
        DROP VIEW public.predictions_final;
        v_relkind := NULL;
    END IF;

    IF v_relkind IS NULL
       AND to_regclass('public.direct1x2_prediction_final') IS NOT NULL THEN
        CREATE VIEW public.predictions_final AS
        SELECT *
        FROM public.direct1x2_prediction_final;
    END IF;
END
$$;

DO $$
BEGIN
    IF to_regclass('public.direct1x2_prediction_final') IS NOT NULL THEN
        ALTER TABLE public.direct1x2_prediction_final
            DROP CONSTRAINT IF EXISTS predictions_final_risk_level_check;

        ALTER TABLE public.direct1x2_prediction_final
            ADD CONSTRAINT predictions_final_risk_level_check
            CHECK (
                risk_level = ANY (
                    ARRAY[
                        'safe'::text,
                        'good'::text,
                        'fair'::text,
                        'unsafe'::text,
                        'medium'::text,
                        'low'::text
                    ]
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF to_regclass('public.direct1x2_prediction_final') IS NOT NULL
       AND to_regprocedure('public.trg_enforce_secondary_market_governance()') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS enforce_secondary_market_governance ON public.direct1x2_prediction_final;
        CREATE TRIGGER enforce_secondary_market_governance
        BEFORE INSERT OR UPDATE ON public.direct1x2_prediction_final
        FOR EACH ROW
        EXECUTE FUNCTION public.trg_enforce_secondary_market_governance();
    END IF;
END
$$;
