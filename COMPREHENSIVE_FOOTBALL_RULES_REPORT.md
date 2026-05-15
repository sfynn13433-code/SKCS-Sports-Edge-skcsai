# SKCS AI Sports Edge - COMPREHENSIVE FOOTBALL RULES ECOSYSTEM REPORT

## EXECUTIVE SUMMARY

This is a FULL-SCALE comprehensive analysis of the entire football (soccer) rules ecosystem across the SKCS AI Sports Edge environment. Every rule, algorithm, constraint, and governance mechanism has been identified and documented.

---

## 1. CORE FOOTBALL RULES FRAMEWORK

### 1.1 Football Configuration (`backend/config/footballRules.js`)

```javascript
const FOOTBALL_RULES = {
    confidenceBands: {
        highConfidence: { min: 80, label: 'HIGH_CONFIDENCE' },
        moderateRisk: { min: 70, max: 79, label: 'MODERATE_RISK' },
        highRisk: { min: 59, max: 69, label: 'HIGH_RISK' },
        extremeRisk: { max: 58, label: 'EXTREME_RISK' }
    },
    direct: {
        minConfidence: 45,
        strongConfidence: 80,
        moderateMin: 60,
        cautionMin: 45
    },
    secondary: {
        minConfidence: 76,
        maxItems: 4,
        diversityCaps: {
            goals: 2,
            cards: 1
        }
    },
    acca: {
        minLegConfidence: 70,
        minAllowedConfidence: 45,
        maxAllowedConfidence: 99,
        defaultSixLegs: 6,
        defaultMegaLegs: 12,
        allowHighVolatility: false
    },
    volatility: {
        extremeThreshold: 0.7
    },
    timing: {
        staleGraceMinutes: 15,
        staleRejectHours: 2
    }
};
```

### 1.2 Risk Assessment Framework (`STRICT_RULES.md`)

#### 4-Tier Risk System (MANDATORY)
- **80% - 100%**: ✅ High Confidence / Safe (Green)
- **70% - 79%**: 📊 Moderate Risk (Blue)
- **59% - 69%**: ⚠️ High Risk / Volatile (Orange) - MUST attach secondary insights
- **0% - 58%**: 🛑 Extreme Risk / Danger (Red) - MUST enforce exactly 4 secondary insights

---

## 2. FOOTBALL MARKET CLASSIFICATION SYSTEM

### 2.1 Market Categories (`backend/services/marketIntelligence.js`)

#### Core Safe Markets
```javascript
core_safe_markets: [
    'home_win', 'away_win', 'draw',
    'double_chance_1x', 'double_chance_x2', 'double_chance_12',
    'draw_no_bet_home', 'draw_no_bet_away'
]
```

#### Goals Markets
```javascript
goals_markets: [
    'over_0_5', 'over_1_5', 'over_2_5', 'over_3_5',
    'under_2_5', 'under_3_5', 'under_4_5',
    'home_over_0_5', 'away_over_0_5',
    'home_over_1_5', 'away_over_1_5'
]
```

#### BTTS (Both Teams To Score) Markets
```javascript
btts_markets: [
    'btts_yes', 'btts_no', 'btts_over_2_5', 'btts_under_3_5',
    'home_win_btts_yes', 'away_win_btts_yes',
    'home_win_btts_no', 'away_win_btts_no'
]
```

#### Defensive Markets
```javascript
defensive_markets: [
    'under_4_5', 'under_3_5', 'over_1_5',
    'home_over_0_5', 'away_over_0_5',
    'double_chance_under_3_5', 'double_chance_over_1_5'
]
```

#### Elite Combination Markets
```javascript
elite_combination_markets: [
    'home_win_under_4_5', 'away_win_under_4_5',
    'home_win_over_1_5', 'away_win_over_1_5',
    'double_chance_over_1_5', 'double_chance_under_3_5',
    'win_either_half', 'team_to_score_first_home',
    'team_to_score_first_away'
]
```

#### Half Markets
```javascript
half_markets: [
    'over_0_5_first_half', 'under_1_5_first_half',
    'first_half_draw', 'home_win_either_half',
    'away_win_either_half'
]
```

### 2.2 Market Priority Tiers

#### Tier 1 (Highest Priority)
```javascript
tier_1: [
    'double_chance_1x', 'double_chance_x2', 'double_chance_12',
    'over_1_5', 'under_4_5',
    'home_over_0_5', 'away_over_0_5',
    'draw_no_bet_home', 'draw_no_bet_away'
]
```

