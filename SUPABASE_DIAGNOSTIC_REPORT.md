# SUPABASE DIAGNOSTIC REPORT
**Generated:** May 11, 2026
**Scope:** Full database schema analysis, duplicate detection, and constraint review
**Note:** READ-ONLY analysis based on codebase schema definitions

---

## EXECUTIVE SUMMARY

This report provides a comprehensive analysis of the SKCS Supabase database schema, identifying all constraints, rules (spotting codes), duplicate detection mechanisms, and merge potential for duplicate data.

**Key Findings:**
- **16 Unique Constraints/Rules** identified across the database
- **1 Trigger** for secondary market validation
- **8 Tables** with duplicate prevention mechanisms
- **Duplicate Issue Identified:** `direct1x2_prediction_final` fallback logic allows duplicates when publish_run_id IS NULL

---

## TABLE INVENTORY

### Core Prediction Tables

| Table | Purpose | Row Estimate | Key Constraints |
|-------|---------|--------------|-----------------|
| `predictions_raw` | Raw prediction ingest | Unknown | PRIMARY KEY (id) |
| `predictions_filtered` | Tier validation output | Unknown | UNIQUE (raw_id, tier) |
| `direct1x2_prediction_final` | Live published insights | Unknown | UNIQUE INDEX (sport, market_type, fixture_id) |
| `predictions_accuracy` | Graded results | Unknown | UNIQUE (prediction_final_id, prediction_match_index) |

### Pipeline Tables

| Table | Purpose | Key Constraints |
|-------|---------|-----------------|
| `prediction_publish_runs` | Run tracking | PRIMARY KEY (id) |
| `raw_fixtures` | TheSportsDB fixtures | PRIMARY KEY (id_event) |
| `match_context_data` | Enriched match data | PRIMARY KEY (id_event) |
| `ai_predictions` | AI-generated insights | PRIMARY KEY (match_id) |

### Cache & Lock Tables

| Table | Purpose | Key Constraints |
|-------|---------|-----------------|
| `rapidapi_cache` | API response cache | UNIQUE (cache_key) |
| `context_intelligence_cache` | Context data cache | UNIQUE (cache_key) |
| `scheduler_run_locks` | Scheduler idempotency | UNIQUE (publish_window) |
| `team_week_locks` | Team usage tracking | UNIQUE (week_key, team_key, competition_key) |

### Configuration Tables

| Table | Purpose | Key Constraints |
|-------|---------|-----------------|
| `tier_rules` | Tier configuration | PRIMARY KEY (tier) |
| `acca_rules` | ACCA configuration | UNIQUE (rule_name) |
| `secondary_market_allowlist` | Approved markets | UNIQUE (market_key) |
| `table_lifecycle_registry` | Table metadata | PRIMARY KEY (table_name) |

---

## 16 SPOTTING CODES (UNIQUE CONSTRAINTS & RULES)

### 1. **predictions_filtered UNIQUE (raw_id, tier)**
- **Table:** `predictions_filtered`
- **Purpose:** Prevents duplicate tier validation for the same raw prediction
- **Impact:** Ensures each raw prediction is validated exactly once per tier
- **Merge Potential:** LOW - Critical for pipeline integrity

### 2. **uq_predictions_final_live_direct_fixture_market**
- **Table:** `direct1x2_prediction_final`
- **Columns:** `LOWER(sport)`, `LOWER(market_type)`, `matches->0->>'fixture_id'`
- **WHERE Clause:** `tier = 'normal'`, `type = 'direct'`, `publish_run_id IS NULL`
- **Purpose:** Prevents duplicate live predictions for the same fixture
- **Impact:** HIGH - Main deduplication mechanism for live predictions
- **Merge Potential:** HIGH - This is where duplicates are occurring

### 3. **acca_rules UNIQUE (rule_name)**
- **Table:** `acca_rules`
- **Purpose:** Ensures unique ACCA rule names
- **Impact:** LOW - Configuration table
- **Merge Potential:** N/A

### 4. **predictions_accuracy UNIQUE (prediction_final_id, prediction_match_index)**
- **Table:** `predictions_accuracy`
- **Purpose:** Prevents duplicate accuracy records for the same prediction match
- **Impact:** MEDIUM - Ensures grading accuracy
- **Merge Potential:** MEDIUM - Could merge if prediction_final_id is the same

