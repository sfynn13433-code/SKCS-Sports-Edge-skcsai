# Free Livescore API Provider Discovery

## Provider
- Host: `free-livescore-api.p.rapidapi.com`
- RapidAPI plan observed: Basic
- Monthly hard limit observed: 500,000 requests
- Hourly request limit observed: 1,000 requests

## Confirmed Endpoint
`GET /livescore-get-search`

Example params:
- `sportname=soccer`
- `search=romania`

## Confirmed Response Shape
Top-level:
- `status`
- `response`

`response` contains:
- `Sorting`
- `Teams`
- `Stages`
- `Categories`

## Confirmed Normalized Data
Teams:
- `provider_team_id`
- `name`
- `country_name`
- `country_code`
- `abbreviation`
- `is_national`
- `image`
- `sport_id`

Stages:
- `provider_stage_id`
- `stage_name`
- `stage_code`
- `country_name`
- `country_id`
- `country_code`
- `competition_id`
- `competition_name`
- `competition_display_country`
- `competition_slug`
- `sport_id`

Categories:
- `provider_category_id`
- `name`
- `slug`
- `country_code`
- `sport_id`

## SKCS Classification
This provider is approved only as:
High-volume football/soccer entity resolver and ID mapping provider.

## Approved Uses
- Team search
- Competition/stage search
- Category/country search
- Team ID mapping
- Stage ID mapping
- Competition ID mapping
- Country/category ID mapping
- Logo/name/slug discovery
- Provider ID cross-checking before calling other APIs

## Not Approved Uses
This provider is not approved as:
- Fixture source
- Live score source
- Standings source
- H2H source
- Lineups source
- Statistics source
- Odds source
- News source
- Prediction source

## Reason
Only `/livescore-get-search` has been confirmed from this host.
Fixture/live/standings/H2H/statistics/odds/news endpoints were not confirmed.
Guessed endpoint testing returned 404 for all non-search guessed paths.

## Relationship to Other Football Providers
- Free Livescore API: entity resolver / ID mapping
- football536: structured football data provider under separate testing
- Metrx Factory: deep enrichment provider for selected matches
- Football Highlights H2H: H2H fallback provider

## Non-Wiring Rule
Do not wire this provider into `aiPipeline` as a fixture source.
Do not use it for final prediction logic.
Use it only to resolve teams, stages, competitions, and IDs.
