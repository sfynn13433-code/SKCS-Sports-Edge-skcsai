-- SKCS AI Sports Edge Pipeline - Supabase Schema
-- This schema supports the reconstructed data pipeline with JSONB for flexibility

-- 1. Raw Fixtures (Discovery Layer)
-- Stores raw fixture data from TheSportsDB API
CREATE TABLE IF NOT EXISTS raw_fixtures (
    id_event TEXT PRIMARY KEY,
    sport TEXT NOT NULL,
    league_id TEXT,
    home_team_id TEXT,
    away_team_id TEXT,
    start_time TIMESTAMPTZ,
    raw_json JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_raw_fixtures_start_time ON raw_fixtures(start_time);
CREATE INDEX IF NOT EXISTS idx_raw_fixtures_sport ON raw_fixtures(sport);

-- 2. Match Context (Deep Insight Layer)
-- Stores enriched match data: lineups, stats, timeline, recent form
CREATE TABLE IF NOT EXISTS match_context_data (
    id_event TEXT PRIMARY KEY REFERENCES raw_fixtures(id_event) ON DELETE CASCADE,
    lineups JSONB,
    stats JSONB,
    timeline JSONB,
    home_last_5 JSONB,
    away_last_5 JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. AI Predictions (The UI Payload)
-- Stores final AI-generated insights for the frontend modal
CREATE TABLE IF NOT EXISTS ai_predictions (
    match_id TEXT PRIMARY KEY REFERENCES raw_fixtures(id_event) ON DELETE CASCADE,
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    edgemind_feedback TEXT,
    value_combos JSONB,
    same_match_builder JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for quick match lookup by ID
CREATE INDEX IF NOT EXISTS idx_ai_predictions_match_id ON ai_predictions(match_id);
