-- SKCS Insight Usage Policy
-- Enforces "One Fixture Per Format" per week

-- Create the insight_usage table to track fixture usage across formats
CREATE TABLE IF NOT EXISTS insight_usage (
    fixture_id UUID PRIMARY KEY,
    week_start DATE NOT NULL DEFAULT date_trunc('week', CURRENT_DATE)::date,
    used_in_direct BOOLEAN DEFAULT false,
    used_in_analytical BOOLEAN DEFAULT false,
    used_in_multi BOOLEAN DEFAULT false,
    used_in_same_match BOOLEAN DEFAULT false,
    used_in_acca BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_insight_usage_week ON insight_usage(week_start);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_insight_usage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating timestamp
DROP TRIGGER IF EXISTS tr_insight_usage_updated_at ON insight_usage;
CREATE TRIGGER tr_insight_usage_updated_at
    BEFORE UPDATE ON insight_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_insight_usage_timestamp();

-- Function to check if fixture is available for a specific format
CREATE OR REPLACE FUNCTION is_fixture_available_for_format(
    p_fixture_id UUID,
    p_format TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_week_start DATE;
    v_available BOOLEAN;
BEGIN
    v_week_start := date_trunc('week', CURRENT_DATE)::date;
    
    SELECT
        CASE p_format
            WHEN 'direct' THEN NOT COALESCE(used_in_direct, false)
            WHEN 'analytical' THEN NOT COALESCE(used_in_analytical, false)
            WHEN 'multi' THEN NOT COALESCE(used_in_multi, false)
            WHEN 'same_match' THEN NOT COALESCE(used_in_same_match, false)
            WHEN 'acca' THEN NOT COALESCE(used_in_acca, false)
            ELSE true
        END
    INTO v_available
    FROM insight_usage
    WHERE fixture_id = p_fixture_id AND week_start = v_week_start;
    
    RETURN COALESCE(v_available, true);
END;
$$ LANGUAGE plpgsql;

-- Function to mark fixture as used in a specific format
CREATE OR REPLACE FUNCTION mark_fixture_used(
    p_fixture_id UUID,
    p_format TEXT
) RETURNS VOID AS $$
DECLARE
    v_week_start DATE;
    v_column TEXT;
BEGIN
    v_week_start := date_trunc('week', CURRENT_DATE)::date;
    
    v_column := CASE p_format
        WHEN 'direct' THEN 'used_in_direct'
        WHEN 'analytical' THEN 'used_in_analytical'
        WHEN 'multi' THEN 'used_in_multi'
        WHEN 'same_match' THEN 'used_in_same_match'
        WHEN 'acca' THEN 'used_in_acca'
        ELSE NULL
    END;
    
    IF v_column IS NULL THEN
        RAISE EXCEPTION 'Invalid format: %', p_format;
    END IF;
    
    INSERT INTO insight_usage (fixture_id, week_start, created_at, updated_at)
    VALUES (p_fixture_id, v_week_start, NOW(), NOW())
    ON CONFLICT (fixture_id) DO UPDATE
    SET
        used_in_direct = COALESCE(insight_usage.used_in_direct, false) OR (v_column = 'used_in_direct' AND NOT insight_usage.used_in_direct),
        used_in_analytical = COALESCE(insight_usage.used_in_analytical, false) OR (v_column = 'used_in_analytical' AND NOT insight_usage.used_in_analytical),
        used_in_multi = COALESCE(insight_usage.used_in_multi, false) OR (v_column = 'used_in_multi' AND NOT insight_usage.used_in_multi),
        used_in_same_match = COALESCE(insight_usage.used_in_same_match, false) OR (v_column = 'used_in_same_match' AND NOT insight_usage.used_in_same_match),
        used_in_acca = COALESCE(insight_usage.used_in_acca, false) OR (v_column = 'used_in_acca' AND NOT insight_usage.used_in_acca),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get fixture usage summary for current week
CREATE OR REPLACE FUNCTION get_fixture_usage_summary()
RETURNS TABLE (
    fixture_id UUID,
    week_start DATE,
    used_in_direct BOOLEAN,
    used_in_analytical BOOLEAN,
    used_in_multi BOOLEAN,
    used_in_same_match BOOLEAN,
    used_in_acca BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        iu.fixture_id,
        iu.week_start,
        iu.used_in_direct,
        iu.used_in_analytical,
        iu.used_in_multi,
        iu.used_in_same_match,
        iu.used_in_acca
    FROM insight_usage iu
    WHERE iu.week_start = date_trunc('week', CURRENT_DATE)::date;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust role as needed)
-- GRANT USAGE ON SCHEMA public TO supabase_authenticator;
-- GRANT ALL ON TABLE insight_usage TO supabase_authenticator;
-- GRANT EXECUTE ON FUNCTION is_fixture_available_for_format TO supabase_authenticator;
-- GRANT EXECUTE ON FUNCTION mark_fixture_used TO supabase_authenticator;
