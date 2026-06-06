# Big Balls Data — Discovery Audit

**Date:** 2026-06-06  
**Focus:** Primary SKCS evaluation target (replaces Bzzoiro as active discovery focus)  
**API-Sports:** ON HOLD

## Executive summary

Big Balls Data (`api.bigballsdata.com`) is a **documented, multi-sport commercial gateway** aggregating 20+ upstream sources behind a unified envelope with confidence scoring. It addresses several Bzzoiro gaps (multi-sport, rate-limit transparency, OpenAPI contract) but introduces new governance risks (opaque `community-scraper` tier, no published Terms of Service).

**SKCS posture:** ACTIVE EVALUATION — build adapter + run live probes once API key is configured. **Not** wired to prediction pipelines or public website.

## Verified without API key (2026-06-06)

| Check | Result |
|-------|--------|
| Gateway reachable | ✓ `api.bigballsdata.com` |
| Unauthenticated `/v1/sports` | 401 `missing_api_key` — proper envelope |
| Response shape | `{ data, meta, error }` confirmed |
| Latency (unauth probe) | ~925 ms |

## Live verification (2026-06-06) — key configured ✓

| Check | Result |
|-------|--------|
| Auth on `api.bigballsdata.com` | **200 OK** |
| Sports catalogue | **9 sports** |
| Football leagues | **6** (EPL, La Liga, Bundesliga, Serie A, Ligue 1, MLS) |
| Adapter health | **6/6 pass** (`verify:bigballs-provider`) |
| Free tier limits | **100/min, 1,000/day** |

### Host routing note

`BIG_BALLS_BASE_URL=https://api.bigballsports.com` **times out** from probe environment.  
Working gateway: **`https://api.bigballsdata.com`** (client auto-fallback enabled).

**Render recommendation:** change to `BIG_BALLS_BASE_URL=https://api.bigballsdata.com`

See `bigballs_provider_health.md` for full probe details.

## Expected advantages vs Bzzoiro BSD

| Dimension | Big Balls Data | Bzzoiro BSD |
|-----------|----------------|-------------|
| Sports | 9 types | Football only |
| Documentation | [docs](https://bigballsdata.com/docs) + OpenAPI | Bzzoiro docs v2 |
| Rate limits | Documented + headers | None observed |
| Provenance | `meta.confidence` + `meta.source` | Ad hoc |
| SDK | `@bigballsports/sdk` | None official |
| Free tier economics | 1,000 req/day | Unlimited (claimed) |
| ID model | `bb_match_*` strings | Integer event ids |

## Expected risks

| Risk | Severity |
|------|----------|
| No `/terms` published | High — commercial redistribution unclear |
| `community-scraper` source tier | High — canonical ingest blocked |
| Free tier 1,000/day | High — full SKCS sync needs paid plan |
| Upstream aggregation opaque | Medium — same class as BSD provenance concern |
| Vendor continuity | Medium — newer commercial product |

## Relationship to Bzzoiro

Marketing domains differ (`bigballsdata.com` vs `sports.bzzoiro.com`) but operator overlap is likely. **Treat as separate integrations** — different base URL, auth scheme, schema, and billing. Existing `BZZOIRO_API_TOKEN` does **not** authenticate against `api.bigballsdata.com`.

## SKCS code artifacts

| File | Role |
|------|------|
| `backend/services/bigBallsDataApiClient.js` | HTTP client + rate header capture |
| `backend/providers/football/bigBallsDataNormalizer.js` | Semantic normalization |
| `backend/providers/football/bigBallsDataProvider.js` | Evaluation adapter |
| `scripts/audit-bigballs-discovery.js` | Live probe |
| `scripts/verify-bigballs-provider.js` | Adapter health |

## Next steps

1. User configures `BIG_BALLS_DATA_API_KEY`
2. Run authenticated discovery → populate `bigballs_coverage_audit.md` + `bigballs_league_inventory.md`
3. Crosswalk `bb_league_*` ↔ API-Sports IDs for tier-1 football
4. Request written Terms + commercial license from `developers@bigballsdata.com`
5. Re-run `bigballs_readiness_assessment.md` with live counts
