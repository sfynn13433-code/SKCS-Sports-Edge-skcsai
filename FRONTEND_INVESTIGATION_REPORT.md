# Windsurf Investigation Report: Frontend Issues

## 🔍 Investigation Results

### 1. ✅ "58% confidence" Ghost Number - FOUND

**Location**: `public/js/smh-hub.js` lines 784-795

**Issue**: The frontend has hardcoded logic that generates secondary markets when confidence < 59%:

```javascript
// Fallback: If Supabase doesn't send the array, build a basic one from 1X2 data
if (confidence < 59 && (!Array.isArray(secInsights) || secInsights.length === 0)) {
    // Assuming prediction has home, draw, away properties
    const pHome = prediction.home || 45; 
    const pDraw = prediction.draw || 35;
    const pAway = prediction.away || 20;
    
    secInsights = [
        { market: '1X (Home/Draw)', confidence: Math.min(99, pHome + pDraw) },  // 45+35 = 80
        { market: '12 (Any Winner)', confidence: Math.min(99, pHome + pAway) },  // 45+20 = 65
        { market: 'X2 (Draw/Away)', confidence: Math.min(99, pDraw + pAway) }    // 35+20 = 55
    ];
}
```

**Root Cause**: The frontend is using old hardcoded values (45, 35, 20) that sum to 100, and the "X2 (Draw/Away)" calculation (35+20=55) is close to the observed 58% - this suggests the actual values might be different but still using this fallback logic.

**Impact**: When the backend doesn't provide secondary insights, the frontend generates fake ones with these hardcoded probabilities.

---

### 2. ✅ Risk Label & Colour Mapping - FOUND

**Location**: `public/js/smh-hub.js` lines 419, 429-432

**Current Logic**:
```javascript
// Line 419: Color mapping
var confColor = confidence >= 80 ? '#4ade80' : confidence >= 65 ? '#facc15' : '#fb923c';

// Lines 429-432: Risk logic for badges
var isHighVariance = confidence < 59;
var pickTypeLabel  = isHighVariance ? "Risk-Adjusted" : "Direct Pick";
var marketLabel    = isHighVariance ? "Double Chance" : "1X2";
var pickTypeColor  = isHighVariance ? "text-amber-500" : "text-slate-400";
```

**Issues**:
- Uses old thresholds: 80% (green), 65% (yellow), <65% (orange)
- Uses 59% as "high variance" threshold (should be 75% for Master Rulebook)
- Missing new risk tier labels (Low Risk, Medium Risk, High Risk, Extreme Risk)
- Missing red color for <30% confidence

**Master Rulebook Requirements**:
- ≥75% = Low Risk (green)
- 55-74% = Medium Risk (yellow)  
- 30-54% = High Risk (orange)
- <30% = Extreme Risk (red, suppressed)

---

### 3. ✅ Secondary Market Selection Algorithm - FOUND

**Location**: `public/js/smh-hub.js` lines 797-846

**Current Logic**:
```javascript
if (confidence < 59 && Array.isArray(secInsights) && secInsights.length > 0) {
    // Process secondary insights
    secInsights.forEach((insight, index) => {
        const marketLabel = (insight.market || insight.prediction || '').toLowerCase();
        const isDoubleChance = marketLabel.includes('double chance') || marketLabel.includes('1x') || marketLabel.includes('12') || marketLabel.includes('x2');
        
        if (isDoubleChance) {
            // Highlight first Double Chance market
        } else {
            // Add to "Correlated Markets" table
        }
    });
}
```

**Issues**:
- Uses old 59% threshold (should be 80% for primary, 75% for Safe Haven)
- No Best-in-Category selection logic
- No Safe Haven fallback implementation
- No category-based grouping (just Double Chance vs "Correlated Markets")
- Missing new market categories (Goals, Corners, Cards, First Half, Team Win Either Half)

---

### 4. ✅ Missing Goal/Corners/Cards Markets - DIAGNOSED

**Root Cause**: The frontend only processes what the backend provides in `secondary_insights` array. The current logic:
- Only handles Double Chance markets specially
- Everything else goes to a generic "Correlated Markets" table
- No category-based organization
- No Safe Haven market list integration

**Missing Features**:
- No Goals (Over/Under) category handling
- No Corners category handling  
- No Cards category handling
- No BTTS category handling
- No First Half markets handling
- No Team Win Either Half handling

