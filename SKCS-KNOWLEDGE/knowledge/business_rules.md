# SKCS Business Rules

This file captures the major business rules that shape predictions, publication, and access.

## Confidence and risk

- Confidence bands are enforced as a core product rule.
- `80-100%` is treated as high confidence.
- `70-79%` is moderate risk.
- `59-69%` is high risk and must carry secondary insights.
- `0-58%` is extreme risk and must be heavily constrained.

## Secondary market governance

- Secondary insights are only valid above the required confidence threshold.
- Secondary markets are limited by allowlist rules in the database.
- The application and schema must stay aligned on these constraints.

## Subscription and access

- Access is tiered across `core`, `elite`, and `vip`.
- Subscription logic is resolved through backend access-context middleware and related plan tables.
- Admin bypass behavior exists for the SKCS owner email defined in the backend rules.

## Football and pre-match focus

- The current operating focus is pre-match football content.
- Live score fetching can be disabled with environment flags.
- Quota exhaustion must stop retries quickly instead of causing retry storms.

## Time and schedule

- Football fixtures use a 15-minute grace window after kickoff.
- SAST / `Africa/Johannesburg` is used for the daily cutoff and sync window logic.
- Scheduled jobs should be treated as production dependencies, not optional helpers.

## Documentation rule

- No new formula, rule, table, view, API integration, or job should exist without documentation in the knowledge layer.

## Open gaps

- Some rules still live in code rather than in SQL.
- The knowledge layer should eventually identify which rules are authoritative in database schema and which remain app-side only.
