# Sport Consistency & Risk Assessment Audit Report
**Generated:** 2026-05-24  
**Scope:** Supabase, GitHub (backend/frontend), Vercel, Render, SKCS AI Sports Edge.co.za

> **Current state note (2026-06):** Threshold bands are aligned to Master Rulebook `75/55/30`, secondary floor `72%`, separate Double Chance, and Same Match Builder `4/6/8`. Enum label notes below may still reference legacy `HIGH_CONFIDENCE` / `MODERATE_RISK` names where DB migrations have not fully renamed values.

---

## Executive Summary

**Critical Issues Found:**
1. **Database sport values have inconsistent capitalization** across tables (mixed lowercase/Title Case)
2. **SPORT_FILTER_MAP inconsistency** between `predictions.js` (Title Case keys) and `debug.js` (lowercase keys)
3. **Frontend data files use inconsistent sport naming** (lowercase vs Title Case vs multi-word)
4. **Risk tier classification mostly consistent** but one file still uses old labels

**Overall Risk Level:** ⚠️ **MEDIUM** - Functional but requires standardization for reliability

---

## 1. Supabase Database Audit

### 1.1 predictions_raw Table
**Status:** ❌ **INCONSISTENT** - Mixed capitalization

| Sport Value | Row Count | Issue |
|-------------|-----------|-------|
| afl | 158 | Should be "AFL" |
| AFL | 1 | ✅ Correct |
| american_football | 1 | Should be "NFL" (per activeSports.js mapping) |
| baseball | 5,329 | Should be "MLB" |
| basketball | 9,728 | Should be "Basketball" |
| Basketball | 2 | ✅ Correct |
| cricket | 62 | Should be "Cricket" |
| football | 23,792 | Should be "Football" |
| formula1 | 457 | Should be "F1" |
| handball | 1,448 | Should be "Handball" |
| hockey | 7,392 | Should be "NHL" |
| MLB | 23 | ✅ Correct |
| mma | 355 | Should be "MMA" |
| MMA | 2 | ✅ Correct |
| nba | 1,168 | Should be "Basketball" |
| nfl | 232 | Should be "NFL" |
| NFL | 18 | ✅ Correct |
| NHL | 5 | ✅ Correct |
| rugby | 11,567 | Should be "Rugby" |
| tennis | 14 | Should be "Tennis" |
| volleyball | 2,797 | Should be "Volleyball" |

**Total Affected Rows:** ~55,000 rows need sport value normalization

### 1.2 direct1x2_prediction_final Table
**Status:** ✅ **CONSISTENT**

| Sport Value | Row Count | Issue |
|-------------|-----------|-------|
| Football | 543 | ✅ Correct Title Case |

### 1.3 predictions_unified Table
**Status:** ❌ **INCONSISTENT**

| Sport Value | Row Count | Issue |
|-------------|-----------|-------|
| football | 10 | Should be "Football" |

### 1.4 fixtures Table
**Status:** ❌ **INCONSISTENT**

| Sport Value | Row Count | Issue |
|-------------|-----------|-------|
| cricket | 1 | Should be "Cricket" |

### 1.5 JSONB Metadata Fields
**Status:** ✅ **CONSISTENT** (direct1x2_prediction_final.matches[0].sport)
- All 543 rows have "Football" in matches JSONB

**Status:** ✅ **EMPTY** (predictions_raw.metadata->sport)
- No sport values in metadata JSONB field

---

## 2. Backend Code Audit

### 2.1 SPORT_FILTER_MAP Inconsistency

#### File: `backend/routes/predictions.js` (Line 30-56)
**Status:** ✅ **CORRECT** - Uses Title Case keys

