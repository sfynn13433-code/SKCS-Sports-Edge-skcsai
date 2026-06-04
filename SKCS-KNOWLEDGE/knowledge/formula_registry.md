# SKCS Formula Registry

SKCS is a scoring engine, so this file is one of the most important parts of the knowledge layer.

## Core deterministic formulas

- `calculate_form_score(team_id, season_year)`
  - Purpose: convert recent results into a normalized form score.
  - Source: `supabase/migrations/20260822000005_skcs_engine_v2_engine_core.sql`
- `calculate_home_advantage(team_id, opponent_id, season_year)`
  - Purpose: compare home and away strength signals.
- `calculate_team_strength(team_id, season_year)`
  - Purpose: combine form, attack, defense, and injury penalty.
- `calculate_injury_impact(team_id)`
  - Purpose: aggregate current injury penalty for a team.
- `calculate_volatility(league_id, market_id)`
  - Purpose: fetch or derive market volatility.
- `calculate_confidence(...)`
  - Purpose: produce the final confidence score used by the deterministic layer.

## Supporting utility formulas

- `normalize_match_status(status)`
  - Normalizes result labels such as `FT`, `finished`, and `match finished`.
- `resolve_skcs_team_id(...)`
- `upsert_skcs_team_from_provider(...)`
- `skcs_to_numeric_safe(...)`
- `normalize_provider_market_key(...)`

## Formula inventory standards

- Every formula must have a purpose, inputs, outputs, dependencies, and consumers.
- Every formula should state whether it is authoritative in SQL or merely a helper in code.
- Every formula should show where it is used in prediction, publication, or filtering.

## Important future entries

- Confidence score versions.
- Volatility score versions.
- ACCA gate logic.
- Subscription wallet quota allocation.
- AI explanation weighting.

## Notes

- This registry should eventually become the source of truth for any prediction math.
- The value of SKCS comes from the formulas, not just from the stored rows.