#### Tier 2 (Medium Priority)
```javascript
tier_2: [
    'home_win_under_4_5', 'away_win_under_4_5',
    'home_win_over_1_5', 'away_win_over_1_5',
    'under_3_5', 'double_chance_over_1_5',
    'double_chance_under_3_5'
]
```

#### Tier 3 (Lower Priority)
```javascript
tier_3: [
    'btts_yes', 'btts_no', 'over_2_5', 'draw',
    'first_half_draw', 'team_to_score_first_home',
    'team_to_score_first_away', 'win_either_half'
]
```

---

## 3. SECONDARY INSIGHTS GOVERNANCE

### 3.1 Secondary Market Rules (`STRICT_RULES.md`)

#### Mandatory Requirements
- **Threshold**: MUST have confidence score of 76% or higher
- **Volume Limit**: Strictly limited to MAXIMUM of 4 secondary markets per match
- **Database Enforcement**: Enforced at DB level via schema objects (allowlist table + triggers)

#### Allowed Markets (STRICT ALLOWLIST)
- **Double Chance**: 1X, X2, 12
- **Draw No Bet**: Home, Away
- **Goals Totals**: Over 0.5, 1.5, 2.5, 3.5 | Under 2.5, 3.5
- **Team Totals**: Home Over 0.5, 1.5 | Away Over 0.5, 1.5
- **BTTS**: YES, NO, BTTS & O2.5, BTTS & U3.5, Win & BTTS YES, Win & BTTS NO
- **Defensive/Low Risk**: Under 3.5, 4.5 | Over 1.5 | Home/Away Team Over 0.5 | DC + U3.5, DC + O1.5
- **Half Markets**: Over 0.5 FH, Under 1.5 FH, FH Draw, Home/Away Win Either Half
- **Corners**: Over 6.5 through 12.5 | Under 7.5 through 12.5
- **Cards**: Over 1.5 through 6.5 | Under 1.5 through 6.5

### 3.2 Database-Level Enforcement (`supabase/migrations/20260501_skcs_comprehensive_engine.sql`)

#### Secondary Market Allowlist Table
```sql
CREATE TABLE IF NOT EXISTS secondary_market_allowlist (
    allow_phrase VARCHAR(100) PRIMARY KEY,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);
```

#### 100+ Allowed Markets Including:
- All standard goal lines (over/under 0.5 through 4.5)
- BTTS combinations (btts_yes, btts_no, btts & o2.5, btts & u3.5)
- Double chance combinations (dc + u3.5, dc + o1.5)
- Corner markets (over 6.5 through 12.5, under 7.5 through 12.5)
- Card markets (over/under 1.5 through 6.5)
- Half-time markets (over 0.5 fh, under 1.5 fh, fh draw)

---

## 4. FOOTBALL AI PIPELINE ALGORITHMS

### 4.1 Multi-Stage Prediction Pipeline (`backend/services/aiPipeline.js`)

#### Stage 1: Baseline Probability
- Input: Raw probabilities from baseline model
- Process: Normalization and validation
- Output: `probabilities = { home, draw, away }`

#### Stage 2: Weather Context (`backend/services/direct1x2Engine.js`)
```javascript
if (rainFlag) {
    probabilities.draw += 0.03;
    probabilities.home -= 0.015;
    probabilities.away -= 0.015;
    stage2Reason = 'Rain expected — slower tempo increases draw likelihood.';
}
```

#### Stage 3: Injury Analysis
```javascript
if (keyPlayersOut.home > 0) {
    probabilities.home -= 0.05;
    probabilities.draw += 0.03;
    probabilities.away += 0.02;
    stage3Reason = 'Home team missing key players — attacking strength reduced.';
}
```

#### Stage 4: H2H & Form Analysis
```javascript
if (pointsDelta >= 4) {
    probabilities.home += 0.02;
    probabilities.away -= 0.02;
    stage4Reasons.push('Home recent form trend is stronger over the last 5 fixtures.');
}
```

### 4.2 Confidence Calculation Formula

#### Base Confidence Scoring
```javascript
const score =
    (adjusted * 0.38) +                    // Adjusted probability weight
    (contextSafety * 0.17) +                // Context safety weight
    (lineupCertainty * 0.11) +              // Lineup certainty weight
    ((1 - volatility) * 0.09) +             // Volatility penalty weight
    ((1 - corrRisk) * 0.08) +              // Correlation risk weight
    (sanity * 0.08) +                       // Odds sanity weight
    (suitability * 0.06) +                  // ACCA suitability weight
    tierBonus;                              // Priority tier bonus
```

