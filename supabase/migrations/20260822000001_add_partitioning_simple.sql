-- ============================================================================
-- PostgreSQL Native Partitioning for High-Growth Tables (Simplified)
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

-- Convert to partitioned table
ALTER TABLE event_odds_snapshots DROP CONSTRAINT IF EXISTS event_odds_snapshots_pkey;

-- Add new primary key that includes partition key
ALTER TABLE event_odds_snapshots ADD PRIMARY KEY (id, snapshot_at);

-- Convert to partitioned table
ALTER TABLE event_odds_snapshots SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE event_odds_snapshots SET (autovacuum_analyze_scale_factor = 0.05);

-- Create current month partition (August 2026)
CREATE TABLE IF NOT EXISTS event_odds_snapshots_2026_08 PARTITION OF event_odds_snapshots
FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

-- Create next month partition (September 2026)
CREATE TABLE IF NOT EXISTS event_odds_snapshots_2026_09 PARTITION OF event_odds_snapshots
FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

-- Re-add foreign key constraint to parent table
ALTER TABLE event_odds_snapshots 
ADD CONSTRAINT fk_eos_fixture 
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

-- Set autovacuum settings
ALTER TABLE fixture_processing_log SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE fixture_processing_log SET (autovacuum_analyze_scale_factor = 0.05);

-- Create current month partition (August 2026)
CREATE TABLE IF NOT EXISTS fixture_processing_log_2026_08 PARTITION OF fixture_processing_log
FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

-- Create next month partition (September 2026)
CREATE TABLE IF NOT EXISTS fixture_processing_log_2026_09 PARTITION OF fixture_processing_log
FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

-- ============================================================================
-- 3. Partition api_raw by month (created_at) - if table exists
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'api_raw'
    ) THEN
        -- Drop existing primary key if exists
        ALTER TABLE api_raw DROP CONSTRAINT IF EXISTS api_raw_pkey;
        
        -- Add new primary key that includes partition key
        -- Assuming api_raw has an id column and created_at
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'api_raw' AND column_name = 'id'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'api_raw' AND column_name = 'created_at'
        ) THEN
            ALTER TABLE api_raw ADD PRIMARY KEY (id, created_at);
            
            -- Set autovacuum settings
            ALTER TABLE api_raw SET (autovacuum_vacuum_scale_factor = 0.1);
            ALTER TABLE api_raw SET (autovacuum_analyze_scale_factor = 0.05);
            
            -- Create current month partition (August 2026)
            CREATE TABLE IF NOT EXISTS api_raw_2026_08 PARTITION OF api_raw
            FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
            
            -- Create next month partition (September 2026)
            CREATE TABLE IF NOT EXISTS api_raw_2026_09 PARTITION OF api_raw
            FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
        END IF;
    END IF;
END $$;

-- ============================================================================
-- 4. Add comments for documentation
-- ============================================================================

COMMENT ON TABLE event_odds_snapshots IS 'Partitioned by month (snapshot_at). Partitions: event_odds_snapshots_YYYY_MM';
COMMENT ON TABLE fixture_processing_log IS 'Partitioned by month (created_at). Partitions: fixture_processing_log_YYYY_MM';
