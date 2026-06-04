# SKCS Views and Materialized Views

## Current key views

- `public.predictions_final`
  - Compatibility view over `direct1x2_prediction_final`.
- `public.prediction_final`
  - Legacy compatibility alias for the same publication layer.
- `public.v_predictions_final`
  - Knowledge-layer read view that can incorporate `prediction_scores`.

## Materialized admin views

- `mv_admin_pipeline_health`
- `mv_admin_daily_volume`
- `mv_admin_ai_suppression`
- `mv_admin_suppression_reasons`
- `mv_admin_processing_times`
- `mv_admin_odds_volatility`
- `mv_admin_bookmaker_coverage`
- `mv_admin_risk_distribution`

## What should be recorded for each view

- Purpose.
- Source tables.
- Consumers.
- Filters / business rules.
- Refresh logic.
- Whether it is authoritative or only compatibility support.

## Important note

- Views are part of the business contract.
- If a view changes, the knowledge layer should record the old and new consumer impact.
