# SportsDataIO Pre-Match Implementation Directive

## Contract note

This document defines a **pre-match context contract**, not a canonical truth contract. SportsDataIO may be used only when it helps SKCS with authorized fixture discovery, pre-kickoff context, and safe normalization for display or analysis.

## Goal

Use SportsDataIO only as a pre-match fixture and context source for SKCS.
Do not let it behave like a live-score, live-news, or live-monitoring provider.

This directive is the implementation contract for the SportsDataIO integration layer.

## Product rule

SKCS is a pre-match insight product.
SportsDataIO may support that product only when it helps with:

- upcoming fixture discovery
- competition and team context
- pre-match normalization
- pre-kickoff metadata hydration

## Supported sports

SportsDataIO should only be considered for the sports currently mapped in the client:

- football / soccer
- basketball / nba
- nfl / american football
- mlb / baseball
- nhl / hockey

Any other sport should be treated as unsupported and skipped.

It must not be used for:

- live score polling
- live odds monitoring
- live news refresh loops
- post-match reconciliation loops
- any runtime path that assumes the product is live-first

## Current code paths to align

- `backend/apiClients.js`
  - `SportsDataIOClient.getFixtures()` should remain a schedule-based fetcher only.
  - It should be treated as a pre-match fixture resolver, not a live feed.

- `backend/services/dataProvider.js`
  - `fetchSportsDataIO(sport)` should stay inside the pre-match data assembly chain.
  - It should only contribute normalized upcoming fixtures or context-safe records.
  - It should not be promoted into any live-refresh loop.

- `backend/services/hybridSportsDataService.js`
  - SportsDataIO must remain a fallback helper, not the primary live source.
  - Any source ordering should prefer pre-match-safe providers.

- `backend/services/skcsHeartbeat.js`
  - Do not add SportsDataIO to heartbeat jobs that imply live tracking.
  - If it is used at all, it should only feed pre-match metadata refresh.

## Implementation rules

1. Keep the SportsDataIO fetch path read-only.
2. Normalize only fields that are safe for pre-match analysis.
3. Reject any expectation that SportsDataIO is a live data source.
4. Gate usage behind pre-match windows and existing quota controls.
5. Prefer cached or scheduled fixture context over repeated polling.
6. Log SportsDataIO as a context source, not a live-status source.
7. SportsDataIO data may be normalized into SKCS only when it is authorized and safe for pre-match display.
8. SportsDataIO must never override the canonical football truth store.

## Explicitly disallowed behavior

- calling SportsDataIO on an interval to simulate live monitoring
- using SportsDataIO to fill live score widgets
- using SportsDataIO to infer completed-match results unless the endpoint is explicitly proven for that contract
- using SportsDataIO as a fallback for live odds or breaking news
- allowing SportsDataIO failures to trigger broader live-style retry storms

## Expected file-level outcome

After implementation, these files should reflect the pre-match-only contract:

- `backend/apiClients.js`
- `backend/services/dataProvider.js`
- `backend/services/hybridSportsDataService.js`
- `backend/services/skcsHeartbeat.js`
- `docs/provider-discovery/free-livescore-api.md`
- `docs/providers/live-football-api-policy.md`
- `SKCS-KNOWLEDGE/knowledge/dependency_registry.md`
- `SKCS-KNOWLEDGE/knowledge/system_topology.md`

## Acceptance criteria

- SportsDataIO is described as a pre-match helper, not a live provider.
- No heartbeat or cron loop depends on SportsDataIO for live tracking.
- DataProvider can still normalize SportsDataIO fixtures for upcoming matches.
- Unsupported sports are skipped before the SportsDataIO fetch path runs.
- Documentation and knowledge files no longer imply that SportsDataIO supports a live-site workflow.
- The integration remains compatible with the pre-match-only SKCS product direction.

