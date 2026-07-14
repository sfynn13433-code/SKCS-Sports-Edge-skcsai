# SEM-GOV-001D-UI3-I4 — Source B Schema and Persistence Implementation Design v1

**Packet ID:** `SEM-GOV-001D-UI3-I4`
**Parent programme:** `SEM-GOV-001` — Unified Sports Intelligence Lifecycle
**Parent mini-project:** `SEM-GOV-001D` — Football Sports Match Hub fixture-first UI
**Controlling contracts:** `SEM-GOV-001D-UI3-I1`, `SEM-GOV-001D-UI3-I2`, `SEM-GOV-001D-UI3-I3`, `EST-001`, `FIP-001`, `SEM-GOV-001B-I4`, `EFI-001` (intake boundary — not implemented)
**Start commit:** `1aca21fb95ed60dd6a767ad7b7ea9ce581be6458`
**Mode:** Read-only inspection closure and implementation design only — no migration apply, runtime service, or gate clearance
**Date sealed:** 2026-07-14

| Gate | Value |
|---|---|
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (unchanged) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged) |

| Closure status | Value |
|---|---|
| Design decision | **PASS WITH CORRECTION** |
| Migration `20261008000001_sem_gov_001b_lifecycle_persistence.sql` | **NOT APPLIED** |
| Reserved migration `20261010000001_sem_gov_001d_ui3_i4_fixture_display_metadata.sql` | **DESIGN ONLY — NOT AUTHORIZED TO APPLY** |
| `fixture_display_metadata` table | **NOT CREATED** |
| Persistence service | **NOT IMPLEMENTED** |
| UI3 read-model / UI4 | **NOT STARTED** / **BLOCKED** |

---

## A. Authority and start point

Stephen authorized SEM-GOV-001D-UI3-I4 read-only inspection and implementation-ready design authoring for D3 `public.fixture_display_metadata` and its future persistence service. This packet produces schema, service interface, transaction, security, and test design aligned with `lifecyclePersistenceService.js` conventions. **UI3-I4 authorizes no migration file creation, table creation, service implementation, EFI-001, purge runtime, UI3 route, or gate clearance.**

**Design decision:** **PASS WITH CORRECTION** — design is provable from UI3-I1/I2/I3, EST-001 D3 law, I4 persistence patterns, and EFI-001 provenance law; lifecycle migration remains **NOT APPLIED**, so FK apply order and production activation remain blocked until separate authorization.

**Start commit:** `1aca21fb95ed60dd6a767ad7b7ea9ce581be6458`

---

## B. Inspection evidence

| Inspection question | Finding |
|---|---|
| 1. Exact PostgreSQL columns and types | Derivable from UI3-I2 §G + UI3-I3 §G + EFI-001 provenance fields — see §D |
| 2. `fixture_uid` as PK and FK | **YES** — PK and FK to `fixture_lifecycle_current.fixture_uid` |
| 3. ON DELETE behaviour | **ON DELETE CASCADE** — D3 is replaceable derivative state; must not block lifecycle purge |
| 4. Required checks | Football-only `sport`; non-empty required strings; `timezone = Africa/Johannesburg`; `metadata_fresh_at` valid; `purge_eligible_at >= lifecycle_closed_at` when both set |
| 5. Justified indexes | PK; partial purge index; kickoff; competition_id for Hub filters |
| 6. Immutable vs replaceable upsert fields | Immutable: `fixture_uid`. Stable identity: scout/team ids. Replaceable: display fields + provenance on newer validated FIP |
| 7. EFI-001 provenance without FIP body | `fip_id`, `fip_schema_version`, `fip_validation_hash`, `intake_id`, `idempotency_key` — no `fip_body` column |
| 8. Idempotency and stale-update law | `idempotency_key = SHA-256(fip_id\|hash\|schema_version)`; same key → no-op; older `metadata_fresh_at` → reject |
| 9. `lifecycle_closed_at` / `purge_eligible_at` | Synced from lifecycle `archive_closed_at`; purge = closed + 30 days |
| 10. RLS / access | RLS enabled; no anon/authenticated policies; service-role backend only |
| 11. Future service factory/methods | Mirror I4 DI factory + gate-before-DB — see §K |
| 12. Migration order / tests | After I4 lifecycle tables; static SQL + mock service tests — see §P–§R |
| Lifecycle route mounted | **ABSENT** (UI3-I1 confirmed) |
| `fixture_display_metadata` exists | **ABSENT** |
| `fixtureDisplayMetadataPersistenceService.js` | **ABSENT** |
| D3 migration file | **ABSENT** |

