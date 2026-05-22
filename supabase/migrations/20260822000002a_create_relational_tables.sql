-- ============================================================================
-- Step 1: Create Relational Tables (Tables Only)
-- ============================================================================

-- bookmaker_odds table
CREATE TABLE IF NOT EXISTS bookmaker_odds (
    id BIGSERIAL PRIMARY KEY,
    id_event TEXT NOT NULL,
    bookmaker_key TEXT NOT NULL REFERENCES canonical_bookmakers(bookmaker_key),
    market_type TEXT NOT NULL,
    selection TEXT NOT NULL,
    odds NUMERIC NOT NULL,
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- prediction_secondary_markets table
CREATE TABLE IF NOT EXISTS prediction_secondary_markets (
    id BIGSERIAL PRIMARY KEY,
    prediction_id BIGINT NOT NULL REFERENCES direct1x2_prediction_final(id) ON DELETE CASCADE,
    market TEXT NOT NULL,
    prediction TEXT NOT NULL,
    confidence NUMERIC NOT NULL CHECK (confidence BETWEEN 0 AND 100),
    odds NUMERIC,
    label TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- event_injuries table
CREATE TABLE IF NOT EXISTS event_injuries (
    id BIGSERIAL PRIMARY KEY,
    id_event TEXT NOT NULL,
    player_name TEXT NOT NULL,
    team_name TEXT,
    injury_type TEXT,
    status TEXT,
    severity TEXT,
    return_date DATE,
    reported_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- event_news_scores table
CREATE TABLE IF NOT EXISTS event_news_scores (
    id BIGSERIAL PRIMARY KEY,
    id_event TEXT NOT NULL,
    source TEXT,
    headline TEXT,
    sentiment_score NUMERIC CHECK (sentiment_score BETWEEN -1 AND 1),
    sentiment_label TEXT,
    keywords TEXT[],
    relevance_score NUMERIC CHECK (relevance_score BETWEEN 0 AND 1),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE bookmaker_odds IS 'Relational extraction of odds from match_context_data.odds JSONB.';
COMMENT ON TABLE prediction_secondary_markets IS 'Relational extraction of secondary markets from direct1x2_prediction_final.secondary_markets JSONB.';
COMMENT ON TABLE event_injuries IS 'Relational injury data extracted from event_injury_snapshots.';
COMMENT ON TABLE event_news_scores IS 'Relational sentiment scores extracted from event_news_snapshots.';
