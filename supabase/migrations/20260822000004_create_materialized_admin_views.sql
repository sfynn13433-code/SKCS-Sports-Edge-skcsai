-- ============================================================================
-- Materialized Views for Admin Analytics
-- ============================================================================
-- This migration creates materialized views for heavy admin analytics queries.
-- Materialized views provide:
-- - Faster query performance (pre-computed results)
-- - Reduced load on base tables
-- - Consistent snapshot data for dashboards
-- ============================================================================

-- ============================================================================
-- 1. Materialized Pipeline Health View
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_admin_pipeline_health AS
SELECT
    sport,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE ingestion_completed_at IS NULL) AS ingestion_pending,
    COUNT(*) FILTER (WHERE enrichment_completed_at IS NULL AND ingestion_completed_at IS NOT NULL) AS enrichment_pending,
    COUNT(*) FILTER (WHERE ai_completed_at IS NULL AND enrichment_completed_at IS NOT NULL) AS ai_pending,
    COUNT(*) FILTER (WHERE publication_completed_at IS NULL AND ai_completed_at IS NOT NULL) AS publication_pending,
    COUNT(*) FILTER (WHERE suppression_reason IS NOT NULL) AS suppressed,
    COUNT(*) FILTER (WHERE failure_reason IS NOT NULL) AS failed,
    MAX(created_at) AS last_activity,
    NOW() AS refreshed_at
FROM fixture_processing_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY sport
WITH DATA;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_admin_pipeline_health_sport 
    ON mv_admin_pipeline_health(sport);

-- ============================================================================
-- 2. Materialized Daily Volume View
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_admin_daily_volume AS
SELECT
    DATE(created_at) AS processing_date,
    sport,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE publication_completed_at IS NOT NULL) AS published,
    COUNT(*) FILTER (WHERE suppression_reason IS NOT NULL) AS suppressed,
    COUNT(*) FILTER (WHERE failure_reason IS NOT NULL) AS failed,
    ROUND(100.0 * COUNT(*) FILTER (WHERE publication_completed_at IS NOT NULL) / COUNT(*), 1) AS success_rate,
    NOW() AS refreshed_at
FROM fixture_processing_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), sport
ORDER BY processing_date DESC, sport
WITH DATA;

-- Create index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_mv_admin_daily_volume_date 
    ON mv_admin_daily_volume(processing_date DESC);

-- ============================================================================
-- 3. Materialized AI Suppression View
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_admin_ai_suppression AS
SELECT
    sport,
    COUNT(*) AS total_predictions,
    COUNT(*) FILTER (WHERE suppression_reason IS NOT NULL) AS suppressed,
    ROUND(100.0 * COUNT(*) FILTER (WHERE suppression_reason IS NOT NULL) / COUNT(*), 1) AS suppression_pct,
    NOW() AS refreshed_at
FROM fixture_processing_log
WHERE publication_completed_at IS NOT NULL OR suppression_reason IS NOT NULL
GROUP BY sport
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_admin_ai_suppression_sport 
    ON mv_admin_ai_suppression(sport);

-- ============================================================================
-- 4. Materialized Suppression Reasons View
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_admin_suppression_reasons AS
SELECT
    sport,
    suppression_reason,
    COUNT(*) AS count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY sport), 1) AS percentage,
    NOW() AS refreshed_at
FROM fixture_processing_log
WHERE suppression_reason IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY sport, suppression_reason
ORDER BY sport, count DESC
WITH DATA;

CREATE INDEX IF NOT EXISTS idx_mv_admin_suppression_reasons_sport 
    ON mv_admin_suppression_reasons(sport);

-- ============================================================================
-- 5. Materialized Processing Times View
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_admin_processing_times AS
SELECT
    sport,
    AVG(EXTRACT(EPOCH FROM (enrichment_completed_at - ingestion_completed_at))/60) AS avg_enrichment_minutes,
    AVG(EXTRACT(EPOCH FROM (ai_completed_at - enrichment_completed_at))/60) AS avg_ai_minutes,
    AVG(EXTRACT(EPOCH FROM (publication_completed_at - ai_completed_at))/60) AS avg_publication_minutes,
    AVG(EXTRACT(EPOCH FROM (publication_completed_at - ingestion_completed_at))/60) AS avg_total_minutes,
    COUNT(*) AS sample_size,
    NOW() AS refreshed_at
FROM fixture_processing_log
WHERE ingestion_completed_at IS NOT NULL
  AND enrichment_completed_at IS NOT NULL
  AND ai_completed_at IS NOT NULL
  AND publication_completed_at IS NOT NULL
  AND failure_reason IS NULL
GROUP BY sport
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_admin_processing_times_sport 
    ON mv_admin_processing_times(sport);

-- ============================================================================
-- 6. Materialized Odds Volatility View
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_admin_odds_volatility AS
SELECT
    eos.id_event,
    r.sport,
    COUNT(*) AS snapshot_count,
    MIN(eos.snapshot_at) AS first_snapshot,
    MAX(eos.snapshot_at) AS latest_snapshot,
    NOW() - MAX(eos.snapshot_at) AS hours_since_latest,
    CASE 
        WHEN COUNT(*) > 1 THEN
            STDDEV(
                (eos.odds->>'home_win')::NUMERIC
            )
        ELSE NULL
    END AS home_win_volatility,
    NOW() AS refreshed_at
FROM event_odds_snapshots eos
JOIN raw_fixtures r ON eos.id_event = r.id_event
WHERE eos.snapshot_at > NOW() - INTERVAL '24 hours'
  AND r.start_time > NOW()
