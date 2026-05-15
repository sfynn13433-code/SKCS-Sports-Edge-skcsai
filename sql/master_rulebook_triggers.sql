-- Database Triggers for SKCS Master Rulebook Implementation
-- Enforces business rules at database level for safety

-- Trigger 1: Prevent Extreme Risk predictions from being published
CREATE OR REPLACE FUNCTION check_extreme_risk()
RETURNS TRIGGER AS $$
BEGIN
    -- New rule: Extreme Risk is confidence < 30%
    IF NEW.confidence < 30 THEN
        NEW.is_published := false;
        NEW.risk_tier := 'EXTREME_RISK';
    END IF;
    
    -- Update risk tier based on new confidence bands
    IF NEW.confidence >= 75 THEN
        NEW.risk_tier := 'LOW_RISK';
    ELSIF NEW.confidence >= 55 THEN
        NEW.risk_tier := 'MEDIUM_RISK';
    ELSIF NEW.confidence >= 30 THEN
        NEW.risk_tier := 'HIGH_RISK';
    ELSE
        NEW.risk_tier := 'EXTREME_RISK';
        NEW.is_published := false;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to predictions table
DROP TRIGGER IF EXISTS trg_extreme_risk ON direct1x2_prediction_final;
CREATE TRIGGER trg_extreme_risk
    BEFORE INSERT OR UPDATE ON direct1x2_prediction_final
    FOR EACH ROW
    EXECUTE FUNCTION check_extreme_risk();

-- Trigger 2: Ensure no more than 4 secondary predictions per match
CREATE OR REPLACE FUNCTION limit_secondary_per_match()
RETURNS TRIGGER AS $$
DECLARE
    secondary_count INTEGER;
BEGIN
    -- Only check for secondary markets (not main 1X2)
    IF NEW.market_type != '1X2' AND NEW.is_published = true THEN
        -- Count existing secondary predictions for this match
        SELECT COUNT(*) INTO secondary_count
        FROM direct1x2_prediction_final
        WHERE match_id = NEW.match_id
          AND market_type != '1X2'
          AND is_published = true
          AND id != COALESCE(NEW.id, 0);  -- Exclude current record if updating
        
        -- Enforce limit of 4 secondary markets
        IF secondary_count >= 4 THEN
            RAISE EXCEPTION 'Match % already has 4 published secondary markets', NEW.match_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to predictions table
DROP TRIGGER IF EXISTS trg_secondary_limit ON direct1x2_prediction_final;
CREATE TRIGGER trg_secondary_limit
    BEFORE INSERT OR UPDATE ON direct1x2_prediction_final
    FOR EACH ROW
    EXECUTE FUNCTION limit_secondary_per_match();

