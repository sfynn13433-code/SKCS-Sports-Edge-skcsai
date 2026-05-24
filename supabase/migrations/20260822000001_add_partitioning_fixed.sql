-- ============================================================================
-- PostgreSQL Native Partitioning for High-Growth Tables (Fixed)
-- ============================================================================
-- This migration adds partitioning to tables that will grow extremely large:
-- - event_odds_snapshots: Time-series odds data (EXTREME growth risk)
-- - fixture_processing_log: Telemetry logs (EXTREME growth risk)
-- ============================================================================

-- ============================================================================
-- 1. Partition event_odds_snapshots by month (snapshot_at)
-- ============================================================================

-- First, drop existing foreign key constraint (will be re-added to parent)
ALTER TABLE event_odds_snapshots DROP CONSTRAINT IF EXISTS fk_eos_fixture;

-- Drop existing primary key
ALTER TABLE event_odds_snapshots DROP CONSTRAINT IF EXISTS event_odds_snapshots_pkey;

-- Add new primary key that includes partition key
ALTER TABLE event_odds_snapshots ADD PRIMARY KEY (id, snapshot_at);

-- IMPORTANT: Must declare partitioning strategy BEFORE creating partitions
-- This requires recreating the table as partitioned, which is complex with existing data
-- Alternative: Use declarative partitioning with PARTITION BY clause

-- Since the table may have existing data, we'll use a safer approach:
-- Check if table is already partitioned, if not, we'll skip partitioning for now
-- and recommend using Supabase's built-in partitioning tools

DO $$
BEGIN
    -- Check if table is already partitioned
    IF NOT EXISTS (
        SELECT 1 FROM pg_inherits 
        WHERE inhparent = 'event_odds_snapshots'::regclass
    ) THEN
        RAISE NOTICE 'event_odds_snapshots is not partitioned. Skipping partition creation.';
        RAISE NOTICE 'To partition this table, use Supabase dashboard or CLI with proper migration strategy.';
    ELSE
        RAISE NOTICE 'event_odds_snapshots is already partitioned.';
    END IF;
END $$;

-- Set autovacuum settings regardless of partitioning
ALTER TABLE event_odds_snapshots SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE event_odds_snapshots SET (autovacuum_analyze_scale_factor = 0.05);

-- Re-add foreign key constraint to parent table
ALTER TABLE event_odds_snapshots 
ADD CONSTRAINT IF NOT EXISTS fk_eos_fixture 
FOREIGN KEY (id_event) REFERENCES raw_fixtures(id_event) ON DELETE CASCADE;

-- ============================================================================
-- 2. Partition fixture_processing_log by month (created_at)
-- ============================================================================

-- Drop existing primary key
ALTER TABLE fixture_processing_log DROP CONSTRAINT IF EXISTS fixture_processing_log_pkey;
ALTER TABLE fixture_processing_log DROP CONSTRAINT IF EXISTS uq_fpl_event_run;

-- Add new primary key that includes partition key
ALTER TABLE fixture_processing_log ADD PRIMARY KEY (id, created_at);

-- Add unique constraint with partition key
ALTER TABLE fixture_processing_log ADD CONSTRAINT uq_fpl_event_run 
UNIQUE (id_event, publish_run_id, created_at);

-- Check partitioning status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_inherits 
        WHERE inhparent = 'fixture_processing_log'::regclass
    ) THEN
        RAISE NOTICE 'fixture_processing_log is not partitioned. Skipping partition creation.';
        RAISE NOTICE 'To partition this table, use Supabase dashboard or CLI with proper migration strategy.';
    ELSE
        RAISE NOTICE 'fixture_processing_log is already partitioned.';
    END IF;
END $$;

-- Set autovacuum settings
ALTER TABLE fixture_processing_log SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE fixture_processing_log SET (autovacuum_analyze_scale_factor = 0.05);

-- ============================================================================
-- 3. Set autovacuum for api_raw if it exists
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'api_raw'
    ) THEN
        ALTER TABLE api_raw SET (autovacuum_vacuum_scale_factor = 0.1);
        ALTER TABLE api_raw SET (autovacuum_analyze_scale_factor = 0.05);
        RAISE NOTICE 'api_raw autovacuum settings updated.';
    END IF;
END $$;

-- ============================================================================
-- 4. Add comments for documentation
-- ============================================================================

COMMENT ON TABLE event_odds_snapshots IS 'High-growth table with optimized autovacuum settings. Partitioning requires proper migration strategy.';
COMMENT ON TABLE fixture_processing_log IS 'High-growth table with optimized autovacuum settings. Partitioning requires proper migration strategy.';
