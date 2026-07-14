# SEM-GOV-001B-I4-CAP2 — Daily Admission Limit Design v1

**Packet ID:** `SEM-GOV-001B-I4-CAP2`
**Parent programme:** `SEM-GOV-001` — Unified Sports Intelligence Lifecycle
**Parent packets:** `SEM-GOV-001B-I4-CAP`, `SEM-GOV-001B_FOOTBALL_LIFECYCLE_PERSISTENCE_CONTRACT.v1`, `SEM-GOV-001B_LIFECYCLE_GOVERNOR_FOUNDATION_IMPLEMENTATION_PACKET.v1`, `EST-001_SUPABASE_STORAGE_AND_FIP_RETENTION_CONTRACT.v1`
**Start commit:** `830302da93e970bee8dd70e6da1c23dcd411f899`
**Mode:** Governance-only — capacity recalculation and enforcement design
**Date sealed:** 2026-07-14

| Gate | Value |
|---|---|
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (unchanged — this packet does not clear gate) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged) |

**This packet does not:** create SQL, migrations, tables, indexes, `lifecyclePersistenceService.js`, counter implementation, purge jobs, production runtime callers, pipeline hooks, or clear any governance gate.

---

## A. Authority and status

| Field | Value |
|---|---|
| **Packet ID** | `SEM-GOV-001B-I4-CAP2` |
| **Capacity proof** | **TESTED** |
| **Admission-cap enforcement design** | **APPROVED DESIGN** |
| **I4 implementation** | **BLOCKED** — pending separate implementation packet and `supabase_storage_gate` clearance |
| **Activation decision** | **PASS FOR I4 CONTROL CENTER ACTIVATION** |

Stephen approved the owner mitigation direction in SEM-GOV-001B-I4-CAP: maximum **50 newly admitted fixtures per SAST calendar day**, **180-day** transition-event retention unchanged, **Option B (120-day retention) rejected**. This packet recalculates capacity from the sealed **167 MB** baseline and defines the deterministic fail-closed enforcement contract. It does **not** implement or activate enforcement.

---

## B. Start point and scope

**Start commit:** `830302da93e970bee8dd70e6da1c23dcd411f899` (SEM-GOV-001B-I4-CAP closed with HOLD).

**Authorized scope:**

1. Exact 50/day capacity recalculation from sealed baseline
2. SAST calendar-day admission-cap law
3. Future counter persistence design (`lifecycle_daily_admission_counters`)
4. Atomic transaction sequence and idempotency law
5. Override, audit, monitoring, retention, and failure-recovery design

**Excluded:**

- Physical DDL, migrations, runtime counter service
- `lifecyclePersistenceService.js` implementation
- Gate clearance
- Scout FIP pipeline hooks (SEM-GOV-001C)
- Rollover worker (SEM-GOV-001B-I5)
- Supabase upgrade

---

## C. Supabase supremacy law

Per EST-001 and SEM-GOV-001B-I4-CAP:

| Threshold | Database equivalent (500 MB Free Plan) |
|---|---|
| Normal operating band | <300 MB (<60%) |
| Warning | ≥300 MB |
| Approval required | ≥350 MB |
| **Control Center activation ceiling** | **≥380 MB — block activation clearance** |
| **Hard implementation block** | **≥400 MB** |
| Minimum headroom below hard block for activation | **20 MB** (projected total must remain **≤380 MB**) |

**Verified baseline (2026-07-14):** **167 MB** dashboard database size.

Lifecycle tables on disk: **0 MB** (not yet created). All lifecycle increment models add to **167 MB** baseline.

---

## D. Fixed capacity assumptions

| Parameter | Value |
|---|---|
| Current database baseline | **167 MB** |
| Daily admission ceiling (governed) | **50** newly admitted fixtures per SAST calendar day |
| Transition-event retention after archive closure | **180 days** |
| Aliases per fixture | **5** |
| Transition events per fixture (lifecycle lifetime) | **12** |
| Active current-projection window | **8** SAST calendar days |
| Rollover rows retained | **365** |
| Dead tuple / maintenance allowance | **20%** |
| Final contingency (conservative model) | **30%** |
| Timezone for admission day | `Africa/Johannesburg` (SAST) |