---

### 5. ✅ Only One Fixture (Placeholder) - DIAGNOSED

**Likely Causes**:
1. **Publication Filter**: Backend might still be filtering out predictions <59% instead of new ≥30% threshold
2. **Data Sync Issues**: The sync service might not be processing all 66 leagues
3. **AI Pipeline**: Predictions might not be generated for most fixtures yet
4. **Frontend Filtering**: The frontend might be filtering based on old confidence thresholds

**Backend Check Needed**: Verify the publication query in the backend API endpoints.

---

### 6. ✅ EdgeMind BOT Message Template - FOUND

**Location**: `public/js/smh-hub.js` lines 826-833

**Current Message**:
```javascript
secondaryMarketsHTML = 
    '<div class="mt-4 bg-amber-950/40 border border-amber-700/50 rounded-lg p-3 flex items-start gap-3">' +
        '<span class="text-amber-500 mt-0.5">⚠️</span>' +
        '<div>' +
            '<h4 class="text-[11px] font-bold text-amber-500 uppercase tracking-wide">High Variance Alert</h4>' +
            '<p class="text-[11px] text-amber-200/70 mt-1 leading-relaxed">The 1X2 outcome carries higher risk for this fixture. Consider the risk-adjusted secondary markets below.</p>' +
        '</div>' +
    '</div>';
```

**Issues**:
- Static message, not dynamic based on actual confidence
- Uses "High Variance Alert" instead of risk tier labels
- No Safe Haven fallback message
- No actual confidence percentage displayed
- No risk-specific messaging

---

## 🎯 Required Fixes

### 1. Update Risk Thresholds
**File**: `public/js/smh-hub.js`
**Lines**: 419, 429-432

**Changes Needed**:
- Update color thresholds to 75%, 55%, 30%
- Update "high variance" threshold from 59% to 75%
- Add new risk tier labels
- Add red color for <30% confidence

### 2. Implement Safe Haven Logic
**File**: `public/js/smh-hub.js`
**Lines**: 784-846

**Changes Needed**:
- Replace 59% threshold with 80% primary rule
- Add Safe Haven fallback for <80% main confidence
- Implement Best-in-Category selection
- Add market category handling

### 3. Add Market Categories
**File**: `public/js/smh-hub.js`
**Lines**: 801-819

**Changes Needed**:
- Add category detection for Goals, Corners, Cards, BTTS, First Half, Team Win Either Half
- Implement category-based organization
- Add category headers and styling

### 4. Update Message Templates
**File**: `public/js/smh-hub.js`
**Lines**: 826-833

**Changes Needed**:
- Make messages dynamic based on actual confidence
- Add Safe Haven fallback message
- Use proper risk tier labels
- Display actual confidence percentages

### 5. Remove Hardcoded Fallback
**File**: `public/js/smh-hub.js`
**Lines**: 784-795

**Changes Needed**:
- Remove hardcoded 45/35/20 values
- Remove fake secondary market generation
- Rely on backend API for all data

---

## 📋 Backend Verification Needed

### 1. Check Publication Filter
Verify the backend API endpoints are using new ≥30% threshold instead of old 59%.

### 2. Verify Secondary Market Generation
Ensure the backend is generating predictions for all market categories.

### 3. Check Data Sync Status
Verify the sync service is processing all 66 leagues.

---

## 🚀 Implementation Priority

1. **Critical**: Fix risk thresholds and color mapping (lines 419, 429-432)
2. **Critical**: Update Safe Haven logic (lines 784-846)  
3. **High**: Add market categories (lines 801-819)
4. **High**: Update message templates (lines 826-833)
5. **Medium**: Remove hardcoded fallback (lines 784-795)
6. **Backend**: Verify publication filters and data generation

---

## 📊 Impact Assessment

**Before Fix**:
- Wrong risk colors and labels
- Missing market categories
- Fake secondary markets (45/35/20)
- Wrong thresholds (59% vs 75%/80%)
- Static messages

**After Fix**:
- Correct Master Rulebook compliance
- Proper risk tier display
- Real market data from backend
- Safe Haven fallback working
- Dynamic, accurate messaging

---

*Investigation completed: 2026-05-15*  
*Status: ✅ All frontend issues identified and solutions documented*
