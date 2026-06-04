# SKCS Dependency Registry

This file maps the important assets to the things they depend on and the things that depend on them.

## Core scoring dependency chain

- `calculate_confidence`
  - Depends on: `calculate_form_score`, `calculate_team_strength`, `calculate_home_advantage`, `calculate_injury_impact`, `calculate_volatility`
  - Used by: `prediction_scores`, future confidence-based filters, and the publication layer
- `calculate_team_strength`
  - Depends on: `calculate_form_score`, `injury_impact`, `team_strength`
  - Used by: `calculate_confidence`, future strength-based filtering
- `calculate_form_score`
  - Depends on: `team_form`
  - Used by: `calculate_team_strength`, `calculate_confidence`
- `calculate_home_advantage`
  - Depends on: `team_strength`
  - Used by: `calculate_confidence`
- `calculate_injury_impact`
  - Depends on: `injury_impact`
  - Used by: `calculate_team_strength`, `calculate_confidence`
- `calculate_volatility`
  - Depends on: `volatility_factors`
  - Used by: `calculate_confidence`

## Publication dependency chain

- `prediction_scores`
  - Depends on: `direct1x2_prediction_final`, scoring functions, canonical match data
  - Used by: `v_predictions_final`, trigger notification, future dashboards
- `v_predictions_final`
  - Depends on: `direct1x2_prediction_final`, `prediction_scores`, `tier_rules`, `secondary_market_allowlist`
  - Used by: the future knowledge-layer read path
- `refresh_v_predictions_final`
  - Depends on: the same publication and governance objects as the view it recreates

## Ingestion dependency chain

- `syncSports`
  - Depends on: `quotaPlanner`, `buildLiveData`, provider config, active-sport gates
  - Used by: pipeline routes, server endpoints, deploy triggers
- `buildLiveData`
  - Depends on: provider clients, quota errors, normalization helpers
  - Used by: sync orchestration
- `apiQuotaRouter`
  - Depends on: provider registry and quota state
  - Used by: API clients, sync services, cache services
- `providerQuotaService`
  - Depends on: quota usage tables and provider config
  - Used by: quota planner and quota router
- `quotaPlanner`
  - Depends on: `providerQuotaService`
  - Used by: football sync preflight

## Operational dependency chain

- `startSKCSHeartbeat`
  - Depends on: live-score sync, trends/news sync, env flags
  - Used by: server boot
- `initCronJobs`
  - Depends on: fixture discovery, enrichment, prediction generation, cleanup queries
  - Used by: app startup

## Dependency rules

- If an upstream asset changes, its downstream consumers must be checked for break impact.
- If a function becomes SQL-authoritative, the documentation should show the old code path and the new one.
- If a provider is blocked, all retry paths depending on that provider must be marked.
