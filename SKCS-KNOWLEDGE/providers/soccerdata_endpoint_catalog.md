# Soccer Data API — Endpoint Catalog (v1.0.0)

Base: `https://api.soccerdataapi.com/`  
Auth: `auth_token` query param on every call  
Required header: `Accept-Encoding: gzip`

## Reference endpoints

| Endpoint | SKCS lane | Notes |
|----------|-----------|-------|
| `/country/` | Discovery | Paginated `results[]`, 221 countries |
| `/league/?country_id=` | Discovery | Paginated leagues per country |
| `/season/?league_id=` | Discovery | Season list, `is_active` flag |
| `/stage/?league_id=&season=` | Discovery | Cup/knockout stages (UCL `league_id=310`) |
| `/group/?stage_id=` | Discovery | Group stage buckets |
| `/matches/?league_id=` | **PRIMARY** fixtures | Current season schedule; optional `season`, `date` |
| `/matches/?date=` | **PRIMARY** fixtures | Date format `DD/MM/YYYY` (invalid formats return `Invalid date.`) |
| `/match/?match_id=` | **PRIMARY** detail | Odds, lineups, injuries, events |
| `/standing/?league_id=` | Enrichment | `stage[].standings[]`; optional `season` |
| `/livescores/` | Blocked canonical | Live-day only; pre-match product should not poll |
| `/match-preview/` | **BLOCKED** | Vendor AI content + predictions |
| `/match-previews-upcoming/` | **BLOCKED** | Vendor AI previews list |
| `/team/?team_id=` | Enrichment | Team + stadium |
| `/player/?player_id=` | Enrichment | Player profile |
| `/transfers/?team_id=` | Enrichment | Transfers in/out |
| `/head-to-head/?team_1_id=&team_2_id=` | Enrichment | H2H stats |
| `/stadium/?team_id=` or `stadium_id` | Enrichment | Venue metadata |

## Error envelope (HTTP 200)

```json
{"detail": "Invalid token."}
{"detail": "Request was throttled. Expected available in 60 seconds."}
{"detail": "Error fetching match."}
```

## Odds markets (white-label)

From vendor FAQ: **match_winner (1X2)**, **over_under**, **handicap** — nested under `odds` on match objects.

## SKCS tier-1 `league_id` map (live audit 2026-06-06)

| SKCS | Competition | SDA `league_id` | Country `id` |
|------|-------------|-----------------|--------------|
| 4328 | Premier League | 228 | 8 |
| 4335 | La Liga | 297 | 60 |
| 4331 | Bundesliga | 241 | 27 |
| 4332 | Serie A | 253 | 6 |
| 4334 | Ligue 1 | 235 | 9 |
| 3 | UEFA Champions League | 310 | 4 (europe) |
| 253 | MLS | 168 | 1 (usa) |