**Steady-state row formulas (archive rate = admission rate):**

```
aliases_retained           = admissions_per_day × retention_days × aliases_per_fixture
transition_events_retained = admissions_per_day × retention_days × events_per_fixture
current_rows_active        = admissions_per_day × 8
rollover_rows_retained     = 365
```

**Mathematical bound on transition-event growth:**

```
events_rows ≤ admissions_per_day × retention_days × events_per_fixture
```

At 50/day steady state: `50 × 180 × 12 = 108,000` rows — fixed once the 180-day retention window is saturated.

**Row-size assumptions (conservative PostgreSQL estimates, unchanged from I4-CAP):**

| Table | Row data (bytes) | Index overhead (bytes) | Total per row (bytes) |
|---|---|---|---|
| `fixture_identity_aliases` | 180 | 200 | **380** |
| `fixture_lifecycle_current` | 520 | 180 | **700** |
| `fixture_lifecycle_transition_events` | 620 | 340 | **960** |
| `fixture_lifecycle_rollover_events` | 2,100 | 60 | **2,160** |

---

## E. Per-table 50/day calculation

### `fixture_identity_aliases`

| Step | Calculation | Result |
|---|---|---|
| Rows/day (alias accumulation rate) | 50 × 5 | **250** |
| Retained rows | 50 × 180 × 5 | **45,000** |
| Raw size | 45,000 × 180 B | **8.10 MB** |
| Estimated index size | 45,000 × 200 B | **9.00 MB** |
| Subtotal | 45,000 × 380 B | **17.10 MB** |
| Maintenance allowance (+20%) | 17.10 × 0.20 | **3.42 MB** |
| **Table total** | | **20.52 MB** |

### `fixture_lifecycle_current`

| Step | Calculation | Result |
|---|---|---|
| Active retained rows (8-day window) | 50 × 8 | **400** |
| Raw size | 400 × 520 B | **0.21 MB** |
| Estimated index size | 400 × 180 B | **0.07 MB** |
| Subtotal | 400 × 700 B | **0.28 MB** |
| Maintenance allowance (+20%) | 0.28 × 0.20 | **0.06 MB** |
| **Table total** | | **0.34 MB** |

### `fixture_lifecycle_transition_events`

| Step | Calculation | Result |
|---|---|---|
| Rows/day | 50 × 12 | **600** |
| Retained rows | 50 × 12 × 180 | **108,000** |
| Raw size | 108,000 × 620 B | **66.96 MB** |
| Estimated index size | 108,000 × 340 B | **36.72 MB** |
| Subtotal | 108,000 × 960 B | **103.68 MB** |
| Maintenance allowance (+20%) | 103.68 × 0.20 | **20.74 MB** |
| **Table total** | | **124.42 MB** |

### `fixture_lifecycle_rollover_events`

| Step | Calculation | Result |
|---|---|---|
| Retained rows | fixed | **365** |
| Raw size | 365 × 2,100 B | **0.77 MB** |
| Estimated index size | 365 × 60 B | **0.02 MB** |
| Subtotal | 365 × 2,160 B | **0.79 MB** |
| Maintenance allowance (+20%) | 0.79 × 0.20 | **0.16 MB** |
| **Table total** | | **0.95 MB** |

### Lifecycle subtotal (before final contingency)

| Component | Value |
|---|---|
| Sum of table subtotals | **121.85 MB** |
| Sum of maintenance allowances | **24.38 MB** |
| **Lifecycle subtotal (tables + maintenance)** | **146.23 MB** |

**Future counter table (`lifecycle_daily_admission_counters`):** 365 retained rows × ~250 B ≈ **0.09 MB** — negligible; excluded from subtotal above.

---

## F. Projected totals and headroom

| Metric | Calculation | Result |
|---|---|---|
| Lifecycle subtotal (tables + 20% maintenance) | | **146.23 MB** |
| Conservative lifecycle after 30% contingency | 146.23 × 1.30 | **190.10 MB** |
| **Total projected database size** | 167 + 190.10 | **357.10 MB** |

