-- Fix ambiguous column references in calculate_team_strength()
-- The publish pipeline can hit this function through downstream triggers.

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
        COALESCE(ts.attack_rating, 50),
        COALESCE(ts.defense_rating, 50)
    INTO attack_rating, defense_rating
    FROM public.team_strength ts
    WHERE ts.team_id = p_team_id
      AND ts.season_year = p_season_year
    ORDER BY ts.last_updated DESC
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
