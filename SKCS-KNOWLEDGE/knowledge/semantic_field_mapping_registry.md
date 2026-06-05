# Semantic Field Mapping Registry

This registry captures **meaning**, not just structure. It defines how SKCS should interpret source fields, which values are canonical, and which assumptions must never leak into grading, enrichment, or reporting.

The goal is to prevent semantic drift such as:
- joining on team names instead of `GameId`
- treating `Period1` as a missing halftime object
- assuming SportsDataIO soccer exposes weather or news when it does not

## Canonical identity rules

- `GameId` is the canonical match identity for SportsDataIO soccer.
- `HomeTeamName`, `AwayTeamName`, and `DateTime` are **not** identity keys.
- Any join that can be expressed with `GameId` should use `GameId`.
- Name-based joins are fallback-only and must be marked as inferred, not verified.

## Time and period mapping

- Soccer halftime is represented by `Period1`, not by a separate `HalftimeScore` object.
- Full-time state should be derived from the final match status and final period scores.
- A `null` halftime value is not automatically an error if the source feed does not expose a dedicated halftime field.

## Match status normalization

- `Final` means the game is complete and eligible for grading.
- `InProgress` means the game is in play and should not be treated as settled.
- `Break` means halftime and should be treated as a pause state, not a missing-data state.
- `Postponed` should be excluded from normal grading windows unless an explicit backfill process handles it.

## Player and injury mapping

- Injury truth for soccer should come from the actual SportsDataIO player or player-game injury fields that exist in the feed.
- `Player.InjuryStatus` and `PlayerGame.InjuryStatus` are semantic sources when present.
- The meaning of injury labels must be normalized before they are used in prediction logic.
- Any injury classification that is not source-backed must be flagged as inferred.

## Context reality boundaries

- Weather is **not** a guaranteed SportsDataIO soccer input.
- News is **not** a guaranteed SportsDataIO soccer input.
- If a pipeline expects weather or news for soccer, that expectation must be explicitly marked as external or unsupported.
- Missing weather/news data should not be interpreted as a pipeline failure unless the source contract guarantees those fields.

## Anti-patterns

- Do not use team names as primary identity keys.
- Do not invent halftime fields that are not present in the source schema.
- Do not assume every sport code has the same enrichment sources.
- Do not convert unsupported source gaps into generic “missing data” failures without checking the feed contract first.

## Grading impact

- Wrong identity mapping causes duplicate rows, bad joins, and collapsed fixtures.
- Wrong time mapping causes incorrect halftime evaluation and false in-play assumptions.
- Wrong context assumptions create hallucinated enrichment, degraded evidence stacks, and misleading loss explanations.
- Semantic mapping should be treated as a control layer, not a documentation luxury.

## Maintenance rule

- Update this registry whenever a source feed changes field names, status labels, or supported context types.
- If a field is used in a prediction or grading path, its meaning should be recorded here before it is treated as trusted runtime truth.
