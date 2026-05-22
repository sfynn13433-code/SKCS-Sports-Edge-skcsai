-- ============================================================================
-- Relational Tables for Hot Query Paths (JSONB Extraction)
-- ============================================================================
-- This migration creates relational tables to extract data from JSONB columns
-- that are frequently queried. This improves query performance and enables
-- proper indexing.
-- ============================================================================

-- ============================================================================
-- 1. bookmaker_odds - Extract odds from match_context_data.odds JSONB
-- ============================================================================

CREATE TABLE IF NOT EXISTS bookmaker_odds (
    id BIGSERIAL PRIMARY KEY,
    id_event TEXT NOT NULL,
    bookmaker_key TEXT NOT NULL REFERENCES canonical_bookmakers(bookmaker_key),
    market_type TEXT NOT NULL, -- '1x2', 'over_under', 'btts', etc.
    selection TEXT NOT NULL, -- 'home', 'draw', 'away', 'over_2.5', 'under_2.5', etc.
    odds NUMERIC NOT NULL,
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_bookmaker_odds_event ON bookmaker_odds(id_event);
CREATE INDEX IF NOT EXISTS idx_bookmaker_odds_bookmaker ON bookmaker_odds(bookmaker_key);
CREATE INDEX IF NOT EXISTS idx_bookmaker_odds_market ON bookmaker_odds(market_type);
CREATE INDEX IF NOT EXISTS idx_bookmaker_odds_snapshot ON bookmaker_odds(snapshot_at);
CREATE INDEX IF NOT EXISTS idx_bookmaker_odds_event_bookmaker ON bookmaker_odds(id_event, bookmaker_key);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION trg_bookmaker_odds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bookmaker_odds_updated_at ON bookmaker_odds;
CREATE TRIGGER trg_bookmaker_odds_updated_at
    BEFORE UPDATE ON bookmaker_odds
    FOR EACH ROW
    EXECUTE FUNCTION trg_bookmaker_odds_updated_at();

-- Function to sync odds from match_context_data.odds JSONB to bookmaker_odds
CREATE OR REPLACE FUNCTION sync_bookmaker_odds_from_context(p_id_event TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_inserted_count INTEGER := 0;
    v_odds JSONB;
    v_bookmaker_key TEXT;
    v_market_data JSONB;
    v_market_key TEXT;
    v_selection_key TEXT;
    v_odds_value NUMERIC;
BEGIN
    -- Get odds from match_context_data
    SELECT odds INTO v_odds
    FROM match_context_data
    WHERE id_event = p_id_event
    LIMIT 1;
    
    IF v_odds IS NULL OR v_odds = '{}'::JSONB THEN
        RETURN 0;
    END IF;
    
    -- Delete existing odds for this event (to handle updates)
    DELETE FROM bookmaker_odds WHERE id_event = p_id_event;
    
    -- Iterate through bookmakers
    FOR v_bookmaker_key IN SELECT key FROM jsonb_object_keys(v_odds)
    LOOP
        v_market_data := v_odds->v_bookmaker_key;
        
        -- Iterate through markets
        FOR v_market_key IN SELECT key FROM jsonb_object_keys(v_market_data)
        LOOP
            -- Iterate through selections
            FOR v_selection_key IN SELECT key FROM jsonb_object_keys(v_market_data->v_market_key)
            LOOP
                v_odds_value := (v_market_data->v_market_key->v_selection_key)::NUMERIC;
                
                IF v_odds_value IS NOT NULL THEN
                    INSERT INTO bookmaker_odds (id_event, bookmaker_key, market_type, selection, odds)
                    VALUES (p_id_event, v_bookmaker_key, v_market_key, v_selection_key, v_odds_value);
                    
                    v_inserted_count := v_inserted_count + 1;
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;
    
    RETURN v_inserted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. prediction_secondary_markets - Extract from direct1x2_prediction_final.secondary_markets
-- ============================================================================

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_prediction_secondary_markets_prediction ON prediction_secondary_markets(prediction_id);
CREATE INDEX IF NOT EXISTS idx_prediction_secondary_markets_market ON prediction_secondary_markets(market);
CREATE INDEX IF NOT EXISTS idx_prediction_secondary_markets_confidence ON prediction_secondary_markets(confidence);

-- Function to sync secondary markets from prediction JSONB
CREATE OR REPLACE FUNCTION sync_secondary_markets_from_prediction(p_prediction_id BIGINT)
RETURNS INTEGER AS $$
DECLARE
    v_secondary JSONB;
    v_inserted_count INTEGER := 0;
    v_item JSONB;
    v_market TEXT;
    v_prediction TEXT;
    v_confidence NUMERIC;
    v_odds NUMERIC;
    v_label TEXT;
BEGIN
    -- Get secondary_markets from prediction
    SELECT secondary_markets INTO v_secondary
    FROM direct1x2_prediction_final
    WHERE id = p_prediction_id
    LIMIT 1;
    
    IF v_secondary IS NULL OR jsonb_typeof(v_secondary) <> 'array' THEN
        RETURN 0;
    END IF;
    
    -- Delete existing secondary markets for this prediction
    DELETE FROM prediction_secondary_markets WHERE prediction_id = p_prediction_id;
    
    -- Insert each secondary market
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_secondary)
    LOOP
        v_market := COALESCE(v_item->>'market', v_item->>'type', '');
        v_prediction := COALESCE(v_item->>'prediction', v_item->>'selection', '');
        v_confidence := COALESCE((v_item->>'confidence')::NUMERIC, 0);
        v_odds := (v_item->>'odds')::NUMERIC;
        v_label := v_item->>'label';
        
        IF v_market IS NOT NULL AND v_prediction IS NOT NULL THEN
            INSERT INTO prediction_secondary_markets (prediction_id, market, prediction, confidence, odds, label, metadata)
            VALUES (p_prediction_id, v_market, v_prediction, v_confidence, v_odds, v_label, v_item);
            
            v_inserted_count := v_inserted_count + 1;
        END IF;
    END LOOP;
    
    RETURN v_inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-sync secondary markets on insert/update
CREATE OR REPLACE FUNCTION trg_sync_secondary_markets()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM sync_secondary_markets_from_prediction(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_secondary_markets ON direct1x2_prediction_final;
CREATE TRIGGER trg_sync_secondary_markets
    AFTER INSERT OR UPDATE ON direct1x2_prediction_final
    FOR EACH ROW
    EXECUTE FUNCTION trg_sync_secondary_markets();

-- ============================================================================
-- 3. event_injuries - Extract from event_injury_snapshots
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_injuries (
    id BIGSERIAL PRIMARY KEY,
    id_event TEXT NOT NULL,
    player_name TEXT NOT NULL,
    team_name TEXT,
    injury_type TEXT,
    status TEXT, -- 'doubtful', 'out', 'questionable', etc.
    severity TEXT, -- 'minor', 'moderate', 'severe'
    return_date DATE,
    reported_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_event_injuries_event ON event_injuries(id_event);
CREATE INDEX IF NOT EXISTS idx_event_injuries_player ON event_injuries(player_name);
CREATE INDEX IF NOT EXISTS idx_event_injuries_team ON event_injuries(team_name);
CREATE INDEX IF NOT EXISTS idx_event_injuries_status ON event_injuries(status);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION trg_event_injuries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_injuries_updated_at ON event_injuries;
CREATE TRIGGER trg_event_injuries_updated_at
    BEFORE UPDATE ON event_injuries
    FOR EACH ROW
    EXECUTE FUNCTION trg_event_injuries_updated_at();

-- ============================================================================
-- 4. event_news_scores - Extract sentiment from event_news_snapshots
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_news_scores (
    id BIGSERIAL PRIMARY KEY,
    id_event TEXT NOT NULL,
    source TEXT,
    headline TEXT,
    sentiment_score NUMERIC CHECK (sentiment_score BETWEEN -1 AND 1), -- -1 negative, 0 neutral, 1 positive
    sentiment_label TEXT, -- 'positive', 'neutral', 'negative'
    keywords TEXT[],
    relevance_score NUMERIC CHECK (relevance_score BETWEEN 0 AND 1),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_event_news_scores_event ON event_news_scores(id_event);
CREATE INDEX IF NOT EXISTS idx_event_news_scores_sentiment ON event_news_scores(sentiment_label);
CREATE INDEX IF NOT EXISTS idx_event_news_scores_published ON event_news_scores(published_at);
CREATE INDEX IF NOT EXISTS idx_event_news_scores_relevance ON event_news_scores(relevance_score);

-- ============================================================================
-- 5. Create views for backward compatibility (optional)
-- ============================================================================

-- View to reconstruct odds JSONB from bookmaker_odds
CREATE OR REPLACE VIEW v_bookmaker_odds_jsonb AS
SELECT 
    id_event,
    snapshot_at,
    jsonb_object_agg(
        bookmaker_key, 
        jsonb_object_agg(
            market_type || '_' || selection,
            odds
        )
    ) AS odds
FROM bookmaker_odds
GROUP BY id_event, snapshot_at;

-- View to reconstruct secondary_markets JSONB from prediction_secondary_markets
CREATE OR REPLACE VIEW v_prediction_secondary_markets_jsonb AS
SELECT 
    prediction_id,
    jsonb_agg(
        jsonb_build_object(
            'market', market,
            'prediction', prediction,
            'confidence', confidence,
            'odds', odds,
            'label', label
        ) || metadata
    ) AS secondary_markets
FROM prediction_secondary_markets
GROUP BY prediction_id;

-- ============================================================================
-- 6. Add comments for documentation
-- ============================================================================

COMMENT ON TABLE bookmaker_odds IS 'Relational extraction of odds from match_context_data.odds JSONB. Enables efficient querying and indexing.';
COMMENT ON TABLE prediction_secondary_markets IS 'Relational extraction of secondary markets from direct1x2_prediction_final.secondary_markets JSONB.';
COMMENT ON TABLE event_injuries IS 'Relational injury data extracted from event_injury_snapshots.';
COMMENT ON TABLE event_news_scores IS 'Relational sentiment scores extracted from event_news_snapshots.';
COMMENT ON FUNCTION sync_bookmaker_odds_from_context(TEXT) IS 'Syncs odds from match_context_data.odds JSONB to bookmaker_odds table.';
COMMENT ON FUNCTION sync_secondary_markets_from_prediction(BIGINT) IS 'Syncs secondary markets from prediction JSONB to relational table.';
