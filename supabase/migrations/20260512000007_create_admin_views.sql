-- Create admin intelligence dashboard views

-- 2.1 Pipeline Health View
CREATE OR REPLACE VIEW admin_pipeline_health AS
SELECT
  sport,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE ingestion_completed_at IS NULL) AS ingestion_pending,
  COUNT(*) FILTER (WHERE enrichment_completed_at IS NULL AND ingestion_completed_at IS NOT NULL) AS enrichment_pending,
  COUNT(*) FILTER (WHERE ai_completed_at IS NULL AND enrichment_completed_at IS NOT NULL) AS ai_pending,
  COUNT(*) FILTER (WHERE publication_completed_at IS NULL AND ai_completed_at IS NOT NULL) AS publication_pending,
  COUNT(*) FILTER (WHERE suppression_reason IS NOT NULL) AS suppressed,
  COUNT(*) FILTER (WHERE failure_reason IS NOT NULL) AS failed,
  MAX(created_at) AS last_activity
FROM fixture_processing_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY sport;

-- 2.2 Stale Odds Detection
CREATE OR REPLACE VIEW admin_stale_odds AS
SELECT
  mcd.id_event,
  r.sport,
  mcd.updated_at AS odds_last_updated,
  NOW() - mcd.updated_at AS staleness,
  r.start_time
FROM match_context_data mcd
JOIN raw_fixtures r ON mcd.id_event = r.id_event
WHERE mcd.odds IS NOT NULL
  AND NOW() - mcd.updated_at > INTERVAL '3 hours'
  AND r.start_time > NOW()  -- still upcoming
ORDER BY staleness DESC;

-- 2.3 Sync Status View
CREATE OR REPLACE VIEW admin_sync_status AS
SELECT
  ss.sport,
  ss.enabled,
  ss.last_sync_at,
  CASE
    WHEN ss.last_sync_at IS NULL THEN 'never'
    WHEN NOW() - ss.last_sync_at < INTERVAL '6 hours' THEN 'healthy'
    ELSE 'stale'
  END AS sync_health,
  (SELECT COUNT(*) FROM raw_fixtures WHERE sport = ss.sport AND start_time > NOW()) AS upcoming_events
FROM sport_sync ss;

-- 2.4 AI Suppression Rates
CREATE OR REPLACE VIEW admin_ai_suppression AS
SELECT
  sport,
  COUNT(*) AS total_predictions,
  COUNT(*) FILTER (WHERE suppression_reason IS NOT NULL) AS suppressed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE suppression_reason IS NOT NULL) / COUNT(*), 1) AS suppression_pct
FROM fixture_processing_log
WHERE publication_completed_at IS NOT NULL OR suppression_reason IS NOT NULL
GROUP BY sport;

-- Additional useful admin views

-- 2.5 Processing Time Analysis
CREATE OR REPLACE VIEW admin_processing_times AS
SELECT
  sport,
  AVG(EXTRACT(EPOCH FROM (enrichment_completed_at - ingestion_completed_at))/60) AS avg_enrichment_minutes,
  AVG(EXTRACT(EPOCH FROM (ai_completed_at - enrichment_completed_at))/60) AS avg_ai_minutes,
  AVG(EXTRACT(EPOCH FROM (publication_completed_at - ai_completed_at))/60) AS avg_publication_minutes,
  AVG(EXTRACT(EPOCH FROM (publication_completed_at - ingestion_completed_at))/60) AS avg_total_minutes,
  COUNT(*) AS sample_size
FROM fixture_processing_log
WHERE ingestion_completed_at IS NOT NULL
  AND enrichment_completed_at IS NOT NULL
  AND ai_completed_at IS NOT NULL
  AND publication_completed_at IS NOT NULL
  AND failure_reason IS NULL
GROUP BY sport;

-- 2.6 Recent Failures
CREATE OR REPLACE VIEW admin_recent_failures AS
SELECT
  id_event,
  sport,
  failure_reason,
  created_at,
  ingestion_completed_at,
  enrichment_completed_at,
  ai_completed_at,
  publication_completed_at
FROM fixture_processing_log
WHERE failure_reason IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 2.7 Suppression Reasons Analysis
CREATE OR REPLACE VIEW admin_suppression_reasons AS
SELECT
  sport,
  suppression_reason,
  COUNT(*) AS count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY sport), 1) AS percentage
FROM fixture_processing_log
WHERE suppression_reason IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY sport, suppression_reason
ORDER BY sport, count DESC;

-- 2.8 Daily Pipeline Volume
CREATE OR REPLACE VIEW admin_daily_volume AS
SELECT
  DATE(created_at) AS processing_date,
  sport,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE publication_completed_at IS NOT NULL) AS published,
  COUNT(*) FILTER (WHERE suppression_reason IS NOT NULL) AS suppressed,
  COUNT(*) FILTER (WHERE failure_reason IS NOT NULL) AS failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE publication_completed_at IS NOT NULL) / COUNT(*), 1) AS success_rate
FROM fixture_processing_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), sport
ORDER BY processing_date DESC, sport;

-- Grant access to service role for admin views
GRANT SELECT ON admin_pipeline_health TO service_role;
GRANT SELECT ON admin_stale_odds TO service_role;
GRANT SELECT ON admin_sync_status TO service_role;
GRANT SELECT ON admin_ai_suppression TO service_role;
GRANT SELECT ON admin_processing_times TO service_role;
GRANT SELECT ON admin_recent_failures TO service_role;
GRANT SELECT ON admin_suppression_reasons TO service_role;
GRANT SELECT ON admin_daily_volume TO service_role;