---

## C. Scope

**In scope:** Proposed DDL design, column classification, constraints, indexes, FK law, upsert/idempotency law, EFI-001 boundary, retention timestamps, persistence service interface, transaction sequence, error contract, RLS design, resource limits, migration/rollback order, implementation file plan, test matrix, Control Center registration.

**Out of scope:** Migration authoring, migration apply, service code, EFI-001 implementation, purge job, UI3 read-model, UI4, gate clearance.

---

## D. Exact proposed table schema (design only)

**Reserved migration name:** `supabase/migrations/20261010000001_sem_gov_001d_ui3_i4_fixture_display_metadata.sql` (future — **not created in UI3-I4**)

```sql
CREATE TABLE IF NOT EXISTS public.fixture_display_metadata (
    fixture_uid UUID PRIMARY KEY,
    sport TEXT NOT NULL,

    -- INTERNAL / provenance (never public API)
    scout_fixture_id TEXT NOT NULL,
    fip_id TEXT NOT NULL,
    fip_schema_version TEXT NOT NULL,
    fip_validation_hash TEXT NOT NULL,
    intake_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    home_team_scout_id TEXT NOT NULL,
    away_team_scout_id TEXT NOT NULL,

    -- DISPLAY
    competition_id TEXT NOT NULL,
    competition_name TEXT NOT NULL,
    kickoff_at TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
    home_team_name TEXT NOT NULL,
    away_team_name TEXT NOT NULL,
    venue TEXT NULL,
    country TEXT NULL,
    home_team_emblem_ref TEXT NULL,
    away_team_emblem_ref TEXT NULL,
    metadata_fresh_at TIMESTAMPTZ NOT NULL,

    -- SYSTEM / AUDIT / RETENTION
    lifecycle_closed_at TIMESTAMPTZ NULL,
    purge_eligible_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fixture_display_metadata_fixture_fk
        FOREIGN KEY (fixture_uid)
        REFERENCES public.fixture_lifecycle_current (fixture_uid)
        ON DELETE CASCADE,

    CONSTRAINT fixture_display_metadata_sport_football_chk
        CHECK (sport = 'football'),

    CONSTRAINT fixture_display_metadata_timezone_chk
        CHECK (timezone = 'Africa/Johannesburg'),

    CONSTRAINT fixture_display_metadata_required_strings_chk
        CHECK (
            length(trim(scout_fixture_id)) > 0
            AND length(trim(fip_id)) > 0
            AND length(trim(fip_schema_version)) > 0
            AND length(trim(fip_validation_hash)) > 0
            AND length(trim(intake_id)) > 0
            AND length(trim(idempotency_key)) > 0
            AND length(trim(home_team_scout_id)) > 0
            AND length(trim(away_team_scout_id)) > 0
            AND length(trim(competition_id)) > 0
            AND length(trim(competition_name)) > 0
            AND length(trim(home_team_name)) > 0
            AND length(trim(away_team_name)) > 0
        ),

    CONSTRAINT fixture_display_metadata_optional_trim_chk
        CHECK (
            venue IS NULL OR length(trim(venue)) > 0
        AND country IS NULL OR length(trim(country)) > 0
        AND home_team_emblem_ref IS NULL OR length(trim(home_team_emblem_ref)) > 0
        AND away_team_emblem_ref IS NULL OR length(trim(away_team_emblem_ref)) > 0
        ),

    CONSTRAINT fixture_display_metadata_purge_order_chk
        CHECK (
            purge_eligible_at IS NULL
            OR lifecycle_closed_at IS NULL
            OR purge_eligible_at >= lifecycle_closed_at
        ),

    CONSTRAINT fixture_display_metadata_idempotency_unique
        UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_fixture_display_metadata_purge
    ON public.fixture_display_metadata (purge_eligible_at)
    WHERE purge_eligible_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fixture_display_metadata_kickoff
    ON public.fixture_display_metadata (kickoff_at);

CREATE INDEX IF NOT EXISTS idx_fixture_display_metadata_competition
    ON public.fixture_display_metadata (competition_id);

ALTER TABLE public.fixture_display_metadata ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated; backend service role only.
```

