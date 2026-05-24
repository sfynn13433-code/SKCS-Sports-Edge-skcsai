# SKCS Single-Use Restriction Audit Report

**Date:** 2026-05-23  
**Objective:** Identify and remove deprecated "global single-use restriction" logic that incorrectly blocks fixtures from appearing in multiple approved insight categories.

---

## Executive Summary

**CRITICAL FINDING:** The deprecated global single-use restriction exists in **3 locations** and must be removed:

1. **Documentation** (3 files) - States incorrect policy
2. **Backend Script** (1 file) - Implements global single-use logic
3. **Database Table** (1 table) - `insight_usage` table implements per-format tracking (MAY need modification depending on requirements)

**CORRECT IMPLEMENTATIONS (to preserve):**
- `team_week_locks` table - Used correctly for ACCA-specific team/competition locks
- `accaBuilder.js` - Correctly isolates ACCA restrictions to ACCA generation only

---

## Detailed Findings

### 🔴 CRITICAL: Deprecated Global Single-Use Logic

#### 1. Documentation - Incorrect Policy Statement

**Files Affected:**
- `TERMS_OF_SERVICE.md` (lines 32-34)
- `public/terms.html` (lines 38-39)
- `public/index.html` (lines 516, 846)

**Current Text:**
> "To maintain independence and reduce correlation risk, SKCS AI Sports Edge operates a single-use insight policy. Once a team or individual is used within an insight, that same match or event will not be reused in any other insight format for the remainder of that calendar week."

**Severity:** HIGH  
**Layer:** Documentation  
**Action Required:** Update to reflect correct policy (ACCA-only restriction)

**Recommended Correction:**
> "To maintain independence and reduce correlation risk, SKCS AI Sports Edge enforces ACCA exposure management. A fixture may appear in multiple insight formats (Direct 1X2, Secondary Insights, Double Chance, Same Bet Builder) but may appear ONLY ONCE within ACCA structures during the same prediction cycle."

---

#### 2. Backend Script - Global Single-Use Implementation

**File:** `scripts/fetch-live-fixtures.js`  
**Lines:** 948-1024

**Problematic Code:**
```javascript
// PHASE 2.5: Get matches used this week to enforce Single-Use Insight Policy
const weekStart = new Date();
weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7) + 1); // Monday
weekStart.setHours(0, 0, 0, 0);

const usedMatchesRes = await client.query(`
    SELECT 
        COALESCE(NULLIF(TRIM(matches->0->>'home_team'), ''), NULLIF(TRIM(matches->0->>'home_team_name'), '')) AS home_team,
        COALESCE(NULLIF(TRIM(matches->0->>'away_team'), ''), NULLIF(TRIM(matches->0->>'away_team_name'), '')) AS away_team
    FROM direct1x2_prediction_final
    WHERE created_at >= $1
      AND LOWER(COALESCE(type, '')) = 'direct'
`, [weekStart.toISOString()]);

for (const row of usedMatchesRes.rows) {
    if (row.home_team && row.away_team) {
        const normHome = normalizeTeamName(row.home_team);
        const normAway = normalizeTeamName(row.away_team);
        dbUsedMatches.add([normHome, normAway].sort().join('-vs-'));
    }
}
console.log(`[STEP 5] Single-Use Policy: found ${dbUsedMatches.size} match signatures already used this week.`);

// Later in the loop:
// Enforce Single-Use Policy for NEW insights
if (!isExisting && dbUsedMatches.has(matchSignature)) {
    continue;
}
```

**Severity:** CRITICAL  
**Layer:** Backend Script  
**Action Required:** Remove this global single-use logic

**Impact:** This code prevents fixtures from appearing in ANY insight format if they've been used in a direct 1X2 prediction earlier in the week, which contradicts the correct SKCS policy.

**Recommended Correction:**
Remove lines 948-1024 and the check at lines 1018-1021. This logic should only apply to ACCA generation, not to general insight discovery.

---

#### 3. Database Table - `insight_usage` (Potential Issue)

**File:** `supabase/migrations/20260415000001_create_insight_usage.sql`