### Headroom analysis

| Threshold | Headroom | Status |
|---|---|---|
| **300 MB** preferred operating ceiling | 300 − 357.10 = **−57.10 MB** | Above preferred — expected for governed 50/day conservative model; activation uses 380 MB ceiling |
| **380 MB** Control Center activation ceiling | 380 − 357.10 = **22.90 MB** | ✅ **PASS** (≥20 MB required) |
| **400 MB** hard implementation block | 400 − 357.10 = **42.90 MB** | ✅ **PASS** |

### Normal reference model (I4-CAP 10/day — unchanged)

| Metric | Result |
|---|---|
| Normal lifecycle increment (20% contingency) | **19.10 MB** |
| Normal projected total | **186.10 MB** |
| vs 300 MB preferred | ✅ **PASS** |

### Lower safe daily ceiling (if 50/day had failed)

Linear scaling from variable lifecycle components (excluding fixed rollover 0.95 MB):

```
variable_lifecycle = 146.23 − 0.95 = 145.28 MB
per_admission_day = 145.28 / 50 = 2.906 MB/day (before 30% contingency)
budget_to_380 = 380 − 167 = 213 MB
max_lifecycle = 213 / 1.30 = 163.85 MB
max_variable = 163.85 − 0.95 = 162.90 MB
max_admissions/day ≈ 162.90 / 2.906 ≈ 56/day
```

**Exact lower safe ceiling at same assumptions:** approximately **56 admissions/day**. Owner-selected **50/day** provides **~6/day** additional margin below the activation ceiling.

---

## G. Exact SAST admission-cap law

### G.1 Ceiling definition

- **Limit:** maximum **50** successful **new fixture admissions** per **SAST calendar date**.
- **Timezone:** `Africa/Johannesburg`.
- **Day boundary:** `00:00:00` inclusive to next `00:00:00` exclusive (SAST).
- **Admission date key:** `admission_date_sast DATE` derived from `evaluation_time` in SAST.

### G.2 What consumes a slot

| Action | Consumes slot? |
|---|---|
| First successful creation of a new immutable `fixture_uid` | **YES — exactly one** |
| Existing fixture (known `fixture_uid`) | **NO** |
| Duplicate retry with same idempotency key | **NO** |
| Idempotent replay returning prior result | **NO** |
| Alias addition to existing fixture | **NO** |
| Rejected or rolled-back transaction | **NO** |
| Postponed fixture retaining same `fixture_uid` | **NO** |
| Unsupported sport | **NO** — blocked before counter (`SPORT_NOT_ACTIVE`) |

### G.3 Enforcement ordering (pre-commit)

1. Ceiling applies **before** any persistence write for admission can commit.
2. Slot reservation and fixture admission **must** occur in **one atomic transaction**.
3. Capacity **must not** be enforced from process memory alone.
4. Server restarts **must not** reset the count.
5. Multiple application instances **must not** bypass the limit.
6. Missing or unreadable counter state **must fail closed**.

### G.4 Rejection codes

| Code | When |
|---|---|
| `DAILY_ADMISSION_CAP_REACHED` | `admitted_count >= ceiling` for current SAST date before new admission |
| `ADMISSION_CAP_STATE_UNAVAILABLE` | Counter row cannot be safely read, created, or locked |

### G.5 Bypass prohibition

No request may bypass the limit through retries, aliases, duplicate intake, concurrent requests, restarts, environment variables, or alternate routes.

---

## H. Counter persistence design

### H.1 Future table: `lifecycle_daily_admission_counters`

**Not created in this packet.** Design-only specification.

| Column | Type | Notes |
|---|---|---|
| `admission_date_sast` | DATE PRIMARY KEY | SAST calendar date of admission bucket |
| `admitted_count` | INTEGER NOT NULL | Monotonic count of successful new admissions |
| `ceiling` | INTEGER NOT NULL | Governed configured value; initially **50** |
| `created_at` | TIMESTAMPTZ NOT NULL | Row creation time |
| `updated_at` | TIMESTAMPTZ NOT NULL | Last successful increment |
| `transition_version` | INTEGER NOT NULL | Optimistic concurrency for counter row updates |
| `last_fixture_uid` | UUID NULL | Most recent admitted fixture (**audit aid only**) |
| `last_idempotency_key` | TEXT NULL | Most recent admission idempotency key (**audit aid only — not duplicate-prevention authority**) |

