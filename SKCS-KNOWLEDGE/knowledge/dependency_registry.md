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

## Semantic control plane dependency chain

- `get_semantic_violation_summary`
  - Depends on: `public.semantic_violations`, `pipeline_filter`, `provider_filter`, rolling time window arguments
  - Used by: `semantic-drift-summary` edge function, `backend/services/semanticDriftSummaryService.js`, dashboard summary reads
- `semanticDriftSummaryService.fetchSemanticDriftSummary`
  - Depends on: the RPC summary, `verificationController.evaluateControlPlane`
  - Used by: `backend/routes/semanticDrift.js`, future alerting and health consumers
- `verificationController.evaluateControlPlane`
  - Depends on: `controlPlaneEvaluator.js`, normalized semantic summaries, control-plane thresholds
  - Used by: `aiPipeline`, semantic drift dashboard, runtime health snapshot persistence
- `system_health_state`
  - Depends on: controller persistence output, signal normalization, transition tracking
  - Used by: `/api/health`, dashboard banners, audit and trend review
- `/api/semantic-drift-summary`
  - Depends on: `semanticDriftSummaryService`, the summary RPC, controller evaluation
  - Used by: admin drift dashboard, future alert consumers
- `/api/health`
  - Depends on: `verificationController.getSnapshot`
  - Used by: the global system-health banner and other runtime status checks

## UI dependency chain

- `system-health-banner.js`
  - Depends on: `/api/health`, `system_health_state` snapshot data
  - Used by: `public/index.html`
- `semantic-drift-dashboard.js`
  - Depends on: `/api/semantic-drift-summary`
  - Used by: `public/admin-sync.html`

## Dependency rules

- If an upstream asset changes, its downstream consumers must be checked for break impact.
- If a function becomes SQL-authoritative, the documentation should show the old code path and the new one.
- If a provider is blocked, all retry paths depending on that provider must be marked.
