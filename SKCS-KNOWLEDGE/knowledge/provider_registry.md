# SKCS Provider Registry

This file tracks provider behavior, fallback order, and quota implications.

## Provider classification types

| Type | Purpose |
|------|---------|
| `PRIMARY` | Canonical truth for fixtures, teams, results |
| `SECONDARY` | Gap-fill when primary unavailable (governed) |
| `FALLBACK` | Last-resort ingest (governed) |
| `VERIFICATION` | Cross-provider compare only — never canonical |
| `ENRICHMENT` | Odds, sentiment, lineups, metadata — feature store lane |

## Football and sports providers

- API-Sports
  - **Type:** PRIMARY
  - **Status:** **ON HOLD** (2026-06-06) — commercial/budget constraint
  - **Policy:** Code preserved intact. No removal. No new development. No migration cleanup. Available for future reactivation.
  - Primary football provider when active.
  - Must be quota-aware and can be blocked when the provider is suspended or exhausted.
- TheSportsDB
  - **Type:** SECONDARY / discovery
  - Discovery and fallback source.
- RapidAPI hosts
  - **Type:** SECONDARY / enrichment
  - Multi-provider layer for odds, highlights, cricket, and related data.
- SportsData.io
  - **Type:** ENRICHMENT (pre-match context)
  - UCL schedule path wired in P0 (`competition_id=3` on free trial).
  - See `docs/sportsdataio-pre-match-directive.md`.
- Big Balls Sports Data (BBD)
  - **Type:** **PRIMARY CANDIDATE** (football pilot) + multi-sport evaluation
  - **Status:** **PRIMARY PILOT** (2026-06-06) — gated by `BIG_BALLS_PRIMARY_FOOTBALL=true`
  - **API:** `https://api.bigballsdata.com/v1/`
  - **Auth:** `Authorization: Bearer bbs_live_…` — key from [dashboard/keys](https://bigballsdata.com/dashboard/keys)
  - **Env:** `BIG_BALLS_DATA_API_KEY`, `ENABLE_BIG_BALLS_DATA_PROVIDER=true`
  - **Adapter:** `backend/providers/football/bigBallsDataProvider.js`
  - **Docs:** [bigballsdata.com/docs](https://bigballsdata.com/docs), [OpenAPI](https://bigballsdata.com/openapi.json)
  - **Not wired to:** prediction pipelines, public website canonical ingest
  - **Pilot ingest:** `backend/services/bigBallsFootballBridge.js` → `buildLiveData` (7 tier-1 leagues)
  - See `../providers/bigballs_primary_assessment.md`, `../providers/bigballs_endpoint_catalog.md`, `../providers/bigballs_discovery_audit.md`, `../providers/bigballs_semantic_mapping.md`, `../providers/bigballs_provider_health.md`, `../governance/bigballs_evaluation_focus.md`
- Bzzoiro Sports Data (BSD)
  - **Type:** ENRICHMENT + VERIFICATION
  - **Status:** **PAUSED EVALUATION** — artifacts preserved; Bzzoiro superseded by BBD focus
  - **Status:** Provider Transition Directive Phases 1–5 complete (2026-06-06). Gated by `ENABLE_BZZOIRO_PROVIDER=true`.
  - **Enrichment adapter:** `backend/providers/football/bzzoiroProvider.js` — odds/comparison, polymarket, lineups
  - **Evaluation adapter:** `backend/providers/football/bsdProvider.js` — competitions, fixtures, fixtureDetails, standings, lineups, odds
  - **Approved for enrichment:** odds/comparison, polymarket, lineups only
  - **Blocked:** stats (xG/spatial), predictions, WebSocket canonical writes, prediction-engine input
  - **Not wired to:** prediction pipelines, grading, verification logic changes, public website canonical ingest
  - See `../providers/bsd_endpoint_catalog.md`, `../providers/bsd_coverage_audit.md`, `../providers/bsd_semantic_mapping.md`, `../providers/bsd_provider_health.md`, `../providers/bsd_league_inventory.md`, `../providers/bsd_readiness_assessment.md`

## AI providers

- Groq
  - Primary explanation / analysis provider.
- Dolphin
  - Fallback provider.

## Enrichment providers

- OpenWeather
  - Weather enrichment.
- News providers
  - Context, trends, and headlines.

## Registry fields to capture for each provider

- Purpose.
- Auth method.
- Quota rules.
- Fallback order.
- Cost impact.
- Main callsites.
- Failure behavior.

## Current risk notes

- Provider quotas must be captured in the registry, not just in runtime code.
- If a provider is suspended, the system should preserve that signal instead of converting it into a generic null result.
