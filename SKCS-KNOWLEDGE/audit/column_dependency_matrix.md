# SKCS Column Dependency Matrix

This is the first-pass column-level dependency map for the highest-value SKCS assets.
It focuses on columns that directly affect runtime behavior, publication, scoring, and cleanup.

## 1) `direct1x2_prediction_final`

### Publication and routing columns

- `id`
  - Produced by: database insert
  - Consumed by: batch APIs, ACCA joins, accuracy routes, debug routes, scripts, row-level maintenance tools
  - Risk: high
- `publish_run_id`
  - Produced by: publish pipeline / ACCA pipeline
  - Consumed by: publish-run selection, accuracy reporting, routing fallbacks, history views
  - Risk: high
- `tier`
  - Produced by: pipeline and publication logic
  - Consumed by: tier rules, filtering, accuracy summaries, access control, cleanup
  - Risk: high
- `type`
  - Produced by: pipeline and ACCA logic
  - Consumed by: route filters, ACCA selection, cleanup, risk classification
  - Risk: high
- `sport`
  - Produced by: pipeline, builders, and sport normalization
  - Consumed by: almost every route, visibility filter, publish logic, sports-specific access, accuracy grouping
  - Risk: critical
- `market_type`
  - Produced by: pipeline and builder logic
  - Consumed by: market filters, secondary-market governance, ACCA logic, API responses
  - Risk: high
- `match_date`
  - Produced by: builder / publish pipeline
  - Consumed by: date filtering, cleanup, history views, accuracy windows, runtime selection
  - Risk: high

### Prediction and scoring columns

- `prediction`
  - Produced by: prediction builders and AI pipeline
  - Consumed by: v1 prediction routes, sportsbook-style endpoints, edge mind explanations
  - Risk: high
- `confidence`
  - Produced by: builder / AI pipeline / fallback scoring
  - Consumed by: risk tiering, filters, ACCA thresholds, safe-haven selection, accuracy reporting
  - Risk: critical
- `total_confidence`
  - Produced by: publish pipeline and ACCA pipeline
  - Consumed by: summary APIs, read-path fallback logic, accuracy calculations, downstream comparison against `confidence`
  - Risk: critical
- `risk_tier`
  - Produced by: builder logic / pipeline tiering
  - Consumed by: route filters, cleanup logic, history APIs, governance tooling
  - Risk: high
- `risk_level`
  - Produced by: publish pipeline
  - Consumed by: compatibility and visibility logic
  - Risk: medium

### Explanation and publication metadata

- `recommendation`
  - Produced by: AI / pipeline logic
  - Consumed by: frontend responses, ACCA builder, explanation surfaces
  - Risk: medium
- `edgemind_report`
  - Produced by: AI explanation engine
  - Consumed by: premium routes, sports edge surface, refresh-ai routes, scripts, debugging
  - Risk: medium
- `secondary_insights`
  - Produced by: AI / secondary-market builder
  - Consumed by: secondary governance, premium routes, JSON repair scripts, publication logic
  - Risk: high
- `plan_visibility`
  - Produced by: publication logic
  - Consumed by: subscription filtering, access gating, visibility-based route logic
  - Risk: high

### Identity and duplicate-control columns

- `fixture_id`
  - Produced by: builders and publish pipeline
  - Consumed by: deduplication, trigger routing, publication lookup, scoring links, history views
  - Risk: critical
- `home_team`
  - Produced by: builders and pipelines
  - Consumed by: UI display, fallback lookups, duplicate matching, explainers, ACCA logic
  - Risk: high
- `away_team`
  - Produced by: builders and pipelines
  - Consumed by: UI display, fallback lookups, duplicate matching, explainers, ACCA logic
  - Risk: high

### Timing and compatibility columns

- `created_at`
  - Produced by: DB default and pipeline inserts
  - Consumed by: time-window filters, fallback selection, accuracy windows, cleanup, history views
  - Risk: high
- `expires_at`
  - Produced by: publication logic
  - Consumed by: premium visibility logic, cleanup, stale-row guards
  - Risk: medium

### Columns seen in runtime code but needing schema confirmation

- `is_published`
  - Seen in route code for legacy/publication filtering
  - Needs final schema confirmation before being treated as authoritative
- `prediction_source`
  - Seen in builder output and metadata paths
  - Treat as runtime metadata until fully normalized
- `api_source`
  - Seen in builder output and diagnostics
  - Treat as runtime metadata until fully normalized

## 2) `prediction_scores`

### Scoring outputs

- `fixture_id`
  - Produced by: `populate_prediction_scores()`
  - Consumed by: `v_predictions_final`, refresh jobs, notifications, future frontend scoring reads
  - Risk: critical
- `sport`
  - Produced by: scoring function
  - Consumed by: join key and scope filter
  - Risk: high
