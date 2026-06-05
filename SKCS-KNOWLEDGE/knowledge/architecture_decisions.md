# SKCS Architecture Decisions

## Current runtime note

The codebase now carries both canonical football truth and controlled SportsDataIO pre-match support. Record architectural decisions separately from provider semantics so the two do not get mixed together later.

## Decisions already visible in the codebase

- Supabase is the business layer.
- The website is the presentation layer.
- Deterministic logic should move into SQL where it improves auditability and consistency.
- Pre-match football is the primary focus.
- Live-style score fetching should stay disabled when the product is intentionally pre-match only.
- Quota exhaustion must stop redundant retries quickly.

## Current compatibility decisions

- `direct1x2_prediction_final` still exists as the main publication layer.
- `predictions_final` and `prediction_final` remain compatibility views.
- `v_predictions_final` is the preferred knowledge-layer read path.

## Future decisions to keep recording

- When a formula becomes SQL-authoritative.
- When a view replaces a table in the read path.
- When an API provider is demoted or disabled.
- When a scheduled job moves from Node to Supabase cron.

## Why this matters

- Architectural drift is more expensive than feature work once the system becomes multi-agent.
- Every important change should leave a paper trail in this folder.