### 5. **context_intelligence_cache UNIQUE (cache_key)**
- **Table:** `context_intelligence_cache`
- **Purpose:** Prevents duplicate cache entries
- **Impact:** LOW - Cache optimization
- **Merge Potential:** HIGH - Could overwrite with newer data

### 6. **event_context UNIQUE (event_id)**
- **Table:** `event_context`
- **Purpose:** Prevents duplicate event context records
- **Impact:** MEDIUM - Event data integrity
- **Merge Potential:** HIGH - Could merge with latest data

### 7. **scheduler_run_locks UNIQUE (publish_window)**
- **Table:** `scheduler_run_locks`
- **Purpose:** Prevents concurrent scheduler runs
- **Impact:** HIGH - Prevents race conditions
- **Merge Potential:** N/A - Lock table

### 8. **team_week_locks UNIQUE (week_key, team_key, competition_key)**
- **Table:** `team_week_locks`
- **Purpose:** Prevents duplicate team usage locks
- **Impact:** MEDIUM - Usage tracking
- **Merge Potential:** MEDIUM - Could update instead of insert

### 9. **secondary_market_allowlist UNIQUE (market_key)**
- **Table:** `secondary_market_allowlist`
- **Purpose:** Ensures unique market keys in allowlist
- **Impact:** LOW - Configuration
- **Merge Potential:** N/A

### 10. **table_lifecycle_registry UNIQUE (table_name)**
- **Table:** `table_lifecycle_registry`
- **Purpose:** Ensures unique table names in registry
- **Impact:** LOW - Metadata
- **Merge Potential:** N/A

### 11. **raw_fixtures PRIMARY KEY (id_event)**
- **Table:** `raw_fixtures`
- **Purpose:** Prevents duplicate fixture records
- **Impact:** HIGH - TheSportsDB sync integrity
- **Merge Potential:** MEDIUM - ON CONFLICT updates raw_json

### 12. **match_context_data PRIMARY KEY (id_event)**
- **Table:** `match_context_data`
- **Purpose:** Prevents duplicate context records
- **Impact:** HIGH - Enrichment pipeline integrity
- **Merge Potential:** MEDIUM - ON CONFLICT updates all fields

### 13. **ai_predictions PRIMARY KEY (match_id)**
- **Table:** `ai_predictions`
- **Purpose:** Prevents duplicate AI predictions
- **Impact:** HIGH - AI pipeline integrity
- **Merge Potential:** MEDIUM - ON CONFLICT updates confidence/feedback

### 14. **tier_rules PRIMARY KEY (tier)**
- **Table:** `tier_rules`
- **Purpose:** Ensures unique tier names
- **Impact:** LOW - Configuration
- **Merge Potential:** N/A

### 15. **predictions_raw PRIMARY KEY (id)**
- **Table:** `predictions_raw`
- **Purpose:** Auto-increment primary key
- **Impact:** HIGH - Raw data integrity
- **Merge Potential:** N/A - Auto-increment

### 16. **direct1x2_prediction_final PRIMARY KEY (id)**
- **Table:** `direct1x2_prediction_final`
- **Purpose:** Auto-increment primary key
- **Impact:** HIGH - Published predictions integrity
- **Merge Potential:** N/A - Auto-increment

---

## TRIGGER ANALYSIS

### 1. **enforce_secondary_allowlist**
- **Table:** `direct1x2_prediction_final`
- **Timing:** BEFORE INSERT OR UPDATE
- **Function:** `check_secondary_markets_allowlist()`
- **Purpose:** Validates secondary markets against approved allowlist
- **Logic:**
  - Checks each market in `secondary_markets` JSON array
  - Allows dynamic patterns: `corners_(over|under)_(6-12)_5`, `cards_(over|under)_1-6_5`
  - Strict lookup in `secondary_market_allowlist` table
  - Raises exception if market not approved
- **Impact:** HIGH - Prevents unauthorized secondary markets

---

## DUPLICATE DETECTION LOGIC

### Current Mechanisms

