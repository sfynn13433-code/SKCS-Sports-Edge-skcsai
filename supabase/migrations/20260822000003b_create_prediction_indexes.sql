-- ============================================================================
-- Step 2: Create Indexes for Normalized Prediction Tables
-- ============================================================================

-- prediction_core indexes
CREATE INDEX IF NOT EXISTS idx_prediction_core_fixture ON prediction_core(fixture_id);
CREATE INDEX IF NOT EXISTS idx_prediction_core_match_date ON prediction_core(match_date);
CREATE INDEX IF NOT EXISTS idx_prediction_core_sport ON prediction_core(sport);
CREATE INDEX IF NOT EXISTS idx_prediction_core_risk_tier ON prediction_core(risk_tier);
CREATE INDEX IF NOT EXISTS idx_prediction_core_confidence ON prediction_core(confidence);
CREATE INDEX IF NOT EXISTS idx_prediction_core_teams ON prediction_core(home_team, away_team);

-- prediction_publication indexes
CREATE INDEX IF NOT EXISTS idx_prediction_publication_prediction ON prediction_publication(prediction_id);
CREATE INDEX IF NOT EXISTS idx_prediction_publication_expires ON prediction_publication(expires_at);
CREATE INDEX IF NOT EXISTS idx_prediction_publication_active ON prediction_publication(is_active) WHERE is_active = TRUE;

-- prediction_insights indexes
CREATE INDEX IF NOT EXISTS idx_prediction_insights_prediction ON prediction_insights(prediction_id);

-- prediction_metadata indexes
CREATE INDEX IF NOT EXISTS idx_prediction_metadata_prediction ON prediction_metadata(prediction_id);
CREATE INDEX IF NOT EXISTS idx_prediction_metadata_publish_run ON prediction_metadata(publish_run_id);
CREATE INDEX IF NOT EXISTS idx_prediction_metadata_tier ON prediction_metadata(tier);
CREATE INDEX IF NOT EXISTS idx_prediction_metadata_type ON prediction_metadata(type);
