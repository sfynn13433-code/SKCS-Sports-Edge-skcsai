-- SKCS: Supabase test-user reset + tier bootstrap
-- Date: 2026-04-13
-- Target emails:
--   - sfynn450@gmail.com
--   - sfynn13433@gmail.com
--
-- Usage:
-- 1) Run this whole script in Supabase SQL Editor (service role / postgres).
-- 2) Register sfynn13433@gmail.com via the normal app registration flow.
-- 3) Verify email (if confirmation is enabled).
-- 4) Run sql/supabase_test_user_seed_access.sql to bind profile/subscriptions.

BEGIN;

-- ============================================================================
-- STEP 2: Ensure 8 business tiers exist
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tiers (
    id BIGSERIAL PRIMARY KEY,
    tier_name TEXT NOT NULL UNIQUE,
    level INTEGER NOT NULL,
    description TEXT
);

INSERT INTO public.tiers (tier_name, level, description) VALUES
    ('CORE_FREE', 1, 'Core free/testing baseline access'),
    ('CORE_DAILY', 2, 'Core daily access'),
    ('CORE_WEEKLY', 3, 'Core weekly access'),
    ('CORE_MONTHLY', 4, 'Core monthly access'),
    ('ELITE_DAILY', 5, 'Elite daily access'),
    ('ELITE_WEEKLY', 6, 'Elite weekly access'),
    ('ELITE_MONTHLY', 7, 'Elite monthly access'),
    ('VIP_30DAY', 8, 'VIP 30-day access')
ON CONFLICT (tier_name) DO UPDATE SET
    level = EXCLUDED.level,
    description = EXCLUDED.description;

-- ============================================================================
-- STEP 1: Remove existing records for both emails
-- ============================================================================
DO $$
BEGIN
    -- subscriptions (user_id path)
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'subscriptions'
    ) THEN
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'subscriptions'
              AND column_name = 'user_id'
        ) THEN
            DELETE FROM public.subscriptions
            WHERE user_id IN (
                SELECT id
                FROM auth.users
                WHERE lower(email) IN ('sfynn450@gmail.com', 'sfynn13433@gmail.com')
            );
        END IF;

        -- subscriptions (legacy user_email path)
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'subscriptions'
              AND column_name = 'user_email'
        ) THEN
            DELETE FROM public.subscriptions
            WHERE lower(user_email) IN ('sfynn450@gmail.com', 'sfynn13433@gmail.com');
        END IF;
    END IF;

    -- verification
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'verification'
    ) THEN
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'verification'
              AND column_name = 'user_id'
        ) THEN
            DELETE FROM public.verification
            WHERE user_id IN (
                SELECT id
                FROM auth.users
                WHERE lower(email) IN ('sfynn450@gmail.com', 'sfynn13433@gmail.com')
            );
        END IF;

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'verification'
              AND column_name = 'email'
        ) THEN
            DELETE FROM public.verification
            WHERE lower(email) IN ('sfynn450@gmail.com', 'sfynn13433@gmail.com');
        END IF;
    END IF;

    -- profiles
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
    ) THEN
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
              AND column_name = 'email'
        ) THEN
            DELETE FROM public.profiles
            WHERE lower(email) IN ('sfynn450@gmail.com', 'sfynn13433@gmail.com');
        END IF;
    END IF;
END
$$;

-- auth.users (must be last due FK dependencies)
DELETE FROM auth.users
WHERE lower(email) IN ('sfynn450@gmail.com', 'sfynn13433@gmail.com');

COMMIT;

-- ============================================================================
-- Verification snapshot (reset phase)
-- ============================================================================
SELECT id, email, created_at
FROM auth.users
WHERE lower(email) IN ('sfynn450@gmail.com', 'sfynn13433@gmail.com')
ORDER BY email;

-- Next step:
-- After registering + verifying sfynn13433@gmail.com in the normal app flow,
-- run: sql/supabase_test_user_seed_access.sql
