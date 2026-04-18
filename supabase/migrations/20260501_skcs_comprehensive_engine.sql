-- ============================================================================
-- SKCS Comprehensive Engine
-- - Taxonomy/ontology normalization
-- - Weekly anti-correlation lock
-- - Plan and allocation matrix
-- - SAST pro-rata wallet logic
-- - Atomic wallet consumption and market counts RPCs
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1) TAXONOMY & ONTOLOGY
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'skcs_insight_format'
    ) THEN
        CREATE TYPE skcs_insight_format AS ENUM (
            'Direct',
            'Analytical',
            'Multi',
            'Same Match',
            'ACCA',
            'Mega ACCA'
        );
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS canonical_betting_markets (
    market_id BIGSERIAL PRIMARY KEY,
    provider_market_key VARCHAR(50) UNIQUE NOT NULL,
    skcs_display_name VARCHAR(100) NOT NULL,
    assigned_format skcs_insight_format NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO canonical_betting_markets (provider_market_key, skcs_display_name, assigned_format)
VALUES
    ('1x2', 'Direct Market (1X2)', 'Direct'),
    ('double_chance', 'Double Chance', 'Multi'),
    ('over_under_goals', 'Over/Under Goals', 'Multi'),
    ('btts', 'Both Teams To Score', 'Multi'),
    ('corners_ou', 'Corners O/U', 'Analytical'),
    ('yellow_cards_ou', 'Cards O/U', 'Analytical')
ON CONFLICT (provider_market_key) DO UPDATE
SET
    skcs_display_name = EXCLUDED.skcs_display_name,
    assigned_format = EXCLUDED.assigned_format,
    is_active = TRUE;

-- ============================================================================
-- 2) WEEKLY FIXTURE LOCK (ANTI-CORRELATION POLICY)
-- ============================================================================

CREATE TABLE IF NOT EXISTS fixture_weekly_publication_log (
    publication_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixture_id UUID NOT NULL,
    assigned_format skcs_insight_format NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    iso_year INT NOT NULL,
    iso_week INT NOT NULL,
    published_by UUID REFERENCES auth.users(id)
);

CREATE OR REPLACE FUNCTION trg_set_fixture_week_bucket()
RETURNS TRIGGER AS $$
DECLARE
    v_local_ts TIMESTAMP;
BEGIN
    v_local_ts := (NEW.published_at AT TIME ZONE 'Africa/Johannesburg');
    NEW.iso_year := EXTRACT(ISOYEAR FROM v_local_ts)::INT;
    NEW.iso_week := EXTRACT(WEEK FROM v_local_ts)::INT;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_fixture_week_bucket ON fixture_weekly_publication_log;
CREATE TRIGGER trg_set_fixture_week_bucket
BEFORE INSERT OR UPDATE ON fixture_weekly_publication_log
FOR EACH ROW
EXECUTE FUNCTION trg_set_fixture_week_bucket();

CREATE UNIQUE INDEX IF NOT EXISTS idx_fixture_weekly_lock
ON fixture_weekly_publication_log (fixture_id, iso_year, iso_week);

CREATE OR REPLACE FUNCTION trg_enforce_weekly_fixture_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_fixture_id UUID;
    v_assigned_format skcs_insight_format;
    v_iso_week INT;
BEGIN
    v_fixture_id := NULLIF(BTRIM((to_jsonb(NEW)->>'fixture_id')), '')::UUID;
    v_assigned_format := NULLIF(BTRIM((to_jsonb(NEW)->>'assigned_format')), '')::skcs_insight_format;
    v_iso_week := EXTRACT(WEEK FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Johannesburg'))::INT;

    IF v_fixture_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF v_assigned_format IS NULL THEN
        v_assigned_format := 'Direct'::skcs_insight_format;
    END IF;

    BEGIN
        INSERT INTO fixture_weekly_publication_log (
            fixture_id,
            assigned_format,
            published_at,
            published_by
        )
        VALUES (
            v_fixture_id,
            v_assigned_format,
            CURRENT_TIMESTAMP,
            auth.uid()
        );
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION
                'SKCS Policy Violation: Fixture ID % is already locked for ISO Week %.',
                v_fixture_id,
                v_iso_week;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF to_regclass('public.insights') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'insights'
             AND column_name = 'fixture_id'
       )
       AND EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'insights'
             AND column_name = 'assigned_format'
       ) THEN
        DROP TRIGGER IF EXISTS enforce_anti_correlation_lock ON public.insights;
        CREATE TRIGGER enforce_anti_correlation_lock
        BEFORE INSERT ON public.insights
        FOR EACH ROW
        EXECUTE FUNCTION trg_enforce_weekly_fixture_lock();
    END IF;
