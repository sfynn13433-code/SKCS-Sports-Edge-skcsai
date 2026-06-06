# BSD (Bzzoiro / BigBalls Sports Data) — Endpoint Catalog

**Status:** Phase 1 complete — live-verified 2026-06-06  
**Provider role:** Evaluation + enrichment (not canonical primary)  
**API-Sports:** ON HOLD — preserved intact; no removal

## Connection

| Property | Verified value |
|----------|----------------|
| Base URL | `https://sports.bzzoiro.com/api/v2/` |
| Auth method | `Authorization: Token {BZZOIRO_API_TOKEN}` |
| Pagination | `limit` (default 50, max 200), `offset` |
| Date filters | `date_from`, `date_to` (`YYYY-MM-DD`) on `/events/` |
| Rate-limit headers | **None observed** (`x-ratelimit-*`, `retry-after` all null) |
| Marketing claim | No rate limits on free tier |

Official references: [Docs v2](https://sports.bzzoiro.com/docs/v2/) · [OpenAPI](https://sports.bzzoiro.com/openapi.json) · [Status](https://sports.bzzoiro.com/status/)

---

## Core football endpoints (live-enumerated)

### Competitions / leagues

| Endpoint | Purpose | Key parameters | Response structure | Limitations |
|----------|---------|----------------|-------------------|-------------|
| `GET /leagues/` | List football competitions | `limit`, `offset`, `is_active` | `{ count, next, previous, results[] }` — each league has `id`, `name`, `country`, `current_season` | 65 leagues total; some cups lack `current_season` |
| `GET /leagues/{id}/` | League detail | `id` | Single league object + season metadata | — |
| `GET /leagues/{id}/standings/` | Table positions | `season_id` (required) | `{ league_id, season, grouped, standings[] \| groups{} }` | xGF/xGA columns present; grouped cups use `groups` object |

### Seasons

| Endpoint | Purpose | Parameters | Response | Limitations |
|----------|---------|------------|----------|-------------|
| Embedded in `/leagues/` | Current season per league | — | `current_season: { id, name, year, start_date, end_date, is_current }` | Historical season list endpoint not separately verified; season scoping via `season_id` on events/standings |

### Teams

| Endpoint | Purpose | Parameters | Response | Limitations |
|----------|---------|------------|----------|-------------|
| `GET /teams/` | Team catalog | `limit`, `offset`, `league_id` | `{ count, results[] }` — `id`, `name`, `short_name`, `country`, `venue_id` | **2,874 teams** in catalog; names may include placeholder groups (e.g. AFCON draw buckets) |
| `GET /teams/{id}/` | Team detail | `id` | Team profile + venue link | Not exercised in this audit |

### Fixtures / events

| Endpoint | Purpose | Parameters | Response | Limitations |
|----------|---------|------------|----------|-------------|
| `GET /events/` | Fixture list | `league_id`, `season_id`, `team_id`, `status`, `date_from`, `date_to`, `limit`, `offset`, `ordering` | `{ count, results[] }` — flat event rows with scores, H2H embed, weather | **64,654 events** total; `season_id` nullable on some rows |
| `GET /events/{id}/` | Fixture detail | `id` | Full event object (same shape as list row + embedded H2H) | — |
| `GET /events/live/` | Live window | — | Subset of in-progress events | **Blocked** for SKCS pre-match product default |

### Odds

| Endpoint | Purpose | Parameters | Response | Limitations |
|----------|---------|------------|----------|-------------|
| `GET /events/{id}/odds/comparison/` | Multi-bookmaker quotes | `id` | `{ markets: { marketKey: { outcome: { bookmaker_slug: { odds, ... } } } } }` | Sparse coverage on far-future fixtures (0 bookmakers observed) |
| `GET /bookmakers/` | Bookmaker registry | `limit` | `{ count, results[] }` — `slug`, `name` | **17 bookmakers** verified |
| `GET /events/{id}/polymarket/` | Prediction-market sentiment | `id` | Implied probabilities | **404** when no Polymarket market exists (expected) |

### Lineups

| Endpoint | Purpose | Parameters | Response | Limitations |
|----------|---------|------------|----------|-------------|
| `GET /events/{id}/lineups/` | Confirmed/provisional XI | `id` | `{ lineup_status, lineups: { home, away }, unavailable_players, confidence, beta }` | `lineup_status: unavailable` common pre-match; `confidence`/`ai_score` are verification-only fields |

### Statistics (documented — not wired to SKCS decision-making)

| Endpoint | Purpose | SKCS policy |
|----------|---------|-------------|
| `GET /events/{id}/stats/` | Match stats incl. xG/spatial | **Blocked** from feature store |
| `GET /events/{id}/player-stats/` | Per-player match stats | Verification lane only |
| `GET /events/{id}/prediction/` | BSD AI prediction | **Blocked** — never prediction-engine input |

### Historical / auxiliary

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| Embedded `head_to_head` on events | H2H summary | Included in event list/detail — not a separate canonical ingest path |
| `wss://sports.bzzoiro.com/ws/live/` | WebSocket live feed | Experimental verification only — no canonical writes |

---

## SKCS adapter mapping

Evaluation adapter: `backend/providers/football/bsdProvider.js`

| Adapter function | BSD endpoint |
|------------------|--------------|
| `competitions()` | `GET /leagues/` |
| `fixtures()` | `GET /events/` |
| `fixtureDetails()` | `GET /events/{id}/` |
| `standings()` | `GET /leagues/{id}/standings/` |
| `lineups()` | `GET /events/{id}/lineups/` |
| `odds()` | `GET /events/{id}/odds/comparison/` |

Enrichment-only adapter (governance-sandboxed): `backend/providers/football/bzzoiroProvider.js` — odds, polymarket, lineups bundle for `rapidapi_cache`.

---

## Observed HTTP behavior

| Status | Meaning | Sample |
|--------|---------|--------|
| 200 | Success | All core read endpoints |
| 401 | Invalid/missing token | Not observed with configured token |
| 404 | Resource absent | Polymarket when no market |
| 429 | Rate limit | Not observed; no quota headers returned |

---

## Related artifacts

- `bsd_coverage_audit.md` — verified counts vs API-Sports
- `bsd_semantic_mapping.md` — field-level canonical mapping
- `bsd_provider_health.md` — latency and reliability probe
- `bzzoiro_field_audit.md` — governance field verdicts (prior phase)
