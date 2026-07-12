# EMG-001 — Scout–Edge Marriage Gate Contract v1

## Contract status

| Field | Value |
|---|---|
| **Contract ID** | `EMG-001_SCOUT_EDGE_MARRIAGE_GATE_CONTRACT.v1` |
| **Governed task** | `EMG-001` — Scout-Edge Marriage Gate Contract |
| **Gate control field** | `scout_edge_marriage_gate` in `EDGE_BUILD_CONTROL_LEDGER.v1.json` |
| **Contract mode** | Contract-only (EMG-001-C1) |
| **Gate state after this contract** | **BLOCKED** |
| **Date sealed** | 2026-07-12 |
| **Prior evidence** | `SEE-001_SCOUT_EDGE_E2E_MARRIAGE_PROOF.v1.md` |

---

## 1. Gate purpose

The Scout–Edge marriage gate is the **explicit fail-closed control** that prevents Edge from treating Scout as its sports-truth provider until all governed prerequisites are proven and the gate is **separately approved**.

This gate exists because:

1. Scout and Edge are intentionally separate systems (Neon vs Supabase).
2. Edge currently still acquires sports truth from external providers.
3. A governed FIP intake boundary does not yet exist.
4. Storage, security, pipeline-integrity, and provider-removal laws are incomplete.
5. Control Center must not allow hidden integration work to bypass sequencing.

**The gate does not auto-clear.** Even when every prerequisite reaches `TESTED`, `COMMITTED`, or `DONE`, `scout_edge_marriage_gate` remains `BLOCKED` until a separate explicit operator authorization changes it.

---

## 2. Architectural law (non-negotiable)

| System | Responsibility |
|---|---|
| **Scout** | Governed sports truth, acquisition, evidence, FIP assembly and validation |
| **Edge** | FIP consumption, prediction analysis, scoring, filtering, publication, users/subscribers |
| **Scout database** | Neon |
| **Edge database** | Supabase |
| **Sports-truth direction** | Scout → validated FIP boundary → Edge |
| **Raw Scout evidence mirror in Supabase** | Forbidden by default |
| **Full FIP permanent retention in Supabase** | Gated by `EST-001` |

---

## 3. Governed sequence

Marriage work must follow this order. No step may be skipped.

```text
EMG-001  Marriage gate contract (+ future validator/tests)
  ↓
EFI-001  FIP intake handshake (contract + smallest fail-closed boundary)
  ↓
EST-001  Supabase transport and retention law
  ↓
E2E-001  Controlled Scout→Edge end-to-end proof
  ↓
[Separate explicit approval] scout_edge_marriage_gate clearance
```

Supporting prerequisites that must also reach satisfied status before E2E-001 may complete:

- `ESEC-001` — Subscriber and Security Boundary
- `EPI-001` — Prediction Pipeline Integrity
- `EPRV-001` — External Sports Provider Removal

---

## 4. Marriage prerequisites

A prerequisite is **satisfied** only when its ledger/register status is one of: `TESTED`, `COMMITTED`, or `DONE`.

| ID | Prerequisite | Role in marriage | Current state (at EMG-001-C1 seal) |
|---|---|---|---|
| **EMG-001** | Marriage gate contract | Defines gate law; validator/tests may follow in a later packet | **APPROVED** (contract sealed; gate stays BLOCKED) |
| **EFI-001** | FIP intake handshake | Single fail-closed boundary for validated canonical FIP | PROPOSED |
| **EST-001** | Supabase storage and FIP retention | Transport vs retention law; ~0.5 GB constraint | PROPOSED |
| **ESEC-001** | Subscriber and security boundary | Auth, RLS, service role, commercial boundary | PROPOSED |
| **EPI-001** | Prediction pipeline integrity | Protects scoring/filtering/publication invariants | PROPOSED |
| **EPRV-001** | External sports provider removal | Removes reachable direct sports acquisition | PARTIAL |
| **E2E-001** | Scout→Edge end-to-end proof | Final technical proof before gate clearance request | BLOCKED |

**Prerequisites complete:** **NO** (at seal time)

---

