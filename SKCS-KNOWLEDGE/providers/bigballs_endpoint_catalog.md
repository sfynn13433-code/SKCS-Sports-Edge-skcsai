# Big Balls Data — Endpoint Catalog

**Status:** Phase 1 — OpenAPI + docs verified; live authenticated probes **pending API key**  
**Provider:** [Big Balls Sports Data](https://bigballsdata.com/docs)  
**SKCS lane:** Evaluation + enrichment (not canonical primary)  
**API-Sports:** ON HOLD — preserved intact

## Connection

| Property | Documented value |
|----------|------------------|
| Primary base URL | `https://api.bigballsdata.com` |
| Fallback gateway | `https://bbsgateway-production.up.railway.app` |
| API version | `/v1` |
| Auth | `Authorization: Bearer bbs_live_…` or `x-api-key: bbs_live_…` ([authentication](https://bigballsdata.com/docs/authentication)) |
| Anonymous access | **None** — 401 `missing_api_key` verified |
| Response envelope | `{ data, meta, error }` — `meta.confidence`, `meta.source`, `meta.cached` |
| Contract | [OpenAPI 3.1](https://bigballsdata.com/openapi.json) |

## Rate limits ([docs](https://bigballsdata.com/docs/rate-limits))

| Plan | Per minute | Per day (UTC) |
|------|------------|---------------|
| Free | 100 | 1,000 (2,000 with GitHub signup per marketing) |
| Starter | 1,000 | 10,000 |
| Growth | 2,500 | 50,000 |
| Pro | 5,000 | 200,000 |

Headers: `X-RateLimit-Limit-Minute`, `X-RateLimit-Remaining-Minute`, `X-RateLimit-Limit-Day`, `X-RateLimit-Remaining-Day`, `X-RateLimit-Reset`.  
429 returns `Retry-After` + `error.scope` (`minute` | `day`).

## Sports covered

`football`, `basketball`, `baseball`, `ice_hockey`, `cricket`, `mma`, `boxing`, `formula1`, `american_football` ([introduction](https://bigballsdata.com/docs/introduction))

## Core REST endpoints (football-relevant)

| Endpoint | Purpose | Key parameters | Response | SKCS adapter |
|----------|---------|----------------|----------|--------------|
| `GET /v1/sports` | Sport catalogue | — | `data[]` sport slugs + leagues | — |
| `GET /v1/leagues` | League list | `sport`, `limit`, `offset` | `League[]` with `bb_league_*` ids | `competitions()` |
| `GET /v1/leagues/{id}` | League detail | `id` | Single league | — |
| `GET /v1/matches` | Fixture list | `sport`, `league`, `date`, `status`, `limit` | Match/score rows | `fixtures()` |
| `GET /v1/matches/{id}` | Match bundle | `sport` **required**, `fields` | Field-keyed scores/odds/lineups/stats | `fixtureDetails()` |
| `GET /v1/matches/{id}/odds` | Odds | `sport` | Aggregated bookmaker markets | `odds()` |
| `GET /v1/matches/{id}/events` | In-match events | `sport` | Goals, cards, subs | — |
| `GET /v1/standings` | Tables | `sport`, `league`, `season` | Standings rows | `standings()` |
| `GET /v1/stored/matches` | Historical archive | `sport`, `league` | DB-backed rich matches | Historical lane |
| `GET /v1/teams`, `/v1/players` | Entity catalog | filters | Team/player profiles | — |
| `GET /v1/predictions` | Elo predictions | sport/league filters | Win probabilities | **Blocked** — not prediction input |
| `GET /v1/intelligence/*` | Derived signals | various | Value finder, form, H2H, ATS | Verification only |

## Football league aliases (`?league=`)

| Alias | Competition |
|-------|-------------|
| `epl` | Premier League |
| `laliga`, `la_liga` | La Liga |
| `bundesliga` | Bundesliga |
| `seriea`, `serie_a` | Serie A |
| `ligue1`, `ligue_1` | Ligue 1 |
| `mls` | MLS |
| `ucl`, `cl`, `champions-league` | UEFA Champions League |
| `wc2026`, `world_cup` | FIFA World Cup 2026 |

## Identifier model

Canonical IDs: `bb_match_*`, `bb_league_*`, `bb_team_*` (base32 suffix).  
**Never** assume equality with API-Sports integer IDs — crosswalk required.

## Source tiers (`meta.source`)

Opaque upstream labels per [introduction](https://bigballsdata.com/docs/introduction):

- `official-league`
- `aggregator-paid`
- `aggregator-free`
- `community-scraper`

Vendor identity is intentionally hidden — governance must treat `community-scraper` as high-risk for canonical ingest.

## SKCS adapter

`backend/providers/football/bigBallsDataProvider.js` — evaluation lane:

- `competitions()` → `/v1/leagues`
- `fixtures()` → `/v1/matches`
- `fixtureDetails()` → `/v1/matches/{id}?fields=…`
- `standings()` → `/v1/standings`
- `lineups()` → match detail `fields=lineups`
- `odds()` → `/v1/matches/{id}/odds`

Gated by `ENABLE_BIG_BALLS_DATA_PROVIDER=true` + `BIG_BALLS_DATA_API_KEY`.

## Blocked for SKCS decision-making

- `/v1/predictions` and intelligence probability outputs
- WebSocket canonical writes
- Any `meta.source: community-scraper` → canonical promotion without audit

## Pagination contract (confirmed 2026-06-13)

| Property | Value |
|----------|-------|
| Default limit | `50` |
| Maximum limit | `200` |
| Exceeding max | **HTTP 400** |
| Pagination style | Page-based: `?page=1`, `?page=2`, `?page=3…` |
| Required params on `/v1/matches` | `?sport=` **OR** `?league=` |
| Bulk retrieval | Iterate pages until `batch.length < limit` |
| SKCS enforcement | `clampLimit()` in `bigBallsDataApiClient.js` caps all requests |

> **SKCS Rule**: Never send `limit > 200` to any BBD endpoint. The `clampLimit()` utility enforces this at the API client layer.

## Composite endpoint strategy

Prediction builders should prefer **composite game preview endpoints** (e.g. matchup endpoints) instead of making separate calls for preview data, odds, probabilities, and context. Composite endpoints consolidate multiple data streams into a single request.

| Strategy | Description | SKCS action |
|----------|-------------|-------------|
| Composite preview | Single request returns preview + odds + probabilities + context | Preferred for `match_preview_sync` |
| Scheduled fetches | Align with fixture lifecycle rather than polling | Preferred for all BSD jobs |
| Paginated retrieval | Iterate pages for bulk data (max 200/page) | Required for all list endpoints |
| Aggressive polling | High-frequency real-time polling | **Avoid** |

## Coverage depth (confirmed 2026-06-13)

### Tier 1 — Excellent coverage

**WC2026 (FIFA World Cup 2026)**
- 104 matches
- Live odds
- Elo win probabilities
- Advancement probabilities
- Monte Carlo simulations (calibrated from 301 historical World Cup matches)
- 26-player squads
- Golden Boot tracking
- **Schema stability:** LOCKED June 11 – July 19, 2026

**NBA**
- Play-by-play data back to 1946
- Box scores
- Shot coordinates
- Player props
- Historical hit rates
- Season averages
- Backtesting value: **VERY HIGH**

### Tier 2 — Good coverage

**Major European Soccer** (EPL, La Liga, Bundesliga, Ligue 1, Serie A)
- Player appearances, goals, assists, minutes played, player ratings
- 2025–26 season ingest complete
- Historical range: 2023–24, 2024–25, 2025–26
- Backtesting: **MODERATE**

## Schema stability guarantee

| Property | Value |
|----------|-------|
| Tournament | WC2026 |
| Schema stability | **LOCKED** |
| Lock window | June 11 – July 19, 2026 |
| Mid-tournament changes | **None** — explicitly confirmed |
| Versioning | Protects endpoint contracts |
| Semantic risk | LOW |
| Drift risk | LOW |

## Regeneration

```bash
npm run audit:bigballs-discovery
npm run verify:bigballs-provider
```
