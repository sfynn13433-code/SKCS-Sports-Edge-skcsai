-- Add RLS policies for cricket tables to allow service role writes
-- Run this in Supabase SQL Editor

-- Enable RLS if not already enabled
-- ALTER TABLE cricket_fixtures ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cricket_insights_final ENABLE ROW LEVEL SECURITY;

-- Policies for cricket_fixtures
DROP POLICY IF EXISTS service_write ON cricket_fixtures;
CREATE POLICY service_write ON cricket_fixtures FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS service_update ON cricket_fixtures;
CREATE POLICY service_update ON cricket_fixtures FOR UPDATE USING (true);

DROP POLICY IF EXISTS service_delete ON cricket_fixtures;
CREATE POLICY service_delete ON cricket_fixtures FOR DELETE USING (true);

-- Policies for cricket_insights_final
DROP POLICY IF EXISTS service_write_insights ON cricket_insights_final;
CREATE POLICY service_write_insights ON cricket_insights_final FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS service_update_insights ON cricket_insights_final;
CREATE POLICY service_update_insights ON cricket_insights_final FOR UPDATE USING (true);

DROP POLICY IF EXISTS service_delete_insights ON cricket_insights_final;
CREATE POLICY service_delete_insights ON cricket_insights_final FOR DELETE USING (true);

-- Read policies for authenticated users
DROP POLICY IF EXISTS read_cricket_fixtures ON cricket_fixtures;
CREATE POLICY read_cricket_fixtures ON cricket_fixtures FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS read_cricket_insights ON cricket_insights_final;
CREATE POLICY read_cricket_insights ON cricket_insights_final FOR SELECT TO authenticated USING (true);

SELECT 'RLS policies created successfully' as result;