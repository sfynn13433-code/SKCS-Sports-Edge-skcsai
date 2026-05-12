-- Populate sport_sync table with all 15 sports
INSERT INTO sport_sync (sport, enabled, adapter_name, provider, sync_interval_minutes, supports_odds, supports_player_stats) VALUES
('football',     true, 'footballAdapter',      'api-football',       360, true,  true),
('f1',           true, 'f1Adapter',            'openf1',            360, true,  false),
('tennis',       true, 'tennisAdapter',        'sportradar',        360, true,  true),
('basketball',   true, 'basketballAdapter',    'api-basketball',    360, true,  true),
('cricket',      true, 'cricketAdapter',       'cricapi',           360, true,  true),
('mma',          true, 'mmaAdapter',           'sportradar',        360, true,  false),
('boxing',       true, 'boxingAdapter',        'sportradar',        360, true,  false),
('rugby',        true, 'rugbyAdapter',         'sportradar',        360, true,  true),
('baseball',     true, 'baseballAdapter',      'mlb',               360, true,  true),
('golf',         true, 'golfAdapter',          'sportradar',        360, true,  false),
('esports',      true, 'esportsAdapter',       'pandascore',        360, true,  false),
('ice_hockey',   true, 'iceHockeyAdapter',     'nhl',               360, true,  true),
('american_football', true, 'nflAdapter',      'nfl',               360, true,  true),
('horse_racing', true, 'horseRacingAdapter',   'racing_api',        360, true,  false),
('volleyball',   true, 'volleyballAdapter',    'sportradar',        360, true,  true)
ON CONFLICT (sport) DO NOTHING;
