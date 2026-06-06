# BSD Semantic Mapping — Canonical SKCS Fields

**Status:** Phase 4 complete — 2026-06-06  
**Normalizer:** `backend/providers/football/bsdNormalizer.js`  
**Adapter:** `backend/providers/football/bsdProvider.js`  
**Lane:** `evaluation` (not canonical ingest, not prediction engine)

Prior field-level governance: `bzzoiro_field_audit.md`, `bzzoiro_provider_mapping.md`

---

## Integration boundary

```text
BSD raw JSON
    ↓
bsdNormalizer (evaluation adapter)
    ↓
bsdProvider.competitions|fixtures|fixtureDetails|standings|lineups|odds
    ↓
Evaluation / crosswalk / enrichment_store ONLY
    ↓
BLOCKED → prediction_engine, canonical_match, grading, verification logic changes
```

---

## Event / fixture mapping

| BSD field | SKCS canonical field | Transform | Lane |
|-----------|---------------------|-----------|------|
| `id` | `GameId` | `String(id)` | Evaluation |
| `id` | `provider_event_id` | `String(id)` | Crosswalk |
| `league_id` | `provider_league_id` | `String(league_id)` | Crosswalk |
| `season_id` | `provider_season_id` | `String(season_id)` | Context |
| `home_team_id` | `provider_home_team_id` | `String(...)` | Crosswalk |
| `away_team_id` | `provider_away_team_id` | `String(...)` | Crosswalk |
| `home_team` | `HomeTeam` | trim string | Display |
| `away_team` | `AwayTeam` | trim string | Display |
| `home_team` | `home_team_name` | alias | Display |
| `away_team` | `away_team_name` | alias | Display |
| `event_date` | `kickoff_time_utc` | ISO8601 passthrough | Context |
| `status` | `status_raw` | original string | Audit |
| `status` | `MatchStatusNormalized` | `mapBsdStatus()` → `normalizeStatus()` | Verification |
| `home_score` | `HomeGoals` | integer or null | Verification |
| `away_score` | `AwayGoals` | integer or null | Verification |
| `home_score_ht` | `home_score_ht` | integer or null | Context |
| `away_score_ht` | `away_score_ht` | integer or null | Context |
| `current_minute` | `current_minute` | integer — **blocked** for pre-match canonical path | — |
| `round_number` | `round_number` | integer | Context |
| `venue_id` | `venue_id` | string | Context |
| `head_to_head` | embedded object | passthrough on `fixtureDetails` | Enrichment |
| `weather` | nested object | passthrough on `fixtureDetails` | Context (weather policy off by default) |

### BSD status → `MatchStatusNormalized`

| BSD `status` | Pre-transform | Canonical output |
|--------------|---------------|------------------|
| `notstarted` | `scheduled` | `Scheduled` |
| `finished` | `final` | `Final` |
| `inprogress` | `inprogress` | `InProgress` |
| `postponed` | — | `Postponed` |
| unknown | — | `Unknown` |

---

## Competition / league mapping

| BSD field | SKCS canonical field | Transform |
|-----------|---------------------|-----------|
| `id` | `CompetitionId` | `String(id)` |
| `id` | `provider_league_id` | `String(id)` |
| `name` | `competition_name` | string |
| `country` | `country_name` | string |
| `is_active` | `competition_active` | boolean |
| `is_women` | `is_women` | boolean |
| `current_season.id` | `provider_season_id` | string |
| `current_season.name` | `season_name` | string |
| `current_season.year` | `season_year` | integer |
| `current_season.start_date` | `season_start_date` | date string |
| `current_season.end_date` | `season_end_date` | date string |

---

## Standings mapping

| BSD field | SKCS normalized field | Notes |
|-----------|----------------------|-------|
| `standings[].position` | `position` | League table rank |
| `standings[].team_id` | `provider_team_id` | Crosswalk key |
| `standings[].team_name` | `team_name` | Display |
| `standings[].played` | `played` | — |
| `standings[].won` / `drawn` / `lost` | `won` / `drawn` / `lost` | — |
| `standings[].gf` / `ga` / `gd` | `goals_for` / `goals_against` / `goal_difference` | — |
| `standings[].pts` | `points` | — |
| `standings[].form` | `form` | String streak |
| `standings[].xgf` / `xga` / `xgd` | `xgf` / `xga` / `xgd` | **Verification only** — not feature-store canonical |
| `groups{GroupName:[]}` | `groups[].group_name` + `rows[]` | Cup tournaments |

---

## Odds mapping (enrichment)

| BSD field | SKCS normalized field | Lane |
|-----------|----------------------|------|
| `markets.{market}.{outcome}.{bookmaker}.odds` | `quotes[].odds_decimal` | Enrichment |
| `markets.*.*.*.outcome_name` | `quotes[].outcome_name` | Verification |
| bookmaker slug key | `quotes[].bookmaker_slug` | Enrichment |
| `event_id` | `provider_event_id` | Crosswalk |

Schema: `skcs:bzzoiro:odds-comparison:v1` (reused from `bzzoiroNormalizer.js`)

---

## Lineups mapping (enrichment + restricted verification)

| BSD field | SKCS normalized field | Governance |
|-----------|----------------------|------------|
| `lineup_status` | `lineup_status` + `status_normalized` | Enrichment |
| `lineups.home/away.formation` | `home/away.formation` | Enrichment |
| `lineups.*.players[].player_id` | `provider_player_id` | Enrichment |
| `lineups.*.players[].ai_score` | `ai_score` | **Verification only** |
| `confidence` | `verification.confidence` | **Verification only** |
| `beta` | `verification.beta` | Audit flag |

Schema: `skcs:bzzoiro:lineups:v1`

---

## Semantic gaps

| Gap | Impact | Mitigation |
|-----|--------|------------|
| BSD IDs ≠ API-Sports IDs | Cannot join without crosswalk | `bzzoiroCrosswalk.js` tier-1 map |
| `season_id` null on some events | Season-scoped queries incomplete | Filter by `league_id` + date window |
| `notstarted` not in global status registry | Would map to `Unknown` without pre-transform | `mapBsdStatus()` in normalizer |
| Team names as strings on events (not nested objects) | No logo URL on list endpoint | Enrichment from other providers |
| Polymarket sparse | 404 on many events | Graceful empty envelope |
| Odds sparse on far-future fixtures | `bookmakers_count: 0` | Expected — not a mapping failure |
| xG in standings | Present (`xgf`, `xga`) | Mapped but governance-blocked for feature store |
| `/prediction/` endpoint | BSD AI picks exist | **Not mapped** — blocked by directive |
| `/stats/` spatial data | Rich match stats | **Not mapped** — blocked by governance |

---

## API-Sports cross-reference (evaluation only)

When API-Sports is reactivated, compare on:

- `GameId` ↔ API-Sports `fixture.id` via datetime + team names + league crosswalk
- `MatchStatusNormalized` ↔ API-Sports `fixture.status.short`
- `HomeTeam` / `AwayTeam` ↔ API-Sports `teams.home.name` / `teams.away.name`
- `kickoff_time_utc` ↔ API-Sports `fixture.date`

Never write BSD-normalized rows into canonical tables without explicit governance promotion.