- `league_id`
  - Produced by: scoring function
  - Consumed by: volatility lookup, league-scoped reporting, indexing
  - Risk: medium
- `season_year`
  - Produced by: scoring function
  - Consumed by: refresh and historical analysis
  - Risk: medium
- `home_team_id`
  - Produced by: scoring function
  - Consumed by: explainers and downstream analytics
  - Risk: medium
- `away_team_id`
  - Produced by: scoring function
  - Consumed by: explainers and downstream analytics
  - Risk: medium
- `form_home`
  - Produced by: `calculate_form_score()`
  - Consumed by: `v_predictions_final`, scoring introspection
  - Risk: high
- `form_away`
  - Produced by: `calculate_form_score()`
  - Consumed by: `v_predictions_final`, scoring introspection
  - Risk: high
- `strength_home`
  - Produced by: `calculate_team_strength()`
  - Consumed by: `v_predictions_final`, scoring introspection
  - Risk: high
- `strength_away`
  - Produced by: `calculate_team_strength()`
  - Consumed by: `v_predictions_final`, scoring introspection
  - Risk: high
- `h2h_home_advantage`
  - Produced by: `calculate_home_advantage()`
  - Consumed by: `v_predictions_final`, debugging, future confidence logic
  - Risk: medium
- `injury_home`
  - Produced by: `calculate_injury_impact()`
  - Consumed by: `v_predictions_final`, explainers
  - Risk: medium
- `injury_away`
  - Produced by: `calculate_injury_impact()`
  - Consumed by: `v_predictions_final`, explainers
  - Risk: medium
- `volatility_index`
  - Produced by: `calculate_volatility()`
  - Consumed by: `v_predictions_final`, risk analysis
  - Risk: high
- `confidence`
  - Produced by: `calculate_confidence()`
  - Consumed by: `v_predictions_final`, visibility gates, future frontend read path
  - Risk: critical
- `score_context`
  - Produced by: `populate_prediction_scores()`
  - Consumed by: debug surfaces and future explainability tools
  - Risk: medium
- `calculated_at`
  - Produced by: scoring write
  - Consumed by: refresh logic and staleness checks
  - Risk: medium

## 3) `team_form`

- `team_id`
  - Produced by: backfill and ingestion
  - Consumed by: form scoring and strength calculations
  - Risk: high
- `season_year`
  - Produced by: backfill and scoring writes
  - Consumed by: seasonal filtering and form lookup
  - Risk: medium
- `match_date`
  - Produced by: match history backfill
  - Consumed by: recency ordering in `calculate_form_score()`
  - Risk: critical
- `result`
  - Produced by: backfill
  - Consumed by: `calculate_form_score()`
  - Risk: critical
- `goals_for`
  - Produced by: backfill
  - Consumed by: future strength formulas and diagnostics
  - Risk: medium
- `goals_against`
  - Produced by: backfill
  - Consumed by: future strength formulas and diagnostics
  - Risk: medium
- `opponent_id`
  - Produced by: backfill
  - Consumed by: future opponent-aware formulas
  - Risk: low
- `fixture_id`
  - Produced by: backfill
  - Consumed by: duplicate control and lineage
  - Risk: medium

## 4) `team_strength`

- `team_id`
  - Produced by: seed data / future refresh jobs
  - Consumed by: home advantage, team strength, confidence
  - Risk: high
- `season_year`
  - Produced by: seed data / refresh jobs
  - Consumed by: seasonal lookup
  - Risk: medium
- `attack_rating`
  - Produced by: future strength jobs
  - Consumed by: `calculate_team_strength()`
  - Risk: high
- `defense_rating`
  - Produced by: future strength jobs
  - Consumed by: `calculate_team_strength()`
  - Risk: high
- `home_strength`
  - Produced by: future strength jobs
  - Consumed by: `calculate_home_advantage()`
  - Risk: high
- `away_strength`
  - Produced by: future strength jobs
  - Consumed by: `calculate_home_advantage()`
  - Risk: high
- `form_score`
  - Produced by: future strength jobs
  - Consumed by: future analytics and override logic
  - Risk: medium
- `last_updated`
  - Produced by: DB default / refresh jobs
  - Consumed by: recency ordering in lookup functions
  - Risk: medium

## 5) `match_results`

- `fixture_id`
  - Produced by: ingest functions
  - Consumed by: backfills, score population, replay logic
  - Risk: critical
- `home_team_name`
  - Produced by: ingest functions
  - Consumed by: backfills and scoring joins
  - Risk: high
- `away_team_name`
  - Produced by: ingest functions
  - Consumed by: backfills and scoring joins
  - Risk: high
- `league_id`
  - Produced by: ingest functions
  - Consumed by: volatility lookup, league analysis, indexing
  - Risk: medium
