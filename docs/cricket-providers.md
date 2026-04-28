# SKCS Cricket Providers

## Primary Fixture Provider

Cricbuzz remains the primary cricket fixture provider.

Role:
- Primary cricket fixture ingestion
- Main source for daily cricket fixtures
- Starts the cricket domino effect

## Livescore6

Host:
livescore6.p.rapidapi.com

Environment variables:
RAPIDAPI_HOST_LIVESCORE6=livescore6.p.rapidapi.com
RAPIDAPI_LIVESCORE6_KEY=

Discovery status:
Tested with Category=cricket.

Working endpoints:
- /matches/v2/list-by-date?Category=cricket&Date=YYYYMMDD&Timezone=2
- /matches/v2/get-info?Eid=EID&Category=cricket

Non-working or not useful for cricket from discovery:
- /matches/v2/get-h2h
- /matches/v2/get-pregame-form
- /matches/v2/get-statistics
- /matches/v2/get-lineups
- /news/v3/list

Confirmed role:
Livescore6 should be used as:
- cricket fixture fallback
- match-info enrichment provider
- competition/league popularity signal provider

Livescore6 should NOT be used as:
- primary cricket stats provider
- player stats provider
- H2H provider
- pregame form provider
- lineups provider
- news provider

Rate limit notes:
Provider showed a 500 request window.
Use strict call budgeting.
Do not call detail endpoints for every fixture.
Do not live-poll.
Only use for selected fixtures or fallback checks.

Recommended future usage:
1. Pull Cricbuzz fixtures first.
2. Use Livescore6 list-by-date only if Cricbuzz misses fixtures or to cross-check major competitions.
3. Use Livescore6 get-info only for selected top fixtures.
4. Feed competition names into SKCS popularity scoring.
5. Select top 10 cricket fixtures for deeper enrichment from other providers.

Top 10 fixture selection logic:
Score fixtures using:
- Competition importance
- Team popularity
- Match format
- International/franchise importance
- Data availability
- SKCS user demand later

Example competition weights:
- ICC World Cup / T20 World Cup / Champions Trophy: +50
- IPL: +45
- International Test / ODI / T20: +35
- Big Bash / PSL / SA20 / The Hundred: +35
- County Championship / domestic first-class: +18
- Unknown domestic: +5

Future needed providers:
- Cricket team stats provider
- Cricket H2H provider
- Cricket player stats provider
- Cricket venue stats provider
- Weather provider by venue
- Injuries/news/context provider
