# SEM-GOV-001B-I2 — Lifecycle Governor Foundation Implementation Packet

**Packet ID:** `SEM-GOV-001B-I2`
**Parent contract:** `SEM-GOV-001B_FOOTBALL_LIFECYCLE_PERSISTENCE_CONTRACT.v1`
**Programme:** `SEM-GOV-001` — Unified Sports Intelligence Lifecycle
**Start commit:** `a3da67a1b5e6f9a803e3156c4878d37a2b61a12c`
**Mode:** Design-only — governance and architecture specification
**Date sealed:** 2026-07-14

| Gate | Value |
|---|---|
| `scout_edge_marriage_gate` | **BLOCKED** (unchanged) |
| `supabase_storage_gate` | **BLOCKED** (unchanged) |
| `unified_lifecycle_governor` | **BLOCKED** (unchanged) |

**This packet does not:** create or edit runtime services; create SQL or Supabase migrations; modify APIs, UI, `aiPipeline`, `fipIntakeService`, `syncService`, scheduler or database runtime files; clear any governance gate; repair ESG-001, ALI-001, RLL-001, SPM-001 or unrelated defects.

---

## A. Status and boundary

| Field | Value |
|---|---|
| **Packet ID** | `SEM-GOV-001B-I2` |
| **Parent contract** | `SEM-GOV-001B_FOOTBALL_LIFECYCLE_PERSISTENCE_CONTRACT.v1` |
| **Start commit** | `a3da67a1b5e6f9a803e3156c4878d37a2b61a12c` |
| **Mode** | Design-only |
| **Runtime feature flag** | `LIFECYCLE_GOVERNOR_ENABLED` — default **false**; cannot override governance gate |
| **All three gates** | **BLOCKED** |
| **Runtime / SQL / Supabase / API / UI** | **Forbidden in I2** |

SEM-GOV-001B-I2 seals the **Lifecycle Governor foundation design** — gate reader contract, pure evaluator surface, persistence adapter interface, rollover worker design, fail-closed ordering, test matrix, and future implementation sequence — without creating any runtime code, DDL, or pipeline hooks.

---

## B. Confirmed future file plan

The following files are **planned** for future implementation packets. They **MUST NOT** be created, edited, or registered as runtime assets in **SEM-GOV-001B-I2**.

| Future file | Owner packet | Purpose |
|---|---|---|
| `backend/services/lifecycleGovernor.js` | SEM-GOV-001B-I3 | Pure Lifecycle Governor foundation; gate reader; evaluator exports |
| `backend/services/lifecyclePersistenceService.js` | SEM-GOV-001B-I4 | Persistence adapter implementation behind `persistenceAdapter` DI |
| `backend/services/lifecycleRolloverService.js` | SEM-GOV-001B-I5 | Dedicated SAST midnight rollover worker |
| `tests/lifecycle-governor.test.js` | SEM-GOV-001B-I3 | Pure governor unit tests |
| `tests/lifecycle-persistence-service.test.js` | SEM-GOV-001B-I4 | Persistence adapter integration tests |
| `tests/lifecycle-rollover-service.test.js` | SEM-GOV-001B-I5 | Rollover idempotency and catch-up tests |

**I2 boundary:** Only this packet document, governance registrations, and `tests/sem-gov-001b-governor-foundation-packet.test.js` may be added. No future file above may exist on disk at I2 closure.

---

## C. Protected files

The following surfaces **must not be modified** by SEM-GOV-001B-I2 or any future lifecycle packet without separate EPI-001 / SEM-GOV-001C authorization:

| Protected surface | Role |
|---|---|
| `backend/services/fipIntakeService.js` | EFI-001 fail-closed FIP intake boundary |
| `backend/services/aiPipeline.js` | EPI-001 protected prediction orchestration |
| `backend/services/syncService.js` | Provider sync orchestration |
| `backend/routes/scheduler.js` | Enrichment queue routes |
| `backend/routes/pipeline.js` | Pipeline HTTP triggers |
| `backend/src/services/contextIntelligence/aiPipeline.js` | Parallel pipeline surface |
| `backend/db.js` | Future transaction authority — **read-only reference in I2** |
| `backend/database.js` | Legacy PostgreSQL access layer |
| All existing prediction/publication tables | `predictions_raw`, `direct1x2_prediction_final`, `fixture_context_cache`, etc. |
| All existing prediction/publication UI and API surfaces | Subscriber-facing prediction pages, publication routes |

Lifecycle Governor services must remain **isolated** until SEM-GOV-001C explicitly authorizes FIP/pipeline integration.

---

## D. Gate reader design

### D.1 Canonical source

