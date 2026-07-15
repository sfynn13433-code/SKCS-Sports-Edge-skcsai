# SEM-GOV-001D-UI3-I10 — Migration Readiness and Controlled Apply Packet

| Field | Value |
|---|---|
| Packet ID | SEM-GOV-001D-UI3-I10 |
| Gate A start HEAD | `21e436da4ff16946519d8a6842b99bf7ae684328` |
| Gate B start HEAD | `21e436da4ff16946519d8a6842b99bf7ae684328` |
| Gate B-C1 start HEAD | `e85a27ed115eced51eb77010494ede67dfa777bb` |
| Mode | Gate A readiness + Gate B controlled schema apply + Gate B-C1 migration history reconciliation |
| Gate A decision | **PASS** |
| Gate B apply decision | **PASS WITH CORRECTION** |
| Gate B-C1 decision | **PASS WITH DOCUMENTED PRE-EXISTING GOVERNANCE EXCEPTION** |
| Gate B formal closure | **PASS** |
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (schema exists; runtime writes prohibited — no `CLEARED_FOR_SCHEMA_ONLY` enum) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged) |

---

## A. Authority and start HEAD

- **Controlling contracts:** `SEM-GOV-001B-I4_LIFECYCLE_PERSISTENCE_IMPLEMENTATION_PACKET.v1.md`, `SEM-GOV-001D-UI3-I5_SOURCE_B_MIGRATION_AND_ISOLATED_PERSISTENCE_IMPLEMENTATION_PACKET.v1.md`, `SEM-GOV-001D-UI3-I8_DURABLE_INTAKE_EVIDENCE_STORAGE_IMPLEMENTATION_PACKET.v1.md`, `EST-001_SUPABASE_STORAGE_AND_FIP_RETENTION_CONTRACT.v1.md`
- **Gate A start HEAD:** `21e436da4ff16946519d8a6842b99bf7ae684328`
- **Gate B start HEAD:** `21e436da4ff16946519d8a6842b99bf7ae684328`
- **Gate B-C1 start HEAD:** `e85a27ed115eced51eb77010494ede67dfa777bb`

---

## B. Two-gate law

| Gate | Scope | Result |
|---|---|---|
| **Gate A** | Static migration inspection + read-only live Supabase snapshot | **PASS** |
| **Gate B** | Atomic controlled migration apply (schema only) | **PASS WITH CORRECTION** |
| **Gate B-C1** | Migration history reconciliation (credential-free; no schema reapply) | **PASS WITH DOCUMENTED PRE-EXISTING GOVERNANCE EXCEPTION** |
| **Gate B formal** | Gate B apply + Gate B-C1 reconciliation complete | **PASS** |

Runtime activation remains prohibited. Gate B applied DDL only. Gate B-C1 repaired remote migration history only.

---

## C. Files implemented

### Created (Gate A)
- `scripts/check-ui3-i10-migration-readiness.js`
- `tests/sem-gov-001d-ui3-i10-migration-readiness.test.js`
- `reports/ui3-i10/migration-readiness.json`
- `control-center/SEM-GOV-001D-UI3-I10_MIGRATION_READINESS_AND_CONTROLLED_APPLY_PACKET.v1.md`
- `tests/sem-gov-001d-ui3-i10-implementation-packet.test.js`

### Created (Gate B)
- `scripts/apply-ui3-i10-controlled-migrations.js`
- `tests/sem-gov-001d-ui3-i10-controlled-apply.test.js`
- `reports/ui3-i10/pre-apply-schema-snapshot.json`
- `reports/ui3-i10/post-apply-schema-snapshot.json`
- `reports/ui3-i10/controlled-apply-result.json`

### Created (Gate B-C1)
- `reports/ui3-i10/migration-history-reconciliation.json`

