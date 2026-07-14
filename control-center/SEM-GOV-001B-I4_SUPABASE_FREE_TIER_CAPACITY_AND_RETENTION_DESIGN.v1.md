# SEM-GOV-001B-I4 — Supabase Free-Tier Capacity and Retention Design v1

**Packet ID:** `SEM-GOV-001B-I4-CAP`
**Parent programme:** `SEM-GOV-001` — Unified Sports Intelligence Lifecycle
**Parent contracts:** `SEM-GOV-001B_FOOTBALL_LIFECYCLE_PERSISTENCE_CONTRACT.v1`, `SEM-GOV-001B_LIFECYCLE_GOVERNOR_FOUNDATION_IMPLEMENTATION_PACKET.v1`, `EST-001_SUPABASE_STORAGE_AND_FIP_RETENTION_CONTRACT.v1`
**Start commit:** `098c8f8f64f41a334673a27e3651388a7cd42004`
**Mode:** Governance-only — capacity and retention design
**Date sealed:** 2026-07-14

| Gate | Value |
|---|---|
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (unchanged — capacity design does not clear gate) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged) |

**This packet does not:** create SQL, migrations, tables, indexes, `lifecyclePersistenceService.js`, purge jobs, production runtime callers, pipeline hooks, or clear any governance gate.

---

## A. Authority and scope

This packet applies the **SKCS Supabase Free-Tier Supremacy Rule** to the strictly limited **SEM-GOV-001B-I4 lifecycle persistence** surfaces:

1. `fixture_identity_aliases`
2. `fixture_lifecycle_current`
3. `fixture_lifecycle_transition_events`
4. `fixture_lifecycle_rollover_events`

**Authorized scope of future I4 implementation (when separately cleared):** persistence adapter and DDL for the four tables above, using `backend/db.js` transaction authority, reference-only Scout provenance fields, bounded retention, and bounded purge design documented herein.

**Explicitly excluded from this packet and from future I4 without separate authorization:**

- Scout FIP intake and pipeline integration
- Production runtime callers
- Writes to `predictions_raw`, `direct1x2_prediction_final`, `fixture_context_cache`, or any prediction/publication table
- Full FIP body, Scout evidence mirror, provider payload archive
- `lifecycleRolloverService.js` worker execution (SEM-GOV-001B-I5)
- SEM-GOV-001C
- Paid Supabase upgrade

---

## B. Verified Supabase dashboard usage

**Evidence source:** Stephen verified Supabase project dashboard — **2026-07-14**

| Resource | Current usage | Free Plan limit | % used | SKCS band |
|---|---|---|---|---|
| Database size | **0.167 GB (167 MB)** | 0.5 GB (500 MB) | **33%** | Normal (<60%) |
| Uncached egress | 0 GB | 5 GB / month | 0% | Normal |
| Cached egress | 0 GB | 5 GB / month | 0% | Normal |
| File storage | 0 GB | 1 GB | 0% | Normal |
| Monthly active users | 1 | 50,000 | <0.01% | Normal |
| Third-party users | 0 | 50,000 | 0% | Normal |
| Realtime peak connections | 0 | 200 | 0% | Normal |
| Realtime messages | 0 | 2,000,000 / month | 0% | Normal |
| Edge Function invocations | 0 | 500,000 / month | 0% | Normal |
| Fair Use grace period | Ended **2026-06-25** | — | — | No active grace |

**Conservative current baseline for all models in this packet:** **167 MB** (not the earlier 145 MB SQL catalog estimate).

---

## C. Free-tier internal thresholds

Per SKCS Supabase Free-Tier Supremacy Rule (internal operating thresholds on applicable allowances):

| Band | Threshold | Database equivalent (500 MB plan) |
|---|---|---|
| Normal | <60% | <300 MB |
| Warning | ≥60% | ≥300 MB |
| Approval required | ≥70% | ≥350 MB |
| **Hard implementation block** | **≥80%** | **≥400 MB** |
| Emergency reduction | ≥90% | ≥450 MB |

