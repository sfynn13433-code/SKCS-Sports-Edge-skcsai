# SKCS AI Sports Edge - Comprehensive Audit Report

## PART 1: SUPABASE DATABASE ANALYSIS

### 1.1 ALL TABLES IN DATABASE (32 total)

#### CRITICAL TABLES (Used by Website)

| Table | Rows | Purpose | Status |
|-------|------|---------|--------|
| **predictions_final** | 27 | Main predictions displayed to users | ✅ ACTIVE |
| **profiles** | 1 | User authentication & subscription | ✅ ACTIVE |
| **subscription_plans** | 8 | Plan configurations | ✅ ACTIVE |
| **tier_rules** | 2 | Normal/Deep tier rules | ✅ ACTIVE |
| **acca_rules** | 4 | ACCA validation rules | ✅ ACTIVE |

#### PIPELINE TABLES (Used by Backend)

| Table | Rows | Purpose | Status |
|-------|------|---------|--------|
| predictions_raw | 2288 | Raw predictions from API | ✅ ACTIVE |
| predictions_filtered | 2266 | After market governance filter | ✅ ACTIVE |
| prediction_publish_runs | 73 | Pipeline execution logs | ✅ ACTIVE |

#### STAGING TABLES (Empty - Pipeline not using them)

| Table | Rows | Purpose | Should Be There? |
|-------|------|---------|------------------|
| predictions_stage_1 | 0 | Stage 1 processing | ⚠️ MAYBE - Pipeline may expect this |
| predictions_stage_2 | 0 | Stage 2 adjustments | ⚠️ MAYBE - Pipeline may expect this |
| predictions_stage_3 | 0 | Stage 3 validation | ⚠️ MAYBE - Pipeline may expect this |
| normalized_fixtures | 0 | Fixture normalization | ⚠️ MAYBE - Pipeline may expect this |
| events | 0 | Normalized events | ⚠️ MAYBE - Legacy structure |

#### CACHE/HISTORY TABLES

| Table | Rows | Purpose | Should Be There? |
|-------|------|---------|------------------|
| context_intelligence_cache | 0 | AI context cache | ✅ YES - For performance |
| fixture_context_cache | 0 | Fixture context | ✅ YES - For performance |
| rapidapi_cache | 0 | API response cache | ✅ YES - For rate limiting |
| api_raw | 78 | Raw API responses | ✅ YES - Debug/audit trail |

#### SNAPSHOT TABLES

| Table | Rows | Purpose | Should Be There? |
|-------|------|---------|------------------|
| event_weather_snapshots | 48 | Weather history | ✅ YES - Weather integration |
| event_injury_snapshots | 346 | Injury history | ✅ YES - Availability integration |
| event_news_snapshots | 108 | News history | ✅ YES - Sentiment analysis |

#### CANONICAL/LOOKUP TABLES

| Table | Rows | Purpose | Should Be There? |
|-------|------|---------|------------------|
| canonical_entities | 1716 | Normalized teams/leagues | ✅ YES - Entity resolution |
| canonical_events | 165 | Normalized events | ✅ YES - Event matching |
| sports | 92 | Sport definitions | ✅ YES - Sport classification |
| leagues | 26 | League definitions | ✅ YES - League info |
| bookmakers | 22 | Bookmaker data | ✅ YES - Odds source |

#### DEBUG/AUDIT TABLES

| Table | Rows | Purpose | Should Be There? |
|-------|------|---------|------------------|
| debug_published | 0 | Debug published preds | ⚠️ TEMP - Can be cleared |
| scheduling_logs | 0 | Scheduler logs | ⚠️ TEMP - Can be cleared |
| predictions_accuracy | 0 | Accuracy tracking | ✅ YES - When matches complete |
| odds_snapshots | 0 | Historical odds | ✅ YES - Historical data |

#### ??? QUESTIONABLE TABLES

| Table | Rows | Purpose | Should Be There? |
|-------|------|---------|------------------|
| **test** | 0 | Unknown purpose | ❌ REMOVE - No clear purpose |
| **matches** | 5 | Legacy football table | ⚠️ CHECK - May be unused |