### Modified (proven corrections)
- `supabase/migrations/20261008000001_sem_gov_001b_lifecycle_persistence.sql` — RLS enabled on all six lifecycle tables (Gate A)
- `scripts/apply-ui3-i10-controlled-migrations.js` — pooler session port normalization + pgcrypto strip at apply time (Gate B)
- `package.json` — `test:sem-gov-001d-ui3-i10-apply`

### Unchanged boundary
- No HTTP route, no feature-flag enablement, no production caller, no Scout traffic, no lifecycle admission, no seeded rows

---

## D. Migration order (sealed)

1. `20261008000001` — lifecycle (6 tables)
2. `20261010000001` — D3 `fixture_display_metadata` (1 table)
3. `20261011000001` — R2 `fip_intake_evidence` (1 table)

**Total target tables:** 8

---

## E. Lifecycle RLS correction (Gate A)

**Finding:** Initial static inspection reported `RLS_NOT_ENABLED_IN_MIGRATION` on all six lifecycle tables.

**Correction applied:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on all six lifecycle tables. No `CREATE POLICY` statements added.

---

## F. Static readiness result (Gate A)

| Check | Result |
|---|---|
| CREATE TABLE count per migration | PASS |
| Expected tables present | PASS |
| RLS enabled in migration SQL | PASS (after lifecycle correction) |
| No destructive SQL (non-comment) | PASS |
| Migration SHA-256 hashes recorded | PASS |

Static blockers after correction: **0**

---

## G. Live read-only inspection result (Gate A)

| Metric | Value |
|---|---|
| Inspected | **true** |
| Pre-apply database size | **152,095,891 bytes** (~145.0 MB) |
| `pgcrypto` installed | **true** |
| `supabase_migrations.schema_migrations` exists | **true** |
| Target migration versions already recorded | **none** |
| Target table collisions | **none** (8 tables absent) |
| Credentials in report | **redacted** (host/port/database only) |

Readiness report: `reports/ui3-i10/migration-readiness.json`

Gate B pre-apply recheck: **decision PASS** (immediately before apply)

---

## H. Gate B controlled apply result

| Metric | Value |
|---|---|
| Operation | `GATE_B_CONTROLLED_APPLY` |
| Confirmation | `UI3_I10_APPLY_CONFIRMED=YES` |
| Transaction | **COMMIT** |
| Final result | **PASS** |
| First attempt | **ROLLED_BACK** (`cannot execute CREATE EXTENSION in a read-only transaction` on pooler port 6543) |
| Rollback protection | **proven** — first failure left zero target tables; second attempt succeeded atomically |
| Tables created | **8** |
| Post-apply database size | **152,390,803 bytes** |
| Size increase | **294,912 bytes** (~288 KB, bounded) |
| Seeded rows | **0** (all eight tables) |
| Public RLS policies | **0** |
| Credentials in reports | **redacted** |

### Applied migration hashes

| ID | SHA-256 |
|---|---|
| `20261008000001` | `90009b3614683ec371053dfa388638d044ea6c9b8ef6cfe9db7c80658db27965` |
| `20261010000001` | `111cb9970125d1db894154e606c2c14a55d348b406f0ef3150822260bbfb0c44` |
| `20261011000001` | `226b615dfd0ec7fd76e06ad937504b086cedd44a091626d098fa0cc0a761ec1b` |

### Gate B apply corrections

1. **Pooler session port:** Supabase transaction pooler port `6543` cannot execute DDL inside `BEGIN`; apply script normalizes to port `5432` for DDL.
2. **pgcrypto strip at apply:** `CREATE EXTENSION IF NOT EXISTS pgcrypto` stripped from lifecycle migration at apply time (extension already installed per readiness). On-disk migration hash unchanged; verification uses full file content.

### Eight-table verification

