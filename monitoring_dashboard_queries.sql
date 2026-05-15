-- Production Monitoring Dashboard Queries for SKCS Master Rulebook
-- Comprehensive SQL queries for production monitoring and analytics

-- ============================================================================
-- 1. SAFE HAVEN FALLBACK MONITORING
-- ============================================================================

-- 1.1 Daily Safe Haven Performance Trend
SELECT 
    date,
    total_predictions,
    safe_haven_triggered,
    safe_haven_provided,
    safe_haven_empty,
    ROUND(safe_haven_triggered::NUMERIC / NULLIF(total_predictions, 0) * 100, 2) AS trigger_rate_pct,
    ROUND(safe_haven_provided::NUMERIC / NULLIF(safe_haven_triggered, 0) * 100, 2) AS success_rate_pct,
    avg_main_confidence,
    avg_safe_haven_confidence,
    ROUND(avg_safe_haven_confidence - avg_main_confidence, 2) AS avg_confidence_lift
FROM safe_haven_performance
ORDER BY date DESC
LIMIT 30;

-- 1.2 Safe Haven Trigger Rate by Risk Tier
SELECT 
    DATE(created_at) AS date,
    main_risk_tier,
    COUNT(*) AS total_requests,
    SUM(CASE WHEN fallback_used THEN 1 ELSE 0 END) AS fallback_count,
    ROUND(SUM(CASE WHEN fallback_used THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS fallback_pct,
    AVG(main_confidence) AS avg_confidence
FROM prediction_request_log
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), main_risk_tier
ORDER BY date DESC, main_risk_tier;

-- 1.3 Safe Haven Empty Cases (Critical Alert)
SELECT 
    DATE(created_at) AS date,
    COUNT(*) AS empty_fallback_cases,
    AVG(main_confidence) AS avg_main_confidence,
    MAX(main_confidence) AS max_main_confidence,
    MIN(main_confidence) AS min_main_confidence
FROM prediction_request_log
WHERE fallback_used = true 
  AND secondary_count = 0
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================================================
-- 2. RISK TIER DISTRIBUTION MONITORING
-- ============================================================================

-- 2.1 Daily Risk Tier Distribution
SELECT 
    date,
    risk_tier,
    prediction_count,
    ROUND(prediction_count * 100.0 / SUM(prediction_count) OVER (PARTITION BY date), 2) AS pct_of_total,
    avg_confidence
FROM risk_tier_daily_snapshot
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC, risk_tier;

-- 2.2 Risk Tier vs Safe Haven Usage
SELECT 
    main_risk_tier,
    COUNT(*) AS total_predictions,
    SUM(CASE WHEN fallback_used THEN 1 ELSE 0 END) AS fallback_count,
    ROUND(SUM(CASE WHEN fallback_used THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS fallback_pct,
    AVG(secondary_count) AS avg_secondary_count,
    AVG(main_confidence) AS avg_confidence
FROM prediction_request_log
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY main_risk_tier
ORDER BY fallback_pct DESC;

-- 2.3 Risk Tier Performance by Sport (if sport data available)
SELECT 
    sport,
    risk_tier,
    COUNT(*) AS prediction_count,
    AVG(confidence) AS avg_confidence,
    MIN(confidence) AS min_confidence,
    MAX(confidence) AS max_confidence
FROM direct1x2_prediction_final
WHERE is_published = true
  AND market_type = '1X2'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY sport, risk_tier
ORDER BY sport, prediction_count DESC;

-- ============================================================================
-- 3. ACCA BUILD MONITORING
-- ============================================================================

-- 3.1 ACCA Build Success Rate by Day
SELECT 
    DATE(created_at) AS date,
    COUNT(*) AS total_attempts,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successful_builds,
    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_builds,
    ROUND(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS success_rate_pct,
    AVG(leg_count) AS avg_leg_count,
    AVG(response_time_ms) AS avg_response_time
FROM acca_build_log
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 3.2 ACCA Rejection Reasons Breakdown
SELECT 
    rejection_reason,
    COUNT(*) AS rejection_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS pct_of_rejections,
    AVG(leg_count) AS avg_leg_count,
    AVG(min_confidence_found) AS avg_min_confidence,
    AVG(max_correlation_found) AS avg_max_correlation
FROM acca_build_log
WHERE status = 'rejected'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY rejection_reason
ORDER BY rejection_count DESC;

-- 3.3 Correlation Conflict Analysis
SELECT 
    DATE(created_at) AS date,
    COUNT(*) FILTER (WHERE status = 'rejected' AND rejection_reason = 'correlation') AS correlation_rejections,
    COUNT(*) AS total_attempts,
    ROUND(COUNT(*) FILTER (WHERE status = 'rejected' AND rejection_reason = 'correlation') * 100.0 / COUNT(*), 2) AS correlation_rejection_rate,
    AVG(max_correlation_found) FILTER (WHERE rejection_reason = 'correlation') AS avg_conflict_correlation
FROM acca_build_log
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 3.4 Most Problematic Market Pairs (High Correlation Conflicts)
SELECT 
    mc.market_a,
    mc.market_b,
    mc.correlation_value,
    mc.usage_count,
    COUNT(abl.id) FILTER (WHERE abl.rejection_reason = 'correlation') AS conflict_count,
    ROUND(COUNT(abl.id) FILTER (WHERE abl.rejection_reason = 'correlation') * 100.0 / mc.usage_count, 2) AS conflict_rate_pct
FROM market_correlation_usage mc
LEFT JOIN acca_build_log abl ON abl.rejection_reason = 'correlation'
WHERE mc.correlation_value > 0.5
  AND mc.last_used >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY mc.market_a, mc.market_b, mc.correlation_value, mc.usage_count
ORDER BY conflict_count DESC, conflict_rate_pct DESC
LIMIT 20;

-- ============================================================================
-- 4. SYSTEM PERFORMANCE MONITORING
-- ============================================================================

-- 4.1 API Response Time Trends
SELECT 
    DATE(created_at) AS date,
    'predictions' AS endpoint_type,
    COUNT(*) AS request_count,
    ROUND(AVG(response_time_ms), 2) AS avg_response_time_ms,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_ms), 2) AS median_response_time_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms), 2) AS p95_response_time_ms,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms), 2) AS p99_response_time_ms