```javascript
const SPORT_FILTER_MAP = {
    Football: ['Football', 'football', 'soccer', 'soccer_epl', ...],
    Basketball: ['Basketball', 'basketball', 'nba', 'basketball_nba', ...],
    NFL: ['NFL', 'nfl', 'american_football', 'americanfootball_nfl'],
    Rugby: ['Rugby', 'rugby', 'rugbyunion_international', ...],
    NHL: ['NHL', 'nhl', 'hockey', 'icehockey_nhl'],
    MLB: ['MLB', 'mlb', 'baseball', 'baseball_mlb'],
    AFL: ['AFL', 'afl', 'aussierules_afl'],
    MMA: ['MMA', 'mma', 'mma_mixed_martial_arts'],
    F1: ['F1', 'formula1'],
    Handball: ['Handball', 'handball'],
    Volleyball: ['Volleyball', 'volleyball'],
    Cricket: ['Cricket', 'cricket'],
    Esports: ['Esports', 'esports']
};
```

#### File: `backend/routes/debug.js` (Line 10-30)
**Status:** ❌ **INCONSISTENT** - Uses lowercase keys

```javascript
const SPORT_FILTER_MAP = {
    football: ['football', 'soccer_epl', ...],
    basketball: ['basketball', 'nba', ...],
    nfl: ['nfl', 'american_football', ...],
    rugby: ['rugby', 'rugbyunion_international', ...],
    hockey: ['hockey', 'icehockey_nhl'],
    baseball: ['baseball', 'baseball_mlb'],
    afl: ['afl', 'aussierules_afl'],
    mma: ['mma', 'mma_mixed_martial_arts'],
    formula1: ['formula1'],
    handball: ['handball'],
    volleyball: ['volleyball'],
    cricket: ['cricket']
};
```

**Impact:** Debug route uses different normalization than main predictions route

### 2.2 Active Sports Configuration

#### File: `backend/config/activeSports.js`
**Status:** ✅ **CORRECT** - Uses Title Case

```javascript
const DEFAULT_ACTIVE_SPORTS = [
    'Football', 'Basketball', 'Rugby', 'NFL', 'MLB', 'NHL',
    'Volleyball', 'Handball', 'AFL', 'MMA', 'Golf', 'Boxing',
    'Tennis', 'Cricket', 'Esports', 'Darts'
];
```

**Normalization Function:** ✅ **CORRECT**
- Maps lowercase variants to Title Case
- Examples: `football` → `Football`, `nfl` → `NFL`, `baseball` → `MLB`

### 2.3 Sport Normalization Functions

#### File: `backend/services/accaBuilder.js` (Line 777-792)
**Status:** ✅ **CORRECT** - Normalizes to Title Case

```javascript
function normalizeSportKey(value) {
    const key = String(value || '').trim().toLowerCase();
    if (!key) return 'unknown';
    
    if (key === 'soccer' || key === 'football' || key.startsWith('soccer_')) return 'Football';
    if (key === 'nba' || key === 'basketball' || key.startsWith('basketball_')) return 'Basketball';
    // ... more mappings
}
```

**Consistent across:** `aiPipeline.js`, `syncService.js`, `dataProvider.js`

---

## 3. Frontend Code Audit

### 3.1 Configuration Files

#### File: `public/js/config.js`
**Status:** ✅ **NO SPORT REFERENCES** - Only API endpoints and Supabase config

### 3.2 Static Data Files

#### File: `public/data/vip-stress-saturday.json`
**Status:** ❌ **INCONSISTENT** - Uses lowercase "football"

```json
{
  "sport": "football",
  "market": "match_result",
  ...
}
```

#### File: `public/data/team-form-2026-05-17.json`
**Status:** ❌ **INCONSISTENT** - Uses multi-word sport names

```json
{
  "sport": "American Football",
  ...
},
{
  "sport": "Australian Football",
  ...
}
```

**Issue:** These don't match backend Title Case standard (should be "NFL", "AFL")

#### File: `public/index.html` (Line 423)
**Status:** ✅ **CORRECT** - Marketing text uses Title Case

```html
<p>16 sports covered: Football, Rugby, AFL, Baseball, Basketball, Formula 1, Cricket, NFL, Hockey, MMA, Handball, Volleyball, and Tennis.</p>
```

### 3.3 JavaScript Files

#### File: `public/js/smh-hub.js` (Line 312-316)
**Status:** ⚠️ **PARTIAL** - Has sport alias mapping but uses lowercase

