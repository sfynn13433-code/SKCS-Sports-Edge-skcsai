-- Normalize sport names to match frontend expectations
UPDATE predictions_final 
SET sport = 'basketball'
WHERE sport IN ('nba', 'basketball_nba');

UPDATE predictions_final 
SET sport = 'nfl'
WHERE sport IN ('american_football', 'americanfootball_nfl');

-- Also update the sport in matches JSONB
UPDATE predictions_final 
SET matches = jsonb_set(matches, '{sport}', '"basketball"', true)
WHERE matches->>'sport' IN ('nba', 'basketball_nba');

UPDATE predictions_final 
SET matches = jsonb_set(matches, '{sport}', '"nfl"', true)
WHERE matches->>'sport' IN ('american_football', 'americanfootball_nfl');

-- Also update metadata sport
UPDATE predictions_final 
SET matches = jsonb_set(matches, '{metadata,sport}', '"basketball"', true)
WHERE matches->'metadata'->>'sport' IN ('nba', 'basketball_nba');

UPDATE predictions_final 
SET matches = jsonb_set(matches, '{metadata,sport}', '"nfl"', true)
WHERE matches->'metadata'->>'sport' IN ('american_football', 'americanfootball_nfl');

-- Verify the sport distribution now
SELECT sport, COUNT(*) as count FROM predictions_final GROUP BY sport ORDER BY count DESC;
