-- =========================================================
-- SKCS Prediction Engine Core
-- Combined Migration Pack 01 + 02 + 03
-- Late-order migration so it can be applied after the
-- existing schema history in this repo.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- MIGRATION 01
-- Base tables, scoring tables, core functions, final view
-- =========================================================

CREATE TABLE IF NOT EXISTS public.team_form (
    id bigserial PRIMARY KEY,
    team_id text NOT NULL,
    season_year integer NOT NULL,
    match_date date NOT NULL,
    result text NOT NULL CHECK (result IN ('W', 'D', 'L')),
    goals_for integer NOT NULL DEFAULT 0,
    goals_against integer NOT NULL DEFAULT 0,
    opponent_id text,
    opponent_strength numeric,
    fixture_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (team_id, season_year, match_date, fixture_id)
);

CREATE INDEX IF NOT EXISTS idx_team_form_team_date
ON public.team_form(team_id, match_date DESC);

CREATE INDEX IF NOT EXISTS idx_team_form_season
ON public.team_form(season_year, team_id);

CREATE TABLE IF NOT EXISTS public.team_strength (
    id bigserial PRIMARY KEY,
    team_id text NOT NULL,
    season_year integer NOT NULL,
    attack_rating numeric NOT NULL DEFAULT 50,
    defense_rating numeric NOT NULL DEFAULT 50,
    home_strength numeric NOT NULL DEFAULT 50,
    away_strength numeric NOT NULL DEFAULT 50,
    form_score numeric NOT NULL DEFAULT 50,
    last_updated timestamptz NOT NULL DEFAULT now(),
    UNIQUE (team_id, season_year)
);

CREATE INDEX IF NOT EXISTS idx_team_strength_team_season
ON public.team_strength(team_id, season_year);

CREATE TABLE IF NOT EXISTS public.head_to_head (
    id bigserial PRIMARY KEY,
    home_team_id text NOT NULL,
    away_team_id text NOT NULL,
    season_year integer NOT NULL,
    total_matches integer NOT NULL DEFAULT 0,
    home_wins integer NOT NULL DEFAULT 0,
    draws integer NOT NULL DEFAULT 0,
    away_wins integer NOT NULL DEFAULT 0,
    home_goals integer NOT NULL DEFAULT 0,
    away_goals integer NOT NULL DEFAULT 0,
    last_updated timestamptz NOT NULL DEFAULT now(),
    UNIQUE (home_team_id, away_team_id, season_year)
);

CREATE INDEX IF NOT EXISTS idx_h2h_matchup
ON public.head_to_head(home_team_id, away_team_id, season_year);

CREATE TABLE IF NOT EXISTS public.injury_impact (
    id bigserial PRIMARY KEY,
    team_id text NOT NULL,
    player_id text,
    player_name text,
    position text,
    status text,
    impact_score numeric NOT NULL DEFAULT 0,
    fixture_id text,
    last_updated timestamptz NOT NULL DEFAULT now(),
    UNIQUE (team_id, player_id, fixture_id)
);

CREATE INDEX IF NOT EXISTS idx_injury_impact_team
ON public.injury_impact(team_id, last_updated DESC);

CREATE TABLE IF NOT EXISTS public.volatility_factors (
    id bigserial PRIMARY KEY,
    league_id text NOT NULL,
    market_id text NOT NULL,
    volatility_index numeric NOT NULL DEFAULT 50,
    last_updated timestamptz NOT NULL DEFAULT now(),
    UNIQUE (league_id, market_id)
);

CREATE INDEX IF NOT EXISTS idx_volatility_lookup
ON public.volatility_factors(league_id, market_id);

CREATE TABLE IF NOT EXISTS public.prediction_scores (
    id bigserial PRIMARY KEY,
    fixture_id text NOT NULL,
    sport text NOT NULL DEFAULT 'Football',
    league_id text,
    season_year integer,
    home_team_id text,
    away_team_id text,
    form_home numeric NOT NULL DEFAULT 50,
    form_away numeric NOT NULL DEFAULT 50,
    strength_home numeric NOT NULL DEFAULT 50,
    strength_away numeric NOT NULL DEFAULT 50,
    h2h_home_advantage numeric NOT NULL DEFAULT 50,
    injury_home numeric NOT NULL DEFAULT 0,
    injury_away numeric NOT NULL DEFAULT 0,
    volatility_index numeric NOT NULL DEFAULT 50,
    confidence numeric NOT NULL DEFAULT 50,
    score_context jsonb NOT NULL DEFAULT '{}'::jsonb,
    calculated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (fixture_id, sport)
);

