-- Add sport column to tier_rules for sport-specific confidence thresholds
-- This enables Phase 2: Dynamic Thresholds per sport

-- Drop existing primary key constraint
ALTER TABLE tier_rules DROP CONSTRAINT IF EXISTS tier_rules_pkey;

-- Add sport column (nullable initially for backward compatibility)
ALTER TABLE tier_rules ADD COLUMN IF NOT EXISTS sport text;

-- Create composite primary key (tier, sport)
-- For backward compatibility, existing rows will have sport = NULL
ALTER TABLE tier_rules ADD CONSTRAINT tier_rules_pkey PRIMARY KEY (tier, sport);

-- Add index for faster sport-specific lookups
CREATE INDEX IF NOT EXISTS idx_tier_rules_sport ON tier_rules(sport) WHERE sport IS NOT NULL;

-- Migrate existing data: set sport = 'football' for existing rows
UPDATE tier_rules SET sport = 'football' WHERE sport IS NULL;