**SKCS preferred operating ceiling:** **300 MB** database.
**SKCS hard block for new lifecycle activation:** **400 MB** database.
**Minimum emergency headroom required below hard block:** **20 MB** (projected total must remain **≤380 MB** for Control Center activation clearance).

---

## D. Current baseline

| Item | Value |
|---|---|
| Verified dashboard database size | 167 MB |
| Lifecycle tables on disk | **0 MB** (not yet created) |
| Lifecycle incremental budget to 300 MB preferred ceiling | **133 MB** |
| Lifecycle incremental budget to 380 MB activation ceiling | **213 MB** |
| Lifecycle incremental budget to 400 MB hard block | **233 MB** |

All growth models below add lifecycle increment to **167 MB baseline**.

---

## E. Normal capacity model

**Scenario parameters:**

| Parameter | Value |
|---|---|
| Admitted fixtures / day | 10 |
| Aliases per fixture | 3 |
| Transition events per fixture (lifecycle lifetime) | 6 |
| Transition-event retention after archive closure | 180 days |
| Rollover-event retention | 365 days |
| Active current-projection window | 8-day SAST admission funnel |
| Dead tuple / maintenance allowance | 20% |
| Contingency | 20% |

**Steady-state row formulas (archive rate = admission rate):**

```
transition_events_retained = admissions_per_day × retention_days × events_per_fixture
aliases_retained           = admissions_per_day × retention_days × aliases_per_fixture
current_rows_active        = admissions_per_day × 8   (eight-day funnel ceiling)
rollover_rows_retained     = 365
```

**Normal steady-state row counts:**

| Table | Rows |
|---|---|
| `fixture_lifecycle_transition_events` | 10 × 180 × 6 = **10,800** |
| `fixture_identity_aliases` | 10 × 180 × 3 = **5,400** |
| `fixture_lifecycle_current` | 10 × 8 = **80** |
| `fixture_lifecycle_rollover_events` | **365** |

---

## F. Conservative capacity model

**Scenario parameters:**

| Parameter | Value |
|---|---|
| Admitted fixtures / day | 80 |
| Aliases per fixture | 5 |
| Transition events per fixture | 12 |
| Transition-event retention after archive closure | 180 days |
| Rollover-event retention | 365 days |
| Active current-projection window | 8-day SAST admission funnel |
| Dead tuple / maintenance allowance | 20% |
| Contingency | 30% |

**Conservative steady-state row counts:**

| Table | Rows |
|---|---|
| `fixture_lifecycle_transition_events` | 80 × 180 × 12 = **172,800** |
| `fixture_identity_aliases` | 80 × 180 × 5 = **72,000** |
| `fixture_lifecycle_current` | 80 × 8 = **640** |
| `fixture_lifecycle_rollover_events` | **365** |

**Mathematical bound on transition-event growth:**

```
events_rows ≤ admissions_per_day × retention_days × events_per_fixture
```

At conservative parameters the steady-state event row count is **fixed at 172,800** once the 180-day retention window is saturated. Growth is linear in admissions/day and retention days only until steady state; it does not grow unbounded with calendar time.

---

## G. Per-table growth model

### Row-size assumptions (conservative PostgreSQL estimates)

| Table | Row data (bytes) | Index / line-pointer overhead (bytes) | Total per row (bytes) | Rationale |
|---|---|---|---|---|
| `fixture_identity_aliases` | 180 | 200 | **380** | UUID + two TEXT aliases + source + two TIMESTAMPTZ; UNIQUE(namespace,value) + fixture_uid index |
| `fixture_lifecycle_current` | 520 | 180 | **700** | Full projection columns incl. scout refs; PK + day_label/state + kickoff indexes |
| `fixture_lifecycle_transition_events` | 620 | 340 | **960** | Append-only audit row with idempotency_key, reason tokens, scout refs; PK + UNIQUE(fixture_uid,idempotency_key) + retention + fixture lookup indexes |
| `fixture_lifecycle_rollover_events` | 2,100 | 60 | **2,160** | UUID + DATE + counts + **2 KB** `snapshot_json` funnel counters (not minimized) |

