# Big Balls Data — Provider Health Report

**Generated:** 2026-06-06  
**Key:** Configured locally (`bbs_live_…`) — not printed  
**Configured base:** `https://api.bigballsports.com` (Render + `.env`)  
**Effective base:** `https://api.bigballsdata.com` (automatic fallback)

---

## Authentication

| Check | Result |
|-------|--------|
| `ENABLE_BIG_BALLS_DATA_PROVIDER` | **true** |
| API key configured | **true** |
| `GET /v1/sports` | **200 OK** (via fallback host) |
| Auth failures | **0** |

**Verdict:** Authentication confirmed.

---

## Host routing (critical)

| Host | Result |
|------|--------|
| `https://api.bigballsports.com` | **ETIMEDOUT** from SKCS probe environment |
| `https://api.bigballsdata.com` | **200 OK** — live gateway |
| `https://bbsgateway-production.up.railway.app` | **200 OK** — fallback |

SKCS client (`bigBallsDataApiClient.js`) now tries configured base → `api.bigballsdata.com` → Railway fallback.

**Recommendation:** Set `BIG_BALLS_BASE_URL=https://api.bigballsdata.com` on Render to skip timeout on primary host.

---

## Latency (authenticated probes)

| Endpoint | Latency | Source tier | Confidence |
|----------|---------|-------------|------------|
| `/v1/sports` | ~1,320 ms | — | — |
| `/v1/leagues?sport=football` | ~931 ms | — | — |
| `/v1/matches?sport=football&league=epl` | ~1,297 ms | `official-league` | 0.9 |
| `/v1/standings?sport=football&league=epl` | ~1,458 ms | `official-league` | 0.85 |
| `/v1/stored/matches?sport=football&league=epl` | ~3,500 ms | — | — |

**Aggregate:** ~900–1,600 ms typical; acceptable for evaluation, not ideal for tight sync loops.

---

## Rate limits (free tier observed)

| Header | Value |
|--------|-------|
| `X-RateLimit-Limit-Minute` | 100 |
| `X-RateLimit-Limit-Day` | 1,000 |
| `X-RateLimit-Reset` | UTC midnight epoch |

**SKCS impact:** Full `TARGET_LEAGUES` sweep (66 leagues) would exhaust free daily quota in one pass. Production sync requires **Starter+** or aggressive caching.

---

## Adapter health (`verify-bigballs-provider`)

| Function | Status | Notes |
|----------|--------|-------|
| `competitions()` | ✓ | 6 football leagues returned |
| `fixtures()` | ✓ | Uses `/v1/stored/matches` when richer rows available |
| `standings()` | ✓ | EPL 20-team table via field bundle |
| `fixtureDetails()` | ✓ | Stored UUID path (`/v1/stored/matches/{id}`) |
| `lineups()` | Partial | `fields_missing: lineups` on sample |
| `odds()` | Partial | `odds: null` on probed fixtures |

---

## Data-quality signals

| Signal | Observation |
|--------|-------------|
| Live `/v1/matches` football | Returns **scores-only** bundle — no team names on list rows |
| Stored `/v1/stored/matches` | Rich rows (team names, logos, kickoff) — **sparse** per league |
| Serie A alias `seriea` | `meta.confidence: 0` — weak/no live feed |
| `bb_match_*` detail | 404 on sampled football id — use stored UUID lane |
| NBA live | Scores returned; odds/lineups missing on sample |

---

## Health verdict

| Criterion | Status |
|-----------|--------|
| Auth reliable (on `api.bigballsdata.com`) | ✓ |
| Multi-sport catalogue | ✓ (9 sports) |
| Football tier-1 leagues listed | ✓ (6) |
| Evaluation adapter functional | ✓ |
| Free tier viable for full SKCS sync | ✗ (1,000/day) |
| PRIMARY promotion ready | ✗ |

**Overall:** Healthy for **ACTIVE EVALUATION** once base URL fallback is understood. Not ready for canonical replacement of API-Sports.

---

## Commands

```bash
npm run audit:bigballs-discovery
npm run verify:bigballs-provider
```