#### Final Confidence Formula
```javascript
const rawConfidence = Math.round(clamp((adjusted * 100) - missingContextPenaltyPct, 1, 99) * 100) / 100;
const confidence = Math.round(clamp(rawConfidence, 1, 99) * 100) / 100;
```

---

## 5. RISK ASSESSMENT & CORRELATION SYSTEM

### 5.1 Risk Profile Building (`backend/services/marketIntelligence.js`)

```javascript
function buildRiskProfile(matchContext = {}, contextSignals = {}) {
    const weather = Math.max(weatherRisk(context), normalizeRisk(contextSignals.weather_risk, 0));
    const lineup = lineupUncertainty(context);
    const injuries = normalizeRisk(contextSignals.injury_risk, 0);
    const derby = normalizeRisk(contextSignals.derby_risk, 0);
    const rotation = normalizeRisk(contextSignals.rotation_risk, 0);
    
    const aggregate_risk = clamp(
        (weather * 0.25) + (lineup * 0.20) + (injuries * 0.20) +
        (derby * 0.15) + (rotation * 0.20),
        0, 1
    );
    
    return { aggregate_risk, weather, lineup, injuries, derby, rotation };
}
```

### 5.2 Market Correlation Scoring

```javascript
function correlationRiskScore(market) {
    const key = normalizeMarketKey(market);
    if (key === 'draw') return 0.62;
    if (VOLATILE_MARKETS_12_LEG.has(key)) return 0.74;
    if (AGGRESSIVE_MARKETS.has(key)) return 0.3;
    return 0.55;
}
```

#### Volatile Markets (12-Leg Restricted)
```javascript
const VOLATILE_MARKETS_12_LEG = new Set([
    'draw', 'over_3_5', 'btts_yes', 'btts_over_2_5',
    'home_win_btts_yes', 'away_win_btts_yes',
    'over_0.5_first_half', 'under_1_5_first_half',
    'first_half_draw', 'team_to_score_first_home',
    'team_to_score_first_away'
]);
```

#### Aggressive Markets
```javascript
const AGGRESSIVE_MARKETS = new Set([
    'over_3_5', 'btts_yes', 'btts_over_2_5',
    'home_win_btts_yes', 'away_win_btts_yes'
]);
```

---

## 6. MANDATORY SECONDARY INSIGHTS ENGINE

### 6.1 Secondary Insights Generation (`backend/services/aiPipeline.js`)

```javascript
function buildMandatorySecondaryInsights({
    candidates, selectedMarket, primaryOutcome, primaryConfidence, ruleOf4
}) {
    const picked = [];
    
    // 1. Build from ranked candidates
    buildSecondaryInsights(candidates, selectedMarket).forEach((item) => 
        pushUnique(item, 'ranked'));
    
    // 2. Add Rule of 4 defaults
    ensureArray(ruleOf4).forEach((item) => 
        pushUnique(item, 'rule_of_4'));
    
    // 3. Add fallback defaults for outcome
    secondaryFallbackDefaultsForOutcome(primaryOutcome, primaryConfidence).forEach((item) => 
        pushUnique(item, 'fallback_defaults'));
    
    // 4. Add standard secondary markets
    getStandardSecondaryMarkets({}, normalizePrediction(primaryOutcome)).forEach((item) => 
        pushUnique(item, 'standard_defaults'));
    
    return picked.sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0)).slice(0, 4);
}
```

### 6.2 Standard Secondary Markets by Outcome

#### Home Win Defaults
```javascript
if (homeWin) {
    return [
        { market: 'double_chance_1x', prediction: '1X', confidence: 84, source: 'rule_of_4' },
        { market: 'draw_no_bet_home', prediction: 'home', confidence: 81, source: 'rule_of_4' },
        { market: 'over_1_5', prediction: 'over', confidence: 79, source: 'rule_of_4' },
        { market: 'under_4_5', prediction: 'under', confidence: 78, source: 'rule_of_4' }
    ];
}
```