Gate state is read from the **canonical ledger** (`control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json`) through the existing Control Center read bridge — **`controlCenterReadService`** — not a second ad-hoc JSON parser.

Today `controlCenterReadService.gates()` returns `scoutEdgeMarriageGate` and `supabaseStorageGate` from the ledger. The Lifecycle Governor gate reader extends this pattern.

### D.2 Future read interface

**Location (future):** `backend/services/lifecycleGovernor.js` or a thin delegate inside `controlCenterReadService.js` when separately authorized.

```javascript
/**
 * @param {{ refresh?: boolean }} [options]
 * @returns {{
 *   unifiedLifecycleGovernor: string,
 *   scoutEdgeMarriageGate: string,
 *   supabaseStorageGate: string,
 *   source: "EDGE_BUILD_CONTROL_LEDGER.v1.json"
 * }}
 */
async function readLifecycleGovernorGate({ refresh = false } = {}) {}
```

### D.3 Rules

1. **Missing / unreadable / invalid ledger** → treat all gates as blocked; evaluator returns **`LIFECYCLE_GATE_BLOCKED`**.
2. **Ledger gate checked before feature flag** — `unified_lifecycle_governor` must be explicitly authorized (not `BLOCKED`) before `LIFECYCLE_GOVERNOR_ENABLED` is consulted.
3. **`LIFECYCLE_GOVERNOR_ENABLED` defaults `false`** — env unset, empty, or any value other than explicit `true` → **`LIFECYCLE_FEATURE_DISABLED`** when gate would otherwise pass.
4. **Cached operator UI state must not silently authorize runtime** — `controlCenterReadService` caches ledger inputs for operator overview. The Governor runtime reader must either:
   - **(Preferred)** support `refresh: true` to re-read ledger from disk before each governed admission/transition when running in a long-lived process, or
   - **(Alternative)** use an **immutable startup snapshot** of gate state loaded once at process boot with documented restart requirement after gate changes.
5. **Return `source`** must always be `"EDGE_BUILD_CONTROL_LEDGER.v1.json"` on successful read.
6. **No separate gate file** — do not introduce `lifecycle_gate.json` or environment-only gate overrides.

### D.4 `evaluateGovernorGate` (future pure function)

```javascript
/**
 * @param {{
 *   gateReader: { readLifecycleGovernorGate: Function },
 *   featureFlagEnabled: boolean,
 *   refresh?: boolean
 * }} deps
 * @returns {Promise<{ allowed: boolean, code?: string }>}
 */
async function evaluateGovernorGate(deps) {}
```

Fail-closed order within gate evaluation:

1. Ledger unreadable → `LIFECYCLE_GATE_BLOCKED`
2. `unifiedLifecycleGovernor !== authorized` → `LIFECYCLE_GATE_BLOCKED`
3. `featureFlagEnabled === false` → `LIFECYCLE_FEATURE_DISABLED`

---

## E. Lifecycle Governor public contract

All functions below are **future pure/testable exports** from `backend/services/lifecycleGovernor.js`. They accept explicit inputs and dependency injection. **No direct** `process.env`, filesystem, or database access inside evaluators.

### E.1 Dependency injection surface

| Dependency | Role |
|---|---|
| `gateReader` | Supplies `readLifecycleGovernorGate()` |
| `clock` | `{ now(): Date }` — SAST window calculations use injected instant |
| `uuidGenerator` | `{ v4(): string }` — mints `fixture_uid` at admission |
| `persistenceAdapter` | Interface in §F — optional for pure transition replay tests |
| `transactionRunner` | `{ run(fn): Promise<T> }` — wraps atomic projection+event writes in I4+ |

### E.2 `calculateSastWindow`

```javascript
/**
 * @param {{ evaluationTime: Date, timezone?: string }} input
 * @returns {{
 *   windowStart: Date,
 *   windowEnd: Date,
 *   timezone: "Africa/Johannesburg"
 * }}
 */
function calculateSastWindow({ evaluationTime, timezone = "Africa/Johannesburg" }) {}
```

Law (from SEM-GOV-001B §13):

- `windowStart` = SAST calendar date of `evaluationTime` at 00:00:00
- `windowEnd` = `windowStart` + 8 calendar days at 00:00:00 (**exclusive**)

### E.3 `calculateDayLabel`

```javascript
/**
 * @param {{ kickoffAt: Date, evaluationTime: Date }} input
 * @returns {"TODAY"|"DAY_2"|"DAY_3"|"DAY_4"|"DAY_5"|"DAY_6"|"DAY_7"|"DAY_8"|null}
 */
function calculateDayLabel({ kickoffAt, evaluationTime }) {}
```

