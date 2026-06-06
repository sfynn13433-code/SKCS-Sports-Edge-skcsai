# Big Balls Data — Semantic Mapping

**Normalizer:** `backend/providers/football/bigBallsDataNormalizer.js`  
**Adapter:** `backend/providers/football/bigBallsDataProvider.js`  
**Lane:** `evaluation` — not canonical ingest, not prediction engine

## Event / fixture

| BBD field | SKCS canonical field | Transform |
|-----------|---------------------|-----------|
| `id` / `match_id` | `GameId` | `String(id)` |
| `id` | `provider_event_id` | string |
| `league_id` | `provider_league_id` | `bb_league_*` string |
| `home.team_id` | `provider_home_team_id` | string |
| `away.team_id` | `provider_away_team_id` | string |
| `home.team_name` | `HomeTeam` | string |
| `away.team_name` | `AwayTeam` | string |
| `start_time` | `kickoff_time_utc` | ISO8601 |
| `status` | `MatchStatusNormalized` | `in_progress`→`InProgress`, `finished`→`Final`, etc. |
| `score.home` / `score.away` | `HomeGoals` / `AwayGoals` | integer |
| `meta.confidence` | `confidence` | 0–1 verification signal |
| `meta.source` | `source_tier` | governance filter |

## Competition / league

| BBD field | SKCS field |
|-----------|------------|
| `id` | `CompetitionId` / `provider_league_id` |
| `name` | `competition_name` |
| `sport` | `sport` |
| `country` | `country_code` (ISO alpha-3) |

## Standings

| BBD field | SKCS normalized |
|-----------|-----------------|
| `position` | `position` |
| `team_id` | `provider_team_id` |
| `team_name` | `team_name` |
| `played`, `won`, `drawn`, `lost` | same |
| `goals_for`, `goals_against`, `points` | same |
| `form` | `form` |

## Odds

| BBD field | SKCS normalized |
|-----------|-----------------|
| `market` | `market` |
| `selections[].name` | `outcome_code` |
| `selections[].decimal_odds` | `odds_decimal` |
| `selections[].line` | `line` |

## Lineups

Fetched via `GET /v1/matches/{id}?fields=lineups` — shape is field-bundle:

```json
{ "lineups": { "value": { ... }, "confidence": 0.9, "via": "api" } }
```

Mapped in `normalizeLineupsFromFields()` — enrichment lane only.

## Semantic gaps

| Gap | Mitigation |
|-----|------------|
| `bb_*` IDs ≠ API-Sports integers | Build crosswalk table (pending live audit) |
| `meta.source` hidden vendor | Block `community-scraper` from canonical |
| Match list may return `Score` vs full `Match` | Normalizer handles both shapes |
| Intelligence `/v1/predictions` | **Not mapped** — governance block |
| Multi-sport enum | Football adapter defaults `sport=football`; other sports need separate normalizers |

## Boundary

```text
BBD envelope JSON
    → bigBallsDataNormalizer
    → bigBallsDataProvider
    → evaluation / enrichment_store ONLY
    → BLOCKED: prediction_engine, canonical_match, grading
```