### H.2 Counter laws

| Law | Requirement |
|---|---|
| Ceiling value | Must equal governed configured value; initially **50** |
| `admitted_count` | Cannot be negative; cannot exceed `ceiling` |
| Row cardinality | Exactly **one row per SAST date** |
| Atomicity | Counter increment and new fixture admission in **one transaction** |
| Concurrency | Row-level lock (`SELECT … FOR UPDATE`) or atomic conditional `UPDATE … WHERE admitted_count < ceiling` |
| Race prevention | No read-then-write outside a transaction |
| Idempotency authority | Duplicate prevention uses durable `lifecycle_admission_idempotency` record (§J.1), **not** `last_idempotency_key` on the counter |
| Rollback | Transaction rollback restores fixture writes, idempotency record, and counter — no consumed slot remains |
| Manual reset | **Prohibited** |
| Row creation | Lazy on first admission for SAST date; no scheduler required |
| Retention | Counter rows retained **365 days** for audit, then purged under bounded retention law |
| Payload prohibition | Counter table stores **no** Scout payload or sports-truth data |

### H.3 Required future uniqueness

| Constraint | Purpose |
|---|---|
| PRIMARY KEY (`admission_date_sast`) | One counter per SAST day |
| UNIQUE (`fixture_uid`) on `fixture_lifecycle_current` | Immutable fixture identity |
| UNIQUE (`alias_namespace`, `alias_value`) on `fixture_identity_aliases` | Canonical alias resolution |
| UNIQUE (`admission_idempotency_key`) on `lifecycle_admission_idempotency` (§J.1) | Durable duplicate-prevention authority |

`last_idempotency_key` on `lifecycle_daily_admission_counters` is **optional audit evidence only** and carries **no** uniqueness constraint for admission deduplication.

### H.4 Future table: `lifecycle_admission_idempotency` (design only — not created)

**Preferred durable admission idempotency authority.** An equivalent uniquely constrained admission record inside another approved lifecycle table is permitted only if it satisfies the same laws below.

| Column | Type | Notes |
|---|---|---|
| `admission_idempotency_key` | TEXT PRIMARY KEY | Durable deduplication key |
| `fixture_uid` | UUID NOT NULL | Admitted fixture |
| `admission_date_sast` | DATE NOT NULL | SAST calendar date of admission |
| `outcome` | TEXT NOT NULL | e.g. `ADMITTED` |
| `created_at` | TIMESTAMPTZ NOT NULL | Record creation time |

**Not created in this packet.**

### H.5 Future indexes (design only)

| Index | Purpose |
|---|---|
| PRIMARY KEY (`admission_date_sast`) | Counter lookup and lock |
| Partial or btree on `admission_date_sast` for purge eligibility | Bounded 365-day retention purge |

---

## I. Atomic transaction sequence

Gate and feature-flag evaluation, plus pure sport/window/identity validation, complete **before** any database connection is acquired. **Gate or feature-flag rejection causes zero DB calls.** `BEGIN` occurs only after gate, flag, and pure validation pass.

| Step | Phase | Action |
|---|---|---|
| 1 | Pre-DB | Read and evaluate the canonical governance gate (ledger) — fail closed if blocked |
| 2 | Pre-DB | Evaluate `LIFECYCLE_GOVERNOR_ENABLED` feature flag |
| 3 | Pre-DB | Validate sport, request shape, and SAST admission window using pure logic |
| 4 | Pre-DB | If blocked or invalid → return rejection code; **acquire no DB connection** |
| 5 | DB | Acquire connection and `BEGIN` transaction (`backend/db.js` `withTransaction`) |
| 6 | DB | Resolve canonical fixture identity via alias registry; resolve persisted admission idempotency via `lifecycle_admission_idempotency` |
| 7 | DB | Lock or lazily create `lifecycle_daily_admission_counters` row for `admission_date_sast` |
| 8 | DB | If `admitted_count >= ceiling` → reject `DAILY_ADMISSION_CAP_REACHED`; write **no** lifecycle rows |
| 9 | DB | Mint immutable `fixture_uid`; create initial alias, projection, and transition rows; insert durable idempotency record |
| 10 | DB | Increment `admitted_count` exactly once; update optional audit fields (`last_fixture_uid`, `last_idempotency_key`, `updated_at`) |
| 11 | DB | `COMMIT` all writes atomically |
| 12 | DB | On any failure → `ROLLBACK` all lifecycle writes, idempotency record, and counter increment |