**Table Structure:**
```sql
CREATE TABLE IF NOT EXISTS insight_usage (
    fixture_id UUID PRIMARY KEY,
    week_start DATE NOT NULL DEFAULT date_trunc('week', CURRENT_DATE)::date,
    used_in_direct BOOLEAN DEFAULT false,
    used_in_analytical BOOLEAN DEFAULT false,
    used_in_multi BOOLEAN DEFAULT false,
    used_in_same_match BOOLEAN DEFAULT false,
    used_in_acca BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Backend Implementation:** `backend/utils/insightUsage.js`

**Current Behavior:**
- Tracks fixture usage per format (direct, analytical, multi, same_match, acca)
- The `isFixtureAvailableForFormat()` function checks if a fixture is available for a specific format
- The `filterPredictionsByUsagePolicy()` function filters predictions based on format availability

**Severity:** MEDIUM  
**Layer:** Database / Backend Utils  
**Action Required:** Clarify requirements

**Analysis:**
This implementation is **PER-FORMAT** tracking, not global single-use. A fixture can be used in multiple formats simultaneously (e.g., direct AND analytical). This is actually CORRECT according to the stated requirements.

**However:** The utility is imported in `backend/routes/predictions.js` but not currently used in any route. This suggests it may be dead code or intended for future use.

**Recommended Action:**
- If this is intended for ACCA-only restrictions: Modify to only track `used_in_acca` and remove other format columns
- If this is intended for per-format quotas: Keep as-is (this is correct behavior)
- If this is dead code: Remove the table and utility

---

### ✅ CORRECT: ACCA-Specific Restrictions (Preserve These)

#### 1. `team_week_locks` Table

**Files:**
- `backend/dbBootstrap.js` (line 871)
- `backend/database.js` (line 522)
- `backend/services/accaBuilder.js` (lines 3014, 3202)

**Purpose:** Tracks team/competition pairs used in ACCA structures to prevent duplicate exposure within ACCAs.

**Status:** CORRECT - This is the proper implementation of ACCA-only restrictions.

**DO NOT MODIFY** - This table and its usage in `accaBuilder.js` are aligned with the correct SKCS policy.

---

#### 2. `accaBuilder.js` Team Lock Logic

**File:** `backend/services/accaBuilder.js`

**Functions:**
- `loadWeekLockedTeamCompetitionMap()` (line 3006)
- `isPredictionTeamAllowed()` (line 3143)
- `persistTeamWeekLocks()` (line 3191)
- `collectWeekLockEntriesFromPrediction()` (line 3169)

**Status:** CORRECT - These functions properly isolate ACCA restrictions to ACCA generation only.

**DO NOT MODIFY** - This logic correctly prevents duplicate fixtures within ACCA structures while allowing fixtures to appear in other insight formats.

---

## Severity Classification

| Finding | Severity | Layer | Action Required |
|---------|----------|-------|-----------------|
| Documentation (3 files) | HIGH | Documentation | Update policy statement |
| `fetch-live-fixtures.js` | CRITICAL | Backend Script | Remove global single-use logic |
| `insight_usage` table | MEDIUM | Database | Clarify requirements |
| `team_week_locks` table | N/A | Database | Preserve (correct) |
| `accaBuilder.js` | N/A | Backend Service | Preserve (correct) |

---

## Recommended Correction Plan

### Phase 1: Remove Global Single-Use Logic (CRITICAL)

1. **Remove `fetch-live-fixtures.js` single-use logic:**
   - Delete lines 948-1024
   - Delete lines 1018-1021
   - Remove `dbUsedMatches` variable and all references

2. **Update documentation:**
   - Update `TERMS_OF_SERVICE.md` lines 32-34
   - Update `public/terms.html` lines 38-39
   - Update `public/index.html` lines 516, 846

### Phase 2: Clarify `insight_usage` Table (MEDIUM)

**Option A - Remove entirely (if dead code):**
- Drop `insight_usage` table
- Remove `backend/utils/insightUsage.js`
- Remove import from `backend/routes/predictions.js`

**Option B - Modify for ACCA-only (if needed):**
- Keep table but only use `used_in_acca` column
- Remove other format columns
- Update utility functions to only check ACCA usage

**Option C - Keep as-is (if per-format quotas are desired):**
- No changes needed
- This is correct per-format tracking

### Phase 3: Verification

1. Test that fixtures can appear in multiple non-ACCA formats
2. Verify ACCA restrictions still work correctly
3. Confirm no regression in insight counts

---

## Confirmation of Correct Behavior

After corrections, the system should:

**✅ ALLOWED:**
- Fixture A appears in Direct 1X2
- Fixture A appears in Secondary Insights
- Fixture A appears in Double Chance
- Fixture A appears in Same Bet Builder
- Fixture A appears in Premium Markets
- Fixture A appears in Niche Markets

**❌ RESTRICTED:**
- Fixture A appears multiple times within the same ACCA structure
- Fixture A appears in multiple different ACCA structures in the same prediction cycle

---

## Files Requiring Changes

**Critical (Must Change):**
1. `scripts/fetch-live-fixtures.js` - Remove global single-use logic
2. `TERMS_OF_SERVICE.md` - Update policy statement
3. `public/terms.html` - Update policy statement
4. `public/index.html` - Update policy statement

**Medium (Clarify Requirements):**
5. `supabase/migrations/20260415000001_create_insight_usage.sql` - Clarify purpose
6. `backend/utils/insightUsage.js` - Clarify or remove
7. `backend/routes/predictions.js` - Remove unused import

**Preserve (No Changes):**
8. `backend/services/accaBuilder.js` - ACCA-specific logic (correct)
9. `backend/dbBootstrap.js` - team_week_locks registration (correct)
10. `backend/database.js` - team_week_locks registration (correct)

---

## Conclusion

The deprecated global single-use restriction exists in **1 backend script** and **3 documentation files**. The `insight_usage` table implementation is per-format tracking (not global) and may be correct depending on requirements. The ACCA-specific restrictions in `team_week_locks` and `accaBuilder.js` are correctly implemented and should be preserved.

**Immediate Action Required:** Remove the global single-use logic from `fetch-live-fixtures.js` and update documentation to reflect the correct ACCA-only restriction policy.