These sizes are **not** unusually small. Transition-event rows are the dominant cost driver.

### Normal scenario — per table

| Table | Retained rows | Raw data | Index size | Subtotal | +20% maintenance | Table total |
|---|---|---|---|---|---|---|
| `fixture_identity_aliases` | 5,400 | 0.97 MB | 1.08 MB | 2.05 MB | 0.41 MB | **2.46 MB** |
| `fixture_lifecycle_current` | 80 | 0.04 MB | 0.02 MB | 0.06 MB | 0.01 MB | **0.07 MB** |
| `fixture_lifecycle_transition_events` | 10,800 | 6.48 MB | 3.89 MB | 10.37 MB | 2.07 MB | **12.44 MB** |
| `fixture_lifecycle_rollover_events` | 365 | 0.75 MB | 0.04 MB | 0.79 MB | 0.16 MB | **0.95 MB** |
| **Lifecycle subtotal** | | | | **13.27 MB** | **2.65 MB** | **15.92 MB** |

**Normal lifecycle after 20% contingency:** 15.92 × 1.20 = **19.10 MB**

**Normal projected total database size:** 167 + 19.10 = **186.10 MB** ✅ (<300 MB preferred ceiling)

### Conservative scenario — per table

| Table | Retained rows | Raw data | Index size | Subtotal | +20% maintenance | Table total |
|---|---|---|---|---|---|---|
| `fixture_identity_aliases` | 72,000 | 12.94 MB | 14.53 MB | 27.47 MB | 5.49 MB | **32.96 MB** |
| `fixture_lifecycle_current` | 640 | 0.33 MB | 0.12 MB | 0.45 MB | 0.09 MB | **0.54 MB** |
| `fixture_lifecycle_transition_events` | 172,800 | 103.68 MB | 62.21 MB | 165.89 MB | 33.18 MB | **199.07 MB** |
| `fixture_lifecycle_rollover_events` | 365 | 0.75 MB | 0.04 MB | 0.79 MB | 0.16 MB | **0.95 MB** |
| **Lifecycle subtotal** | | | | **194.60 MB** | **38.92 MB** | **233.52 MB** |

**Conservative lifecycle after 30% contingency:** 233.52 × 1.30 = **303.58 MB**

**Conservative projected total database size:** 167 + 303.58 = **470.58 MB** ❌ (>400 MB hard block; >380 MB activation ceiling)

**Emergency headroom below 400 MB hard block:** 400 − 470.58 = **−70.58 MB** (insufficient)

### Governed mitigation options (required before activation clearance)

The **unconstrained conservative 80/day model (470.58 MB)** is preserved above as evidence showing why mitigation is required. It is **not** removed or replaced by owner decisions below.

To satisfy **≤380 MB** projected conservative total with the same row-size assumptions:

| Option | Parameters | Lifecycle after overhead + contingency | Projected total | Headroom below 400 MB | Owner status |
|---|---|---|---|---|---|
| **A — Admission cap (design estimate)** | 55 admissions/day; 180d retention; 12 events; 5 aliases | ~197 MB | **~364 MB** | **~36 MB** | Superseded by owner decision |
| **B — Retention cap** | 80 admissions/day; **120d** event retention; 12 events; 5 aliases | ~203 MB | **~370 MB** | **~30 MB** | **REJECTED** |
| **C — Combined** | 60 admissions/day; 150d retention | ~210 MB | **~377 MB** | **~23 MB** | Not selected |

### Owner mitigation decision (2026-07-14 — closure record)

Stephen approved closure of this packet with decision **HOLD** and recorded the following **future mitigation direction only**. This does **not** convert the packet to PASS and does **not** clear any gate.

