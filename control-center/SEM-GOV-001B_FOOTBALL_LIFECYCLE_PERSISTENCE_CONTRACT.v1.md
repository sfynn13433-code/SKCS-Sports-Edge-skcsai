# SEM-GOV-001B — Football Lifecycle Persistence Contract v1

## Contract status

| Field | Value |
|---|---|
| **Contract ID** | `SEM-GOV-001B_FOOTBALL_LIFECYCLE_PERSISTENCE_CONTRACT.v1` |
| **Programme** | `SEM-GOV-001` — Unified Sports Intelligence Lifecycle |
| **Governed mini-project** | `SEM-GOV-001B` — Football Lifecycle Persistence Contract |
| **Contract mode** | Contract-only (SEM-GOV-001B-C1) |
| **Parent contract** | `SEM-GOV-001_UNIFIED_SPORTS_INTELLIGENCE_LIFECYCLE_CONTRACT.v1` |
| **Governor gate field** | `unified_lifecycle_governor` in `EDGE_BUILD_CONTROL_LEDGER.v1.json` — **BLOCKED** |
| **Runtime feature flag** | `LIFECYCLE_GOVERNOR_ENABLED` — default **false**; cannot override governance gate |
| **Date sealed** | 2026-07-13 |
| **Authoritative baseline** | `c769d328aae7ccdcb756b012ce559c19ee428248` |
| **Prior evidence** | SEM-GOV-001B Inspection 1; owner decisions OD-1 through OD-10 |

---

## 1. Purpose and authority

This contract seals the **Football lifecycle persistence and Governor foundation law** for programme SEM-GOV-001. It defines how Edge allocates immutable fixture identity, records governed lifecycle state, enforces legal transitions, calculates the eight-day SAST admission window, owns rollover semantics, and activates the Lifecycle Governor — **without implementing runtime code, SQL, Supabase migrations, APIs, or UI**.

The **Lifecycle Governor** (`LifecycleGovernor`) remains subordinate to:

- SEM-GOV-001 canonical lifecycle law (six stages, eight states, §10 reason taxonomy)
- EST-001 forbidden-persistence law
- FIP-001 Scout authority and EFI-001 intake boundary
- EPI-001 protected pipeline surfaces
- EMG-001 `scout_edge_marriage_gate` (**BLOCKED**)
- EST-001 `supabase_storage_gate` (**BLOCKED**)
- Control Center governance and explicit human approval

This contract **does not** clear any governance gate and **does not** authorize production persistence DDL while `supabase_storage_gate` remains **BLOCKED**.

---

## 2. Football-first scope (OD-10)

Until **SEM-GOV-001H** authorizes multi-sport rollout:

- `sport = football` is the **only** sport permitted on the new lifecycle persistence path.
- Any other sport (`cricket`, `tennis`, `basketball`, etc.) attempting governed admission must fail closed with **`SPORT_NOT_ACTIVE`**.
- Existing non-football sport behavior in legacy pipeline tables and routes **must not change** as a result of SEM-GOV-001B-C1.

---

## 3. Phase boundary: SEM-GOV-001B vs SEM-GOV-001C

| SEM-GOV-001B (this contract) | SEM-GOV-001C and later (deferred) |
|---|---|
| Identity law (`fixture_uid` UUID, alias registry) | Scout FIP pipeline hooks into Governor |
| Current projection and append-only event **specifications** | Scoring window enforcement in `aiPipeline` |
| Legal state and stage transition matrix | `filterEngine` remapping to §10 categories |
| Eight-day SAST admission window calculation | Publication window and `FINAL_APPROVED` orchestration |
| Rollover semantics and catch-up law | ACCA / Direct Insights alignment (001F) |
| Post-kickoff admission vs 15-minute processing tolerance | SMH fixture-first APIs (001D) |
| Postponement / cancellation / archival transition law | BOT explanation APIs (001E) |
| Activation sequence (feature flag + governance gate) | UI / Help implementation (001D/E) |
| Future table shapes (declarative only) | Physical DDL and runtime Governor service |
| Preserve existing **48-hour FIP horizon** unchanged | Supersede 48-hour rule only after tested 001C integration |

