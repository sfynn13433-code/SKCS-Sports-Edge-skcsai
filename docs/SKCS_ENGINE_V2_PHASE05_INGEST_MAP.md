# SKCS Engine V2 — Phase 0.5 Ingestion Integrity Map

**Status:** Locked diagnosis  
**Date:** 2026-05-31  

**Enforcement:** `docs/canonical_ingest_firewall.spec.md` + `backend/services/canonicalIngestFirewall.js`

## Executive summary

`football_canonical_events.raw_provider_data` is **not** failing because Poisson or identity logic is wrong. It fails because **the wrong objects are being stored as “canonical”**:

| Provider stored | Rows | Has `teams.home.id` | Has `goals` |
|-----------------|-----:|--------------------:|------------:|
| **odds-api** | 4,751 | No | No |
| FootballData.org | 754 | Partial (`homeTeam`) | No |
| **api-sports** | 201 | **197 yes** | No* |
| Other | 171 | Mixed | No |

\* Scores require a **finished-fixture refresh** from API-Sports (`goals` block is often empty on upcoming fixture pulls).

Live DB: `canonical_events` **does not exist**; production table is `football_canonical_events` (5,877 rows).

---

## Where payload is dropped (code map)

### Path A — Production sync (`syncService` → `canonicalEvents`)

```text
syncService.syncSports()
  → buildLiveData()                    [dataProvider.js]
  → buildMatchContext()                [normalizerService.js]
  → upsertCanonicalEvents(normalized)  [canonicalEvents.js]
  → RPC upsert_canonical_event         [migration SQL → canonical_events*]
```

\* RPC targets `canonical_events`; live Supabase uses `football_canonical_events` — table wiring may differ in prod (view/trigger/manual). **Data shape issue remains regardless.**

#### Drop point 1 — Source priority fills canonical with Odds API

```1590:1638:backend/services/dataProvider.js
// API-Sports fixtures → normalizeFixture() sets raw_provider_data: f  ✅ full fixture
// ...
// Odds API fallback → fetchOddsData() sets raw_provider_data: event   ❌ no team IDs, no goals
```

When API-Sports returns few fixtures (quota, `DISABLE_APISPORTS`, wrong season/league), `appendAggregated` still hits **minFixturesTarget** via **Odds API**. Those rows become the bulk of what gets synced.

#### Drop point 2 — Odds object stored verbatim

```1358:1375:backend/services/dataProvider.js
out.push({
    match_id: `odds-${event.id}`,
    provider: 'odds-api',
    raw_provider_data: event   // ← { id, home_team, away_team, sport_key, bookmakers }
});
```

This is correct for **`events`** (betting lines). It is **wrong** for **`football_canonical_events`** (fixture truth).

#### Drop point 3 — Canonical upsert stores whatever `raw_provider_data` is

```94:103:backend/services/canonicalEvents.js
const cleanData = {
    // ...
    p_raw_payload: item?.raw_provider_data || item
};
```

If sync passes **`normalized`** (not raw API fixture):

- Usually still has `raw_provider_data` from earlier step → **Odds shape** if source was Odds API.
- If missing: `|| item` stores the **whole normalized object** (`match_info`, `sharp_odds`, …) → **0% API-Sports shape** (matches probe: `apisports_shape: 0`).

#### Drop point 4 — sync passes normalized, not raw fixture

```495:496:backend/services/syncService.js
await upsertCanonicalEvents(normalizedMatches);
```

`normalized` retains `raw_provider_data` from `buildCompatibilityPayload`:

```842:842:backend/services/normalizerService.js
raw_provider_data: isObject(raw?.raw_provider_data) ? raw.raw_provider_data : raw
```

No bug here **if** upstream `raw` was API-Sports. Bug is **upstream source mix**, not this line.

#### Drop point 5 — API-Sports path is correct but under-used