**Prohibited columns (must not appear):** `fip_body`, `raw_json`, `raw_fip`, `provider_payload`, `scout_payload`, `validation_hash` public exposure column without `_hash` internal naming only, metadata version history table, append-only event log.

---

## E. Column classification

| Column | Class | Mutable on upsert | Public API (via read-model) |
|---|---|---|---|
| `fixture_uid` | INTERNAL join key | No (PK) | No |
| `scout_fixture_id` | INTERNAL identity | Only if absent on insert | No |
| `fip_id`, `fip_schema_version`, `fip_validation_hash`, `intake_id`, `idempotency_key` | INTERNAL provenance | Replace on newer validated FIP | No |
| `home_team_scout_id`, `away_team_scout_id` | INTERNAL identity | Replace only with newer validated FIP | No |
| `sport`, `competition_*`, `kickoff_at`, `timezone`, team names, venue, country, emblem refs | DISPLAY | Yes | Yes (mapped labels) |
| `metadata_fresh_at` | DISPLAY freshness | Yes (monotonic forward) | Yes |
| `lifecycle_closed_at`, `purge_eligible_at` | SYSTEM retention | Yes (sync from lifecycle) | No |
| `created_at`, `updated_at` | SYSTEM audit | `updated_at` on each upsert | No |

---

## F. Foreign-key and deletion law

| Rule | Law |
|---|---|
| Parent table | `fixture_lifecycle_current` |
| FK column | `fixture_uid` (also PK) |
| ON DELETE | **CASCADE** |
| Rationale | D3 is derivative replaceable display state; deleting/purging lifecycle row must remove D3 without orphan rows or RESTRICT blocking lifecycle purge |
| Insert precondition | Parent `fixture_uid` row **must exist** before D3 upsert |
| Purge precondition | D3 row deleted by CASCADE when lifecycle row deleted, or by future purge job on `purge_eligible_at` |

---

## G. Idempotent upsert and stale-update law

### G.1 Idempotency key (EFI-001 / EST-001 aligned)

```text
idempotency_key = SHA-256(fip_id + "|" + fip_validation_hash + "|" + fip_schema_version)
```

| Event | Behaviour |
|---|---|
| No row for `fixture_uid` | INSERT |
| Row exists; same `idempotency_key` | **NO_OP** (return existing) |
| Row exists; different key; `metadata_fresh_at` incoming **>** stored | **REPLACE** display + provenance fields |
| Row exists; different key; incoming `metadata_fresh_at` **≤** stored | **REJECT** `DISPLAY_METADATA_STALE_UPDATE` |
| Hash mismatch with same key | **REJECT** `DISPLAY_METADATA_PROVENANCE_CONFLICT` |

### G.2 Immutable vs replaceable enforcement (service layer)

- **Never change** `fixture_uid` after insert.
- **Reject** upsert if parent lifecycle row missing (`DISPLAY_METADATA_LIFECYCLE_MISSING`).
- **Reject** forbidden payload keys (`fip_body`, `raw_json`, etc.) before DB (`DISPLAY_METADATA_INPUT_INVALID`).
- No append-only metadata history; no `metadata_version` counter column.

---

## H. EFI-001 intake boundary

D3 rows may be written **only** from a validated Scout FIP that has passed the future EFI-001 intake handshake. The persistence service accepts a **mapped DTO** produced by the intake adapter — never raw HTTP body or database Scout reads.

**Required intake DTO fields (minimum):**

`fixture_uid`, `fip_id`, `fip_schema_version`, `fip_validation_hash`, `intake_id`, `validated_at` (→ `metadata_fresh_at`), `scout_fixture_id`, `home_team_scout_id`, `away_team_scout_id`, `competition_id`, `competition_name`, `kickoff_at`, `home_team_name`, `away_team_name`, optional `venue`, `country`, `home_team_emblem_ref`, `away_team_emblem_ref`

**Prohibited at boundary:** full FIP JSON persistence, direct Scout DB query, `raw_fixtures`, provider/mock fallback.

---

## I. Retention and purge timestamp law

