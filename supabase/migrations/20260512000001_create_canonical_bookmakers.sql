-- Create canonical_bookmakers table for odds integration
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'canonical_bookmakers'
    ) THEN
        CREATE TABLE canonical_bookmakers (
            bookmaker_key TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            priority_order INTEGER NOT NULL DEFAULT 999,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        -- Create indexes for efficient lookups
        CREATE INDEX IF NOT EXISTS idx_canonical_bookmakers_active ON canonical_bookmakers(is_active);
        CREATE INDEX IF NOT EXISTS idx_canonical_bookmakers_priority ON canonical_bookmakers(priority_order);
    END IF;
END
$$;

-- Seed with 22 major bookmakers
INSERT INTO canonical_bookmakers (bookmaker_key, title, priority_order) VALUES
('betmgm', 'BetMGM', 1),
('draftkings', 'DraftKings', 2),
('fanduel', 'FanDuel', 3),
('bet365', 'Bet365', 4),
('william_hill', 'William Hill', 5),
('paddy_power', 'Paddy Power', 6),
('betfair', 'Betfair', 7),
('skybet', 'Sky Bet', 8),
('betway', 'Betway', 9),
('888sport', '888Sport', 10),
('ladbrokes', 'Ladbrokes', 11),
('coral', 'Coral', 12),
('unibet', 'Unibet', 13),
('betvictor', 'BetVictor', 14),
('pinnacle', 'Pinnacle', 15),
('betfred', 'Betfred', 16),
('totesport', 'Totesport', 17),
('boylesports', 'BoyleSports', 18),
('betfred', 'Betfred', 19),
('marathonbet', 'Marathonbet', 20),
('10bet', '10Bet', 21),
('betonline', 'BetOnline', 22)
ON CONFLICT (bookmaker_key) DO UPDATE SET
    title = EXCLUDED.title,
    priority_order = EXCLUDED.priority_order,
    updated_at = NOW();

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION trg_canonical_bookmakers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_canonical_bookmakers_updated_at ON canonical_bookmakers;
CREATE TRIGGER trg_canonical_bookmakers_updated_at
    BEFORE UPDATE ON canonical_bookmakers
    FOR EACH ROW
    EXECUTE FUNCTION trg_canonical_bookmakers_updated_at();