```javascript
var sportAliases = {};
if (sportLower === 'football') {
    sportAliases['soccer'] = true;
}
```

---

## 4. Risk Tier Classification Audit

### 4.1 Database Enum Values
**Status:** ✅ **CORRECT** - Uses DB enum labels

```sql
risk_tier_enum: HIGH_CONFIDENCE, MODERATE_RISK, HIGH_RISK, EXTREME_RISK
```

### 4.2 Backend Services

#### File: `backend/services/aiPipelineOrchestrator.js` (Line 589-594)
**Status:** ✅ **CORRECT** - Updated to use DB enum labels with v2 thresholds

```javascript
determineRiskTier(confidence) {
    if (confidence >= 75) return 'HIGH_CONFIDENCE';
    if (confidence >= 55) return 'MODERATE_RISK';
    if (confidence >= 30) return 'HIGH_RISK';
    return 'EXTREME_RISK';
}
```

#### File: `backend/services/direct1x2Engine.js` (Line 210-220)
**Status:** ✅ **CORRECT** - Updated to use DB enum labels

```javascript
if (confidence >= 30 && confidence <= 54) {
    tier = 'HIGH_RISK';
} else if (confidence >= 55 && confidence <= 74) {
    tier = 'MODERATE_RISK';
} else if (confidence >= 75) {
    tier = 'HIGH_CONFIDENCE';
}
```

#### File: `backend/services/footballRiskTierMapper.js` (Line 3-16)
**Status:** ✅ **CORRECT** - Maps old labels to new DB enum labels

```javascript
const LEGACY_TO_CANONICAL = Object.freeze({
    EXTREME_CAUTION: 'EXTREME_RISK',
    MODERATE_HIGH_CAUTION: 'HIGH_RISK',
    STRONG: 'HIGH_CONFIDENCE',
    LOW_RISK: 'HIGH_CONFIDENCE',
    MEDIUM_RISK: 'MODERATE_RISK'
});
```

#### File: `backend/services/masterRulebookRiskClassification.js` (Line 9-16)
**Status:** ⚠️ **INCONSISTENT** - Still uses old labels for UI/display

```javascript
function determineRiskTier(confidence) {
    if (!Number.isFinite(confidence)) return 'EXTREME_RISK';
    
    if (confidence >= 75) return 'LOW_RISK';  // ❌ Should be HIGH_CONFIDENCE
    if (confidence >= 55) return 'MEDIUM_RISK'; // ❌ Should be MODERATE_RISK
    if (confidence >= 30) return 'HIGH_RISK';
    return 'EXTREME_RISK';
}
```

**Impact:** This file is used for UI display labels, not DB storage. May cause confusion but doesn't break functionality.

### 4.3 Risk Thresholds
**Status:** ✅ **CONSISTENT** - Master Rulebook v2 (75/55/30/0) applied

- **HIGH_CONFIDENCE:** confidence >= 75%
- **MODERATE_RISK:** confidence >= 55%
- **HIGH_RISK:** confidence >= 30%
- **EXTREME_RISK:** confidence < 30%

---

## 5. Deployment Platforms

### 5.1 GitHub (deploy/main)
**Status:** ✅ **DEPLOYED** - Latest commit 25bfc56 includes risk tier updates

### 5.2 Render (Backend)
**Status:** ✅ **AUTO-DEPLOYING** - Triggers from deploy/main
- URL: https://skcs-sports-edge-skcsai.onrender.com
- Environment: Uses `ACTIVE_DEPLOYMENT_SPORTS` env var or defaults

### 5.3 Vercel (Frontend)
**Status:** ✅ **AUTO-DEPLOYING** - Triggers from deploy/main
- URL: https://skcs.co.za
- Uses same codebase as GitHub

### 5.4 Production API
**Status:** ✅ **OPERATIONAL** - Backend code deployed with updated risk tiers

---

## 6. Recommendations

### 6.1 HIGH PRIORITY - Database Sport Normalization

**Action Required:** Normalize all sport values in Supabase tables to Title Case