END
$$;

-- ============================================================================
-- 3) 8 TIERS & DYNAMIC MATRIX
-- ============================================================================

CREATE TABLE IF NOT EXISTS skcs_subscription_plans (
    plan_id INT PRIMARY KEY,
    plan_name VARCHAR(50) UNIQUE NOT NULL,
    is_elite BOOLEAN NOT NULL DEFAULT FALSE,
    duration_days INT NOT NULL,
    price_gbp NUMERIC(10,2) NOT NULL
);

INSERT INTO skcs_subscription_plans (plan_id, plan_name, is_elite, duration_days, price_gbp)
VALUES
    (1, '4-Day Sprint', FALSE, 4, 3.99),
    (2, '9-Day Run', FALSE, 9, 7.99),
    (3, '14-Day Pro', FALSE, 14, 11.99),
    (4, '30-Day Limitless', FALSE, 30, 34.99),
    (5, '4-Day Deep Dive', TRUE, 4, 7.99),
    (6, '9-Day Deep Strike', TRUE, 9, 11.99),
    (7, '14-Day Deep Pro', TRUE, 14, 15.99),
    (8, '30-Day Deep VIP', TRUE, 30, 59.99)
ON CONFLICT (plan_id) DO UPDATE
SET
    plan_name = EXCLUDED.plan_name,
    is_elite = EXCLUDED.is_elite,
    duration_days = EXCLUDED.duration_days,
    price_gbp = EXCLUDED.price_gbp;

