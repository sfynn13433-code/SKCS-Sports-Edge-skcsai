# SKCS Canonical Ingest Firewall Spec (Phase -0.5)

## Version: 1.0

## Status: ACTIVE DESIGN CONTRACT (pre-migration)

## Runtime note

This spec describes the canonical football truth boundary and the controlled ingest path that writes to it. SportsDataIO may contribute only through an explicit authorized fixture/context path when the runtime allows it.

---

## 1. Purpose

This document defines the **hard boundary between:**

- Football truth data (fixtures + results)
- Market / betting data (odds, bookmakers)
- Derived intelligence (probability, risk, AI)

It enforces that **SKCS Engine V2 cannot learn from corrupted or mixed-signal inputs.**

**Runtime enforcement:** `backend/services/canonicalIngestFirewall.js`

---

## 2. Core Principle (NON-NEGOTIABLE)

> A football match is only canonical if it originates from a fixture provider with stable fixture + team + score identity.

### Canonical truth source

```text
Canonical football truth is written only by the approved ingest path.
API-Sports remains the strict historical baseline for canonical fixture identity.
Authorized SportsDataIO fixtures may be surfaced only through a separate controlled display/context path when explicitly enabled.
```

---

## 3. Data Layer Separation

### 3.1 Canonical Football Layer (TRUTH)

**Table:** `football_canonical_events`

**Allowed sources:** API-Sports ONLY

**Required payload shape (minimum for ingest):**

```json
{
  "fixture": { "id": 12345, "status": { "short": "NS" } },
  "teams": {
    "home": { "id": 50, "name": "Manchester City" },
    "away": { "id": 33, "name": "Arsenal" }
  },
  "league": { "id": 39, "name": "Premier League" }
}
```

**HARD RULE — reject if the row does not match the accepted canonical fixture shape for the active ingest path:**

- `fixture.id`
- `teams.home.id`
- `teams.away.id`

**Goals rule (two-phase):**

| Phase | `goals.home` / `goals.away` |
|-------|-----------------------------|
| **Ingest** (upcoming + live) | Optional at write time; may be `null` |
| **Results / V2 training** (finished) | **Required** before `match_results` / α/β |

Finished fixtures without goals must be refreshed via `GET /fixtures?id=` before Phase 0b.

---

### 3.2 Market Layer (NON-TRUTH DATA)

**Table:** `events`

**Allowed sources:** Odds API ONLY (for football market lines)

**Explicit rule:** `events` is NEVER used for team identity, match results, V2 training, or probability modelling.

---

### 3.3 Derived Layers (V2 only)

Built AFTER canonical truth exists:

- `match_results`
- `team_strength_params`
- goal-expectation engine (λ / μ)
- probability tables

---

## 4. Ingestion Firewall Rules

### 4.1 Canonical ingestion gate

```javascript
const verdict = validateCanonicalPayload(payload, { requireGoals: false });
// verdict.accept === true required to write football_canonical_events
```

### 4.2 Source enforcement

```javascript
if (!isAllowedCanonicalProvider(provider)) {
  rejectIntoCanonical(); // route to events or drop
}
```

**Exception:** Only if the runtime explicitly enables a controlled SportsDataIO display/context path and the payload still satisfies the accepted canonical fixture shape.

### 4.3 Routing rules

| Provider | Destination |
|----------|-------------|
| API-Sports | `football_canonical_events` |
| Odds API | `events` |
| SportsDataIO | Authorized fixture/context path only, when explicitly enabled |
| FootballData | Rejected from canonical (enrichment later) |
| TheSportsDB | Rejected from canonical (enrichment later) |

---

## 5. Forbidden Behaviours (CRITICAL)

- Store Odds API data in `football_canonical_events`
- Use `events.home_team` as identity source
- Infer match results from bookmaker events
- Mix providers inside one canonical row
- Text-based team matching for truth layer

---

## 6. Correct System Flow (V2 TARGET)

```text
API-Sports
    ↓
football_canonical_events (TRUTH LAYER)
    ↓
match_results (normalized finished games)
    ↓
team_strength_params (α / β / γ)
    ↓
goal-expectation engine (λ / μ)
    ↓
probabilities (1X2, BTTS, O/U)
    ↓
risk layer (confidence, volatility)
    ↓
AI explanation layer
```

---

## 7. Legacy System (V1 — preserved)

```text
Odds API → events → AI pipeline → prediction
```

Still production. NOT used for V2 training or canonical truth.

---

## 8. Failure Modes This Prevents

1. Silent model corruption (odds masquerading as fixtures)
2. Identity drift
3. Statistical pollution for α/β
4. Fake performance (learning bookmaker bias)

---

## 9. Migration Rule (Phase -0.5 dependency)

V2 cannot proceed unless:

- [ ] ≥95% canonical rows are API-Sports shaped (`fixture` + `teams.*.id`)
- [ ] 0% Odds API records in canonical table
- [ ] Stable `fixture.id` on all canonical rows
- [ ] Goals present in canonical JSON for **finished** matches (≥95%)

---

## 10. Observability Requirement

Metric: `canonical_source_distribution`

Report: api-sports %, odds-api %, football-data %, rejected %

**Target for canonical table:**

```text
API-Sports → ≥95% (goal 100%)
Others     → 0%
```

**Probe:** `node scripts/audit-v2-provider-coverage.js`

---

## 11. System Ownership Rule

| Concept | Owner |
|---------|--------|
| Match truth | API-Sports only |
| Market truth | Odds API only |
| Probability | SKCS Engine V2 |
| Risk | SKCS policy layer |
| Narrative | AI |

No overlaps allowed.

---

## 12. Final Contract Statement

> If a row does not originate from API-Sports with fixture + team IDs, it is not a football match in the truth layer — it is a market signal or unsupported enrichment.

---

## 13. Implementation References

| Artifact | Path |
|----------|------|
| Runtime firewall | `backend/services/canonicalIngestFirewall.js` |
| Wired ingest | `backend/services/canonicalEvents.js` |
| Ingest map | `docs/SKCS_ENGINE_V2_PHASE05_INGEST_MAP.md` |
| V2 ADR | `docs/SKCS_ENGINE_V2_ADR.md` |

---

## 14. Forward protection vs historical truth (locked)

| | Firewall (Phase -0.5) | Replay (Phase 0b.5) |
|---|----------------------|---------------------|
| Blocks new Odds → canonical | ✅ | — |
| Fixes existing polluted rows | ❌ | ✅ `rebuild_canonical_from_api_sports` |
| Deterministic V2 rebuild from scratch | ❌ | ✅ after replay + `match_results` |
| Replay run audit trail | — | ✅ `canonical_replay_runs` (planned) |

See `docs/SKCS_ENGINE_V2_PHASE0B5_REPLAY.md`.

---

## Bottom line

This spec prevents SKCS from learning football from betting noise. **Replay** makes that true historically. Identity, α/β, and probabilities are only valid **after** firewall + replay gates pass.
