-- Fix the matches JSONB to have proper time fields
UPDATE predictions_final 
SET matches = jsonb_build_object(
    'match_id', (matches->>'match_id')::text,
    'sport', matches->>'sport',
    'market', matches->>'market',
    'market_type', matches->>'market',
    'prediction', matches->>'prediction',
    'recommendation', matches->>'prediction',
    'odds', matches->>'odds',
    'confidence', (matches->>'confidence')::numeric,
    'volatility', matches->>'volatility',
    'metadata', jsonb_build_object(
        'match_time', matches->>'match_date',
        'commence_time', matches->>'match_date',
        'kickoff', matches->>'match_date',
        'match_date', matches->>'match_date',
        'home_team', matches->>'home_team',
        'away_team', matches->>'away_team',
        'sport', matches->>'sport'
    ),
    'home_team', matches->>'home_team',
    'away_team', matches->>'away_team',
    'commence_time', matches->>'match_date',
    'match_date', matches->>'match_date'
)
WHERE matches->>'match_date' IS NOT NULL;

-- Also set the top-level sport from matches
UPDATE predictions_final 
SET sport = matches->>'sport'
WHERE sport IS NULL OR sport = 'unknown';

-- Verify the fix
SELECT id, 
       (matches->>'commence_time') as commence_time,
       (matches->>'match_date') as match_date,
       sport,
       (matches->'metadata'->>'match_time') as meta_match_time
FROM predictions_final 
LIMIT 5;

SELECT COUNT(*) as total FROM predictions_final;