---

### 1.2 FOREIGN KEY RELATIONSHIPS

```
✅ canonical_events.home_entity_id → canonical_entities.id
✅ canonical_events.away_entity_id → canonical_entities.id
✅ events.sport_key → sports.sport_key
✅ odds_snapshots.event_id → events.id
✅ odds_snapshots.bookmaker_key → bookmakers.bookmaker_key
✅ predictions_filtered.raw_id → predictions_raw.id
✅ predictions_final.publish_run_id → prediction_publish_runs.id
✅ predictions_stage_1.fixture_id → normalized_fixtures.id
✅ predictions_stage_2.fixture_id → normalized_fixtures.id
✅ predictions_stage_3.fixture_id → normalized_fixtures.id
```

**Assessment**: FK structure is intact. Staging tables reference `normalized_fixtures` which is empty.

---

### 1.3 TABLES CONNECTING TO WEBSITE

The website API (`/api/predictions`) queries:
1. ✅ `predictions_final` - Main display table
2. ✅ `profiles` - User authentication
3. ✅ `subscription_plans` - Plan info
4. ✅ `tier_rules` - Tier configuration
5. ✅ `acca_rules` - ACCA rules
6. ✅ `prediction_publish_runs` - Pipeline runs

**Assessment**: Website is correctly connected to critical tables.

---

## PART 2: FILE STRUCTURE ANALYSIS

### 2.1 ROOT LEVEL

| File | Purpose | Status |
|------|---------|--------|
| STRICT_RULES.md | New - Rules for AI agents | ✅ KEEP |
| AGENTS.md | Agent instructions | ✅ KEEP |
| package.json | Dependencies | ✅ KEEP |
| Dockerfile | Container config | ✅ KEEP |
| render.yaml | Render deployment | ✅ KEEP |
| vercel.json | Vercel deployment | ✅ KEEP |

### 2.2 DUPLICATE/OLD FILES (NEED REVIEW)

| File | Issue |
|------|-------|
| `cli_v1.1.0.exe` | Old CLI tool - ❓ Is this still used? |
| `render.zip` | Deployment artifact - Can be regenerated |
| `check-api.js` | Root level - Should be in scripts/ |
| `test_math.js` | Root level - Debug file, should be in scripts/ |
| `style.css` | Root level - Duplicated from public/ |

### 2.3 SCRIPTS DIRECTORY (75 entries - MANY DUPLICATES)

#### DUPLICATE MIGRATION FILES (Confusing):
- `bridge-to-final.sql` ✅ LEGITIMATE - Gatekeeper pipeline
- `fix-matches-timestamps.sql` ⚠️ LEGACY - May conflict
- `normalize-sports.sql` ⚠️ LEGACY - May conflict
- Multiple `migration2*.js` files - Confusing naming

#### DUPLICATE CHECK FILES:
- `check-schema.js` - Same as `check-final-schema.js`
- `check-matches.js` - Debug file
- `check-team-names.js` - Debug file
- `check-direct-predictions.js` - Debug file
- `check-constraints.js` - Debug file
- `check-metadata-times.js` - Debug file
- `check-final-sports.js` - Debug file
- `check-risk-constraint.js` - Debug file

#### LEGITIMATE ACTIVE SCRIPTS:
- `gatekeeper-pipeline.js` ✅ MAIN PIPELINE
- `brute-force-ingest.js` ✅ BACKUP INGESTION
- `fix-sport-data.js` ✅ DATA FIX
- `audit-database.js` ✅ AUDIT TOOL (just created)
- `audit-table-usage.js` ✅ AUDIT TOOL (just created)