GROUP BY eos.id_event, r.sport
ORDER BY hours_since_latest DESC
WITH DATA;

CREATE INDEX IF NOT EXISTS idx_mv_admin_odds_volatility_event 
    ON mv_admin_odds_volatility(id_event);

-- ============================================================================
-- 7. Materialized Bookmaker Odds Coverage View
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_admin_bookmaker_coverage AS
SELECT
    bo.bookmaker_key,
    cb.title AS bookmaker_title,
    COUNT(DISTINCT bo.id_event) AS events_covered,
    COUNT(DISTINCT bo.market_type) AS markets_offered,
    COUNT(*) AS total_odds,
    MAX(bo.snapshot_at) AS latest_odds_update,
    NOW() AS refreshed_at
FROM bookmaker_odds bo
JOIN canonical_bookmakers cb ON bo.bookmaker_key = cb.bookmaker_key
WHERE bo.snapshot_at > NOW() - INTERVAL '7 days'
GROUP BY bo.bookmaker_key, cb.title
ORDER BY events_covered DESC
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_admin_bookmaker_coverage_bookmaker 
    ON mv_admin_bookmaker_coverage(bookmaker_key);

-- ============================================================================
-- 8. Materialized Prediction Risk Distribution View
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_admin_risk_distribution AS
SELECT
    sport,
    risk_tier,
    COUNT(*) AS prediction_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY sport), 1) AS percentage,
    AVG(confidence) AS avg_confidence,
    MIN(confidence) AS min_confidence,
    MAX(confidence) AS max_confidence,
    NOW() AS refreshed_at
FROM prediction_core
WHERE match_date > NOW() - INTERVAL '30 days'
GROUP BY sport, risk_tier
ORDER BY sport, risk_tier
WITH DATA;

CREATE INDEX IF NOT EXISTS idx_mv_admin_risk_distribution_sport 
    ON mv_admin_risk_distribution(sport);

-- ============================================================================
-- 9. Refresh Functions
-- ============================================================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_admin_materialized_views()
RETURNS TABLE (
    view_name TEXT,
    status TEXT,
    refresh_time TIMESTAMPTZ
) AS $$
DECLARE
    v_view RECORD;
BEGIN
    FOR v_view IN 
        SELECT matviewname::TEXT 
        FROM pg_matviews 
        WHERE schemaname = 'public' 
          AND matviewname LIKE 'mv_admin_%'
    LOOP
        BEGIN
            EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', v_view.matviewname);
            RETURN QUERY SELECT v_view.matviewname, 'success'::TEXT, NOW()::TIMESTAMPTZ;
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT v_view.matviewname, 'failed: ' || SQLERRM::TEXT, NOW()::TIMESTAMPTZ;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh a specific materialized view
CREATE OR REPLACE FUNCTION refresh_admin_view(p_view_name TEXT)
RETURNS TEXT AS $$
DECLARE
    v_full_name TEXT := 'mv_admin_' || p_view_name;
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_matviews 
        WHERE schemaname = 'public' AND matviewname = v_full_name
    ) THEN
        EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', v_full_name);
        RETURN 'Success: ' || v_full_name;
    ELSE
        RETURN 'Error: View ' || v_full_name || ' does not exist';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. Grant permissions
-- ============================================================================

GRANT SELECT ON mv_admin_pipeline_health TO service_role;
GRANT SELECT ON mv_admin_daily_volume TO service_role;
GRANT SELECT ON mv_admin_ai_suppression TO service_role;
GRANT SELECT ON mv_admin_suppression_reasons TO service_role;
GRANT SELECT ON mv_admin_processing_times TO service_role;
GRANT SELECT ON mv_admin_odds_volatility TO service_role;
GRANT SELECT ON mv_admin_bookmaker_coverage TO service_role;
GRANT SELECT ON mv_admin_risk_distribution TO service_role;

GRANT EXECUTE ON FUNCTION refresh_admin_materialized_views() TO service_role;
GRANT EXECUTE ON FUNCTION refresh_admin_view(TEXT) TO service_role;

-- ============================================================================
-- 11. Add comments for documentation
-- ============================================================================

COMMENT ON MATERIALIZED VIEW mv_admin_pipeline_health IS 'Materialized view of pipeline health metrics. Refresh every 5-10 minutes.';
COMMENT ON MATERIALIZED VIEW mv_admin_daily_volume IS 'Materialized view of daily processing volume. Refresh hourly.';
COMMENT ON MATERIALIZED VIEW mv_admin_ai_suppression IS 'Materialized view of AI suppression rates. Refresh hourly.';
COMMENT ON MATERIALIZED VIEW mv_admin_suppression_reasons IS 'Materialized view of suppression reason breakdown. Refresh hourly.';
COMMENT ON MATERIALIZED VIEW mv_admin_processing_times IS 'Materialized view of processing time analytics. Refresh hourly.';
COMMENT ON MATERIALIZED VIEW mv_admin_odds_volatility IS 'Materialized view of odds volatility metrics. Refresh every 15 minutes.';
COMMENT ON MATERIALIZED VIEW mv_admin_bookmaker_coverage IS 'Materialized view of bookmaker odds coverage. Refresh hourly.';
COMMENT ON MATERIALIZED VIEW mv_admin_risk_distribution IS 'Materialized view of prediction risk tier distribution. Refresh hourly.';
COMMENT ON FUNCTION refresh_admin_materialized_views() IS 'Refreshes all admin materialized views concurrently. Call via pg_cron every 5-10 minutes.';
COMMENT ON FUNCTION refresh_admin_view(TEXT) IS 'Refreshes a specific admin materialized view by name suffix.';
