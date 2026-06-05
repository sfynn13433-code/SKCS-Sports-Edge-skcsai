# SKCS Business Rules

This file captures the major business rules that shape predictions, publication, and access.

## Confidence and risk

- Confidence bands are enforced as a core product rule.
- Direct 1X2 uses the Master Rulebook bands:
  - `75-100%` = Low Risk
  - `55-74%` = Medium Risk
  - `30-54%` = High Risk (must carry secondary insights)
  - `0-29%` = Extreme Risk (not published; heavily constrained)
- ACCA legs require a minimum of `75%` confidence.

## Secondary market governance

- Secondary insights are only valid at `72%` or higher.
- Secondary markets are limited to a maximum of 4 per match.
- Secondary markets are limited by allowlist rules in the database.
- Double Chance is a separate market group and is not part of the secondary pool.
- Same Match Builder is tracked separately as sizes `4`, `6`, and `8`.
- The application and schema must stay aligned on these constraints.

## Subscription and access

- Access is tiered across `core`, `elite`, and `vip`.
- Subscription logic is resolved through backend access-context middleware and related plan tables.
- Admin bypass behavior exists for the SKCS owner email defined in the backend rules.

## Football and pre-match focus

- The current operating focus is pre-match football content.
- Pre-match score fetching can be disabled with environment flags.
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
