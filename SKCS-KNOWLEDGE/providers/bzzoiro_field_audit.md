# BSD Field-Level Extraction Audit (Approved Endpoints Only)

**Status:** COMPLETE — governance-cleared for enrichment adapter  
**Audit date:** 2026-06-11  
**Excluded:** All `/stats/` spatial, xG, momentum, and `/prediction/` outputs

---

## 1. `GET /api/v2/events/{id}/odds/comparison/`

### Sample payload (locked)

```json
{
  "markets": {
    "1x2": {
      "HOME": {
        "pinnacle": {
          "odds": 2.04,
          "previous_decimal_odds": 2.00,
          "is_max_quote": false,
          "outcome_name": "1"
        }
      },
      "DRAW": {
        "pinnacle": {
          "odds": 3.10,
          "previous_decimal_odds": 3.10,
          "is_max_quote": true,
          "outcome_name": "X"
        }
      },
      "AWAY": {
        "pinnacle": {
          "odds": 3.80,
          "previous_decimal_odds": 3.95,
          "is_max_quote": false,
          "outcome_name": "2"
        }
      }
    }
  }
}
```

### Field matrix

| Field | Type | SKCS entity | Lane | Pred | Rel | Gov | Approval |
|-------|------|-------------|------|------|-----|-----|----------|
| `markets` | object | Betting Market | semantic | 0 | 10 | 1 | mapping only |
| `{outcome_code}` | string | Market Outcome | semantic | 0 | 10 | 1 | mapping only |
| `{bookmaker_slug}` | string | Bookmaker | semantic | 0 | 10 | 1 | mapping only |
| `odds` | float | Odds Quote | enrichment | 10 | 9 | 2 | **Approved** |
| `previous_decimal_odds` | float | Odds Quote | enrichment | 9 | 9 | 2 | **Approved** |
| `is_max_quote` | boolean | Odds Quote | enrichment | 7 | 10 | 1 | **Approved** |
| `outcome_name` | string | Market Outcome | verification | 0 | 10 | 1 | **Approved** |

Outcome keys are stable (`HOME`, `DRAW`, `AWAY`, `over`, `under`). Bookmaker keys use slugs.

---

## 2. `GET /api/v2/events/{id}/polymarket/`

### Sample payload (locked)

```json
{
  "markets": {
    "1x2": {
      "HOME": { "implied_probability": 0.46, "decimal_odds": 2.17 },
      "DRAW": { "implied_probability": 0.28, "decimal_odds": 3.57 },
      "AWAY": { "implied_probability": 0.26, "decimal_odds": 3.84 }
    }
  }
}
```

### Field matrix

| Field | Type | SKCS entity | Lane | Pred | Rel | Gov | Approval |
|-------|------|-------------|------|------|-----|-----|----------|
| `implied_probability` | float | Odds Quote | enrichment | 9 | 9 | 2 | **Approved** |
| `decimal_odds` | float | Odds Quote | enrichment | 9 | 9 | 2 | **Approved** |

`volume_usd` / `liquidity_usd` — **absent in v2** (not stored by BSD).

---

## 3. `GET /api/v2/events/{id}/lineups/`

### Sample payload (locked)

```json
{
  "lineup_status": "predicted",
  "beta": true,
  "confidence": 0.8521,
  "updated_at": "2026-06-11T12:00:00Z",
  "lineups": {
    "home": {
      "formation": "4-3-3",
      "players": [{ "player_id": 1234, "ai_score": 0.9123 }],
      "substitutes": [{ "player_id": 5678, "ai_score": 0.4500 }]
    },
    "away": {
      "formation": "4-4-2",
      "players": [{ "player_id": 9101, "ai_score": 0.8012 }],
      "substitutes": [{ "player_id": 1121, "ai_score": 0.4021 }]
    }
  },
  "unavailable_players": [{ "player_id": 3141, "reason": "injured" }]
}
```

### Field matrix

| Field | Type | SKCS entity | Lane | Pred | Rel | Gov | Approval |
|-------|------|-------------|------|------|-----|-----|----------|
| `lineup_status` | string | Match | core | 10 | 10 | 1 | **Approved** |
| `beta` | boolean | — | verification | 0 | 10 | 1 | **Approved** |
| `confidence` | float | Match | verification | 7 | 7 | 5 | **Restricted** |
| `updated_at` | string | Match | core | 0 | 10 | 1 | **Approved** |
| `lineups.*.formation` | string | Match | enrichment | 8 | 8 | 2 | **Approved** |
| `lineups.*.players[].player_id` | int | Player ID | semantic | 9 | 9 | 1 | **Approved** |
| `lineups.*.players[].ai_score` | float | Player Match | verification | 7 | 6 | 5 | **Restricted** |
| `unavailable_players[].player_id` | int | Player ID | enrichment | 8 | 6 | 2 | **Approved** |
| `unavailable_players[].reason` | string | — | enrichment | 6 | 6 | 2 | **Approved** |

**Discriminator rules:** `lineup_status` ∈ `confirmed` | `predicted` | `unavailable`. `beta` only when `predicted`. `confidence` and `ai_score` are `null` on confirmed lineups.

**Restricted note:** `confidence` / `ai_score` are BSD ML outputs — verification lane only; never feature-store training inputs.

---

## Final approval matrix

| Endpoint | Enrichment | Verification | Blocked |
|----------|------------|--------------|---------|
| odds/comparison | `odds`, `previous_decimal_odds`, `is_max_quote` | `outcome_name` | — |
| polymarket | `implied_probability`, `decimal_odds` | — | legacy volume fields |
| lineups | `lineup_status`, `formation`, `player_id`, `unavailable_*` | `beta`, `confidence`, `ai_score` | — |

**Adapter rule:** `bzzoiroNormalizer.js` must reject any field not listed above from these three endpoints.