CREATE TABLE IF NOT EXISTS skcs_allocation_matrix (
    matrix_id BIGSERIAL PRIMARY KEY,
    plan_id INT NOT NULL REFERENCES skcs_subscription_plans(plan_id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    day_focus_label VARCHAR(100) NOT NULL,
    direct_quota INT NOT NULL,
    analytical_quota INT NOT NULL,
    multi_quota INT NOT NULL,
    same_match_quota INT NOT NULL,
    mega_acca_quota INT NOT NULL,
    edgemind_quota INT NOT NULL,
    CONSTRAINT unique_plan_day UNIQUE (plan_id, day_of_week)
);

INSERT INTO skcs_allocation_matrix (
    plan_id,
    day_of_week,
    day_focus_label,
    direct_quota,
    analytical_quota,
    multi_quota,
    same_match_quota,
    mega_acca_quota,
    edgemind_quota
)
VALUES
    -- Core Sprint (EdgeMind 30)
    (1, 1, 'Mon', 6, 4, 2, 2, 1, 30), (1, 2, 'Tue', 6, 4, 2, 2, 1, 30),
    (1, 3, 'Wed', 8, 5, 3, 2, 1, 30), (1, 4, 'Thu', 8, 5, 3, 2, 1, 30),
    (1, 5, 'Fri', 10, 6, 3, 3, 2, 30), (1, 6, 'Sat', 15, 8, 5, 5, 3, 30),
    (1, 7, 'Sun', 12, 7, 4, 4, 2, 30),

    -- Core Run (EdgeMind 60)
    (2, 1, 'Mon', 8, 5, 3, 3, 1, 60), (2, 2, 'Tue', 8, 5, 3, 3, 1, 60),
    (2, 3, 'Wed', 10, 6, 4, 3, 2, 60), (2, 4, 'Thu', 10, 6, 4, 3, 2, 60),
    (2, 5, 'Fri', 12, 8, 4, 4, 2, 60), (2, 6, 'Sat', 18, 10, 6, 6, 4, 60),
    (2, 7, 'Sun', 14, 9, 5, 5, 3, 60),

    -- Core Pro (EdgeMind 120)
    (3, 1, 'Mon', 9, 6, 4, 4, 2, 120), (3, 2, 'Tue', 9, 6, 4, 4, 2, 120),
    (3, 3, 'Wed', 12, 8, 5, 4, 2, 120), (3, 4, 'Thu', 12, 8, 5, 4, 2, 120),
    (3, 5, 'Fri', 15, 10, 5, 5, 3, 120), (3, 6, 'Sat', 22, 12, 8, 8, 5, 120),
    (3, 7, 'Sun', 18, 11, 6, 6, 3, 120),

    -- Core Limitless (EdgeMind 200)
    (4, 1, 'Mon', 10, 8, 5, 5, 3, 200), (4, 2, 'Tue', 10, 8, 5, 5, 3, 200),
    (4, 3, 'Wed', 15, 10, 7, 6, 4, 200), (4, 4, 'Thu', 15, 10, 7, 6, 4, 200),
    (4, 5, 'Fri', 20, 12, 8, 8, 5, 200), (4, 6, 'Sat', 30, 15, 10, 10, 8, 200),
    (4, 7, 'Sun', 25, 14, 9, 9, 6, 200),

    -- Elite Dive (EdgeMind 30)
    (5, 1, 'Mon', 8, 5, 3, 3, 1, 30), (5, 2, 'Tue', 8, 5, 3, 3, 1, 30),
    (5, 3, 'Wed', 10, 7, 4, 3, 2, 30), (5, 4, 'Thu', 10, 7, 4, 3, 2, 30),
    (5, 5, 'Fri', 14, 8, 5, 5, 3, 30), (5, 6, 'Sat', 20, 12, 8, 8, 5, 30),
    (5, 7, 'Sun', 16, 10, 6, 6, 4, 30),

    -- Elite Strike (EdgeMind 60)
    (6, 1, 'Mon', 10, 7, 4, 4, 2, 60), (6, 2, 'Tue', 10, 7, 4, 4, 2, 60),
    (6, 3, 'Wed', 14, 9, 6, 5, 3, 60), (6, 4, 'Thu', 14, 9, 6, 5, 3, 60),
    (6, 5, 'Fri', 18, 11, 7, 7, 4, 60), (6, 6, 'Sat', 28, 15, 10, 10, 7, 60),
    (6, 7, 'Sun', 22, 13, 8, 8, 5, 60),

    -- Elite Pro (EdgeMind 120)
    (7, 1, 'Mon', 12, 9, 6, 6, 3, 120), (7, 2, 'Tue', 12, 9, 6, 6, 3, 120),
    (7, 3, 'Wed', 18, 12, 8, 7, 4, 120), (7, 4, 'Thu', 18, 12, 8, 7, 4, 120),
    (7, 5, 'Fri', 22, 15, 10, 10, 6, 120), (7, 6, 'Sat', 35, 20, 14, 14, 10, 120),
    (7, 7, 'Sun', 28, 18, 12, 12, 8, 120),

    -- Elite VIP (EdgeMind 200)
    (8, 1, 'Mon', 15, 12, 8, 8, 5, 200), (8, 2, 'Tue', 15, 12, 8, 8, 5, 200),
    (8, 3, 'Wed', 22, 15, 10, 10, 7, 200), (8, 4, 'Thu', 22, 15, 10, 10, 7, 200),
    (8, 5, 'Fri', 30, 18, 12, 12, 10, 200), (8, 6, 'Sat', 45, 25, 18, 18, 15, 200),
    (8, 7, 'Sun', 35, 22, 15, 15, 12, 200)
ON CONFLICT (plan_id, day_of_week) DO UPDATE
SET
    day_focus_label = EXCLUDED.day_focus_label,
    direct_quota = EXCLUDED.direct_quota,
    analytical_quota = EXCLUDED.analytical_quota,
    multi_quota = EXCLUDED.multi_quota,
    same_match_quota = EXCLUDED.same_match_quota,
    mega_acca_quota = EXCLUDED.mega_acca_quota,
    edgemind_quota = EXCLUDED.edgemind_quota;

-- ============================================================================
-- 4) 11:59 AM SAST PRO-RATA LOGIC + DAILY WALLETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS skcs_daily_wallets (
    wallet_id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    direct_balance INT NOT NULL DEFAULT 0,
    analytical_balance INT NOT NULL DEFAULT 0,
    multi_balance INT NOT NULL DEFAULT 0,
    same_match_balance INT NOT NULL DEFAULT 0,
    edgemind_balance INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_daily_wallet UNIQUE (user_id, target_date)
);