| Field | Population law |
|---|---|
| `lifecycle_closed_at` | Set when lifecycle projection records archive/closure — sync from `fixture_lifecycle_current.archive_closed_at` via `synchronizeRetentionFromLifecycle()` |
| `purge_eligible_at` | When `lifecycle_closed_at` set: `lifecycle_closed_at + 30 days` (SAST-agnostic TIMESTAMPTZ arithmetic); NULL while fixture active |
| Active window | Row upsertable while lifecycle not archived |
| Purge execution | Future governed purge job deletes where `purge_eligible_at <= now()` — **not implemented in UI3-I4** |
| 180-day D3 retention | **PROHIBITED** |
| Metadata version history | **PROHIBITED** |

---

## J. RLS and security design

| Control | Design |
|---|---|
| RLS | `ENABLE ROW LEVEL SECURITY` on `fixture_display_metadata` |
| Policies | **None** for `anon` / `authenticated` Supabase roles |
| Access path | Backend service role via `fixtureDisplayMetadataPersistenceService` only |
| Public API | Future UI3 read-model service maps columns; never exposes provenance hash, scout ids, or `fixture_uid` |
| Direct PostgREST exposure | **FORBIDDEN** |

---

## K. Persistence-service interface design (future)

**File (future):** `backend/services/fixtureDisplayMetadataPersistenceService.js`

**Factory:**

```text
createFixtureDisplayMetadataPersistenceService({
  db,
  gateReader,
  governor,
  featureFlagEnabled,
  clock,
  refreshGate?
})
```

**Orchestration methods (public):**

| Method | Purpose |
|---|---|
| `upsertFromValidatedIntake(dto)` | Gate → validate DTO → verify lifecycle row exists → idempotency/stale law → upsert in transaction |
| `synchronizeRetentionFromLifecycle({ fixtureUid, lifecycleClosedAt })` | Set `lifecycle_closed_at` and `purge_eligible_at` from lifecycle closure event |
| `getByFixtureUid(fixtureUid)` | Internal read for read-model adapter (explicit column list) |

**Low-level methods (transaction client, exported for tests):**

`loadByFixtureUid`, `loadByIdempotencyKey`, `insertRow`, `replaceRow`, `updateRetentionTimestamps`

**Gate-before-database law:** Steps 1–4 (gate, feature flag, DTO validation, forbidden-field scan) complete with **zero** `query` / `withTransaction` calls — same pattern as `lifecyclePersistenceService.evaluatePreDbGate()`.

---

## L. Transaction sequence

### L.1 Upsert sequence

1. `evaluatePreDbGate()` — no DB
2. Validate DTO + reject forbidden fields — no DB
3. `withTransaction`:
   - `SELECT` lifecycle row exists for `fixture_uid` — else `DISPLAY_METADATA_LIFECYCLE_MISSING`
   - `SELECT` existing D3 row by `fixture_uid`
   - Apply idempotency / stale-update law
   - `INSERT` or `UPDATE` with explicit column list
   - Commit atomically

### L.2 Retention sync sequence

1. Gate — no DB
2. `withTransaction`: load D3 row → set `lifecycle_closed_at`, `purge_eligible_at = closed + 30d` → update `updated_at`

---

## M. Domain error contract

| Code | Condition |
|---|---|
| `DISPLAY_METADATA_GATE_BLOCKED` | Governance gate blocked |
| `DISPLAY_METADATA_FEATURE_DISABLED` | Feature flag off |
| `DISPLAY_METADATA_INPUT_INVALID` | DTO validation or forbidden field |
| `DISPLAY_METADATA_LIFECYCLE_MISSING` | No parent lifecycle row |
| `DISPLAY_METADATA_NOT_FOUND` | Read by unknown `fixture_uid` |
| `DISPLAY_METADATA_STALE_UPDATE` | Incoming FIP older than stored freshness |
| `DISPLAY_METADATA_PROVENANCE_CONFLICT` | Same idempotency key, different hash |
| `DISPLAY_METADATA_IDEMPOTENCY_DUPLICATE` | Duplicate key race (unique violation) |
| `DISPLAY_METADATA_PURGE_TIMESTAMP_INVALID` | `purge_eligible_at` before `lifecycle_closed_at` |
| `DISPLAY_METADATA_PERSISTENCE_UNAVAILABLE` | DB error |

