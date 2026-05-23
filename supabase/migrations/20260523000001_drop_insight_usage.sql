-- Drop insight_usage table and associated functions
-- This table was unused dead code implementing per-format tracking
-- ACCA-specific restrictions are correctly implemented in team_week_locks table

-- Drop trigger
DROP TRIGGER IF EXISTS tr_insight_usage_updated_at ON insight_usage;

-- Drop function
DROP FUNCTION IF EXISTS update_insight_usage_timestamp();

-- Drop functions
DROP FUNCTION IF EXISTS is_fixture_available_for_format(p_fixture_id UUID, p_format TEXT);
DROP FUNCTION IF EXISTS mark_fixture_used(p_fixture_id UUID, p_format TEXT);
DROP FUNCTION IF EXISTS get_fixture_usage_summary();

-- Drop index
DROP INDEX IF EXISTS idx_insight_usage_week;

-- Drop table
DROP TABLE IF EXISTS insight_usage;