**SEM-GOV-001B-C1 forbids:** runtime code, SQL migrations, Supabase changes, API routes, UI, BOT, ACCA, and publication logic changes.

---

## 4. Owner decisions OD-1 through OD-10 (recorded)

| ID | Decision |
|---|---|
| **OD-1** | `fixture_uid` is an **Edge-minted immutable UUID** allocated once at first governed admission. `fip_id`, Scout `fixture_id`, provider IDs, `match_id`, and `id_event` are **aliases or provenance references only** — never the primary key. |
| **OD-2** | Identity alias registry with `UNIQUE(alias_namespace, alias_value)`. No fuzzy cross-provider merge. Ambiguity → **`FIXTURE_IDENTITY_CONFLICT`**. |
| **OD-3** | Eight SAST calendar buckets: `TODAY` through `DAY_8`. Window: SAST today 00:00 inclusive through SAST today + 8 calendar days 00:00 exclusive. |
| **OD-4** | New admission prohibited at or after scheduled kickoff. Already-admitted fixtures receive **15-minute** processing tolerance. Legacy 2h/6h/24h rules are **not** lifecycle admission policy. |
| **OD-5** | Existing **48-hour FIP horizon** (`MAX_KICKOFF_HORIZON_MS`) remains **unchanged** during 001B. Supersession only through tested SEM-GOV-001C integration. |
| **OD-6** | Lifecycle Governor owns rollover semantics. Idempotent by SAST calendar date; one-time catch-up after missed execution. |
| **OD-7** | **No R1/R2 or lifecycle persistence migration** while `supabase_storage_gate` is **BLOCKED**. Future schemas declared only. |
| **OD-8** | `POSTPONED` and `CANCELLED` remain separate. Postponement revokes publication eligibility; fixture stays visible; governed re-entry after new kickoff. |
| **OD-9** | Governor operation requires **both** `LIFECYCLE_GOVERNOR_ENABLED=true` **and** `unified_lifecycle_governor` gate authorization. Feature flag cannot override gate. |
| **OD-10** | Football only until SEM-GOV-001H. Other sports → **`SPORT_NOT_ACTIVE`**. |

---

## 5. Canonical stages and states (unchanged from SEM-GOV-001)

### 5.1 Six lifecycle stages (reuse without alteration)

| # | Token | Label |
|---|---|---|
| 1 | `ADMITTED` | Fixture Admitted |
| 2 | `EVIDENCE_REVIEW` | Evidence Review |
| 3 | `CONTEXT_REVIEW` | Context Review |
| 4 | `STABILITY_REVIEW` | Stability Review |
| 5 | `PUBLICATION_REVIEW` | Publication Review |
| 6 | `FINAL_DECISION` | Final Decision |

### 5.2 Eight lifecycle states (reuse without alteration)

| Token | Meaning |
|---|---|
| `VISIBLE` | Publicly listed; analysis may not have started |
| `UNDER_REVIEW` | Governed checks actively in progress |
| `HELD` | Progression paused with governed reason |
| `ELIMINATED` | No longer eligible for publication; remains visible |
| `FINAL_APPROVED` | May release insight per subscriber gates |
| `CANCELLED` | Source confirms fixture will not proceed |
| `POSTPONED` | Rescheduled; publication eligibility revoked |
| `ARCHIVED` | Left active pre-match window; history preserved |

---

## 6. Immutable UUID `fixture_uid` law (OD-1)

### 6.1 Allocation

```
fixture_uid: UUID v4 (or UUID v7 when separately authorized)
  - Generated exactly once by Edge at first governed admission
  - IMMUTABLE for the life of the fixture record
  - NEVER derived from fip_id, provider_event_id, match_id, or id_event
```

### 6.2 Authority hierarchy

| Identifier | Role |
|---|---|
| `fixture_uid` | **Primary Edge lifecycle key** |
| `fip_id` | Scout intelligence package identity; may change on refresh |
| `scout.fixture_id` | Scout canonical fixture reference within FIP |
| `provider_event_id` / `match_id` / `id_event` | Legacy or provider aliases |
| Composite team+kickoff keys | **Forbidden** as identity or merge keys |

