-- Phase 1: Rename risk_tier_enum values and add Safe Haven fallback rule
-- Renames HIGH_CONFIDENCE -> LOW_RISK, MODERATE_RISK -> MEDIUM_RISK
-- Adds Safe Haven fallback allowing specific secondary markets at 75% confidence
-- Updates primary market min_confidence to 80

-- 1) Rename enum values
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'risk_tier_enum' AND typnamespace = 'public'::regnamespace
    ) THEN
        ALTER TYPE public.risk_tier_enum RENAME VALUE 'HIGH_CONFIDENCE' TO 'LOW_RISK';
        ALTER TYPE public.risk_tier_enum RENAME VALUE 'MODERATE_RISK' TO 'MEDIUM_RISK';
    END IF;
END
$$;

-- 2) Update secondary_market_allowlist: primary markets min_confidence = 80
DO $$
BEGIN
    IF to_regclass('public.secondary_market_allowlist') IS NOT NULL THEN
        UPDATE public.secondary_market_allowlist
        SET min_confidence = 80
        WHERE market_type = 'primary';
    END IF;
END
$$;

-- 3) Add Safe Haven fallback rule: allow specific secondary markets at 75% confidence
DO $$
BEGIN
    IF to_regclass('public.secondary_market_allowlist') IS NOT NULL THEN
        INSERT INTO public.secondary_market_allowlist (market_type, market_name, min_confidence, is_safe_haven)
        VALUES
            ('secondary', 'double_chance_1x', 75, true),
            ('secondary', 'double_chance_x2', 75, true),
            ('secondary', 'double_chance_12', 75, true),
            ('secondary', 'draw_no_bet_home', 75, true),
            ('secondary', 'draw_no_bet_away', 75, true),
            ('secondary', 'over_1_5', 75, true),
            ('secondary', 'under_4_5', 75, true),
            ('secondary', 'under_3_5', 75, true)
        ON CONFLICT (market_type, market_name) DO UPDATE
        SET min_confidence = 75, is_safe_haven = true;
    END IF;
END
$$;

-- 4) Reclassify existing predictions with new enum values
DO $$
BEGIN
    IF to_regclass('public.direct1x2_prediction_final') IS NOT NULL THEN
        UPDATE public.direct1x2_prediction_final
        SET risk_tier = CASE
            WHEN confidence >= 75 THEN 'LOW_RISK'::public.risk_tier_enum
            WHEN confidence >= 55 THEN 'MEDIUM_RISK'::public.risk_tier_enum
            WHEN confidence >= 30 THEN 'HIGH_RISK'::public.risk_tier_enum
            ELSE 'EXTREME_RISK'::public.risk_tier_enum
        END
        WHERE confidence IS NOT NULL
          AND risk_tier IS DISTINCT FROM CASE
            WHEN confidence >= 75 THEN 'LOW_RISK'::public.risk_tier_enum
            WHEN confidence >= 55 THEN 'MEDIUM_RISK'::public.risk_tier_enum
            WHEN confidence >= 30 THEN 'HIGH_RISK'::public.risk_tier_enum
            ELSE 'EXTREME_RISK'::public.risk_tier_enum
          END;
    END IF;
END
$$;

-- 5) Update the governance trigger to use new enum values
CREATE OR REPLACE FUNCTION public.trg_enforce_secondary_market_governance()
RETURNS TRIGGER AS $$
DECLARE
    v_row JSONB := to_jsonb(NEW);
    v_type TEXT := LOWER(
        COALESCE(
            NULLIF(BTRIM(v_row->>'section_type'), ''),
            NULLIF(BTRIM(v_row->>'type'), ''),
            ''
        )
    );
    v_matches JSONB := COALESCE(v_row->'matches', '[]'::JSONB);
    v_secondary JSONB := COALESCE(v_row->'secondary_insights', '[]'::JSONB);
    v_fixture_key TEXT;
    v_row_conf NUMERIC;
    v_leg JSONB;
    v_item JSONB;
    v_market_text TEXT;
    v_conf NUMERIC;
    v_existing_secondary_count INT := 0;
    v_min_secondary_conf CONSTANT NUMERIC := 75;
    v_max_secondary_count CONSTANT INT := 4;
