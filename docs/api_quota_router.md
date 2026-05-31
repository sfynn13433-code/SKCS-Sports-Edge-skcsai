# API quota router (governed data engine)

Single governance layer for all external API exposure. Replaces scattered per-sport guards.

## Architecture

```text
apiQuotaRouter
 ├── football → api_sports_football, odds_api, sportsapi_pro, thesportsdb, …
 ├── cricket  → cricket_live_line_advance, cricapi (OFF in prod by default)
 ├── basketball / baseball / … → api_sports_<sport>
 └── blocked_api_calls_log (cost observability)
```

## Production defaults

| Control | Value |
|---------|--------|
| `SKCS_ENABLED_SPORTS` | `football` |
| `CRICKET_INGESTION_ENABLED` | `0` (cricket OFF unless sprint) |
| Render cricket cron | no-ops when disabled |

## Usage

```js
const { reserveApiCall } = require('./services/apiQuotaRouter');

const gate = await reserveApiCall({
  sport: 'football',
  provider: 'api_sports_football',
  units: 1,
  source: 'syncService.fetchFixtures'
});
if (!gate.allowed) return null;
```

## Blocked call observability

Table: `blocked_api_calls_log`

| Column | Purpose |
|--------|---------|
| `sport` | Who tried to call (football, cricket, …) |
| `provider` | Which provider (odds_api, cricket_live_line_advance, …) |
| `reason` | Why blocked (sport_ingestion_disabled, provider_quota_exceeded, …) |
| `source` | Code path (file/function label) |

**Inspect:**

- `GET /api/debug/api-governance?days=7`
- `npm run audit:api` (static call map)

## Wired entry points

- `apiClients.js` — API-Sports + Odds API
- `apiCacheService.js` — RapidAPI cache wall
- `cricketLiveEnrichmentService.js` / `cricketLiveMatchResolver.js`
- `publish-cricbuzz-cricket.js`, cricket crons, `deploy-trigger-cricket.js`

## Re-enable cricket (sprint only)

```env
CRICKET_INGESTION_ENABLED=1
CRICKET_LIVE_LINE_DAILY_LIMIT=40
```

Registry: `backend/services/apiQuotaRouterProviders.js`
