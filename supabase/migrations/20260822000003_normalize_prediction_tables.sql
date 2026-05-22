-- ============================================================================
-- Normalize direct1x2_prediction_final into Focused Tables
-- ============================================================================
-- This migration splits the wide direct1x2_prediction_final table into
-- focused tables for better maintainability, indexing, and query performance.
--
-- New structure:
-- - prediction_core: Core prediction data (fixture, teams, prediction, confidence)
-- - prediction_publication: Frontend visibility (plan_visibility, expires_at)
-- - prediction_insights: Textual insights (edgemind_report, secondary_insights)
-- - prediction_metadata: System metadata (publish_run_id, tier, type, created_at)
-- ============================================================================

-- ============================================================================
-- 1. Create prediction_core table
-- ============================================================================

CREATE TABLE IF NOT EXISTS prediction_core (
    id BIGSERIAL PRIMARY KEY,
    fixture_id TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    sport TEXT NOT NULL,
    market_type TEXT NOT NULL,
    prediction TEXT NOT NULL,
    confidence NUMERIC NOT NULL CHECK (confidence BETWEEN 0 AND 100),
    match_date TIMESTAMPTZ NOT NULL,
    risk_tier risk_tier_enum NOT NULL,
    matches JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_prediction_core_fixture ON prediction_core(fixture_id);
CREATE INDEX IF NOT EXISTS idx_prediction_core_match_date ON prediction_core(match_date);
CREATE INDEX IF NOT EXISTS idx_prediction_core_sport ON prediction_core(sport);
CREATE INDEX IF NOT EXISTS idx_prediction_core_risk_tier ON prediction_core(risk_tier);
CREATE INDEX IF NOT EXISTS idx_prediction_core_confidence ON prediction_core(confidence);
CREATE INDEX IF NOT EXISTS idx_prediction_core_teams ON prediction_core(home_team, away_team);

-- Add updated_at trigger
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

-- ============================================================================
-- 2. Create prediction_publication table
-- ============================================================================

CREATE TABLE IF NOT EXISTS prediction_publication (
    id BIGSERIAL PRIMARY KEY,
    prediction_id BIGINT NOT NULL REFERENCES prediction_core(id) ON DELETE CASCADE,
    plan_visibility JSONB NOT NULL DEFAULT '[]'::JSONB,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (prediction_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_prediction_publication_prediction ON prediction_publication(prediction_id);
CREATE INDEX IF NOT EXISTS idx_prediction_publication_expires ON prediction_publication(expires_at);
CREATE INDEX IF NOT EXISTS idx_prediction_publication_active ON prediction_publication(is_active) WHERE is_active = TRUE;

-- Add updated_at trigger
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

-- ============================================================================
-- 3. Create prediction_insights table
-- ============================================================================

CREATE TABLE IF NOT EXISTS prediction_insights (
    id BIGSERIAL PRIMARY KEY,
    prediction_id BIGINT NOT NULL REFERENCES prediction_core(id) ON DELETE CASCADE,
    edgemind_report TEXT,
    secondary_insights JSONB NOT NULL DEFAULT '[]'::JSONB,
    recommendation TEXT,
    analysis_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (prediction_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_prediction_insights_prediction ON prediction_insights(prediction_id);

-- Add updated_at trigger
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

-- ============================================================================
-- 4. Create prediction_metadata table
-- ============================================================================

CREATE TABLE IF NOT EXISTS prediction_metadata (
    id BIGSERIAL PRIMARY KEY,
    prediction_id BIGINT NOT NULL REFERENCES prediction_core(id) ON DELETE CASCADE,
    publish_run_id BIGINT REFERENCES prediction_publish_runs(id) ON DELETE SET NULL,
    tier TEXT NOT NULL CHECK (tier IN ('normal', 'deep')),
    type TEXT NOT NULL CHECK (type IN ('single', 'acca', 'direct', 'secondary', 'multi', 'same_match', 'acca_6match', 'mega_acca_12')),
    total_confidence NUMERIC NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('safe', 'medium')),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (prediction_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_prediction_metadata_prediction ON prediction_metadata(prediction_id);
CREATE INDEX IF NOT EXISTS idx_prediction_metadata_publish_run ON prediction_metadata(publish_run_id);
CREATE INDEX IF NOT EXISTS idx_prediction_metadata_tier ON prediction_metadata(tier);
CREATE INDEX IF NOT EXISTS idx_prediction_metadata_type ON prediction_metadata(type);

-- ============================================================================
-- 5. Create unified view for backward compatibility
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

-- ============================================================================
-- 6. Migration function to move existing data
-- ============================================================================

CREATE OR REPLACE FUNCTION migrate_to_normalized_tables()
RETURNS INTEGER AS $$
DECLARE
    v_migrated_count INTEGER := 0;
    v_record RECORD;
    v_core_id BIGINT;
BEGIN
    -- Migrate existing data from direct1x2_prediction_final
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
        -- Insert into prediction_core
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
        
        -- Insert into prediction_metadata
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
        
        -- Insert into prediction_publication
        INSERT INTO prediction_publication (
            prediction_id, plan_visibility, expires_at, published_at
        ) VALUES (
            v_core_id,
            v_record.plan_visibility,
            v_record.expires_at,
            v_record.created_at
        )
        ON CONFLICT (prediction_id) DO NOTHING;
        
        -- Insert into prediction_insights
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

-- ============================================================================
-- 7. Triggers to keep normalized tables in sync (for transition period)
-- ============================================================================

-- Trigger on direct1x2_prediction_final to sync to normalized tables
CREATE OR REPLACE FUNCTION trg_sync_to_normalized_tables()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert/update prediction_core
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
    
    -- Insert/update prediction_metadata
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
    
    -- Insert/update prediction_publication
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
    
    -- Insert/update prediction_insights
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

-- Note: This trigger is disabled by default. Enable after migration is complete.
-- DROP TRIGGER IF EXISTS trg_sync_to_normalized_tables ON direct1x2_prediction_final;
-- CREATE TRIGGER trg_sync_to_normalized_tables
--     AFTER INSERT OR UPDATE ON direct1x2_prediction_final
--     FOR EACH ROW
--     EXECUTE FUNCTION trg_sync_to_normalized_tables();

-- ============================================================================
-- 8. Add comments for documentation
-- ============================================================================

COMMENT ON TABLE prediction_core IS 'Core prediction data: fixture, teams, prediction, confidence, risk tier. Replaces wide direct1x2_prediction_final table.';
COMMENT ON TABLE prediction_publication IS 'Frontend visibility settings: plan_visibility, expires_at, is_active status.';
COMMENT ON TABLE prediction_insights IS 'Textual insights: edgemind_report, secondary_insights, recommendation, analysis_summary.';
COMMENT ON TABLE prediction_metadata IS 'System metadata: publish_run_id, tier, type, total_confidence, risk_level, metadata.';
COMMENT ON VIEW direct1x2_prediction_final_unified IS 'Unified view joining all normalized prediction tables for backward compatibility.';
COMMENT ON FUNCTION migrate_to_normalized_tables() IS 'Migrates existing data from direct1x2_prediction_final to normalized tables. Call this after creating the tables.';
COMMENT ON FUNCTION trg_sync_to_normalized_tables() IS 'Keeps normalized tables in sync with direct1x2_prediction_final during transition period. Enable after migration.';
