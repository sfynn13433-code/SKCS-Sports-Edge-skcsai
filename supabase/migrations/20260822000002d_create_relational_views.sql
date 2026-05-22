-- ============================================================================
-- Step 4: Create Compatibility Views for Relational Tables
-- ============================================================================

-- View to reconstruct odds JSONB from bookmaker_odds
CREATE OR REPLACE VIEW v_bookmaker_odds_jsonb AS
SELECT 
    id_event,
    snapshot_at,
    jsonb_object_agg(
        bookmaker_key, 
        jsonb_object_agg(
            market_type || '_' || selection,
            odds
        )
    ) AS odds
FROM bookmaker_odds
GROUP BY id_event, snapshot_at;

-- View to reconstruct secondary_markets JSONB from prediction_secondary_markets
CREATE OR REPLACE VIEW v_prediction_secondary_markets_jsonb AS
SELECT 
    prediction_id,
    jsonb_agg(
        jsonb_build_object(
            'market', market,
            'prediction', prediction,
            'confidence', confidence,
            'odds', odds,
            'label', label
        ) || metadata
    ) AS secondary_markets
FROM prediction_secondary_markets
GROUP BY prediction_id;

COMMENT ON VIEW v_bookmaker_odds_jsonb IS 'Reconstructs odds JSONB from bookmaker_odds for backward compatibility.';
COMMENT ON VIEW v_prediction_secondary_markets_jsonb IS 'Reconstructs secondary_markets JSONB from prediction_secondary_markets for backward compatibility.';
