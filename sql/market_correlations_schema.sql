-- Market Correlations Table for ACCA Conflict Detection
-- Part of SKCS Master Rulebook Implementation

-- Create market correlations table
CREATE TABLE IF NOT EXISTS market_correlations (
    market_a TEXT NOT NULL,
    market_b TEXT NOT NULL,
    correlation NUMERIC(3,2) NOT NULL CHECK (correlation >= 0.0 AND correlation <= 1.0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (market_a, market_b),
    CONSTRAINT valid_correlation CHECK (correlation BETWEEN 0.0 AND 1.0)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_market_correlations_lookup 
ON market_correlations (market_a, market_b);

-- Create index for reverse lookup
CREATE INDEX IF NOT EXISTS idx_market_correlations_reverse 
ON market_correlations (market_b, market_a);

-- Insert initial correlation data based on market intelligence
INSERT INTO market_correlations (market_a, market_b, correlation) VALUES
-- High correlations (conflicts)
('btts_yes', 'over_2_5', 0.85),
('btts_yes', 'over_1_5', 0.78),
('over_2_5', 'btts_yes', 0.85),
('over_1_5', 'btts_yes', 0.78),
('home_win', 'home_over_0_5', 0.72),
('away_win', 'away_over_0_5', 0.72),
('home_win', 'btts_yes', 0.65),
('away_win', 'btts_yes', 0.65),
('over_3_5', 'btts_yes', 0.91),
('over_3_5', 'over_2_5', 0.88),

-- Medium correlations
('double_chance_1x', 'over_0_5', 0.45),
('double_chance_x2', 'over_0_5', 0.45),
('draw', 'under_2_5', 0.52),
('draw', 'btts_no', 0.48),
('under_2_5', 'btts_no', 0.56),

-- Low correlations (safe combinations)
('double_chance_1x', 'corners_over_8_5', 0.25),
('double_chance_x2', 'yellow_cards_over_2_5', 0.22),
('over_1_5', 'corners_over_9_5', 0.18),
('btts_no', 'under_3_5', 0.31),
('first_half_draw', 'over_2_5', 0.28),

-- Zero correlations (independent markets)
('double_chance_12', 'yellow_cards_over_3_5', 0.05),
('corners_over_10_5', 'first_half_over_0_5', 0.08),
('cards_over_4_5', 'btts_no', 0.12),
('home_win_either_half', 'corners_under_8_5', 0.09)

-- Add symmetric entries (reverse order)
ON CONFLICT (market_a, market_b) DO NOTHING;

-- Function to get correlation between two markets
CREATE OR REPLACE FUNCTION get_market_correlation(
    market_a TEXT,
    market_b TEXT
) RETURNS NUMERIC(3,2) AS $$
DECLARE
    result NUMERIC(3,2);
BEGIN
    -- Try direct lookup
    SELECT correlation INTO result 
    FROM market_correlations 
    WHERE market_a = get_market_correlation.market_a 
      AND market_b = get_market_correlation.market_b;
    
    -- If not found, try reverse lookup
    IF result IS NULL THEN
        SELECT correlation INTO result 
        FROM market_correlations 
        WHERE market_a = get_market_correlation.market_b 
          AND market_b = get_market_correlation.market_a;
    END IF;
    
    -- Return 0.0 if no correlation found (independent markets)
    RETURN COALESCE(result, 0.0);
END;
$$ LANGUAGE plpgsql;

-- Function to validate ACCA leg correlations
CREATE OR REPLACE FUNCTION validate_acca_correlations(
    legs JSONB  -- Array of market identifiers
) RETURNS BOOLEAN AS $$
DECLARE
    leg_count INTEGER;
    i INTEGER;
    j INTEGER;
    market_a TEXT;
    market_b TEXT;
    correlation NUMERIC(3,2);
    MAX_CORRELATION CONSTANT NUMERIC(3,2) := 0.5;
BEGIN
    -- Parse JSONB array
    SELECT jsonb_array_length(legs) INTO leg_count;
    
    -- Check all pairwise combinations
    FOR i IN 0..(leg_count - 1) LOOP
        FOR j IN (i + 1)..(leg_count - 1) LOOP
            market_a := legs->>i;
            market_b := legs->>j;
            
            -- Get correlation
            correlation := get_market_correlation(market_a, market_b);
            
            -- Check if correlation exceeds threshold
            IF correlation > MAX_CORRELATION THEN
                RETURN FALSE;
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to validate ACCA legs before insertion
CREATE OR REPLACE FUNCTION check_acca_leg_correlations()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate correlations for new ACCA
    IF NOT validate_acca_correlations(NEW.legs) THEN
        RAISE EXCEPTION 'ACCA legs contain markets with correlation > 0.5';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comment on table
COMMENT ON TABLE market_correlations IS 'Stores correlation coefficients between market pairs for ACCA conflict detection';

-- Comment on functions
COMMENT ON FUNCTION get_market_correlation IS 'Returns correlation coefficient between two markets';
COMMENT ON FUNCTION validate_acca_correlations IS 'Validates that all market pairs in ACCA have correlation <= 0.5';
COMMENT ON FUNCTION check_acca_leg_correlations IS 'Trigger function to validate ACCA correlations before insertion';