## 5. Allowed data source for first E2E proof

The first governed Scout–Edge E2E proof (`E2E-001`) may use **only** the following sports-truth origin:

### Allowed (only after EFI-001 is implemented and EST-001 retention law is defined)

```text
Validated canonical Scout FIP (FIP-001)
  → EFI-001 governed intake boundary (fail-closed validation, provenance, idempotency)
    → transient Edge analysis envelope
      → aiPipeline.buildRawPredictionFromProviderItem()
```

**Requirements for the proof fixture:**

1. FIP must be an **unmodified validated canonical Scout FIP** per `FIP-001` (committed crosswalk required before proof).
2. FIP must enter Edge **only** through the `EFI-001` intake boundary — not through legacy provider paths.
3. Provenance (`fip_id`, schema version, validation hash, source timestamp) must be preserved per `EST-001`.
4. The proof fixture must be **one controlled fixture set** authorized by Control Center, not production traffic.

### Explicitly not allowed as E2E proof sources

| Source | Ruling |
|---|---|
| `dataProvider.getPredictionInputs()` → `buildLiveData()` | **FORBIDDEN** for E2E proof — external provider acquisition |
| `contextIngestionService.js` / `contextEnrichmentService.js` / `footballHighlightsService.js` | **FORBIDDEN** — parallel acquisition surfaces |
| `syncService.js` calling `buildLiveData()` | **FORBIDDEN** for proof sports-truth origin |
| `scripts/import-today-snapshot-pipeline.js` | **FORBIDDEN** — snapshot acquisition |
| `POST /api/pipeline/run { matches: [...] }` | **FORBIDDEN** for E2E proof — admin manual injection without FIP validation/provenance |
| `public/data/*` context packs | **FORBIDDEN** — illustrative samples, not governed FIP authority |
| Workspace candidates (`scoutSignalSync.js`, `intel_read_contract_v1.md`) | **FORBIDDEN** until committed, registered, and governed |
| Direct Neon/Scout DB reads bypassing EFI-001 | **FORBIDDEN** |

---

## 6. Blocked conditions (fail-closed)

Edge **must remain blocked** from Scout marriage when **any** of the following is true:

### Gate-level blocks

1. `scout_edge_marriage_gate` is `BLOCKED` (default; requires explicit separate clearance).
2. Any marriage prerequisite in §4 is not satisfied.
3. No separate explicit operator authorization has been recorded to clear the gate.

### Contract-level blocks

4. No committed `FIP-001` artifact or approved crosswalk exists in the governed repository.
5. No `EFI-001` fail-closed intake boundary exists in committed runtime.
6. No `EST-001` transport/retention contract defines what Edge may retain in Supabase.
7. `EPRV-001` is not satisfied — reachable direct external sports acquisition remains.
8. `ESEC-001` or `EPI-001` is not satisfied — security/pipeline boundary not proven.
9. `E2E-001` is not satisfied — no controlled end-to-end proof packet exists.

### Implementation-level blocks (current committed state)

10. Pipeline configured path still originates from `buildLiveData()` external acquisition.
11. Scout/FIP contract files exist only as workspace candidates, not committed authority.
12. `scout_fip_visibility_activates_marriage` inventory semantics remain `false` — surface tagging alone cannot clear the gate.

---

## 7. Pass / fail rules

### Gate clearance request — PASS requires ALL

| # | Rule |
|---|---|
| G1 | Every prerequisite in §4 is satisfied (`TESTED`, `COMMITTED`, or `DONE`) |
| G2 | `E2E-001` proof packet demonstrates: FIP intake, validation, idempotency, analysis, provenance linkage, minimal retention |
| G3 | Provider reachability proof shows **zero** reachable direct external sports acquisition for proof scope |
| G4 | `EST-001` retention proof shows no forbidden Scout evidence mirror in Supabase |
| G5 | Operator records **separate explicit authorization** to set `scout_edge_marriage_gate` to `APPROVED` or `OPEN` |
| G6 | No cleanup programme reopening without Control Center approval |

### Gate clearance request — FAIL if ANY

