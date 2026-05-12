-- Create get_prediction_by_match_id function for ai_predictions table lookup
CREATE OR REPLACE FUNCTION get_prediction_by_match_id(p_match_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    prediction_result JSONB;
BEGIN
    SELECT row_to_json(p)::jsonb INTO prediction_result
    FROM ai_predictions p
    WHERE p.match_id = p_match_id
    LIMIT 1;

    RETURN prediction_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_prediction_by_match_id TO authenticated;
GRANT EXECUTE ON FUNCTION get_prediction_by_match_id TO service_role;
