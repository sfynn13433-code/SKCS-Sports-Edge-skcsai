-- SQL Implementation
CREATE TYPE sub_status AS ENUM ('day_zero_bonus', 'day_zero_lite', 'active', 'expired', 'cancelled');

ALTER TABLE users ADD COLUMN IF NOT EXISTS has_used_day_zero BOOLEAN DEFAULT FALSE;

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    tier_id VARCHAR(50) NOT NULL,
    status sub_status NOT NULL,
    payment_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    official_start_time TIMESTAMPTZ NOT NULL,
    expiration_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
