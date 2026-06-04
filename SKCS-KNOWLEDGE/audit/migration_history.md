# SKCS Migration History

## Purpose

Track meaningful schema and migration changes so future AI sessions do not have to rediscover the same drift.

## Current known event

- `20260418000002_update_predictions_final_risk_level_check.sql`
  - Originally assumed `predictions_final` was a table.
  - The repo now treats it as a view in the current schema chain, so the migration needed a table-kind guard.

## Next items to add

- Table/view rename history.
- Compatibility-layer migrations.
- Major scoring-layer migrations.
- Any migration that changes the read path or publication path.
