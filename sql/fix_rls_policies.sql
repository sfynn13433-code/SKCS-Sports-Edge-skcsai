-- ============================================
-- SKCS RLS POLICY FIXES
-- ============================================
-- Use these SQL commands in Supabase SQL Editor if permission denied errors occur

-- Option A: Create proper RLS policies (RECOMMENDED FOR PRODUCTION)

-- 1. Enable RLS on predictions tables (if not already enabled)
ALTER TABLE direct1x2_prediction_final ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions_final ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_final ENABLE ROW LEVEL SECURITY;

-- 2. Create policies to allow authenticated users to read predictions
CREATE POLICY "Allow authenticated select on direct1x2_prediction_final"
ON direct1x2_prediction_final
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated select on predictions_final"
ON predictions_final
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated select on prediction_final"
ON prediction_final
FOR SELECT
USING (auth.role() = 'authenticated');

-- 3. Create policy for SMB correlations table (if it exists)
CREATE POLICY "Allow authenticated select on smb_correlations"
ON smb_correlations
FOR SELECT
USING (auth.role() = 'authenticated');

-- 4. Create policy for team strength params table (if it exists)
CREATE POLICY "Allow authenticated select on team_strength_params"
ON team_strength_params
FOR SELECT
USING (auth.role() = 'authenticated');

-- Option B: Temporarily disable RLS for testing (NOT FOR LIVE)
-- Uncomment these lines ONLY for testing, then re-enable and use Option A

-- ALTER TABLE direct1x2_prediction_final DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE predictions_final DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE prediction_final DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE smb_correlations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE team_strength_params DISABLE ROW LEVEL SECURITY;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Test 1: Check if tables exist
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_name IN ('direct1x2_prediction_final', 'predictions_final', 'prediction_final', 'smb_correlations', 'team_strength_params')
  AND table_schema = 'public';

-- Test 2: Check RLS status
SELECT tablename, rowsecurity, forcerlspolicy 
FROM pg_tables 
WHERE tablename IN ('direct1x2_prediction_final', 'predictions_final', 'prediction_final', 'smb_correlations', 'team_strength_params')
  AND schemaname = 'public';

-- Test 3: Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('direct1x2_prediction_final', 'predictions_final', 'prediction_final', 'smb_correlations', 'team_strength_params')
  AND schemaname = 'public';

-- Test 4: Check recent data count
SELECT 
    'direct1x2_prediction_final' as table_name,
    COUNT(*) as total_rows,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_rows
FROM direct1x2_prediction_final
UNION ALL
SELECT 
    'predictions_final' as table_name,
    COUNT(*) as total_rows,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_rows
FROM predictions_final
UNION ALL
SELECT 
    'prediction_final' as table_name,
    COUNT(*) as total_rows,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_rows
FROM prediction_final;
