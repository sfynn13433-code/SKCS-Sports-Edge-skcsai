# SKCS Cron + Provider Runtime Map

This file maps execution triggers to providers, reads/writes, cost risk, and failure impact.
It is the operational layer that explains when work actually happens and what it costs.

## Legend

- **Budget Class**
  - `Critical` = required for prediction generation or publishing
  - `Important` = materially improves quality but is not strictly required
  - `Optional` = nice-to-have enrichment
- **Optimization Candidate**
  - `Yes` = likely to save calls or runtime if redesigned
  - `No` = currently reasonable as-is

## 1) Daily Discovery cron

**Job**
- Daily Discovery

**Implementation**
- `backend/services/cronJobs.js`
- Triggered by `cron.schedule('1 0 * * *', ...)`

**Schedule**
- Daily at `00:01 UTC`

**Trigger**
- Time-based cron

**Provider**
- TheSportsDB

**Reads**
- Date input for the discovery window

**Writes**
- `raw_fixtures`

**Downstream**
- `syncService`
- `buildLiveData` (legacy name for pre-match aggregation)
- `predictions_raw`
- `direct1x2_prediction_final`
- `prediction_scores` once the SQL scoring layer is used

**Failure impact**
- High
- Discovery failure reduces the upstream supply of fixtures and starves the pipeline

**Cost impact**
- Medium
- Cost is mostly provider calls, not database work

**Budget class**
- Critical

**Optimization candidate**
- Yes
- Reason: discovery should be aligned tightly to actual fixture availability, and redundant discovery windows can waste provider calls

## 2) Pulse Check cron

**Job**
- Pulse Check

**Implementation**
- `backend/services/cronJobs.js`
- Triggered by `cron.schedule('*/30 * * * *', ...)`

**Schedule**
- Every 30 minutes

**Trigger**
- Time-based cron

**Provider**
- TheSportsDB-derived enrichment pipeline

**Reads**
- `raw_fixtures`
- queue state from `apiQueue`

**Writes**
- Match context enrichment
- AI insight generation

**Downstream**
- `generateEdgeMindInsight`
- premium prediction surfaces
- future explainability and publication layers

**Failure impact**
- Medium to high
- Missing pulses reduce fresh enrichment and explanation quality

**Cost impact**
- High
- Because it can trigger enrichment plus AI calls repeatedly

**Budget class**
- Important

**Optimization candidate**
- Yes
- Reason: it batches work every 30 minutes and can be over-eager when queue saturation is low

## 3) Stale Prediction Cleanup cron

**Job**
- Stale Prediction Cleanup

**Implementation**
- `backend/services/cronJobs.js`
- Triggered by `cron.schedule('*/30 * * * *', ...)`

**Schedule**
- Every 30 minutes

**Trigger**
- Time-based cron

**Provider**
- None

**Reads**
- `direct1x2_prediction_final`
- `predictions_accuracy`

**Writes**
- Deletes stale rows from `direct1x2_prediction_final`

**Downstream**
- UI cleanliness
- accuracy reporting
- published-row freshness

**Failure impact**
- Medium
- Stale rows can linger, but the system still functions

**Cost impact**
- Low

**Budget class**
- Important

**Optimization candidate**
- No
- Reason: cleanup is cheap and protects the read path

## 4) Heartbeat pre-match freshness interval

**Job**
- Pre-match metadata sync

**Implementation**
- `backend/services/skcsHeartbeat.js`
- `setInterval(..., 1800000)` when legacy live-style polling is explicitly enabled for compatibility

**Schedule**
- Every 30 minutes

**Trigger**
- Interval-based runtime loop

**Provider**
- Pre-match metadata / optional legacy sources as configured in the heartbeat pipeline

**Reads**
- pre-match source feeds
- environment flags

**Writes**
- pre-match freshness state
- heartbeat metadata

**Downstream**
- freshness dashboards
- pre-match freshness features

**Failure impact**
- Medium
- Less important if the product is intentionally pre-match focused

**Cost impact**
- High when enabled

**Budget class**
- Optional

**Optimization candidate**
- Yes
- Reason: this is already disabled in some deployments and is a clear cost target

## 5) Heartbeat trends/news interval

**Job**
- Trends and News Sync

**Implementation**
- `backend/services/skcsHeartbeat.js`
- `setInterval(..., 3600000)`

**Schedule**
- Every 60 minutes

**Trigger**
- Interval-based runtime loop

**Provider**
- News and context providers

**Reads**
- feed sources and environment config

**Writes**
- trends/news cache and metadata

**Downstream**
- explanation layers
- premium insights
- context enrichment

**Failure impact**
- Medium

**Cost impact**
- Medium

**Budget class**
- Important

**Optimization candidate**
- Maybe
- Reason: if news freshness requirements are relaxed, the interval could be widened

## 6) Sports sync orchestration

**Job**
- `syncSports`

**Implementation**
- `backend/services/syncService.js`
- Called by routes, server boot, and deployment triggers