BEGIN
    IF jsonb_typeof(v_matches) = 'array' AND jsonb_array_length(v_matches) > 0 THEN
        v_fixture_key := COALESCE(
            NULLIF(BTRIM(v_matches->0->>'match_id'), ''),
            NULLIF(BTRIM(v_matches->0->>'fixture_id'), '')
        );
    END IF;

    IF v_type = 'secondary' THEN
        IF jsonb_typeof(v_matches) <> 'array' OR jsonb_array_length(v_matches) = 0 THEN
            RAISE EXCEPTION 'SKCS Secondary Governance: secondary row must include matches payload.';
        END IF;

        FOR v_leg IN SELECT value FROM jsonb_array_elements(v_matches)
        LOOP
            v_market_text := LOWER(
                COALESCE(
                    NULLIF(BTRIM(v_leg->>'market'), ''),
                    NULLIF(BTRIM(v_leg->'metadata'->>'market'), ''),
                    NULLIF(BTRIM(v_leg->'metadata'->>'market_type'), ''),
                    NULLIF(BTRIM(v_leg->>'prediction'), ''),
                    ''
                )
            );

            v_conf := COALESCE(
                public.skcs_to_numeric_safe(v_leg->>'confidence', NULL),
                public.skcs_to_numeric_safe(v_row->>'total_confidence', NULL),
                public.skcs_to_numeric_safe(v_row->>'confidence', NULL),
                0
            );

            IF v_conf < v_min_secondary_conf THEN
                RAISE EXCEPTION 'SKCS Secondary Governance: market confidence % is below required %.', v_conf, v_min_secondary_conf;
            END IF;

            IF NOT public.skcs_is_secondary_market_allowed(v_market_text) THEN
                RAISE EXCEPTION 'SKCS Secondary Governance: market "%" is not in secondary allowlist.', v_market_text;
            END IF;
        END LOOP;

        IF v_fixture_key IS NOT NULL THEN
            SELECT COUNT(*)
            INTO v_existing_secondary_count
            FROM public.predictions_final pf
            WHERE LOWER(
                COALESCE(
                    NULLIF(BTRIM(to_jsonb(pf)->>'section_type'), ''),
                    NULLIF(BTRIM(to_jsonb(pf)->>'type'), ''),
                    ''
                )
            ) = 'secondary'
              AND COALESCE(
                    NULLIF(BTRIM(to_jsonb(pf)->'matches'->0->>'match_id'), ''),
                    NULLIF(BTRIM(to_jsonb(pf)->'matches'->0->>'fixture_id'), '')
                  ) = v_fixture_key
              AND (
                    TG_OP <> 'UPDATE'
                    OR COALESCE(to_jsonb(pf)->>'id', '') <> COALESCE(v_row->>'id', '')
                  );

            IF v_existing_secondary_count >= v_max_secondary_count THEN
                RAISE EXCEPTION 'SKCS Secondary Governance: fixture % already has % secondary markets (max %).',
                    v_fixture_key, v_existing_secondary_count, v_max_secondary_count;
            END IF;
        END IF;
    END IF;

    IF v_type IN ('direct', 'single') THEN
        v_row_conf := COALESCE(
            public.skcs_to_numeric_safe(v_row->>'total_confidence', NULL),
            public.skcs_to_numeric_safe(v_row->>'confidence', NULL),
            CASE
                WHEN jsonb_typeof(v_matches) = 'array' AND jsonb_array_length(v_matches) > 0
                THEN public.skcs_to_numeric_safe(v_matches->0->>'confidence', 0)
                ELSE 0
            END
        );

        IF v_row_conf BETWEEN 30 AND 54 THEN
            IF jsonb_typeof(v_secondary) <> 'array' OR jsonb_array_length(v_secondary) = 0 THEN
                RAISE EXCEPTION 'SKCS Direct Governance: high-risk direct market (%) must attach secondary insights.', v_row_conf;
            END IF;
        END IF;

        IF v_row_conf BETWEEN 0 AND 29 THEN
            IF jsonb_typeof(v_secondary) <> 'array' OR jsonb_array_length(v_secondary) <> v_max_secondary_count THEN
                RAISE EXCEPTION 'SKCS Direct Governance: extreme-risk direct market (%) requires exactly % secondary markets.',
                    v_row_conf, v_max_secondary_count;
            END IF;
        END IF;

        IF jsonb_typeof(v_secondary) = 'array' THEN
            IF jsonb_array_length(v_secondary) > v_max_secondary_count THEN
                RAISE EXCEPTION 'SKCS Secondary Governance: secondary_insights exceeds max size of %.', v_max_secondary_count;
            END IF;

            FOR v_item IN SELECT value FROM jsonb_array_elements(v_secondary)
            LOOP
                v_market_text := LOWER(
                    COALESCE(
                        NULLIF(BTRIM(v_item->>'market'), ''),
                        NULLIF(BTRIM(v_item->>'label'), ''),
                        NULLIF(BTRIM(v_item->>'type'), ''),
                        NULLIF(BTRIM(v_item->>'prediction'), ''),
                        ''
                    )
                );
                v_conf := COALESCE(public.skcs_to_numeric_safe(v_item->>'confidence', NULL), 0);

                IF v_conf < v_min_secondary_conf THEN
                    RAISE EXCEPTION 'SKCS Secondary Governance: attached secondary confidence % is below required %.',
                        v_conf, v_min_secondary_conf;
                END IF;

                IF NOT public.skcs_is_secondary_market_allowed(v_market_text) THEN
                    RAISE EXCEPTION 'SKCS Secondary Governance: attached secondary "%" is not in allowlist.', v_market_text;
                END IF;
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
