-- ============================================================================
-- Step 4: Create Unified View for Normalized Prediction Tables
-- ============================================================================

CREATE OR REPLACE VIEW direct1x2_prediction_final_unified AS
SELECT 
    pc.id,
    pc.fixture_id,
    pc.home_team,
    pc.away_team,
    pc.sport,
    pc.market_type,
    pc.prediction,
    pc.confidence,
    pc.match_date,
    pc.risk_tier,
    pc.matches,
    pm.publish_run_id,
    pm.tier,
    pm.type,
    pm.total_confidence,
    pm.risk_level,
    pp.plan_visibility,
    pp.expires_at,
    pi.edgemind_report,
    pi.secondary_insights,
    pi.recommendation,
    pm.metadata,
    pc.created_at,
    pc.updated_at
FROM prediction_core pc
LEFT JOIN prediction_metadata pm ON pm.prediction_id = pc.id
LEFT JOIN prediction_publication pp ON pp.prediction_id = pc.id
LEFT JOIN prediction_insights pi ON pi.prediction_id = pc.id;

COMMENT ON VIEW direct1x2_prediction_final_unified IS 'Unified view joining all normalized prediction tables for backward compatibility.';
