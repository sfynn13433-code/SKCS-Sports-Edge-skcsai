-- ============================================================================
-- SKCS PIPELINE BRIDGE: predictions_filtered → predictions_final
-- Run this in Supabase SQL Editor to immediately populate the website
-- ============================================================================

-- Step 1: Clear existing predictions_final data for fresh start
TRUNCATE TABLE predictions_final RESTART IDENTITY CASCADE;
-- Alternative: DELETE FROM predictions_final; -- if truncate has issues

-- Step 2: Insert valid predictions from legacy tables
INSERT INTO predictions_final (
    tier,
    type,
    matches,
    total_confidence,
    risk_level,
    publish_run_id,
    plan_visibility,
    sport,
    market_type,
    recommendation,
    expires_at,
    created_at
)
SELECT
    pf.tier,
    -- Determine type based on match count in metadata
    CASE 
        WHEN pf.raw_id IS NOT NULL THEN 'direct'
        ELSE 'direct'
    END as type,
    
    -- Build matches JSONB from predictions_raw
    jsonb_build_object(
        'match_id', pr.match_id,
        'sport', pr.sport,
        'market', pr.market,
        'prediction', pr.prediction,
        'odds', pr.odds,
        'confidence', pr.confidence,
        'volatility', pr.volatility,
        'metadata', pr.metadata,
        'commence_time', pr.metadata->>'commence_time',
        'match_date', pr.metadata->>'match_time',
        'home_team', pr.metadata->>'home_team',
        'away_team', pr.metadata->>'away_team',
        'league', pr.metadata->>'league',
        'competition', pr.metadata->>'competition'
    ) as matches,
    
    pr.confidence as total_confidence,
    
    -- Derive risk_level from confidence
    CASE 
        WHEN pr.confidence >= 80 THEN 'low'
        WHEN pr.confidence >= 65 THEN 'medium'
        ELSE 'high'
    END as risk_level,
    
    NULL as publish_run_id,
    
    -- Generate plan_visibility based on tier
    CASE 
        WHEN pf.tier = 'deep' THEN
            '["core_4day_sprint", "core_9day_run", "core_14day_pro", "core_30day_limitless", "elite_4day_deep_dive", "elite_9day_deep_strike", "elite_14day_deep_pro", "elite_30day_deep_vip"]'::jsonb
        WHEN pf.tier = 'normal' THEN
            '["core_4day_sprint", "core_9day_run", "core_14day_pro", "core_30day_limitless"]'::jsonb
        ELSE
            '["core_4day_sprint", "core_9day_run", "core_14day_pro", "core_30day_limitless"]'::jsonb
    END as plan_visibility,
    
    -- Extract sport from predictions_raw
    pr.sport,
    
    -- Extract market_type
    COALESCE(pr.market, 'unknown') as market_type,
    
    -- Extract recommendation/prediction
    pr.prediction as recommendation,
    
    -- Set expires_at to 7 days from now
    NOW() + INTERVAL '7 days' as expires_at,
    
    -- Use current timestamp
    NOW() as created_at
    
FROM predictions_filtered pf
JOIN predictions_raw pr ON pr.id = pf.raw_id
WHERE pf.is_valid = true
  AND pf.tier IN ('deep', 'normal');

-- Step 3: Verify the insert
SELECT 
    tier,
    type,
    COUNT(*) as count,
    MIN(total_confidence) as min_conf,
    MAX(total_confidence) as max_conf
FROM predictions_final
GROUP BY tier, type
ORDER BY tier, type;

-- Step 4: Check visibility distribution
SELECT 
    plan_visibility::text,
    COUNT(*) as count
FROM predictions_final
GROUP BY plan_visibility
ORDER BY count DESC;

-- Step 5: Sample of inserted records
SELECT 
    id,
    tier,
    type,
    sport,
    market_type,
    recommendation,
    total_confidence,
    risk_level,
    plan_visibility::text,
    expires_at
FROM predictions_final
LIMIT 10;

-- Final count
SELECT COUNT(*) as total_predictions_in_final FROM predictions_final;
