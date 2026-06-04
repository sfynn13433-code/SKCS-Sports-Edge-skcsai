-- Create sport_sync configuration table for automated fixture ingestion
CREATE TABLE IF NOT EXISTS sport_sync (
    id SERIAL PRIMARY KEY,
    sport TEXT NOT NULL UNIQUE,
    provider TEXT,
    adapter_name TEXT NOT NULL,
    api_key_reference TEXT,
    sync_interval_minutes INTEGER DEFAULT 360,
    enabled BOOLEAN DEFAULT true,
    supports_live BOOLEAN DEFAULT false,
    supports_odds BOOLEAN DEFAULT false,
    supports_player_stats BOOLEAN DEFAULT false,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sport_sync_enabled ON sport_sync(enabled);
CREATE INDEX IF NOT EXISTS idx_sport_sync_last_sync ON sport_sync(last_sync_at);
CREATE INDEX IF NOT EXISTS idx_sport_sync_sport ON sport_sync(sport);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION trg_sport_sync_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sport_sync_updated_at ON sport_sync;
CREATE TRIGGER trg_sport_sync_updated_at
    BEFORE UPDATE ON sport_sync
    FOR EACH ROW
    EXECUTE FUNCTION trg_sport_sync_updated_at();

-- Seed values intentionally omitted here because the live sport_sync shape
-- varies across schema eras in this repository. Backfill via a dedicated
-- schema-aware migration or runtime bootstrap if needed.