- `season`
  - Produced by: ingest functions
  - Consumed by: seasonal backfill and analytics
  - Risk: medium
- `home_score`
  - Produced by: ingest functions
  - Consumed by: backfills, match outcomes, historical scoring
  - Risk: critical
- `away_score`
  - Produced by: ingest functions
  - Consumed by: backfills, match outcomes, historical scoring
  - Risk: critical
- `status_normalized`
  - Produced by: status normalization function
  - Consumed by: finished-match selection in backfills
  - Risk: high
- `played_at`
  - Produced by: ingest functions
  - Consumed by: backfill ordering and season/year derivation
  - Risk: high

## 6) `raw_fixtures`

- `id_event`
  - Produced by: fixture ingestion
  - Consumed by: cleanup, cron jobs, enrichment, lookup
  - Risk: high
- `sport`
  - Produced by: ingestion and normalization
  - Consumed by: cron filters, pipeline branching, sport gating
  - Risk: critical
- `league_id`
  - Produced by: ingestion
  - Consumed by: scheduling, sync selection, provider routing
  - Risk: medium
- `home_team_id`
  - Produced by: ingestion
  - Consumed by: enrichment and matching
  - Risk: medium
- `away_team_id`
  - Produced by: ingestion
  - Consumed by: enrichment and matching
  - Risk: medium
- `start_time`
  - Produced by: ingestion
  - Consumed by: cron windows, cleanup, pulse check, availability views
  - Risk: critical
- `raw_json`
  - Produced by: ingestion
  - Consumed by: debug, reprocessing, lineage
  - Risk: medium

## 7) `predictions_raw`

- `match_id`
  - Produced by: initial prediction generation
  - Consumed by: filters, cleanup, downstream joins
  - Risk: high
- `sport`
  - Produced by: prediction generation
  - Consumed by: filters, counts, cleanup
  - Risk: high
- `market`
  - Produced by: prediction generation
  - Consumed by: market grouping, filter logic
  - Risk: medium
- `prediction`
  - Produced by: AI / early prediction logic
  - Consumed by: filtered publication and accuracy workflows
  - Risk: high
- `confidence`
  - Produced by: AI / scoring logic
  - Consumed by: tier filtering and publication thresholds
  - Risk: critical
- `volatility`
  - Produced by: AI scoring logic
  - Consumed by: risk filtering
  - Risk: medium
- `metadata`
  - Produced by: pipeline
  - Consumed by: cleanup and enrichment logic
  - Risk: medium

## 8) `predictions_filtered`

- `raw_id`
  - Produced by: filter pipeline
  - Consumed by: publication links and cleanup
  - Risk: high
- `tier`
  - Produced by: filter pipeline
  - Consumed by: access and visibility logic
  - Risk: medium
- `is_valid`
  - Produced by: filter pipeline
  - Consumed by: read-path counts and selection logic
  - Risk: high
- `reject_reason`
  - Produced by: filter pipeline
  - Consumed by: diagnostics and audit
  - Risk: medium
- `is_watchlist`
  - Produced by: governance logic
  - Consumed by: watchlist route and indexes
  - Risk: medium

## 9) `prediction_publish_runs`

- `id`
  - Produced by: publish orchestration
  - Consumed by: row lineage and route lookups
  - Risk: high
- `requested_sports`
  - Produced by: pipeline initiation
  - Consumed by: run selection and summaries
  - Risk: medium
- `status`
  - Produced by: orchestration and cleanup jobs
  - Consumed by: availability and reporting
  - Risk: high
- `started_at`
  - Produced by: pipeline start
  - Consumed by: stale-run handling and reporting
  - Risk: medium
- `completed_at`
  - Produced by: pipeline end
  - Consumed by: status reporting
  - Risk: medium

## 10) Immediate cleanup candidates

These are not automatically deletable, but they deserve review once full inventory is complete.

- Columns read only by compatibility scripts but not by main runtime routes.
- Columns shown in routes but not yet confirmed in schema, such as `is_published`.
- Prepared scoring inputs that are not yet active in runtime consumer paths, such as `head_to_head` usage.

## 11) Summary

The critical columns today are:

- `direct1x2_prediction_final.fixture_id`
- `direct1x2_prediction_final.sport`
- `direct1x2_prediction_final.confidence`
- `direct1x2_prediction_final.total_confidence`
- `direct1x2_prediction_final.publish_run_id`
- `direct1x2_prediction_final.match_date`
- `prediction_scores.confidence`
- `prediction_scores.fixture_id`
- `team_form.result`
- `team_form.match_date`
- `raw_fixtures.start_time`
- `predictions_raw.confidence`
- `predictions_filtered.is_valid`

Those are the columns most likely to affect prediction accuracy, publishing, access gating, and operational stability.
