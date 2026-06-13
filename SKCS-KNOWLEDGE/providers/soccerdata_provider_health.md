# Soccer Data API — Provider Health

**Status:** Evaluation stack built; live probes pending API key.

## Env required

```env
ENABLE_SOCCER_DATA_API=true
SOCCER_DATA_API_KEY=<token from dashboard>
SOCCER_DATA_HARD_DAILY_CAP=75
```

## Run probes (stays under free tier)

```bash
npm run verify:soccerdata-provider   # max 6 calls
npm run audit:soccerdata-discovery   # max 12 calls
```

## Off-season probe policy (May–Aug)

**Do not** call `/matches/` for ended European top leagues (EPL, La Liga, Bundesliga, Serie A, Ligue 1, UCL).

| Probe type | League | Endpoint |
|------------|--------|----------|
| Fixtures + match detail | **MLS** `league_id=168` (override: `SOCCER_DATA_FIXTURE_PROBE_LEAGUE_ID`) | `/matches/`, `/match/` |
| Standings metadata | EPL `league_id=228` | `/standing/` |
| League discovery | England `country_id=8` | `/league/` |

## Expected pass criteria (verify)

| Check | Gate |
|-------|------|
| fixtures (MLS / summer probe league) | `ok`, team names + dates present |
| fixtureDetails | Sample match passes SKCS fixture gate |
| standings (EPL metadata) | `team_count > 0` |
| leagues (England) | `count > 0` |

Exit code 0 when ≥3 checks pass and `calls_used ≤ 6`.

## Live results (2026-06-06)

- Auth OK; standings/league discovery OK
- `/matches/` empty for European (off-season), MLS, Brazil, J1, CSL, Russia, Sweden, Norway
- Date format: `DD-MM-YYYY` accepted; slashes invalid; `YYYY-MM-DD` invalid in probes
- ~40+ calls used of 75/day free tier
- NotebookLM synthesis: `soccerdata_notebooklm_synthesis.md` — **StatPal vs Soccerdata pricing conflict; confirm with support**

```
verify: 3/4 checks pass (no fixture sample)
audit summer: all tier-1 summer leagues mapped, 0 fixtures
```

## Rate-limit headers observed

_Pending live probe — client captures any response headers containing `rate`, `limit`, `remaining`, or `retry`._

## Known league IDs (partial)

| SKCS league | Competition | SDA `league_id` |
|-------------|-------------|-----------------|
| 4328 | Premier League | 228 (docs) |
| 4332 | Serie A | 207 (docs example) |
| 4335 | La Liga | TBD (audit) |
| 4331 | Bundesliga | TBD (audit) |
| 4334 | Ligue 1 | TBD (audit) |

## Adapter paths

- Client: `backend/services/soccerDataApiClient.js`
- Provider: `backend/providers/football/soccerDataApiProvider.js`
- Normalizer: `backend/providers/football/soccerDataApiNormalizer.js`
- League map: `backend/config/soccerDataLeagueMap.js`