| Table | RLS | Rows |
|---|---|---|
| `fixture_lifecycle_current` | enabled | 0 |
| `fixture_identity_aliases` | enabled | 0 |
| `fixture_lifecycle_transition_events` | enabled | 0 |
| `fixture_lifecycle_rollover_events` | enabled | 0 |
| `lifecycle_daily_admission_counters` | enabled | 0 |
| `lifecycle_admission_idempotency` | enabled | 0 |
| `fixture_display_metadata` | enabled | 0 |
| `fip_intake_evidence` | enabled | 0 |

### Constraint and index proof

- Lifecycle FKs: `fixture_identity_aliases_fixture_fk`, `fixture_lifecycle_transition_events_fixture_fk`, `lifecycle_admission_idempotency_fixture_fk`
- D3 FK: `fixture_display_metadata_fixture_fk`
- D3 idempotency: `fixture_display_metadata_idempotency_unique`
- Evidence accepted-only unique index: `idx_fip_intake_evidence_accepted_idempotency`

Reports: `reports/ui3-i10/pre-apply-schema-snapshot.json`, `reports/ui3-i10/post-apply-schema-snapshot.json`, `reports/ui3-i10/controlled-apply-result.json`

---

## H.1 Gate B-C1 migration history reconciliation

| Metric | Value |
|---|---|
| Operation | `GATE_B_MIGRATION_HISTORY_RECONCILIATION` |
| Gate B-C1 start HEAD | `e85a27ed115eced51eb77010494ede67dfa777bb` |
| Reconciliation result | **PASS** |
| Gate B-C1 closure decision | **PASS WITH DOCUMENTED PRE-EXISTING GOVERNANCE EXCEPTION** |
| Repaired versions | `20261008000001`, `20261010000001`, `20261011000001` |
| Before | All three versions local only (`remote: false`) |
| After | All three versions Local = Remote |
| Schema reapplied | **false** |
| Credentials recorded | **false** |
| Unrelated migrations changed | **false** |
| Runtime gates remain blocked | **true** |

Supabase migration repair marked the three already-applied I10 versions as applied in remote `schema_migrations` without re-executing DDL.

Report: `reports/ui3-i10/migration-history-reconciliation.json`

**Formal Gate B closure:** Gate B controlled apply PASS WITH CORRECTION plus Gate B-C1 reconciliation PASS WITH DOCUMENTED PRE-EXISTING GOVERNANCE EXCEPTION.

### H.1.1 `control:assets` baseline proof (pre-existing governance exception)

| Metric | Value |
|---|---|
| Baseline HEAD | `e85a27ed115eced51eb77010494ede67dfa777bb` |
| Baseline `control:assets` exit code | **1** (FAIL) |
| Current `control:assets` exit code | **1** (FAIL) |
| Identical failure set | **true** |
| Introduced by Gate B-C1 | **false** |
| Baseline tracked / registered | **994 / 990** |
| Current tracked / registered | **995 / 991** |
| Count difference explanation | +1 tracked / +1 registered = new reconciliation report only |
| Discovered untracked workspace paths (current) | **9** |
| Ungoverned workspace candidates (current) | **0** |

`npm run control:assets` **remains FAIL**. The fatal error set at baseline HEAD `e85a27ed115eced51eb77010494ede67dfa777bb` is **identical** to post–B-C1 closure. No B-C1-specific governance error was introduced. Unrelated asset-register repair (11 pre-existing errors) is **deferred** outside I10 scope.

Pre-existing `control:assets` errors (unchanged):

