# E2E-001 — Scout to Edge End-to-End Proof Planning Packet v1

## Packet status

| Field | Value |
|---|---|
| **Packet ID** | `E2E-001_SCOUT_EDGE_PROOF_PLANNING_PACKET.v1` |
| **Governed task** | `E2E-001` — Scout to Edge End-to-End Proof |
| **Packet mode** | Planning-only (E2E-001-C1) |
| **`E2E-001` task status** | **BLOCKED** (unchanged) |
| **`scout_edge_marriage_gate`** | **BLOCKED** (unchanged) |
| **`supabase_storage_gate`** | **BLOCKED** (unchanged) |
| **Actual E2E proof run** | **FORBIDDEN** in this packet |
| **Date sealed** | 2026-07-12 |
| **Start commit** | `43aad4f2edc60542622889580d2980387f3e5b52` |
| **Sealed contracts** | EMG-001-C1, EFI-001-C1, EST-001-C1, SEE-001 |

---

## 1. Purpose

This packet defines the **first safe Scout–Edge end-to-end proof plan** using the sealed contract trilogy. It does **not** implement intake, run the proof, mutate Supabase, or clear any gate.

E2E-001-C1 answers:

1. What exact FIP sample is required?
2. Where must it come from?
3. What Edge boundary must receive it in the future?
4. What must be proven before prediction use?
5. What evidence must be captured?
6. Which blockers remain before implementation?

---

## 2. Planning verdict

| Criterion | Result |
|---|---|
| Proof plan written | **PASS** |
| FIP sample requirements defined | **PASS** |
| Edge intake behavior mapped from EFI-001 | **PASS** |
| Supabase/audit behavior mapped from EST-001 | **PASS** |
| Marriage gate criteria mapped from EMG-001 | **PASS** |
| Current state remains BLOCKED | **PASS** |
| Runtime implementation added | **NO** |
| Actual E2E proof executed | **NO** |

**Overall:** **PLANNING COMPLETE — EXECUTION BLOCKED**

---

## 3. Governed proof route (future execution target)

This is the **only** authorized route for the first E2E proof when separately approved for implementation + execution.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE A — Scout authority (canonical)                                   │
│   Scout Neon: one validated canonical FIP (FIP-001)                       │
│   validation.status = VALIDATED                                         │
│   validation.hash computed at Scout                                     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ governed transport (T0 transient only)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE B — EFI-001 intake boundary (NOT YET IMPLEMENTED)                 │
│   fipIntakeBoundary.receiveValidatedFip(payload, { mode: PROOF_FIXTURE })│
│   → schema / hash / field / idempotency / authorization validation      │
│   → emit EdgeAnalysisEnvelope                                           │
│   → record R2 intake audit event                                        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ envelope only; no full FIP persist
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE C — Edge analysis (existing pipeline hook)                        │
│   aiPipeline.buildRawPredictionFromProviderItem(envelope)               │
│   → insertRawPrediction / filterRawPrediction                           │
│   → persist D1 derived outputs                                          │
│   → persist R1 provenance linkage on outputs                            │
└───────────────────────────────┬─────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE D — Proof verification (read-only checks)                         │
│   Verify: no buildLiveData() in proof path                              │
│   Verify: R1 + R2 rows present; no F1 forbidden rows                    │
│   Verify: idempotency replay produces NO_OP                             │
│   Verify: provenance joins prediction ↔ fip_id ↔ validation.hash        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Explicitly forbidden proof routes

| Route | Ruling |
|---|---|
| `dataProvider.getPredictionInputs()` → `buildLiveData()` | **FORBIDDEN** |
| `POST /api/pipeline/run { matches }` without EFI-001 boundary | **FORBIDDEN** |
| `public/data/*` context packs | **FORBIDDEN** |
| Workspace candidates as authority | **FORBIDDEN** |
| Supabase-stored FIP body as replay source | **FORBIDDEN** |