CREATE OR REPLACE FUNCTION trg_touch_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_wallet_updated_at ON skcs_daily_wallets;
CREATE TRIGGER trg_touch_wallet_updated_at
BEFORE UPDATE ON skcs_daily_wallets
FOR EACH ROW
EXECUTE FUNCTION trg_touch_wallet_updated_at();

CREATE OR REPLACE FUNCTION process_subscription_purchase(p_user_id UUID, p_plan_id INT)
RETURNS JSONB AS $$
DECLARE
    v_now_sast TIMESTAMP := CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Johannesburg';
    v_sast_hour INT := EXTRACT(HOUR FROM v_now_sast);
    v_cycle_start TIMESTAMPTZ;
    v_pro_rata BOOLEAN := FALSE;
    v_dow INT := EXTRACT(ISODOW FROM v_now_sast);
    v_matrix RECORD;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM skcs_subscription_plans WHERE plan_id = p_plan_id) THEN
        RAISE EXCEPTION 'Unknown plan_id: %', p_plan_id;
    END IF;

    IF v_sast_hour >= 12 THEN
        v_pro_rata := TRUE;
        v_cycle_start := (DATE_TRUNC('day', v_now_sast) + INTERVAL '1 day') AT TIME ZONE 'Africa/Johannesburg';

        SELECT *
        INTO v_matrix
        FROM skcs_allocation_matrix
        WHERE plan_id = p_plan_id
          AND day_of_week = v_dow;

        IF FOUND THEN
            INSERT INTO skcs_daily_wallets (user_id, target_date, direct_balance)
            VALUES (p_user_id, v_now_sast::DATE, FLOOR(v_matrix.direct_quota * 0.5)::INT)
            ON CONFLICT (user_id, target_date)
            DO UPDATE SET
                direct_balance = skcs_daily_wallets.direct_balance + EXCLUDED.direct_balance,
                updated_at = NOW();
        END IF;
    ELSE
        v_cycle_start := DATE_TRUNC('day', v_now_sast) AT TIME ZONE 'Africa/Johannesburg';
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'pro_rata_applied', v_pro_rata,
        'official_start', v_cycle_start
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Supporting RPCs used by server actions / API layer
-- ============================================================================

CREATE OR REPLACE FUNCTION normalize_provider_market_key(p_market TEXT)
RETURNS TEXT AS $$
DECLARE
    v_market TEXT := LOWER(COALESCE(TRIM(p_market), ''));