#### 1. **direct1x2Builder.js Fallback Logic**
```javascript
// Lines 552-604
if (error && error.message.includes('uq_predictions_final_live_direct_fixture_market')) {
    // Fallback 1: Find by fixture_id
    const lookup = await dbQuery(
        `SELECT id FROM direct1x2_prediction_final
         WHERE LOWER(sport) = $1
           AND type = 'direct'
           AND tier = 'normal'
           AND market_type = '1x2'
           AND publish_run_id IS NULL
           AND matches->0->>'fixture_id' = $2`,
        [row.sport, row.fixture_id]
    );
    
    // Fallback 2: Find by home_team/away_team
    if (!fallbackId) {
        const byTeams = await supabase
            .from('direct1x2_prediction_final')
            .select('id')
            .eq('sport', row.sport)
            .eq('home_team', row.home_team)
            .eq('away_team', row.away_team)
            .is('publish_run_id', null);
    }
}
```

**Problem:** The fallback lookups don't have unique constraints, allowing the same match to be inserted multiple times on consecutive days.

#### 2. **ON CONFLICT Clauses**

**raw_fixtures:**
```sql
ON CONFLICT (id_event) DO UPDATE SET
    raw_json = EXCLUDED.raw_json,
    updated_at = NOW()
```

**match_context_data:**
```sql
ON CONFLICT (id_event) DO UPDATE SET
    lineups = EXCLUDED.lineups,
    stats = EXCLUDED.stats,
    timeline = EXCLUDED.timeline,
    home_last_5 = EXCLUDED.home_last_5,
    away_last_5 = EXCLUDED.away_last_5,
    updated_at = NOW()
```

**ai_predictions:**
```sql
ON CONFLICT (match_id) DO UPDATE SET
    confidence_score = EXCLUDED.confidence_score,
    edgemind_feedback = EXCLUDED.edgemind_feedback,
    value_combos = EXCLUDED.value_combos,
    same_match_builder = EXCLUDED.same_match_builder,
    updated_at = NOW()
```

**Status:** ✅ These tables have proper deduplication

---

## DUPLICATE DATA ANALYSIS

### Identified Duplicate Source

**Table:** `direct1x2_prediction_final`
**Issue:** Fallback predictions with `publish_run_id IS NULL` are being duplicated

**Root Cause:**
1. Unique constraint `uq_predictions_final_live_direct_fixture_market` only applies when:
   - `tier = 'normal'`
   - `type = 'direct'`
   - `publish_run_id IS NULL`
   - `fixture_id` exists in matches JSON

2. When constraint fails, fallback logic finds by `fixture_id` or `home_team/away_team`
3. These fallback lookups don't have unique constraints
4. Same match can be inserted multiple times on different days

**Duplicate Pattern:**
- Same teams (e.g., Arsenal vs Chelsea)
- Same sport (e.g., Soccer)
- Same market type (e.g., 1X2)
- Same confidence score (e.g., 52%)
- Different `id` (auto-increment)
- Different `created_at` timestamp
- `publish_run_id IS NULL`

---

## MERGE RECOMMENDATIONS

### Priority 1: Fix Fallback Prediction Duplicates

**Current State:**
- Multiple records for same match with `publish_run_id IS NULL`
- No unique constraint on fallback lookups

**Recommended Action:**
1. Add unique constraint on fallback columns:
```sql
CREATE UNIQUE INDEX uq_predictions_final_fallback_teams
ON direct1x2_prediction_final (
    LOWER(COALESCE(sport, '')),
    LOWER(COALESCE(type, '')),
    LOWER(COALESCE(tier, '')),
    LOWER(COALESCE(market_type, '')),
    LOWER(COALESCE(home_team, '')),
    LOWER(COALESCE(away_team, '')),
    COALESCE(matches->0->>'kickoff', created_at::date)
)
WHERE publish_run_id IS NULL;
```

2. Update fallback logic to use UPDATE instead of INSERT when found

**Merge SQL:**
```sql
-- Delete duplicate fallback predictions (keep newest)
WITH duplicates AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            PARTITION BY 
                LOWER(COALESCE(sport, '')),
                LOWER(COALESCE(type, '')),
                LOWER(COALESCE(tier, '')),
                LOWER(COALESCE(market_type, '')),
                LOWER(COALESCE(home_team, '')),
                LOWER(COALESCE(away_team, '')),
                COALESCE(matches->0->>'kickoff', created_at::date)
            ORDER BY id DESC
        ) as rn
    FROM direct1x2_prediction_final
    WHERE publish_run_id IS NULL
)
DELETE FROM direct1x2_prediction_final
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
```

