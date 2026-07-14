# SEM-GOV-001D-UI3-I5 — Source B Migration and Isolated Persistence Implementation Packet v1

**Packet ID:** `SEM-GOV-001D-UI3-I5`
**Parent programme:** `SEM-GOV-001` — Unified Sports Intelligence Lifecycle
**Parent mini-project:** `SEM-GOV-001D` — Football Sports Match Hub fixture-first UI
**Controlling contracts:** `SEM-GOV-001D-UI3-I4`, `SEM-GOV-001D-UI3-I3`, `SEM-GOV-001D-UI3-I2`, `SEM-GOV-001D-UI3-I1`, `EST-001`, `SEM-GOV-001B-I4`
**Start commit:** `36aa28c35751dba628751f70721ba34ddc7ac694`
**Mode:** Scoped isolated implementation — migration authored and service implemented; **migration NOT APPLIED**; **no production caller**
**Date sealed:** 2026-07-14

| Gate | Value |
|---|---|
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (unchanged — migration not applied) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged — no production caller) |

| Closure status | Value |
|---|---|
| Implementation decision | **PASS WITH CORRECTION** |
| Migration `20261010000001_sem_gov_001d_ui3_i4_fixture_display_metadata.sql` | **TESTED STATICALLY / NOT APPLIED** |
| Lifecycle migration `20261008000001_sem_gov_001b_lifecycle_persistence.sql` | **NOT APPLIED** |
| Persistence service | **IMPLEMENTED (isolated)** |
| Production caller / UI3 read model | **NOT IMPLEMENTED** |

---

## A. Authority and start HEAD

Stephen authorized SEM-GOV-001D-UI3-I5 scoped implementation: D3 migration SQL authoring, isolated `fixtureDisplayMetadataPersistenceService`, mock-first tests, and Control Center registration. **No migration apply, no production route, no gate clearance.**

**Start commit:** `36aa28c35751dba628751f70721ba34ddc7ac694`

---

## B. Scope and prohibited work

**In scope:** One D3 migration file, persistence service, mock-first tests, I5 packet, governance registration.

**Prohibited:** `supabase db push`; SQL execution; production credentials; EFI-001; routes/controllers; purge deletion; UI3 read model; `public/` changes; gate clearance; dependency updates (GitHub vulnerability warning recorded as FUTURE_SECURITY_NOTE only).

---

## C. Inspection evidence

| Check | Result |
|---|---|
| Start HEAD | `36aa28c35751dba628751f70721ba34ddc7ac694` |
| Working tree | Clean except untracked `evidence/` and `evidence-home1-scratch/` |
| UI3-I4 packet | **TESTED** — SQL block is schema authority |
| Lifecycle migration | **NOT APPLIED** |
| Pre-existing D3 artifacts | **ABSENT** before I5 |
| `lifecyclePersistenceService.js` | **UNMODIFIED** |

---

## D. Factual schema column count (PASS WITH CORRECTION)

UI3-I4 narrative text references a **22-column** design (logical field groups). The sealed I4 SQL block defines **25 physical columns**:

1. `fixture_uid` 2. `sport` 3. `scout_fixture_id` 4. `fip_id` 5. `fip_schema_version` 6. `fip_validation_hash` 7. `intake_id` 8. `idempotency_key` 9. `home_team_scout_id` 10. `away_team_scout_id` 11. `competition_id` 12. `competition_name` 13. `kickoff_at` 14. `timezone` 15. `home_team_name` 16. `away_team_name` 17. `venue` 18. `country` 19. `home_team_emblem_ref` 20. `away_team_emblem_ref` 21. `metadata_fresh_at` 22. `lifecycle_closed_at` 23. `purge_eligible_at` 24. `created_at` 25. `updated_at`

**I5 implements all 25 physical columns exactly.** No columns removed to match the 22 narrative count.

---

## E. Exact files implemented

| File | Role |
|---|---|
| `supabase/migrations/20261010000001_sem_gov_001d_ui3_i4_fixture_display_metadata.sql` | D3 DDL (not applied) |
| `backend/services/fixtureDisplayMetadataPersistenceService.js` | Isolated persistence service |
| `tests/fixture-display-metadata-persistence-service.test.js` | Mock-first service + SQL tests |
| `control-center/SEM-GOV-001D-UI3-I5_SOURCE_B_MIGRATION_AND_ISOLATED_PERSISTENCE_IMPLEMENTATION_PACKET.v1.md` | This packet |
| `tests/sem-gov-001d-ui3-i5-implementation-packet.test.js` | Packet guard test |

---

## F. Migration constraints and indexes

- FK `fixture_uid` → `fixture_lifecycle_current(fixture_uid)` **ON DELETE CASCADE**
- CHECK `sport = 'football'`
- CHECK `timezone = 'Africa/Johannesburg'`
- Required string non-empty CHECK
- Optional NULL-or-trimmed-non-empty CHECK
- `purge_eligible_at >= lifecycle_closed_at` when both set
- UNIQUE `idempotency_key`
- Indexes: partial `purge_eligible_at`, `kickoff_at`, `competition_id`
- PK implicit on `fixture_uid`

---

## G. Security and RLS result

- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- **No** `CREATE POLICY` for anon or authenticated roles
- No JSONB / full FIP / raw payload columns
- Manual rollback comment: `DROP TABLE IF EXISTS public.fixture_display_metadata;`

