# SKCS Edge Control Center

**Generated:** 2026-07-05
**Ledger:** `control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json`
**Check command:** `npm run control:center`

---

> **Scout ↔ Edge marriage remains BLOCKED. Edge Control Center v1 exists to govern the deferred integration, Supabase storage, security, prediction integrity, and external-provider removal before the two systems are connected.**

---

## 1. Edge architectural law

| System | Canonical responsibility |
|---|---|
| **Scout** | Governed sports truth, acquisition, evidence, history, weather truth, availability truth, sports context, H2H evidence, FIP assembly and FIP validation |
| **Edge/Test** | FIP consumption, prediction analysis, probability/scoring, contextual adjustment, market interpretation, filtering, direct prediction logic, ACCA construction, explanation, publication, users and subscribers |
| **Scout database** | Neon |
| **Edge/Test database** | Supabase |
| **Sports truth direction** | Scout → validated FIP boundary → Edge |
| **Subscriber/commercial direction** | Remains inside Edge/Supabase |
| **Raw Scout evidence mirror in Supabase** | Forbidden by default |
| **Full FIP permanent retention in Supabase** | Gated |
| **FIP reference/hash with derived Edge outputs** | Preferred design subject to EST-001 |

Scout and Edge are intentionally separate systems.

The integration bridge was deliberately deferred while Scout's governance, builders, FIP contract, validation, evidence archive, routing, and project-control foundations were stabilized.

The current project is not the discovery of a forgotten bridge.

It is the governed resumption of the intentionally deferred Scout ↔ Edge integration.

---

## 2. Current Edge state

| Dimension | Status |
|---|---|
| **Edge Control Center v1** | DONE |
| **Edge Master Project Register** | TESTED |
| **Full Edge system/runtime inventory** | TESTED |
| **Scout ↔ Edge marriage gate** | BLOCKED |
| **Supabase storage gate** | BLOCKED |
| **External sports provider removal** | PARTIAL |
| **FIP intake handshake** | PROPOSED |
| **Subscriber/security boundary inventory** | PROPOSED |
| **Prediction pipeline integrity inventory** | PROPOSED |
| **Scout → Edge end-to-end proof** | BLOCKED |

---

## 3. Why the marriage gate is blocked

The following technical prerequisites must be satisfied:

| ID | Prerequisite | Current state |
|---|---|---|
| EMG-001 | Scout-Edge Marriage Gate Contract | PROPOSED |
| EFI-001 | FIP Intake Handshake | PROPOSED |
| EST-001 | Supabase Storage and FIP Retention Contract | PROPOSED |
| ESEC-001 | Subscriber and Security Boundary | PROPOSED |
| EPI-001 | Prediction Pipeline Integrity | PROPOSED |
| EPRV-001 | External Sports Provider Removal | PARTIAL |
| E2E-001 | Scout to Edge End-to-End Proof | BLOCKED |

Even when all technical prerequisites are TESTED, COMMITTED, or DONE, `scout_edge_marriage_gate` requires separate explicit approval.

The gate does not auto-clear.

---

## 4. Current provider-removal state

Phase 1 removed selected public/direct provider surfaces and provider-heartbeat startup.

However Edge still has reachable direct sports-acquisition origins.

Known evidence includes:

`backend/services/aiPipeline.js`
→ `getPredictionInputs()`
→ `backend/services/dataProvider.js`
→ `buildLiveData()`
→ external provider acquisition

Additional acquisition surfaces have been identified in:

- `backend/services/contextIngestionService.js`
- `backend/services/contextEnrichmentService.js`
- `backend/services/footballHighlightsService.js`
- `scripts/import-today-snapshot-pipeline.js`

Therefore:

**SCOUT-SOLE-PROVIDER STATE: PARTIAL**

Provider removal must not resume by blindly deleting mixed analysis/acquisition files.

EFI-001 must first define the governed FIP input origin.

---

## 5. Supabase storage law

Edge/Test operates under a constrained Supabase storage budget of approximately 0.5 GB.

The Scout ↔ Edge bridge must not create a second Scout evidence database inside Supabase.

The following distinction is mandatory:

### Transport

What intelligence crosses from Scout to Edge for processing?

### Retention

What subset of that intelligence must Edge permanently retain?

These are separate architecture decisions.