CREATE INDEX IF NOT EXISTS idx_prediction_scores_fixture
ON public.prediction_scores(fixture_id, sport);

CREATE INDEX IF NOT EXISTS idx_prediction_scores_league
ON public.prediction_scores(league_id, sport);

CREATE OR REPLACE FUNCTION public.calculate_form_score(p_team_id text, p_season_year integer DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    total_weighted numeric := 0;
    total_weight numeric := 0;
    r RECORD;
    pos integer := 0;
    weight integer;
BEGIN
    FOR r IN
        SELECT result
        FROM public.team_form
        WHERE team_id = p_team_id
          AND (p_season_year IS NULL OR season_year = p_season_year)
        ORDER BY match_date DESC, id DESC
        LIMIT 5
    LOOP
        pos := pos + 1;
        weight := 6 - pos;
        total_weight := total_weight + weight;

        CASE r.result
            WHEN 'W' THEN total_weighted := total_weighted + (weight * 100);
            WHEN 'D' THEN total_weighted := total_weighted + (weight * 50);
            WHEN 'L' THEN total_weighted := total_weighted + (weight * 0);
            ELSE total_weighted := total_weighted + (weight * 50);
        END CASE;
    END LOOP;

    IF total_weight = 0 THEN
        RETURN 50;
    END IF;

    RETURN ROUND(total_weighted / total_weight, 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_home_advantage(p_team_id text, p_opponent_id text, p_season_year integer DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    team_home numeric := 50;
    opp_away numeric := 50;
BEGIN
    SELECT COALESCE(home_strength, 50)
    INTO team_home
    FROM public.team_strength
    WHERE team_id = p_team_id
      AND (p_season_year IS NULL OR season_year = p_season_year)
    ORDER BY last_updated DESC
    LIMIT 1;

    SELECT COALESCE(away_strength, 50)
    INTO opp_away
    FROM public.team_strength
    WHERE team_id = p_opponent_id
      AND (p_season_year IS NULL OR season_year = p_season_year)
    ORDER BY last_updated DESC
    LIMIT 1;

    RETURN ROUND(((team_home - opp_away) + 100) / 2.0, 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_team_strength(p_team_id text, p_season_year integer)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    form_score numeric := 50;
    attack_rating numeric := 50;
    defense_rating numeric := 50;
    injury_penalty numeric := 0;
    strength numeric := 50;
BEGIN
    SELECT COALESCE(public.calculate_form_score(p_team_id, p_season_year), 50)
    INTO form_score;

    SELECT
        COALESCE(attack_rating, 50),
        COALESCE(defense_rating, 50)
    INTO attack_rating, defense_rating
    FROM public.team_strength
    WHERE team_id = p_team_id
      AND season_year = p_season_year
    ORDER BY last_updated DESC
    LIMIT 1;

    SELECT COALESCE(SUM(impact_score), 0)
    INTO injury_penalty
    FROM public.injury_impact
    WHERE team_id = p_team_id;

    strength := (form_score * 0.45)
             + (attack_rating * 0.30)
             + (defense_rating * 0.25)
             - injury_penalty;

    RETURN GREATEST(0, LEAST(100, ROUND(strength, 2)));
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_injury_impact(p_team_id text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    total_impact numeric := 0;
BEGIN
    SELECT COALESCE(SUM(impact_score), 0)
    INTO total_impact
    FROM public.injury_impact
    WHERE team_id = p_team_id;

    RETURN GREATEST(0, LEAST(100, ROUND(total_impact, 2)));
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_volatility(p_league_id text, p_market_id text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v numeric := 50;
BEGIN
    SELECT COALESCE(volatility_index, 50)
    INTO v
    FROM public.volatility_factors
    WHERE league_id = p_league_id
      AND market_id = p_market_id
    ORDER BY last_updated DESC
    LIMIT 1;

    RETURN GREATEST(0, LEAST(100, ROUND(v, 2)));
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_confidence(
    p_fixture_id text,
    p_home_team_id text,
    p_away_team_id text,
    p_league_id text,
    p_season_year integer,
    p_market_id text DEFAULT '1x2'
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    home_form numeric := 50;
    away_form numeric := 50;
    home_strength numeric := 50;
    away_strength numeric := 50;
    home_adv numeric := 50;
    injury_home numeric := 0;
    injury_away numeric := 0;
    volatility numeric := 50;
    confidence numeric := 50;
BEGIN
    home_form := COALESCE(public.calculate_form_score(p_home_team_id, p_season_year), 50);
    away_form := COALESCE(public.calculate_form_score(p_away_team_id, p_season_year), 50);
    home_strength := COALESCE(public.calculate_team_strength(p_home_team_id, p_season_year), 50);
    away_strength := COALESCE(public.calculate_team_strength(p_away_team_id, p_season_year), 50);
    home_adv := COALESCE(public.calculate_home_advantage(p_home_team_id, p_away_team_id, p_season_year), 50);
    injury_home := COALESCE(public.calculate_injury_impact(p_home_team_id), 0);
    injury_away := COALESCE(public.calculate_injury_impact(p_away_team_id), 0);
    volatility := COALESCE(public.calculate_volatility(p_league_id, p_market_id), 50);

    confidence :=
        (home_form * 0.20)
      + (away_form * 0.10)
      + (home_strength * 0.25)
      + (away_strength * 0.15)
      + (home_adv * 0.20)
      - ((injury_home + injury_away) * 0.05)
      - (volatility * 0.05);

    RETURN GREATEST(0, LEAST(100, ROUND(confidence, 2)));
END;
$$;

CREATE OR REPLACE VIEW public.v_predictions_final AS
SELECT
    pf.id,
    pf.publish_run_id,
    pf.tier,
    pf.type,
    pf.matches,
    pf.total_confidence,
    pf.risk_level,
    pf.created_at,
    pf.fixture_id,
    pf.home_team,
    pf.away_team,
    pf.sport,
    pf.market_type,
    pf.recommendation,
    pf.plan_visibility,
    pf.expires_at,
    pf.edgemind_report,
    pf.secondary_insights
FROM public.direct1x2_prediction_final pf;

-- =========================================================
-- MIGRATION 02
-- Backfill helpers, score population, enhanced view
-- =========================================================

INSERT INTO public.team_form (
    team_id,
    season_year,
    match_date,
    result,
    goals_for,
    goals_against,
    opponent_id,
    fixture_id
)
SELECT
    mr.home_team_name AS team_id,
    COALESCE(NULLIF(mr.season, '')::integer, EXTRACT(YEAR FROM mr.played_at)::integer) AS season_year,
    mr.played_at::date AS match_date,
    CASE
        WHEN mr.home_score > mr.away_score THEN 'W'
        WHEN mr.home_score = mr.away_score THEN 'D'
        ELSE 'L'
    END AS result,
    mr.home_score AS goals_for,
    mr.away_score AS goals_against,
    mr.away_team_name AS opponent_id,
    mr.fixture_id
FROM public.match_results mr
WHERE mr.home_team_name IS NOT NULL
  AND mr.away_team_name IS NOT NULL
  AND mr.status_normalized = 'finished'
UNION ALL
SELECT
    mr.away_team_name AS team_id,
    COALESCE(NULLIF(mr.season, '')::integer, EXTRACT(YEAR FROM mr.played_at)::integer) AS season_year,
    mr.played_at::date AS match_date,
    CASE
        WHEN mr.away_score > mr.home_score THEN 'W'
        WHEN mr.away_score = mr.home_score THEN 'D'
        ELSE 'L'
    END AS result,
    mr.away_score AS goals_for,
    mr.home_score AS goals_against,
    mr.home_team_name AS opponent_id,
    mr.fixture_id
FROM public.match_results mr
WHERE mr.home_team_name IS NOT NULL
  AND mr.away_team_name IS NOT NULL
  AND mr.status_normalized = 'finished'
ON CONFLICT (team_id, season_year, match_date, fixture_id) DO UPDATE
SET
    result = EXCLUDED.result,
    goals_for = EXCLUDED.goals_for,
    goals_against = EXCLUDED.goals_against,
    opponent_id = EXCLUDED.opponent_id;

INSERT INTO public.head_to_head (
    home_team_id,
    away_team_id,
    season_year,
    total_matches,
    home_wins,
    draws,
    away_wins,
    home_goals,
    away_goals
)
SELECT
    mr.home_team_name AS home_team_id,
    mr.away_team_name AS away_team_id,
    COALESCE(NULLIF(mr.season, '')::integer, EXTRACT(YEAR FROM mr.played_at)::integer) AS season_year,
    COUNT(*)::integer AS total_matches,
    SUM(CASE WHEN mr.home_score > mr.away_score THEN 1 ELSE 0 END)::integer AS home_wins,
    SUM(CASE WHEN mr.home_score = mr.away_score THEN 1 ELSE 0 END)::integer AS draws,
    SUM(CASE WHEN mr.away_score > mr.home_score THEN 1 ELSE 0 END)::integer AS away_wins,
    SUM(mr.home_score)::integer AS home_goals,
    SUM(mr.away_score)::integer AS away_goals
FROM public.match_results mr
WHERE mr.home_team_name IS NOT NULL
  AND mr.away_team_name IS NOT NULL
  AND mr.status_normalized = 'finished'
GROUP BY
    mr.home_team_name,
    mr.away_team_name,
    COALESCE(NULLIF(mr.season, '')::integer, EXTRACT(YEAR FROM mr.played_at)::integer)
ON CONFLICT (home_team_id, away_team_id, season_year) DO UPDATE
SET
    total_matches = EXCLUDED.total_matches,
    home_wins = EXCLUDED.home_wins,
    draws = EXCLUDED.draws,
    away_wins = EXCLUDED.away_wins,
    home_goals = EXCLUDED.home_goals,
    away_goals = EXCLUDED.away_goals,
    last_updated = now();

CREATE OR REPLACE FUNCTION public.populate_prediction_scores(p_fixture_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec RECORD;
    v_season integer;
    v_home_form numeric;
    v_away_form numeric;
    v_home_strength numeric;
    v_away_strength numeric;
    v_home_advantage numeric;
    v_injury_home numeric;
    v_injury_away numeric;
    v_volatility numeric;
    v_confidence numeric;
    v_league_id text;
BEGIN
    SELECT
        pf.fixture_id,
        COALESCE(NULLIF(TRIM(pf.sport), ''), 'football') AS sport,
        COALESCE(
            NULLIF(TRIM(pf.matches->0->>'league_id'), ''),
            NULLIF(TRIM(pf.matches->0->'metadata'->>'league_id'), ''),
            NULLIF(TRIM(pf.matches->0->>'competition_id'), ''),
            'unknown'
        ) AS league_id,
        COALESCE(
            NULLIF(TRIM(pf.home_team), ''),
            NULLIF(TRIM(pf.matches->0->>'home_team'), ''),
            NULLIF(TRIM(pf.matches->0->'metadata'->>'home_team'), ''),
            NULLIF(TRIM(pf.matches->0->>'home_team_name'), '')
        ) AS home_team,
        COALESCE(
            NULLIF(TRIM(pf.away_team), ''),
            NULLIF(TRIM(pf.matches->0->>'away_team'), ''),
            NULLIF(TRIM(pf.matches->0->'metadata'->>'away_team'), ''),
            NULLIF(TRIM(pf.matches->0->>'away_team_name'), '')
        ) AS away_team
    INTO rec
    FROM public.direct1x2_prediction_final pf
    WHERE pf.fixture_id = p_fixture_id
    ORDER BY pf.created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE NOTICE 'Fixture % not found in direct1x2_prediction_final', p_fixture_id;
        RETURN;
    END IF;

    v_season := CASE
        WHEN EXTRACT(MONTH FROM now()) >= 8 THEN EXTRACT(YEAR FROM now())::integer
        ELSE (EXTRACT(YEAR FROM now())::integer - 1)
    END;

    v_league_id := rec.league_id;
    v_home_form := COALESCE(public.calculate_form_score(rec.home_team, v_season), 50);
    v_away_form := COALESCE(public.calculate_form_score(rec.away_team, v_season), 50);
    v_home_strength := COALESCE(public.calculate_team_strength(rec.home_team, v_season), 50);
    v_away_strength := COALESCE(public.calculate_team_strength(rec.away_team, v_season), 50);
    v_home_advantage := COALESCE(public.calculate_home_advantage(rec.home_team, rec.away_team, v_season), 50);
    v_injury_home := COALESCE(public.calculate_injury_impact(rec.home_team), 0);
    v_injury_away := COALESCE(public.calculate_injury_impact(rec.away_team), 0);
    v_volatility := COALESCE(public.calculate_volatility(v_league_id, '1x2'), 50);
    v_confidence := COALESCE(
        public.calculate_confidence(
            p_fixture_id,
            rec.home_team,
            rec.away_team,
            v_league_id,
            v_season,
            '1x2'
        ),
        50
    );

    INSERT INTO public.prediction_scores (
        fixture_id,
        sport,
        league_id,
        season_year,
        home_team_id,
        away_team_id,
        form_home,
        form_away,
        strength_home,
        strength_away,
        h2h_home_advantage,
        injury_home,
        injury_away,
        volatility_index,
        confidence,
        score_context,
        calculated_at
    )
    VALUES (
        p_fixture_id,
        rec.sport,
        v_league_id,
        v_season,
        rec.home_team,
        rec.away_team,
        v_home_form,
        v_away_form,
        v_home_strength,
        v_away_strength,
        v_home_advantage,
        v_injury_home,
        v_injury_away,
        v_volatility,
        v_confidence,
        jsonb_build_object(
            'home_form', v_home_form,
            'away_form', v_away_form,
            'home_strength', v_home_strength,
            'away_strength', v_away_strength,
            'home_advantage', v_home_advantage,
            'injury_home', v_injury_home,
            'injury_away', v_injury_away,
            'volatility', v_volatility
        ),
        now()
    )
    ON CONFLICT (fixture_id, sport) DO UPDATE
    SET
        league_id = EXCLUDED.league_id,
        season_year = EXCLUDED.season_year,
        home_team_id = EXCLUDED.home_team_id,
        away_team_id = EXCLUDED.away_team_id,
        form_home = EXCLUDED.form_home,
        form_away = EXCLUDED.form_away,
        strength_home = EXCLUDED.strength_home,
        strength_away = EXCLUDED.strength_away,
        h2h_home_advantage = EXCLUDED.h2h_home_advantage,
        injury_home = EXCLUDED.injury_home,
        injury_away = EXCLUDED.injury_away,
        volatility_index = EXCLUDED.volatility_index,
        confidence = EXCLUDED.confidence,
        score_context = EXCLUDED.score_context,
        calculated_at = now();
END;
$$;

CREATE OR REPLACE VIEW public.v_predictions_final AS
SELECT
    pf.id,
    pf.publish_run_id,
    pf.tier,
    pf.type,
    pf.matches,
    COALESCE(ps.confidence, pf.total_confidence) AS total_confidence,
    pf.risk_level,
    pf.created_at,
    pf.fixture_id,
    pf.home_team,
    pf.away_team,
    pf.sport,
    pf.market_type,
    pf.recommendation,
    pf.plan_visibility,
    pf.expires_at,
    pf.edgemind_report,
    pf.secondary_insights,
    ps.form_home,
    ps.form_away,
    ps.strength_home,
    ps.strength_away,
    ps.h2h_home_advantage,
    ps.injury_home,
    ps.injury_away,
    ps.volatility_index,
    ps.score_context
FROM public.direct1x2_prediction_final pf
LEFT JOIN public.prediction_scores ps
    ON ps.fixture_id = pf.fixture_id
   AND ps.sport = COALESCE(NULLIF(TRIM(pf.sport), ''), 'football')
WHERE
    EXISTS (
        SELECT 1
        FROM public.tier_rules tr
        WHERE tr.tier = pf.tier
          AND (
              COALESCE(ps.confidence, pf.total_confidence) >= tr.min_confidence
              OR COALESCE(pf.type, '') IN ('acca', 'acca_6match', 'mega_acca_12')
          )
    )
    AND (
        pf.type <> 'secondary'
        OR EXISTS (
            SELECT 1
            FROM public.secondary_market_allowlist s
            WHERE s.market_key = COALESCE(pf.market_type, '')
              AND COALESCE(s.is_active, true) = true
        )
    );

-- =========================================================
-- MIGRATION 03
-- Automation, refresh helpers, notifications
-- =========================================================

CREATE OR REPLACE FUNCTION public.trg_auto_populate_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.fixture_id IS NOT NULL
       AND COALESCE(NULLIF(TRIM(NEW.type), ''), '') NOT IN ('draft', 'test') THEN
        PERFORM public.populate_prediction_scores(NEW.fixture_id);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_populate_scores_trigger ON public.direct1x2_prediction_final;

CREATE TRIGGER auto_populate_scores_trigger
AFTER INSERT OR UPDATE OF fixture_id, sport, home_team, away_team, matches, total_confidence
ON public.direct1x2_prediction_final
FOR EACH ROW
WHEN (
    NEW.fixture_id IS NOT NULL
    AND COALESCE(NULLIF(TRIM(NEW.type), ''), '') NOT IN ('draft', 'test')
)
EXECUTE FUNCTION public.trg_auto_populate_scores();

CREATE OR REPLACE FUNCTION public.refresh_upcoming_fixture_scores(p_days_ahead integer DEFAULT 7)
RETURNS TABLE (
    fixture_id text,
    confidence numeric,
    processed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT
            pf.fixture_id
        FROM public.direct1x2_prediction_final pf
        LEFT JOIN public.prediction_scores ps
            ON ps.fixture_id = pf.fixture_id
           AND ps.sport = COALESCE(NULLIF(TRIM(pf.sport), ''), 'football')
        WHERE pf.fixture_id IS NOT NULL
          AND COALESCE(pf.match_date, pf.created_at) >= now()
          AND COALESCE(pf.match_date, pf.created_at) < now() + make_interval(days => p_days_ahead)
          AND (
                ps.fixture_id IS NULL
                OR ps.calculated_at < now() - interval '6 hours'
          )
        ORDER BY COALESCE(pf.match_date, pf.created_at), pf.created_at
    LOOP
        fixture_id := rec.fixture_id;

        BEGIN
            PERFORM public.populate_prediction_scores(rec.fixture_id);

            SELECT ps.confidence
            INTO confidence
            FROM public.prediction_scores ps
            WHERE ps.fixture_id = rec.fixture_id
              AND ps.sport = (
                    SELECT COALESCE(NULLIF(TRIM(pf.sport), ''), 'football')
                    FROM public.direct1x2_prediction_final pf
                    WHERE pf.fixture_id = rec.fixture_id
                    ORDER BY pf.created_at DESC
                    LIMIT 1
              );

            processed := true;
            RETURN NEXT;
        EXCEPTION WHEN OTHERS THEN
            confidence := NULL;
            processed := false;
            RETURN NEXT;
        END;
    END LOOP;

    RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_score_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM pg_notify(
        'score_updates',
        json_build_object(
            'fixture_id', NEW.fixture_id,
            'sport', NEW.sport,
            'confidence', NEW.confidence,
            'calculated_at', NEW.calculated_at
        )::text
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS score_update_notify_trigger ON public.prediction_scores;

CREATE TRIGGER score_update_notify_trigger
AFTER INSERT OR UPDATE ON public.prediction_scores
FOR EACH ROW
EXECUTE FUNCTION public.notify_score_update();

CREATE OR REPLACE FUNCTION public.refresh_v_predictions_final()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    EXECUTE $view$
        CREATE OR REPLACE VIEW public.v_predictions_final AS
        SELECT
            pf.id,
            pf.publish_run_id,
            pf.tier,
            pf.type,
            pf.matches,
            COALESCE(ps.confidence, pf.total_confidence) AS total_confidence,
            pf.risk_level,
            pf.created_at,
            pf.fixture_id,
            pf.home_team,
            pf.away_team,
            pf.sport,
            pf.market_type,
            pf.recommendation,
            pf.plan_visibility,
            pf.expires_at,
            pf.edgemind_report,
            pf.secondary_insights,
            ps.form_home,
            ps.form_away,
            ps.strength_home,
            ps.strength_away,
            ps.h2h_home_advantage,
            ps.injury_home,
            ps.injury_away,
            ps.volatility_index,
            ps.score_context
        FROM public.direct1x2_prediction_final pf
        LEFT JOIN public.prediction_scores ps
            ON ps.fixture_id = pf.fixture_id
           AND ps.sport = COALESCE(NULLIF(TRIM(pf.sport), ''), 'football')
        WHERE
            EXISTS (
                SELECT 1
                FROM public.tier_rules tr
                WHERE tr.tier = pf.tier
                  AND (
                      COALESCE(ps.confidence, pf.total_confidence) >= tr.min_confidence
                      OR COALESCE(pf.type, '') IN ('acca', 'acca_6match', 'mega_acca_12')
                  )
            )
            AND (
                pf.type <> 'secondary'
                OR EXISTS (
                    SELECT 1
                    FROM public.secondary_market_allowlist s
                    WHERE s.market_key = COALESCE(pf.market_type, '')
                      AND COALESCE(s.is_active, true) = true
                )
            );
    $view$;
END;
$$;

SELECT public.refresh_v_predictions_final();

CREATE OR REPLACE FUNCTION public.get_prediction_stats()
RETURNS TABLE (
    total_fixtures bigint,
    with_scores bigint,
    avg_confidence numeric,
    high_confidence_count bigint
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.direct1x2_prediction_final) AS total_fixtures,
        (SELECT COUNT(*) FROM public.prediction_scores) AS with_scores,
        COALESCE((SELECT ROUND(AVG(confidence), 2) FROM public.prediction_scores), 0) AS avg_confidence,
        (SELECT COUNT(*) FROM public.prediction_scores WHERE confidence >= 80) AS high_confidence_count;
END;
$$;