---

## H. Service factory and interface

```text
createFixtureDisplayMetadataPersistenceService({
  db, gateReader, governor, featureFlagEnabled, clock, refreshGate?
})
```

**Exports:** `DOMAIN_CODES`, `FORBIDDEN_PERSISTENCE_FIELDS`, `buildDisplayMetadataIdempotencyKey`, factory, low-level `loadByFixtureUid`, `insertRow`, `replaceRow`.

**Public methods:** `upsertFromValidatedIntake(dto)`, `synchronizeRetentionFromLifecycle({ fixtureUid, lifecycleClosedAt })`, `getByFixtureUid(fixtureUid)`.

---

## I. Gate-before-database proof

Governance gate and feature flag evaluated via `governor.evaluateGovernorGate()` **before** any `withTransaction` or `query` call. Blocked gate, disabled feature, forbidden fields, and invalid DTO all return domain codes with **zero** database calls (proven in tests).

---

## J. Validation and forbidden-field law

Football-only; fixed timezone; valid UUID `fixture_uid`; valid timestamps; required strings non-empty; optional strings normalized to NULL or trimmed non-empty. Forbidden keys rejected pre-DB: `fip_body`, `fip_json`, `raw_json`, `raw_fip`, `validated_fip`, `scout_payload`, `provider_payload`, `raw_provider`, `evidence_archive`.

Deterministic idempotency key:

```text
SHA-256(fip_id + "|" + fip_validation_hash + "|" + fip_schema_version)
```

Incoming `idempotencyKey` must match computed value when supplied.

---

## K. Transaction and idempotency behaviour

1. Verify `fixture_lifecycle_current` parent exists — else `DISPLAY_METADATA_LIFECYCLE_MISSING`
2. Load existing row by `fixture_uid`
3. No row → INSERT
4. Same deterministic key + matching provenance → NO_OP
5. Same key + provenance mismatch → `DISPLAY_METADATA_PROVENANCE_CONFLICT`
6. Different key + newer `metadata_fresh_at` → UPDATE replaceable fields
7. Different key + equal/older freshness → `DISPLAY_METADATA_STALE_UPDATE`

Explicit column lists only; no `SELECT *`; no metadata history table.

---

## L. Retention synchronization behaviour

- Requires valid `lifecycleClosedAt` timestamp — **NULL rejected** (no reopening law in I4)
- Sets `lifecycle_closed_at` from supplied closure timestamp
- Sets `purge_eligible_at = lifecycle_closed_at + 30 days`
- No purge deletion implementation

---

## M. Domain error mapping

All ten I4 domain codes implemented. No raw SQL, constraint names, or database messages exposed to callers.

---

## N. Resource and query limits

Upsert path bounded to **≤ 4** queries per transaction (parent check, load, write). Explicit column lists on all SQL.

---

## O. Migration non-execution boundary

Migration file is **AUTHOR ONLY**. No `supabase db push`, no apply script, no production credentials. Lifecycle parent migration also **NOT APPLIED**.

---

## P. Rollback design

Manual rollback (commented in migration):

```sql
DROP TABLE IF EXISTS public.fixture_display_metadata;
```

Apply order when separately authorized: lifecycle migration first, then D3 migration.

---

## Q. Test matrix and results

| Test area | Status |
|---|---|
| Factory dependency guards | PASS |
| Gate-before-DB (blocked/disabled/forbidden/invalid) | PASS |
| Idempotency SHA-256 | PASS |
| Upsert insert / NO_OP / conflict / stale / update | PASS |
| Retention +30d sync | PASS |
| NOT_FOUND / LIFECYCLE_MISSING | PASS |
| SQL static structure | PASS |
| Query bound ≤ 4 | PASS |

Run: `npm run test:sem-gov-001d-ui3-i5`

---

## R. Deferred work

| Item | Status |
|---|---|
| Migration apply | **BLOCKED** (`supabase_storage_gate`) |
| Lifecycle migration apply | **NOT APPLIED** |
| EFI-001 intake adapter | **NOT STARTED** |
| D3 purge deletion job | **NOT STARTED** |
| UI3 read-model service / route | **BLOCKED** |
| Production caller wiring | **PROHIBITED** |
| Gate clearance | **BLOCKED** |

---

## S. FUTURE_SECURITY_NOTE

GitHub dependency vulnerability advisories may exist on the workspace `package.json` tree. **I5 does not update dependencies.** Address under separate security governance.

---

## T. Definition of Done — SEM-GOV-001D-UI3-I5

- [x] Pre-change inspection recorded
- [x] Migration SQL authored with 25-column schema
- [x] Persistence service implemented in isolation
- [x] Mock-first tests pass
- [x] Packet guard test passes
- [x] Control Center registration
- [x] Migration **NOT APPLIED**
- [x] No production caller
- [x] All three gates **BLOCKED**
- [ ] UI3 read model — **NOT STARTED**

---

## U. Proof commands

```text
npm run test:sem-gov-001d-ui3-i5
npm run test:sem-gov-001d-ui3-i4
npm run test:sem-gov-001d-ui3-i3
npm run test:sem-gov-001d-ui3-i2
npm run test:sem-gov-001d-ui3-i1
npm run control:center
npm run control:projects
npm run verify:rulebook
```
