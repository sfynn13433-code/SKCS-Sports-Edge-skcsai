-- Performance Optimizations for SKCS Master Rulebook Triggers
-- Improves trigger performance for high-volume operations

-- 1. Partial Index for Secondary Market Limit Trigger
CREATE INDEX IF NOT EXISTS idx_secondary_published_match 
ON direct1x2_prediction_final (match_id, is_published) 
WHERE is_main = false AND is_published = true;

-- 2. CHECK Constraint for Extreme Risk Prevention (faster than trigger)
ALTER TABLE direct1x2_prediction_final 
ADD CONSTRAINT IF NOT EXISTS chk_extreme_risk_not_published 
CHECK (confidence >= 30 OR is_published = false);

-- 3. Partial Index for ACCA Leg Confidence Validation
CREATE INDEX IF NOT EXISTS idx_published_confidence 
ON direct1x2_prediction_final (confidence) 
WHERE is_published = true;

-- 4. Composite Index for Market Correlation Lookups
CREATE INDEX IF NOT EXISTS idx_market_correlations_composite 
ON market_correlations (market_a, market_b, correlation);

-- 5. Partial Index for Risk Tier Queries
CREATE INDEX IF NOT EXISTS idx_published_risk_tier 
ON direct1x2_prediction_final (risk_tier, created_at) 
WHERE is_published = true;

-- 6. Optimized Secondary Market Limit Trigger (uses index)
CREATE OR REPLACE FUNCTION limit_secondary_per_match_optimized()
RETURNS TRIGGER AS $$
DECLARE
    secondary_count INTEGER;
BEGIN
    -- Only check for secondary markets (not main 1X2)
    IF NEW.market_type != '1X2' AND NEW.is_published = true THEN
        -- Use the partial index for faster counting
        SELECT COUNT(*) INTO secondary_count
        FROM direct1x2_prediction_final
        WHERE match_id = NEW.match_id
          AND is_main = false
          AND is_published = true
          AND id != COALESCE(NEW.id, 0)
        LIMIT 1;  -- Early exit if count >= 4
        
        -- Enforce limit of 4 secondary markets
        IF secondary_count >= 4 THEN
            RAISE EXCEPTION 'Match % already has 4 published secondary markets', NEW.match_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Optimized ACCA Leg Confidence Validation (bulk operation support)
CREATE OR REPLACE FUNCTION check_acca_leg_confidence_optimized()
RETURNS TRIGGER AS $$
DECLARE
    prediction_confidence NUMERIC;
    prediction_ids TEXT[];
BEGIN
    -- Handle single insertion
    IF TG_OP = 'INSERT' THEN
        -- Get confidence of the prediction being added to ACCA
        SELECT confidence INTO prediction_confidence
        FROM direct1x2_prediction_final
        WHERE id = NEW.prediction_id
          AND is_published = true;
        
        -- Enforce minimum confidence of 75%
        IF prediction_confidence < 75 THEN
            RAISE EXCEPTION 'Accumulator leg confidence must be >= 75%% (got %%%)', prediction_confidence;
        END IF;
        
        RETURN NEW;
    
    -- Handle bulk insertion (if needed in future)
    ELSIF TG_OP = 'INSERT' AND TG_NARGS() > 1 THEN
        -- For bulk operations, validate all at once
        -- This would require a different trigger setup
        NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Optimized Risk Tier Classification (removed from trigger, uses CHECK constraint)
CREATE OR REPLACE FUNCTION classify_risk_tier_fast(confidence NUMERIC) RETURNS TEXT AS $$
BEGIN
    -- Simple CASE statement is faster than multiple IF statements
    RETURN CASE
        WHEN confidence >= 75 THEN 'LOW_RISK'
        WHEN confidence >= 55 THEN 'MEDIUM_RISK'
        WHEN confidence >= 30 THEN 'HIGH_RISK'
        ELSE 'EXTREME_RISK'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 9. Replace old triggers with optimized versions
DROP TRIGGER IF EXISTS trg_extreme_risk ON direct1x2_prediction_final;
DROP TRIGGER IF EXISTS trg_secondary_limit ON direct1x2_prediction_final;
DROP TRIGGER IF EXISTS trg_acca_leg_confidence ON acca_legs;

-- Create optimized triggers
CREATE TRIGGER trg_secondary_limit_optimized
    BEFORE INSERT OR UPDATE ON direct1x2_prediction_final
    FOR EACH ROW
    EXECUTE FUNCTION limit_secondary_per_match_optimized();

CREATE TRIGGER trg_acca_leg_confidence_optimized
    BEFORE INSERT ON acca_legs
    FOR EACH ROW
    EXECUTE FUNCTION check_acca_leg_confidence_optimized();