Returns `null` when kickoff falls outside the eight-day SAST window.

### E.4 `evaluateAdmission`

```javascript
/**
 * @param {{
 *   sport: string,
 *   kickoffAt: Date,
 *   evaluationTime: Date,
 *   gateResult: { allowed: boolean, code?: string },
 *   existingFixtureUid?: string | null
 * }} input
 * @returns {{ allowed: boolean, code?: string, dayLabel?: string }}
 */
function evaluateAdmission(input) {}
```

Rejection codes (fail-closed order after gate):

| Order | Condition | Code |
|---|---|---|
| 1 | Gate not allowed | `gateResult.code` |
| 2 | `sport !== "football"` | `SPORT_NOT_ACTIVE` |
| 3 | Kickoff outside eight-day window | `FIXTURE_OUTSIDE_ADMISSION_WINDOW` |
| 4 | New admission and `kickoffAt <= evaluationTime` | `FIXTURE_ALREADY_STARTED` |
| 5 | — | allowed with `dayLabel` |

**Already-admitted** fixtures (`existingFixtureUid` present) skip kickoff cutoff for new admission but retain 15-minute processing tolerance semantics in transition evaluation.

### E.5 `evaluateTransition`

```javascript
/**
 * @param {{
 *   current: { lifecycle_state, lifecycle_stage, transition_version, kickoff_at } | null,
 *   requested: { to_state, to_stage?, reason_category, source_actor },
 *   evaluationTime: Date
 * }} input
 * @returns {{ allowed: boolean, code?: string }}
 */
function evaluateTransition(input) {}
```

Enforces SEM-GOV-001B §11–§12 legal state and stage matrix. Unlisted transitions → **`LIFECYCLE_TRANSITION_NOT_ALLOWED`**. Stage regression → **`LIFECYCLE_STAGE_REGRESSION_NOT_ALLOWED`**. Missing `reason_category` → **`LIFECYCLE_REASON_REQUIRED`**.

Distinguishes **`POSTPONED`** vs **`CANCELLED`** per OD-8.

### E.6 `buildTransitionEvent`

```javascript
/**
 * @param {{
 *   fixtureUid: string,
 *   transitionVersion: number,
 *   fromState: string | null,
 *   toState: string,
 *   fromStage?: string | null,
 *   toStage?: string | null,
 *   reasonCategory: string,
 *   sourceActor: string,
 *   sourceRef?: string,
 *   occurredAt: Date,
 *   idempotencyKey: string
 * }} input
 * @returns {object} transition event row shape (no persistence)
 */
function buildTransitionEvent(input) {}
```

Idempotency key law (SEM-GOV-001B §10.1):

```
SHA-256(fixture_uid + "|" + to_state + "|" + COALESCE(to_stage,"") + "|" +
        reason_category + "|" + source_actor + "|" + COALESCE(source_ref,"") + "|" +
        floor(occurred_at_epoch_seconds))
```

### E.7 `calculateRolloverPlan`

```javascript
/**
 * @param {{
 *   rolloverKey: string,
 *   currentProjections: Array<{ fixture_uid, day_label, lifecycle_state, kickoff_at }>,
 *   lastRolloverKey?: string | null
 * }} input
 * @returns {{
 *   allowed: boolean,
 *   code?: string,
 *   archiveTransitions: Array<object>,
 *   relabelMap: Record<string, string>,
 *   snapshot: object
 * }}
 */
function calculateRolloverPlan(input) {}
```

- `rolloverKey` = SAST calendar date `YYYY-MM-DD`
- Duplicate `rolloverKey` when last applied → **`ROLLOVER_ALREADY_APPLIED`**
- Gap in sequence → **`ROLLOVER_DATE_GAP`** until catch-up completes
- Catch-up applies **latest missing date only** (one execution per recovery)

---

## F. Persistence adapter interface

**No physical DDL in I2.** Future implementation in SEM-GOV-001B-I4 only after `supabase_storage_gate` authorization.

### F.1 Interface (future `lifecyclePersistenceService.js`)

| Method | Purpose |
|---|---|
| `findFixtureByAlias({ aliasNamespace, aliasValue })` | Resolve `fixture_uid` or conflict |
| `allocateFixtureUid()` | Mint immutable UUID via injected generator |
| `insertAlias({ fixtureUid, aliasNamespace, aliasValue, sourceSystem, seenAt })` | Register alias; reject `FIXTURE_ALIAS_CONFLICT` |
| `loadCurrentLifecycle({ fixtureUid })` | Read `fixture_lifecycle_current` projection |
| `appendTransitionEvent({ event })` | Append-only insert with idempotency guard |
| `updateCurrentProjection({ fixtureUid, projection, expectedVersion })` | Optimistic concurrency update |
| `loadLastRollover()` | Most recent `rollover_key` |
| `appendRolloverEvent({ rollover })` | Idempotent rollover audit row |