**Schedule**
- Not a cron itself, but often invoked on schedule or via manual trigger

**Trigger**
- Route-triggered or scheduled pipeline execution

**Provider**
- API-Sports
- TheSportsDB
- Odds API
- provider fallbacks via `buildLiveData` (legacy name retained in code)

**Reads**
- provider registry
- quota state
- active sport configuration
- `sport_sync`

**Writes**
- `raw_fixtures`
- pipeline telemetry
- downstream prediction inputs

**Downstream**
- `direct1x2_prediction_final`
- `prediction_scores`
- `accaBuilder`
- route responses

**Failure impact**
- Critical
- This is one of the main production prediction paths

**Cost impact**
- Critical
- This is the main external API cost center

**Budget class**
- Critical

**Optimization candidate**
- Yes
- Reason: preflight quota planning already shows that some sync work can be skipped earlier

## 7) Fixture discovery helper

**Job**
- `syncDailyFixtures`

**Implementation**
- `backend/services/thesportsdbPipeline.js`

**Schedule**
- Called by Daily Discovery cron and server routes

**Trigger**
- Discovery pipeline

**Provider**
- TheSportsDB

**Reads**
- date input
- sport filters

**Writes**
- `raw_fixtures`

**Downstream**
- pulse check
- AI enrichment
- prediction generation

**Failure impact**
- High

**Cost impact**
- Medium

**Budget class**
- Critical

**Optimization candidate**
- Yes
- Reason: it is sensitive to duplicate discovery and fixture-type filtering

## 8) Match context enrichment

**Job**
- `enrichMatchContext`

**Implementation**
- `backend/services/thesportsdbPipeline.js`
- Called by cron and server routes

**Schedule**
- Every 30 minutes via cron and on-demand through routes

**Trigger**
- Pulse Check cron or manual endpoint

**Provider**
- TheSportsDB / related enrichment sources

**Reads**
- raw fixture IDs
- queue / runtime state

**Writes**
- context enrichment records
- downstream explanation inputs

**Downstream**
- `generateEdgeMindInsight`
- premium explainers
- accuracy diagnostics

**Failure impact**
- Medium to high

**Cost impact**
- Medium

**Budget class**
- Important

**Optimization candidate**
- Yes
- Reason: enrichment should be skipped when source data is already current

## 9) AI insight generation

**Job**
- `generateEdgeMindInsight`

**Implementation**
- `backend/services/thesportsdbPipeline.js`

**Schedule**
- Every 30 minutes via cron and on-demand through routes

**Trigger**
- Pulse Check cron or manual endpoint

**Provider**
- AI provider chain

**Reads**
- match context
- injuries
- weather
- trends/news

**Writes**
- insight payloads
- explanation text

**Downstream**
- sports edge pages
- premium insights
- user-facing explanation surfaces

**Failure impact**
- Medium

**Cost impact**
- High

**Budget class**
- Important

**Optimization candidate**
- Yes
- Reason: this is one of the clearest AI-cost levers

## 10) Prediction scoring refresh

**Job**
- `populate_prediction_scores`

**Implementation**
- Supabase SQL in `20260822000005_skcs_engine_v2_engine_core.sql`

**Schedule**
- On insert/update trigger and bulk refresh helper

**Trigger**
- `trg_auto_populate_scores`
- `refresh_upcoming_fixture_scores`

**Provider**
- None directly

**Reads**
- `direct1x2_prediction_final`
- `match_results`
- `team_form`
- `team_strength`
- `head_to_head`
- `volatility_factors`

**Writes**
- `prediction_scores`

**Downstream**
- `v_predictions_final`
- score notifications
- future frontend read path

**Failure impact**
- High for SQL-first scoring

**Cost impact**
- Low to medium

**Budget class**
- Critical

**Optimization candidate**
- Yes
- Reason: it should only run when prediction rows are new or stale

## 11) Bulk scoring refresh

**Job**
- `refresh_upcoming_fixture_scores`

**Implementation**
- Supabase SQL in `20260822000005_skcs_engine_v2_engine_core.sql`

**Schedule**
- Manual or scheduled

**Trigger**
- Cron or operator execution

**Provider**
- None directly

**Reads**
- `direct1x2_prediction_final`
- `prediction_scores`

**Writes**
- `prediction_scores`

**Downstream**
- updated deterministic confidence layer

**Failure impact**
- Medium

**Cost impact**
- Low

**Budget class**
- Important

**Optimization candidate**
- Yes
- Reason: it is a useful batch control point for staleness management

## 12) High-level runtime conclusions

- The highest-cost runtime paths are the sports sync orchestration, enrichment, and AI insight generation.
- The highest-risk data paths are `direct1x2_prediction_final` and the columns that drive confidence and publication.
- The highest-value optimization candidates are the discovery cron, pulse check, sync orchestration, and AI insight generation.

## 13) Next step

The next useful artifact is still `cost_registry.md`, but this runtime map now gives it a concrete execution base to reference.
