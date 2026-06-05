# SKCS System Topology

## Current topology note

SKCS uses one canonical read path for the UI, but multiple provider inputs can feed the system through controlled normalization and publish steps. Raw provider payloads are not the source of truth.

## High-level flow

External APIs
-> backend ingestion and quota layers
-> Supabase tables and functions
-> views and publication tables
-> website and dashboard

## Main backend layers

- `apiQuotaRouter`
  - Decides whether an upstream call is allowed.
- `providerQuotaService`
  - Reads and summarizes usage state.
- `quotaPlanner`
  - Preflight planner for football budget allocation.
- `dataProvider`
  - Builds pre-match data and fallback payloads.
- `syncService`
  - Orchestrates sports sync runs.
- `skcsHeartbeat`
  - Runs recurring background refreshes for pre-match metadata; live refreshes are gated off by default.
- `aiPipeline`
  - Produces analysis and explanation content.

## Database topology

- Canonical identity and history
  - `skcs_teams`, `team_identity_map`, `team_aliases`, `match_results`
- Canonical football truth
  - `football_canonical_events`, `canonical_events`
- Deterministic scoring layer
  - `team_form`, `team_strength`, `head_to_head`, `injury_impact`, `volatility_factors`, `prediction_scores`
- Publication layer
  - `direct1x2_prediction_final`, `predictions_final`, `v_predictions_final`
- Governance layer
  - `tier_rules`, `acca_rules`, `secondary_market_allowlist`
- Ops and telemetry
  - `fixture_processing_log`, `sport_sync`, `event_odds_snapshots`, caches, and admin views

## Read path

- The website should read from the publication view, not directly from raw ingestion tables.
- The deterministic layer should be treated as the authoritative business logic where possible.
- The frontend must read only from published, canonical rows, not raw provider payloads.

## Write path

- External data is ingested into raw or canonical tables.
- Deterministic SQL functions derive scores.
- Publication tables and views expose the final result.
- Providers are inputs. Canonical storage is truth. UI is read-only.

## Important topology note

- The system still contains legacy and compatibility layers.
- The knowledge layer must record which layer is authoritative for each business function.
