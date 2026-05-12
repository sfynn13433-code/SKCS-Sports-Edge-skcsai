-- Create upsert_raw_fixture RPC function for individual fixture insertion
CREATE OR REPLACE FUNCTION upsert_raw_fixture(
  p_id_event TEXT,
  p_sport TEXT,
  p_league_id INT,
  p_home_team_id INT,
  p_away_team_id INT,
  p_start_time TIMESTAMPTZ,
  p_raw_json JSONB DEFAULT NULL
) RETURNS TABLE (
  action TEXT,
  id_event TEXT,
  is_new BOOLEAN,
  error_message TEXT DEFAULT NULL
) LANGUAGE plpgsql AS $$
BEGIN
  -- Try to insert new fixture
  INSERT INTO raw_fixtures (
    id_event, sport, league_id, home_team_id, away_team_id, start_time, raw_json, created_at, updated_at
  ) VALUES (
    p_id_event, p_sport, p_league_id, p_home_team_id, p_away_team_id, p_start_time, p_raw_json, NOW(), NOW()
  )
  ON CONFLICT (id_event) 
  DO UPDATE SET
    sport = EXCLUDED.sport,
    league_id = EXCLUDED.league_id,
    home_team_id = EXCLUDED.home_team_id,
    away_team_id = EXCLUDED.away_team_id,
    start_time = EXCLUDED.start_time,
    raw_json = EXCLUDED.raw_json,
    updated_at = NOW()
  RETURNING
    CASE 
      WHEN (TG_OP = 'INSERT') THEN 'INSERTED'
      WHEN (TG_OP = 'UPDATE') THEN 'UPDATED'
    END as action,
    id_event,
    (TG_OP = 'INSERT') as is_new,
    NULL as error_message;

  -- Notify context enrichment queue
  PERFORM pg_notify(
    'context_enrichment_queue',
    json_build_object(
      'id_event', p_id_event,
      'sport', p_sport,
      'action', 'enrich',
      'priority', '1'
    )::text
  );

  RETURN;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 
      'ERROR'::TEXT as action,
      p_id_event as id_event,
      FALSE as is_new,
      SQLERRM as error_message;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION upsert_raw_fixture TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_raw_fixture TO service_role;
