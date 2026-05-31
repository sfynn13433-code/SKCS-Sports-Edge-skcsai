# skcs_grading_snapshot_v1

Single grading contract for Accuracy Center. V1 predictions only until V2 has graded outcomes.

## Endpoint

`GET /api/skcs/grading-snapshot`

### Query

| Param | Description |
|-------|-------------|
| `sport` | Sport key (`football` default) |
| `from` / `to` | Inclusive date window (ISO dates) |
| `date` | Single-day shorthand (`from` = `to` = `date`) |
| `publish_run` / `run_id` | Publish run id or `latest` |
| `format` | `legacy` returns `/api/accuracy`-compatible JSON for existing UI |

## Response (default)

```json
{
  "schema_version": "skcs_grading_snapshot_v1",
  "sport": "football",
  "engine_sources": ["v1_predictions"],
  "window": { "from": "...", "to": "...", "publish_run": "latest" },
  "tier_accuracy": { "core": {}, "elite": {}, "same_match": {}, "acca": {} },
  "product_matrix": [],
  "weekly_performance": [],
  "loss_drivers": [],
  "availability": {},
  "meta": {}
}
```

## Data sources

- Graded legs: `predictions_accuracy` (quality-filtered)
- Publish summary: `direct1x2_prediction_final`
- Runs: `prediction_publish_runs`
- Loss evidence: `loss_factors` / `loss_reason_summary` on accuracy rows

## Phase B — populate `predictions_accuracy`

```bash
npm run accuracy:audit      # diagnose events vs predictions vs accuracy rows
npm run accuracy:bridge     # raw → direct1x2_prediction_final (when final table empty)
npm run accuracy:backfill   # grade finished events into predictions_accuracy
npm run accuracy:track -- --date=2026-04-18 --sport=football
```

**Root causes if empty:** (1) `direct1x2_prediction_final` never populated — bridge from `predictions_raw`; (2) grader only matched `status='FT'` — now accepts `finished` etc.; (3) cron deleted finals after kickoff — graded rows are now retained.

## Phase C (later)

Union V1 + V2 with `prediction_source` without changing this contract.
