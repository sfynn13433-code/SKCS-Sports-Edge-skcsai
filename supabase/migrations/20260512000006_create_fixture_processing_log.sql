-- Create fixture_processing_log table for event processing telemetry
CREATE TABLE IF NOT EXISTS fixture_processing_log (
    id BIGSERIAL PRIMARY KEY,
    id_event TEXT NOT NULL,
    sport TEXT NOT NULL,
    publish_run_id INTEGER REFERENCES prediction_publish_runs(id),
    ingestion_started_at TIMESTAMPTZ,
    ingestion_completed_at TIMESTAMPTZ,
    enrichment_completed_at TIMESTAMPTZ,
    ai_completed_at TIMESTAMPTZ,
    publication_completed_at TIMESTAMPTZ,
    acca_processed_at TIMESTAMPTZ,
    suppression_reason TEXT,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_fpl_id_event ON fixture_processing_log(id_event, publish_run_id);
CREATE INDEX IF NOT EXISTS idx_fpl_sport ON fixture_processing_log(sport);
CREATE INDEX IF NOT EXISTS idx_fpl_publish_run ON fixture_processing_log(publish_run_id);
CREATE INDEX IF NOT EXISTS idx_fpl_created_at ON fixture_processing_log(created_at);

-- Add unique constraint to prevent duplicate rows
ALTER TABLE fixture_processing_log
ADD CONSTRAINT IF NOT EXISTS uq_fpl_event_run UNIQUE (id_event, publish_run_id);

-- Create update_fixture_processing_log RPC function
CREATE OR REPLACE FUNCTION update_fixture_processing_log(
    p_id_event TEXT,
    p_publish_run_id INTEGER,
    p_phase TEXT,           -- 'ingestion_started','ingestion_completed','enrichment_completed','ai_completed','publication_completed','acca_processed'
    p_suppression_reason TEXT DEFAULT NULL,
    p_failure_reason TEXT DEFAULT NULL,
    p_sport TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    -- Ensure a row exists for this event/run pair
    INSERT INTO fixture_processing_log (id_event, sport, publish_run_id, ingestion_started_at)
    VALUES (p_id_event, COALESCE(p_sport, 'unknown'), p_publish_run_id, NOW())
    ON CONFLICT (id_event, publish_run_id) DO NOTHING;

    -- Update relevant timestamp based on phase
    CASE p_phase
        WHEN 'ingestion_started' THEN
            UPDATE fixture_processing_log
            SET ingestion_started_at = NOW()
            WHERE id_event = p_id_event AND publish_run_id = p_publish_run_id;
        WHEN 'ingestion_completed' THEN
            UPDATE fixture_processing_log
            SET ingestion_completed_at = NOW()
            WHERE id_event = p_id_event AND publish_run_id = p_publish_run_id;
        WHEN 'enrichment_completed' THEN
            UPDATE fixture_processing_log
            SET enrichment_completed_at = NOW()
            WHERE id_event = p_id_event AND publish_run_id = p_publish_run_id;
        WHEN 'ai_completed' THEN
            UPDATE fixture_processing_log
            SET ai_completed_at = NOW()
            WHERE id_event = p_id_event AND publish_run_id = p_publish_run_id;
        WHEN 'publication_completed' THEN
            UPDATE fixture_processing_log
            SET publication_completed_at = NOW()
            WHERE id_event = p_id_event AND publish_run_id = p_publish_run_id;
        WHEN 'acca_processed' THEN
            UPDATE fixture_processing_log
            SET acca_processed_at = NOW()
            WHERE id_event = p_id_event AND publish_run_id = p_publish_run_id;
        ELSE
            -- Optional handling for unknown phases
            RAISE LOG 'Unknown phase % for event %', p_phase, p_id_event;
    END CASE;

    -- Set suppression reason if provided
    IF p_suppression_reason IS NOT NULL THEN
        UPDATE fixture_processing_log
        SET suppression_reason = p_suppression_reason
        WHERE id_event = p_id_event AND publish_run_id = p_publish_run_id;
    END IF;

    -- Set failure reason if provided
    IF p_failure_reason IS NOT NULL THEN
        UPDATE fixture_processing_log
        SET failure_reason = p_failure_reason
        WHERE id_event = p_id_event AND publish_run_id = p_publish_run_id;
    END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_fixture_processing_log TO authenticated;
GRANT EXECUTE ON FUNCTION update_fixture_processing_log TO service_role;
