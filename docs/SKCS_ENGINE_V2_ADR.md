# SKCS Engine V2 — Architecture Decision Record

**Status:** Accepted  
**Date:** 2026-05-31  
**Decision:** Build SKCS Engine V2 in parallel with V1. Do not replace production until statistically validated.

## Current runtime note

The live runtime now includes controlled SportsDataIO fixture/context support alongside the canonical football ingest path. This ADR still governs V2 identity and scoring decisions, but it must be read alongside the ingest/firewall docs so provider semantics do not get confused with truth ownership.

---

## Context

Repository and live-database audits showed two architectures in one codebase:

- **V1 (production):** Odds + league stats + API predictions + heuristics + context + AI, spread across Node services.
- **V2 (dormant design):** Team strength (α, β, γ) → expected goals → score distribution → derived markets, originally sketched in `sql/extreme_smb_data.sql` and SMB rulebook formulas.

Live Supabase audit (2026-05-31, `scripts/audit-v2-foundation.js`):

| Finding | Value |
|---------|------:|
| Football `events` finished + scored (`finished` / `ft`) | **4,911** |
| Football `events` with `status = 'FT'` only (grader mismatch) | **50** |
| `canonical_entities` (football) | **1,716** |
| `events` team names exact-match to entities | **2.6%** |
| `football_canonical_events` with entity FKs | **0%** |
| `team_strength_params` on live DB | **missing** |
| `predictions_accuracy` rows | **0** |

**Deep identity audit (2026-05-31):** ~28,455 distinct `events` team strings; ~3% match to `canonical_entities`. **`events` text is not a usable identity layer.**

**Conclusion:** V2 foundation is **provider-ID-first** (`football_canonical_events` JSON + `canonical_entities`). Enough finished results exist (~4,911 in `events`; canonical JSON is primary for Phase 0b). See `docs/SKCS_ENGINE_V2_PHASE0_DESIGN.md`.

---

## Decision

### Lock V1 as production

Continue unchanged:

- `direct1x2Builder`, `direct1x2Engine`, `aiPipeline`
- Current API ingest, publish, grading, subscriptions, UX

**Role:** Revenue, user predictions, grading history, operational stability.

### Lock V2 as strategic architecture

Build alongside V1. **No production cutover** until parallel grading proves value.

**Role:** Mathematical prediction engine (name: **SKCS Engine V2**, not “Poisson Engine” — formula may evolve: Dixon-Coles, Elo, xG, Bayesian layers later).

---

## Three layers (mandatory separation)

| Layer | Question | May change | Must not |
|-------|----------|------------|----------|
| **1 — Probability** | What is likely? | Versioned math only | Injuries, AI, risk policy |
| **2 — Risk** | How much trust? | Confidence, tier, volatility | `p_home`, `p_draw`, `p_away`, BTTS, O/U |
| **3 — Intelligence** | Why? | AI narrative | Generate or override probabilities |

---

## V2 principles

1. Probability generation is separate from risk.
2. Risk is separate from AI.
3. AI explains probabilities; it does not create them.
4. External APIs provide data; SKCS generates predictions.
5. Every prediction must be gradeable (`engine`, `market`, `prediction`, `confidence`, `actual`, `result`).
6. V1 and V2 run side-by-side until statistically significant comparison supports migration.
7. One **SKCS team UUID** per club; never key strength directly on provider IDs in models (map provider → `skcs_team_id` first).
8. Layer 1 probabilities are immutable once published for a fixture/engine version; risk and AI never alter them.
9. **Provider-ID-first identity:** if `provider` + `provider_team_id` exist, text names are ignored for resolution. `events.home_team` / `away_team` are debug/UI only.
10. `team_aliases` are enrichment/search only — not ingest or strength logic.

---

## Target architecture

```text
External APIs
        ↓
Raw match data (Supabase)
        ↓
Match results (normalized)
        ↓
Team strength (α, β, γ) per league/season
        ↓
Probability engine (Layer 1)
        ↓
Risk engine (Layer 2)
        ↓
AI explanation (Layer 3)
        ↓
Published predictions (parallel table / source tag)
```

---

## Build order (approved scope)

### Phase 0 — Team identity (provider-ID first)

**Tables:** `skcs_teams`, `team_identity_map`, `team_aliases` (UI only)  
**Primary sources:** `canonical_entities`, `football_canonical_events.raw_provider_data` (`teams.home.id`, `teams.away.id`)  
**Not primary:** `events` team strings, fuzzy matching, alias-first backfill  

**Gates (Phase 0 + 0b complete):**

| Gate | Target |
|------|--------|
| Provider ID coverage (`skcs_*_team_id` on finished matches) | ≥ 95% |
| Text-only identity in ingest | **0%** |
| Duplicate fixtures | 0 |
| League attribution (`league_id` or `league_name`) | ≥ 90% |
| Finished results with scores | ≥ 95% |

Full design: `docs/SKCS_ENGINE_V2_PHASE0_DESIGN.md`

### Phase 0b — Match results (canonical JSON only)

**Table:** `match_results`  
**Primary source:** `football_canonical_events` (scores + provider IDs from JSON)  
**Secondary:** `events` — optional metadata only, never for `skcs_team_id` resolution  

**Note:** V1 grader updated to accept `finished`, `FT`, `Match Finished`, etc. (`scripts/track-prediction-accuracy.js`)

### Phase 1 — `team_strength_params` (after 0 + 0b verified)

Key: `(skcs_team_id, league_id, season)` — not provider `team_id`  
Columns: `alpha`, `beta`, `home_advantage_factor`, `sample_size`, `updated_at`

### Phase 2 — `refresh_team_strength()` (SQL only, no API)

### Phase 3 — `match_goal_expectations()` → λ, μ

### Phase 4 — Probability engine → immutable Layer 1 outputs

### Phase 5 — Risk layer (reuse existing context/rulebook patterns)

### Phase 6 — Parallel grading V1 vs V2

---

## Explicitly deferred

Do **not** build until Phase 0 + 0b success criteria met:

- `match_goal_expectations()`
- `match_market_probabilities()`
- `poisson_predictions` publish path
- AI probability generation
- Production cutover from V1

---


## Execution order (approved)

1. Fix V1 grading status normalization  
2. Run deep identity audit (`audit-v2-identity-deep.js`)  
3. Apply Phase 0 migration → populate aliases  
4. Apply Phase 0b migration → backfill `match_results`  
5. Measure gates → reassess Phase 1  

**Do not apply migrations until step 2 report is reviewed.**

## Verification

Re-run foundation audit:

```bash
node scripts/audit-v2-foundation.js
node scripts/audit-v2-identity-deep.js
```

After Phase 0/0b backfill, add checks for:

- Match rate `events` → `skcs_teams`
- `match_results` row count vs finished `events`
- Duplicate detection on `(skcs_home_team_id, skcs_away_team_id, played_at, league_id)`

---

## References

- Dormant prototype: `sql/extreme_smb_data.sql`
- SMB λ/μ formulas: `SKCS_MASTER_RULEBOOK.md` §11, `public/js/smh-hub.js`
- Live audit script: `scripts/audit-v2-foundation.js`
- V1 production path: `backend/services/aiPipeline.js`, `direct1x2Builder.js`, `direct1x2Engine.js`

---

*End of ADR.*
