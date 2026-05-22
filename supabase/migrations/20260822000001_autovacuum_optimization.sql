-- ============================================================================
-- Simple Autovacuum Optimization for High-Growth Tables
-- ============================================================================
-- This migration applies safe autovacuum tuning for high-growth tables.
-- Using only the parameter supported by Supabase managed PostgreSQL.

-- ============================================================================
-- 1. Optimize event_odds_snapshots
-- ============================================================================

ALTER TABLE event_odds_snapshots
SET (autovacuum_vacuum_scale_factor = 0.1);

-- ============================================================================
-- 2. Optimize fixture_processing_log
-- ============================================================================

ALTER TABLE fixture_processing_log
SET (autovacuum_vacuum_scale_factor = 0.1);

-- ============================================================================
-- 3. Optimize api_raw if it exists
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'api_raw'
    ) THEN
        ALTER TABLE api_raw
        SET (autovacuum_vacuum_scale_factor = 0.1);
    END IF;
END $$;

-- ============================================================================
-- 4. Add comments
-- ============================================================================

COMMENT ON TABLE event_odds_snapshots IS 'High-growth table with optimized autovacuum. Full partitioning deferred to maintenance window.';
COMMENT ON TABLE fixture_processing_log IS 'High-growth table with optimized autovacuum. Full partitioning deferred to maintenance window.';