FROM prediction_request_log
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
UNION ALL
SELECT 
    DATE(created_at) AS date,
    'acca_build' AS endpoint_type,
    COUNT(*) AS request_count,
    ROUND(AVG(response_time_ms), 2) AS avg_response_time_ms,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_ms), 2) AS median_response_time_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms), 2) AS p95_response_time_ms,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms), 2) AS p99_response_time_ms
FROM acca_build_log
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC, endpoint_type;

-- 4.2 Trigger Performance Monitoring
SELECT 
    DATE(created_at) AS date,
    trigger_name,
    COUNT(*) AS executions,
    ROUND(AVG(execution_time_ms), 2) AS avg_execution_time_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms), 2) AS p95_execution_time_ms,
    SUM(CASE WHEN success = false THEN 1 ELSE 0 END) AS failure_count,
    ROUND(SUM(CASE WHEN success = false THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS failure_rate_pct
FROM trigger_performance_log
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at), trigger_name
ORDER BY date DESC, failure_count DESC;

-- 4.3 Database Connection and Query Performance
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_live_tup,
    n_dead_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND (n_live_tup > 1000 OR seq_scan > 100 OR idx_scan > 100)
ORDER BY n_live_tup DESC;

-- ============================================================================
-- 5. USER BEHAVIOR ANALYTICS
-- ============================================================================

-- 5.1 User Engagement Funnel
SELECT 
    action,
    COUNT(DISTINCT user_id) AS unique_users,
    COUNT(*) AS total_actions,
    AVG(CASE WHEN action_details->>'success' = 'true' THEN 1 ELSE 0 END) AS success_rate
FROM user_behavior_analytics
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY action
ORDER BY unique_users DESC;

-- 5.2 Safe Haven Usage by User Segment
SELECT 
    CASE 
        WHEN COUNT(DISTINCT user_id) <= 10 THEN 'Light Users (≤10 actions)'
        WHEN COUNT(DISTINCT user_id) <= 50 THEN 'Medium Users (11-50 actions)'
        ELSE 'Heavy Users (>50 actions)'
    END AS user_segment,
    COUNT(*) AS total_predictions,
    SUM(CASE WHEN action_details->>'fallback_used' = 'true' THEN 1 ELSE 0 END) AS fallback_count,
    ROUND(SUM(CASE WHEN action_details->>'fallback_used' = 'true' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS fallback_pct
FROM user_behavior_analytics
WHERE action = 'view_predictions'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY user_segment
ORDER BY total_predictions DESC;

-- 5.3 ACCA Building Patterns
SELECT 
    DATE(created_at) AS date,
    COUNT(DISTINCT user_id) AS unique_builders,
    COUNT(*) AS total_build_attempts,
    SUM(CASE WHEN action_details->>'success' = 'true' THEN 1 ELSE 0 END) AS successful_builds,
    ROUND(AVG((action_details->>'leg_count')::INTEGER), 2) AS avg_leg_count,
    ROUND(AVG((action_details->>'response_time_ms')::INTEGER), 2) AS avg_response_time
FROM user_behavior_analytics
WHERE action = 'build_acca'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================================================
-- 6. BUSINESS METRICS DASHBOARD
-- ============================================================================

-- 6.1 Daily Business Overview
WITH daily_stats AS (
    SELECT 
        DATE(prl.created_at) AS date,
        COUNT(DISTINCT prl.user_id) AS active_users,
        COUNT(*) AS total_predictions,
        SUM(CASE WHEN prl.fallback_used THEN 1 ELSE 0 END) AS fallback_count,
        COUNT(DISTINCT CASE WHEN abl.status = 'success' THEN abl.user_id END) AS acca_builders,
        COUNT(DISTINCT CASE WHEN abl.status = 'success' THEN abl.id END) AS successful_accas
    FROM prediction_request_log prl
    LEFT JOIN acca_build_log abl ON DATE(abl.created_at) = DATE(prl.created_at)
    WHERE prl.created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE(prl.created_at)
)
SELECT 
    date,
    active_users,
    total_predictions,
    ROUND(fallback_count::NUMERIC / NULLIF(total_predictions, 0) * 100, 2) AS fallback_rate_pct,
    acca_builders,
    successful_accas,
    ROUND(successful_accas::NUMERIC / NULLIF(active_users, 0), 2) AS accas_per_user,
    ROUND(total_predictions::NUMERIC / NULLIF(active_users, 0), 2) AS predictions_per_user
FROM daily_stats
ORDER BY date DESC;

-- 6.2 Risk Tier Revenue Impact (if subscription data available)
SELECT 
    main_risk_tier,
    COUNT(DISTINCT user_id) AS unique_users,
    COUNT(*) AS prediction_count,
    -- This would need to be joined with subscription data
    -- SUM(CASE WHEN subscription_tier = 'vip' THEN 1 ELSE 0 END) AS vip_users
    ROUND(AVG(main_confidence), 2) AS avg_confidence,
    ROUND(AVG(secondary_count), 2) AS avg_secondary_count
FROM prediction_request_log
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY main_risk_tier
ORDER BY prediction_count DESC;

-- ============================================================================
-- 7. ALERT QUERIES (for automated monitoring)
-- ============================================================================

-- 7.1 Critical: Safe Haven Empty Rate > 5%
WITH daily_empty_rate AS (
    SELECT 
        DATE(created_at) AS date,
        COUNT(*) FILTER (WHERE fallback_used = true AND secondary_count = 0) AS empty_count,
        COUNT(*) FILTER (WHERE fallback_used = true) AS total_fallbacks
    FROM prediction_request_log
    WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
    GROUP BY DATE(created_at)
)
SELECT 
    date,
    empty_count,
    total_fallbacks,
    ROUND(empty_count::NUMERIC / NULLIF(total_fallbacks, 0) * 100, 2) AS empty_rate_pct
FROM daily_empty_rate
WHERE total_fallbacks > 0
  AND (empty_count::NUMERIC / NULLIF(total_fallbacks, 0)) > 0.05;

-- 7.2 Critical: ACCA Success Rate < 80%
SELECT 
    DATE(created_at) AS date,
    COUNT(*) AS total_attempts,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successful_builds,
    ROUND(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS success_rate_pct
FROM acca_build_log
WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
GROUP BY DATE(created_at)
HAVING (SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) < 80;

-- 7.3 Critical: API Response Time P95 > 1000ms
SELECT 
    DATE(created_at) AS date,
    'predictions' AS endpoint,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms), 2) AS p95_response_time_ms
FROM prediction_request_log
WHERE created_at >= CURRENT_DATE - INTERVAL '1 hour'
GROUP BY DATE(created_at)
HAVING PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) > 1000
UNION ALL
SELECT 
    DATE(created_at) AS date,
    'acca_build' AS endpoint,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms), 2) AS p95_response_time_ms