### F.2 Transaction authority

- **`backend/db.js`** is the future transaction authority (`withTransaction` or equivalent).
- **`appendTransitionEvent` + `updateCurrentProjection`** must execute in **one atomic transaction**.
- **`backend/database.js`** remains legacy; new lifecycle tables use `backend/db.js` only.

### F.3 Forbidden writes

The persistence adapter **must never write** to:

- `predictions_raw`
- `direct1x2_prediction_final`
- `fixture_context_cache`
- Any existing prediction or publication table

### F.4 Conflict codes

| Code | When |
|---|---|
| `FIXTURE_IDENTITY_CONFLICT` | Ambiguous alias lookup |
| `FIXTURE_ALIAS_CONFLICT` | Duplicate namespace+value for different `fixture_uid` |
| `LIFECYCLE_DUPLICATE_EVENT` | Duplicate `(fixture_uid, idempotency_key)` |
| `LIFECYCLE_STALE_VERSION` | Optimistic concurrency failure |

---

## G. Rollover design

| Requirement | Design |
|---|---|
| **Ownership** | Dedicated `lifecycleRolloverService.js` — not embedded in `syncService`, `pipeline.js`, or prediction rebuild |
| **Schedule** | SAST midnight (`00:00 Africa/Johannesburg`) |
| **Key** | `rollover_key` = SAST calendar date `YYYY-MM-DD` |
| **Idempotency** | `UNIQUE(rollover_key)` — duplicate → `ROLLOVER_ALREADY_APPLIED` |
| **Catch-up** | On recovery, run once for **latest missing** `rollover_key` only |
| **Gap detection** | Missing dates in sequence → `ROLLOVER_DATE_GAP` until caught up |
| **Provider independence** | No `dataProvider`, `syncService`, or external API calls |
| **Sequence** | Archive eligible TODAY fixtures → relabel DAY_2→TODAY … DAY_8→DAY_7 → open new DAY_8 → append rollover event with funnel snapshot |

Rollover **does not** rebuild funnel from provider data. `fixture_uid` and transition history remain continuous.

---

## H. Exact fail-closed order

All Governor operations must evaluate rejections in this **fixed order**:

1. **Canonical ledger unreadable or malformed** → `LIFECYCLE_GATE_BLOCKED`
2. **`unified_lifecycle_governor` gate not authorized** → `LIFECYCLE_GATE_BLOCKED`
3. **`LIFECYCLE_GOVERNOR_ENABLED` feature flag disabled** → `LIFECYCLE_FEATURE_DISABLED`
4. **Unsupported sport** (`sport !== "football"`) → `SPORT_NOT_ACTIVE`
5. **Invalid identity / admission / transition** → domain codes (`FIXTURE_*`, `LIFECYCLE_*`)
6. **Persistence unavailable when persistence is required** → fail closed; no partial writes; transaction rollback

Steps 1–3 must complete **before** any database call. When gate or flag blocks, **no DB call** is permitted.

---

## I. Test matrix

### I.1 Regression tests (required at I2 closure)

| Suite | File | Guards |
|---|---|---|
| I2 focused packet | `tests/sem-gov-001b-governor-foundation-packet.test.js` | Packet sections, future file plan, gate reader design, governance registration |
| SEM-GOV-001B contract | `tests/sem-gov-001b-lifecycle-persistence-contract.test.js` | Parent contract law unchanged |
| SEM-GOV-001A contract | `tests/sem-gov-001-lifecycle-contract.test.js` | Parent programme contract |
| Control Center ledger | `tests/edge-control-center-ledger.test.js` | Full CC check |
| Control Center CLI | `npm run control:center` | Policy validation |
| Project register | `npm run control:projects` | Register sync |
| Asset register | `npm run control:assets` | Asset integrity |
| Classification | `npm run control:classification` | No unclassified assets |
| Runtime inventory | `npm run control:runtime` | Runtime surface integrity |
| Master Rulebook guard | `npm run verify:rulebook` | No legacy threshold drift |

### I.2 Future unit tests (by implementation packet)

