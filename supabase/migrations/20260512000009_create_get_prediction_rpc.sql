-- Create RPC function to get prediction by match ID with JSONB search
CREATE OR REPLACE FUNCTION get_prediction_by_match_id(match_id TEXT)
RETURNS SETOF direct1x2_prediction_final
LANGUAGE sql STABLE AS $$
  SELECT * FROM direct1x2_prediction_final
  WHERE matches::jsonb @> jsonb_build_array(jsonb_build_object('match_id', match_id))
     OR matches::jsonb @> jsonb_build_array(jsonb_build_object('id_event', match_id))
     OR matches::jsonb @> jsonb_build_array(jsonb_build_object('fixture_id', match_id))
     OR fixture_id = match_id
     OR id::text = match_id
  ORDER BY created_at DESC
  LIMIT 1;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_prediction_by_match_id TO authenticated;
GRANT EXECUTE ON FUNCTION get_prediction_by_match_id TO service_role;