#### Away Win Defaults
```javascript
if (awayWin) {
    return [
        { market: 'double_chance_x2', prediction: 'X2', confidence: 84, source: 'rule_of_4' },
        { market: 'draw_no_bet_away', prediction: 'away', confidence: 81, source: 'rule_of_4' },
        { market: 'over_1_5', prediction: 'over', confidence: 79, source: 'rule_of_4' },
        { market: 'under_4_5', prediction: 'under', confidence: 78, source: 'rule_of_4' }
    ];
}
```

---

## 7. ACCA (ACCUMULATOR) BUILDING RULES

### 7.1 ACCA Confidence Requirements
```javascript
acca: {
    minLegConfidence: 70,        // Minimum confidence per leg
    minAllowedConfidence: 45,    // Absolute minimum allowed
    maxAllowedConfidence: 99,    // Maximum allowed confidence
    defaultSixLegs: 6,           // Standard ACCA size
    defaultMegaLegs: 12,          // Mega ACCA size
    allowHighVolatility: false    // No high volatility markets
}
```

### 7.2 12-Leg Safe Pool
```javascript
const TWELVE_LEG_SAFE_POOL = new Set([
    'double_chance_1x', 'double_chance_x2', 'double_chance_12',
    'draw_no_bet_home', 'draw_no_bet_away',
    'over_1_5', 'under_4_5', 'under_3_5',
    'home_over_0_5', 'away_over_0_5',
    'double_chance_under_3_5', 'double_chance_over_1_5'
]);
```

### 7.3 Market Conflict Detection
```javascript
function areMarketsConflicting(marketA, marketB) {
    const keyA = normalizeMarketKey(marketA);
    const keyB = normalizeMarketKey(marketB);
    
    // Direct conflicts
    if ((keyA === 'over_2_5' && keyB === 'under_2_5') ||
        (keyA === 'btts_yes' && keyB === 'btts_no')) {
        return true;
    }
    
    // Indirect conflicts
    if ((keyA === 'home_win' && keyB === 'away_win') ||
        (keyA === 'over_0_5' && keyB === 'under_0_5')) {
        return true;
    }
    
    return false;
}
```

---

## 8. DATABASE GOVERNANCE & CONSTRAINTS

### 8.1 Table Constraints (`supabase/migrations/20260619000003_direct1x2_risk_tier_and_secondary_markets.sql`)

```sql
-- Secondary markets length constraint
ALTER TABLE public.direct1x2_prediction_final
ADD CONSTRAINT secondary_markets_length
CHECK (jsonb_array_length(secondary_markets) <= 4);

-- Risk level constraint
ALTER TABLE public.direct1x2_prediction_final
ADD CONSTRAINT predictions_final_risk_level_check
CHECK (risk_level = ANY (
    ARRAY['safe', 'good', 'fair', 'unsafe', 'medium', 'low']
));
```

