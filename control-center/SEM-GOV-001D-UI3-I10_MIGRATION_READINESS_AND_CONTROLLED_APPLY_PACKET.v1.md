# SEM-GOV-001D-UI3-I10 — Migration Readiness and Controlled Apply Packet

| Field | Value |
|---|---|
| Packet ID | SEM-GOV-001D-UI3-I10 |
| Start HEAD | `bf12011b21dfd6172b8f64c64f3a01d7ac653f88` |
| Mode | Readiness only — Gate A inspection; Gate B apply **NOT EXECUTED** |
| Gate A decision | **PASS** |
| Gate B decision | **HOLD** (apply deferred — separate authorization required) |
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (unchanged) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged) |

---

## A. Authority and start HEAD

- **Controlling contracts:** `SEM-GOV-001B-I4_LIFECYCLE_PERSISTENCE_IMPLEMENTATION_PACKET.v1.md`, `SEM-GOV-001D-UI3-I5_SOURCE_B_MIGRATION_AND_ISOLATED_PERSISTENCE_IMPLEMENTATION_PACKET.v1.md`, `SEM-GOV-001D-UI3-I8_DURABLE_INTAKE_EVIDENCE_STORAGE_IMPLEMENTATION_PACKET.v1.md`, `EST-001_SUPABASE_STORAGE_AND_FIP_RETENTION_CONTRACT.v1.md`
- **Start HEAD:** `bf12011b21dfd6172b8f64c64f3a01d7ac653f88`

---

## B. Two-gate law

| Gate | Scope | Result |
|---|---|---|
| **Gate A** | Static migration inspection + read-only live Supabase snapshot | **PASS** |
| **Gate B** | Controlled migration apply | **HOLD** — not executed in I10 closure |

Gate B may proceed only after explicit human authorization, `supabase_storage_gate` clearance, and successful backup confirmation.

---

## C. Files implemented

### Created
- `scripts/check-ui3-i10-migration-readiness.js`
- `tests/sem-gov-001d-ui3-i10-migration-readiness.test.js`
- `reports/ui3-i10/migration-readiness.json`
- `control-center/SEM-GOV-001D-UI3-I10_MIGRATION_READINESS_AND_CONTROLLED_APPLY_PACKET.v1.md`
- `tests/sem-gov-001d-ui3-i10-implementation-packet.test.js`

### Modified (proven correction)
- `supabase/migrations/20261008000001_sem_gov_001b_lifecycle_persistence.sql` — RLS enabled on all six lifecycle tables

### Unchanged boundary
- No routes, no feature-flag enablement, no production caller, no Scout traffic, no migration apply

---

## D. Migration order (sealed)

1. `20261008000001` — lifecycle (6 tables)
2. `20261010000001` — D3 `fixture_display_metadata` (1 table)
3. `20261011000001` — R2 `fip_intake_evidence` (1 table)

**Total target tables:** 8

---

## E. Lifecycle RLS correction

**Finding:** Initial static inspection reported `RLS_NOT_ENABLED_IN_MIGRATION` on all six lifecycle tables.

**Authorization:** SEM-GOV-001B-I4 seals gate-before-database backend-only persistence via `lifecyclePersistenceService` with no production caller while gates remain BLOCKED — same security model as UI3-I5 D3 migration (RLS enabled, no anon/authenticated policies, service-role backend only).

**Correction applied:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on all six lifecycle tables. No `CREATE POLICY` statements added.

---

## F. Static readiness result

| Check | Result |
|---|---|
| CREATE TABLE count per migration | PASS |
| Expected tables present | PASS |
| RLS enabled in migration SQL | PASS (after lifecycle correction) |
| No destructive SQL (non-comment) | PASS |
| Migration SHA-256 hashes recorded | PASS |

Static blockers after correction: **0**

---

## G. Live read-only inspection result

| Metric | Value |
|---|---|
| Inspected | **true** |
| Database size | **152,095,891 bytes** (~145.0 MB) |
| `pgcrypto` installed | **true** |
| `supabase_migrations.schema_migrations` exists | **true** |
| Target migration versions already recorded | **none** |
| Target table collisions | **none** (8 tables absent) |
| Credentials in report | **redacted** (host/port/database only) |

Live blockers: **0**

Readiness report: `reports/ui3-i10/migration-readiness.json`

---

## H. Capacity note

Current database **~145 MB** against EST-001 / CAP2 **380 MB** activation ceiling leaves headroom for eight new governed tables. Full post-apply capacity proof requires apply + row growth monitoring (deferred).

---

## I. Proposed migration-apply command (NOT EXECUTED)

```powershell
node scripts/run-migration.js `
  supabase/migrations/20261008000001_sem_gov_001b_lifecycle_persistence.sql `
  supabase/migrations/20261010000001_sem_gov_001d_ui3_i4_fixture_display_metadata.sql `
  supabase/migrations/20261011000001_sem_gov_001d_ui3_i8_fip_intake_evidence.sql
```

**Pre-apply checklist (Gate B):**
1. Confirm `supabase_storage_gate` clearance
2. Confirm backup snapshot
3. Re-run `node scripts/check-ui3-i10-migration-readiness.js` with `DATABASE_URL` set
4. Verify decision remains `PASS`
5. Apply in sealed order only
6. Re-run readiness checker post-apply to confirm tables + migration history

---

## J. Test matrix and results

| Suite | Result |
|---|---|
| `npm run test:sem-gov-001d-ui3-i10` | PASS (8 tests) |
| `npm run test:sem-gov-001d-ui3-i9` through `i1` | PASS |
| `npm run control:center` | PASS |
| `npm run control:projects` | PASS |
| `npm run verify:rulebook` | PASS |

---

## K. Prohibited work (deferred)

- Migration apply (Gate B)
- HTTP route
- Scout FIP traffic
- Production intake activation
- Feature flag enablement
- Gate clearance

---

## L. FUTURE_SECURITY_NOTE

Five GitHub Dependabot dependency vulnerabilities remain recorded for future remediation. Not addressed in I10 scope.

---

## M. Definition of Done

- [x] Readiness checker installed
- [x] Static tests pass
- [x] Read-only live inspection complete
- [x] Lifecycle RLS correction applied
- [x] Readiness report written
- [x] No migration apply
- [x] All gates remain BLOCKED

---

## N. Inspection decision

**PASS WITH CORRECTION** (Gate A readiness)

Corrections: lifecycle migration RLS enabled to align with backend-only service-role security precedent.

Gate B controlled apply remains **HOLD** until separate authorization.