### 6.3 Scout refresh law

When Scout delivers a refreshed FIP for the same real fixture:

- `fixture_uid` **does not change**
- Alias rows may update `last_seen_at` and provenance references
- Lifecycle transitions record the refresh as a governed event with Scout provenance refs
- A new `fip_id` does **not** mint a new `fixture_uid` when deterministic alias evidence links to an existing fixture

---

## 7. Identity alias law (OD-2)

### 7.1 Conceptual alias registry (future table: `fixture_identity_aliases`)

| Column | Type | Notes |
|---|---|---|
| `fixture_uid` | UUID NOT NULL | FK to current projection |
| `alias_namespace` | TEXT NOT NULL | e.g. `fip_id`, `scout_fixture_id`, `provider_event_id`, `match_id`, `id_event`, `legacy` |
| `alias_value` | TEXT NOT NULL | Opaque string value |
| `source_system` | TEXT NOT NULL | e.g. `scout`, `api_sports`, `thesportsdb`, `edge_legacy` |
| `first_seen_at` | TIMESTAMPTZ NOT NULL | |
| `last_seen_at` | TIMESTAMPTZ NOT NULL | |

**Required uniqueness:** `UNIQUE(alias_namespace, alias_value)`

### 7.2 Alias rules

1. **No automatic cross-provider merge** based only on teams, kickoff, or fuzzy string similarity.
2. **One alias cannot silently move** between `fixture_uid` values. Reassignment requires explicit operator authorization and audit event.
3. **Ambiguous alias lookup** (multiple `fixture_uid` candidates for same namespace+value) → reject with **`FIXTURE_IDENTITY_CONFLICT`**.
4. **Duplicate insert** of same namespace+value for different `fixture_uid` → reject with **`FIXTURE_ALIAS_CONFLICT`**.
5. Historical rows may be linked only where identity evidence is **deterministic** (exact alias match or authorized crosswalk).
6. Unresolved rows remain **explicitly unlinked** — never silently assigned.

---

## 8. Current lifecycle projection specification

Future table: **`fixture_lifecycle_current`** (declarative only — not migrated in 001B-C1)

| Column | Type | Notes |
|---|---|---|
| `fixture_uid` | UUID PRIMARY KEY | Edge-minted immutable |
| `sport` | TEXT NOT NULL | Must be `football` on persistence path |
| `lifecycle_state` | TEXT NOT NULL | One of eight SEM-GOV states |
| `lifecycle_stage` | TEXT NOT NULL | One of six SEM-GOV stages |
| `day_label` | TEXT NOT NULL | `TODAY`, `DAY_2` … `DAY_8` |
| `kickoff_at` | TIMESTAMPTZ NOT NULL | Scheduled kickoff (sports truth snapshot) |
| `engine_stage` | SMALLINT NULL | Internal 1–6; not customer-facing before FINAL_APPROVED |
| `publication_eligible` | BOOLEAN NOT NULL DEFAULT false | true only when state = FINAL_APPROVED |
| `hold_category` | TEXT NULL | SEM-GOV-001 §10 token when HELD |
| `elimination_category` | TEXT NULL | SEM-GOV-001 §10 token when ELIMINATED |
| `evidence_fresh_at` | TIMESTAMPTZ NULL | Last Scout/FIP evidence refresh |
| `scout_fip_id` | TEXT NULL | Provenance reference only |
| `scout_validation_hash` | TEXT NULL | Provenance reference only |
| `transition_version` | BIGINT NOT NULL DEFAULT 1 | Optimistic concurrency |
| `created_at` | TIMESTAMPTZ NOT NULL | First admission |
| `updated_at` | TIMESTAMPTZ NOT NULL | Last projection update |

**Indexes (future):**

- `(sport, day_label, lifecycle_state)`
- `(kickoff_at)`
- `(lifecycle_state)` WHERE lifecycle_state IN (`VISIBLE`, `UNDER_REVIEW`, `HELD`)

---

## 9. Append-only transition-event specification

Future table: **`fixture_lifecycle_transition_events`** (declarative only)

