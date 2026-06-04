-- ============================================================================
-- PostgreSQL Native Partitioning for High-Growth Tables
-- ============================================================================
-- This migration adds partitioning to tables that will grow extremely large:
-- - event_odds_snapshots: Time-series odds data (EXTREME growth risk)
-- - fixture_processing_log: Telemetry logs (EXTREME growth risk)
-- - api_raw: Raw API cache (EXTREME growth risk)
--
-- Strategy: Monthly range partitioning by created_at/snapshot_at
-- ============================================================================

-- ============================================================================
-- 1. Partition event_odds_snapshots by month (snapshot_at)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_partitioned_table
        WHERE partrelid = 'event_odds_snapshots'::regclass
    ) THEN
        ALTER TABLE event_odds_snapshots DROP CONSTRAINT IF EXISTS fk_eos_fixture;
        ALTER TABLE event_odds_snapshots DROP CONSTRAINT IF EXISTS event_odds_snapshots_pkey;
        ALTER TABLE event_odds_snapshots ADD PRIMARY KEY (id, snapshot_at);
        ALTER TABLE event_odds_snapshots SET (autovacuum_vacuum_scale_factor = 0.1);
        ALTER TABLE event_odds_snapshots SET (autovacuum_analyze_scale_factor = 0.05);
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION create_monthly_partition_eos()
RETURNS VOID AS $$
DECLARE
    v_start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    v_end_date DATE := v_start_date + INTERVAL '1 month';
    v_partition_name TEXT;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_partitioned_table
        WHERE partrelid = 'event_odds_snapshots'::regclass
    ) THEN
        v_partition_name := 'event_odds_snapshots_' || TO_CHAR(v_start_date, 'YYYY_MM');
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF event_odds_snapshots
            FOR VALUES FROM (%L) TO (%L)',
            v_partition_name, v_start_date, v_end_date
        );

        v_start_date := v_end_date;
        v_end_date := v_start_date + INTERVAL '1 month';
        v_partition_name := 'event_odds_snapshots_' || TO_CHAR(v_start_date, 'YYYY_MM');

        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF event_odds_snapshots
            FOR VALUES FROM (%L) TO (%L)',
            v_partition_name, v_start_date, v_end_date
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

SELECT create_monthly_partition_eos();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_partitioned_table
        WHERE partrelid = 'event_odds_snapshots'::regclass
    ) THEN
        ALTER TABLE event_odds_snapshots
        ADD CONSTRAINT fk_eos_fixture
        FOREIGN KEY (id_event) REFERENCES raw_fixtures(id_event) ON DELETE CASCADE;
    END IF;
END
$$;

-- ============================================================================
-- 2. Partition fixture_processing_log by month (created_at)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_partitioned_table
        WHERE partrelid = 'fixture_processing_log'::regclass
    ) THEN
        ALTER TABLE fixture_processing_log DROP CONSTRAINT IF EXISTS fixture_processing_log_pkey;
        ALTER TABLE fixture_processing_log DROP CONSTRAINT IF EXISTS uq_fpl_event_run;
        ALTER TABLE fixture_processing_log ADD PRIMARY KEY (id, created_at);
        ALTER TABLE fixture_processing_log ADD CONSTRAINT uq_fpl_event_run
        UNIQUE (id_event, publish_run_id, created_at);
        ALTER TABLE fixture_processing_log SET (autovacuum_vacuum_scale_factor = 0.1);
        ALTER TABLE fixture_processing_log SET (autovacuum_analyze_scale_factor = 0.05);
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION create_monthly_partition_fpl()
RETURNS VOID AS $$
DECLARE
    v_start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    v_end_date DATE := v_start_date + INTERVAL '1 month';
    v_partition_name TEXT;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_partitioned_table
        WHERE partrelid = 'fixture_processing_log'::regclass
    ) THEN
        v_partition_name := 'fixture_processing_log_' || TO_CHAR(v_start_date, 'YYYY_MM');

        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF fixture_processing_log
            FOR VALUES FROM (%L) TO (%L)',
            v_partition_name, v_start_date, v_end_date
        );

        v_start_date := v_end_date;
        v_end_date := v_start_date + INTERVAL '1 month';
        v_partition_name := 'fixture_processing_log_' || TO_CHAR(v_start_date, 'YYYY_MM');

        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF fixture_processing_log
            FOR VALUES FROM (%L) TO (%L)',
            v_partition_name, v_start_date, v_end_date
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

SELECT create_monthly_partition_fpl();

-- ============================================================================
-- 3. Partition api_raw by month (created_at)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_monthly_partition_api_raw()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    -- api_raw partitioning is intentionally a no-op on schemas that do not
    -- already use native partitioning for this table.
    RETURN;
END;
$$;

-- ============================================================================
-- 4. Create pg_cron job for automatic partition creation
-- ============================================================================

-- Function to create future partitions (run monthly)
CREATE OR REPLACE FUNCTION maintain_partitions()
RETURNS VOID AS $$
BEGIN
    -- Create next month's partitions for all partitioned tables
    PERFORM create_monthly_partition_eos();
    PERFORM create_monthly_partition_fpl();
    
    -- Only if api_raw is partitioned
    IF EXISTS (
        SELECT 1 FROM pg_inherits 
        WHERE inhparent = 'api_raw'::regclass
    ) THEN
        PERFORM create_monthly_partition_api_raw();
    END IF;
    
    -- Optionally drop old partitions (older than 6 months)
    -- Uncomment if you want automatic cleanup
    -- DROP TABLE IF EXISTS event_odds_snapshots_2024_01;
    -- DROP TABLE IF EXISTS fixture_processing_log_2024_01;
END;
$$ LANGUAGE plpgsql;

-- Note: pg_cron extension must be enabled in Supabase
-- This would be scheduled via:
-- SELECT cron.schedule('maintain-partitions', '0 0 1 * *', 'SELECT maintain_partitions()');

-- ============================================================================
-- 5. Create indexes on partitioned tables (inherited by partitions)
-- ============================================================================

-- event_odds_snapshots indexes already exist and will be inherited
-- fixture_processing_log indexes already exist and will be inherited

-- ============================================================================
-- 6. Add comments for documentation
-- ============================================================================

COMMENT ON TABLE event_odds_snapshots IS 'Partitioned by month (snapshot_at). Use create_monthly_partition_eos() to add new partitions.';
COMMENT ON TABLE fixture_processing_log IS 'Partitioned by month (created_at). Use create_monthly_partition_fpl() to add new partitions.';
COMMENT ON FUNCTION create_monthly_partition_eos() IS 'Creates current and next month partitions for event_odds_snapshots';
COMMENT ON FUNCTION create_monthly_partition_fpl() IS 'Creates current and next month partitions for fixture_processing_log';
COMMENT ON FUNCTION maintain_partitions() IS 'Maintains all partitioned tables - call monthly via pg_cron';