| Field | Recorded decision |
|---|---|
| **Selected future mitigation** | Daily admission ceiling (Option A direction) |
| **Proposed admission ceiling** | **50 newly admitted fixtures per SAST calendar day** |
| **Transition-event retention** | **180 days after archive closure — unchanged** |
| **Option B (120-day retention)** | **REJECTED** |
| **50/day projected total (design estimate)** | Lifecycle ~190 MB; total **~357 MB**; headroom **~43 MB** below 400 MB hard block |
| **Enforcement status** | **Not proven or activated in this packet** |
| **Next required work** | Separate governed capacity recalculation and enforcement-design mini-project |
| **Gate clearance** | **No gate may clear until the separate mitigation packet passes** |

This packet proves why HOLD was required. It does **not** prove that the 50/day control is implemented, enforced, or sufficient for activation clearance without the separate mitigation packet.

---

## H. Retention law

### `fixture_lifecycle_current`

- Exactly **one current row per admitted `fixture_uid`**.
- Row is active while the fixture remains in the governed lifecycle funnel.
- When a fixture reaches `ARCHIVED` and archive closure is recorded, the current row is **removed or compacted** after the approved post-archive retention window.
- **No duplicate current rows** for the same `fixture_uid`.
- No indefinite retention of archived current projections.

### `fixture_lifecycle_transition_events`

- **Append-only** during active lifecycle.
- Retained for **180 days after archive closure** of the parent fixture.
- After cutoff, rows are **deleted in bounded batches** by the dedicated purge process (§I).
- **No indefinite retention.**

### `fixture_identity_aliases`

- Retained only while needed for fixture resolution and audit linkage.
- **Deleted or compacted with fixture lifecycle closure** on the same cutoff schedule as transition events.
- **No orphan aliases** may accumulate beyond the governed retention window.

### `fixture_lifecycle_rollover_events`

- Retained for **365 days**.
- Exactly **one row per `rollover_key`** (SAST calendar date `YYYY-MM-DD`).
- **Duplicate `rollover_key` inserts prohibited** (`ROLLOVER_ALREADY_APPLIED`).

---

## I. Bounded purge design

**Future owner:** dedicated purge function or service (e.g. `lifecycleRetentionPurgeService.js` — **not created in this packet**).

### Purge isolation

- **Not embedded** in normal admission or transition request paths.
- Runs **no more than once daily** under scheduler policy.
- **Concurrency = 1** with advisory lock or equivalent single-run protection.

### Purge limits (hard)

| Limit | Value |
|---|---|
| Maximum rows per batch | **500** |
| Maximum batches per execution | **5** |
| Maximum rows deleted per run | **2,500** |
| Maximum execution time | **5 seconds** |
| Automatic retry loops | **0** |
| Scheduler-controlled retry | **1 maximum** on a later governed execution |
| Persistent dedicated purge connection | **Prohibited** |

### Purge algorithm (design)

1. Acquire advisory lock; fail closed if lock unavailable.
2. Compute eligibility cutoff: `archive_closed_at + retention_period` for events and aliases; `recorded_at + 365d` for rollover events.
3. Select **oldest eligible rows first** using **indexed predicates only** (`recorded_at`, `archive_closed_at`, `rollover_key`) — **no full-table scan**.
4. Delete in batches of ≤500 rows; **commit per batch**.
5. Stop immediately on timeout; record partial completion.
6. Emit audit record: rows deleted, duration, cutoff date, outcome, batch count.
7. **Fail closed** on missing required index, timeout, lock failure, or unexpected row-count anomaly.
8. **No cascade** into prediction or publication tables.
9. **No Scout/FIP payload deletion** — such payloads must never be stored.

### Required future indexes (not created now)

