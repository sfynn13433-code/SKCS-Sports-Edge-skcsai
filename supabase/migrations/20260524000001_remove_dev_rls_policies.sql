-- Remove RLS policies from tables that should be public in development
-- Only profiles table should have RLS enabled

-- Drop policies from direct1x2_prediction_final
DROP POLICY IF EXISTS "Enable read access for all users" ON public.direct1x2_prediction_final;
DROP POLICY IF EXISTS "Public read access for direct1x2" ON public.direct1x2_prediction_final;

-- Drop policies from fixtures
DROP POLICY IF EXISTS "Public read access for fixtures" ON public.fixtures;

-- Drop policies from tier_rules
DROP POLICY IF EXISTS "Allow public read tiers" ON public.tier_rules;

-- Drop policies from zz_archive_matches
DROP POLICY IF EXISTS "Allow public read matches" ON public.zz_archive_matches;

-- Note: These tables were created with policies but RLS was never enabled
-- In development, all tables except profiles should be public
-- RLS will be enabled on appropriate tables when moving to production