### 8.2 Trigger-Based Enforcement
```sql
CREATE OR REPLACE FUNCTION trg_enforce_secondary_market_governance()
RETURNS TRIGGER AS $$
BEGIN
    -- Check each secondary market against allowlist
    FOR market IN SELECT jsonb_array_elements_text(NEW.secondary_markets)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM secondary_market_allowlist 
            WHERE allow_phrase = market AND is_active = true
        ) THEN
            RAISE EXCEPTION 'Secondary market not allowed: %', market;
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 9. FOOTBALL-SPECIFIC AI MODELS

### 9.1 EdgeMind Bot Report Structure (`STRICT_RULES.md`)

#### Mandatory 4-Stage Narrative
1. **Stage 1 (Baseline)**: "On paper, Team A appears stronger with X% probability"
2. **Stage 2 (Deep Context)**: "However, considering team form and injuries..."
3. **Stage 3 (Reality Check)**: "External factors like weather and news suggest..."
4. **Stage 4 (Decision Engine)**: "Final confidence: Y% due to综合因素"

#### Risk Messaging Rules
- **59% - 69%**: Must classify Direct 1X2 as high risk and advise pivot to Secondary Insights
- **0% - 58%**: Must classify Direct 1X2 as extreme risk and explicitly instruct NOT to bet direct

### 9.2 Context Intelligence Pipeline (`backend/src/services/contextIntelligence/aiPipeline_core.js`)

```javascript
async function enrichFixtureWithContext(fixture) {
    const matchContext = ensureMatchContextShape(fixture);
    
    // 1. Weather analysis
    const weatherAnalysis = analyzeWeatherConditions(matchContext);
    
    // 2. Injury assessment
    const injuryAssessment = assessKeyPlayerInjuries(matchContext);
    
    // 3. H2H trend analysis
    const h2hAnalysis = analyzeHeadToHeadTrends(matchContext);
    
    // 4. Form momentum calculation
    const formAnalysis = calculateFormMomentum(matchContext);
    
    return {
        ...matchContext,
        contextual_intelligence: {
            weather: weatherAnalysis,
            injuries: injuryAssessment,
            h2h: h2hAnalysis,
            form: formAnalysis,
            signals: calculateContextSignals(weatherAnalysis, injuryAssessment, h2hAnalysis, formAnalysis)
        }
    };
}
```

---

## 10. PROBABILITY ADJUSTMENT ALGORITHMS

### 10.1 Market Adjustment Formula (`backend/src/services/contextIntelligence/adjustProbability.js`)

```javascript
function adjustProbability(p_base, signals) {
    const weights = {
        availability_risk: 0.40,
        stability_risk: 0.35,
        discipline_risk: 0.15,
        travel_fatigue_risk: 0.10
    };
    
    const adjustmentDelta = 
        (signals.availability_risk * weights.availability_risk) +
        (signals.stability_risk * weights.stability_risk) +
        (signals.discipline_risk * weights.discipline_risk) +
        (signals.travel_fatigue_risk * weights.travel_fatigue_risk);
    
    const p_adj = p_base - (adjustmentDelta * 0.15);
    return Number(clamp(p_adj, 0.10, 0.95).toFixed(3));
}
```

### 10.2 Volatility Calculation
```javascript
function volatilityFromRiskProfile(riskProfile, fallbackVolatility) {
    if (!riskProfile || typeof riskProfile !== 'object') {
        return fallbackVolatility || 'medium';
    }
    
    const volatility = clamp(
        (riskProfile.derby_risk * 0.45) +
        (riskProfile.weather_risk * 0.30) +
        (riskProfile.rotation_risk * 0.25),
        0, 1
    );
    
    if (volatility >= 0.7) return 'high';
    if (volatility >= 0.4) return 'medium';
    return 'low';
}
```

---

## 11. FRONTEND FOOTBALL DISPLAY RULES

### 11.1 Market Display Mapping (`public/index.html`)

```javascript
function formatMarketLabel(marketKey, predictionKey) {
    const goalLineMatch = marketKey.match(/^(over|under)_(\d+)_(\d+)$/);
    const cornersLineMatch = marketKey.match(/^corners_(over|under)_(\d+)_(\d+)$/);
    const yellowsLineMatch = marketKey.match(/^(over|under)_(\d+)_(\d+)_yellows$/);
    const comboDcBttsMatch = marketKey.match(/^combo_dc_(1x|x2|12)_btts_(yes|no)$/);
    const comboWinnerOuMatch = marketKey.match(/^combo_(home|away|draw)_and_(over|under)_2_5$/);
    
    if (goalLineMatch) {
        return `GOALS ${goalLineMatch[1].toUpperCase()} ${goalLineMatch[2]}.${goalLineMatch[3] || '5'}`;
    }
    
    if (comboDcBttsMatch) {
        return `DOUBLE CHANCE ${comboDcBttsMatch[1]} + BTTS ${comboDcBttsMatch[2]}`;
    }
    
    if (marketKey === 'btts_yes') return 'BTTS - YES';
    if (marketKey === 'btts_no') return 'BTTS - NO';
    
    return `${marketKey}: ${predictionKey}`;
}
```

### 11.2 Risk Color Coding
```javascript
function getRiskColor(confidence) {
    if (confidence >= 80) return 'green';    // High Confidence
    if (confidence >= 70) return 'blue';     // Moderate Risk
    if (confidence >= 59) return 'orange';    // High Risk
    return 'red';                             // Extreme Risk
}
```

---

## 12. FOOTBALL DATA INTEGRATION RULES

### 12.1 Sport Synchronization (`supabase/migrations/20260512000010_populate_sport_sync.sql`)

```sql
INSERT INTO sport_sync (sport, enabled, adapter_name, provider, sync_interval_minutes, supports_odds, supports_player_stats) VALUES
('football', true, 'footballAdapter', 'api-football', 360, true, true);
```

### 12.2 Active Sports Configuration (`backend/config/activeSports.js`)
```javascript
const ACTIVE_SPORTS = {
    football: {
        enabled: true,
        adapter: 'footballAdapter',
        provider: 'api-football',
        syncInterval: 360,
        supportsOdds: true,
        supportsPlayerStats: true,
        targetLeagues: 66
    }
};
```

---

## 13. FOOTBALL VALIDATION & COMPLIANCE

### 13.1 Market Validation Rules
- **Red Card Markets**: BANNED (red_cards_over_0_5, red_cards_under_0_5, etc.)
- **Minimum Confidence**: 76% for all secondary markets
- **Maximum Secondary Markets**: 4 per fixture
- **Database Enforcement**: All rules enforced at schema level

### 13.2 Compliance Triggers
```sql
-- Weekly publication lock
CREATE TRIGGER enforce_anti_correlation_lock ON public.direct1x2_prediction_final
FOR EACH ROW EXECUTE FUNCTION trg_enforce_weekly_fixture_lock();

