# Bzzoiro Sports Data (BSD) — Phase 1 Discovery Audit

**Status:** Phase 1 complete — field audit cleared 2026-06-11. Sandboxed adapter only.  
**Date:** 2026-06-06  
**Rank source:** Executive Summary PDF — #1 ranked free alternative  
**Governance decision:** **D — Verification / Enrichment only** (see `../governance/provider_scorecard_bsd.md`)

## Executive summary

BSD offers exceptional **technical surface area** (65 leagues, 64k+ matches, WebSocket, odds comparison, xG, AI lineups) at **zero cost and no rate limits**. SKCS must **not** treat BSD as a primary or fallback provider until **data provenance and redistribution rights** are documented beyond ODbL marketing copy.

Approved SKCS posture:

```text
API-Sports  →  Semantic Layer  →  Canonical Match  →  Prediction Engine
BSD         →  Enrichment Layer  →  Feature Store / Verification only
```

Official references:

- Docs v2: https://sports.bzzoiro.com/docs/v2/
- Base URL: `https://sports.bzzoiro.com/api/v2/`
- Auth: `Authorization: Token {API_KEY}` (free registration)
- Status: https://sports.bzzoiro.com/status/
- OpenAPI: https://sports.bzzoiro.com/openapi.json

---

## 1. Coverage

| Metric | BSD claim (audit) | SKCS relevance |
|--------|-------------------|----------------|
| Leagues | 65 global football competitions | Overlaps SKCS top-5 + UCL + J-League + MLS + Brasileirão |
| Matches | 64,654 historical rows (catalog) | Sufficient for cross-provider verification |
| Seasons | Full DB returned; per-league depth varies | Must be validated per `league_id` before backtest use |
| Non-football | Football only | No impact on NBA/NFL/NHL paths |

### SKCS league overlap (expected — requires live ID crosswalk)

| SKCS competition | API-Sports / TheSportsDB | BSD expectation |
|------------------|--------------------------|-----------------|
| Premier League | 39 / 4328 | Likely present — confirm `league_id` |
| La Liga | 140 / 4335 | Likely present |
| Bundesliga | 78 / 4331 | Likely present |
| Serie A | 135 / 4332 | Likely present |
| Ligue 1 | 61 / 4334 | Likely present |
| UEFA Champions League | 3 | Likely present |
| J1 / J2 | 98 / 99 | Listed in BSD coverage notes |
| MLS / USL | 253 / 255 | Listed |
| Brasileirão A/B | 71 / 72 | Listed |
| Chinese Super League | 169 | Listed |

**Gap risk:** BSD league IDs will **not** match API-Sports IDs. Crosswalk must be built in Semantic Layer (`league_id` ↔ `apisports_league_id`), never assumed equal.

**Missing from BSD (vs SKCS 13-sport scope):** Basketball, MLB, NHL, NFL, cricket, rugby, MMA, F1, volleyball, handball, AFL, tennis.

---

## 2. Match data surface

| Capability | BSD endpoint | SKCS canonical role |
|------------|--------------|---------------------|
| Fixtures | `GET /api/v2/events/` | Verification crosswalk only |
| Live window | `GET /api/v2/events/live/` | **Blocked** for pre-match product default |
| Event detail | `GET /api/v2/events/{id}/` | Identity resolution |
| Standings | `GET /api/v2/leagues/{id}/standings/` | Enrichment (xGF/xGA columns) |
| Lineups | `GET /api/v2/events/{id}/lineups/` | **Approved** enrichment |
| Injuries / availability | embedded in events / lineups | Enrichment |
| Team stats | `GET /api/v2/events/{id}/stats/` | **Blocked** spatial/xG (see feature registry) |
| Player stats | `GET /api/v2/events/{id}/player-stats/` | Restricted — verification only |
| Odds | `GET /api/v2/events/{id}/odds/comparison/` | **Approved** enrichment |
| Polymarket | `GET /api/v2/events/{id}/polymarket/` | **Approved** verification signal |
| Predictions | `GET /api/v2/events/{id}/prediction/` | **Blocked** from feature store |

---

## 3. Identifier model (critical for Semantic Layer)