| Table | Index | Purpose |
|---|---|---|
| `fixture_lifecycle_transition_events` | `(recorded_at)` or `(archive_closed_at)` WHERE eligible for purge | Retention cutoff scans |
| `fixture_lifecycle_transition_events` | `UNIQUE(fixture_uid, idempotency_key)` | Idempotency + fixture lookup |
| `fixture_lifecycle_transition_events` | `(fixture_uid, transition_version)` | Ordered replay |
| `fixture_identity_aliases` | `UNIQUE(alias_namespace, alias_value)` | Alias resolution |
| `fixture_identity_aliases` | `(fixture_uid)` | Fixture-scoped purge |
| `fixture_lifecycle_current` | `PRIMARY KEY(fixture_uid)` | Single-row lookup |
| `fixture_lifecycle_current` | `(lifecycle_state, day_label)` or partial archive index if required | Archive eligibility |
| `fixture_lifecycle_rollover_events` | `UNIQUE(rollover_key)` | Idempotent rollover audit |

---

## J. Query and timeout limits

| Operation class | Target duration | Rules |
|---|---|---|
| Ordinary alias / current lookup | **<1 second** | PK or UNIQUE index only; explicit column list |
| Transition append + projection update (single fixture) | **<1 second** | Single transaction via `withTransaction` |
| Purge execution | **≤5 seconds** | Bounded batches; stop on timeout |
| Administrative batch reads | **≤5 seconds** | Explicit `LIMIT`; no `SELECT *` on recurring paths |
| Queries expected >5 seconds | **Blocked** pending inspection |

**List operations:** pagination or explicit row limits mandatory.
**Destructive / bulk SQL:** requires transaction, pre-count, post-count, rollback plan.

---

## K. Connection and concurrency limits

| Item | Design |
|---|---|
| Pool authority | Existing `pg.Pool` in `backend/db.js` |
| Maximum pool size | **10** (unchanged unless separately approved) |
| Purge concurrency | **1** |
| Client release | `finally { client.release() }` in `withTransaction` |
| Persistent purge connection | **Prohibited** |
| Parallel uncontrolled writes | **Prohibited** |
| Transition write concurrency | **1 writer per `fixture_uid`** (optimistic `transition_version`) |

**Retries:**

- Ordinary transition writes: **zero automatic retry** after transaction failure.
- One explicit stale-version retry (`LIFECYCLE_STALE_VERSION`) permitted only if separately designed in I4 implementation.
- Purge: **no internal retry loop**; scheduler may invoke once more on a later daily execution.

---

## L. Egress controls

- Return **only required fields** per caller; no default full lifecycle-history payload.
- No `SELECT *` on recurring production paths.
- History endpoints (if later authorized) must be **paginated** with explicit limits.
- No Scout FIP body, provider payload, or evidence archive returned or stored.
- Lifecycle adapter test paths must use minimal row projections.

---

## M. Scout non-duplication law

Per SEM-GOV-001B §16 and EST-001:

| Permitted on lifecycle tables | Forbidden |
|---|---|
| `scout_fip_id` (reference) | Full validated FIP JSON body |
| `scout_validation_hash` (reference) | Raw provider dumps |
| `fip_schema_version`, `scout_run_id`, `idempotency_key` | Scout evidence archives |
| | H2H/history mirrors |
| | Neon / `scout_raw_match_signals` mirror |

Supabase stores **Edge-owned lifecycle state only**. Sports truth remains canonical in Scout (Neon).

---

## N. Monitoring requirements

| Trigger | Action |
|---|---|
| Before lifecycle migration | Record database size; block if ≥400 MB or missing measurement |
| After lifecycle migration | Record database size delta |
| After material backfill | Record database size delta |
| Monthly while SKCS active | Review database, storage, egress, functions, auth, connections |
| Projected DB ≥300 MB | **Warning** — no new retention expansion without re-validation |
| Projected DB ≥380 MB | **Block Control Center activation clearance** |
| Projected DB ≥400 MB | **Hard implementation block** |
| Unexpected growth / timeouts | Immediate review |