---

## 4. Required Scout/FIP sample

### 4.1 Sample cardinality

| Requirement | Law |
|---|---|
| Fixture count | **Exactly 1** controlled proof fixture |
| Sport | **Football** (phase-1 deployment sport) |
| Mode | `PROOF_FIXTURE` only |
| Authorization | Separate Control Center authorization for proof execution packet |

### 4.2 Sample source

| Field | Requirement |
|---|---|
| **Origin system** | Scout (Neon) |
| **Package type** | Validated canonical FIP per `FIP-001` (committed authority required before execution) |
| **Validation** | `validation.status = VALIDATED` at source |
| **Integrity** | `validation.hash` from Scout; unmodified in transit |
| **Delivery** | Governed transport into EFI-001 boundary — not manual Edge construction |
| **Fixture window** | Kickoff ≥ 24 hours in future at proof time (pre-match only) |
| **League** | One allowlisted football league already supported by Edge deployment sport gates |

### 4.3 Minimum sample payload (EFI-001 §5 alignment)

The proof FIP must include all EFI-001 required fields:

**Wrapper:** `fip_id`, `fip_schema_version`, `validation.status`, `validation.hash`, `validation.validated_at`, `scout.fixture_id`, `provenance.scout_run_id`, `provenance.source_system = SCOUT`

**Fixture:** sport, league_id, league, kickoff_utc, status, home/away team id+name

**Markets:** `markets.direct_1x2` with home/draw/away odds (finite) and `markets.source` = Scout-governed

**Context:** weather, injuries, suspensions, availability, h2h, form, lineups (keys present; empty arrays/objects permitted where Scout has no truth)

### 4.4 Sample identifier (reserved for proof packet)

```text
proof_fixture_id: E2E-001-PROOF-001
proof_fip_id: assigned by Scout at validation time (recorded in evidence)
idempotency_key: SHA-256(fip_id + "|" + validation.hash + "|" + fip_schema_version)
```

---

## 5. Required Edge intake behavior (from EFI-001)

Before any prediction use, the future EFI-001 boundary must:

| Step | EFI-001 law | Proof must demonstrate |
|---|---|---|
| 1 | Schema version gate | Unsupported version → `FIP_SCHEMA_UNSUPPORTED` reject |
| 2 | Validation status gate | Non-VALIDATED → `FIP_NOT_VALIDATED` reject |
| 3 | Hash integrity gate | Tampered payload → `FIP_HASH_MISMATCH` reject |
| 4 | Required field gate | Missing §5 field → `FIP_REQUIRED_FIELD_MISSING` reject |
| 5 | Identity consistency | Team/fixture mismatch → `FIP_IDENTITY_INCONSISTENT` reject |
| 6 | Idempotency gate | Duplicate key → `NO_OP` or `FIP_IDEMPOTENCY_DUPLICATE` per EFI-001 §8 |
| 7 | Authorization gate | `governed_mode = PROOF_FIXTURE` recorded |
| 8 | Envelope mapping | Valid `EdgeAnalysisEnvelope` with `metadata.sports_truth_origin = SCOUT_FIP` |
| 9 | Audit record | EFI-001 §9 evidence fields captured |
| 10 | Prediction gate | No `buildRawPredictionFromProviderItem()` until steps 1–9 pass |

### Future insertion point

```text
backend/services/fipIntakeService.js  (reserved, not implemented)
  → replaces sports-truth origin for PROOF_FIXTURE mode
  → calls aiPipeline.buildRawPredictionFromProviderItem() only after validation
```

**`POST /api/pipeline/run { matches }` must not be used as the governed proof boundary.**

---

## 6. Required Supabase/audit behavior (from EST-001)

### 6.1 What the proof may persist

