# SKCS Database Schema

This is the first-pass schema inventory for the Supabase-backed SKCS brain.
It is based on the current repo state, especially `supabase/migrations/` and `backend/dbBootstrap.js`.

## Core prediction and identity tables

- `public.skcs_teams`
  - Master team identity table.
  - Source: `supabase/migrations/20260531000001_skcs_engine_v2_phase0_identity.sql`
- `public.team_identity_map`
  - Maps provider team IDs to `skcs_team_id`.
- `public.team_aliases`
  - Human-friendly aliases for matching team names.
- `public.match_results`
  - Canonical finished-match spine.
  - Source: `supabase/migrations/20260531000002_skcs_engine_v2_phase0b_match_results.sql`

## Prediction tables

- `public.direct1x2_prediction_final`
  - Current publication table for the website read path.
  - Still used as the main compatibility layer.
- `public.prediction_core`
- `public.prediction_publication`
- `public.prediction_insights`
- `public.prediction_metadata`
- `public.prediction_scores`
  - New scoring layer for deterministic confidence and context.
- `public.team_form`
- `public.team_strength`
- `public.head_to_head`
- `public.injury_impact`
- `public.volatility_factors`

## Rules and governance tables

- `tier_rules`
  - Tier gating and allowed market rules.
- `acca_rules`
  - Combination-bet guardrails.
- `secondary_market_allowlist`
  - Allowlist for secondary markets.
- `skcs_subscription_plans`
- `skcs_allocation_matrix`
- `skcs_daily_wallets`

## Ingestion, cache, and ops tables

- `sport_sync`
- `raw_fixtures`
- `predictions_raw`
- `predictions_filtered`
- `predictions_accuracy`
- `context_enrichment_queue`
- `fixture_processing_log`
- `event_odds_snapshots`
- `bookmaker_odds`
- `prediction_secondary_markets`
- `event_injuries`
- `event_news_scores`
- `rapidapi_cache`
- `context_intelligence_cache`
- `fixture_context_cache`
- `blocked_api_calls_log`
- `rapidapi_quota_usage`
  - Provider quota ledger by minute/day.
- `scheduling_logs`
  - Scheduler telemetry table.
- `insight_usage`
  - Weekly fixture-use ledger enforcing one-fixture-per-format governance.
- `api_raw`
  - Partitioned raw API payload archive referenced by maintenance jobs.

## AI execution and telemetry tables

- `ai_pipeline_telemetry`
  - Primary AI task-run ledger for token counts, latency, success status, and cost estimates.
  - Fields:
    - `id` UUID primary key
    - `recorded_at` timestamptz
    - `pipeline_name` text
    - `task_name` text
    - `model` text
    - `input_tokens` integer
    - `output_tokens` integer
    - `latency_ms` integer
    - `success` boolean
    - `finish_reason` text
    - `cost_estimate` numeric
    - `status` text
    - `ceiling_type` text
    - `partial` boolean
    - `metadata` jsonb
- `blocked_ai_calls_log`
  - Governance log for AI calls blocked by quota, budget, or policy.
  - Fields:
    - `id` bigserial primary key
    - `recorded_at` timestamptz
    - `pipeline_name` text
    - `task_name` text
    - `model` text
    - `reason` text
    - `requested_input_tokens` integer
    - `requested_output_tokens` integer
    - `budget_class` text
    - `ceiling_type` text
    - `metadata` jsonb
- `ai_usage_daily`
  - Daily rollup table for spend aggregation by pipeline/task/model/day.
  - Used by the pre-flight budget check and nightly counter refresh.

## Views and materialized views

- `public.predictions_final`
- `public.prediction_final`
- `public.v_predictions_final`
- `mv_admin_pipeline_health`
- `mv_admin_daily_volume`
- `mv_admin_ai_suppression`
- `mv_admin_suppression_reasons`
- `mv_admin_processing_times`
- `mv_admin_odds_volatility`
- `mv_admin_bookmaker_coverage`
- `mv_admin_risk_distribution`

## Notes

- The schema still has legacy compatibility layers, especially around `predictions_final` and `direct1x2_prediction_final`.
- `match_results` is the best canonical source for backfills and deterministic scoring.
- `prediction_scores` is the new bridge between the raw publication layer and the future SQL-first engine.
- `insight_usage`, `rapidapi_quota_usage`, `scheduling_logs`, and `blocked_api_calls_log` are the operational enforcement layer behind the governance docs.
- `ai_pipeline_telemetry` and `ai_usage_daily` are the AI cost-control layer.
- This file is intentionally an inventory, not the final schema contract.