| Column | Type | Notes |
|---|---|---|
| `event_id` | UUID PRIMARY KEY | |
| `fixture_uid` | UUID NOT NULL | |
| `transition_version` | BIGINT NOT NULL | Monotonic per fixture |
| `from_state` | TEXT NULL | NULL on first admission |
| `to_state` | TEXT NOT NULL | |
| `from_stage` | TEXT NULL | |
| `to_stage` | TEXT NULL | Optional stage change |
| `reason_category` | TEXT NOT NULL | SEM-GOV-001 §10 token; required |
| `reason_detail_safe` | TEXT NULL | Public-safe detail only |
| `source_actor` | TEXT NOT NULL | `governor`, `scout_fip_refresh`, `rollover_job`, `sports_truth`, `operator` |
| `source_ref` | TEXT NULL | fip_id, rollover_key, publish_run_id |
| `scout_fip_id` | TEXT NULL | Reference only — no full FIP body |
| `scout_validation_hash` | TEXT NULL | Reference only |
| `idempotency_key` | TEXT NOT NULL | See §10 |
| `occurred_at` | TIMESTAMPTZ NOT NULL | Business event time |
| `recorded_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Append audit time |

**Required uniqueness:** `UNIQUE(fixture_uid, idempotency_key)`

Events are **append-only**. Updates and deletes are forbidden except governed retention purge after archival window.

---

## 10. Transition idempotency and optimistic concurrency

### 10.1 Idempotency key

```
idempotency_key = SHA-256(
  fixture_uid + "|" +
  to_state + "|" +
  COALESCE(to_stage, "") + "|" +
  reason_category + "|" +
  source_actor + "|" +
  COALESCE(source_ref, "") + "|" +
  floor(occurred_at_epoch_seconds)
)
```

Duplicate `(fixture_uid, idempotency_key)` insert → reject with **`LIFECYCLE_DUPLICATE_EVENT`** (or no-op return existing `event_id` when separately authorized for exactly-once workers).

### 10.2 Optimistic concurrency

Projection update:

```sql
UPDATE fixture_lifecycle_current
SET ..., transition_version = transition_version + 1
WHERE fixture_uid = $1 AND transition_version = $expected_version
```

Zero rows updated → reject with **`LIFECYCLE_STALE_VERSION`**.

### 10.3 Reason requirement

Any transition that changes `lifecycle_state` or `lifecycle_stage` must include a non-empty **`reason_category`** from SEM-GOV-001 §10. Missing reason → **`LIFECYCLE_REASON_REQUIRED`**.

---

## 11. Legal state transition matrix

Any transition **not listed below** must fail closed with **`LIFECYCLE_TRANSITION_NOT_ALLOWED`**.

### 11.0 Legal transition summary (required edges)

```
VISIBLE → UNDER_REVIEW
VISIBLE → HELD
VISIBLE → ELIMINATED
VISIBLE → CANCELLED
VISIBLE → POSTPONED
UNDER_REVIEW → HELD
UNDER_REVIEW → ELIMINATED
UNDER_REVIEW → FINAL_APPROVED
UNDER_REVIEW → CANCELLED
UNDER_REVIEW → POSTPONED
HELD → UNDER_REVIEW
HELD → ELIMINATED
HELD → CANCELLED
HELD → POSTPONED
FINAL_APPROVED → HELD
FINAL_APPROVED → CANCELLED
FINAL_APPROVED → POSTPONED
FINAL_APPROVED → ARCHIVED
POSTPONED → VISIBLE
POSTPONED → UNDER_REVIEW
CANCELLED → ARCHIVED
ELIMINATED → ARCHIVED
(admission) → VISIBLE
```

### 11.1 From VISIBLE

| To state | Legal | Notes |
|---|---|---|
| `UNDER_REVIEW` | **YES** | Normal progression start |
| `HELD` | **YES** | Requires reason_category |
| `ELIMINATED` | **YES** | Requires elimination_category |
| `CANCELLED` | **YES** | Sports truth cancellation |
| `POSTPONED` | **YES** | Sports truth postponement |
| `FINAL_APPROVED` | **NO** | Must pass through UNDER_REVIEW |
| `ARCHIVED` | **NO** | Must pass through terminal or rollover path |

### 11.2 From UNDER_REVIEW

| To state | Legal |
|---|---|
| `HELD` | **YES** |
| `ELIMINATED` | **YES** |
| `FINAL_APPROVED` | **YES** |
| `CANCELLED` | **YES** |
| `POSTPONED` | **YES** |
| `VISIBLE` | **NO** | No backward demotion |
| `ARCHIVED` | **NO** |

### 11.3 From HELD

| To state | Legal |
|---|---|
| `UNDER_REVIEW` | **YES** | Resume after hold cleared |
| `ELIMINATED` | **YES** |
| `CANCELLED` | **YES** |
| `POSTPONED` | **YES** |
| `FINAL_APPROVED` | **NO** | Must return to UNDER_REVIEW first |
| `VISIBLE` | **NO** |

### 11.4 From FINAL_APPROVED

| To state | Legal | Notes |
|---|---|---|
| `HELD` | **YES** | Governance or evidence regression |
| `CANCELLED` | **YES** | Match cancelled after approval |
| `POSTPONED` | **YES** | Revokes publication_eligible |
| `ARCHIVED` | **YES** | Rollover or window exit |
| `ELIMINATED` | **NO** | Use CANCELLED or HELD→ELIMINATED path before approval only |
| `UNDER_REVIEW` | **NO** | Use HELD as intermediate |

### 11.5 From POSTPONED (OD-8)

| To state | Legal | Condition |
|---|---|---|
| `VISIBLE` | **YES** | Only after governed new kickoff update recorded |
| `UNDER_REVIEW` | **YES** | Only after governed new kickoff update recorded |
| `CANCELLED` | **YES** | Source confirms cancellation |
| `ARCHIVED` | **YES** | Window exit |
| All others | **NO** | |

Postponement effects:

- `lifecycle_state` → `POSTPONED`
- `publication_eligible` → **false**
- Existing publication marked for **governed revocation** (event only in 001B law; execution in 001C/F)
- Fixture **remains visible**

### 11.6 From CANCELLED

| To state | Legal |
|---|---|
| `ARCHIVED` | **YES** |
| All others | **NO** |

### 11.7 From ELIMINATED

| To state | Legal |
|---|---|
| `ARCHIVED` | **YES** |
| All others | **NO** |

### 11.8 From ARCHIVED

| To state | Legal |
|---|---|
| All | **NO** | Terminal read-only in active funnel |

### 11.9 Admission (no prior state)

| To state | Legal | Condition |
|---|---|---|
| `VISIBLE` | **YES** | First governed admission within eight-day window, football only, before kickoff |
| All others | **NO** | Initial state must be VISIBLE |

---

## 12. Stage transition rules

Stages progress forward: `ADMITTED` → `EVIDENCE_REVIEW` → `CONTEXT_REVIEW` → `STABILITY_REVIEW` → `PUBLICATION_REVIEW` → `FINAL_DECISION`.

### 12.1 Allowed stage moves

- Advance one or more stages forward when `lifecycle_state` is `UNDER_REVIEW` or `FINAL_APPROVED` (publication path).
- Hold stage unchanged while `lifecycle_state` is `HELD`.
- Reset stage to `ADMITTED` only on governed **new kickoff** after `POSTPONED` with explicit transition and reason `MATCH_POSTPONED` or `TIMING_WINDOW`.

### 12.2 Forbidden stage moves

- **Stage regression** (e.g. `PUBLICATION_REVIEW` → `EVIDENCE_REVIEW`) → **`LIFECYCLE_STAGE_REGRESSION_NOT_ALLOWED`**
- Stage advance while `lifecycle_state` is `ELIMINATED`, `CANCELLED`, or `ARCHIVED`
- Customer exposure of `engine_stage` before `FINAL_APPROVED`

`lifecycle_stage` and `lifecycle_state` are **orthogonal** — stage may advance while HELD only when contract explicitly allows hold-at-stage semantics (stage frozen, state = HELD).

---

## 13. Eight-day SAST admission window (OD-3)

### 13.1 Day labels

| Label | SAST calendar offset from Today |
|---|---|
| `TODAY` | 0 |
| `DAY_2` | +1 |
| `DAY_3` | +2 |
| `DAY_4` | +3 |
| `DAY_5` | +4 |
| `DAY_6` | +5 |
| `DAY_7` | +6 |
| `DAY_8` | +7 |

### 13.2 Admission window calculation

```
timezone = Africa/Johannesburg (SAST, UTC+2)