Preferred direction:

Scout FIP
→ Edge intake validation
→ transient analysis input
→ Edge prediction/scoring/explanation
→ Supabase retains derived Edge state plus canonical FIP reference/provenance/hash

Do not permanently copy Scout raw evidence, historical evidence, source archives, or full intelligence history into Supabase by default.

EST-001 owns the final contract.

---

## 6. Protected Edge workstreams

1. **Control Center**
   - Edge ledger
   - Master Project Register
   - project sequencing
   - proof requirements

2. **Architecture Foundation**
   - runtime inventory
   - active/legacy/dead classification
   - reader/writer ownership

3. **Scout Handoff**
   - marriage gate
   - canonical FIP intake
   - idempotency
   - provenance
   - end-to-end proof

4. **Provider Boundary**
   - direct fixture acquisition
   - weather acquisition
   - news/context acquisition
   - H2H acquisition
   - provider fallbacks
   - historical snapshot acquisition

5. **Prediction Pipeline**
   - raw input
   - normalization
   - scoring
   - probability adjustment
   - filtering
   - direct markets
   - secondary markets
   - same-match logic
   - ACCA construction
   - publication

6. **Data and Storage**
   - Supabase capacity
   - retention
   - FIP transport versus storage
   - prediction output retention
   - audit retention

7. **Security and Commercial Boundary**
   - authentication
   - users
   - subscribers
   - service role
   - RLS
   - admin
   - secrets

8. **Prediction Lifecycle**
   - settlement
   - grading
   - accuracy
   - audits
   - backfills

9. **AI and Inference**
   - OpenAI
   - Gemini
   - EdgeMind
   - judge
   - fallback
   - explanation

10. **UI and Delivery**
    - public delivery
    - authenticated delivery
    - subscriber access
    - predictions
    - ACCAs
    - explanations
    - admin

11. **Deployment and Operations**
    - GitHub
    - Render
    - Vercel
    - Supabase
    - migrations
    - schedulers
    - operational workflows
    - environment configuration

---

## 7. Current execution rule

Do not resume architecture implementation from conversation memory alone.

The Control Center ledger determines the current state.

The Master Project Register will become the canonical inventory of Edge projects and subprojects.

Before implementation:

1. confirm the project exists in the register
2. confirm dependencies
3. inspect current state
4. approve the task separately when required
5. implement only the approved boundary
6. require proof
7. update project state

---

<!-- Deprecated sequencing note from the prior gate state.

## 8. Prior sequencing note

Previous allowed startable task snapshot:

EPR-001 closure state:

**EPR-001 — Edge Master Project Register [TESTED]**

Mode:

**IMPLEMENT EPR-001 TESTED PROMOTION ONLY**

Purpose:

Implement the approved Master Project Register + Repository Asset Register foundation only, without performing Scout/FIP intake implementation, provider removal, Supabase mutation, or prediction-rule changes.
Completion contract:
Current tracked coverage evidence is:
- 898 tracked paths
- 898 registered tracked assets
- 0 unclassified tracked paths

This is complete tracked repository coverage. It is not complete local workspace visibility.

Current discovery evidence also identified:
- 40 non-ignored pre-existing untracked workspace paths
- 0 currently registered or explicitly excluded in the asset register
- 40 outside the current asset register boundary

Pre-existing untracked workspace candidates must be discovered separately from tracked repository assets. The underlying untracked artifact does not need to be committed merely to preserve governed evidence that the path was observed. Every discovered pre-existing untracked candidate must be preserved as governed workspace candidate evidence or explicitly excluded with a reason.

Current rule/governance candidate evidence identified:
- 35 total candidate paths
- 34 tracked
- 1 pre-existing untracked

Known first-party rule and governance authority candidates remain identifiable by review role, but this proves inventory visibility rather than a connected authority-review graph:
- 34 tracked candidates currently authority UNKNOWN
- 34 tracked candidates currently owner UNRESOLVED
- 34 tracked candidates governed by EPR-001
- 34 tracked candidates currently have empty related_assets

Candidate status does not establish CURRENT_AUTHORITY. Candidate relationship edges are review relationships, not authority precedence. A candidate with no relationship edge must be explicitly identified as a standalone review candidate with a non-empty reason. Ignored dependency, environment, and cache paths are not first-party authority candidates merely because their names contain rule/governance terms. Final rule/governance authority remains subject to governed review.