FROM acca_build_log
WHERE created_at >= CURRENT_DATE - INTERVAL '1 hour'
GROUP BY DATE(created_at)
HAVING PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) > 1000;

-- ============================================================================
-- 8. DATA QUALITY MONITORING
-- ============================================================================

-- 8.1 Data Consistency Checks
SELECT 
    'risk_tier_consistency' AS check_name,
    COUNT(*) AS total_records,
    SUM(CASE WHEN 
        (confidence >= 75 AND risk_tier = 'LOW_RISK') OR
        (confidence >= 55 AND confidence < 75 AND risk_tier = 'MEDIUM_RISK') OR
        (confidence >= 30 AND confidence < 55 AND risk_tier = 'HIGH_RISK') OR
        (confidence < 30 AND risk_tier = 'EXTREME_RISK')
        THEN 1 ELSE 0 END
    ) AS consistent_records,
    COUNT(*) - SUM(CASE WHEN 
        (confidence >= 75 AND risk_tier = 'LOW_RISK') OR
        (confidence >= 55 AND confidence < 75 AND risk_tier = 'MEDIUM_RISK') OR
        (confidence >= 30 AND confidence < 55 AND risk_tier = 'HIGH_RISK') OR
        (confidence < 30 AND risk_tier = 'EXTREME_RISK')
        THEN 1 ELSE 0 END
    ) AS inconsistent_records
