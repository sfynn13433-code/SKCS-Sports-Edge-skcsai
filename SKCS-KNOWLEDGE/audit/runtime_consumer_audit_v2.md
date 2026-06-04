# SKCS Runtime Consumer Audit v2

This is a deeper consumer map for the most important prediction assets.
It focuses on both read-path consumers and write-path producers so break impact is easier to judge.

## 1) `direct1x2_prediction_final`

### What it stores

The live publication and compatibility surface for predictions.

### Write-path producers

- `backend/services/direct1x2Builder.js`
  - Writes or updates rows with fields such as:
    - `fixture_id`
    - `home_team`
    - `away_team`
    - `match_date`
    - `league`
    - `home_pct`
    - `draw_pct`
    - `away_pct`
    - `best_1x2_market`
    - `best_1x2_pct`
    - `risk_tier`
    - `prediction_source`
    - `api_source`
    - `metadata`
    - `created_at`
    - `updated_at`
  - Fallback updates can also touch:
    - `total_confidence`
    - `matches`
    - `recommendation`
    - `edgemind_report`
    - `secondary_insights`
    - `expires_at`
    - `sport`
    - `market_type`
    - `prediction`
    - `confidence`

- `backend/services/aiPipelineOrchestrator.js`
  - Inserts the publication row with:
    - `publish_run_id`
    - `tier`
    - `type`
    - `matches`
    - `total_confidence`
    - `risk_level`
    - `sport`
    - `market_type`
    - `recommendation`
    - `fixture_id`
    - `home_team`
    - `away_team`
    - `prediction`
    - `confidence`
    - `match_date`
    - `secondary_markets`
    - `secondary_insights`
    - `edgemind_report`

- `backend/services/accaBuilder.js`
  - Inserts ACCA rows with:
    - `publish_run_id`
    - `tier`
    - `type`
    - `matches`
    - `total_confidence`
    - `risk_level`
    - `plan_visibility`
    - `sport`
    - `market_type`
    - `recommendation`
    - `expires_at`
    - `edgemind_report`
    - `secondary_insights`
    - `fixture_id`
    - `home_team`
    - `away_team`
    - `prediction`
    - `confidence`
    - `match_date`

### Read-path consumers

- `backend/routes/predictions.js`
  - Main website read route.
  - Reads counts, latest publish runs, published rows, and visibility gates.
- `backend/routes/v1/predictions.js`
  - Match-level and batch prediction API.
  - Reads `id`, `market_type`, `prediction`, `confidence`, `risk_tier`, `edgemind_report`, `created_at`, `is_published`.
- `backend/routes/v1/acca.js`
  - ACCA endpoint.
  - Joins and reads prediction rows by `id`.
- `backend/routes/direct1x2.js`
  - Direct read route and write helper consumer.
- `backend/routes/vip.js`
  - VIP stress and fallback payloads.
- `backend/routes/accuracy.js`
  - Accuracy reporting and timeframe summaries.
- `backend/routes/debug.js`
  - Debug and inspection routes.
- `backend/routes/refresh-ai.js`
  - Refreshes AI-related content derived from published rows.
- `backend/routes/sportsEdge.js`
  - Sports market hub and premium routing.
- `backend/controllers/edgeMindController.js`
  - EdgeMind explanation and reason generation.
- `backend/services/gradingAccuracyCore.js`
- `backend/services/gradingSnapshotService.js`
- `backend/utils/purgeStaleData.js`
- `backend/server-express.js`
- many maintenance scripts in `scripts/`

### Break impact

Very high.

This table is both the public product layer and a legacy compatibility contract.
If its shape changes, the website, API routes, grading, ACCA generation, and multiple scripts can fail.

## 2) `predictions_final`

### What it is

- Compatibility view mirroring `direct1x2_prediction_final`.

### Consumers

- `backend/scripts/bridge_frontend.py`
- `backend/scripts/generate_vip_master.py`
- `scripts/setup-rls.js`
- `scripts/apply-db-governance.js`
- legacy migration logic in Supabase SQL

### Break impact

Medium to high.

This view is a compatibility anchor for older tooling and governance scripts.

## 3) `prediction_final`

### What it is

- Legacy alias / compatibility view.

### Consumers

- Older scripts and compatibility logic.

### Break impact

Medium.

## 4) `prediction_scores`

### What it stores

- Deterministic scoring output for confidence and supporting factors.

### Producers

- `populate_prediction_scores()`
- `trg_auto_populate_scores()`
- `refresh_upcoming_fixture_scores()`

### Current consumers

- `v_predictions_final`
- `refresh_v_predictions_final()`
- the new knowledge layer docs

### Break impact

Medium now, high once the frontend moves to the SQL read path.

## 5) `team_form`

### Producers

- backfill SQL in the knowledge layer
- future scoring refresh jobs

### Consumers

- `calculate_form_score()`
- `calculate_team_strength()`
- `calculate_confidence()`

### Break impact

High for deterministic scoring.

## 6) `team_strength`

### Consumers

- `calculate_home_advantage()`
- `calculate_team_strength()`
- `calculate_confidence()`

### Break impact

High for the SQL scoring chain.

## 7) `head_to_head`

### Current status

- Present in the SQL engine core.
- No strong runtime consumer footprint was found in the current repo scan.

### Risk

- Possible dead-prepared table unless future formulas start using it directly.

## 8) `volatility_factors`

### Consumers

- `calculate_volatility()`
- `calculate_confidence()`

### Break impact

High for volatility-dependent confidence calculations.

## 9) `match_results`

### Producers

- `ingest_match_results_from_football_canonical()`
- `ingest_match_results_from_events()`

### Consumers

- backfill helpers
- future deterministic scoring workflows
- replay and grading foundation

### Break impact

High for the future SQL-first engine.

## 10) Top operational tables

### `raw_fixtures`

- Used by discovery, pulse check, and cleanup logic.
- High importance to ingestion.

### `predictions_raw`

- Used by read-path counts, cleanup jobs, and ingestion-to-publication flow.

### `predictions_filtered`

- Used for tier gate enforcement and publication tracking.

### `prediction_publish_runs`

- Used by publish-run tracking, accuracy reporting, and read-path selection.

## 11) Main drift findings

- `direct1x2_prediction_final` is still the dominant runtime contract.
- `predictions_final` and `prediction_final` are mostly compatibility surfaces now.
- `prediction_scores` is the clean path forward for deterministic confidence, but it is not yet the main runtime consumer in the app.
- `head_to_head` is ready in schema but not yet clearly activated by runtime consumers.
- The repo still mixes publication logic, deterministic scoring, and compatibility logic in several places.

## 12) Recommended next audit slice

1. Column-level map for `direct1x2_prediction_final`.
2. Exact consumer map for `predictions_raw` and `predictions_filtered`.
3. Exact job map for cron and heartbeat schedules.
4. Exact provider-to-route map for API quota and fallback consumption.