-- Create ACCA legs table if it doesn't exist
CREATE TABLE IF NOT EXISTS acca_legs (
    id SERIAL PRIMARY KEY,
    acca_id INTEGER NOT NULL REFERENCES accas(id) ON DELETE CASCADE,
    prediction_id INTEGER NOT NULL REFERENCES direct1x2_prediction_final(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(acca_id, prediction_id)
);

-- Trigger 3: Validate accumulator leg confidence (>=75%)
CREATE OR REPLACE FUNCTION check_acca_leg_confidence()
RETURNS TRIGGER AS $$
DECLARE
    prediction_confidence NUMERIC;
BEGIN
    -- Get confidence of the prediction being added to ACCA
    SELECT confidence INTO prediction_confidence
    FROM direct1x2_prediction_final
    WHERE id = NEW.prediction_id;
    
    -- Enforce minimum confidence of 75%
    IF prediction_confidence < 75 THEN
        RAISE EXCEPTION 'Accumulator leg confidence must be >= 75%% (got %%%)', prediction_confidence;
    END IF;
    
    -- Check for volatile markets (already banned in market intelligence)
    IF EXISTS (
        SELECT 1 FROM market_correlations mc
        WHERE (mc.market_a = 'correct_score' OR mc.market_b = 'correct_score')
          AND mc.correlation > 0.8
        LIMIT 1
    ) THEN
        -- This is a placeholder - actual volatile market check should be in application logic
        NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to ACCA legs table
DROP TRIGGER IF EXISTS trg_acca_leg_confidence ON acca_legs;
CREATE TRIGGER trg_acca_leg_confidence
    BEFORE INSERT ON acca_legs
    FOR EACH ROW
    EXECUTE FUNCTION check_acca_leg_confidence();

-- Trigger 4: Validate ACCA correlations (application-level validation helper)
CREATE OR REPLACE FUNCTION validate_acca_legs_for_acca()
RETURNS TRIGGER AS $$
DECLARE
    leg_count INTEGER;
    legs_array JSONB;
    correlation_valid BOOLEAN;
BEGIN
    -- Get all legs for this ACCA
    SELECT jsonb_agg(prediction_id) INTO legs_array
    FROM acca_legs
    WHERE acca_id = NEW.id;
    
    -- Validate correlations if we have legs
    IF legs_array IS NOT NULL AND jsonb_array_length(legs_array) > 1 THEN
        -- This would need to be enhanced to get actual market names
        -- For now, we'll validate count limit
        leg_count := jsonb_array_length(legs_array);
        
        -- Enforce maximum 12 legs
        IF leg_count > 12 THEN
            RAISE EXCEPTION 'Accumulator cannot have more than 12 legs (has %)', leg_count;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to ACCA table (assuming accas table exists)
-- Note: This trigger assumes accas table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accas') THEN
        DROP TRIGGER IF EXISTS trg_acca_legs_validation ON accas;
        CREATE TRIGGER trg_acca_legs_validation
            AFTER INSERT OR UPDATE ON accas
            FOR EACH ROW
            EXECUTE FUNCTION validate_acca_legs_for_acca();
    END IF;
END $$;

-- Trigger 5: Secondary market confidence validation (>=80% primary, >=75% Safe Haven)
CREATE OR REPLACE FUNCTION validate_secondary_confidence()
RETURNS TRIGGER AS $$
DECLARE
    main_confidence NUMERIC;
    has_high_confidence_secondary BOOLEAN;
BEGIN
    -- Only apply to secondary markets
    IF NEW.market_type = '1X2' THEN
        RETURN NEW;
    END IF;
    
    -- Get main prediction confidence for this match
    SELECT confidence INTO main_confidence
    FROM direct1x2_prediction_final
    WHERE match_id = NEW.match_id
      AND market_type = '1X2'
      AND is_published = true
    LIMIT 1;
    
    -- If no main prediction, allow secondary with >=75%
    IF main_confidence IS NULL THEN
        IF NEW.confidence < 75 THEN
            RAISE EXCEPTION 'Secondary market confidence must be >= 75%% when no main prediction exists (got %%%)', NEW.confidence;
        END IF;
        RETURN NEW;
    END IF;
    
    -- Check if there are any high-confidence secondary markets (>=80%)
    SELECT EXISTS(
        SELECT 1 FROM direct1x2_prediction_final
        WHERE match_id = NEW.match_id
          AND market_type != '1X2'
          AND confidence >= 80
          AND is_published = true
          AND id != COALESCE(NEW.id, 0)
    ) INTO has_high_confidence_secondary;
    
    -- If main confidence < 80% and no high-confidence secondary exists
    -- This is a Safe Haven scenario - require >=75% and > main confidence
    IF main_confidence < 80 AND NOT has_high_confidence_secondary THEN
        IF NEW.confidence < 75 THEN
            RAISE EXCEPTION 'Safe Haven secondary market confidence must be >= 75%% (got %%%)', NEW.confidence;
        END IF;
        
        IF NEW.confidence <= main_confidence THEN
            RAISE EXCEPTION 'Safe Haven secondary confidence must be > main confidence (%.2f%%, got %%%)', main_confidence, NEW.confidence;
        END IF;
    ELSE
        -- Primary rule: require >=80%
        IF NEW.confidence < 80 THEN
            RAISE EXCEPTION 'Secondary market confidence must be >= 80%% (got %%%)', NEW.confidence;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to predictions table
DROP TRIGGER IF EXISTS trg_secondary_confidence ON direct1x2_prediction_final;
CREATE TRIGGER trg_secondary_confidence
    BEFORE INSERT OR UPDATE ON direct1x2_prediction_final
    FOR EACH ROW
    EXECUTE FUNCTION validate_secondary_confidence();

-- Create or update risk tier enum to match new rulebook
DO $$
BEGIN
    -- Check if enum type exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_tier_enum') THEN
        -- Drop existing enum
        DROP TYPE IF EXISTS risk_tier_enum_old;
        ALTER TYPE risk_tier_enum RENAME TO risk_tier_enum_old;
    END IF;
    
    -- Create new enum with correct values
    CREATE TYPE risk_tier_enum AS ENUM (
        'LOW_RISK',
        'MEDIUM_RISK', 
        'HIGH_RISK',
        'EXTREME_RISK'
    );
    
    -- Update existing data
    UPDATE direct1x2_prediction_final SET risk_tier = 'LOW_RISK' WHERE risk_tier = 'HIGH_CONFIDENCE';
    UPDATE direct1x2_prediction_final SET risk_tier = 'MEDIUM_RISK' WHERE risk_tier = 'MODERATE_RISK';
    UPDATE direct1x2_prediction_final SET risk_tier = 'HIGH_RISK' WHERE risk_tier = 'HIGH_RISK';
    UPDATE direct1x2_prediction_final SET risk_tier = 'EXTREME_RISK' WHERE risk_tier = 'EXTREME_RISK';
    
    -- Drop old enum
    DROP TYPE IF EXISTS risk_tier_enum_old;
END $$;

-- Add comments for documentation
COMMENT ON FUNCTION check_extreme_risk() IS 'Prevents extreme risk predictions (<30%) from being published and sets correct risk tiers';
COMMENT ON FUNCTION limit_secondary_per_match() IS 'Limits secondary markets to maximum 4 per match';
COMMENT ON FUNCTION check_acca_leg_confidence() IS 'Ensures ACCA legs have minimum 75% confidence';
COMMENT ON FUNCTION validate_secondary_confidence() IS 'Validates secondary market confidence rules (80% primary, 75% Safe Haven)';
