# BSD Coverage Audit — Live API Verification

**Generated:** 2026-06-06 (live probes against configured `BZZOIRO_API_TOKEN`)  
**Method:** Direct REST calls — no marketing claims  
**Comparison baseline:** API-Sports (ON HOLD — code preserved, no new development)

---

## Verified counts (BSD)

| Entity | Live count | Probe endpoint | Notes |
|--------|------------|----------------|-------|
| Competitions (leagues) | **65** | `GET /leagues/` | Football only |
| Leagues with `current_season` | **35** | `GET /leagues/` | 30 leagues lack embedded current season (cups/qualifiers) |
| Events (fixtures) total | **64,654** | `GET /events/` | Catalog-wide count in `count` field |
| Finished events | **62,526** | `GET /events/?status=finished` | Historical + completed current-season |
| Not-started events | **1,868** | `GET /events/?status=notstarted` | Upcoming window |
| Teams | **2,874** | `GET /teams/?limit=5` | Paginated catalog |
| Bookmakers | **17** | `GET /bookmakers/` | Odds comparison registry |

### Per-league fixture depth (sample — finished count)

| Competition | BSD `league_id` | Finished fixtures | Current season |
|-------------|-----------------|-------------------|----------------|
| Premier League | 1 | 6,116 | Premier League 25/26 |
| Championship | 12 | 7,753 | Championship 25/26 |
| Brasileirão Serie A | 9 | 3,474 | Brasileiro Serie A 2026 |
| Chinese Super League | 52 | 840 | CSL 2026 |
| Pro League (Belgium) | 14 | 321 | Pro League 25/26 |
| CAF Champions League | 29 | 154 | 25/26 |
| Africa Cup of Nations | 30 | 104 | AFCON 2025 |

EPL standings probe (`league_id=1`, `season_id=337`): **20 teams**, full **38 rounds** completed for top clubs — table data is production-grade for current season.

---

## Historical depth

| Dimension | BSD (verified) | Assessment |
|-----------|----------------|------------|
| Multi-season catalog | Yes — finished counts >> single-season matchdays (e.g. PL 6,116 finished) | Deep historical rows in `/events/` |
| Season scoping | `season_id` on events + `season_id` param on standings | Required for accurate table pulls |
| Date filtering | `date_from` / `date_to` on `/events/` | Supported per OpenAPI |
| Ordering | `ordering` param | **Unreliable** — `ordering=event_date` did not return true oldest row in probe |
| Non-football sports | **0** | Football-only provider |

---

## Tier-1 crosswalk coverage (API-Sports ↔ BSD)

Verified in `scripts/verify-bsd-crosswalk.js` (tier-1 league map):

| Competition | API-Sports ID | BSD ID |
|-------------|---------------|--------|
| Premier League | 39 | 1 |
| La Liga | 140 | 3 |
| Bundesliga | 78 | 5 |
| Serie A | 135 | 4 |
| Ligue 1 | 61 | 6 |
| UEFA Champions League | 3 | 7 |
| J1 League | 98 | 49 |
| Chinese Super League | 169 | 52 |
| MLS | 253 | 18 |
| Brasileirão Serie A | 71 | 9 |

Match-rate percentage against API-Sports fixtures requires API-Sports quota (currently **ON HOLD / exhausted** during audit window). Crosswalk identity map is verified; live match-rate deferred.

---

## Gaps vs API-Sports

| Capability | API-Sports | BSD | Gap severity |
|------------|------------|-----|--------------|
| Sports coverage | 13+ sports | Football only | **Critical** for multi-sport SKCS |
| League breadth | 900+ football leagues | 65 competitions | **High** — lower leagues missing |
| Provider IDs | De-facto canonical in SKCS | Provider-local integers | Requires crosswalk — never assume equal IDs |
| Injuries endpoint | Dedicated | Embedded in lineups/events | Partial — different shape |
| Player photos / rich media | Extensive | Limited | Moderate |
| Live polling | Quota-governed | `/events/live/` + WebSocket | BSD richer live surface — **blocked** for SKCS pre-match default |
| Odds markets | Multiple APIs integrated | 17 bookmakers via comparison | Comparable for enrichment |
| xG / spatial stats | Limited on base tier | `/stats/` available | **Blocked** from SKCS feature store by governance |
| AI predictions | N/A | `/prediction/` | **Blocked** — never prediction input |
| Quota economics | Paid tier / daily cap | Free, no observed rate headers | BSD favorable for evaluation volume |

---

## SKCS product impact

| Surface | Uses BSD today? | Notes |
|---------|-----------------|-------|
| Public website fixtures | **No** | Still API-Sports pipeline |
| Prediction engine | **No** | Directive restriction honored |
| `rapidapi_cache` enrichment | **Yes** (sandboxed) | `sync-bsd-enrichment.js` |
| Crosswalk / verification | **Yes** | `verify-bsd-crosswalk.js` |
| Evaluation adapter | **Yes** (new) | `bsdProvider.js` — not wired to ingest |

---

## Audit conclusion

BSD provides **sufficient football fixture, standings, and odds-comparison depth** for evaluation, enrichment, and API-Sports cross-verification on tier-1 leagues. It **cannot replace** API-Sports as PRIMARY without resolving: (1) football-only scope, (2) 65-vs-900+ league breadth, (3) provenance/redistribution review, (4) governance blocks on stats/prediction endpoints.

**Recommendation:** Continue ACTIVE EVALUATION lane. Keep API-Sports ON HOLD intact for future reactivation.
