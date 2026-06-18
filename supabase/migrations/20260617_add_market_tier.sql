-- Add tier column to secondary_markets for ACCA diversity enforcement
ALTER TABLE secondary_markets ADD COLUMN IF NOT EXISTS market_tier SMALLINT DEFAULT 2;

UPDATE secondary_markets SET market_tier = 2 WHERE market_type IN ('double_chance','double_chance_1x','double_chance_12','double_chance_x2','over_under','btts','over_under_1_5','over_under_2_5','over_under_3_5','btts_yes','btts_no');

UPDATE secondary_markets SET market_tier = 3 WHERE market_type IN ('correct_score','first_goalscorer','anytime_goalscorer','handicap','asian_handicap','other');