#### LEGACY/CANDIDATES FOR REMOVAL:
- `full-nuke.js` - Dangerous, no documentation
- `deep-table-analysis.js` - One-time analysis
- `analyze-routes.js` - One-time analysis
- `analyze-table-usage.js` - One-time analysis
- `phase1-*.js`, `phase2-*.js`, `phase3-*.js` - Old migration phases
- `patch-*.js` - Old patches
- `trigger-*.js` - Old triggers (multiple versions)
- `verify-*.js` - Old verification scripts
- `wipe-*.js` - Dangerous data wipes
- `files-report.json` - Temp file from audit
- `file-walker.js` - Temp file from audit

### 2.4 SQL DIRECTORY (9 files)

| File | Purpose | Status |
|------|---------|--------|
| schema_refactor.sql | Main schema | ✅ LEGITIMATE |
| tables.sql | Base tables | ✅ LEGITIMATE |
| aca_rules.sql | ACCA rules | ✅ LEGITIMATE |
| tier_rules.sql | Tier rules | ✅ LEGITIMATE |
| day_zero_subscription.sql | Subscription setup | ✅ LEGITIMATE |
| supabase_test_user_*.sql | Test user setup | ✅ LEGITIMATE |
| rapidapi_cache.sql | Cache table | ✅ LEGITIMATE |
| bridge-to-final.sql | In scripts/ | ⚠️ DUPLICATE |
| fix-matches-timestamps.sql | In scripts/ | ⚠️ LEGACY |
| normalize-sports.sql | In scripts/ | ⚠️ LEGACY |

### 2.5 SUPABASE DIRECTORY

| Path | Contents | Status |
|------|---------|--------|
| supabase/migrations/ | DB migrations | ✅ LEGITIMATE |
| supabase/functions/ | Edge functions | ✅ LEGITIMATE |

---

## PART 3: RECOMMENDATIONS

### 3.1 DATABASE CHANGES (Require SQL Migration)

| Action | Table | Reason |
|--------|-------|--------|
| **INVESTIGATE** | `test` | Unclear purpose, no code references found |
| **INVESTIGATE** | `matches` | Legacy football table, only 5 rows |
| **MONITOR** | `predictions_stage_*` | Empty but FK to empty `normalized_fixtures` |
| **MONITOR** | `normalized_fixtures` | Empty, staging tables reference it |

### 3.2 FILES TO REMOVE (Safe to Delete)

| File | Reason |
|------|--------|
| `render.zip` | Can be regenerated from source |
| `check-api.js` | Belongs in scripts/ |
| `test_math.js` | Debug file, belongs in scripts/ |
| `style.css` | Duplicated in public/ |
| `files-report.json` | Temp audit file |
| `file-walker.js` | Temp audit file |

### 3.3 SCRIPTS TO CONSOLIDATE (Complex)

**Migration Scripts** (keep only latest):
- Keep: `bridge-to-final.sql`
- Archive: `fix-matches-timestamps.sql`, `normalize-sports.sql`, `migration2*.js`

**Check Scripts** (keep only functional):
- Keep: `audit-database.js`, `audit-table-usage.js`
- Archive: `check-*.js` (10+ duplicates)

**Trigger Scripts** (keep only one):
- Keep: `wake-and-sync.js` (most recent)
- Archive: `trigger-*.js` (5+ duplicates)

### 3.4 FILES TO KEEP AS-IS

| Category | Files |
|----------|-------|
| **Core Config** | package.json, Dockerfile, render.yaml, vercel.json, AGENTS.md |
| **Supabase** | supabase/migrations/*, supabase/functions/* |
| **SQL** | sql/schema_refactor.sql, sql/tables.sql, sql/*_rules.sql |
| **Active Scripts** | gatekeeper-pipeline.js, brute-force-ingest.js, fix-sport-data.js |
| **Documentation** | README.md, STRICT_RULES.md |

---

## PART 4: WHAT NEEDS MANUAL VERIFICATION

1. **Is `cli_v1.1.0.exe` still used?** - Old CLI tool, unclear if needed
2. **What is `matches` table for?** - Only 5 rows, may be legacy
3. **What is `test` table for?** - No code references found
4. **Why are staging tables empty?** - Pipeline may be bypassing them

---

*Report generated by audit-database.js and audit-table-usage.js*