**Explicit laws:**

- Steps 1–4 perform **zero** database queries or writes.
- A blocked gate (`LIFECYCLE_GATE_BLOCKED`), disabled flag (`LIFECYCLE_FEATURE_DISABLED`), or pure-validation rejection (`SPORT_NOT_ACTIVE`, `FIXTURE_OUTSIDE_ADMISSION_WINDOW`, etc.) returns **without** `pool.connect()`, `BEGIN`, or any persistence access.
- Idempotency record, initial fixture rows, and counter increment **must** commit in the same transaction or roll back together.

**Forbidden in admission transaction:**

- Query or modify `predictions_raw`
- Query or modify `direct1x2_prediction_final`
- Query or modify `fixture_context_cache`
- Query or modify any prediction or publication table

---

## J. Idempotency and concurrency law

### J.1 Durable admission idempotency authority (future)

Duplicate prevention is enforced by **`lifecycle_admission_idempotency`** (§H.4) or an approved equivalent with `UNIQUE(admission_idempotency_key)`. The counter row's `last_idempotency_key` is **audit-only** and must **not** be consulted for deduplication.

**Admission idempotency key derivation:**

```
admission_idempotency_key = SHA-256(
  sport + "|" +
  primary_alias_namespace + "|" +
  primary_alias_value + "|" +
  floor(kickoff_at_epoch_seconds) + "|" +
  admission_date_sast
)
```

**Required laws:**

| Law | Requirement |
|---|---|
| Uniqueness | `admission_idempotency_key` is **UNIQUE** on the durable idempotency authority |
| Identity before slot | Canonical fixture identity is resolved **before** consuming a counter slot |
| Alias resolution | All aliases resolving to the same `fixture_uid` return the existing admission — **no new slot** |
| Alias bypass prohibition | Changing alias namespace or alias value for the same real fixture **cannot** consume another slot when deterministic identity evidence links to an existing `fixture_uid` |
| Duplicate retries | Duplicate `admission_idempotency_key` returns prior `fixture_uid` and outcome — **no counter increment** |
| Atomic commit | Idempotency record, initial fixture rows, and counter increment commit in **one transaction** |
| Rollback integrity | Transaction rollback leaves **no** consumed slot and **no** partial idempotency record |
| Counter audit field | `last_idempotency_key` on `lifecycle_daily_admission_counters` remains optional audit evidence only |

**Alias-bypass protection sequence (within step 6):**

1. Look up `fixture_identity_aliases` by submitted namespace+value.
2. If alias resolves to existing `fixture_uid` → return existing admission; **do not** increment counter.
3. If `lifecycle_admission_idempotency` contains `admission_idempotency_key` → return prior result; **do not** increment counter.
4. Only when identity is genuinely new and idempotency key is absent → proceed to counter check and slot consumption.

### J.2 Transition idempotency (unchanged from SEM-GOV-001B §10.1)

`UNIQUE(fixture_uid, idempotency_key)` on `fixture_lifecycle_transition_events`. Duplicate → `LIFECYCLE_DUPLICATE_EVENT` or authorized no-op return.

### J.3 Optimistic concurrency

- Counter row: `transition_version` incremented on each successful admission increment; stale update → fail closed.
- Current projection: `transition_version` per SEM-GOV-001B §10.2 — `LIFECYCLE_STALE_VERSION` on mismatch.

### J.4 Concurrency controls

