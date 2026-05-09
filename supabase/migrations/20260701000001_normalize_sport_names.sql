-- Migration: Normalize Sport Names across all tables
-- Standardize "Premium Markets" and "Niche Markets" with exact casing and naming.

BEGIN;

-- 1. Update existing data in all relevant tables
-- Premium Markets
UPDATE predictions_raw SET sport = 'NFL' WHERE LOWER(sport) IN ('nfl', 'american_football', 'american-football');
UPDATE predictions_raw SET sport = 'MLB' WHERE LOWER(sport) IN ('mlb', 'baseball');
UPDATE predictions_raw SET sport = 'MMA' WHERE LOWER(sport) = 'mma';
UPDATE predictions_raw SET sport = 'F1' WHERE LOWER(sport) IN ('f1', 'formula1', 'formula-1', 'formula_1');
UPDATE predictions_raw SET sport = 'Golf' WHERE LOWER(sport) = 'golf';
UPDATE predictions_raw SET sport = 'Rugby' WHERE LOWER(sport) IN ('rugby', 'rugbyunion');
UPDATE predictions_raw SET sport = 'Boxing' WHERE LOWER(sport) = 'boxing';

-- Niche Markets
UPDATE predictions_raw SET sport = 'NHL' WHERE LOWER(sport) IN ('nhl', 'hockey', 'icehockey');
UPDATE predictions_raw SET sport = 'AFL' WHERE LOWER(sport) = 'afl';
UPDATE predictions_raw SET sport = 'Volleyball' WHERE LOWER(sport) = 'volleyball';
UPDATE predictions_raw SET sport = 'Handball' WHERE LOWER(sport) = 'handball';

-- Repeat for direct1x2_prediction_final
UPDATE direct1x2_prediction_final SET sport = 'NFL' WHERE LOWER(sport) IN ('nfl', 'american_football', 'american-football');
UPDATE direct1x2_prediction_final SET sport = 'MLB' WHERE LOWER(sport) IN ('mlb', 'baseball');
UPDATE direct1x2_prediction_final SET sport = 'MMA' WHERE LOWER(sport) = 'mma';
UPDATE direct1x2_prediction_final SET sport = 'F1' WHERE LOWER(sport) IN ('f1', 'formula1', 'formula-1', 'formula_1');
UPDATE direct1x2_prediction_final SET sport = 'Golf' WHERE LOWER(sport) = 'golf';
UPDATE direct1x2_prediction_final SET sport = 'Rugby' WHERE LOWER(sport) IN ('rugby', 'rugbyunion');
UPDATE direct1x2_prediction_final SET sport = 'Boxing' WHERE LOWER(sport) = 'boxing';
UPDATE direct1x2_prediction_final SET sport = 'NHL' WHERE LOWER(sport) IN ('nhl', 'hockey', 'icehockey');
UPDATE direct1x2_prediction_final SET sport = 'AFL' WHERE LOWER(sport) = 'afl';
UPDATE direct1x2_prediction_final SET sport = 'Volleyball' WHERE LOWER(sport) = 'volleyball';
UPDATE direct1x2_prediction_final SET sport = 'Handball' WHERE LOWER(sport) = 'handball';

-- Repeat for predictions_accuracy
UPDATE predictions_accuracy SET sport = 'NFL' WHERE LOWER(sport) IN ('nfl', 'american_football', 'american-football');
UPDATE predictions_accuracy SET sport = 'MLB' WHERE LOWER(sport) IN ('mlb', 'baseball');
UPDATE predictions_accuracy SET sport = 'MMA' WHERE LOWER(sport) = 'mma';
UPDATE predictions_accuracy SET sport = 'F1' WHERE LOWER(sport) IN ('f1', 'formula1', 'formula-1', 'formula_1');
UPDATE predictions_accuracy SET sport = 'Golf' WHERE LOWER(sport) = 'golf';
UPDATE predictions_accuracy SET sport = 'Rugby' WHERE LOWER(sport) IN ('rugby', 'rugbyunion');
UPDATE predictions_accuracy SET sport = 'Boxing' WHERE LOWER(sport) = 'boxing';
UPDATE predictions_accuracy SET sport = 'NHL' WHERE LOWER(sport) IN ('nhl', 'hockey', 'icehockey');
UPDATE predictions_accuracy SET sport = 'AFL' WHERE LOWER(sport) = 'afl';
UPDATE predictions_accuracy SET sport = 'Volleyball' WHERE LOWER(sport) = 'volleyball';
UPDATE predictions_accuracy SET sport = 'Handball' WHERE LOWER(sport) = 'handball';

-- 2. Add CHECK constraints to enforce the new definitions
-- We include Global Majors as well to ensure they aren't blocked, but with their existing casing.
-- If preferred, an ENUM could be created here instead.

ALTER TABLE predictions_raw 
DROP CONSTRAINT IF EXISTS check_sport_names;

ALTER TABLE predictions_raw
ADD CONSTRAINT check_sport_names 
CHECK (sport IN ('football', 'tennis', 'basketball', 'cricket', 'esports', 'NFL', 'MLB', 'MMA', 'F1', 'Golf', 'Rugby', 'Boxing', 'NHL', 'AFL', 'Volleyball', 'Handball', 'darts'));

ALTER TABLE direct1x2_prediction_final 
DROP CONSTRAINT IF EXISTS check_sport_names_final;

ALTER TABLE direct1x2_prediction_final
ADD CONSTRAINT check_sport_names_final 
CHECK (sport IN ('football', 'tennis', 'basketball', 'cricket', 'esports', 'NFL', 'MLB', 'MMA', 'F1', 'Golf', 'Rugby', 'Boxing', 'NHL', 'AFL', 'Volleyball', 'Handball', 'darts'));

ALTER TABLE predictions_accuracy 
DROP CONSTRAINT IF EXISTS check_sport_names_accuracy;

ALTER TABLE predictions_accuracy
ADD CONSTRAINT check_sport_names_accuracy 
CHECK (sport IN ('football', 'tennis', 'basketball', 'cricket', 'esports', 'NFL', 'MLB', 'MMA', 'F1', 'Golf', 'Rugby', 'Boxing', 'NHL', 'AFL', 'Volleyball', 'Handball', 'darts'));

COMMIT;
