# SKCS Feature Risk Registry

**Purpose:** Permanent governance artifact defining which provider fields may enter each SKCS lane.  
**Principle:** Never trust a provider. Normalize → verify → govern → then decide.  
**BSD field audit:** `../providers/bzzoiro_field_audit.md` (2026-06-11 — governance cleared)

## Lane definitions

| Lane | May enter prediction engine? | Storage |
|------|------------------------------|---------|
| `canonical` | Yes (via API-Sports only today) | `football_canonical_events` |
| `enrichment` | Yes (as derived SKCS features only) | Feature store / context tables |
| `verification` | No — compare signals only | `verification_compare` / logs |
| `experimental` | No | Sandboxed tables |
| `blocked` | No — quarantine | `semantic_violations` only |

---

## Bzzoiro Sports Data (BSD) — field-level (approved endpoints)

### `/events/{id}/odds/comparison/`

| Field | Lane | Pred | Rel | Gov | Status |
|-------|------|------|-----|-----|--------|
| `markets.*` | semantic | 0 | 10 | 1 | mapping only |
| `{outcome_code}` | semantic | 0 | 10 | 1 | mapping only |
| `{bookmaker_slug}` | semantic | 0 | 10 | 1 | mapping only |
| `odds` | enrichment | 10 | 9 | 2 | **Approved** |
| `previous_decimal_odds` | enrichment | 9 | 9 | 2 | **Approved** |
| `is_max_quote` | enrichment | 7 | 10 | 1 | **Approved** |
| `outcome_name` | verification | 0 | 10 | 1 | **Approved** |

### `/events/{id}/polymarket/`

| Field | Lane | Pred | Rel | Gov | Status |
|-------|------|------|-----|-----|--------|
| `implied_probability` | enrichment | 9 | 9 | 2 | **Approved** |
| `decimal_odds` | enrichment | 9 | 9 | 2 | **Approved** |
| `volume_usd` / `liquidity_usd` | — | — | — | — | **Absent in v2** |

### `/events/{id}/lineups/`

| Field | Lane | Pred | Rel | Gov | Status |
|-------|------|------|-----|-----|--------|
| `lineup_status` | core/enrichment | 10 | 10 | 1 | **Approved** |
| `beta` | verification | 0 | 10 | 1 | **Approved** |
| `confidence` | verification | 7 | 7 | 5 | **Restricted** |
| `updated_at` | core | 0 | 10 | 1 | **Approved** |
| `lineups.*.formation` | enrichment | 8 | 8 | 2 | **Approved** |
| `lineups.*.players[].player_id` | semantic | 9 | 9 | 1 | **Approved** |
| `lineups.*.players[].ai_score` | verification | 7 | 6 | 5 | **Restricted** |
| `unavailable_players[].player_id` | enrichment | 8 | 6 | 2 | **Approved** |
| `unavailable_players[].reason` | enrichment | 6 | 6 | 2 | **Approved** |

### BSD — globally blocked (adapter hard-disabled)

| Feature | Endpoint | Gov | Status |
|---------|----------|-----|--------|
| Shot maps / xG / momentum / positions | `/events/{id}/stats/` | 10 | **Blocked** |
| BSD ML prediction probabilities | `/events/{id}/prediction/` | 10 | **Blocked** |
| Live WebSocket | `wss://.../ws/live/` | 7 | **Blocked** |
| Fixture canonical writes | `/events/` | 6 | verification crosswalk only |

---

## SKCS-derived features (allowed from BSD inputs)

| Feature | Inputs | Lane |
|---------|--------|------|
| `market_divergence_pinnacle_polymarket` | odds comparison + polymarket | enrichment |
| `market_stress_best_vs_consensus` | odds comparison | enrichment |
| `information_leak_signal` | lineup confidence delta + odds movement | verification |
| `lineup_surprise_score` | predicted vs confirmed lineup diff | enrichment |

---

## SportsDataIO (reference)

| Feature | Status |
|---------|--------|
| UCL Schedule metadata | Approved → pre-match context |
| GamesByDate live ticker | Blocked as primary path |
| Spatial / enterprise feeds | Block until paid + provenance |

---

## API-Sports (reference — primary)

| Feature | Status |
|---------|--------|
| `fixture.id` | Approved → canonical |
| `goals`, `status`, `teams` | Approved → canonical |

---

## Promotion rules

1. Provenance documented or field audit complete
2. Semantic mapping in `providers/*_provider_mapping.md`
3. Sample payloads schema-locked in `providers/*_field_audit.md`
4. Normalizer enforces lane per field
5. Verification Layer parallel run (Phase 4) before production enrichment store writes

---

## Anti-patterns

```text
Provider Prediction Probability  →  SKCS Prediction Engine  ❌
Raw provider integer ID          →  SKCS primary key        ❌
RED provenance spatial data      →  Feature store           ❌
Unmapped provider field          →  Any lane                ❌
confidence / ai_score            →  Feature store training  ❌
```

---

## Related documents

- `../providers/bzzoiro_field_audit.md`
- `../providers/bzzoiro_provider_mapping.md`
- `provider_scorecard_bsd.md`
- `bsd_governance_hold.md` (lifted)
- `verification_layer_spec.md`
