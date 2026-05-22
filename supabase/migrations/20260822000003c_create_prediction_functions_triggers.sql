-- ============================================================================
-- Step 3: Create Functions and Triggers for Normalized Prediction Tables
-- ============================================================================

-- Updated_at trigger function for prediction_core
CREATE OR REPLACE FUNCTION trg_prediction_core_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prediction_core_updated_at ON prediction_core;
CREATE TRIGGER trg_prediction_core_updated_at
    BEFORE UPDATE ON prediction_core
    FOR EACH ROW
    EXECUTE FUNCTION trg_prediction_core_updated_at();

-- Updated_at trigger function for prediction_publication
CREATE OR REPLACE FUNCTION trg_prediction_publication_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prediction_publication_updated_at ON prediction_publication;
CREATE TRIGGER trg_prediction_publication_updated_at
    BEFORE UPDATE ON prediction_publication
    FOR EACH ROW
    EXECUTE FUNCTION trg_prediction_publication_updated_at();

-- Updated_at trigger function for prediction_insights
CREATE OR REPLACE FUNCTION trg_prediction_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prediction_insights_updated_at ON prediction_insights;
CREATE TRIGGER trg_prediction_insights_updated_at
    BEFORE UPDATE ON prediction_insights
    FOR EACH ROW
    EXECUTE FUNCTION trg_prediction_insights_updated_at();

-- Migration function to move existing data
CREATE OR REPLACE FUNCTION migrate_to_normalized_tables()
RETURNS INTEGER AS $$
DECLARE
    v_migrated_count INTEGER := 0;
    v_record RECORD;
    v_core_id BIGINT;
BEGIN
    FOR v_record IN 
        SELECT 
            id,
            fixture_id,
            home_team,
            away_team,
            sport,
            market_type,
            prediction,
            confidence,
            match_date,
            risk_tier,
            matches,
            publish_run_id,
            tier,
            type,
            total_confidence,
            risk_level,
            plan_visibility,
            expires_at,
            edgemind_report,
            secondary_insights,
            recommendation,
            metadata,
            created_at
        FROM direct1x2_prediction_final
        ORDER BY id
    LOOP
        INSERT INTO prediction_core (
            id, fixture_id, home_team, away_team, sport, market_type,
            prediction, confidence, match_date, risk_tier, matches, created_at
        ) VALUES (
            v_record.id,
            v_record.fixture_id,
            v_record.home_team,
            v_record.away_team,
            v_record.sport,
            v_record.market_type,
            v_record.prediction,
            v_record.confidence,
            v_record.match_date,
            v_record.risk_tier,
            v_record.matches,
            v_record.created_at
        )
        ON CONFLICT (id) DO NOTHING;
        
        v_core_id := v_record.id;
        
        INSERT INTO prediction_metadata (
            prediction_id, publish_run_id, tier, type, total_confidence, risk_level, metadata
        ) VALUES (
            v_core_id,
            v_record.publish_run_id,
            v_record.tier,
            v_record.type,
            v_record.total_confidence,
            v_record.risk_level,
            v_record.metadata
        )
        ON CONFLICT (prediction_id) DO NOTHING;
        
        INSERT INTO prediction_publication (
            prediction_id, plan_visibility, expires_at, published_at
        ) VALUES (
            v_core_id,
            v_record.plan_visibility,
            v_record.expires_at,
            v_record.created_at
        )
        ON CONFLICT (prediction_id) DO NOTHING;
        
        INSERT INTO prediction_insights (
            prediction_id, edgemind_report, secondary_insights, recommendation
        ) VALUES (
            v_core_id,
            v_record.edgemind_report,
            v_record.secondary_insights,
            v_record.recommendation
        )
        ON CONFLICT (prediction_id) DO NOTHING;
        
        v_migrated_count := v_migrated_count + 1;
    END LOOP;
    
    RETURN v_migrated_count;
END;
$$ LANGUAGE plpgsql;

-- Sync trigger (disabled by default - enable after migration)
CREATE OR REPLACE FUNCTION trg_sync_to_normalized_tables()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO prediction_core (
        id, fixture_id, home_team, away_team, sport, market_type,
        prediction, confidence, match_date, risk_tier, matches, created_at
    ) VALUES (
        NEW.id,
        NEW.fixture_id,
        NEW.home_team,
        NEW.away_team,
        NEW.sport,
        NEW.market_type,
        NEW.prediction,
        NEW.confidence,
        NEW.match_date,
        NEW.risk_tier,
        NEW.matches,
        NEW.created_at
    )
    ON CONFLICT (id) DO UPDATE SET
        fixture_id = EXCLUDED.fixture_id,
        home_team = EXCLUDED.home_team,
        away_team = EXCLUDED.away_team,
        sport = EXCLUDED.sport,
        market_type = EXCLUDED.market_type,
        prediction = EXCLUDED.prediction,
        confidence = EXCLUDED.confidence,
        match_date = EXCLUDED.match_date,
        risk_tier = EXCLUDED.risk_tier,
        matches = EXCLUDED.matches,
        updated_at = NOW();
    
    INSERT INTO prediction_metadata (
        prediction_id, publish_run_id, tier, type, total_confidence, risk_level, metadata
    ) VALUES (
        NEW.id,
        NEW.publish_run_id,
        NEW.tier,
        NEW.type,
        NEW.total_confidence,
        NEW.risk_level,
        NEW.metadata
    )
    ON CONFLICT (prediction_id) DO UPDATE SET
        publish_run_id = EXCLUDED.publish_run_id,
        tier = EXCLUDED.tier,
        type = EXCLUDED.type,
        total_confidence = EXCLUDED.total_confidence,
        risk_level = EXCLUDED.risk_level,
        metadata = EXCLUDED.metadata;
    
    INSERT INTO prediction_publication (
        prediction_id, plan_visibility, expires_at, published_at
    ) VALUES (
        NEW.id,
        NEW.plan_visibility,
        NEW.expires_at,
        NEW.created_at
    )
    ON CONFLICT (prediction_id) DO UPDATE SET
        plan_visibility = EXCLUDED.plan_visibility,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW();
    
    INSERT INTO prediction_insights (
        prediction_id, edgemind_report, secondary_insights, recommendation
    ) VALUES (
        NEW.id,
        NEW.edgemind_report,
        NEW.secondary_insights,
        NEW.recommendation
    )
    ON CONFLICT (prediction_id) DO UPDATE SET
        edgemind_report = EXCLUDED.edgemind_report,
        secondary_insights = EXCLUDED.secondary_insights,
        recommendation = EXCLUDED.recommendation,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Trigger is disabled by default. Enable after migration:
-- DROP TRIGGER IF EXISTS trg_sync_to_normalized_tables ON direct1x2_prediction_final;
-- CREATE TRIGGER trg_sync_to_normalized_tables
--     AFTER INSERT OR UPDATE ON direct1x2_prediction_final
--     FOR EACH ROW
--     EXECUTE FUNCTION trg_sync_to_normalized_tables();

COMMENT ON FUNCTION migrate_to_normalized_tables() IS 'Migrates existing data from direct1x2_prediction_final to normalized tables.';
COMMENT ON FUNCTION trg_sync_to_normalized_tables() IS 'Keeps normalized tables in sync with direct1x2_prediction_final during transition period.';
