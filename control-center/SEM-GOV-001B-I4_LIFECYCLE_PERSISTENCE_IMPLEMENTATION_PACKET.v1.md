# SEM-GOV-001B-I4 — Lifecycle Persistence Implementation Packet v1

**Packet ID:** `SEM-GOV-001B-I4`
**Parent programme:** `SEM-GOV-001` — Unified Sports Intelligence Lifecycle
**Controlling contracts:** `SEM-GOV-001B_FOOTBALL_LIFECYCLE_PERSISTENCE_CONTRACT.v1`, `SEM-GOV-001B-I4_CAP2_DAILY_ADMISSION_LIMIT_DESIGN.v1`, `SEM-GOV-001B-I4_SUPABASE_FREE_TIER_CAPACITY_AND_RETENTION_DESIGN.v1`, `EST-001_SUPABASE_STORAGE_AND_FIP_RETENTION_CONTRACT.v1`
**Start commit:** `1f87a1ab7bb9b5b32b44906662768c827b7eb2cc`
**Mode:** Implementation — isolated persistence foundation (migration **NOT APPLIED**)
**Date sealed:** 2026-07-14

| Gate | Value |
|---|---|
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (unchanged — migration not applied) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged — no production caller) |

| Closure status | Value |
|---|---|
| Implementation foundation | **TESTED** |
| Migration authoring | **TESTED STATICALLY / NOT APPLIED** |
| Production activation | **BLOCKED** |

---

## A. Authority and status

Stephen authorized scoped SEM-GOV-001B-I4 implementation: persistence service, migration SQL authoring, mock-first tests, Control Center registration. **Supabase migration apply is explicitly prohibited** until separate `supabase_storage_gate` clearance.

---

## B. Start point

**Start commit:** `1f87a1ab7bb9b5b32b44906662768c827b7eb2cc`

---

## C. Scope

**In scope:**

- `backend/services/lifecyclePersistenceService.js` with DI factory
- `supabase/migrations/20261008000001_sem_gov_001b_lifecycle_persistence.sql` (authored only)
- `tests/lifecycle-persistence-service.test.js` (mock-first)
- Packet guard test and Control Center registration

**Out of scope:**

- Migration apply; purge service (I4-PURGE); rollover worker (I5); SEM-GOV-001C; production routes; gate clearance

---

## D. Controlling contracts

- SEM-GOV-001B persistence contract (tables, transitions, idempotency)
- SEM-GOV-001B-I4-CAP / CAP2 (capacity, 50/day, durable idempotency, gate-before-DB)
- SEM-GOV-001B-I3 `lifecycleGovernor.js` (pure evaluators — not modified)
- EST-001 forbidden Scout payload storage

---

## E. Supabase Free-Tier supremacy

- Baseline **167 MB**; CAP2 projected **357.10 MB** at 50/day steady state
- Activation ceiling **380 MB**; hard block **400 MB**
- **50** admissions/day SAST; **180-day** transition retention; counter retention **365 days**
- No paid-plan assumption; no full FIP body storage

---

## F. Allowed files

See Control Center registration. Core runtime: `lifecyclePersistenceService.js`, migration SQL, tests, this packet.

---

## G. Prohibited files

`lifecycleGovernor.js`, `db.js`, `database.js`, `dbBootstrap.js`, pipeline services, routes, `public/`, existing migrations, prediction/publication tables, I5 worker, purge service.

---

## H. Exact six-table schema

Implemented in migration `20261008000001_sem_gov_001b_lifecycle_persistence.sql`:

1. `fixture_lifecycle_current` — PK `fixture_uid`; includes `archive_closed_at`
2. `fixture_identity_aliases` — PK `alias_id`; UNIQUE `(alias_namespace, alias_value)`
3. `fixture_lifecycle_transition_events` — UNIQUE `(fixture_uid, idempotency_key)` and `(fixture_uid, transition_version)`
4. `fixture_lifecycle_rollover_events` — UNIQUE `rollover_key` (storage only)
5. `lifecycle_daily_admission_counters` — PK `admission_date_sast`; `ceiling <= 50`
6. `lifecycle_admission_idempotency` — PK `admission_idempotency_key` (durable dedup authority)

---

## I. Exact indexes and constraints

As defined in migration: funnel index, kickoff index, partial active-state index, alias fixture index, partial `archive_closed_at` index, governed CHECK constraints on states/stages/day labels, counter ceiling checks.

---

## J. Persistence service public interface

Factory: `createLifecyclePersistenceService({ db, governor, gateReader, featureFlagEnabled, uuidGenerator, clock, admissionCeiling? })`

Orchestration: `admitFixture(input)`, `applyTransition(input)`

Low-level (require transaction client): alias/idempotency/counter/transition/rollover methods exported for tests and future adapters.

---

## K. Gate-before-database law

Steps 1–4 (gate, flag, pure validation) complete with **zero** `withTransaction`, `query`, or `pool.connect()` calls.

---

## L. Admission transaction sequence

Per CAP2 §I: alias resolution → durable idempotency → counter lock → ceiling check → current + alias + event + idempotency insert → counter increment → commit atomically.

---

## M. Transition transaction sequence

Gate/flag → pure `evaluateTransition` → load current → append event → optimistic projection update → commit atomically.

---

## N. Durable idempotency law

`lifecycle_admission_idempotency.admission_idempotency_key` is UNIQUE dedup authority. `last_idempotency_key` on counter is audit-only. Alias lookup precedes slot consumption.

---

## O. Daily admission-cap law

Ceiling **50** (schema CHECK + service rejection above 50). `DAILY_ADMISSION_CAP_REACHED` at ceiling. Conditional counter increment in same transaction.

---

## P. Error contract

Domain codes only — no raw SQL exposure. See service `DOMAIN_CODES` export.

---

## Q. Resource and query limits

Explicit column lists; no `SELECT *` on hot paths; admission query count bounded in tests; pool max **10** unchanged; rollover snapshot max **2048** UTF-8 bytes enforced in service.

---

## R. Migration non-execution boundary

Migration file is **authored and statically tested only**. No `supabase db push`, no SQL against production credentials, no automated apply script in `package.json`.

---

## S. Rollback design

Commented `DROP TABLE` section in migration (FK-safe order). Application rollback: do not deploy callers; gates remain BLOCKED.

---

## T. Test matrix

`tests/lifecycle-persistence-service.test.js` — gate zero-DB, admission cap 50/51, alias/idempotency reuse, rollback, transitions, rollover storage, migration static checks.

---

## U. Deferred work

- **I4-PURGE** — bounded retention deletion
- **I5** — rollover worker
- **SEM-GOV-001C** — pipeline integration
- **supabase_storage_gate** clearance — required before migration apply

---

## V. Definition of Done — SEM-GOV-001B-I4

- [x] Implementation packet sealed
- [x] `lifecyclePersistenceService.js` exists
- [x] Migration defines six tables only
- [x] Migration **not applied**
- [x] Mock-first tests pass
- [x] Gate rejection causes zero DB calls
- [x] Admission 50/51 and alias/idempotency laws tested
- [x] No prediction/publication writes; no production caller
- [x] All three gates remain **BLOCKED**
- [ ] Migration apply — **explicitly prohibited in this packet**
- [ ] Gate clearance — **separate authorization**