FROM direct1x2_prediction_final
WHERE is_published = true
  AND market_type = '1X2'

UNION ALL

SELECT 
    'secondary_limit_compliance' AS check_name,
    COUNT(*) AS total_matches,
    SUM(CASE WHEN secondary_count <= 4 THEN 1 ELSE 0 END) AS compliant_matches,
    SUM(CASE WHEN secondary_count > 4 THEN 1 ELSE 0 END) AS non_compliant_matches
FROM (
    SELECT 
        match_id,
        COUNT(*) FILTER (WHERE market_type != '1X2') AS secondary_count
    FROM direct1x2_prediction_final
    WHERE is_published = true
    GROUP BY match_id
) secondary_counts;

-- 8.2 Missing Data Alerts
SELECT 
    'missing_edgemind_report' AS issue,
    COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM direct1x2_prediction_final WHERE is_published = true), 2) AS pct_of_total
FROM direct1x2_prediction_final
WHERE is_published = true
  AND (edgemind_report IS NULL OR edgemind_report = '')

UNION ALL

SELECT 
    'invalid_confidence_range' AS issue,
    COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM direct1x2_prediction_final WHERE is_published = true), 2) AS pct_of_total
FROM direct1x2_prediction_final
WHERE is_published = true
  AND (confidence < 0 OR confidence > 100);

-- ============================================================================
-- 9. PERFORMANCE OPTIMIZATION MONITORING
-- ============================================================================

-- 9.1 Index Usage Analysis
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid::regclass)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan > 0
ORDER BY idx_scan DESC;

-- 9.2 Query Performance Analysis
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE query LIKE '%prediction%' OR query LIKE '%acca%'
ORDER BY total_time DESC
LIMIT 20;
