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

-- Populate with 15 sports configuration
INSERT INTO sport_sync (sport, adapter_name, provider, sync_interval_minutes, supports_live, supports_odds, supports_player_stats) VALUES
('football', 'footballAdapter', 'api-football', 60, true, true, true),
('f1', 'f1Adapter', 'openf1', 180, true, true, false),
('tennis', 'tennisAdapter', 'sportradar', 120, true, true, true),
('basketball', 'basketballAdapter', 'api-sports', 90, true, true, true),
('cricket', 'cricketAdapter', 'cricapi', 120, true, true, true),
('rugby', 'rugbyAdapter', 'api-sports', 180, true, false, true),
('golf', 'golfAdapter', 'golfdata', 360, false, true, false),
('boxing', 'boxingAdapter', 'api-sports', 240, false, true, false),
('mma', 'mmaAdapter', 'api-sports', 240, false, true, false),
('baseball', 'baseballAdapter', 'api-sports', 90, true, true, true),
('american_football', 'americanFootballAdapter', 'api-sports', 90, true, true, true),
('hockey', 'hockeyAdapter', 'api-sports', 90, true, true, true),
('horse_racing', 'horseRacingAdapter', 'horseracingapi', 60, true, true, false),
('darts', 'dartsAdapter', 'api-sports', 360, false, false, false),
('volleyball', 'volleyballAdapter', 'api-sports', 180, true, false, true)
ON CONFLICT (sport) DO UPDATE SET
    adapter_name = EXCLUDED.adapter_name,
    provider = EXCLUDED.provider,
    sync_interval_minutes = EXCLUDED.sync_interval_minutes,
    supports_live = EXCLUDED.supports_live,
    supports_odds = EXCLUDED.supports_odds,
    supports_player_stats = EXCLUDED.supports_player_stats,
    updated_at = NOW();