| Control | Law |
|---|---|
| Pool authority | Existing `pg.Pool` in `backend/db.js`; max **10** connections |
| Counter writer | Row-level lock on `admission_date_sast` counter row |
| Fixture writer | **1 writer per `fixture_uid`** for transitions |
| Parallel uncontrolled admission writes | **Prohibited** |
| Automatic retry after cap rejection | **Prohibited** — `DAILY_ADMISSION_CAP_REACHED` is terminal for that SAST day |
| Automatic retry after state unavailable | **Prohibited** — fail closed |

---

## K. Override and configuration law

| Rule | Law |
|---|---|
| Initial governed ceiling | **50** |
| Environment variable increase | **Prohibited** — no env var may silently increase ceiling |
| Runtime reduction | May reduce ceiling; **must not** raise above Control Center value |
| Increase above 50 | Requires: new capacity evidence; Stephen's explicit approval; updated governance packet; Control Center registration; Supabase threshold review |
| Emergency operator action | May lower ceiling to **zero** |
| Zero ceiling | Blocks all new admissions; permits reads and already-admitted lifecycle processing when otherwise allowed |
| Paid-plan assumption | **Prohibited** for ceiling increase |

---

## L. Audit evidence

Each successful admission must produce bounded audit evidence. Do **not** duplicate full audit payloads when transition-event evidence already contains required fields.

| Field | Source |
|---|---|
| SAST admission date | `admission_date_sast` |
| `fixture_uid` | Minted UUID |
| Idempotency key | Admission idempotency key |
| Counter value before | `admitted_count` pre-increment |
| Counter value after | `admitted_count` post-increment |
| Ceiling | `ceiling` at time of admission |
| `admitted_at` | Transaction commit timestamp |
| `source_actor` | Calling actor token |
| Outcome | `ADMITTED` or rejection code |

Initial transition event on `fixture_lifecycle_transition_events` carries overlapping provenance; counter row `last_fixture_uid` and optional `last_idempotency_key` provide same-day audit trail only — duplicate authority remains on `lifecycle_admission_idempotency`.

---

## M. Monitoring thresholds

| Trigger | Action |
|---|---|
| **40 admissions/day** (SAST) | **Warning** — review intake volume |
| **45 admissions/day** | **Approval-required alert** — Stephen notified before further admissions approach ceiling |
| **50 admissions/day** | **Hard block** — `DAILY_ADMISSION_CAP_REACHED` |
| Monthly | Review actual admissions/day distribution |
| Monthly | Review database size against thresholds |
| Re-run capacity model if | Event frequency >12/fixture; aliases >5/fixture; retention changes; baseline increases materially; football admission volume regularly exceeds 40/day |

**Material baseline increase** (either triggers re-validation):

1. **25 MB or more** since last approved capacity packet, **or**
2. Total database usage reaching **250 MB**

— whichever occurs first.

---

## N. Retention and purge

### N.1 Lifecycle tables (unchanged from I4-CAP §H)

| Table | Retention |
|---|---|
| `fixture_lifecycle_transition_events` | 180 days after archive closure; mandatory bounded purge |
| `fixture_identity_aliases` | Co-terminus with parent fixture closure |
| `fixture_lifecycle_current` | One row per active fixture; removed on archive closure |
| `fixture_lifecycle_rollover_events` | 365 days |

### N.2 Counter table retention

| Table | Retention |
|---|---|
| `lifecycle_daily_admission_counters` | **365 days** after `admission_date_sast`; then purged in bounded batches under same purge isolation law as I4-CAP §I |

**Retention purge remains mandatory.** Admission cap does not replace purge obligation.

---

## O. Failure and recovery behaviour