| Test | Packet | Assertion |
|---|---|---|
| Gate blocked | I3 | `evaluateGovernorGate` returns `LIFECYCLE_GATE_BLOCKED` when ledger gate BLOCKED |
| Flag disabled | I3 | Returns `LIFECYCLE_FEATURE_DISABLED` when gate authorized but flag false |
| No DB call while blocked | I3/I4 | Mock persistence adapter receives zero calls when gate/flag blocks |
| Football-only | I3 | `cricket` admission → `SPORT_NOT_ACTIVE` |
| Eight-day SAST boundaries | I3 | Kickoff on window boundary inclusive/exclusive per §13 |
| Kickoff cutoff | I3 | New admission at kickoff → `FIXTURE_ALREADY_STARTED` |
| 15-minute tolerance | I3 | Already-admitted fixture within `kickoff + 15min` remains processable |
| Immutable UUID | I3/I4 | `fixture_uid` unchanged across Scout refresh |
| Alias conflict | I4 | Duplicate namespace+value → `FIXTURE_ALIAS_CONFLICT` |
| Legal transitions | I3 | All §11.0 edges accepted |
| Illegal transitions | I3 | Unlisted edge → `LIFECYCLE_TRANSITION_NOT_ALLOWED` |
| Stage regression | I3 | Backward stage → `LIFECYCLE_STAGE_REGRESSION_NOT_ALLOWED` |
| Reason required | I3 | Missing category → `LIFECYCLE_REASON_REQUIRED` |
| Deterministic idempotency | I3/I4 | Same inputs → same `idempotency_key`; duplicate → `LIFECYCLE_DUPLICATE_EVENT` |
| Stale version | I4 | `expectedVersion` mismatch → `LIFECYCLE_STALE_VERSION` |
| Postponed vs cancelled | I3 | Separate states; postponement revokes `publication_eligible` |
| Rollover duplicate | I5 | Second same-date rollover → `ROLLOVER_ALREADY_APPLIED` |
| Rollover date gap | I5 | Skipped date → `ROLLOVER_DATE_GAP` until catch-up |
| Transaction rollback | I4 | Event append failure rolls back projection update |
| Protected-table non-interaction | I4 | Adapter never invokes writes to prediction tables |

---

## J. Implementation sequence

| Packet | Scope | Status |
|---|---|---|
| **SEM-GOV-001B-I2** (this packet) | Design-only foundation packet | **APPROVED at seal** |
| **SEM-GOV-001B-I3** | Pure `lifecycleGovernor.js` foundation; gate reader; pure evaluators; **no DB, no pipeline hooks** | **BLOCKED** — do not start |
| **SEM-GOV-001B-I4** | Persistence adapter + DDL — only after `supabase_storage_gate` authorization | **BLOCKED** — do not start |
| **SEM-GOV-001B-I5** | `lifecycleRolloverService.js` worker | **BLOCKED** — do not start |
| **SEM-GOV-001C** | FIP/pipeline integration; 48-hour horizon supersession when proven | **BLOCKED** — do not start |

No packet above I2 may begin without separate Stephen authorization recorded in Control Center.

---

## K. Rollback

SEM-GOV-001B-I2 rollback (if ever required):

1. Set `LIFECYCLE_GOVERNOR_ENABLED=false` (default).
2. Ensure `unified_lifecycle_governor=BLOCKED` in ledger.
3. Remove only artifacts introduced by their respective future packets (isolated services, tests, lifecycle tables).
4. **Never mutate** existing prediction tables (`predictions_raw`, `direct1x2_prediction_final`, etc.).
5. **No data migration rollback** in I2 — I2 creates no tables or runtime code.

---

## L. Definition of Done — SEM-GOV-001B-I2

SEM-GOV-001B-I2 is complete only when:

- [x] This implementation packet exists at `control-center/SEM-GOV-001B_LIFECYCLE_GOVERNOR_FOUNDATION_IMPLEMENTATION_PACKET.v1.md`
- [x] Sections A–L document status, future file plan, protected files, gate reader, public contract, persistence adapter, rollover, fail-closed order, test matrix, implementation sequence, rollback, and DoD
- [x] Future files listed in §B **do not exist** on disk
- [x] `SEM-GOV-001B-I2` registered in ledger and master project register with status **APPROVED**
- [x] `next_action` states I2 sealed and I3 blocked pending separate authorization
- [x] All three gates remain **BLOCKED**
- [x] `affected_tables` remain empty
- [x] `tests/sem-gov-001b-governor-foundation-packet.test.js` passes
- [x] SEM-GOV-001A and SEM-GOV-001B contract regression tests pass
- [x] `npm run control:verify` passes
- [x] `npm run verify:rulebook` passes
- [x] No forbidden runtime, SQL, API, or UI files changed
- [ ] Physical Governor service, persistence DDL, pipeline hooks — **explicitly not in I2**
