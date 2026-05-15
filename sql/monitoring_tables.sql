-- Production Monitoring Tables for SKCS Master Rulebook
-- Provides visibility into system performance and rule compliance

-- 1. Prediction Request Log Table
CREATE TABLE IF NOT EXISTS prediction_request_log (
    id BIGSERIAL PRIMARY KEY,
    match_id TEXT NOT NULL,
    user_id TEXT,
    main_confidence NUMERIC(5,2),
    main_risk_tier VARCHAR(20),
    fallback_used BOOLEAN DEFAULT FALSE,
    secondary_count INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    api_version VARCHAR(10) DEFAULT 'v1',
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prediction_log_created_at 
ON prediction_request_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prediction_log_fallback 
ON prediction_request_log (fallback_used, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prediction_log_match_id 
ON prediction_request_log (match_id, created_at DESC);

-- 2. ACCA Build Log Table
CREATE TABLE IF NOT EXISTS acca_build_log (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT,
    leg_count INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'success', 'rejected', 'error'
    rejection_reason VARCHAR(50), -- 'confidence_below_minimum', 'correlation', 'volatile_market', 'too_many_legs'
    max_correlation_found NUMERIC(3,2),
    min_confidence_found NUMERIC(5,2),
    total_confidence_avg NUMERIC(5,2),
    combined_odds NUMERIC(10,4),
    response_time_ms INTEGER,
    api_version VARCHAR(10) DEFAULT 'v1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ACCA monitoring
CREATE INDEX IF NOT EXISTS idx_acca_log_created_at 
ON acca_build_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_acca_log_status 
ON acca_build_log (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_acca_log_rejection 
ON acca_build_log (rejection_reason, created_at DESC);

-- 3. System Performance Metrics Table
CREATE TABLE IF NOT EXISTS system_performance_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(50) NOT NULL,
    metric_value NUMERIC(10,4),
    metric_unit VARCHAR(20),
    tags JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for metrics
CREATE INDEX IF NOT EXISTS idx_metrics_name_created 
ON system_performance_metrics (metric_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_metrics_tags 
ON system_performance_metrics USING GIN (tags);

-- 4. Risk Tier Distribution Daily Snapshot
CREATE TABLE IF NOT EXISTS risk_tier_daily_snapshot (
    id BIGSERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    risk_tier VARCHAR(20) NOT NULL,
    prediction_count INTEGER NOT NULL,
    total_confidence_sum NUMERIC(10,2),
    avg_confidence NUMERIC(5,2),
    sport VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for daily snapshots
CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_tier_snapshot_unique 
ON risk_tier_daily_snapshot (snapshot_date, risk_tier, COALESCE(sport, 'all'));

-- 5. Safe Haven Performance Table
CREATE TABLE IF NOT EXISTS safe_haven_performance (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    total_predictions INTEGER NOT NULL,
    safe_haven_triggered INTEGER NOT NULL,
    safe_haven_provided INTEGER NOT NULL,
    safe_haven_empty INTEGER NOT NULL,
    avg_main_confidence NUMERIC(5,2),
    avg_safe_haven_confidence NUMERIC(5,2),
    success_rate NUMERIC(5,2), -- percentage of cases where safe haven provided alternatives
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for daily safe haven stats
CREATE UNIQUE INDEX IF NOT EXISTS idx_safe_haven_daily_unique 
ON safe_haven_performance (date);

-- 6. Market Correlation Usage Table
CREATE TABLE IF NOT EXISTS market_correlation_usage (
    id BIGSERIAL PRIMARY KEY,
    market_a VARCHAR(50) NOT NULL,
    market_b VARCHAR(50) NOT NULL,
    correlation_value NUMERIC(3,2) NOT NULL,
    usage_count INTEGER DEFAULT 1,
    last_used TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for market pairs
CREATE UNIQUE INDEX IF NOT EXISTS idx_correlation_usage_unique 
ON market_correlation_usage (market_a, market_b);

-- 7. Trigger Performance Log Table
CREATE TABLE IF NOT EXISTS trigger_performance_log (
    id BIGSERIAL PRIMARY KEY,
    trigger_name VARCHAR(50) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    operation VARCHAR(10) NOT NULL, -- 'INSERT', 'UPDATE'
    execution_time_ms INTEGER,
    rows_affected INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for trigger performance
CREATE INDEX IF NOT EXISTS idx_trigger_perf_created_at 
ON trigger_performance_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trigger_perf_name 
ON trigger_performance_log (trigger_name, created_at DESC);

-- 8. User Behavior Analytics Table
CREATE TABLE IF NOT EXISTS user_behavior_analytics (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT,
    action VARCHAR(50) NOT NULL, -- 'view_predictions', 'build_acca', 'use_safe_haven'
    action_details JSONB,
    session_id VARCHAR(100),
    conversion_step INTEGER, -- where user dropped off in funnel
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user behavior
CREATE INDEX IF NOT EXISTS idx_user_behavior_user 
ON user_behavior_analytics (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_behavior_action 
ON user_behavior_analytics (action, created_at DESC);

-- Comments for documentation
COMMENT ON TABLE prediction_request_log IS 'Logs every prediction API request for monitoring and analytics';
COMMENT ON TABLE acca_build_log IS 'Logs ACCA build attempts with success/failure details';
COMMENT ON TABLE system_performance_metrics IS 'General system performance metrics collection';
COMMENT ON TABLE risk_tier_daily_snapshot IS 'Daily snapshot of risk tier distribution';
COMMENT ON TABLE safe_haven_performance IS 'Daily Safe Haven fallback performance metrics';
COMMENT ON TABLE market_correlation_usage IS 'Tracks which market correlations are most frequently checked';
COMMENT ON TABLE trigger_performance_log IS 'Monitors trigger execution performance';
COMMENT ON TABLE user_behavior_analytics IS 'Tracks user interactions for UX optimization';

-- Function to update market correlation usage
CREATE OR REPLACE FUNCTION update_correlation_usage(
    market_a TEXT,
    market_b TEXT,
    correlation NUMERIC
) RETURNS VOID AS $$
BEGIN
    INSERT INTO market_correlation_usage (market_a, market_b, correlation_value, usage_count)
    VALUES (market_a, market_b, correlation, 1)
    ON CONFLICT (market_a, market_b) 
    DO UPDATE SET 
        usage_count = market_correlation_usage.usage_count + 1,
        last_used = NOW(),
        correlation_value = EXCLUDED.correlation_value;
END;
$$ LANGUAGE plpgsql;

-- Function to log prediction request
CREATE OR REPLACE FUNCTION log_prediction_request(
    p_match_id TEXT,
    p_user_id TEXT DEFAULT NULL,
    p_main_confidence NUMERIC DEFAULT NULL,
    p_main_risk_tier VARCHAR DEFAULT NULL,
    p_fallback_used BOOLEAN DEFAULT FALSE,
    p_secondary_count INTEGER DEFAULT 0,
    p_response_time_ms INTEGER DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO prediction_request_log (
        match_id, user_id, main_confidence, main_risk_tier, 
        fallback_used, secondary_count, response_time_ms
    ) VALUES (
        p_match_id, p_user_id, p_main_confidence, p_main_risk_tier,
        p_fallback_used, p_secondary_count, p_response_time_ms
    );
END;
$$ LANGUAGE plpgsql;

-- Function to log ACCA build attempt
CREATE OR REPLACE FUNCTION log_acca_build(
    p_user_id TEXT DEFAULT NULL,
    p_leg_count INTEGER,
    p_status VARCHAR,
    p_rejection_reason VARCHAR DEFAULT NULL,
    p_max_correlation NUMERIC DEFAULT NULL,
    p_min_confidence NUMERIC DEFAULT NULL,
    p_total_confidence_avg NUMERIC DEFAULT NULL,
    p_combined_odds NUMERIC DEFAULT NULL,
    p_response_time_ms INTEGER DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO acca_build_log (
        user_id, leg_count, status, rejection_reason, max_correlation_found,
        min_confidence_found, total_confidence_avg, combined_odds, response_time_ms
    ) VALUES (
        p_user_id, p_leg_count, p_status, p_rejection_reason, p_max_correlation,
        p_min_confidence, p_total_confidence_avg, p_combined_odds, p_response_time_ms
    );
END;
$$ LANGUAGE plpgsql;

-- Function to create daily risk tier snapshot
CREATE OR REPLACE FUNCTION create_risk_tier_snapshot(target_date DATE DEFAULT CURRENT_DATE) RETURNS VOID AS $$
BEGIN
    INSERT INTO risk_tier_daily_snapshot (snapshot_date, risk_tier, prediction_count, total_confidence_sum, avg_confidence)
    SELECT 
        target_date,
        risk_tier,
        COUNT(*),
        SUM(confidence),
        ROUND(AVG(confidence), 2)
    FROM direct1x2_prediction_final
    WHERE DATE(created_at) = target_date
      AND is_published = true
      AND market_type = '1X2'
    GROUP BY risk_tier
    ON CONFLICT (snapshot_date, risk_tier, COALESCE(sport, 'all')) 
    DO UPDATE SET
        prediction_count = EXCLUDED.prediction_count,
        total_confidence_sum = EXCLUDED.total_confidence_sum,
        avg_confidence = EXCLUDED.avg_confidence;
END;
$$ LANGUAGE plpgsql;

-- Function to create daily safe haven performance snapshot
CREATE OR REPLACE FUNCTION create_safe_haven_snapshot(target_date DATE DEFAULT CURRENT_DATE) RETURNS VOID AS $$
DECLARE
    total_pred INTEGER;
    fallback_triggered INTEGER;
    fallback_provided INTEGER;
    fallback_empty INTEGER;
    avg_main_conf NUMERIC;
    avg_safe_conf NUMERIC;
    success_rate NUMERIC;
BEGIN
    -- Get totals from prediction log
    SELECT 
        COUNT(*),
        SUM(CASE WHEN fallback_used THEN 1 ELSE 0 END),
        SUM(CASE WHEN fallback_used AND secondary_count > 0 THEN 1 ELSE 0 END),
        SUM(CASE WHEN fallback_used AND secondary_count = 0 THEN 1 ELSE 0 END),
        ROUND(AVG(main_confidence), 2)
    INTO total_pred, fallback_triggered, fallback_provided, fallback_empty, avg_main_conf
    FROM prediction_request_log
    WHERE DATE(created_at) = target_date;
    
    -- Calculate success rate
    success_rate = CASE 
        WHEN fallback_triggered > 0 THEN 
            ROUND((fallback_provided::NUMERIC / fallback_triggered::NUMERIC) * 100, 2)
        ELSE 0 
    END;
    
    -- Get average safe haven confidence
    SELECT ROUND(AVG(main_confidence), 2)
    INTO avg_safe_conf
    FROM prediction_request_log
    WHERE DATE(created_at) = target_date
      AND fallback_used = true
      AND secondary_count > 0;
    
    -- Insert snapshot
    INSERT INTO safe_haven_performance (
        date, total_predictions, safe_haven_triggered, safe_haven_provided, 
        safe_haven_empty, avg_main_confidence, avg_safe_haven_confidence, success_rate
    ) VALUES (
        target_date, total_pred, fallback_triggered, fallback_provided,
        fallback_empty, avg_main_conf, avg_safe_conf, success_rate
    )
    ON CONFLICT (date)
    DO UPDATE SET
        total_predictions = EXCLUDED.total_predictions,
        safe_haven_triggered = EXCLUDED.safe_haven_triggered,
        safe_haven_provided = EXCLUDED.safe_haven_provided,
        safe_haven_empty = EXCLUDED.safe_haven_empty,
        avg_main_confidence = EXCLUDED.avg_main_confidence,
        avg_safe_haven_confidence = EXCLUDED.avg_safe_haven_confidence,
        success_rate = EXCLUDED.success_rate;
END;
$$ LANGUAGE plpgsql;