window_start = SAST calendar date of evaluation at 00:00:00
window_end   = window_start + 8 calendar days at 00:00:00 (exclusive)

A fixture is admissible iff:
  kickoff_at >= window_start
  AND kickoff_at < window_end
  AND kickoff_at > evaluation_time  (see §14 admission cutoff)
  AND sport = football
```

Kickoff outside window → **`FIXTURE_OUTSIDE_ADMISSION_WINDOW`**.

### 13.3 Terminology note

Legacy `SYNC_FUTURE_DAYS = 7` fetch may retrieve Today plus seven following dates, but **lifecycle admission boundaries** are governed by this eight-day SAST law when the Governor is active.

---

## 14. Post-kickoff policy (OD-4)

### 14.1 New fixture admission

**Prohibited at or after scheduled kickoff.**

```
if kickoff_at <= evaluation_time:
  reject FIXTURE_ALREADY_STARTED
```

### 14.2 Already-admitted processing tolerance

Fixtures **already admitted** (existing `fixture_uid` in current projection) receive **15 minutes** after scheduled kickoff for clock and provider latency:

```
processing_tolerance_end = kickoff_at + 15 minutes

if evaluation_time <= processing_tolerance_end:
  fixture remains a normal pre-match processing candidate
else:
  fixture may remain VISIBLE but is no longer a normal pre-match candidate
  (does not auto-ELIMINATE; governed transition required)