BEGIN
    IF v_market = '' THEN
        RETURN '';
    END IF;

    IF v_market IN ('1x2', 'match_result', 'full_time_result', 'matchwinner', 'result') THEN
        RETURN '1x2';
    END IF;
    IF v_market LIKE 'double_chance%' OR v_market IN ('1x', 'x2', '12') THEN
        RETURN 'double_chance';
    END IF;
    IF v_market LIKE 'btts%' OR v_market = 'both_teams_to_score' THEN
        RETURN 'btts';
    END IF;
    IF v_market LIKE 'corners_%' THEN
        RETURN 'corners_ou';
    END IF;
    IF v_market LIKE '%yellow%' OR v_market LIKE '%cards%' THEN
        RETURN 'yellow_cards_ou';
    END IF;
    IF v_market LIKE 'over_%' OR v_market LIKE 'under_%' OR v_market = 'over_under' OR v_market = 'over_under_goals' THEN
        RETURN 'over_under_goals';
    END IF;

    RETURN v_market;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_available_market_counts(
    p_user_id UUID,
    p_format skcs_insight_format DEFAULT 'Direct'
)
RETURNS TABLE (
    sport TEXT,
    available_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH source_rows AS (
        SELECT
            LOWER(
                COALESCE(
                    NULLIF(TRIM((pf.matches->0->>'sport')), ''),
                    NULLIF(TRIM((pf.matches->0->'metadata'->>'sport')), ''),
                    'unknown'
                )
            ) AS sport_key,
            normalize_provider_market_key(
                COALESCE(
                    NULLIF(TRIM((pf.matches->0->>'market')), ''),
                    NULLIF(TRIM((pf.matches->0->'metadata'->>'market')), ''),
                    NULLIF(TRIM((pf.matches->0->'metadata'->>'market_type')), '')
                )
            ) AS market_key
        FROM predictions_final pf
        WHERE jsonb_typeof(pf.matches) = 'array'
          AND jsonb_array_length(pf.matches) > 0
    )
    SELECT
        INITCAP(sr.sport_key) AS sport,
        COUNT(*)::BIGINT AS available_count
    FROM source_rows sr
    JOIN canonical_betting_markets cbm
      ON cbm.provider_market_key = sr.market_key
     AND cbm.is_active = TRUE
    WHERE
        (
            p_format = 'Direct'
            AND cbm.assigned_format IN ('Direct', 'Multi')
        )
        OR
        (
            p_format <> 'Direct'
            AND cbm.assigned_format = p_format
        )
    GROUP BY sr.sport_key
    ORDER BY sr.sport_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION consume_wallet_quota(
    p_user_id UUID,
    p_category TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_target_date DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Johannesburg')::DATE;
    v_category TEXT := LOWER(COALESCE(TRIM(p_category), ''));
    v_column TEXT;
    v_new_balance INT;
BEGIN
    v_column := CASE v_category
        WHEN 'direct' THEN 'direct_balance'
        WHEN 'analytical' THEN 'analytical_balance'
        WHEN 'multi' THEN 'multi_balance'
        WHEN 'same_match' THEN 'same_match_balance'
        WHEN 'edgemind' THEN 'edgemind_balance'
        ELSE NULL
    END;

    IF v_column IS NULL THEN
        RAISE EXCEPTION 'Unsupported category: %', p_category;
    END IF;

    EXECUTE format(
        'UPDATE skcs_daily_wallets
         SET %1$I = %1$I - 1,
             updated_at = NOW()
         WHERE user_id = $1
           AND target_date = $2
           AND %1$I > 0
         RETURNING %1$I',
        v_column
    )
    INTO v_new_balance
    USING p_user_id, v_target_date;

    RETURN v_new_balance IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DB-Level Secondary Market Governance Enforcement
-- - Allowlist at schema level
-- - Minimum confidence >= 76 for all secondary market payloads
-- - Max 4 secondary markets per fixture
-- - Direct market pivot enforcement for 59-69 and 0-58 bands
-- ============================================================================

CREATE TABLE IF NOT EXISTS skcs_secondary_market_allowlist (
    allow_phrase TEXT PRIMARY KEY,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO skcs_secondary_market_allowlist (allow_phrase, is_active)
VALUES
    ('double chance 1x', TRUE),
    ('double chance x2', TRUE),
    ('double chance 12', TRUE),
    ('dc 1x', TRUE),
    ('dc x2', TRUE),
    ('dc 12', TRUE),
    ('1x', TRUE),
    ('x2', TRUE),
    ('12', TRUE),
    ('draw no bet home', TRUE),
    ('draw no bet away', TRUE),
    ('dnb home', TRUE),
    ('dnb away', TRUE),
    ('home dnb', TRUE),
    ('away dnb', TRUE),
    ('over 0.5 goals', TRUE),
    ('over 1.5 goals', TRUE),
    ('over 2.5 goals', TRUE),
    ('over 3.5 goals', TRUE),
    ('under 2.5 goals', TRUE),
    ('under 3.5 goals', TRUE),
    ('o 0.5', TRUE),
    ('o 1.5', TRUE),
    ('o 2.5', TRUE),
    ('o 3.5', TRUE),
    ('u 2.5', TRUE),
    ('u 3.5', TRUE),
    ('home over 0.5', TRUE),
    ('home over 1.5', TRUE),
    ('away over 0.5', TRUE),
    ('away over 1.5', TRUE),
    ('home o 0.5', TRUE),
    ('home o 1.5', TRUE),
    ('away o 0.5', TRUE),
    ('away o 1.5', TRUE),
    ('home team over 0.5', TRUE),
    ('away team over 0.5', TRUE),
    ('btts yes', TRUE),
    ('btts no', TRUE),
    ('both teams to score yes', TRUE),
    ('both teams to score no', TRUE),
    ('btts & over 2.5', TRUE),
    ('btts & under 3.5', TRUE),
    ('btts + o2.5', TRUE),
    ('btts + u3.5', TRUE),
    ('win & btts yes', TRUE),
    ('win & btts no', TRUE),
    ('under 4.5 goals', TRUE),
    ('double chance + under 3.5', TRUE),
    ('double chance + over 1.5', TRUE),
    ('dc + u3.5', TRUE),
    ('dc + o1.5', TRUE),
    ('over 0.5 first half', TRUE),
    ('under 1.5 first half', TRUE),
    ('first half draw', TRUE),
    ('fh over 0.5', TRUE),
    ('fh under 1.5', TRUE),
    ('fh draw', TRUE),
    ('home win either half', TRUE),
    ('away win either half', TRUE),
    ('home win 2nd half', TRUE),
    ('away win 2nd half', TRUE),
    ('over 6.5 corners', TRUE),
    ('over 7.5 corners', TRUE),
    ('over 8.5 corners', TRUE),
    ('over 9.5 corners', TRUE),
    ('over 10.5 corners', TRUE),
    ('over 11.5 corners', TRUE),
    ('over 12.5 corners', TRUE),
    ('under 7.5 corners', TRUE),
    ('under 8.5 corners', TRUE),
    ('under 9.5 corners', TRUE),
    ('under 10.5 corners', TRUE),
    ('under 11.5 corners', TRUE),
    ('under 12.5 corners', TRUE),
    ('corners o 6.5', TRUE),
    ('corners o 7.5', TRUE),
    ('corners o 8.5', TRUE),
    ('corners o 9.5', TRUE),
    ('corners o 10.5', TRUE),
    ('corners o 11.5', TRUE),
    ('corners o 12.5', TRUE),
    ('corners u 7.5', TRUE),
    ('corners u 8.5', TRUE),
    ('corners u 9.5', TRUE),
    ('corners u 10.5', TRUE),
    ('corners u 11.5', TRUE),
    ('corners u 12.5', TRUE),
    ('over 1.5 yellow cards', TRUE),
    ('over 2.5 yellow cards', TRUE),
    ('over 3.5 yellow cards', TRUE),
    ('over 4.5 yellow cards', TRUE),
    ('over 5.5 yellow cards', TRUE),
    ('over 6.5 yellow cards', TRUE),
    ('under 1.5 yellow cards', TRUE),
    ('under 2.5 yellow cards', TRUE),
    ('under 3.5 yellow cards', TRUE),
    ('under 4.5 yellow cards', TRUE),
    ('under 5.5 yellow cards', TRUE),
    ('under 6.5 yellow cards', TRUE),
    ('cards o 1.5', TRUE),
    ('cards o 2.5', TRUE),
    ('cards o 3.5', TRUE),
    ('cards o 4.5', TRUE),
    ('cards o 5.5', TRUE),
    ('cards o 6.5', TRUE),
    ('cards u 1.5', TRUE),
    ('cards u 2.5', TRUE),
    ('cards u 3.5', TRUE),
    ('cards u 4.5', TRUE),
    ('cards u 5.5', TRUE),
    ('cards u 6.5', TRUE)
ON CONFLICT (allow_phrase) DO UPDATE
SET is_active = EXCLUDED.is_active;

CREATE OR REPLACE FUNCTION skcs_to_numeric_safe(p_text TEXT, p_default NUMERIC DEFAULT NULL)
RETURNS NUMERIC AS $$
BEGIN
    IF p_text IS NULL OR BTRIM(p_text) = '' THEN
        RETURN p_default;
    END IF;
    IF p_text ~ '^-?[0-9]+(\.[0-9]+)?$' THEN
        RETURN p_text::NUMERIC;
    END IF;
    RETURN p_default;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION skcs_is_secondary_market_allowed(p_market_text TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_market TEXT := LOWER(COALESCE(TRIM(p_market_text), ''));
BEGIN
    v_market := REGEXP_REPLACE(v_market, '[_\-]+', ' ', 'g');
    v_market := REGEXP_REPLACE(v_market, '\s+', ' ', 'g');
    v_market := REGEXP_REPLACE(v_market, '([0-9])\s+([0-9])', E'\\1.\\2', 'g');
    IF v_market = '' THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM skcs_secondary_market_allowlist a
        WHERE a.is_active = TRUE
          AND (
            v_market LIKE '%' || REGEXP_REPLACE(REGEXP_REPLACE(a.allow_phrase, '[_\-]+', ' ', 'g'), '([0-9])\s+([0-9])', E'\\1.\\2', 'g') || '%'
            OR REGEXP_REPLACE(REGEXP_REPLACE(a.allow_phrase, '[_\-]+', ' ', 'g'), '([0-9])\s+([0-9])', E'\\1.\\2', 'g') LIKE '%' || v_market || '%'
          )
    );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION trg_enforce_secondary_market_governance()
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
    v_min_secondary_conf CONSTANT NUMERIC := 76;
    v_max_secondary_count CONSTANT INT := 4;
BEGIN
    IF jsonb_typeof(v_matches) = 'array' AND jsonb_array_length(v_matches) > 0 THEN
        v_fixture_key := COALESCE(
            NULLIF(BTRIM(v_matches->0->>'match_id'), ''),
            NULLIF(BTRIM(v_matches->0->>'fixture_id'), '')
        );
    END IF;

    -- Secondary rows: strict min confidence + strict allowlist + max 4 per fixture.
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
                skcs_to_numeric_safe(v_leg->>'confidence', NULL),
                skcs_to_numeric_safe(v_row->>'total_confidence', NULL),
                skcs_to_numeric_safe(v_row->>'confidence', NULL),
                0
            );

            IF v_conf < v_min_secondary_conf THEN
                RAISE EXCEPTION 'SKCS Secondary Governance: market confidence % is below required %.', v_conf, v_min_secondary_conf;
            END IF;

            IF NOT skcs_is_secondary_market_allowed(v_market_text) THEN
                RAISE EXCEPTION 'SKCS Secondary Governance: market "%" is not in secondary allowlist.', v_market_text;
            END IF;
        END LOOP;

        IF v_fixture_key IS NOT NULL THEN
            SELECT COUNT(*)
            INTO v_existing_secondary_count
            FROM predictions_final pf
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

    -- Direct rows: enforce pivot payload requirements on low-confidence bands.
    IF v_type IN ('direct', 'single') THEN
        v_row_conf := COALESCE(
            skcs_to_numeric_safe(v_row->>'total_confidence', NULL),
            skcs_to_numeric_safe(v_row->>'confidence', NULL),
            CASE
                WHEN jsonb_typeof(v_matches) = 'array' AND jsonb_array_length(v_matches) > 0
                THEN skcs_to_numeric_safe(v_matches->0->>'confidence', 0)
                ELSE 0
            END
        );

        IF v_row_conf BETWEEN 59 AND 69 THEN
            IF jsonb_typeof(v_secondary) <> 'array' OR jsonb_array_length(v_secondary) = 0 THEN
                RAISE EXCEPTION 'SKCS Direct Governance: high-risk direct market (%) must attach secondary insights.', v_row_conf;
            END IF;
        END IF;

        IF v_row_conf BETWEEN 0 AND 58 THEN
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
                v_conf := COALESCE(skcs_to_numeric_safe(v_item->>'confidence', NULL), 0);

                IF v_conf < v_min_secondary_conf THEN
                    RAISE EXCEPTION 'SKCS Secondary Governance: attached secondary confidence % is below required %.',
                        v_conf, v_min_secondary_conf;
                END IF;

                IF NOT skcs_is_secondary_market_allowed(v_market_text) THEN
                    RAISE EXCEPTION 'SKCS Secondary Governance: attached secondary "%" is not in allowlist.', v_market_text;
                END IF;
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF to_regclass('public.predictions_final') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS enforce_secondary_market_governance ON public.predictions_final;
        CREATE TRIGGER enforce_secondary_market_governance
        BEFORE INSERT OR UPDATE ON public.predictions_final
        FOR EACH ROW
        EXECUTE FUNCTION trg_enforce_secondary_market_governance();
    END IF;
END
$$;

GRANT EXECUTE ON FUNCTION process_subscription_purchase(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_market_counts(UUID, skcs_insight_format) TO authenticated;
GRANT EXECUTE ON FUNCTION consume_wallet_quota(UUID, TEXT) TO authenticated;