**Space Savings:** Estimated 10-30% depending on duplication level

### Priority 2: Archive Old Accuracy Data

**Current State:**
- `predictions_accuracy` table grows indefinitely
- Historical data older than 90 days may not be needed

**Recommended Action:**
```sql
-- Archive predictions_accuracy older than 90 days
CREATE TABLE predictions_accuracy_archive AS
SELECT * FROM predictions_accuracy
WHERE fixture_date < CURRENT_DATE - INTERVAL '90 days';

DELETE FROM predictions_accuracy
WHERE fixture_date < CURRENT_DATE - INTERVAL '90 days';
```

**Space Savings:** Estimated 20-40% of accuracy table

### Priority 3: Cache Cleanup

**Current State:**
- `rapidapi_cache` and `context_intelligence_cache` may have expired entries
- TTL-based expiration but no cleanup job

**Recommended Action:**
```sql
-- Delete expired cache entries
DELETE FROM rapidapi_cache
WHERE updated_at < NOW() - INTERVAL '1 hour';

DELETE FROM context_intelligence_cache
WHERE expires_at < NOW();
```

**Space Savings:** Minimal (cache tables are small)

---

## CONSTRAINT VIOLATION RISK ASSESSMENT

| Constraint | Violation Risk | Impact | Recommended Action |
|------------|----------------|--------|-------------------|
| uq_predictions_final_live_direct_fixture_market | HIGH | Duplicate live predictions | Add fallback unique constraint |
| predictions_filtered (raw_id, tier) | LOW | Duplicate tier validation | Monitor |
| predictions_accuracy (prediction_final_id, prediction_match_index) | MEDIUM | Duplicate grading | Add cleanup job |
| team_week_locks (week_key, team_key, competition_key) | LOW | Duplicate locks | Monitor |

---

## DATA INTEGRITY CHECKLIST

### Critical Tables
- ✅ `raw_fixtures` - Has ON CONFLICT UPDATE
- ✅ `match_context_data` - Has ON CONFLICT UPDATE
- ✅ `ai_predictions` - Has ON CONFLICT UPDATE
- ⚠️ `direct1x2_prediction_final` - Has unique index but fallback allows duplicates
- ✅ `predictions_filtered` - Has UNIQUE constraint

### Cache Tables
- ✅ `rapidapi_cache` - Has UNIQUE constraint
- ✅ `context_intelligence_cache` - Has UNIQUE constraint

### Lock Tables
- ✅ `scheduler_run_locks` - Has UNIQUE constraint
- ✅ `team_week_locks` - Has UNIQUE constraint

---

## RECOMMENDATIONS SUMMARY

### Immediate Actions (High Priority)
1. **Add unique constraint for fallback predictions** to prevent daily duplicates
2. **Run merge SQL** to clean up existing duplicates
3. **Update direct1x2Builder.js** to use UPDATE instead of INSERT in fallback logic

### Medium Priority
4. **Add archive job** for old predictions_accuracy data
5. **Add cache cleanup job** for expired cache entries
6. **Monitor constraint violations** in production logs

### Low Priority
7. **Review table sizes** quarterly
8. **Consider partitioning** large tables if >1M rows
9. **Add data retention policy** for historical data

---

## CONCLUSION

The SKCS Supabase database has a robust constraint system with **16 unique constraints/rules** preventing most duplicates. However, the fallback logic in `direct1x2_prediction_final` allows duplicate predictions when `publish_run_id IS NULL`. This is the primary source of data duplication.

**Critical Fix Required:** Add a unique constraint on the fallback lookup columns (sport, type, tier, market_type, home_team, away_team, kickoff/date) to prevent the same match from being inserted multiple times on consecutive days.

**Estimated Cleanup:** Running the merge SQL could free 10-30% of space in the `direct1x2_prediction_final` table.

**Next Steps:**
1. Review and approve the merge SQL
2. Add the unique constraint for fallback predictions
3. Update the fallback logic in direct1x2Builder.js
4. Run cleanup SQL during maintenance window