```

### 14.3 Non-lifecycle rules (explicitly excluded)

The following are **not lifecycle admission policy** and must not be conflated in Governor law:

| Rule | Location | Classification |
|---|---|---|
| 2-hour stale metadata cutoff | `filterEngine.js` | Processing law — **not lifecycle admission policy** — deferred to 001C |
| 6-hour insight grace | `insightEngine.js` | Processing law — **not lifecycle admission policy** — deferred |
| 24-hour ACCA grace | `accaLogicEngine.js` | Legacy ACCA law — **not lifecycle admission policy** — deferred to 001F |
| 48-hour FIP horizon | `fipIntakeService.js` | Intake law — unchanged until 001C (OD-5) |

---

## 15. Rollover law (OD-6)

### 15.1 Ownership

The **Lifecycle Governor** owns rollover semantics. Execution uses an idempotent scheduled worker with catch-up support.

### 15.2 Rollover key

```
rollover_key = SAST calendar date (YYYY-MM-DD) of the rollover execution
```

Future table: **`fixture_lifecycle_rollover_events`** (declarative only)

| Column | Notes |
|---|---|
| `rollover_id` | UUID PK |
| `rollover_key` | DATE NOT NULL UNIQUE |
| `executed_at` | TIMESTAMPTZ |
| `fixtures_archived_count` | INT |
| `fixtures_carried_forward` | INT |
| `day8_admitted_count` | INT |
| `snapshot_json` | Funnel counters per SEM-GOV-001 §8 |

### 15.3 Midnight rollover sequence (00:00 SAST)

1. Completed or expired **TODAY** fixtures → transition to `ARCHIVED` where legally permitted.
2. Relabel day buckets: DAY_2→TODAY, …, DAY_8→DAY_7.
3. Open new **DAY_8** calendar bucket.
4. Append rollover event with funnel snapshot.
5. **`fixture_uid` and transition history remain continuous** — no funnel rebuild from scratch.

### 15.4 Missed rollover catch-up

- If midnight execution is missed, worker runs **once** for the **latest missing** `rollover_key` on recovery.
- **Never apply the same calendar-date rollover twice** → duplicate → **`ROLLOVER_ALREADY_APPLIED`**.
- Gap in rollover sequence detected → **`ROLLOVER_DATE_GAP`** until catch-up completes.

---

## 16. Scout FIP provenance references (no full retention)

Per EST-001 and OD-7:

### 16.1 Permitted references on lifecycle records

- `scout_fip_id`
- `scout_validation_hash`
- `fip_schema_version`
- `scout_run_id` (in `source_ref` or dedicated column when implemented)
- `idempotency_key` from EFI-001

### 16.2 Forbidden on lifecycle tables

- Full validated FIP JSON body
- Raw provider dumps
- Scout evidence archives
- H2H/history mirrors
- Internal probabilities, prompts, model weights

### 16.3 EST-001 retention classifications (declarative)

| Class | Future surface | Retention | 001B status |
|---|---|---|---|
| **R1** | `fip_provenance_refs` | Co-terminus with prediction + 180d post-settlement | **Schema reserved only** — no migration |
| **R2** | `fip_intake_events` | 90d default / 365d proof | **Schema reserved only** — no migration |
| **D1** | Existing prediction tables | Existing Edge policies | Unchanged |
| **Lifecycle events** | `fixture_lifecycle_transition_events` | Co-terminus with fixture archive + 180d | **Schema reserved only** |
| **Rollover** | `fixture_lifecycle_rollover_events` | 365d audit | **Schema reserved only** |
| **F1** | Forbidden mirrors | **FORBIDDEN** | Enforced in contract law |

---

## 17. Governed reason categories

All hold, elimination, rejection, and transition events must use tokens from **SEM-GOV-001 §10**, including at minimum:

`TIMING_WINDOW`, `INSUFFICIENT_EVIDENCE`, `CONFIDENCE_THRESHOLD`, `VOLATILITY_ELEVATED`, `MARKET_CONFLICT`, `CONTROL_PLANE_HOLD`, `SEMANTIC_ALIGNMENT`, `SPORT_NOT_ACTIVE`, `PUBLICATION_DEFERRED`, `MATCH_CANCELLED`, `MATCH_POSTPONED`, `APPROVED`

Free-text-only reasons without category token are forbidden for lifecycle persistence.

---

## 18. Required rejection codes

| Code | When |
|---|---|
| `FIXTURE_IDENTITY_CONFLICT` | Ambiguous alias resolution |
| `FIXTURE_ALIAS_CONFLICT` | Duplicate namespace+value for different fixture_uid |
| `SPORT_NOT_ACTIVE` | Non-football sport on persistence path |
| `FIXTURE_OUTSIDE_ADMISSION_WINDOW` | Kickoff outside eight-day SAST window |
| `FIXTURE_ALREADY_STARTED` | New admission at or after kickoff |
| `LIFECYCLE_TRANSITION_NOT_ALLOWED` | Unspecified or illegal state transition |
| `LIFECYCLE_STAGE_REGRESSION_NOT_ALLOWED` | Forbidden backward stage move |
| `LIFECYCLE_STALE_VERSION` | Optimistic concurrency failure |
| `LIFECYCLE_DUPLICATE_EVENT` | Duplicate idempotency key |
| `LIFECYCLE_REASON_REQUIRED` | Missing reason_category |
| `LIFECYCLE_GATE_BLOCKED` | `unified_lifecycle_governor` not authorized |
| `LIFECYCLE_FEATURE_DISABLED` | `LIFECYCLE_GOVERNOR_ENABLED` is false |
| `ROLLOVER_ALREADY_APPLIED` | Duplicate rollover_key |
| `ROLLOVER_DATE_GAP` | Missing rollover dates in sequence |

---

## 19. Replay and projection-rebuild law

1. Load all `fixture_lifecycle_transition_events` for `fixture_uid` ordered by `transition_version` ascending.
2. Fold through pure `evaluateTransition()` against §11–§12 matrix.
3. Result must equal `fixture_lifecycle_current` projection.
4. Cross-check Scout provenance refs against authorized alias rows — never replay from full FIP body.
5. **Never** rebuild lifecycle history from `pipelineLogger`, `reject_reason` free text, or in-memory funnel counters.

---

## 20. Governor activation sequence (OD-9)

Governor may affect production processing **only when all** are true:

1. `unified_lifecycle_governor` gate in ledger is **explicitly authorized** (not BLOCKED)
2. `LIFECYCLE_GOVERNOR_ENABLED` runtime feature flag is **true**
3. Separate Stephen approval recorded in Control Center
4. SEM-GOV-001B implementation packet (post-contract) proven

**Fail-closed defaults:**

- `unified_lifecycle_governor` = **BLOCKED**
- `LIFECYCLE_GOVERNOR_ENABLED` = **false**
- Feature flag **cannot** override governance gate → **`LIFECYCLE_GATE_BLOCKED`** wins over flag

---

## 21. Rollback boundary

SEM-GOV-001B implementation rollback (future) must:

- Remove Governor service and lifecycle tables only
- **Not mutate** `direct1x2_prediction_final`, `predictions_raw`, or existing pipeline tables
- Default `LIFECYCLE_GOVERNOR_ENABLED=false`
- Leave `unified_lifecycle_governor=BLOCKED`

---

## 22. Migration and backfill risks

| Risk | Mitigation |
|---|---|
| Bare `match_id` collisions across providers | Alias registry with conflict rejection; no fuzzy merge |
| Multiple legacy IDs per real fixture | Deterministic alias linking only; unresolved stays unlinked |
| No historical transition events | Synthetic admission event with `SEMANTIC_ALIGNMENT` only where evidence deterministic |
| Semantic layer cancel→Postponed collapse | Governor uses separate CANCELLED and POSTPONED; do not import legacy mapping |
| Parallel publish tables | Link via aliases; do not merge tables in 001B |
| Seven-day sync vs eight-day window | Governor admission law authoritative when active |
| 48-hour FIP vs eight-day window | Unchanged until 001C proves supersession |

---

## 23. Deferred work SEM-GOV-001C through 001H

| Phase | Scope | Status |
|---|---|---|
| **001C** | Scout FIP pipeline hooks; supersede 48-hour horizon when proven; scoring window | **DEFERRED** |
| **001D** | SMH fixture-first navigation; rolling eight-day UI | **DEFERRED** |
| **001E** | BOT transparency; Help/onboarding | **DEFERRED** |
| **001F** | Direct Insights; secondary markets; ACCA alignment | **DEFERRED** |
| **001G** | Football end-to-end proof | **DEFERRED** |
| **001H** | Multi-sport rollout; lift SPORT_NOT_ACTIVE | **DEFERRED** |

---

## 24. Definition of Done — SEM-GOV-001B-C1

SEM-GOV-001B-C1 is complete only when:

- [x] Contract records OD-1 through OD-10
- [x] Six stages and eight states reused without alteration
- [x] Legal transition matrix defined (§11)
- [x] Stage transition rules defined (§12)
- [x] Fixture UUID and alias law explicit (§6–§7)
- [x] Current projection and append-only event schemas specified (§8–§9)
- [x] Eight-day SAST boundaries and rollover law exact (§13, §15)
- [x] Admission cutoff and 15-minute tolerance distinct (§14)
- [x] Postponement, cancellation, archival handling defined (§11.5–§11.7)
- [x] EST-001 forbidden-persistence law preserved (§16)
- [x] All three governance gates remain BLOCKED (§20)
- [x] Focused contract tests pass
- [x] Control Center registration complete
- [ ] Physical DDL, runtime Governor, APIs, UI — **explicitly not in 001B-C1**

---

## 25. Contract boundary (SEM-GOV-001B-C1)

This contract **does**:

- Seal football lifecycle persistence law and owner decisions OD-1–OD-10
- Define future table shapes, indexes, transition matrix, and rejection codes
- Preserve 48-hour FIP rule unchanged until 001C
- Reserve R1/R2 shapes without authorizing migration

This contract **does not**:

- Implement runtime code, SQL, Supabase migrations, APIs, or UI
- Clear `scout_edge_marriage_gate`, `supabase_storage_gate`, or `unified_lifecycle_governor`
- Create R1/R2 or lifecycle persistence tables in Supabase
- Repair ESG-001, ALI-001, RLL-001, or SPM-001 baseline defects
- Start SEM-GOV-001C
- Change non-football sport behavior
