# Football leagues — API-Sports V3 IDs

Registry for sync + allowlist. **European top 5** use TheSportsDB ids in `syncService` with mapping in `dataProvider.THESPORTSDB_TO_APISPORTS_LEAGUE`. **Summer / global leagues** below use API-Sports ids directly (no TheSportsDB league fetch).

## European top 5 (TheSportsDB → API-Sports)

| Competition | TheSportsDB | API-Sports |
|-------------|-------------|------------|
| Premier League | 4328 | 39 |
| La Liga | 4335 | 140 |
| Bundesliga | 4331 | 78 |
| Serie A | 4332 | 135 |
| Ligue 1 | 4334 | 61 |

## Summer leagues (API-Sports only)

| Region | Tier | Competition | API-Sports `league` |
|--------|------|-------------|---------------------|
| Japan | 1 | J1 League | 98 |
| Japan | 2 | J2 League | 99 |
| China | 1 | Super League | 169 |
| China | 2 | League One | 170 |
| USA | 1 | MLS | 253 |
| USA | 2 | USL Championship | 255 |
| Brazil | 1 | Série A | 71 |
| Brazil | 2 | Série B | 72 |

## Config locations

- Sync loop: `backend/services/syncService.js` — `FOOTBALL_APISPORTS_LEAGUE_CONFIG`, tier sets
- Allowlist filter: `backend/services/dataProvider.js` — `FOOTBALL_TARGET_LEAGUE_IDS`, competition aliases
- Canonical replay: `scripts/rebuild-canonical-from-api-sports.js` — `DEFAULT_FOOTBALL_LEAGUES`

## API call rules (unchanged)

- Same per-league `buildLiveData` waterfall (legacy name; TheSportsDB only when `leagueId` is in `SUPPORTED_LEAGUES`; summer leagues skip TSDB league endpoints)
- Same `SPORT_FETCH_STAGGER_MS` between league fetches
- No changes to `apiQuotaRouter`, cron quotas, or install commands

## Adding a league

1. Confirm API-Sports V3 `league` id from provider docs.
2. Add row to `FOOTBALL_APISPORTS_LEAGUE_CONFIG` (or TSDB block + map if they have a TheSportsDB id).
3. Add id to `FOOTBALL_TIER_1_LEAGUES` or `FOOTBALL_TIER_2_LEAGUES`.
4. Add id to `FOOTBALL_TARGET_LEAGUE_IDS` and a competition alias if needed.