| BSD field | Type | SKCS canonical target | Notes |
|-----------|------|----------------------|-------|
| `id` (event) | integer | `provider_event_id` | Primary BSD fixture key — stringify at boundary |
| `league_id` | integer | `provider_league_id` | Must crosswalk to API-Sports league |
| `season_id` | integer | `provider_season_id` | Season scoping |
| `home_team_id` / `away_team_id` | integer | `provider_home_team_id` / `provider_away_team_id` | Never use as SKCS primary team key |
| `status` | string | `MatchStatusNormalized` | Map via `semantic-layer/registry.js` |
| `home_score` / `away_score` | integer | `HomeGoals` / `AwayGoals` | Verification only until canonical result exists |

**Rule:** BSD integers are **provider-local foreign keys**. Canonical match identity remains API-Sports `fixture.id` until a verified crosswalk table exists.

---

## 4. Live updates

| Property | BSD behavior | SKCS policy |
|----------|--------------|-------------|
| REST live | `/events/live/` — 30s Redis cache | Do not poll in heartbeat |
| WebSocket | `wss://sports.bzzoiro.com/ws/live/?token=` | Experimental verification lane only |
| Replay | Not documented for WS | Treat as ephemeral — no canonical truth from WS |
| Update frequency | Sub-second push (marketing) | Pre-match SKCS does not require live feed |

---

## 5. Reliability

| Signal | Evidence | Score |
|--------|----------|-------|
| Status page | https://sports.bzzoiro.com/status/ | Present |
| SLA | None — indie side project | None |
| Uptime metrics | Not enterprise-grade | Unknown |
| Key-person risk | Solo dev, Discord + ProtonMail support | High |
| OpenAPI schema | Reported broken at `/api/schema/` (499) | Integration friction |

**Outage behavior:** Unknown graceful degradation. SKCS must treat BSD as **best-effort enrichment**, never blocking pipeline.

---

## 6. Data provenance summary

| Category | Classification | SKCS action |
|----------|----------------|-------------|
| Fixtures, results, standings, lineups, injuries, player/team stats, xG, shot maps, coordinates, momentum | **RED** — upstream opaque | Block from feature store |
| Odds | **YELLOW** — bookmaker partners claimed | Approved enrichment with attribution |
| BSD ML predictions | **GREEN** — in-house CatBoost | Verification compare only; block probabilities from models |

**ODbL note:** Share-alike copyleft may contaminate derivative SKCS models if BSD core match data is ingested for training. Keep BSD in **isolated enrichment tables** with clear lineage flags.

---

## 7. Minimum endpoint set for SKCS enrichment lane

```text
GET /api/v2/leagues/                    → league directory + crosswalk seed
GET /api/v2/events/?league_id={id}      → fixture discovery for verification
GET /api/v2/events/{id}/odds/comparison/ → 14 books + Polymarket
GET /api/v2/events/{id}/polymarket/     → market-implied probabilities
GET /api/v2/events/{id}/lineups/        → confirmed + predicted XIs
```

**Redundant for SKCS:** global `/odds/`, `/teams/{id}/fixtures/` (use events filter), consensus-only `/odds/` when comparison exists.

**Unique vs API-Sports (high value, high risk):** per-shot xG coordinates, momentum index, AI-predicted lineups with confidence, Polymarket side-by-side odds.

---

## 8. Endpoint chain for SKCS hierarchy (enrichment path only)

```text
League   → GET /api/v2/leagues/
Fixture  → GET /api/v2/events/?league_id={id}
Team     → GET /api/v2/teams/{team_id}/
Player   → GET /api/v2/teams/{team_id}/squad/  OR  /events/{id}/player-stats/
Odds     → GET /api/v2/events/{id}/odds/comparison/
Stats    → GET /api/v2/events/{id}/stats/      [BLOCKED — governance]
Predict  → GET /api/v2/events/{id}/prediction/ [VERIFICATION ONLY]
```

---

## 9. Phase gate — before any adapter code

- [ ] Obtain BSD API token in isolated env (not production secrets yet)
- [ ] Live crosswalk: BSD `league_id` ↔ API-Sports `league.id` for SKCS tier-1 leagues
- [ ] Capture sample JSON for approved endpoints only
- [ ] Legal review of ODbL + bookmaker redistribution for commercial SKCS use
- [ ] Governance sign-off on `feature_risk_registry.md`

**Next investigation (Notebook):** Field-level extraction audit for approved endpoints — full JSON samples, per-field Prediction Value / Reliability / Governance Risk scores.