| Class | Artifact | Required in proof? |
|---|---|---|
| **T0** | Full FIP in memory during intake | YES (transient only) |
| **R1** | Provenance reference row | YES on successful intake |
| **R2** | Intake audit event | YES for every attempt (accept/reject/no-op) |
| **R3** | Optional envelope hash snapshot | OPTIONAL (proof mode, 30-day retention) |
| **D1** | Derived prediction outputs | YES — at least one valid prediction row |
| **F1** | Full FIP body / Scout mirror | **FORBIDDEN** — proof fails if present |

### 6.2 Future schema targets (declarative — not created in E2E-001-C1)

| Table (reserved) | Proof verification query |
|---|---|
| `fip_intake_events` | Row exists for `intake_id` with `governed_mode = PROOF_FIXTURE` |
| `fip_provenance_refs` | Row exists with `idempotency_key` and `fip_id` |
| `fip_prediction_links` | Join to `predictions_raw` / `direct1x2_prediction_final` ids |
| Prediction tables | `fip_id`, `validation_hash` columns populated per EST-001 §5.2 |

### 6.3 Audit evidence checklist (EST-001 §8.2)

| # | Evidence | Storage class |
|---|---|---|
| E1 | Intake event with result `ACCEPTED` | R2 |
| E2 | Provenance reference row | R1 |
| E3 | Prediction linkage ids | R1 |
| E4 | Idempotency replay `NO_OP` event | R2 |
| E5 | Storage budget snapshot at intake | R2 metadata |
| E6 | Absence proof: no `fip_body` / forbidden columns | F1 negative test |
| E7 | Purge not required during proof (fixture within retention) | N/A |

### 6.4 Retention during proof

| Class | Proof retention |
|---|---|
| R2 audit | 365 days (EST-001 proof-mode allowance) |
| R1 provenance | Co-terminus with proof prediction + 180 days post-settlement |
| T0 / F1 | Must not persist |

---

## 7. Marriage gate pass/fail mapping (from EMG-001)

### 7.1 E2E proof pass criteria (future execution)

The first E2E proof **PASSES** only if **all** are demonstrated:

| ID | EMG-001 / E2E criterion | Evidence |
|---|---|---|
| P1 | FIP entered only through EFI-001 boundary | Route trace + R2 caller field |
| P2 | Validation + idempotency + provenance preserved | EFI-001 §8–§9 records |
| P3 | Derived prediction output produced | D1 row exists |
| P4 | Provenance linkage on output | R1 join to D1 |
| P5 | No forbidden Supabase mirror | F1 negative check |
| P6 | No `buildLiveData()` in proof execution path | Runtime reachability proof |
| P7 | Idempotency replay does not duplicate prediction | R2 `NO_OP` + single D1 |
| P8 | `governed_mode = PROOF_FIXTURE` recorded | R2 metadata |

### 7.2 E2E proof fail criteria (any one fails the proof)

| ID | Condition |
|---|---|
| F1 | Sports truth from external provider or manual injection |
| F2 | Full FIP body persisted in Supabase |
| F3 | Prediction created without intake audit |
| F4 | Hash mismatch or unvalidated FIP accepted |
| F5 | Duplicate prediction on idempotency replay |
| F6 | `metadata.sports_truth_origin` ≠ `SCOUT_FIP` |

### 7.3 Marriage gate clearance (separate from E2E proof pass)

Even if E2E proof **PASSES**, `scout_edge_marriage_gate` clearance requires **additional** EMG-001 conditions:

| EMG-001 gate rule | Status at E2E-001-C1 seal |
|---|---|
| All marriage prerequisites satisfied (`TESTED`/`DONE`/`COMMITTED`) | **NO** — ESEC/EPI/EPRV incomplete |
| E2E-001 proof packet complete | **Planning only** — execution not run |
| Separate explicit operator authorization | **Not recorded** |
| Gate auto-clear | **FORBIDDEN** |

**E2E proof pass ≠ marriage gate clearance.**

---

## 8. Evidence capture plan (future execution packet)

When E2E proof execution is separately authorized, capture this evidence bundle:

