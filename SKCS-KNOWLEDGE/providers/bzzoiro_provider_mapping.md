# Bzzoiro Sports Data (BSD) — Semantic Provider Mapping

**Status:** Verified against field audit (`bzzoiro_field_audit.md`) — 2026-06-11  
**Provider role:** `ENRICHMENT` (conditionally approved)  
**Canonical truth:** API-Sports remains primary; BSD never writes canonical football truth.

## Integration boundary

```text
BSD raw JSON
    ↓
bzzoiroNormalizer (future adapter — not implemented)
    ↓
buildBSDContractView (future — mirrors sportsdataioContractHelpers pattern)
    ↓
enforcementGuard / canonicalIngestFirewall
    ↓
Allowed → enrichment_store / verification_compare
Blocked → semantic_violations ledger
```

Nothing passes to `prediction_engine` without explicit governance approval per field.

---

## Provider connection

| Property | Value |
|----------|-------|
| Base URL | `https://sports.bzzoiro.com/api/v2/` |
| Auth header | `Authorization: Token {BSD_API_TOKEN}` |
| Pagination | `limit` (default 50, max 200), `offset` |
| Date filter | `date_from`, `date_to` (`YYYY-MM-DD`) on `/events/` |

---

## Core entity mappings

### Event / fixture

| BSD field | SKCS canonical field | Transform | Store lane |
|-----------|---------------------|-----------|------------|
| `id` | `provider_event_id` | `String(id)` | Crosswalk |
| `league_id` | `provider_league_id` | `String(league_id)` | Crosswalk |
| `season_id` | `provider_season_id` | `String(season_id)` | Context |
| `home_team_id` | `provider_home_team_id` | `String(...)` | Crosswalk |
| `away_team_id` | `provider_away_team_id` | `String(...)` | Crosswalk |
| `home_team.name` | `home_team_name` | trim string | Display |
| `away_team.name` | `away_team_name` | trim string | Display |
| `start_time` / `kickoff` | `kickoff_time_utc` | ISO8601 normalize | Context |
| `status` | `MatchStatusNormalized` | `normalizeStatus()` | Verification |
| `home_score` | `HomeGoals` | integer or null | Verification |
| `away_score` | `AwayGoals` | integer or null | Verification |
| `current_minute` | `live_minute` | **Block** pre-match path | — |
| `last_updated` | `provider_updated_at` | ISO8601 | Freshness |

### League

| BSD field | SKCS canonical field | Transform |
|-----------|---------------------|-----------|
| `id` | `provider_league_id` | string |
| `name` | `competition_name` | string |
| `country` | `country_name` | string |
| `current_season.id` | `provider_season_id` | string |
| `is_active` | `competition_active` | boolean |

### Team

| BSD field | SKCS canonical field | Transform |
|-----------|---------------------|-----------|
| `id` | `provider_team_id` | string |
| `name` | `team_name` | string |
| `country_code` | `country_code` | ISO alpha-2/3 |

### Player (squad / lineup)

| BSD field | SKCS canonical field | Transform | Governance |
|-----------|---------------------|-----------|------------|
| `id` | `provider_player_id` | string | Approved |
| `name` | `player_name` | string | Approved |
| `position` | `player_position` | enum map | Approved |
| `shirt_number` | `jersey_number` | string | Approved |
| `lineup_status` | `lineup_availability` | confirmed/predicted/unavailable | Approved |
| `confidence` | `lineup_prediction_confidence` | float 0–1 | **Restricted** — verification only |
| `ai_score` | — | — | **Blocked** from feature store |

---

## Approved enrichment endpoints

### Odds comparison — `GET /events/{id}/odds/comparison/`

Nested shape: `markets.{market_key}.{OUTCOME_CODE}.{bookmaker_slug}.*`

| BSD field | SKCS field | Lane |
|-----------|-----------|------|
| `markets` | `betting_markets` | semantic mapping |
| `{outcome_code}` | `market_outcome_code` | semantic (`HOME`/`DRAW`/`AWAY`) |
| `{bookmaker_slug}` | `sportsbook_key` | semantic |
| `odds` | `odds_decimal` | enrichment |
| `previous_decimal_odds` | `previous_odds_decimal` | enrichment |
| `is_max_quote` | `is_best_price` | enrichment |
| `outcome_name` | `outcome_display_name` | verification |

**SKCS-derived features (allowed):** Pinnacle vs Polymarket divergence, best vs consensus spread, odds movement delta.

### Polymarket — `GET /events/{id}/polymarket/`

Nested shape: `markets.{market_key}.{OUTCOME_CODE}.*`

| BSD field | SKCS field | Lane |
|-----------|-----------|------|
| `implied_probability` | `polymarket_implied_prob` | enrichment |
| `decimal_odds` | `polymarket_decimal_odds` | enrichment |

### Lineups — `GET /events/{id}/lineups/`

| BSD field | SKCS field | Lane |
|-----------|-----------|------|
| `lineup_status` | `lineup_state` | enrichment (`confirmed`/`predicted`/`unavailable`) |
| `beta` | `lineup_beta_flag` | verification (predicted only) |
| `confidence` | `lineup_prediction_confidence` | **restricted** verification |
| `updated_at` | `lineup_updated_at` | core metadata |
| `lineups.home/away.formation` | `formation_code` | enrichment |
| `lineups.*.players[].player_id` | `provider_player_id` | semantic |
| `lineups.*.players[].ai_score` | `lineup_ai_score` | **restricted** verification |
| `unavailable_players[].player_id` | `provider_player_id` | enrichment |
| `unavailable_players[].reason` | `unavailability_reason` | enrichment |

---

## Blocked mappings (do not normalize into feature store)

| BSD source | Fields | Reason |
|------------|--------|--------|
| `/events/{id}/stats/` | `shotmap`, `xg`, `momentum`, `average_positions`, coordinates | RED provenance |
| `/events/{id}/prediction/` | `match_result.prob_*`, `score_predictions`, `recommended` | Provider echo risk + RED training contamination |
| `/events/live/` | all live tick fields | Pre-match product policy |
| WebSocket frames | all | Ephemeral; no canonical writes |

---

## Status normalization

| BSD `status` | SKCS `MatchStatusNormalized` |
|--------------|------------------------------|
| `scheduled` / `notstarted` | `Scheduled` |
| `inprogress` / `live` | `InProgress` (verification only) |
| `finished` / `ended` | `Final` |
| `postponed` | `Postponed` |
| `cancelled` / `canceled` | `Postponed` |
| unknown | `Unknown` → quarantine |

Uses existing `backend/semantic-layer/registry.js` — extend `STATUS_ALIASES` when adapter is built.

---

## Cross-provider identity resolution (required before adapter)

```text
API-Sports fixture.id  ←→  BSD event.id
```

Resolution keys (in priority order):

1. Verified crosswalk table (`provider_match_crosswalk`)
2. `kickoff_time_utc` + normalized `home_team_name` + `away_team_name` + `competition_name`
3. Manual admin link — never auto-promote on fuzzy name alone

---

## Future adapter interface (Phase 3 — not implemented)

Both providers should converge to:

```typescript
interface ProviderMatchEnvelope {
  gameId: string;           // SKCS canonical or crosswalked id
  providerEventId: string;  // opaque provider key
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;      // ISO UTC
  status: string;           // normalized
  provider: 'api-sports' | 'bzzoiro';
  lane: 'canonical' | 'enrichment' | 'verification';
}
```

Prediction engine reads **canonical lane only**.