**Forbidden:** emergency reduction planning at 450 MB — **400 MB is already the SKCS hard block**.

---

## O. Rollback design

| Layer | Procedure |
|---|---|
| Migration rollback | `DOWN` migration drops only the four lifecycle tables; no prediction/publication mutation |
| Application rollback | Do not deploy persistence adapter; keep `LIFECYCLE_GOVERNOR_ENABLED=false` |
| Gate rollback | Revert `supabase_storage_gate` to `BLOCKED` in ledger |
| Transaction rollback | `withTransaction` automatic rollback on any append/projection failure |
| Purge rollback | Purge is delete-only on lifecycle tables; prediction tables never touched |
| Data safety | Existing tables (`predictions_raw`, `direct1x2_prediction_final`, etc.) remain untouched |

---

## P. Activation decision

### Capacity model results

| Model | Lifecycle increment | Projected total DB | vs 300 MB preferred | vs 380 MB activation | vs 400 MB hard block |
|---|---|---|---|---|---|
| **Normal (10/day)** | 19.10 MB | **186.10 MB** | ✅ PASS | ✅ PASS | ✅ PASS (213.9 MB headroom) |
| **Conservative (80/day)** | 303.58 MB | **470.58 MB** | ❌ FAIL | ❌ FAIL | ❌ FAIL (−70.58 MB headroom) |
| **Owner-selected future mitigation (50/day design estimate)** | ~190 MB | **~357 MB** | ❌ above preferred | ✅ below activation ceiling | ✅ PASS (~43 MB headroom) |

### Decision: **HOLD** (closed 2026-07-14)

**`supabase_storage_gate` remains `BLOCKED`.**
**`scout_edge_marriage_gate` remains `BLOCKED`.**
**`unified_lifecycle_governor` remains `BLOCKED`.**
**I4 implementation remains `BLOCKED`.**

**HOLD reasons (preserved):**

1. Unconstrained conservative scenario at **80 admissions/day** with **180-day** event retention projects **470.58 MB** — exceeding the **400 MB** hard block and **380 MB** activation ceiling.
2. Emergency headroom below 400 MB is **negative** at unconstrained conservative parameters.
3. Purge design is complete, but **governed admission enforcement** is not proven in this packet.

**Owner closure decisions (do not convert to PASS):**

- **HOLD** approved for packet closure.
- **Option A direction** approved: future **daily admission ceiling**.
- **Exact proposed ceiling:** **50 newly admitted fixtures per SAST calendar day**.
- **180-day** transition-event retention **remains unchanged**.
- **Option B (120-day retention) rejected**.
- **50/day control** requires a **separate governed capacity recalculation and enforcement-design mini-project**.
- **No gate may clear** until that separate mitigation packet passes.

---

## Q. Definition of Done — SEM-GOV-001B-I4-CAP

- [x] Current baseline uses **167 MB**
- [x] Normal 12-month projected total **186.10 MB** — below **300 MB**
- [x] Conservative 80/day model computed — **470.58 MB** exceeds limits; mitigated options documented
- [x] Transition-event growth mathematically bounded by `admissions × retention × events_per_fixture`
- [x] Retention and purge rules explicit (§H, §I)
- [x] Purge execution bounded, indexed, timed, auditable, fail-closed (§I)
- [x] No Scout data duplication permitted (§M)
- [x] No SQL, migration, table, persistence adapter, or production runtime change made
- [x] Packet exists at `control-center/SEM-GOV-001B-I4_SUPABASE_FREE_TIER_CAPACITY_AND_RETENTION_DESIGN.v1.md`
- [x] Packet closed with **HOLD** decision and owner mitigation direction recorded (50/day admission ceiling; Option B rejected; 180d retention unchanged)
- [ ] `supabase_storage_gate` clearance — **explicitly not in this packet**
- [ ] I4 persistence implementation — **blocked pending separate mitigation packet and gate clearance**
- [ ] 50/day admission enforcement — **requires separate governed mini-project**