**SQL Fix:**
```sql
-- predictions_raw
UPDATE predictions_raw SET sport = 'AFL' WHERE sport = 'afl';
UPDATE predictions_raw SET sport = 'Basketball' WHERE sport = 'basketball';
UPDATE predictions_raw SET sport = 'Cricket' WHERE sport = 'cricket';
UPDATE predictions_raw SET sport = 'Football' WHERE sport = 'football';
UPDATE predictions_raw SET sport = 'F1' WHERE sport = 'formula1';
UPDATE predictions_raw SET sport = 'Handball' WHERE sport = 'handball';
UPDATE predictions_raw SET sport = 'MLB' WHERE sport = 'baseball' OR sport = 'MLB';
UPDATE predictions_raw SET sport = 'MMA' WHERE sport = 'mma';
UPDATE predictions_raw SET sport = 'NBA' WHERE sport = 'nba'; -- or Basketball
UPDATE predictions_raw SET sport = 'NFL' WHERE sport = 'nfl' OR sport = 'american_football';
UPDATE predictions_raw SET sport = 'NHL' WHERE sport = 'hockey';
UPDATE predictions_raw SET sport = 'Rugby' WHERE sport = 'rugby';
UPDATE predictions_raw SET sport = 'Tennis' WHERE sport = 'tennis';
UPDATE predictions_raw SET sport = 'Volleyball' WHERE sport = 'volleyball';

-- predictions_unified
UPDATE predictions_unified SET sport = 'Football' WHERE sport = 'football';

-- fixtures
UPDATE fixtures SET sport = 'Cricket' WHERE sport = 'cricket';
```

### 6.2 MEDIUM PRIORITY - Code Consistency

**Action Required:** Fix SPORT_FILTER_MAP in debug.js to match predictions.js

**File:** `backend/routes/debug.js` (Line 10-30)
- Change keys from lowercase to Title Case
- Align with predictions.js SPORT_FILTER_MAP

### 6.3 MEDIUM PRIORITY - Frontend Data Files

**Action Required:** Update static JSON files to use Title Case sport names

**Files:**
- `public/data/vip-stress-saturday.json` - Change "football" to "Football"
- `public/data/team-form-*.json` - Change "American Football" to "NFL", "Australian Football" to "AFL"

### 6.4 LOW PRIORITY - UI Label Consistency

**Action Required:** Update masterRulebookRiskClassification.js to use DB enum labels

**File:** `backend/services/masterRulebookRiskClassification.js` (Line 9-16)
- Change return values to match DB enum (HIGH_CONFIDENCE, MODERATE_RISK)
- Update getRiskTierLabel() mapping accordingly

**Note:** This is for UI display only, doesn't affect DB storage or API functionality.

### 6.5 PREVENTATIVE - Add Validation

**Action Required:** Add database constraints or application-level validation to ensure sport values are always Title Case

**Options:**
1. Add CHECK constraint on sport columns
2. Add trigger to normalize sport values on INSERT/UPDATE
3. Add validation middleware in API routes

---

## 7. Summary Statistics

| Component | Status | Issues | Affected Items |
|----------|--------|--------|----------------|
| Supabase Database | ❌ Inconsistent | 21 sport value variants | ~55,000 rows |
| Backend Code | ⚠️ Partially Consistent | 2 SPORT_FILTER_MAP variants | 2 files |
| Frontend Code | ⚠️ Partially Consistent | Mixed case in data files | 5+ JSON files |
| Risk Classification | ✅ Consistent | 1 UI label mismatch | 1 file |
| Deployment | ✅ Consistent | None | All platforms |

---

## 8. Conclusion

The SKCS AI Sports Edge environment has **inconsistent sport naming** across the database and some code files, but the **risk tier classification is largely consistent** after recent updates. The primary issues are:

1. **Database sport values** need normalization to Title Case (~55,000 rows affected)
2. **SPORT_FILTER_MAP** needs standardization between routes
3. **Frontend data files** need sport name updates

These inconsistencies don't currently break functionality due to normalization functions, but they create maintenance overhead and potential for bugs. Implementing the recommendations above will improve system reliability and maintainability.

**Overall Assessment:** System is functional but requires cleanup for long-term stability.
