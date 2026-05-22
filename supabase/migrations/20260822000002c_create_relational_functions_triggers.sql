-- ============================================================================
-- Step 3: Create Functions and Triggers for Relational Tables
-- ============================================================================

-- Updated_at trigger function for bookmaker_odds
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
    SELECT odds INTO v_odds
    FROM match_context_data
    WHERE id_event = p_id_event
    LIMIT 1;
    
    IF v_odds IS NULL OR v_odds = '{}'::JSONB THEN
        RETURN 0;
    END IF;
    
    DELETE FROM bookmaker_odds WHERE id_event = p_id_event;
    
    FOR v_bookmaker_key IN SELECT key FROM jsonb_object_keys(v_odds)
    LOOP
        v_market_data := v_odds->v_bookmaker_key;
        
        FOR v_market_key IN SELECT key FROM jsonb_object_keys(v_market_data)
        LOOP
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
    SELECT secondary_markets INTO v_secondary
    FROM direct1x2_prediction_final
    WHERE id = p_prediction_id
    LIMIT 1;
    
    IF v_secondary IS NULL OR jsonb_typeof(v_secondary) <> 'array' THEN
        RETURN 0;
    END IF;
    
    DELETE FROM prediction_secondary_markets WHERE prediction_id = p_prediction_id;
    
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

-- Updated_at trigger function for event_injuries
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

COMMENT ON FUNCTION sync_bookmaker_odds_from_context(TEXT) IS 'Syncs odds from match_context_data.odds JSONB to bookmaker_odds table.';
COMMENT ON FUNCTION sync_secondary_markets_from_prediction(BIGINT) IS 'Syncs secondary markets from prediction JSONB to relational table.';
