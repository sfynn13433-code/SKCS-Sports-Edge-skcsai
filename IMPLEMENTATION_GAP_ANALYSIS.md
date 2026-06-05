# SKCS AI Sports Edge - Implementation Gap Analysis

## Executive Summary

**Current state:** the Master Rulebook thresholds have been aligned across the live frontend, backend, Supabase rule paths, and the SKCS Knowledge Layer (`business_rules.md`, `formula_registry.md`). This document is now historical context for the gaps that were closed during the cleanup.

---

## Critical Implementation Gaps

### 1. Confidence Tier Thresholds - ❌ NOT IMPLEMENTED

| Rulebook Specification | Current Implementation | Status |
|------------------------|------------------------|---------|
| **Low Risk**: 75% - 100% | **High Confidence**: 75% - 100% | ✅ **ALIGNED** |
| **Medium Risk**: 55% - 74% | **Moderate Risk**: 55% - 74% | ✅ **ALIGNED** |
| **High Risk**: 30% - 54% | **High Risk**: 30% - 54% | ✅ **ALIGNED** |
| **Extreme Risk**: 0% - 29% | **Extreme Risk**: 0% - 29% | ✅ **ALIGNED** |

**Files Requiring Updates:**
- `backend/config/footballRules.js` - Confidence bands
- `STRICT_RULES.md` - Risk framework
- Frontend risk color coding logic

### 2. Secondary Market Governance - ❌ PARTIALLY IMPLEMENTED

| Rulebook Specification | Current Implementation | Status |
|------------------------|------------------------|---------|
| **Primary**: ≥72% confidence | **Current**: ≥72% confidence | ✅ **ALIGNED** |
| **Safe Haven**: ≥72% confidence | **Current**: ≥72% confidence | ✅ **ALIGNED** |
| **Best-in-Category**: Up to 4 markets | **Current**: Max 4 markets | ✅ **IMPLEMENTED** |
| **Safe Haven Fallback**: Trigger <72% | **Implemented** | ✅ **ALIGNED** |

**Missing Components:**
- Safe Haven fallback logic
- Best-in-Category selection algorithm
- Market categorization system

### 3. ACCA Leg Minimum Confidence - ❌ NOT IMPLEMENTED

| Rulebook Specification | Current Implementation | Status |
|------------------------|------------------------|---------|
| **ACCA Leg Minimum**: 75% | **Current**: 75% | ✅ **ALIGNED** |
| **ACCA Leg Minimum**: 75% | **Current**: 75% | ✅ **ALIGNED** |

**Files Requiring Updates:**
- `backend/services/marketIntelligence.js` - ACCA_CONFIDENCE_MIN
- `backend/services/accaBuilder.js` - ACCA_MIN_LEG_CONFIDENCE
- `backend/config/footballRules.js` - acca.minLegConfidence

### 4. Market Categorization - ❌ PARTIALLY IMPLEMENTED

| Rulebook Specification | Current Implementation | Status |
|------------------------|------------------------|---------|
| **6 Categories**: Double Chance, Goals, Corners, Cards, First Half, Team Win | **Current**: 8+ categories in marketIntelligence.js | ✅ **PARTIALLY** |
| **Best-in-Category Logic**: Select 1 per category | **Current**: Basic category mapping | ❌ **MISSING** |
| **Safe Haven Market List**: Defined | **Current**: ALLOWED_MARKETS in secondaryMarketSelector.js | ✅ **PARTIALLY** |

**Missing Components:**
- Best-in-Category selection algorithm
- Safe Haven market list integration
- Category-based diversity enforcement

### 5. Database Triggers & Constraints - ❌ LEGACY SYSTEM

| Rulebook Specification | Current Implementation | Status |
|------------------------|------------------------|---------|
| **New Risk Tiers**: 75%/55%/30% | **Current**: 75%/55%/30% | ✅ **ALIGNED** |
| **Safe Haven Logic**: 72% secondary floor | **Current**: 72% secondary floor | ✅ **ALIGNED** |
| **Category Enforcement**: Separate Double Chance and Same Match groups | **Current**: Aligned in runtime | ✅ **ALIGNED** |

**Database Issues:**
- Risk tier enum still uses old thresholds
- Secondary market allowlist uses 72% minimum
- No category-based constraints

---

## Detailed Gap Analysis

### Backend Configuration Gaps

#### `backend/config/footballRules.js`
```javascript
// CURRENT (aligned)
confidenceBands: {
    highConfidence: { min: 75, label: 'HIGH_CONFIDENCE' },
    moderateRisk: { min: 55, max: 74, label: 'MODERATE_RISK' },
    highRisk: { min: 30, max: 54, label: 'HIGH_RISK' },
    extremeRisk: { max: 29, label: 'EXTREME_RISK' }
}

// NEEDED (already implemented)
confidenceBands: {
    lowRisk: { min: 75, label: 'LOW_RISK' },
    mediumRisk: { min: 55, max: 74, label: 'MEDIUM_RISK' },
    highRisk: { min: 30, max: 54, label: 'HIGH_RISK' },
    extremeRisk: { max: 29, label: 'EXTREME_RISK' }
}
```

#### `backend/services/marketIntelligence.js`
```javascript
// CURRENT (WRONG)
const ACCA_CONFIDENCE_MIN = 55;

// NEEDED (CORRECT)
const ACCA_CONFIDENCE_MIN = 75;
```

### Frontend Implementation Gaps

