-- ============================================
-- SKCS EXTREME SMB DATA LAYER
-- ============================================

-- 1. Team attack/defence parameters (α, β)
--    Seed with EPL 2023/24 averages as fallback.
CREATE TABLE IF NOT EXISTS team_strength_params (
    team_id TEXT PRIMARY KEY,
    team_name TEXT NOT NULL,
    alpha REAL NOT NULL DEFAULT 1.0,   -- attack strength
    beta REAL NOT NULL DEFAULT 1.0,    -- defence weakness
    home_advantage_factor REAL NOT NULL DEFAULT 1.0,
    last_updated TIMESTAMP DEFAULT NOW()
);

-- Insert some sample data (replace with your full dataset)
INSERT INTO team_strength_params (team_id, team_name, alpha, beta)
VALUES
    ('MCI', 'Manchester City', 1.91, 0.87),
    ('ARS', 'Arsenal', 1.65, 0.92),
    ('LIV', 'Liverpool', 1.70, 0.95),
    ('SHU', 'Sheffield United', 0.61, 1.64),
    ('BUR', 'Burnley', 0.58, 1.72)
ON CONFLICT (team_id) DO NOTHING;

-- 2. Extended market correlation matrix
CREATE TABLE IF NOT EXISTS smb_correlations (
    market_a TEXT NOT NULL,
    market_b TEXT NOT NULL,
    rho REAL NOT NULL,
    confidence_level TEXT DEFAULT 'empirical',
    PRIMARY KEY (market_a, market_b)
);

-- Core ρ values (symmetrical – insert both directions)
INSERT INTO smb_correlations (market_a, market_b, rho)
VALUES
    ('home_win', 'over_2_5', 0.28),
    ('home_win', 'striker_1_sot', 0.35),
    ('over_2_5', 'btts_yes', 0.25),
    ('home_win', 'home_over_4_5_corners', 0.20),
    ('striker_1_sot', 'opp_keeper_2_saves', 0.15),
    ('home_win', 'lead_at_ht', 0.40),
    ('home_win', 'win_both_halves', 0.50),
    ('home_over_1_5_team_goals', 'home_win', 0.30),
    ('home_clean_sheet', 'home_win', 0.25),
    -- Negative pairs
    ('home_win', 'opp_rb_70_yds', -0.30)
ON CONFLICT (market_a, market_b) DO NOTHING;

-- Create symmetrical entries (so lookups work both ways)
INSERT INTO smb_correlations (market_a, market_b, rho)
SELECT market_b, market_a, rho
FROM smb_correlations
ON CONFLICT (market_a, market_b) DO NOTHING;

-- 3. H2H sample size tracking for decay
ALTER TABLE matches ADD COLUMN IF NOT EXISTS h2h_sample_size INTEGER DEFAULT 0;