```1423:1451:backend/services/dataProvider.js
function normalizeFixture(f, sport) {
    if (f?.fixture?.id) {
        return {
            match_id: String(f.fixture.id),
            raw_provider_data: f   // ✅ includes teams.home.id, fixture.status, league
        };
    }
}
```

Only **~201 rows** in DB with `provider_name = 'api-sports'`. The ingest pipeline **can** store full fixtures; it usually **does not** at volume.

---

### Path B — Snapshot import (correct split, same canonical risk)

```2018:2021:scripts/import-today-snapshot-pipeline.js
const eventsUpserted = await upsertEvents(dedupedFixtures);      // ✅ Odds → events
await upsertCanonicalEvents(dedupedFixtures);                   // ⚠️ same array → canonical
```

Same fixtures array may contain Odds-shaped rows → canonical polluted the same way.

---

### Path C — Reference implementation (works, not wired to main sync)

```50:85:backend/scripts/ingest_football.py
# Upserts canonical_entities + inserts football_canonical_events with full match JSON
raw_provider_data: match   # ✅ API-Sports response element
```

This script stores the **full** `response[]` fixture object. **Main sync does not use this path.**

---

### Path D — TheSportsDB (partial IDs, different schema)

```1098:1118:backend/services/dataProvider.js
raw_provider_data: event   // idHomeTeam, idAwayTeam, strHomeTeam — not teams.home.id
```

Valid for provider `thesportsdb` mapping; V2 SQL expecting `teams.home.id` must also handle `idHomeTeam` / `HomeTeamID` (normalizer already lists these paths).

---

## Correct architecture (Phase 0.5)

```text
                    ┌─────────────────────┐
  API-Sports        │  Fixture truth      │
  /fixtures         │  (teams, goals,     │
                    │   status, league)   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ football_canonical_ │
                    │ events (JSON only   │
                    │  API-Sports shape)  │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
  team_identity_map      match_results         V2 strength (later)

  Odds API ──────────────► events table ONLY (lines, display names)
                           NEVER canonical truth
```

---

## Minimal fixes (1–2 line class, not redesign)

| # | Change | File |
|---|--------|------|
| 1 | **Skip** `upsertCanonicalEvents` when `provider === 'odds-api'` (or no `fixture.id` / no `teams.home.id`) | `canonicalEvents.js` |
| 2 | Pass **`rawMatch`** to canonical upsert, not `normalized`, **or** force `p_raw_payload` from `rawMatch.raw_provider_data` only if API-shaped | `syncService.js` |
| 3 | Prefer API-Sports for football canonical; raise `minFixturesTarget` fallback threshold before Odds fills sync batch | `dataProvider.js` |
| 4 | Finished scores: post-sync job `GET /fixtures?id=` for FT fixtures → merge `goals` into payload | new `scripts/refresh-canonical-results.js` |
| 5 | Unify table target: RPC or insert into `football_canonical_events` | migration / `canonicalEvents.js` |
| 6 | `render.yaml` hourly Python: `DISABLE_APISPORTS=true` **blocks** API-Sports on that cron — do not use that job for canonical truth | ops |

---

## Revised roadmap (locked)

```text
Phase -0.5  Ingestion integrity (this document)
Phase 0     Provider-ID identity (schema ready)
Phase 0b    match_results from canonical JSON only
Phase 1+    team_strength → probabilities (unchanged)
```

**Do not apply Phase 0b backfill until Phase 0.5 gate:**

| Gate | Target |
|------|--------|
| `football_canonical_events` rows with API-Sports shape (`fixture` + `teams`) | ≥ 95% of football canonical rows |
| Rows with `goals.home` / `goals.away` on **finished** matches | ≥ 95% of finished |
| `odds-api` payloads in canonical table | **0%** |

---

## One-line truth

> Canonical ingest stores **betting events** (~81% Odds API) instead of **API-Sports fixtures** (~3%). Fix source gating, not fuzzy team names.
