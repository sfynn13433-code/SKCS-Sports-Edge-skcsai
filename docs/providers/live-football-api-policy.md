# Live Football API Provider Policy

Provider host:
live-football-api.p.rapidapi.com

Environment variables:
LIVE_FOOTBALL_API_RAPIDAPI_HOST=live-football-api.p.rapidapi.com
LIVE_FOOTBALL_API_RAPIDAPI_KEY=your_key_here

Fallback key order:
1. LIVE_FOOTBALL_API_RAPIDAPI_KEY
2. X_RAPIDAPI_KEY
3. RAPIDAPI_KEY

Current SKCS role:
Controlled, low-quota football enrichment provider.

Observed quota behavior:
The provider must be treated as limited by x-ratelimit-requests-limit.
Current observed practical request window: 100 requests/day.
Do not use this provider for bulk fixture ingestion.

Approved use:
- Match statistics enrichment
- Match lineup inspection
- Match events/timeline inspection
- League standings context
- Top scorers context
- H2H fallback only when parameters return useful rows

Not approved:
- Bulk fixtures
- Bulk daily ingestion
- Final SKCS predictions
- ACCA generation
- Direct market creation
- Automatic confidence overrides
- Replacing Football536 structured/historical role
- Replacing Free Livescore entity resolver role
- Replacing SKCS Decision Engine

Endpoint test result summary:
Exactly 7 isolated live calls were completed.

1. /league-standing
   Status: 200
   Classification: valid_but_unknown_shape
   Use: league table/rank/team-form context after mapping

2. /head-to-head
   Status: 200
   Classification: valid_but_unknown_shape
   Result: structurally valid but current params returned response: []
   Use: optional H2H fallback candidate only

3. /match-statistics
   Status: 200
   Classification: confirmed_match_statistics_source
   Use: approved for next-stage field mapping

4. /match-lineup
   Status: 200
   Classification: confirmed_match_lineup_source
   Use: approved for next-stage field mapping

5. /match-events
   Status: 200
   Classification: valid_but_unknown_shape
   Use: useful by payload inspection for timeline/context enrichment after mapping

6. /top-scorers
   Status: 200
   Classification: valid_but_unknown_shape
   Use: useful by payload inspection for player scoring-threat context after mapping

7. /predictions
   Status: 400
   Classification: invalid_endpoint_or_params
   Use: comparison-only if made valid later

Predictions endpoint policy:
The /predictions endpoint is comparison-only.
It must never be used as the final SKCS decision engine.
It must never directly create SKCS insights, ACCAs, confidence overrides, or user-facing direct markets.
If made valid later, it may only be used as an external benchmark/audit signal against SKCS output.

Current provider hierarchy:
1. football536.p.rapidapi.com
   Role: structured football data provider / historical fixture-capable source.
   Not yet approved as reliable current/upcoming daily fixture source until current-date filtering is proven.

2. free-livescore-api.p.rapidapi.com
   Role: high-volume entity resolver / ID mapper only.
   Use for teams, stages, categories, IDs, logos, slugs, sport IDs.
   Do not use for fixtures, standings, H2H, odds, lineups, or predictions.

3. live-football-api.p.rapidapi.com
   Role: controlled low-quota football enrichment provider.
   Use only for selected high-value context endpoints.

4. Metrx Factory
   Role: deep football enrichment provider.
   Use later for xG, expected goals, rank/performance lines, and selected top matches.
   Do not wire yet.

5. Football Highlights H2H
   Role: H2H fallback only.

Next safe technical step:
Create or maintain isolated mapper/audit tooling only.
Do not wire this provider into production until:
- payload shapes are mapped,
- field availability is confirmed,
- quota guardrails are enforced,
- endpoint selection rules are defined,
- and SKCS Decision Engine remains the final authority.

END OF FILE.
