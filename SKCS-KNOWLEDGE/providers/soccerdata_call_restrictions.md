# Soccer Data API — Call Restrictions

Source: [soccerdataapi.com/docs](https://soccerdataapi.com/docs/), [get-started](https://soccerdataapi.com/dashboard/get-started/)

## Hard limits (free tier)

| Restriction | Value |
|-------------|-------|
| Daily requests (all endpoints) | **75/day** |
| Per-minute throttle | Returns `{"detail": "Request was throttled. Expected available in 60 seconds."}` |
| Gzip header | **`Accept-Encoding: gzip` required** on every request or calls fail |
| Auth | `auth_token` query parameter (or `Authorization: Token …` in examples) |
| Invalid token | May return **HTTP 200** with `{"detail": "Invalid token."}` — treat body, not status alone |

## Paid tiers (from [pricing FAQ](https://soccerdataapi.com/dashboard/get-started/))

| Plan | Price | League coverage | Daily quota |
|------|-------|-----------------|-------------|
| Free | $0 | **All leagues, all countries** (same data types) | **75** |
| Basic | $14/mo | 15 leagues / 12 countries | **25,000** |
| Plus | $29/mo | 50 leagues / 35 countries | **150,000** |
| Pro | $79/mo | 125+ leagues / 95 countries | **500,000** |

Free tier has full league *access* but only 75 calls/day — production sync of 66 leagues needs paid tier or strict scheduling.

## Off-season fixture probing (May–Aug)

European top leagues (EPL, La Liga, Bundesliga, Serie A, Ligue 1, UCL) are **ended** in summer. SKCS evaluation scripts must **not** call `/matches/` for those leagues during off-season — empty results are expected, not API failure.

Use **MLS** (`league_id=168`) or `SOCCER_DATA_FIXTURE_PROBE_LEAGUE_ID` for fixture/match-detail health checks. European leagues remain valid for `/standing/` and `/league/` discovery only.

## SKCS evaluation call budgets

| Script | Default max calls | Purpose |
|--------|-------------------|---------|
| `npm run verify:soccerdata-provider` | 6 | EPL fixtures, match detail, standings, England leagues |
| `npm run audit:soccerdata-discovery` | 12 | Tier-1 league ID mapping + EPL sample probes |

Env overrides:

- `SOCCER_DATA_VERIFY_MAX_CALLS` (default 6)
- `SOCCER_DATA_AUDIT_MAX_CALLS` (default 12)
- `SOCCER_DATA_HARD_DAILY_CAP` (default 75, absolute stop in client)

## Endpoints blocked for SKCS prediction engine

Do **not** ingest vendor AI into predictions:

- `/match-preview/`
- `/match-previews-upcoming/`

Pre-match canonical ingest should prefer `/matches/` and `/match/` (fixtures + odds), not `/livescores/`.

## One request = one endpoint hit

Each GET to any path (`/country/`, `/league/`, `/matches/`, `/match/`, `/standing/`, etc.) counts toward the daily 75 on free tier.

Pagination (`count`, `next`, `previous` on `/country/` and `/league/`) still costs **one request per page** if `next` is followed.

## Operational guidance for full SKCS sync

66 `TARGET_LEAGUES` at 1 request/league/day = **66 calls** before match-detail enrichment. Free tier is insufficient for production-wide daily sync; Pro tier or selective league scheduling is required.
