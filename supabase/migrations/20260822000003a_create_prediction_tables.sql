-- ============================================================================
-- Step 1: Create Normalized Prediction Tables (Tables Only)
-- ============================================================================

-- prediction_core table
CREATE TABLE IF NOT EXISTS prediction_core (
    id BIGSERIAL PRIMARY KEY,
    fixture_id TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    sport TEXT NOT NULL,
    market_type TEXT NOT NULL,
    prediction TEXT NOT NULL,
    confidence NUMERIC NOT NULL CHECK (confidence BETWEEN 0 AND 100),
    match_date TIMESTAMPTZ NOT NULL,
    risk_tier risk_tier_enum NOT NULL,
    matches JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- prediction_publication table
CREATE TABLE IF NOT EXISTS prediction_publication (
    id BIGSERIAL PRIMARY KEY,
    prediction_id BIGINT NOT NULL REFERENCES prediction_core(id) ON DELETE CASCADE,
    plan_visibility JSONB NOT NULL DEFAULT '[]'::JSONB,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (prediction_id)
);

-- prediction_insights table
CREATE TABLE IF NOT EXISTS prediction_insights (
    id BIGSERIAL PRIMARY KEY,
    prediction_id BIGINT NOT NULL REFERENCES prediction_core(id) ON DELETE CASCADE,
    edgemind_report TEXT,
    secondary_insights JSONB NOT NULL DEFAULT '[]'::JSONB,
    recommendation TEXT,
    analysis_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (prediction_id)
);

-- prediction_metadata table
CREATE TABLE IF NOT EXISTS prediction_metadata (
    id BIGSERIAL PRIMARY KEY,
    prediction_id BIGINT NOT NULL REFERENCES prediction_core(id) ON DELETE CASCADE,
    publish_run_id BIGINT REFERENCES prediction_publish_runs(id) ON DELETE SET NULL,
    tier TEXT NOT NULL CHECK (tier IN ('normal', 'deep')),
    type TEXT NOT NULL CHECK (type IN ('single', 'acca', 'direct', 'secondary', 'multi', 'same_match', 'acca_6match', 'mega_acca_12')),
    total_confidence NUMERIC NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('safe', 'medium')),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (prediction_id)
);

COMMENT ON TABLE prediction_core IS 'Core prediction data: fixture, teams, prediction, confidence, risk tier.';
COMMENT ON TABLE prediction_publication IS 'Frontend visibility settings: plan_visibility, expires_at, is_active status.';
COMMENT ON TABLE prediction_insights IS 'Textual insights: edgemind_report, secondary_insights, recommendation, analysis_summary.';
COMMENT ON TABLE prediction_metadata IS 'System metadata: publish_run_id, tier, type, total_confidence, risk_level, metadata.';
