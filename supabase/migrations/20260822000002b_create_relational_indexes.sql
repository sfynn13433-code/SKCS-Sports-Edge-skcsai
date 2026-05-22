-- ============================================================================
-- Step 2: Create Indexes for Relational Tables
-- ============================================================================

-- bookmaker_odds indexes
CREATE INDEX IF NOT EXISTS idx_bookmaker_odds_event ON bookmaker_odds(id_event);
CREATE INDEX IF NOT EXISTS idx_bookmaker_odds_bookmaker ON bookmaker_odds(bookmaker_key);
CREATE INDEX IF NOT EXISTS idx_bookmaker_odds_market ON bookmaker_odds(market_type);
CREATE INDEX IF NOT EXISTS idx_bookmaker_odds_snapshot ON bookmaker_odds(snapshot_at);
CREATE INDEX IF NOT EXISTS idx_bookmaker_odds_event_bookmaker ON bookmaker_odds(id_event, bookmaker_key);

-- prediction_secondary_markets indexes
CREATE INDEX IF NOT EXISTS idx_prediction_secondary_markets_prediction ON prediction_secondary_markets(prediction_id);
CREATE INDEX IF NOT EXISTS idx_prediction_secondary_markets_market ON prediction_secondary_markets(market);
CREATE INDEX IF NOT EXISTS idx_prediction_secondary_markets_confidence ON prediction_secondary_markets(confidence);

-- event_injuries indexes
CREATE INDEX IF NOT EXISTS idx_event_injuries_event ON event_injuries(id_event);
CREATE INDEX IF NOT EXISTS idx_event_injuries_player ON event_injuries(player_name);
CREATE INDEX IF NOT EXISTS idx_event_injuries_team ON event_injuries(team_name);
CREATE INDEX IF NOT EXISTS idx_event_injuries_status ON event_injuries(status);

-- event_news_scores indexes
CREATE INDEX IF NOT EXISTS idx_event_news_scores_event ON event_news_scores(id_event);
CREATE INDEX IF NOT EXISTS idx_event_news_scores_sentiment ON event_news_scores(sentiment_label);
CREATE INDEX IF NOT EXISTS idx_event_news_scores_published ON event_news_scores(published_at);
CREATE INDEX IF NOT EXISTS idx_event_news_scores_relevance ON event_news_scores(relevance_score);
