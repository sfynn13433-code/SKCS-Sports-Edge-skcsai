# SKCS API Registry

This registry captures the external and internal API surfaces SKCS depends on.

## Primary sports and data providers

- API-Sports
  - Used for football fixtures, teams, injuries, and related sports data.
  - Main callsites: `backend/apiClients.js`, `backend/services/dataProvider.js`, `backend/services/contextIngestionService.js`.
- TheSportsDB
  - Used for fixture discovery and fallback ingestion.
- RapidAPI providers
  - Multiple sports hosts are used across the pipeline.
  - Examples include football data, odds, highlights, cricket, and news providers.
- SportsData.io
  - Alternative sports data source in the broader ecosystem.
- OpenWeather
  - Used for weather enrichment where city and API key are available.
- News API / sports news endpoints
  - Used by the enrichment and heartbeat layers.

## AI and inference APIs

- Groq
  - Primary AI provider for explanation and analysis.
- Dolphin
  - Fallback local / hosted inference layer.

## Internal API surfaces

- `apiQuotaRouter`
  - Central enforcement layer for quota and provider access.
- `providerQuotaService`
  - Tracks quota state and usage budgets.
- `quotaPlanner`
  - Preflight budget planner for football syncs.

## What this file should track going forward

- Provider name.
- Endpoint.
- Auth method.
- Quota model.
- Callers.
- Cost impact.
- Fallback order.

## Open gaps

- This first pass does not yet contain the full endpoint-by-endpoint list.
- The next pass should map providers to exact route paths and environment variables.
