-- Create event_odds_snapshots table for odds movement history
CREATE TABLE IF NOT EXISTS event_odds_snapshots (
    id BIGSERIAL PRIMARY KEY,
    id_event TEXT NOT NULL,
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    odds JSONB NOT NULL,
    source TEXT DEFAULT 'enrichment'
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_eos_event_time ON event_odds_snapshots(id_event, snapshot_at);
CREATE INDEX IF NOT EXISTS idx_eos_snapshot_at ON event_odds_snapshots(snapshot_at);
CREATE INDEX IF NOT EXISTS idx_eos_source ON event_odds_snapshots(source);

-- Add foreign key constraint to raw_fixtures
ALTER TABLE event_odds_snapshots
ADD CONSTRAINT IF NOT EXISTS fk_eos_fixture 
FOREIGN KEY (id_event) REFERENCES raw_fixtures(id_event) ON DELETE CASCADE;

-- Create function to get odds volatility for AI Stage 3
CREATE OR REPLACE FUNCTION get_odds_volatility(
    p_id_event TEXT,
    p_hours_back INTEGER DEFAULT 24
) RETURNS TABLE (
    snapshot_at TIMESTAMPTZ,
    odds JSONB,
    volatility_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        eos.snapshot_at,
        eos.odds,
        -- Simple volatility calculation (can be enhanced)
        CASE 
            WHEN LAG(eos.odds) OVER (ORDER BY eos.snapshot_at) IS NOT NULL THEN
                (
                    SELECT AVG(ABS(
                        (odds->>'home_win')::NUMERIC - 
                        (LAG(odds->>'home_win') OVER (ORDER BY eos.snapshot_at))::NUMERIC
                    ))
                    FROM jsonb_each_text(eos.odds)
                    WHERE key LIKE '%home_win%'
                )
            ELSE 0
        END AS volatility_score
    FROM event_odds_snapshots eos
    WHERE eos.id_event = p_id_event
      AND eos.snapshot_at >= NOW() - INTERVAL '1 hour' * p_hours_back
    ORDER BY eos.snapshot_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old odds snapshots (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_odds_snapshots() 
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM event_odds_snapshots 
    WHERE snapshot_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON event_odds_snapshots TO authenticated;
GRANT SELECT, INSERT ON event_odds_snapshots TO service_role;
GRANT EXECUTE ON FUNCTION get_odds_volatility TO authenticated;
GRANT EXECUTE ON FUNCTION get_odds_volatility TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_odds_snapshots TO service_role;
