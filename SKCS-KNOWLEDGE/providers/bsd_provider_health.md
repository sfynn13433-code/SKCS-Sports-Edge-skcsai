# BSD Provider Health Report

**Generated:** 2026-06-06  
**Environment:** Local probe with configured `BZZOIRO_API_TOKEN`, `ENABLE_BZZOIRO_PROVIDER=true`  
**Scripts:** `scripts/audit-bsd-discovery.js`, `scripts/verify-bsd-provider.js`

---

## Authentication reliability

| Check | Result |
|-------|--------|
| Token configured | **Pass** |
| `ENABLE_BZZOIRO_PROVIDER` flag | **true** |
| `GET /events/?limit=1` | **200 OK** |
| Auth failures (401) | **0** observed in probe set |

**Verdict:** Authentication confirmed and stable across probe window.

---

## Latency (milliseconds)

### Discovery probe (`audit-bsd-discovery.js`)

| Endpoint | Status | Latency |
|----------|--------|---------|
| `/events/?limit=1` (auth smoke) | 200 | 2,778 ms |
| `/leagues/?limit=200` | 200 | 314 ms |
| `/teams/?limit=5` | 200 | 254 ms |
| `/events/?limit=1` | 200 | 1,285 ms |
| `/events/{id}/` | 200 | 569 ms |
| `/events/{id}/lineups/` | 200 | 318 ms |
| `/events/{id}/odds/comparison/` | 200 | 264 ms |
| `/events/{id}/polymarket/` | 404 | 253 ms |
| `/leagues/{id}/standings/` | 200 | 338 ms |
| `/bookmakers/` | 200 | 257 ms |

| Aggregate | Value |
|-----------|-------|
| Min | 254 ms |
| Max | 2,778 ms |
| Avg | 826 ms |

**Note:** First-call cold latency on `/events/` reached ~2.8s; subsequent calls averaged 250–570ms. Plan warm-up or caching for batch audits.

### Adapter probe (`verify-bsd-provider.js`)

| Function | OK | Latency |
|----------|-----|---------|
| `competitions()` | ✓ | 339 ms |
| `fixtures()` | ✓ | 299 ms |
| `fixtureDetails()` | ✓ | 265 ms |
| `standings()` | ✓ | 247 ms |
| `lineups()` | ✓ | 253 ms |
| `odds()` | ✓ | 261 ms |

**Pass rate:** 6/6 (100%)

---

## Error rates

| Error type | Count | Rate | Notes |
|------------|-------|------|-------|
| HTTP 2xx | 9/10 probes | 90% | Polymarket 404 is data-absence, not auth failure |
| HTTP 401 | 0 | 0% | — |
| HTTP 429 | 0 | 0% | No rate-limit headers observed |
| Network timeout | 0 | 0% | 15–20s client timeout configured |
| Adapter failures | 0 | 0% | All six adapter functions returned `ok: true` |

**Effective error rate (excluding expected 404):** 0%

---

## Retry behavior

| Observation | SKCS handling |
|-------------|---------------|
| No `retry-after` header | Client uses single-attempt with 15–20s timeout |
| No 429 in probe | No backoff triggered |
| Transient failures | Not observed — recommend exponential backoff if 5xx appears in production sync |

Current adapters do **not** auto-retry. Acceptable for evaluation scripts; add retry wrapper before any scheduled enrichment sync expansion.

---

## Quota behavior

| Header | Observed value |
|--------|----------------|
| `x-ratelimit-limit` | null |
| `x-ratelimit-remaining` | null |
| `retry-after` | null |

BSD marketing states **no rate limits** on free tier. Live probes did not surface quota exhaustion. SKCS should still instrument call counts in `provider_registry` — unbounded usage risks operational surprise if policy changes.

---

## Data-quality signals (non-blocking)

| Signal | Observation |
|--------|-------------|
| Polymarket coverage | Sparse — 404 on sample far-future Eliteserien fixture |
| Odds on far-future fixture | `bookmakers_count: 0` — empty markets object |
| Lineups pre-match | `lineup_status: unavailable` — expected |
| Character encoding | Occasional mojibake in team names (e.g. `Bodø/Glimt`) — normalize at display layer |

---

## Health verdict

| Criterion | Status |
|-----------|--------|
| Auth reliable | ✓ |
| Core read endpoints healthy | ✓ |
| Adapter normalization functional | ✓ |
| Safe for evaluation lane | ✓ |
| Ready for PRIMARY promotion | ✗ — governance + coverage gaps remain |
| Safe for prediction engine | ✗ — explicitly blocked |

**Overall:** BSD is **healthy for ACTIVE EVALUATION** — discovery, normalization, crosswalk, and sandboxed enrichment. Not approved for canonical replacement of API-Sports.

---

## Recommended monitoring (future)

```bash
npm run audit:bsd-discovery   # full endpoint probe + JSON report
npm run verify:bsd-provider   # adapter function health check
npm run verify:bsd-crosswalk  # tier-1 identity map vs API-Sports (when quota available)
```