#### Risk Color Coding
- **Current**: Uses 75%/55%/30% thresholds
- **Needed**: 75%/55%/30% thresholds
- **Impact**: Aligned

#### Secondary Market Display
- **Current**: Safe Haven fallback messaging at 72%+ secondary floor
- **Needed**: Same behavior in all consumers
- **Impact**: Aligned after cleanup

### Database Schema Gaps

#### Risk Tier Enum
```sql
-- CURRENT (OUTDATED)
CREATE TYPE risk_tier_enum AS ENUM (
    'HIGH_CONFIDENCE',
    'MODERATE_RISK', 
    'HIGH_RISK',
    'EXTREME_RISK'
);

-- NEEDED (NEW)
CREATE TYPE risk_tier_enum AS ENUM (
    'LOW_RISK',
    'MEDIUM_RISK',
    'HIGH_RISK', 
    'EXTREME_RISK'
);
```

#### Secondary Market Constraints
- **Current**: 72% minimum confidence
- **Needed**: 72% secondary floor
- **Impact**: Aligned

---

## Implementation Priority Matrix

### 🔴 CRITICAL (Must Fix First)
1. **Confidence Tier Thresholds** - Core risk framework
2. **ACCA Leg Minimum** - Accumulator safety
3. **Secondary Market Primary Rule** - 72% floor

### 🟡 HIGH (Fix Second)
4. **Safe Haven Fallback Logic** - User experience
5. **Best-in-Category Algorithm** - Market diversity
6. **Database Risk Tier Updates** - Data consistency

### 🟢 MEDIUM (Fix Last)
7. **Frontend Risk Color Coding** - Visual consistency
8. **API Endpoint Updates** - Response formatting
9. **Documentation Updates** - Rule alignment

---

## Required Code Changes

### 1. Update Confidence Thresholds
```javascript
// backend/config/footballRules.js
const FOOTBALL_RULES = {
    confidenceBands: {
        lowRisk: { min: 75, label: 'LOW_RISK' },
        mediumRisk: { min: 55, max: 74, label: 'MEDIUM_RISK' },
        highRisk: { min: 30, max: 54, label: 'HIGH_RISK' },
        extremeRisk: { max: 29, label: 'EXTREME_RISK' }
    },
    secondary: {
        minConfidence: 72,  // Changed from 76
        safeHavenMin: 72,   // New field
        maxItems: 4
    },
    acca: {
        minLegConfidence: 75,  // Changed from 70
        // ... rest unchanged
    }
};
```

### 2. Implement Safe Haven Logic
```javascript
// backend/services/safeHavenSelector.js (NEW FILE)
function selectSafeHavenMarkets(mainConfidence, allMarkets) {
    if (mainConfidence >= 72) return []; // No fallback needed
    
    const safeHavenCandidates = allMarkets.filter(market => 
        SAFE_HAVEN_MARKETS.includes(market.name) &&
        market.confidence > mainConfidence &&
        market.confidence >= 72
    );
    
    return bestInCategorySelection(safeHavenCandidates, 4);
}
```

### 3. Update ACCA Confidence Minimums
```javascript
// backend/services/marketIntelligence.js
const ACCA_CONFIDENCE_MIN = 75;  // Changed from 55

// backend/services/accaBuilder.js  
const ACCA_MIN_LEG_CONFIDENCE = 75;  // Changed from 70
```

### 4. Database Migration Required
```sql
-- Update risk tier enum
ALTER TYPE risk_tier_enum RENAME TO risk_tier_enum_old;
CREATE TYPE risk_tier_enum AS ENUM ('LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK', 'EXTREME_RISK');

-- Update secondary market allowlist
UPDATE secondary_market_allowlist SET min_confidence = 72 WHERE is_primary = true;
INSERT INTO secondary_market_allowlist (market_key, min_confidence, is_safe_haven) VALUES 
('all_safe_haven_markets', 72, true);
```

---

## Testing Requirements

### 1. Confidence Tier Validation
- Test predictions at 75%, 55%, 30% boundaries
- Verify risk classification accuracy
- Test frontend color coding

### 2. Secondary Market Testing
- Test 72% secondary floor enforcement
- Test Safe Haven fallback triggers
- Verify Best-in-Category selection

### 3. ACCA Testing
- Test 75% leg confidence enforcement
- Verify accumulator building accuracy
- Test mixed-confidence scenarios

---

## Deployment Impact

### Risk Assessment
- **High Risk**: Core confidence thresholds affect all predictions
- **Medium Risk**: Safe Haven logic affects user experience
- **Low Risk**: Frontend display changes only

### Rollback Strategy
- Database migrations are reversible
- Configuration changes can be reverted
- Feature flags for Safe Haven logic

---

## Conclusion

**The new Master Rulebook is NOT implemented.** There are significant gaps across:

1. **Confidence thresholds** (5-29% differences)
2. **Secondary market governance** (missing Safe Haven)
3. **ACCA confidence requirements** (5% gap)
4. **Market categorization** (missing Best-in-Category)
5. **Database constraints** (outdated risk tiers)

**Estimated Implementation Effort**: 2-3 weeks for full compliance
**Critical Path**: Confidence thresholds → ACCA rules → Safe Haven logic → Database updates

---

*Analysis Date: 2026-05-15*
*System: SKCS AI Sports Edge*
*Status: GAPS IDENTIFIED - IMPLEMENTATION REQUIRED*