1. `INVALID_ASSET_TYPE: tests/sem-gov-001d-home1-static-home.test.js TEST_PROOF`
2. `INVALID_ASSET_TYPE: tests/sem-gov-001d-home1-visual-acceptance.test.js TEST_PROOF`
3. `INVALID_ASSET_TYPE: backend/services/fixtureDisplayMetadataPersistenceService.js BACKEND_SERVICE`
4. `INVALID_ASSET_TYPE: scripts/check-ui3-i10-migration-readiness.js SCRIPT_TOOL`
5. `INVALID_ASSET_TYPE: scripts/apply-ui3-i10-controlled-migrations.js SCRIPT_TOOL`
6. `TRACKED_ASSET_UNREGISTERED: control-center/ALI-001_ACCURACY_AND_LOSS_INTELLIGENCE_PROPOSAL.v1.md`
7. `UNCLASSIFIED_TRACKED_PATH: control-center/ALI-001_ACCURACY_AND_LOSS_INTELLIGENCE_PROPOSAL.v1.md`
8. `TRACKED_ASSET_UNREGISTERED: control-center/RLL-001_REGIONAL_LANGUAGE_AND_LEGAL_LOCALISATION_PROPOSAL.v1.md`
9. `UNCLASSIFIED_TRACKED_PATH: control-center/RLL-001_REGIONAL_LANGUAGE_AND_LEGAL_LOCALISATION_PROPOSAL.v1.md`
10. `TRACKED_ASSET_UNREGISTERED: control-center/SPM-001_UNIFIED_SUBSCRIPTION_MODEL_PROPOSAL.v1.md`
11. `UNCLASSIFIED_TRACKED_PATH: control-center/SPM-001_UNIFIED_SUBSCRIPTION_MODEL_PROPOSAL.v1.md`

Baseline comparison recorded in `reports/ui3-i10/migration-history-reconciliation.json` → `baselineComparison`.

---

## I. Capacity note

Pre-apply **~145 MB** → post-apply **~145.3 MB** against EST-001 / CAP2 **380 MB** activation ceiling. Schema-only apply; row growth monitoring deferred until runtime activation is authorized.

---

## J. Test matrix and results

| Suite | Result |
|---|---|
| `npm run test:sem-gov-001d-ui3-i10` | PASS |
| `npm run test:sem-gov-001d-ui3-i10-apply` | PASS (6 tests) |
| `npm run test:sem-gov-001d-ui3-i9` through `i1` | PASS |
| `npm run control:center` | PASS |
| `npm run control:projects` | PASS |
| `npm run control:assets` | FAIL (pre-existing; identical at baseline HEAD `e85a27ed…`; not introduced by B-C1) |
| `npm run verify:rulebook` | PASS |

---

## K. Prohibited work (still deferred)

- HTTP route
- Scout FIP traffic
- Production intake activation
- Feature flag enablement
- Marriage gate clearance
- Unified lifecycle governor activation
- Runtime storage writes (`supabase_storage_gate` remains BLOCKED)

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
- [x] Controlled apply script installed
- [x] Gate B atomic apply PASS
- [x] Eight tables created with RLS, zero policies, zero rows
- [x] Post-apply reports written
- [x] Gate B-C1 migration history reconciliation PASS WITH DOCUMENTED PRE-EXISTING GOVERNANCE EXCEPTION
- [x] `control:assets` baseline proof recorded (identical pre-existing FAIL; unrelated repair deferred)
- [x] Formal Gate B closure recorded
- [x] All runtime gates remain BLOCKED

---

## N. Inspection decision

**PASS WITH CORRECTION** (Gate A + Gate B apply) — **formal Gate B closure PASS** — **Gate B-C1 PASS WITH DOCUMENTED PRE-EXISTING GOVERNANCE EXCEPTION**

Corrections:
- Gate A: lifecycle migration RLS enabled to align with backend-only service-role security precedent.
- Gate B: pooler session port normalization and pgcrypto strip at apply time (first attempt rolled back; second attempt committed).
- Gate B-C1: remote migration history repaired for three I10 versions; no schema reapply; credentials not recorded; `control:assets` remains FAIL with fatal error set identical to baseline HEAD `e85a27ed115eced51eb77010494ede67dfa777bb`; no B-C1-specific governance error introduced; unrelated asset-register repair deferred.

Runtime gates remain **BLOCKED**. Schema exists; migration history aligned; runtime writes and activation prohibited.
