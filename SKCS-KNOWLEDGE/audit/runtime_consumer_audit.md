# SKCS Runtime Consumer Audit

This is the first-pass runtime audit for the most important SKCS assets.
It focuses on what actually consumes the asset in the current repository, not just what exists in schema history.

## Highest-value publication surface

### `direct1x2_prediction_final`

**What it is**
- Main publication table for predictions.

**Primary consumers**
- `backend/routes/predictions.js`
- `backend/routes/v1/predictions.js`
- `backend/routes/v1/acca.js`
- `backend/routes/direct1x2.js`
- `backend/routes/vip.js`
- `backend/routes/accuracy.js`
- `backend/routes/debug.js`
- `backend/routes/refresh-ai.js`
- `backend/routes/sportsEdge.js`
- `backend/controllers/edgeMindController.js`
- `backend/services/aiPipelineOrchestrator.js`
- `backend/services/accaBuilder.js`
- `backend/services/gradingAccuracyCore.js`
- `backend/services/gradingSnapshotService.js`
- `backend/utils/purgeStaleData.js`
- `backend/services/syncService.js`
- `backend/server-express.js`
- `backend/database.js`
- many scripts under `scripts/`

**Break impact**
- Very high.
- If this table changes shape, the website, admin routes, ACCA logic, grading, and multiple scripts can break.

## Compatibility views

### `predictions_final`

**What it is**
- Compatibility view that mirrors `direct1x2_prediction_final`.

**Primary consumers**
- `backend/scripts/bridge_frontend.py`
- `backend/scripts/generate_vip_master.py`
- `scripts/setup-rls.js`
- `scripts/apply-db-governance.js`
- `supabase/migrations/20260820000002_fix_secondary_governance_80_75.sql`
- `supabase/migrations/20260718000001_db_rule_alignment_75_55_30.sql`

**Break impact**
- Medium to high.
- Mostly affects legacy tooling and governance scripts, but schema drift here can still block migrations.

### `prediction_final`

**What it is**
- Legacy compatibility alias.

**Primary consumers**
- Legacy scripts and compatibility migrations.

**Break impact**
- Medium.

## Deterministic scoring layer

### `prediction_scores`

**What it is**
- SQL scoring layer for confidence and context.

**Current consumers**
- `SKCS-KNOWLEDGE/knowledge/v_predictions_final` and `refresh_v_predictions_final`

**Current runtime status**
- No broad application consumer was found in the current backend scan yet.

**Break impact**
- Medium now, high once the website is switched to the new SQL read path.

### `team_form`

**Consumers**
- `calculate_form_score`
- `calculate_team_strength`
- `calculate_confidence`
- backfill and scoring migration logic

### `team_strength`

**Consumers**
- `calculate_home_advantage`
- `calculate_team_strength`
- `calculate_confidence`

### `head_to_head`

**Current consumers**
- Planned scoring layer only in the current repo scan.

**Runtime note**
- The current deterministic functions focus more on form, strength, injuries, and volatility than explicit head-to-head usage.

### `volatility_factors`

**Consumers**
- `calculate_volatility`
- `calculate_confidence`

## Canonical match spine

### `match_results`

**Consumers**
- backfill helpers in `SKCS-KNOWLEDGE`
- V2 ingest functions in `supabase/migrations/20260531000002_skcs_engine_v2_phase0b_match_results.sql`
- future scoring and replay workflows

**Break impact**
- High for future deterministic scoring and replay workflows.

## Core ingestion and sync surfaces

### `raw_fixtures`

**Consumers**
- `backend/services/cronJobs.js`
- `backend/services/thesportsdbPipeline.js`
- `backend/services/dataProvider.js`
- several ingestion and cleanup scripts

### `sport_sync`

**Consumers**
- sync orchestration and migration-aware health checks

### `fixture_processing_log`

**Consumers**
- audit and partition maintenance

## Current debt observations

- `direct1x2_prediction_final` is overloaded with publication, compatibility, and some governance behavior.
- `predictions_final` and `prediction_final` still exist mainly to prevent breakage in older code.
- `prediction_scores` is the cleanest candidate for becoming the primary read surface once the website is switched over.
- `head_to_head` is present in the new SQL layer but does not yet appear to have a strong runtime consumer footprint.

## Immediate follow-up

1. Add exact column-level consumer mapping for `direct1x2_prediction_final`.
2. Map `v_predictions_final` consumers once the website is pointed to it.
3. Identify dead or redundant consumers of `predictions_final` and `prediction_final`.
4. Confirm whether `head_to_head` should be promoted to an active formula input or remain a prepared table.