-- 10. Materialized View for Daily Risk Tier Statistics (refreshed daily)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_risk_tier_stats AS
SELECT 
    DATE(created_at) as date,
    risk_tier,
    COUNT(*) as prediction_count,
    ROUND(AVG(confidence), 2) as avg_confidence,
    MIN(confidence) as min_confidence,
    MAX(confidence) as max_confidence,
    COUNT(DISTINCT match_id) as unique_matches
FROM direct1x2_prediction_final
WHERE is_published = true
  AND market_type = '1X2'
GROUP BY DATE(created_at), risk_tier
ORDER BY date DESC, risk_tier;

-- Unique index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_risk_tier_stats_unique 
ON mv_daily_risk_tier_stats (date, risk_tier);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_daily_risk_tier_stats() RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_risk_tier_stats;
END;
$$ LANGUAGE plpgsql;

-- 11. Partitioning Strategy for High-Volume Tables (future optimization)
-- This is commented out as it requires significant restructuring
/*
-- Partition prediction_request_log by month
CREATE TABLE prediction_request_log_y2024m01 PARTITION OF prediction_request_log
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE prediction_request_log_y2024m02 PARTITION OF prediction_request_log
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
*/

-- 12. Trigger Performance Monitoring Function
CREATE OR REPLACE FUNCTION log_trigger_performance(
    trigger_name TEXT,
    table_name TEXT,
    operation TEXT,
    execution_time_ms INTEGER,
    rows_affected INTEGER DEFAULT 1,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO trigger_performance_log (
        trigger_name, table_name, operation, execution_time_ms, 
        rows_affected, success, error_message
    ) VALUES (
        trigger_name, table_name, operation, execution_time_ms,
        rows_affected, success, error_message
    );
END;
$$ LANGUAGE plpgsql;

-- 13. Optimized trigger with performance logging
CREATE OR REPLACE FUNCTION limit_secondary_per_match_with_logging()
RETURNS TRIGGER AS $$
DECLARE
    start_time TIMESTAMP := clock_timestamp();
    secondary_count INTEGER;
    execution_time INTEGER;
BEGIN
    -- Only check for secondary markets (not main 1X2)
    IF NEW.market_type != '1X2' AND NEW.is_published = true THEN
        -- Use the partial index for faster counting
        SELECT COUNT(*) INTO secondary_count
        FROM direct1x2_prediction_final
        WHERE match_id = NEW.match_id
          AND is_main = false
          AND is_published = true
          AND id != COALESCE(NEW.id, 0)
        LIMIT 1;
        
        -- Enforce limit of 4 secondary markets
        IF secondary_count >= 4 THEN
            execution_time := EXTRACT(MILLISECOND FROM (clock_timestamp() - start_time));
            
            -- Log performance before raising exception
            PERFORM log_trigger_performance(
                'trg_secondary_limit_optimized',
                'direct1x2_prediction_final',
                TG_OP,
                execution_time,
                1,
                false,
                'Secondary limit exceeded'
            );
            
            RAISE EXCEPTION 'Match % already has 4 published secondary markets', NEW.match_id;
        END IF;
    END IF;
    
    -- Log successful execution
    execution_time := EXTRACT(MILLISECOND FROM (clock_timestamp() - start_time));
    PERFORM log_trigger_performance(
        'trg_secondary_limit_optimized',
        'direct1x2_prediction_final',
        TG_OP,
        execution_time,
        1,
        true
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. Analyze tables for better query planning
ANALYZE direct1x2_prediction_final;
ANALYZE market_correlations;
ANALYZE acca_legs;
ANALYZE prediction_request_log;
ANALYZE acca_build_log;

-- 15. Vacuum settings for performance tuning
-- These settings should be adjusted based on your specific workload
/*
-- For high-write workloads
ALTER TABLE direct1x2_prediction_final SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE direct1x2_prediction_final SET (autovacuum_analyze_scale_factor = 0.05);

-- For log tables (high insert rate)
ALTER TABLE prediction_request_log SET (autovacuum_vacuum_scale_factor = 0.2);
ALTER TABLE acca_build_log SET (autovacuum_vacuum_scale_factor = 0.2);
*/

-- Comments for documentation
COMMENT ON INDEX idx_secondary_published_match IS 'Partial index for secondary market limit trigger optimization';
COMMENT ON CONSTRAINT chk_extreme_risk_not_published ON direct1x2_prediction_final IS 'CHECK constraint faster than trigger for extreme risk prevention';
COMMENT ON MATERIALIZED VIEW mv_daily_risk_tier_stats IS 'Pre-calculated daily risk tier statistics for fast reporting';
COMMENT ON FUNCTION refresh_daily_risk_tier_stats() IS 'Refresh materialized view without blocking reads';
