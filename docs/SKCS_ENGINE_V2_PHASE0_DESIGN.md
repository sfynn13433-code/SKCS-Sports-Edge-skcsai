# SKCS Engine V2 — Phase 0 / 0b Design (Provider-ID First)

**Status:** Locked  
**Date:** 2026-05-31  
**Supersedes:** Text-first identity (`events` aliasing as primary path)

---

## Constraint (data reality, not preference)

Live audit (`scripts/audit-v2-identity-deep.js`):

| Signal | Value |
|--------|------:|
| Distinct `events` team strings | ~28,455 |
| Max repetition per name | ~5 |
| Exact / fuzzy match to `canonical_entities` | ~2.6% / ~3.3% |

**Conclusion:** `events.home_team` / `away_team` are **not** a team catalog. They are display/debug fields only.

```text
V2 = Provider-ID-first deterministic football model
NOT text-normalised fuzzy football model
```

---

## Identity rule (critical)

> **If `provider` + `provider_team_id` exist → text is ignored for identity resolution.**

| Source | Role |
|--------|------|
| `football_canonical_events.raw_provider_data` | Primary extract of team IDs, scores, status, league |
| `canonical_entities` | Seed + truth for `(sport, provider_id)` → name |
| `team_identity_map` | Many provider rows → one `skcs_team_id` |
| `team_aliases` | **UI / search only** — never used in ingest or strength SQL |
| `events` team strings | Audit / fallback display — **0% identity dependency** |

---

## Phase 0 — Schema

### `skcs_teams`

One UUID per real-world club (per sport).

| Column | Purpose |
|--------|---------|
| `skcs_team_id` | Global SKCS team key (used in strength + results) |
| `canonical_name` | Display name from primary provider |
| `sport` | `football` |
| `country` | Optional |

### `team_identity_map`

Deterministic lookup — **this is the identity layer**.

| Column | Purpose |
|--------|---------|
| `sport` | `football` |
| `provider` | e.g. `api-sports`, `canonical_entities`, `thesportsdb` |
| `provider_team_id` | Stable external ID (string) |
| `provider_team_name` | Snapshot label (not used for joins) |
| `skcs_team_id` | FK → `skcs_teams` |

**Unique:** `(sport, provider, provider_team_id)`

### `team_aliases` (optional enrichment)

- Populated **after** provider map is stable.
- Used for frontend search / admin tools only.
- **Must not** appear in `resolve_skcs_team_id` for ingest paths.

### Resolver: `resolve_skcs_team_id(sport, provider, provider_team_id, _)`

```text
INPUT:  provider + provider_team_id (required for ingest)
OUTPUT: skcs_team_id OR NULL

TEXT:   ignored (always NULL path for production ingest)
```

---

## Phase 0 — Backfill order

1. **Seed from `canonical_entities`**  
   - `provider = 'canonical_entities'` (or `api-sports` if IDs are API-Sports numeric strings)  
   - One `skcs_team_id` per `provider_id`

2. **Upsert from `football_canonical_events` JSON**  
   For each row, extract:

   ```json
   teams.home.id, teams.away.id
   teams.home.name, teams.away.name
   ```

   Ensure `team_identity_map` row exists; create `skcs_teams` if new ID.

3. **Coverage report** (gate)

   ```sql
   -- % of finished canonical rows where both provider team IDs resolve to skcs_team_id
   ```

4. **Aliases (optional)**  
   Copy `provider_team_name` + `canonical_name` into `team_aliases` for UI only.

---

## Phase 0b — `match_results` (canonical JSON only)

### Primary source

`football_canonical_events` — **not** `events` text.

### JSON extraction (API-Sports shape in `raw_provider_data`)

| Field | JSON path |
|-------|-----------|
| Fixture ID | `fixture.id` or `provider_event_id` column |
| Home provider team ID | `teams.home.id` |
| Away provider team ID | `teams.away.id` |
| Home score | `goals.home` |
| Away score | `goals.away` |
| Status | `fixture.status.short` or `status` column |
| League ID | `league.id` |
| League name | `league.name` or `competition_name` |
| Season | `league.season` or `season` column |
| Kickoff | `fixture.date` or `start_time_utc` |

### Finished status normalization

Same set as V1 grader: `ft`, `finished`, `match finished`, `full time`, `complete`, `completed`, `final`.

### Row identity

| Constraint | Purpose |
|------------|---------|
| `UNIQUE (source_table, source_id)` | `source_table = 'football_canonical_events'`, `source_id = provider_event_id` |
| `UNIQUE (sport, fixture_id)` | `fixture_id = provider_event_id` |

### Team resolution on insert

```text
home_skcs = resolve_skcs_team_id('football', 'api-sports', teams.home.id)
away_skcs = resolve_skcs_team_id('football', 'api-sports', teams.away.id)
```

Text names stored in `home_team_name` / `away_team_name` for **audit only**.

### Secondary enrichment (optional, later)

Join `events` on shared fixture key **only** to attach odds metadata — never to set `skcs_*_team_id`.

---

## Phase 0 / 0b success gates (revised)

| Gate | Target | Measurement |
|------|--------|-------------|
| **Provider ID coverage** | ≥ 95% | Finished `football_canonical_events` rows with both `skcs_home_team_id` and `skcs_away_team_id` |
| **Text identity dependency** | **0%** | No ingest SQL calls resolver with text-only |
| **Duplicate fixtures** | 0 | Unique constraints on `match_results` |
| **Score completeness** | ≥ 95% | Finished rows with non-null `home_score` / `away_score` |
| **League attribution** | ≥ 90% | `league_id` or `league_name` populated |

~~95% text match accuracy~~ — **removed**.

---

## Implementation artifacts

| Artifact | Path |
|----------|------|
| ADR | `docs/SKCS_ENGINE_V2_ADR.md` |
| Phase 0 migration | `supabase/migrations/20260531000001_skcs_engine_v2_phase0_identity.sql` |
| Phase 0b migration | `supabase/migrations/20260531000002_skcs_engine_v2_phase0b_match_results.sql` |
| Foundation audit | `scripts/audit-v2-foundation.js` |
| Deep identity audit | `scripts/audit-v2-identity-deep.js` |
| Provider coverage audit (TBD) | `scripts/audit-v2-provider-coverage.js` |

---

## Phase 0.5 — Ingestion integrity (required before 0b)

See **`docs/SKCS_ENGINE_V2_PHASE05_INGEST_MAP.md`**.

Live probe: **4,751 / 5,877** `football_canonical_events` rows are **Odds API** shape (`home_team` string, no `teams.home.id`, no `goals`). Only **~201** rows are API-Sports-shaped.

**Rule:** Odds API → `events` only. API-Sports full fixture JSON → `football_canonical_events` only.

## Execution order

1. V1 grading fix — **done** (`track-prediction-accuracy.js`)
2. Deep identity audit — **done** (provider-first; text not viable)
3. Phase -0.5 firewall — **done** (`canonicalIngestFirewall.js`)
4. **Phase 0b.5** — canonical replay (`docs/SKCS_ENGINE_V2_PHASE0B5_REPLAY.md`, `scripts/rebuild-canonical-from-api-sports.js`)
5. Apply Phase 0 migration → seed from `canonical_entities`
6. Phase 0b → `build_match_results_from_canonical()` only after replay gates
7. Phase 1+ only if gates pass

---

## One-line summary

> SKCS does not have a team-name problem; it had the **wrong identity source**. V2 identity is **provider ID only**; text is debug/UI.