No raw SQL or constraint names exposed to callers.

---

## N. Resource and query limits

- Explicit column lists on all `SELECT`/`INSERT`/`UPDATE` — no `SELECT *`
- Upsert path: bounded **≤ 4** queries per transaction (lifecycle check, load existing, write, optional idempotency lookup)
- Pool max **10** unchanged (existing `db.js` law)
- Row width bounded by CHECK + no JSONB payload columns
- D3 steady-state ceiling **≈ 1,900** rows per UI3-I3 capacity model

---

## O. Migration and rollback sequence

### O.1 Apply order (future authorization only)

1. `20261008000001_sem_gov_001b_lifecycle_persistence.sql` — **must be applied first**
2. `20261010000001_sem_gov_001d_ui3_i4_fixture_display_metadata.sql` — D3 table only

### O.2 Rollback order

1. `DROP TABLE IF EXISTS public.fixture_display_metadata;`
2. Lifecycle tables unchanged

### O.3 Non-execution boundary

UI3-I4 seals design only. No `supabase db push`, no apply script, no production credentials.

---

## P. Implementation file plan (future packet)

| File | Action |
|---|---|
| `supabase/migrations/20261010000001_sem_gov_001d_ui3_i4_fixture_display_metadata.sql` | CREATE (future) |
| `backend/services/fixtureDisplayMetadataPersistenceService.js` | CREATE (future) |
| `tests/fixture-display-metadata-persistence-service.test.js` | CREATE (future) |
| `lifecyclePersistenceService.js` | **DO NOT MODIFY** in UI3-I4 implementation packet without separate authorization |
| `public/` | **PROHIBITED** |

---

## Q. Test matrix (future)

| Test | Asserts |
|---|---|
| Gate blocked → zero DB calls | Gate-before-DB |
| Forbidden `fip_body` in DTO → reject | Input law |
| Missing lifecycle row → `LIFECYCLE_MISSING` | FK precondition |
| Same idempotency key → NO_OP | Idempotency |
| Newer FIP → replace display fields | Upsert law |
| Older FIP → `STALE_UPDATE` | Stale law |
| Retention sync sets purge +30d | Retention law |
| Migration static SQL contains CHECK, FK CASCADE, RLS | Schema design |
| No migration file exists until implementation packet | UI3-I4 guard |

---

## R. Prohibited work in UI3-I4

- Create or edit Supabase migration SQL
- Create `fixture_display_metadata` table
- Implement persistence service or EFI-001
- Implement purge job or UI3 route
- Modify `backend/services/lifecyclePersistenceService.js`
- Modify `public/` or clear gates
- Apply any migration

---

## S. Deferred work

| Item | Status |
|---|---|
| UI3-I4 implementation packet (migration + service) | **NOT STARTED** |
| Lifecycle migration apply | **NOT APPLIED** |
| EFI-001 intake adapter | **NOT STARTED** |
| D3 purge job | **NOT STARTED** |
| UI3 read-model service | **BLOCKED** |
| UI4 live integration | **NOT STARTED** |
| `public_fixture_id` resolver | **BLOCKED** |
| Gate clearance | **BLOCKED** |

---

## T. Definition of Done — SEM-GOV-001D-UI3-I4

- [x] Read-only inspection evidence recorded
- [x] Design decision **PASS WITH CORRECTION** sealed
- [x] Exact proposed schema documented
- [x] Column classification, constraints, indexes documented
- [x] FK CASCADE and deletion law documented
- [x] Upsert, idempotency, stale-update law documented
- [x] EFI-001 boundary and provenance fields documented
- [x] Retention timestamp law documented
- [x] Persistence service interface and transaction sequence documented
- [x] Domain errors, RLS, resource limits documented
- [x] Migration/rollback order documented
- [x] Test matrix and prohibited work documented
- [x] Control Center registration
- [x] Packet guard test passes
- [ ] Migration file — **NOT CREATED**
- [ ] Persistence service — **NOT IMPLEMENTED**

---

## U. Proof commands

```text
npm run test:sem-gov-001d-ui3-i4
npm run test:sem-gov-001d-ui3-i3
npm run test:sem-gov-001d-ui3-i2
npm run test:sem-gov-001d-ui3-i1
npm run control:center
npm run control:projects
npm run verify:rulebook
```