-- Secondary market governance
CREATE TRIGGER enforce_secondary_market_governance ON public.direct1x2_prediction_final
FOR EACH ROW EXECUTE FUNCTION trg_enforce_secondary_market_governance();
```

---

## 14. FOOTBALL API ENDPOINTS

### 14.1 Core Football APIs
- `GET /api/predictions` - Main football predictions
- `GET /api/ai-predictions/:matchId` - AI-powered match analysis
- `GET /api/football/count` - Football predictions count
- `GET /api/football/insights` - Football insights
- `GET /api/pipeline/refresh-football` - Football pipeline refresh
- `GET /api/pipeline/sync-football` - Football data sync

### 14.2 Football-Specific Routes
```javascript
// Football router mounted at /api/football
app.use('/api/football', footballRouter);

// Football-specific middleware
router.get('/count', requireSupabaseUser, async (req, res) => {
    // Football count logic with sport filter
});
```

---

## 15. FOOTBALL ERROR HANDLING & FALLBACKS

### 15.1 Fallback Ladder System
```javascript
const FALLBACK_LADDER = [
    { pass: 'tier_1_80_plus', tiers: [1], min_confidence: 80, safeTier3Only: false, directSafeOnly: false },
    { pass: 'tier_1_76_plus', tiers: [1], min_confidence: 76, safeTier3Only: false, directSafeOnly: false },
    { pass: 'tier_1_2_76_plus', tiers: [1, 2], min_confidence: 76, safeTier3Only: false, directSafeOnly: false },
    { pass: 'all_tiers_76_plus', tiers: [1, 2, 3], min_confidence: 76, safeTier3Only: true, directSafeOnly: false },
    { pass: 'forced_safe_pool', tiers: [1, 2, 3], min_confidence: 80, safeTier3Only: false, directSafeOnly: true }
];
```

### 15.2 Error Recovery Rules
- **Cache Miss**: Fall back to core pipeline
- **Database Failure**: Continue with in-memory processing
- **API Timeout**: Use cached data with timestamp validation
- **Invalid Data**: Apply normalization and validation rules

---

## CONCLUSION

This comprehensive report documents EVERY football rule, algorithm, constraint, and governance mechanism in the SKCS AI Sports Edge ecosystem:

### **Key Systems Documented:**
1. ✅ **4-Tier Risk Framework** with mandatory secondary insights
2. ✅ **100+ Market Types** with priority tiers and correlation rules
3. ✅ **Multi-Stage AI Pipeline** with probability adjustment algorithms
4. ✅ **Database-Level Governance** with triggers and constraints
5. ✅ **ACCA Building Rules** with confidence requirements
6. ✅ **Context Intelligence** with weather, injury, H2H analysis
7. ✅ **Frontend Display Rules** with risk color coding
8. ✅ **API Integration** with football-specific endpoints
9. ✅ **Error Handling** with fallback ladder system
10. ✅ **Compliance Framework** with validation and enforcement

### **Critical Numbers:**
- **76%**: Minimum confidence for secondary markets
- **4**: Maximum secondary insights per match
- **80%**: High confidence threshold
- **59%**: High risk threshold requiring secondary insights
- **58%**: Extreme risk threshold with mandatory warnings
- **66**: Target football leagues
- **360**: Sync interval in minutes

The football ecosystem is comprehensively governed with multiple layers of validation, enforcement, and fallback mechanisms to ensure prediction quality and user safety.

---

*Report Generated: 2026-05-15*  
*System: SKCS AI Sports Edge*  
*Scope: FULL FOOTBALL ECOSYSTEM*  
*Status: COMPREHENSIVE ANALYSIS COMPLETE*
