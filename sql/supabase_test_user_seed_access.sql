-- SKCS: Seed recreated test user with admin override + all 8 tiers
-- Date: 2026-04-13
-- Run AFTER sfynn13433@gmail.com has completed registration (and email verification if required).

BEGIN;

-- Ensure profile table/columns exist for admin + test metadata.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    id_number TEXT,
    country TEXT,
    role TEXT DEFAULT 'user',
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    subscription_status TEXT DEFAULT 'inactive',
    is_test_user BOOLEAN NOT NULL DEFAULT FALSE,
    plan_id TEXT,
    plan_tier TEXT,
    plan_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_test_user BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_tier TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
DECLARE
    target_email TEXT := 'sfynn13433@gmail.com';
    target_user_id UUID;
    plans TEXT[] := ARRAY[
        'CORE_FREE',
        'CORE_DAILY',
        'CORE_WEEKLY',
        'CORE_MONTHLY',
        'ELITE_DAILY',
        'ELITE_WEEKLY',
        'ELITE_MONTHLY',
        'VIP_30DAY'
    ];
BEGIN
    SELECT id
    INTO target_user_id
    FROM auth.users
    WHERE lower(email) = lower(target_email)
    ORDER BY created_at DESC
    LIMIT 1;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Auth user % not found. Register this user first, then run this seed script.', target_email;
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        first_name,
        last_name,
        id_number,
        country,
        role,
        is_admin,
        is_test_user,
        subscription_status,
        plan_id,
        plan_tier,
        plan_expires_at,
        updated_at
    )
    VALUES (
        target_user_id,
        target_email,
        'Stephen',
        'Fynn',
        'TEST123',
        'South Africa',
        'admin',
        TRUE,
        TRUE,
        'active',
        'VIP_30DAY',
        'elite',
        NOW() + INTERVAL '30 days',
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        id_number = EXCLUDED.id_number,
        country = EXCLUDED.country,
        role = EXCLUDED.role,
        is_admin = EXCLUDED.is_admin,
        is_test_user = EXCLUDED.is_test_user,
        subscription_status = EXCLUDED.subscription_status,
        plan_id = EXCLUDED.plan_id,
        plan_tier = EXCLUDED.plan_tier,
        plan_expires_at = EXCLUDED.plan_expires_at,
        updated_at = NOW();

    -- Keep verification flow testable by clearing prior verification artifacts.
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
            DELETE FROM public.verification WHERE user_id = target_user_id;
        END IF;

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'verification'
              AND column_name = 'email'
        ) THEN
            DELETE FROM public.verification WHERE lower(email) = lower(target_email);
        END IF;
    END IF;

    -- Seed subscriptions for both schema variants:
    --   A) subscriptions(user_email, tier, status)
    --   B) subscriptions(user_id, tier_id, status, payment_timestamp, official_start_time, expiration_time)
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
              AND column_name = 'user_email'
        ) AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'subscriptions'
              AND column_name = 'tier'
        ) THEN
            DELETE FROM public.subscriptions WHERE lower(user_email) = lower(target_email);

            INSERT INTO public.subscriptions (user_email, tier, status)
            SELECT target_email, p.plan_id, 'active'
            FROM unnest(plans) AS p(plan_id);
        ELSE
            DELETE FROM public.subscriptions WHERE user_id = target_user_id;

            INSERT INTO public.subscriptions (
                user_id,
                tier_id,
                status,
                payment_timestamp,
                official_start_time,
                expiration_time
            )
            SELECT
                target_user_id,
                p.plan_id,
                'active',
                NOW(),
                NOW(),
                NOW() + INTERVAL '30 days'
            FROM unnest(plans) AS p(plan_id);
        END IF;
    END IF;
END
$$;

COMMIT;

SELECT
    id,
    email,
    first_name,
    last_name,
    role,
    is_admin,
    is_test_user,
    subscription_status,
    plan_id,
    plan_tier,
    plan_expires_at
FROM public.profiles
WHERE lower(email) = 'sfynn13433@gmail.com';

-- Subscriptions snapshot queries (run the one that matches your schema):
-- If your schema uses user_id/tier_id:
-- SELECT *
-- FROM public.subscriptions
-- WHERE user_id IN (
--     SELECT id
--     FROM auth.users
--     WHERE lower(email) = 'sfynn13433@gmail.com'
-- )
-- ORDER BY created_at DESC;
--
-- If your schema uses user_email/tier:
-- SELECT *
-- FROM public.subscriptions
-- WHERE lower(user_email) = 'sfynn13433@gmail.com'
-- ORDER BY created_at DESC;