| Artifact | Filename convention (reserved) |
|---|---|
| Proof authorization record | Control Center note in `EDGE_CONTROL_CENTER.md` |
| Scout FIP sample manifest | `fip_id`, `validation.hash`, `scout_run_id`, kickoff, teams |
| Intake validation log | R2 export for proof `intake_id` set |
| Idempotency replay log | Second intake attempt → `NO_OP` |
| Prediction output proof | D1 row snapshot with provenance fields |
| Provenance join proof | R1 ↔ D1 linkage query result |
| Provider reachability negative proof | Inventory showing `buildLiveData` not called in proof window |
| Retention negative proof | Schema/query showing no F1 forbidden storage |
| Final proof verdict | `PASS` or `FAIL` with blocker list |

---

## 9. Blockers before implementation and execution

### 9.1 Contract layer (complete)

| Item | Status |
|---|---|
| EMG-001 marriage gate contract | **APPROVED** |
| EFI-001 intake handshake contract | **APPROVED** |
| EST-001 storage/retention contract | **APPROVED** |
| E2E-001 proof plan (this packet) | **APPROVED** |

### 9.2 Implementation blockers (remain)

| # | Blocker | Owner |
|---|---|---|
| B1 | `FIP-001` committed authority artifact in Edge repo | FIP registration packet |
| B2 | EFI-001 runtime intake service/route | EFI-001 implementation packet |
| B3 | EST-001 schema + budget enforcement + purge | EST-001 implementation packet |
| B4 | ESEC-001 subscriber/security boundary | ESEC-001 |
| B5 | EPI-001 prediction pipeline integrity | EPI-001 |
| B6 | EPRV-001 external provider removal (PARTIAL) | EPRV-001 |
| B7 | Controlled Scout FIP sample available from Neon | Scout + proof authorization |
| B8 | `scout_edge_marriage_gate` explicit clearance | Separate operator authorization |
| B9 | `supabase_storage_gate` clearance for persistence | Separate after EST-001 implementation proof |

### 9.3 Execution blockers (this packet)

| Blocker | Status |
|---|---|
| Actual E2E proof run | **FORBIDDEN** in E2E-001-C1 |
| Runtime code changes | **FORBIDDEN** in E2E-001-C1 |
| SQL / Supabase mutation | **FORBIDDEN** in E2E-001-C1 |

---

## 10. Recommended follow-on mini-projects (sequenced)

```text
E2E-001-C1  Proof planning (this packet)           ← COMPLETE
    ↓
FIP-001-C1  Register committed Scout FIP authority (contract/import)
    ↓
EFI-001-I1  Smallest fail-closed intake implementation
    ↓
EST-001-I1  Schema + retention enforcement implementation
    ↓
E2E-001-X1  Controlled proof execution (single fixture, PROOF_FIXTURE mode)
    ↓
[Separate authorization] scout_edge_marriage_gate clearance request
```

---

## 11. Validation boundary

E2E-001-C1:

- **Does** define the first safe Scout–Edge E2E proof plan.
- **Does** keep `E2E-001`, `scout_edge_marriage_gate`, and `supabase_storage_gate` **BLOCKED**.
- **Does not** implement intake, run proof, mutate Supabase, or clear gates.
- **Does not** reopen the cleanup programme.

---

## 12. References

- `SEE-001_SCOUT_EDGE_E2E_MARRIAGE_PROOF.v1.md`
- `EMG-001_SCOUT_EDGE_MARRIAGE_GATE_CONTRACT.v1.md`
- `EFI-001_FIP_INTAKE_HANDSHAKE_CONTRACT.v1.md`
- `EST-001_SUPABASE_STORAGE_AND_FIP_RETENTION_CONTRACT.v1.md`
- `EDGE_BUILD_CONTROL_LEDGER.v1.json` — `E2E-001`, `MARRIAGE_PREREQUISITES`