| # | Rule |
|---|---|
| F1 | Any prerequisite incomplete |
| F2 | E2E proof used a forbidden data source from §5 |
| F3 | FIP entered Edge outside `EFI-001` boundary |
| F4 | Provenance or idempotency not demonstrated |
| F5 | External provider acquisition still reachable for sports truth |
| F6 | Gate cleared without explicit separate authorization |
| F7 | Implementation attempted under EMG-001 contract-only scope |

### EMG-001 contract completion — current packet

| Criterion | EMG-001-C1 result |
|---|---|
| Marriage gate contract written | **PASS** |
| Prerequisites listed | **PASS** |
| Gate remains BLOCKED | **PASS** |
| No intake implementation added | **PASS** |
| Contract validator + automated tests | **DEFERRED** (future EMG-001 packet) |

---

## 8. Required evidence before EFI-001 intake implementation

`EFI-001` implementation must **not** begin until the following evidence exists:

### From EMG-001 (this contract)

1. This contract file is committed and referenced in Control Center.
2. `scout_edge_marriage_gate` remains `BLOCKED`.
3. Allowed/forbidden proof sources in §5 are acknowledged.
4. Governed sequence in §3 is acknowledged.

### Must exist before EFI-001 implementation (not necessarily before EFI-001 contract drafting)

5. **Committed `FIP-001` crosswalk** — canonical Scout FIP schema registered in governed assets (import `intel_read_contract_v1.md` or equivalent Scout authority).
6. **Edge intake contract draft** — maps FIP fields → `match_info` / `sharp_odds` / `contextual_intelligence`.
7. **Insertion point declaration** — intake boundary upstream of `buildRawPredictionFromProviderItem()`, replacing `getPredictionInputs()` sports-truth origin for governed mode.
8. **Fail-closed validation rules** — schema version, required fields, rejection behavior.
9. **Idempotency key law** — re-ingest same FIP without duplicate predictions.
10. **Provenance fields** — minimum metadata preserved through analysis.

### Explicit non-requirements for EFI-001 contract inspection

- Provider removal completion (`EPRV-001`) is **not** required to **draft** EFI-001 contract.
- Provider removal **is** required before `E2E-001` proof and gate clearance.

---

## 9. Edge analysis envelope (downstream contract reference)

After EFI-001 intake, Edge analysis expects items conforming to:

```json
{
  "match_info": { "match_id": "...", "home_team": "...", "away_team": "..." },
  "sharp_odds": {},
  "contextual_intelligence": {}
}
```

EFI-001 owns the **FIP → envelope** crosswalk. EMG-001 does not define field-level mapping.

---

## 10. Control Center integration

| Artifact | Responsibility |
|---|---|
| `EDGE_BUILD_CONTROL_LEDGER.v1.json` | `scout_edge_marriage_gate`, task statuses, `MARRIAGE_PREREQUISITES` |
| `EDGE_MASTER_PROJECT_REGISTER.v1.json` | Project mirror for `EMG-001` and dependents |
| `EDGE_CONTROL_CENTER.md` | Operator-facing state and evidence notes |
| `check_control_center.js` | Fail-closed gate and prerequisite checks |
| This contract | Authoritative marriage gate law for EMG-001-C1 |

**Future packet (not EMG-001-C1):** contract validator and tests proving incomplete prerequisites cannot clear the gate.

---

## 11. Validation boundary

This contract:

- **Does** define when Edge is allowed to accept Scout/FIP data.
- **Does** keep the gate **BLOCKED** at seal time.
- **Does** authorize EFI-001 contract inspection when separately approved.
- **Does not** authorize EFI-001 implementation, provider removal, Supabase mutation, deployment, or gate clearance.
- **Does not** reopen the repository cleanup programme.

---

## 12. References

- `SEE-001_SCOUT_EDGE_E2E_MARRIAGE_PROOF.v1.md`
- `EDGE_CONTROL_CENTER.md` §1–§6
- `EDGE_BUILD_CONTROL_LEDGER.v1.json` — `EMG-001`, `EFI-001`, `EST-001`, `E2E-001`
- `FIP-001` (referenced; committed artifact pending)
