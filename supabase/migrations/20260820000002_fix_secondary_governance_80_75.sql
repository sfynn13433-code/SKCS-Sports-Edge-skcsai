-- Fix secondary governance trigger to enforce a 72% secondary floor
-- This aligns the trigger with Master Rulebook v2 requirements

-- Update the governance trigger to keep the safe-haven branch but use a single 72% floor
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
    v_min_primary_secondary_conf CONSTANT NUMERIC := 72; -- Master Rulebook v2: secondary min 72%
    v_min_safe_haven_conf CONSTANT NUMERIC := 72; -- Master Rulebook v2: safe haven min 72%
    v_max_secondary_count CONSTANT INT := 4;
    v_is_safe_haven BOOLEAN;
BEGIN
    IF jsonb_typeof(v_matches) = 'array' AND jsonb_array_length(v_matches) > 0 THEN
        v_fixture_key := COALESCE(
            NULLIF(BTRIM(v_matches->0->>'match_id'), ''),
            NULLIF(BTRIM(v_matches->0->>'fixture_id'), '')
        );
    END IF;

    -- Secondary rows: strict min confidence + strict allowlist + max 4 per fixture
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

            -- Check if this is a safe haven market
            SELECT is_safe_haven INTO v_is_safe_haven
            FROM public.secondary_market_allowlist
            WHERE market_type = 'secondary' AND market_name = v_market_text
            LIMIT 1;

            -- Use appropriate threshold based on safe haven status
            IF COALESCE(v_is_safe_haven, false) THEN
                IF v_conf < v_min_safe_haven_conf THEN
                    RAISE EXCEPTION 'SKCS Secondary Governance: safe haven market "%" confidence % is below required %.', v_market_text, v_conf, v_min_safe_haven_conf;
                END IF;
            ELSE
                IF v_conf < v_min_primary_secondary_conf THEN
                    RAISE EXCEPTION 'SKCS Secondary Governance: primary secondary market "%" confidence % is below required %.', v_market_text, v_conf, v_min_primary_secondary_conf;
                END IF;
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

    -- Direct rows: enforce pivot payload requirements on updated bands
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

        -- High risk (30-54%): must attach secondary insights
        IF v_row_conf BETWEEN 30 AND 54 THEN
            IF jsonb_typeof(v_secondary) <> 'array' OR jsonb_array_length(v_secondary) = 0 THEN
                RAISE EXCEPTION 'SKCS Direct Governance: high-risk direct market (%) must attach secondary insights.', v_row_conf;
            END IF;
        END IF;

        -- Extreme risk (0-29%): require exactly 4 secondary insights
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

                -- Check if this is a safe haven market
                SELECT is_safe_haven INTO v_is_safe_haven
                FROM public.secondary_market_allowlist
                WHERE market_type = 'secondary' AND market_name = v_market_text
                LIMIT 1;

                -- Use appropriate threshold based on safe haven status
                IF COALESCE(v_is_safe_haven, false) THEN
                    IF v_conf < v_min_safe_haven_conf THEN
                        RAISE EXCEPTION 'SKCS Secondary Governance: attached safe haven secondary confidence % is below required %.',
                            v_conf, v_min_safe_haven_conf;
                    END IF;
                ELSE
                    IF v_conf < v_min_primary_secondary_conf THEN
                        RAISE EXCEPTION 'SKCS Secondary Governance: attached primary secondary confidence % is below required %.',
                            v_conf, v_min_primary_secondary_conf;
                    END IF;
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