UNRESOLVED final project ownership may remain as a non-fatal governed cleanup finding only when the asset remains bound to a valid Control Center task and has a non-empty `next_validation`. EPR-001 is closed and TESTED in this step.

Do not start FIP intake.

Do not resume provider removal.

Do not change Supabase schema.

Do not clear the marriage gate.

Startable tasks: 0

Previous gated task snapshot:
**EAC-001 — Edge Asset Classification and Repository Map [PROPOSED]**

Requires separate approval before start
-->

## 8. Stateful Control Center gate

All AI instructions are proposals.

ChatGPT, Codex, Cursor, and other AI instructions require Control Center GREEN before execution.

The gate is stateful and uses explicit lifecycle state. It does not use keyword or phrase detection to decide GREEN or HOLD.

Required lifecycle:

- PENDING
- INSPECTING
- DISPOSITION_READY
- CLOSURE_READY
- CLOSED

Required modes:

- INSPECT
- CLOSE

Required state snapshot:

<!-- CONTROL_CENTER_STATE_START -->
```json
{
  "required_modes": ["INSPECT", "CLOSE"],
  "required_lifecycle": ["PENDING", "INSPECTING", "DISPOSITION_READY", "CLOSURE_READY", "CLOSED"],
  "active_asset_group": {
    "group_id": "control-center-gate-group",
    "asset_paths": [
      "control-center/EDGE_CONTROL_CENTER.md",
      "control-center/check_control_center.js",
      "tests/edge-control-center-ledger.test.js"
    ]
  },
  "lifecycle_state": "CLOSED",
  "evidence_completion": {
    "contents_and_purpose": true,
    "references_and_consumers": true,
    "runtime_use": true,
    "dependencies": true,
    "overlap_or_duplication": true
  },
  "disposition": "USE",
  "closure_status": "CLOSED",
  "total_governed_assets": 906,
  "investigated_assets": 3,
  "closed_assets": 3,
  "remaining_assets": 903,
  "required_closure_files": [
    "control-center/EDGE_CONTROL_CENTER.md",
    "control-center/check_control_center.js",
    "tests/edge-control-center-ledger.test.js"
  ],
  "inspected_groups": ["control-center-gate-group"],
  "closed_groups": ["control-center-gate-group"]
}
```
<!-- CONTROL_CENTER_STATE_END -->

Investigation evidence:

- contents_and_purpose: the document defines the active Control Center policy and state, the checker enforces it, and the tests verify it.
- references_and_consumers: `check_control_center.js` loads this document; `tests/edge-control-center-ledger.test.js` and `backend/services/controlCenterReadService.js` consume the checker entrypoint; package scripts expose the control-center checks.
- runtime_use: `node control-center/check_control_center.js` and `node --test tests/edge-control-center-ledger.test.js` are active runtime verification paths.
- dependencies: the gate depends on the asset register, the build ledger, Node `fs`, `path`, and `assert`, plus the state JSON embedded above.
- overlap_or_duplication: the three files are tightly related but not duplicative; they serve distinct policy, gate, and verification roles.

Disposition recorded: USE
Closure status: CLOSED

INSPECT may receive GREEN only when:

- an exact asset or tightly related group is named
- the group is recorded as the active investigation scope
- the instruction is inspection-only
- no merge, replacement, retirement, deletion, refactor, or unrelated repair is authorized

CLOSE may receive GREEN only when:

- the exact same asset/group was previously inspected
- contents and purpose evidence exists
- consumer and reference evidence exists
- runtime evidence exists
- dependency evidence exists
- overlap evidence exists
- an evidence-backed disposition exists
- closure scope contains only that inspected group and its required Control Center projection
- unrelated changes are preserved

No instruction or missing state = HOLD.

Feature work, unrelated cleanup, broad repository work, or premature mutation = HOLD.

The active investigation remains locked until every governed asset has reached CLOSED with an evidence-backed disposition.

Startable tasks are informational only.

Current sequencing remains informational and does not authorize execution:

- EAC-001 — Edge Asset Classification and Repository Map [PROPOSED]
- ECU-001 — Edge Control Center Operator UI [APPROVED]