| Failure | Behaviour |
|---|---|
| Missing counter table | Fail closed — `ADMISSION_CAP_STATE_UNAVAILABLE`; no admission writes |
| Missing counter row creation permission | Fail closed — `ADMISSION_CAP_STATE_UNAVAILABLE` |
| Database timeout | Rollback; fail closed; no partial admission |
| Lock timeout | Rollback; fail closed — `ADMISSION_CAP_STATE_UNAVAILABLE` |
| Stale transaction / version conflict | Rollback; fail closed |
| Duplicate idempotency | Return prior result; no increment |
| Conflicting alias | Reject `FIXTURE_ALIAS_CONFLICT`; no increment |
| Counter already at 50 | Reject `DAILY_ADMISSION_CAP_REACHED` |
| Counter value above ceiling | Fail closed — data integrity anomaly; no new admissions; operator alert |
| Malformed SAST date | Fail closed before DB work |
| Database unavailable | Fail closed — `ADMISSION_CAP_STATE_UNAVAILABLE` |

**Recovery law:**

- Manual counter decrement is **prohibited** unless a separately approved reconciliation packet proves a committed admission did not occur.
- No bypass via retry, alias change, restart, parallel requests, instance switch, env var, or alternate route.

---

## P. Prohibited work

This packet and its closure **do not** authorize:

- `lifecyclePersistenceService.js` implementation
- Modification of `lifecycleGovernor.js`, `backend/db.js`, or production routes
- SQL, migrations, tables, indexes, or Supabase mutations
- Counter runtime implementation or purge code
- SEM-GOV-001B-I5 rollover worker
- SEM-GOV-001C Scout pipeline hooks
- Gate clearance (`supabase_storage_gate`, `scout_edge_marriage_gate`, `unified_lifecycle_governor`)
- Supabase paid-plan upgrade
- Repair of ALI-001, RLL-001, SPM-001, or ESA-RR-002

---

## Q. Activation recommendation

### Decision: **PASS FOR I4 CONTROL CENTER ACTIVATION**

| Criterion | Result |
|---|---|
| 50/day capacity recalculated from 167 MB baseline | ✅ **146.23 MB** lifecycle subtotal; **190.10 MB** after contingency |
| Total projected size <380 MB | ✅ **357.10 MB** |
| Total projected size <400 MB | ✅ **357.10 MB** |
| ≥20 MB headroom below 400 MB | ✅ **42.90 MB** |
| ≥20 MB headroom below 380 MB activation ceiling | ✅ **22.90 MB** |
| Transition-event growth bounded | ✅ `≤ 50 × 180 × 12 = 108,000` rows |
| SAST calendar-day semantics defined | ✅ §G |
| Bypass-resistant enforcement design | ✅ §G, §H, §I, §J |
| Fail-closed deterministic ordering | ✅ §I |
| Future storage, indexes, transactions, audit specified | ✅ §H–§L |
| No implementation | ✅ |
| Retention purge mandatory | ✅ §N |

**Normal reference model (10/day):** projected total **186.10 MB** — remains below **300 MB** preferred ceiling.

**Governed conservative 50/day model:** projected total **357.10 MB** — above **300 MB** preferred operating ceiling but within **380 MB** activation clearance and **400 MB** hard block with required headroom.

**This packet does not clear any gate.** I4 implementation remains **BLOCKED** pending separate implementation packet and `supabase_storage_gate` clearance.

---

## R. Definition of Done — SEM-GOV-001B-I4-CAP2

- [x] 50/day capacity model recalculated from sealed **167 MB** baseline
- [x] Normal reference projected total **186.10 MB** — below **300 MB**
- [x] Conservative 50/day projected total **357.10 MB** — below **380 MB** and **400 MB**
- [x] Headroom below 380 MB: **22.90 MB**; below 400 MB: **42.90 MB**
- [x] Transition-event growth mathematically bounded
- [x] SAST calendar-day admission-cap law defined
- [x] Bypass-resistant enforcement design complete
- [x] Fail-closed deterministic transaction order defined
- [x] Future counter table, indexes, audit, and monitoring specified
- [x] No SQL, migration, table, runtime, or Supabase mutation
- [x] Packet exists at `control-center/SEM-GOV-001B-I4_CAP2_DAILY_ADMISSION_LIMIT_DESIGN.v1.md`
- [x] Control Center registration updated
- [ ] `supabase_storage_gate` clearance — **explicitly not in this packet**
- [ ] I4 persistence implementation — **blocked pending separate implementation packet**
- [ ] Counter runtime enforcement — **requires I4 implementation packet**
