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

## 8. Stateful Control Center gate — Repository Cleanup Programme

All AI instructions are proposals.

ChatGPT, Codex, Cursor, and other AI instructions require Control Center GREEN before execution.

The gate is stateful. It does not use keyword or phrase detection to decide GREEN or HOLD.

### Governing principle

ONE QUESTION ACROSS THE REPOSITORY AT A TIME.

Complete one approved cleanup phase across all applicable governed assets and all applicable EAC-001 batches.

Close that phase.

Only then activate the next phase.

Do not mix cleanup questions.

Do not drift into another phase because an agent notices a different issue.

Any out-of-phase finding must be recorded as `FUTURE_PHASE_NOTE` and the active phase must continue.

### Existing EAC-001 evidence law

EAC-001 skim/classification is existing repository evidence and must be reused.

The Control Center must not require an implementation agent to rediscover every asset from zero or repeat full initial classification before a later cleanup phase.

A later phase may inspect additional evidence only for the exact question asked by that phase.

### Primary lifecycle (phase and batch oriented)

Required lifecycle states:

- PHASE_PENDING
- PHASE_ACTIVE
- BATCH_ACTIVE
- BATCH_COMPLETE
- PHASE_READY_TO_CLOSE
- PHASE_CLOSED

Required modes:

- PHASE_WORK
- COMPLETE_BATCH
- CLOSE_PHASE
- RECORD_FUTURE_PHASE_NOTE
- CONTROL

The old per-asset forensic lifecycle (`PENDING` → `INSPECTING` → `DISPOSITION_READY` → `CLOSURE_READY` → `CLOSED` with five evidence areas for every asset) is historical only.

It is no longer the mandatory primary lifecycle for the repository cleanup mission.

Per-asset evidence may still exist where useful.

It must not force a full forensic lifecycle for every file during Phase 1.

### Ordered cleanup phases

1. PHASE_0 — REPOSITORY BASELINE AND CONTROL
   Question: What exact repository state is the cleanup programme starting from?
   No cleanup. No repair. No duplicate removal.

2. PHASE_1 — EXACT DUPLICATE ELIMINATION
   Question: Are any governed files byte-for-byte identical?
   Preferred first-pass: local deterministic hashing (for example SHA-256).
   Exact duplicate means byte-for-byte identical content. Similar code, same purpose, same file name, or generated similarity are not exact duplicates.
   Phase 1 may remove only proven exact duplicates after a quick path/reference safety check.
   Phase 1 does not require purpose, runtime-use, dependency, overlap, reuse-value, merge, retirement, or replacement evidence for every unique file.

3. PHASE_2 — FILE PURPOSE IDENTIFICATION
   Question: What does each remaining governed file represent?
   Reuse EAC-001. No merge, deletion, retirement, repair, or refactoring.

4. PHASE_3 — ACTIVE USE IDENTIFICATION
   Question: Is each remaining governed file currently used?
   Outcomes: ACTIVE, INDIRECTLY_ACTIVE, MANUAL_USE, NO_CURRENT_USE_FOUND, UNKNOWN.
   NO_CURRENT_USE_FOUND does not authorise deletion.

5. PHASE_4 — LEGACY AND REPLACEMENT IDENTIFICATION
   Question: Has each applicable file been superseded or left behind by a newer implementation?
   Outcomes: CURRENT, LEGACY, REPLACED, HISTORICAL, UNCERTAIN.

6. PHASE_5 — FUNCTIONAL OVERLAP IDENTIFICATION
   Question: Are different remaining files doing the same or substantially overlapping job?
   Outcomes: NO_OVERLAP, PARTIAL_OVERLAP, MAJOR_OVERLAP, POTENTIAL_MERGE_GROUP.
   Identifies overlap only. No merge implementation.

7. PHASE_6 — SAFE RETIREMENT
   Question: Which proven unused, replaced, or historical files can safely be removed?
   Outcomes: RETIRE, KEEP, BLOCKED. Approved RETIRE may be implemented here.

8. PHASE_7 — MERGE AND CONSOLIDATION
   Question: Which confirmed overlap groups should become one canonical implementation?
   Deep investigation phase for proven overlap candidates only.

9. PHASE_8 — FINAL REPOSITORY VALIDATION
   Question: Is the cleaned repository internally consistent?
   Do not start a new cleanup hunt.

### Phase order law

Allowed sequence: PHASE_0 → PHASE_1 → PHASE_2 → PHASE_3 → PHASE_4 → PHASE_5 → PHASE_6 → PHASE_7 → PHASE_8.

A later phase must not activate while an earlier phase is incomplete.

### Active phase law

The Control Center must expose exactly one active repository cleanup phase.

An implementation agent must be able to determine:

- active phase
- active phase question
- active phase scope
- active batch where applicable
- completed batches
- remaining batches
- phase status
- phase Definition of Done
- future phase notes

The Control Center must fail closed if an agent attempts work belonging to a different cleanup phase.

### Batch law

Reuse the existing deterministic EAC-001 batch manifest (`control-center/EDGE_ASSET_CLASSIFICATION_BATCHES.v1.json`, B01–B29).

Do not invent a second arbitrary batch system.

Where a phase is batch-oriented, process deterministic EAC-001 batches in the existing defined order unless the Control Center records an explicit evidence-backed exception.

The next incomplete batch is the next default batch.

### Phase 1 forbidden questions

During PHASE_1 do not investigate as active work:

- What is this file for?
- Is this file old/legacy/unused/replaced?
- Can different files be merged?
- Do different files overlap?
- Is the code good / should it be refactored?
- Is there a defect / should it be repaired?
- Should the architecture be redesigned?

If noticed: record `FUTURE_PHASE_NOTE` with asset path(s), brief issue, and likely future phase. Continue Phase 1. Do not investigate the note during Phase 1.

### No cross-phase drift law

During an active phase: do the active phase only.

An agent noticing another problem must not investigate it deeply, repair it, refactor it, merge it, retire it, or change architecture because of it.

Record a `FUTURE_PHASE_NOTE` and continue the active phase.

### Standing Git authority

Stephen grants standing repository authority for approved Control Center cleanup phases to perform routine Git inspection, scoped staging, verified batch/phase commits, and push of successfully verified committed work without requesting separate approval from Stephen for each routine Git step.

Allowed without asking Stephen again when the work is inside the active approved phase, the batch/unit is complete, required focused verification passed, unrelated changes are preserved, staged changes contain only approved phase work, and scope is confirmed before commit:

- git status / git status --short
- git diff / git diff --check
- git log / git show / git rev-parse / git ls-files / git grep
- git add -- &lt;exact approved phase/batch paths&gt;
- git commit
- git push origin main

Git actions still requiring Stephen's explicit approval:

- git reset --hard
- git clean
- discarding local work with git checkout / git restore
- git rebase
- merging branches
- force push / git push --force
- branch deletion
- history rewriting
- mass repository rollback
- any Git action that would knowingly discard unrelated local changes

Repository standing Git authority does not override a mandatory IDE, sandbox, OS, or product security approval prompt.

### Gate mode rules

PHASE_WORK may receive GREEN only when the requested phase equals the active phase, the work matches the active phase question, and (for batch-oriented phases) the batch is the next incomplete deterministic EAC-001 batch or the recorded active batch.

COMPLETE_BATCH may receive GREEN only for the active batch of the active phase and must not require unique files to enter the old full forensic lifecycle.

CLOSE_PHASE may receive GREEN only when the active phase Definition of Done is met and phase status is PHASE_READY_TO_CLOSE.

RECORD_FUTURE_PHASE_NOTE may receive GREEN when it records an out-of-phase finding without changing the active phase.

CONTROL may receive GREEN only when:

- Stephen explicitly authorizes Control Center maintenance
- a proven Control Center defect or lifecycle gap is recorded
- scope is confined to Control Center gate, policy, and focused tests
- no product asset is changed

No instruction or missing state = HOLD.

Feature work, unrelated cleanup, broad repository work, premature mutation, or wrong-phase work = HOLD.

Startable ledger tasks remain informational only and do not authorize cleanup-phase execution by themselves.

Required state snapshot:

<!-- CONTROL_CENTER_STATE_START -->
```json
{
  "governance_model": "REPOSITORY_CLEANUP_PROGRAMME",
  "required_modes": [
    "PHASE_WORK",
    "COMPLETE_BATCH",
    "CLOSE_PHASE",
    "RECORD_FUTURE_PHASE_NOTE",
    "CONTROL"
  ],
  "required_lifecycle": [
    "PHASE_PENDING",
    "PHASE_ACTIVE",
    "BATCH_ACTIVE",
    "BATCH_COMPLETE",
    "PHASE_READY_TO_CLOSE",
    "PHASE_CLOSED"
  ],
  "cleanup_phase_order": [
    "PHASE_0",
    "PHASE_1",
    "PHASE_2",
    "PHASE_3",
    "PHASE_4",
    "PHASE_5",
    "PHASE_6",
    "PHASE_7",
    "PHASE_8"
  ],
  "eac_evidence_reusable": true,
  "eac_batch_manifest": "control-center/EDGE_ASSET_CLASSIFICATION_BATCHES.v1.json",
  "total_governed_assets": 902,
  "phase_0": {
    "status": "PHASE_CLOSED",
    "question": "What exact repository state is the cleanup programme starting from?",
    "evidence": {
      "repository_root": "C:/Users/user/Desktop/Stephen Fynn/SKCS-test",
      "active_branch": "main",
      "head_commit": "7d21fc276629bb6aec056299d70e1541b462934f",
      "working_tree_status": "dirty_unrelated_changes_preserved",
      "governed_asset_count": 902,
      "eac_batch_manifest": "control-center/EDGE_ASSET_CLASSIFICATION_BATCHES.v1.json",
      "eac_batch_count": 29,
      "already_completed_or_removal_work": "Partial external sports provider removal (PARTIAL); EAC-001 B01-B29 classification inventory complete; prior Control Center per-asset investigations preserved as historical evidence",
      "unrelated_local_changes_preserved": true
    }
  },
  "active_phase": "PHASE_3",
  "active_phase_question": "Is each remaining governed file currently used?",
  "lifecycle_state": "PHASE_ACTIVE",
  "active_batch": null,
  "completed_batches": [],
  "remaining_batches": [
    "B01",
    "B02",
    "B03",
    "B04",
    "B05",
    "B06",
    "B07",
    "B08",
    "B09",
    "B10",
    "B11",
    "B12",
    "B13",
    "B14",
    "B15",
    "B16",
    "B17",
    "B18",
    "B19",
    "B20",
    "B21",
    "B22",
    "B23",
    "B24",
    "B25",
    "B26",
    "B27",
    "B28",
    "B29"
  ],
  "next_deterministic_batch": "B01",
  "future_phase_notes": [],
  "standing_git_authority": true,
  "dangerous_git_actions_approval_gated": true,
  "historical_per_asset_forensic_lifecycle": "PRESERVED_AS_HISTORY_ONLY",
  "historical_closed_asset_paths": [
    "control-center/EDGE_CONTROL_CENTER.md",
    "control-center/check_control_center.js",
    "tests/edge-control-center-ledger.test.js",
    ".bat",
    ".dockerignore",
    ".env.example",
    ".gitignore",
    ".gcloudignore"
  ],
  "phase_1": {
    "status": "PHASE_CLOSED",
    "question": "Are any governed files byte-for-byte identical?",
    "evidence": {
      "result": "CLOSED",
      "duplicate_scan_executed": true,
      "final_repository_wide_check": "PASS",
      "closure_note": "Phase 1 Exact Duplicate Elimination is closed. Do not reopen without explicit Control Center approval."
    }
  },
  "phase_2": {
    "status": "PHASE_CLOSED",
    "question": "What does each remaining governed file represent?",
    "evidence": {
      "result": "PASS WITH CORRECTIONS",
      "batches_reviewed": "B01-B29",
      "final_manifest_count_check": "PASS",
      "closure_note": "Phase 2 Purpose Classification Review is closed. Do not reopen without explicit Control Center approval."
    }
  },
  "phase_3_outcomes": [
    "ACTIVE",
    "INDIRECTLY_ACTIVE",
    "MANUAL_USE",
    "NO_CURRENT_USE_FOUND",
    "UNKNOWN"
  ],
  "phase_3_no_deletion_law": "NO_CURRENT_USE_FOUND does not authorize deletion."
}
```
<!-- CONTROL_CENTER_STATE_END -->

### Historical Control Center evidence (preserved)

The following records are preserved historical evidence from the previous per-asset forensic investigation model. They are not the active cleanup lifecycle.

Investigation evidence:

- contents_and_purpose: the document defines the active Control Center policy and state, the checker enforces it, and the tests verify it.
- references_and_consumers: `check_control_center.js` loads this document; `tests/edge-control-center-ledger.test.js` and `backend/services/controlCenterReadService.js` consume the checker entrypoint; package scripts expose the control-center checks.
- runtime_use: `node control-center/check_control_center.js` and `node --test tests/edge-control-center-ledger.test.js` are active runtime verification paths.
- dependencies: the gate depends on the asset register, the build ledger, Node `fs`, `path`, and `assert`, plus the state JSON embedded above.
- overlap_or_duplication: the three files are tightly related but not duplicative; they serve distinct policy, gate, and verification roles.

Disposition recorded: USE
Closure status: CLOSED

Active investigation evidence: .bat

- contents_and_purpose: `.bat` is a Windows batch launcher created to start the local SKCS EdgeMind Dolphin/Llama server on port 8080 and open an ngrok tunnel to that local service.
- references_and_consumers: repository search found no code path that invokes `.bat`; governed references are the asset register, asset map, classification batches, and the active Control Center state. Runtime code consumes `DOLPHIN_URL` directly instead of invoking this script.
- runtime_use: no production runtime registration or package script calls `.bat`; if manually executed on the original Windows machine, it opens two command windows for `llama-server.exe` and `ngrok`.
- reads_and_writes: the script reads no repository files and writes no repository files; it starts external processes and binds local/network ports.
- dependencies: depends on Windows `cmd`, `timeout`, a machine-specific `C:\Users\skcsa\models\...` llama-server path, a Dolphin model file, and an installed `ngrok` CLI with a hard-coded tunnel URL.
- overlap_or_duplication: overlaps with `SKCS_START.bat`, which is another root batch launcher for Dolphin and ngrok; backend runtime assets such as `backend/services/aiProvider.js` and `backend/config.js` use `DOLPHIN_URL` rather than either batch file.
- reuse_value: retain the operational idea of a local Dolphin/ngrok launcher, but merge it with the duplicate launcher pattern into one governed, configurable operator script before relying on it.

Disposition recorded: MERGE
Closure status: CLOSED

Active investigation evidence: .dockerignore

- contents_and_purpose: `.dockerignore` is the repository-root Docker context exclusion policy, excluding Node artifacts, local secrets, Python caches/build outputs, OS/IDE files, Git metadata, local vendor folders, script result dumps, and chaos logs from container build context.
- references_and_consumers: Docker tooling consumes `.dockerignore` implicitly when building from the repository root; repository references are the asset register, asset map, classification batches, and current Control Center state.
- runtime_use: it affects container image build inputs, including the root `Dockerfile`; it is not executed at application runtime and has no server route or package-script caller.
- reads_and_writes: the file reads and writes nothing; Docker/build tooling reads it to decide which workspace paths to omit from build context transfer.
- dependencies: depends on Docker build semantics and the root build context; it also relates to local directories/files named in its patterns, including `.env`, `node_modules`, Python cache/build directories, `.git`, IDE folders, `backend/scripts/_vendor`, `backend/scripts/results`, and chaos log files.
- overlap_or_duplication: overlaps substantially with `.gitignore`, but the boundary is different: `.gitignore` governs source control tracking, while `.dockerignore` governs container build context and secret/artifact exclusion.
- reuse_value: keep as an active security and build hygiene configuration; its useful patterns should remain aligned with `.gitignore` and Dockerfile build requirements.

Disposition recorded: KEEP
Closure status: CLOSED

Active investigation evidence: .env.example

- contents_and_purpose: `.env.example` is the repository-root environment template documenting required and optional configuration for application runtime, database access, Supabase, auth, billing, sports providers, AI providers, Render hosts, ingestion limits, pipeline tuning, circuit breakers, and debug flags.
- references_and_consumers: setup docs instruct copying `.env.example` to `.env`; `.gitignore` explicitly keeps `.env.example` tracked while ignoring real env files; runtime code reads matching variables through `process.env`, `dotenv`, and Python `os.getenv`.
- runtime_use: the file itself is not loaded as runtime configuration, but its variable names mirror runtime dependencies used by backend services, scripts, cron triggers, Supabase clients, provider adapters, and deployment config.
- reads_and_writes: `.env.example` reads and writes nothing; developers/operators copy or consult it to create local or deployment environment values.
- dependencies: depends on the current runtime configuration contract across `backend/config.js`, database modules, middleware, provider clients, scripts, `render.yaml`, and docs. It must stay aligned with actual env-variable consumers.
- overlap_or_duplication: overlaps with deployment docs, data-ingestion docs, `.gitignore` env-file policy, and generated external-source inventory references, but it is the central tracked template and not replaced by those assets.
- reuse_value: keep as the canonical non-secret env template; reuse it as the governed source for onboarding and configuration audits, while separately correcting encoding artifacts in a future approved edit if needed.

Disposition recorded: KEEP
Closure status: CLOSED

Closed investigation evidence: .gitignore

- contents_and_purpose: `.gitignore` excludes local env files, dependency directories, build outputs, IDE/OS files, logs, caches, archive output, and local tool state from source control.
- references_and_consumers: Git consumes it directly; the repository governance files also reference the root ignore policy as a tracked configuration artifact. No application runtime code imports it.
- runtime_use: it has no runtime execution role; it only changes what Git tracks.
- reads_and_writes: the file reads and writes nothing.
- dependencies: depends on Git ignore semantics and the repo's local/generated paths such as `.env`, `node_modules`, Python caches, `.vercel`, `_archive/`, `backend/cache/*.json`, and log files.
- overlap_or_duplication: overlaps with `.dockerignore` and `.gcloudignore`, but those files govern different boundaries. The source-control boundary belongs in `.gitignore`.
- reuse_value: keep it as the canonical Git tracking policy for this repository.

Disposition recorded: KEEP
Closure status: CLOSED

Active investigation evidence: .gcloudignore

- contents_and_purpose: `.gcloudignore` is the repository-root Google Cloud CLI upload filter, excluding local secrets, dependency/build directories, IDE files, Git metadata, and large local artifacts from any gcloud-managed source upload.
- references_and_consumers: no application code imports or calls `.gcloudignore`; its direct consumer would be Google Cloud tooling when commands such as deploy or source upload run from the repository root. Current repository references are governance artifacts plus historical documentation traces like `phase2-cleanup.js`, `FULL_WORKSPACE_AUDIT_REPORT.md`, and a comment in `backend/server-express.js` pointing at a now-absent root `docs/google-cloud-soccer-refresh.md`.
- runtime_use: there is no proven current runtime or build path in package scripts, Vercel config, Render config, or live root docs that invokes Google Cloud deployment from this repository. The only Google Cloud operational trail left in-tree is archived or report-derived material, including `_archive/docs_legacy/google-cloud-soccer-refresh.md`; the current tracked root doc is absent.
- reads_and_writes: `.gcloudignore` does not read or write repository files; Google Cloud CLI tooling would read it implicitly to omit matching files from upload context.
- dependencies: depends on Google Cloud CLI ignore semantics and the paths it names, including `.env*`, `node_modules`, Python virtualenv/build outputs, IDE folders, `.git`, `backend/scripts/_vendor`, `backend/scripts/results`, and chaos log files.
- overlap_or_duplication: overlaps heavily with `.gitignore` and materially with `.dockerignore`; most exclusion patterns are already governed elsewhere, and the remaining Google Cloud-specific value only matters if this repository still uses gcloud source-upload workflows.
- reuse_value: retain the useful exclusion patterns, but merge or reconcile them into the surviving ignore-policy surfaces unless a current Google Cloud deployment path is re-established and proved active.

Disposition recorded: MERGE
Closure status: OPEN

Phase 1 batch evidence: B01

- batch_id: B01
- title: CONTROL_CENTER
- hash_method: SHA-256
- asset_count: 15
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B02
- note: every B01 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B02

- batch_id: B02
- title: BACKEND_DIRECT_FILES
- hash_method: SHA-256
- asset_count: 13
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B03
- note: every B02 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B03

- batch_id: B03
- title: BACKEND_ROUTES_AND_CONTROLLERS
- hash_method: SHA-256
- asset_count: 28
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B04
- note: every B03 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Future phase note: Control Center state persistence/display consistency

- observation: the persisted policy snapshot repeatedly displays `next_deterministic_batch = B01`, while deterministic checker transitions have already accepted B01, B02, and now B03 processing correctly.
- likely_future_work: Control Center state persistence/display consistency

B03 hash re-verification supersession

- previous_b03_evidence_status: superseded
- reason: the earlier B03 hash report failed evidence-integrity review because the reported hashes were not accepted as trustworthy raw PowerShell output.
- verification_method: actual local PowerShell Get-FileHash SHA256 rerun from manifest-derived B03 membership
- manifest_asset_count: 28
- raw_hash_result_count: 28
- count_match: YES
- note: this re-verification records the actual local hash output and supersedes the earlier B03 hash report without erasing the audit trail.

Phase 1 batch evidence: B04

- batch_id: B04
- title: BACKEND_UTILS_SEMANTIC_CORE_AND_TEST
- hash_method: SHA-256
- asset_count: 46
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B05
- note: every B04 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B05

- batch_id: B05
- title: BACKEND_SCRIPTS
- hash_method: SHA-256
- asset_count: 15
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B06
- note: every B05 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B06

- batch_id: B06
- title: BACKEND_PROVIDERS_FOOTBALL
- hash_method: SHA-256
- asset_count: 10
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B07
- note: every B06 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B07

- batch_id: B07
- title: BACKEND_SRC_SERVICES_CONTEXT_INTELLIGENCE_AND_MARKET_ROUTER
- hash_method: SHA-256
- asset_count: 9
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B08
- note: every B07 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B08

- batch_id: B08
- title: BACKEND_ADAPTERS_AND_CONFIG
- hash_method: SHA-256
- asset_count: 13
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B09
- note: every B08 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B09

- batch_id: B09
- title: BACKEND_SERVICES
- hash_method: SHA-256
- asset_count: 86
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B10
- note: every B09 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B10

- batch_id: B10
- title: SCRIPTS_AUDIT_GOV
- hash_method: SHA-256
- asset_count: 27
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B11
- note: every B10 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B11

- batch_id: B11
- title: SCRIPTS_CHECK_VALIDATE_VERIFY
- hash_method: SHA-256
- asset_count: 59
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B12
- note: every B11 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B12

- batch_id: B12
- title: SCRIPTS_TEST_DIAG_TRACE
- hash_method: SHA-256
- asset_count: 66
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B13
- note: every B12 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B13

- batch_id: B13
- title: SCRIPTS_RUN_TRIGGER_SCHED
- hash_method: SHA-256
- asset_count: 20
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B14
- note: every B13 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B14

- batch_id: B14
- title: SCRIPTS_INGEST_ENRICH_SYNC_IMPORT
- hash_method: SHA-256
- asset_count: 31
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B15
- note: four stale manifest paths were removed after confirming they were deleted in commit 659e7f710ff578b088a3fc7d2a25d9767190ec78; corrected B14 assets hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B15

- batch_id: B15
- title: SCRIPTS_MAINT_FIX_CLEANUP_MIGRATE
- hash_method: SHA-256
- asset_count: 52
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B16
- note: every B15 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B16

- batch_id: B16
- title: DOCS_ROOT_MD_TXT
- hash_method: SHA-256
- asset_count: 36
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B17
- note: every B16 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B17

- batch_id: B17
- title: DOCS_DIR
- hash_method: SHA-256
- asset_count: 24
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B18
- note: every B17 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B18

- batch_id: B18
- title: SKCS_KNOWLEDGE_GOV_AND_AUDIT
- hash_method: SHA-256
- asset_count: 23
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B19
- note: every B18 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B19

- batch_id: B19
- title: SKCS_KNOWLEDGE_KNOWLEDGE
- hash_method: SHA-256
- asset_count: 17
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B20
- note: every B19 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.

Phase 1 batch evidence: B20

- batch_id: B20
- title: SKCS_KNOWLEDGE_PROVIDERS
- hash_method: SHA-256
- asset_count: 18
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B21
- note: every B20 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.
- sha256_inventory:
  - SKCS-KNOWLEDGE/providers/bigballs_discovery_audit.md => FF8CA06654D0F3C902883BC2B70565E6601CC7CBA8E6E983B6BC26A082E36DB5
  - SKCS-KNOWLEDGE/providers/bigballs_endpoint_catalog.md => E58906235D4189789C0182784C1530E09DB5A19CA5348B841413AC17C7EF24B0
  - SKCS-KNOWLEDGE/providers/bigballs_primary_assessment.md => 6480B86A9ADD56556601BF717A5E46BF9B1520C3BD3E5DF1BF925032E9E9474B
  - SKCS-KNOWLEDGE/providers/bigballs_provider_health.md => 5309D88182A72EBD27A6A86EFC6B433B18CC6786C3A4C09CF04E0A531343B68F
  - SKCS-KNOWLEDGE/providers/bigballs_semantic_mapping.md => BE17A754CF1F0042DD078E2B7A549AB70563C41FB020C4687897817E0AC3BB85
  - SKCS-KNOWLEDGE/providers/bsd_coverage_audit.md => CA864F9F102B54487F6FFA8208FEE95C82BD340090FD2F54FB376FDFF743F753
  - SKCS-KNOWLEDGE/providers/bsd_endpoint_catalog.md => 31C46E233BF08C7DE3EEC9EBEBB02261F9FB27A1D09ECD7CBADBE2263DB3F960
  - SKCS-KNOWLEDGE/providers/bsd_league_inventory.md => 922F49F31426CD399907596EB6017C0CDD27897C5B9BF598F039753600991E2C
  - SKCS-KNOWLEDGE/providers/bsd_provider_health.md => 98CF8C77253F8C84094D38433CDEE92DAF8D1F7B32A85D8276CE82C599F12F49
  - SKCS-KNOWLEDGE/providers/bsd_readiness_assessment.md => C6176F9F2205D87EC4D8B0BF9D1C60627972B21DD4044A360FCC32E304B5CF20
  - SKCS-KNOWLEDGE/providers/bsd_semantic_mapping.md => 086DB6C592C1FDA95443F3131B194F841DB1E3147D70D9B70FA47DD6C52AE63A
  - SKCS-KNOWLEDGE/providers/bzzoiro_discovery_audit.md => 08FF69907E5F124CC967623B14F37C299635A26DA8214A5513D5424A8EAB0422
  - SKCS-KNOWLEDGE/providers/bzzoiro_field_audit.md => B1A7A93A94065BB29ACA35BE9FA9D2BF031AE95131F3015031CB675845595670
  - SKCS-KNOWLEDGE/providers/bzzoiro_provider_mapping.md => 939BDD1DEFCBE0171CB395F8BBBFAB7336E8BFFE1413D47CD96E5BD80A76FA6F
  - SKCS-KNOWLEDGE/providers/soccerdata_call_restrictions.md => 952A7BC5D45E67520805A02184CD0845A22081B2A8E20FF373DBBECE572C0734
  - SKCS-KNOWLEDGE/providers/soccerdata_endpoint_catalog.md => F1006740882260AEB8046591FBF14466B31BAC1E24BE057DD5944D27A00482FD
  - SKCS-KNOWLEDGE/providers/soccerdata_notebooklm_synthesis.md => 7AC593F2A79AD48967E0D57A9D1FA2507C44319979467A774A15F9FD93DF4B98
  - SKCS-KNOWLEDGE/providers/soccerdata_provider_health.md => 5CCF69D18625B81862C97853979FA775524349262D2E12CFB3D687A9DEC808A4

Phase 1 batch evidence: B21

- batch_id: B21
- title: PUBLIC_UI
- hash_method: SHA-256
- asset_count: 64
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B22
- note: public/data/venue-cache.json was deleted after confirming public/data/standings-cache.json as the keeper.
- sha256_inventory:
  - public/about-bg.jpg => 83E5C4F5046D501FFD72823F2C2094A90675BEB6F5A64EB07BAAE449823575E4
  - public/about-bg.webp => C016BA913AECDF542EDD8923BBB94B8F32058975BC045B7FF6985C30903CE0EC
  - public/accuracy.html => F296970750EA0C222738BE6F1F07C45E4C39BCD117F47829511646D93F65652E
  - public/admin-sync.html => 48FE0034BC93B25222230FCC3B7A504CB600D1354970921F87606C75BDAC86D9
  - public/components/HeroCarousel.jsx => 7F2F95AE5CC47DE6BF89C43364BF85FFDF2CD20F19E001F9A9B4A09F1F3F8B3E
  - public/components/TrendDashboard.jsx => DB2E9742110DD217BC1B4DA9C0EA4DC4C20033F12BF061F4FAAB6871E0D24A78
  - public/control-center.html => 5A95706BC5CDA42102A0EE0FBF8D129867C0253FBE79FF6FC38AA2447E552BCB
  - public/css/control-center.css => C083C138C33EFF0F1007E920D9E1451C85C2F4220A9FD306F2093C9659C26B3E
  - public/css/hero-carousel.css => 4FB9258934D71C1358D3A1C73B73C1CB5EB2985013276579D63CB82E3B403556
  - public/css/input.css => CC1A7AD0D019DDB1D32D0ECB588BA0AC26CE41D8625DD6C366348B25F83A28EC
  - public/css/output.css => C60F81494E5B155BFE19DC2BDBD939388796C94EE382B3D83F4118515C2EBDD0
  - public/css/react-components.css => B9C0E2A76471B7484D7E11432D792824ADF872F986B5C97ABE514275DBD5701B
  - public/data/all_leagues_raw.json => BF596259F739C976101D97EF57279C001B171FE4C6CA8792DCFEE54EB927FE5F
  - public/data/all_sports_raw.json => FFFE838108C71823BE16FA7BD2F87030BF82558C45F3390910322653A1A8B1C9
  - public/data/context-pack-2026-05-17.json => 16751F102D2F40E7723EE3B76A051C7AE1D38685D4C7DEE0A90AA9841CDEA617
  - public/data/event-details-cache.json => 64F64D61121A1E31B6ADA3FE0DCB02119A05CBDB0A96B978EC225C29FFF75237
  - public/data/h2h-2026-05-17.json => 068CB187A8977E81B80BCDCD9663DD2886240EBFC25D16F4E14E73CA4A778C92
  - public/data/importance-2026-05-17.json => 9DB600A2B08E3D0ADD85E88A83C1A2430E4F1A96C4F066AEADEB2598D16DE6C2
  - public/data/injuries-2026-05-17.json => 1E9C9349798FA8FDA0921FA1ADE4D9C8C97A3CCD8224FFFC930ACC7D9E0F8690
  - public/data/news-injury-cache.json => 65CEBEA09804CC5B326CA2D497070FFC937371715D89C8CC6B7B39C34E3B331D
  - public/data/pipeline-dry-2026-05-17.json => 34A4D5C395C27ABC22EAA19E1ED7015E958EEE6A481DB34A7645D291FBDC2F23
  - public/data/standings-cache.json => 44136FA355B3678A1146AD16F7E8649E94FB4FC21FE77E8310C060F61CAAFF8A
  - public/data/team-form-2026-05-17.json => E40690CBC02F2604EF3CC8C8D830589867E34EB258A9EC7FF2BD63DF0720AC3E
  - public/data/team-form-cache.json => 8B8FC30CCA476447C2B40C1053F6DC2E78506895DE0142E6F8CD4D0DAA6A22C3
  - public/data/travel-2026-05-17.json => 7171BB59BF8E7D59A1D1695CD1E6DE24D19FA7857A1509B28A3E63D83120760F
  - public/data/tsdb-coverage-2026-05-17.json => DAF5402A33ECBA88CDB98B247B136D56DCB75A97CBA996BBCC312AA5F6AA8643
  - public/data/tsdb-coverage-2026-05-18.json => 524848C5492BED018341FA1B3D9EDE2A5B9BE57C90D50082326120412499CA2F
  - public/data/tsdb-coverage-2026-05-19.json => F46D6D2741C8CB9BFD7CF2BC8BC6880C695DE7738E0651F0507C4AB02DF49047
  - public/data/tsdb-day-2026-05-17.json => FDCA7983EDAF8A61CBE77EF7068EA589CEB0827DD97C8B7D04BF3A52AE01DD7A
  - public/data/vip-stress-saturday.json => 9168B0286DB4B2BBBE62339FC4C190101C257E406E58322893C58AC7A3F9997D
  - public/direct-markets.html => 5147A1927E4D89A081B439F15D9F527A7A8205C9CBBDF5EA193F548D38430434
  - public/experience.html => 773CAE7014F0843E921B63B9601AA915812CF349519C1F074A77808DD7DA0A00
  - public/favicon.ico => E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855
  - public/hero-page.jpg => 77FE0A775C8FF0FA961C1C4D58A1BA8E252F711FB1A65B7F7EC295929207C5D9
  - public/hero-page.webp => D9715B9AA10DE739CDEAF13D2409DEF7426B54E1AA47CC2B23D20CC6F28ED34E
  - public/index.html => 10C546E8C7606712FD30CD5856F070326077FD6C2091E62F3913113F0C511F8D
  - public/js/acca-builder.js => 3DA46A7EB7ACF2EE696A4A03F0D97B64E3796BD4B4F2B7E95F0118D120C1D307
  - public/js/ai-reasoning-display.js => 96678779EEC3C48297035F77A90242E1FD32834E08C34B0F263A2586946A1025
  - public/js/config.js => D492E1E4BB3273B7B998E5AE23EE4B31AAB9EC6C34F3CA25CE5FF3A9D14B63F4
  - public/js/control-center.js => 36BA37A3E4E82775E0923709CA68709CE492A327CFA3944E2AA6F68F85C71D73
  - public/js/doubleChanceCombos.js => 90F4D5AA7D85CD55C22238FAF39D85D13BBBE97CEF7B0784571848F6BEA1B4FF
  - public/js/hero-carousel.js => A6531B339E10DEBAD5469765BC0BC55956A3C6F88B5C9A59EB8AEB4F11E11222
  - public/js/semantic-drift-dashboard.js => EACE876EB730F5D2C9E7AAB112918CF9E183CBF1AC81DFC2BA811878D7A6AF59
  - public/js/smh-hub-master-rulebook.js => 1E6298F18116E951DCE7B9FA8473125C7DC4614415C548B0598BEAF8C23C2722
  - public/js/smh-hub.js => 9FD306EFA43CEC84C90701BD50EF18C35A458534D691A4DA2736E1421C6A3FC6
  - public/js/supabase-bundle.js => DCE7D2E5CB3220886E16E4C151DA813B7B35581B9CD4B40B7B7ECD4AFE31D1A8
  - public/js/supabase-init.js => A994E58F086C4C9D44107C307F44951917ECFF0AE079CADAEA63EA01BD757B37
  - public/js/system-health-banner.js => 1CBFE520C0E6349A894F1E9841DA3ACDB27379BE3F119D5B7FA28F482765C695
  - public/js/user-experience-feedback.js => 892076C3377EAF49D54213EE12A1A414D297EEC5326DF4B6DDE055E9F14E659C
  - public/js/vip-stress-dashboard.js => 5AED949E490306E7434BBC3DBEEA6EDD9E0B7DE1493AFDACD8078B314F3CD2EB
  - public/language-switch.html => E322683B9EB80D15CD9EFD616070D90396C881B8D0C30E2DA0C7D9AFCBC4DAE2
  - public/language.jpg => C42A824A603DD0DD415DBD1953F97B2BB893E9BAE89EBA8249C1088CA15E5B61
  - public/login.html => 7E85E9B3E5DC820FEE6BCD6917DDFE9E5614ABD662B6E780B111AF5C0048BDAA
  - public/login.jpg => 58CE581C5702B91BD77B83893B91D9B76E5384BFD5D7DB9A8948D33B4C0B8B17
  - public/market-explorer.html => 8F58176D76DF8A962DFF36759F8F915EE3D2293723C8BDAF5AA2C49C58F4F394
  - public/payment.html => B2FECCA9BFDAEBE1E195B33D4889BD50C0F99A6F737E04D1136F638636936CFE
  - public/privacy.html => 78BBA69AB80B61F90B69D9D432BD7B70AD2E91014689B61A63F94314501EEA89
  - public/robots.txt => 16CEB5EE3E0DC13AA9ADF31A3EBBE45A1D965B8C2B9F72EAF84E5911E140ED95
  - public/style.css => EA133FA575DE6CB332D6E6F9D27E35777C6F6701FAE84C39E22CFBA4D088CAEB
  - public/subscribe/index.html => 61A98F414270D6DB35D57A3C5753D2676A9DBF3A83E681A32400AF9E2863DC97
  - public/subscription.html => 06B33E20F7C85B24357D8C41D3CDE0FDFEEBB77E7185AFE487C85100E9DDBC05
  - public/terms.html => C475529AEA712BAFCEBC977982C7C774D89234906ECBAC99C6859A44517B4F8E
  - public/vip-stress-dashboard.html => 1FDC9F44CE59E3701DA0795F730C7193728678BC7F6C1BCAF4DD71D0B577C6EC
  - public/windrawwin.jpg => 087836C549CE76A862CB5A90572B40B9BE46C529A2458BC4BC71CA9B0B71DF1F

Phase 1 batch evidence: B20

- batch_id: B20
- title: SKCS_KNOWLEDGE_PROVIDERS
- hash_method: SHA-256
- asset_count: 18
- exact_duplicate_groups: 0
- batch_outcome: BATCH_COMPLETE
- next_deterministic_batch: B21
- note: every B20 asset hashed uniquely; no duplicate removal, reference rewrite, or path-safety escalation was required.
- sha256_inventory:
  - SKCS-KNOWLEDGE/providers/bigballs_discovery_audit.md => FF8CA06654D0F3C902883BC2B70565E6601CC7CBA8E6E983B6BC26A082E36DB5
  - SKCS-KNOWLEDGE/providers/bigballs_endpoint_catalog.md => E58906235D4189789C0182784C1530E09DB5A19CA5348B841413AC17C7EF24B0
  - SKCS-KNOWLEDGE/providers/bigballs_primary_assessment.md => 6480B86A9ADD56556601BF717A5E46BF9B1520C3BD3E5DF1BF925032E9E9474B
  - SKCS-KNOWLEDGE/providers/bigballs_provider_health.md => 5309D88182A72EBD27A6A86EFC6B433B18CC6786C3A4C09CF04E0A531343B68F
  - SKCS-KNOWLEDGE/providers/bigballs_semantic_mapping.md => BE17A754CF1F0042DD078E2B7A549AB70563C41FB020C4687897817E0AC3BB85
  - SKCS-KNOWLEDGE/providers/bsd_coverage_audit.md => CA864F9F102B54487F6FFA8208FEE95C82BD340090FD2F54FB376FDFF743F753
  - SKCS-KNOWLEDGE/providers/bsd_endpoint_catalog.md => 31C46E233BF08C7DE3EEC9EBEBB02261F9FB27A1D09ECD7CBADBE2263DB3F960
  - SKCS-KNOWLEDGE/providers/bsd_league_inventory.md => 922F49F31426CD399907596EB6017C0CDD27897C5B9BF598F039753600991E2C
  - SKCS-KNOWLEDGE/providers/bsd_provider_health.md => 98CF8C77253F8C84094D38433CDEE92DAF8D1F7B32A85D8276CE82C599F12F49
  - SKCS-KNOWLEDGE/providers/bsd_readiness_assessment.md => C6176F9F2205D87EC4D8B0BF9D1C60627972B21DD4044A360FCC32E304B5CF20
  - SKCS-KNOWLEDGE/providers/bsd_semantic_mapping.md => 086DB6C592C1FDA95443F3131B194F841DB1E3147D70D9B70FA47DD6C52AE63A
  - SKCS-KNOWLEDGE/providers/bzzoiro_discovery_audit.md => 08FF69907E5F124CC967623B14F37C299635A26DA8214A5513D5424A8EAB0422
  - SKCS-KNOWLEDGE/providers/bzzoiro_field_audit.md => B1A7A93A94065BB29ACA35BE9FA9D2BF031AE95131F3015031CB675845595670
  - SKCS-KNOWLEDGE/providers/bzzoiro_provider_mapping.md => 939BDD1DEFCBE0171CB395F8BBBFAB7336E8BFFE1413D47CD96E5BD80A76FA6F
  - SKCS-KNOWLEDGE/providers/soccerdata_call_restrictions.md => 952A7BC5D45E67520805A02184CD0845A22081B2A8E20FF373DBBECE572C0734
  - SKCS-KNOWLEDGE/providers/soccerdata_endpoint_catalog.md => F1006740882260AEB8046591FBF14466B31BAC1E24BE057DD5944D27A00482FD
  - SKCS-KNOWLEDGE/providers/soccerdata_notebooklm_synthesis.md => 7AC593F2A79AD48967E0D57A9D1FA2507C44319979467A774A15F9FD93DF4B98
  - SKCS-KNOWLEDGE/providers/soccerdata_provider_health.md => 5CCF69D18625B81862C97853979FA775524349262D2E12CFB3D687A9DEC808A4

### PHASE 2 - B04 PURPOSE CLASSIFICATION REVIEW

STATUS: CLOSED
RESULT: PASS
BATCH: B04 - BACKEND_UTILS_SEMANTIC_CORE_AND_TEST
ASSET COUNT: 46
REGISTER COVERAGE: 46/46
PURPOSE CLASSIFICATION CORRECTIONS REQUIRED: 0
JSON PATCHED: NO
REGISTER MODIFIED: NO
BATCH MANIFEST MODIFIED: NO
EVIDENCE: Local read-only PowerShell inspection confirmed all B04 assets exist in the register, review flags returned no rows, and final git status was clean.

### PHASE 2 - B05 PURPOSE CLASSIFICATION REVIEW

STATUS: CLOSED
RESULT: PASS
BATCH: B05 - BACKEND_SCRIPTS
ASSET COUNT: 15
REGISTER COVERAGE: 15/15
PURPOSE CLASSIFICATION CORRECTIONS REQUIRED: 0
JSON PATCHED: NO
REGISTER MODIFIED: NO
BATCH MANIFEST MODIFIED: NO
EVIDENCE: Local read-only PowerShell inspection confirmed all B05 assets exist in the register, review flags returned no rows, and final git status was clean.

### PHASE 2 - B06 PURPOSE CLASSIFICATION REVIEW

STATUS: CLOSED
RESULT: PASS
BATCH: B06 - BACKEND_PROVIDERS
ASSET COUNT: 10
REGISTER COVERAGE: 10/10
PURPOSE CLASSIFICATION CORRECTIONS REQUIRED: 0
JSON PATCHED: NO
REGISTER MODIFIED: NO
BATCH MANIFEST MODIFIED: NO
EVIDENCE: Local read-only PowerShell inspection confirmed all B06 assets exist in the register, all are classified as PROVIDER_INTEGRATION, review flags returned no rows, and final git status was clean.

### PHASE 2 - B07 PURPOSE CLASSIFICATION REVIEW

STATUS: CLOSED
RESULT: PASS
BATCH: B07 - BACKEND_SRC_SERVICES
ASSET COUNT: 9
REGISTER COVERAGE: 9/9
PURPOSE CLASSIFICATION CORRECTIONS REQUIRED: 0
JSON PATCHED: NO
REGISTER MODIFIED: NO
BATCH MANIFEST MODIFIED: NO
EVIDENCE: Local read-only PowerShell inspection confirmed all B07 assets exist in the register, all functional groups are valid for backend source services, review flags returned no rows, and final git status was clean.

### PHASE 2 - B08 PURPOSE CLASSIFICATION REVIEW

STATUS: CLOSED
RESULT: PASS
BATCH: B08 - BACKEND_ADAPTERS_AND_CONFIG
ASSET COUNT: 13
REGISTER COVERAGE: 13/13
PURPOSE CLASSIFICATION CORRECTIONS REQUIRED: 0
JSON PATCHED: NO
REGISTER MODIFIED: NO
BATCH MANIFEST MODIFIED: NO
EVIDENCE: Local read-only PowerShell inspection confirmed all B08 assets exist in the register, all have functional groups and purpose descriptions, review flags returned no rows, and final git status was clean.

### PHASE 2 - B09 PURPOSE CLASSIFICATION REVIEW

STATUS: CLOSED
RESULT: PASS
BATCH: B09 - BACKEND_SERVICES
ASSET COUNT: 86
REGISTER COVERAGE: 86/86
PURPOSE CLASSIFICATION CORRECTIONS REQUIRED: 0
JSON PATCHED: NO
REGISTER MODIFIED: NO
BATCH MANIFEST MODIFIED: NO
EVIDENCE: Local read-only PowerShell inspection confirmed all B09 assets exist in the register, all have functional groups and purpose descriptions, review flags returned no rows, and final git status was clean.

### PHASE 2 - B10 PURPOSE CLASSIFICATION REVIEW

STATUS: CLOSED
RESULT: PASS WITH CORRECTION
BATCH: B10 - SCRIPTS_AUDIT_GOV
ASSET COUNT: 27
REGISTER COVERAGE: 27/27
PURPOSE CLASSIFICATION CORRECTIONS REQUIRED: 1
JSON PATCHED: YES
REGISTER MODIFIED: YES
BATCH MANIFEST MODIFIED: NO
CORRECTION: scripts/audit-v2-provider-coverage.js functional_group changed from DATABASE_MIGRATION to SCRIPT_TOOL because its purpose_description and relationship_tags identify it as an audit script, not a migration runner.
EVIDENCE: Local PowerShell inspection confirmed all B10 assets exist in the register, one purpose classification mismatch was found and corrected, and final review scope remained limited to B10.


Phase 2 purpose classification evidence: B11

- batch_id: B11
- title: SCRIPTS_CHECK_VALIDATE_VERIFY
- asset_count: 59
- register_coverage: 59/59
- result: PASS WITH CORRECTION
- corrections:
  - scripts/setup-rls.js functional_group changed from SCRIPT_TOOL to DATABASE_MIGRATION because it enables RLS and creates DB policies through ALTER TABLE / CREATE POLICY SQL, not only generic setup/config.
  - scripts/task1-schema-update.js functional_group changed from SCRIPT_TOOL to DATABASE_MIGRATION because it runs ALTER TABLE ADD COLUMN statements on predictions_final and verifies resulting columns.
  - scripts/verify_dom_structure.js functional_group changed from SCRIPT_TOOL to FRONTEND_UI; relationship_tags changed from SQL/SCRIPT_TOOL to UI/SCRIPT_TOOL/TEST_PROOF because it checks browser DOM containers/functions and contains no SQL/database behavior.
- batch_manifest_modified: NO
- evidence: Read-only B11 manifest/register/source inspection confirmed B11 membership and the three purpose mismatches above; scope stayed limited to B11 purpose classification.

Phase 2 purpose classification evidence: B12

- batch_id: B12
- title: SCRIPTS_TEST_DIAG_TRACE
- asset_count: 66
- register_coverage: 66/66
- result: PASS WITH NO CORRECTION
- corrections: NONE
- batch_manifest_modified: NO
- register_modified: NO
- evidence: Local PowerShell read-only B12 manifest/register/source inspection confirmed all 66 B12 assets exist, all 66 are present in the register, all current functional_group values are TEST_PROOF, and focused review of the five heuristic candidates confirmed they are test/diagnostic proof scripts rather than production migrations, runtime services, or frontend assets. Scope stayed limited to B12 purpose classification.


Phase 2 purpose classification evidence: B13

- batch_id: B13
- title: SCRIPTS_RUN_TRIGGER_SCHED
- asset_count: 20
- register_coverage: 20/20
- result: PASS WITH NO CORRECTION
- corrections: NONE
- batch_manifest_modified: NO
- register_modified: NO
- evidence: Local PowerShell read-only B13 manifest/register/source inspection confirmed all 20 B13 assets exist, all 20 are present in the register, and focused review of _trigger-sync.js, run-master-pipeline.js, run-test.js, and trigger-publication.js confirmed their current purpose classifications are acceptable. Scope stayed limited to B13 purpose classification.


Phase 2 purpose classification evidence: B14

- batch_id: B14
- title: SCRIPTS_INGEST_ENRICH_SYNC_IMPORT
- asset_count: 31
- register_coverage: 31/31
- result: PASS WITH CORRECTION
- batch_manifest_modified: YES
  - asset_count corrected from 35 to 31 because B14 contained 31 listed asset_paths, all 31 source files exist, all 31 are present in the register, and no missing B14-like tracked scripts were found.
- register_modified: YES
- corrections:
  - scripts/backfill-direct1x2-final-fields.js functional_group changed from SCRIPT_TOOL to GENERATED_OUTPUT.
  - scripts/backfill-fixture-ids.js functional_group changed from SCRIPT_TOOL to GENERATED_OUTPUT.
  - scripts/backfill-provider-event-id.js functional_group changed from SCRIPT_TOOL to PROVIDER_INTEGRATION.
  - scripts/compose-context-pack.js functional_group changed from SCRIPT_TOOL to GENERATED_OUTPUT.
  - scripts/cricapi-cache-refresh.js functional_group changed from SCRIPT_TOOL to PROVIDER_INTEGRATION.
  - scripts/force-enrich-match.js functional_group changed from SCRIPT_TOOL to AI_EDGEMIND.
  - scripts/rebuild-canonical-from-api-sports.js functional_group changed from SCRIPT_TOOL to PROVIDER_INTEGRATION.
- evidence: Local PowerShell B14 manifest/register/source inspection confirmed B14 membership, repaired stale B14 asset_count metadata, and corrected seven proven purpose mismatches based on focused source review. Scope stayed limited to B14 purpose classification.


Phase 2 purpose classification evidence: B15

- batch_id: B15
- title: SCRIPTS_MAINT_FIX_CLEANUP_MIGRATE
- asset_count: 52
- register_coverage: 52/52
- result: PASS WITH CORRECTION
- batch_manifest_modified: NO
- register_modified: YES
- corrections:
  - scripts/_bsd_league_inventory.json functional_group changed from SCRIPT_TOOL to GENERATED_OUTPUT.
  - scripts/_local-rebuild.js functional_group changed from SCRIPT_TOOL to PREDICTION.
  - scripts/add-event-columns.js functional_group changed from SCRIPT_TOOL to DATABASE_MIGRATION.
  - scripts/build-sportsdb-config.js functional_group changed from SCRIPT_TOOL to PROVIDER_INTEGRATION.
  - scripts/cleanup-predictions.js functional_group changed from DEPLOYMENT_OPERATIONS to DATABASE.
  - scripts/cleanup-unknown-teams.js functional_group changed from DEPLOYMENT_OPERATIONS to DATABASE.
  - scripts/cleanup.js functional_group changed from DEPLOYMENT_OPERATIONS to DATABASE.
  - scripts/fix-json-simple.js functional_group changed from DEPLOYMENT_OPERATIONS to GENERATED_OUTPUT.
  - scripts/fix-remaining-json-issues.js functional_group changed from DEPLOYMENT_OPERATIONS to GENERATED_OUTPUT.
  - scripts/fix-sport-data.js functional_group changed from DEPLOYMENT_OPERATIONS to GENERATED_OUTPUT.
  - scripts/gulf_in_class_simulation.js functional_group changed from SCRIPT_TOOL to ACCA.
  - scripts/render-api-deploy.js functional_group changed from SCRIPT_TOOL to DEPLOYMENT_OPERATIONS.
- evidence: Local PowerShell B15 manifest/register/source inspection confirmed B15 membership, verified all 52 source files exist, verified 52/52 register coverage, and corrected twelve proven purpose mismatches based on focused source review. Scope stayed limited to B15 purpose classification.


Phase 2 purpose classification evidence: B16

- batch_id: B16
- title: DOCS_ROOT_MD_TXT
- asset_count: 36
- register_coverage: 36/36
- result: PASS WITH CORRECTION
- batch_manifest_modified: NO
- register_modified: YES
- corrections:
  - AGENTS.md functional_group changed from PROVIDER_INTEGRATION to DOCUMENTATION_KNOWLEDGE.
  - DEEPSEEK_STATE.md functional_group changed from PROVIDER_INTEGRATION to DOCUMENTATION_KNOWLEDGE.
  - GEMINI.md functional_group changed from PROVIDER_INTEGRATION to DOCUMENTATION_KNOWLEDGE.
  - Purpose descriptions corrected for proven B16 documentation assets based on focused source inspection.
- evidence: Local PowerShell B16 manifest/register/source inspection confirmed 36/36 source files exist, verified 36/36 register coverage, corrected three proven functional_group mismatches, corrected proven B16 purpose-description mismatches, and kept scope limited to B16 purpose classification.


Phase 2 purpose classification evidence: B17

- batch_id: B17
- title: DOCS_DIR
- asset_count: 24
- register_coverage: 24/24
- result: PASS WITH CORRECTION
- batch_manifest_modified: NO
- register_modified: YES
- corrections:
  - docs/api_quota_router.md functional_group changed from DEPLOYMENT_OPERATIONS to DOCUMENTATION_KNOWLEDGE.
  - docs/blueprint-semantic-drift-control-plane.md functional_group changed from DEPLOYMENT_OPERATIONS to DOCUMENTATION_KNOWLEDGE.
  - docs/README.md functional_group changed from DEPLOYMENT_OPERATIONS to DOCUMENTATION_KNOWLEDGE.
  - docs/SKCS_ENGINE_V2_PHASE05_INGEST_MAP.md functional_group changed from DEPLOYMENT_OPERATIONS to DOCUMENTATION_KNOWLEDGE.
  - Purpose descriptions corrected for proven B17 documentation assets based on focused source inspection.
- evidence: Local PowerShell B17 manifest/register/source inspection confirmed 24/24 source files exist, verified 24/24 register coverage, corrected four proven functional_group mismatches, corrected proven B17 purpose-description mismatches, and kept scope limited to B17 purpose classification.


Phase 2 purpose classification evidence: B18

- batch_id: B18
- title: SKCS_KNOWLEDGE_GOV_AND_AUDIT
- asset_count: 23
- register_coverage: 23/23
- result: PASS WITH CORRECTION
- batch_manifest_modified: NO
- register_modified: YES
- corrections:
  - No functional_group corrections required; all B18 assets remained DOCUMENTATION_KNOWLEDGE.
  - Purpose descriptions corrected for proven B18 audit/governance knowledge assets based on focused source inspection.
- evidence: Local PowerShell B18 manifest/register/source inspection confirmed 23/23 source files exist, verified 23/23 register coverage, confirmed functional_group alignment, corrected proven B18 purpose-description mismatches, and kept scope limited to B18 purpose classification.


Phase 2 purpose classification evidence: B19

- batch_id: B19
- title: SKCS_KNOWLEDGE_KNOWLEDGE
- asset_count: 17
- register_coverage: 17/17
- result: PASS WITH CORRECTION
- batch_manifest_modified: NO
- register_modified: YES
- corrections:
  - No functional_group corrections required; all B19 assets remained DOCUMENTATION_KNOWLEDGE.
  - Purpose descriptions corrected for proven B19 knowledge-layer registry/reference assets based on focused source inspection.
- evidence: Local PowerShell B19 manifest/register/source inspection confirmed 17/17 source files exist, verified 17/17 register coverage, confirmed functional_group alignment, corrected proven B19 purpose-description mismatches, and kept scope limited to B19 purpose classification.

## PHASE 2 - B20 PURPOSE CLASSIFICATION REVIEW - CLOSED

Result: PASS WITH CORRECTION

Scope:
- Batch: B20
- Title: SKCS_KNOWLEDGE_PROVIDERS
- Assets inspected: 18/18
- Start HEAD: 97b821b2

Read-only inspection findings:
- All B20 assets exist.
- All B20 assets are present in the repository asset register.
- All B20 assets are correctly classified as PROVIDER_INTEGRATION.
- Source skim confirms B20 assets are provider audits, endpoint catalogs, health reports, semantic mappings, readiness assessments, call restrictions, and synthesis notes.

Correction:
- SKCS-KNOWLEDGE/providers/soccerdata_provider_health.md purpose_description corrected from NotebookLM/workflow synthesis notes to provider health verification and probe notes.

Out of scope:
- GitHub vulnerability notices were not inspected or changed.

## PHASE 2 - B21 PURPOSE CLASSIFICATION REVIEW - CLOSED

Result: PASS WITH CORRECTION

Scope:
- Batch: B21 / PUBLIC_UI
- Assets reviewed: 64
- Files corrected: 18
- Changed files:
  - control-center/EDGE_REPOSITORY_ASSET_REGISTER.v1.json

Correction:
- public/data/*.json functional_group changed from FRONTEND_UI to GENERATED_OUTPUT.

Reason:
- Source inspection confirmed the public/data JSON files are generated/static sports data and cache outputs, including league data, sports data, event details, team form, injury/news, coverage, and VIP stress data.
- Reference inspection confirmed these files are consumed as data/cache outputs from frontend fetch paths and scripts, not maintained as UI pages/components/styles.
- Existing taxonomy supports GENERATED_OUTPUT for generated JSON/data/report artifacts.

Validation:
- B21 manifest count confirmed: 64.
- B21 post-correction group counts: FRONTEND_UI 38, GENERATED_OUTPUT 18, PUBLIC_ASSET 8.
- Scope limited to B21 purpose classification correction.

## PHASE 2 - B22 PURPOSE CLASSIFICATION REVIEW - CLOSED

Result: PASS - NO CORRECTION

Scope:
- Batch: B22 / SUPABASE_MIGRATIONS
- Manifest declared asset_count: 60
- Actual asset paths reviewed: 61
- Files corrected: 0
- Changed files:
  - control-center/EDGE_CONTROL_CENTER.md

Inspection:
- Confirmed B22 manifest title is SUPABASE_MIGRATIONS.
- Confirmed B22 manifest path list contains 61 actual asset paths under supabase/migrations/, despite declared asset_count being 60.
- Confirmed B22 register entries are classified as DATABASE_MIGRATION.
- Confirmed purpose evidence aligns with Supabase SQL migration files creating or altering database tables, indexes, functions, triggers, views, RLS policies, and related schema objects.

Validation:
- B22 post-inspection group counts: DATABASE_MIGRATION 61.
- No proven B22 purpose classification mismatches found.
- Count discrepancy recorded as a manifest metadata issue for later governance cleanup, not a B22 purpose classification mismatch.
- Scope limited to B22 purpose classification review.

## PHASE 2 - B23 PURPOSE CLASSIFICATION REVIEW - CLOSED

Result: PASS WITH CORRECTION

Scope:
- Batch: B23 / DB_SQL_AND_SUPABASE_OTHER
- Manifest declared asset_count: 20
- Actual asset paths reviewed: 20
- Existing source files found: 19
- Register coverage found: 19/20

Corrections:
- 11 SQL/schema assets changed from DATABASE to DATABASE_MIGRATION after source inspection confirmed schema-changing SQL behaviour.
- supabase/functions/semantic-drift-summary/index.ts changed from SCHEDULER_BACKGROUND to API_ROUTE because it serves HTTP requests, reads URL parameters, invokes get_semantic_violation_summary RPC, and returns JSON.
- control-center/EDGE_ASSET_REPOSITORY_MAP.md regenerated after register correction.

Governance/path drift recorded only:
- supabase/functions/sync-sports-data/index.ts is listed in B23 but is absent from the working tree and absent from the repository asset register.
- No deletion, manifest repair, or path removal was performed in B23.

Changed files:
- control-center/EDGE_REPOSITORY_ASSET_REGISTER.v1.json
- control-center/EDGE_ASSET_REPOSITORY_MAP.md
- control-center/EDGE_CONTROL_CENTER.md

Validation:
- B23 focused validation PASS.
- B23 post-correction counts: DATABASE_MIGRATION 11, DATABASE 4, SCHEDULER_BACKGROUND 3, API_ROUTE 1, REGISTER_MISSING 1.
- Full npm run control:classification remains blocked by pre-existing non-B23 issues: B22 manifest asset_count drift plus invalid relationship tags from earlier B21/B15 corrections.
- Scope limited to B23 purpose classification corrections.

## PHASE 2 - B24 PURPOSE CLASSIFICATION REVIEW - CLOSED

Result: PASS - NO CORRECTION

Scope:
- Batch: B24 / TESTS
- Manifest declared asset_count: 6
- Actual asset paths reviewed: 6
- Register coverage found: 6/6
- Files corrected: 0

Inspection:
- Confirmed B24 manifest title is TESTS.
- Confirmed B24 manifest path list contains 6 test assets under tests/.
- Confirmed all 6 B24 register entries are classified as TEST_PROOF.
- Source evidence scan confirmed each asset is a test or contract-proof file using node:test, assert, checker imports, route/UI checks, register checks, or runtime inventory validation helpers.

Validation:
- B24 post-inspection group counts: TEST_PROOF 6.
- No proven B24 purpose classification mismatches found.
- No register, map, source, manifest, merge, deletion, repair, or refactor was performed.
- Scope limited to B24 purpose classification review.


## PHASE 2 - B25 PURPOSE CLASSIFICATION REVIEW - CLOSED

Result: PASS WITH CORRECTION

Scope:
- Batch: B25 / SCRATCH
- Manifest declared asset_count: 2
- Actual asset paths reviewed: 2
- Register coverage found: 2/2

Correction:
- scratch/db_normalize.js functional_group changed from DATABASE_MIGRATION to DATABASE.
- scratch/db_normalize.js relationship_tags changed from ["DATABASE","MIGRATION","SQL","SCRIPT_TOOL"] to ["DATABASE","SQL","SCRIPT_TOOL"].

Reason:
- Source inspection confirmed scratch/db_normalize.js runs UPDATE statements to normalize sport labels in existing predictions_raw, leagues, and optional match_context_data rows.
- It does not create, alter, drop, index, trigger, function, or policy schema objects.
- Therefore it is database data-maintenance/normalization work, not a database migration.
- scratch/db_sync.js remains DATABASE because it only runs SELECT DISTINCT diagnostics against predictions_raw and leagues.

Changed files:
- control-center/EDGE_REPOSITORY_ASSET_REGISTER.v1.json
- control-center/EDGE_ASSET_REPOSITORY_MAP.md
- control-center/EDGE_CONTROL_CENTER.md

Validation:
- B25 post-correction group counts: DATABASE 2.
- No source, manifest, merge, deletion, retirement, or refactor was performed.
- Scope limited to B25 purpose classification correction.

## PHASE 2 - B26 PURPOSE CLASSIFICATION REVIEW - CLOSED

Result: PASS WITH CORRECTION

Scope:
- Batch: B26 / DEPLOYMENT_CI
- Manifest declared asset_count before correction: 5
- Actual tracked/on-disk asset paths reviewed: 3
- Register coverage found: 3/3
- Map coverage found: 3/3

Correction:
- Removed stale B26 manifest asset_paths:
  - .github/workflows/daily-insights.yml
  - .github/workflows/lineups-insights.yml
- Corrected B26 manifest asset_count from 5 to 3.

Reason:
- Local evidence confirmed both workflow files are not tracked by git.
- Local evidence confirmed both workflow files are missing on disk.
- Local evidence confirmed both workflow files are absent from EDGE_REPOSITORY_ASSET_REGISTER.v1.json.
- Local evidence confirmed both workflow files are absent from EDGE_ASSET_REPOSITORY_MAP.md.
- Therefore B26 manifest membership was stale; this was not missing purpose-classification work.

Inspection:
- Dockerfile remains DEPLOYMENT_OPERATIONS: container build recipe for backend Express server deployment.
- render.yaml remains DEPLOYMENT_OPERATIONS: Render web service and cron/scheduler configuration.
- vercel.json remains DEPLOYMENT_OPERATIONS: Vercel build, function, cron, header, and rewrite configuration.

Changed files:
- control-center/EDGE_ASSET_CLASSIFICATION_BATCHES.v1.json
- control-center/EDGE_CONTROL_CENTER.md

Validation:
- B26 post-correction manifest asset_count: 3.
- B26 post-correction group counts: DEPLOYMENT_OPERATIONS 3.
- No source, register, map, merge, deletion, retirement, or refactor was performed.
- Scope limited to B26 manifest stale-entry correction and purpose classification closure.
## PHASE 2 - B27 PURPOSE CLASSIFICATION REVIEW - CLOSED

Result: PASS WITH CORRECTION

Scope:
- Batch: B27 / ARCHIVE
- Manifest declared asset_count before correction: 59
- Actual manifest asset_paths reviewed: 58
- Map rows reviewed: 58
- Register/map/tracked/disk coverage: PASS

Correction:
- Corrected B27 manifest asset_count from 59 to 58.

Reason:
- Local validation confirmed B27 manifest asset_paths count is 58.
- Local validation confirmed B27 map row count is 58.
- Local validation confirmed all B27 manifest paths are tracked, on disk, in the register, and in the map.
- Therefore the B27 asset_count value was stale; this was not missing archive purpose-classification work.

Inspection:
- All B27 reviewed assets are under _archive/.
- Current state count: STALE_OR_SUPERSEDED 58.
- Functional group counts: DATABASE_MIGRATION 6, GENERATED_OUTPUT 3, SCRIPT_TOOL 49.
- No non-archive rows found.
- No non-stale rows found.

Changed files:
- control-center/EDGE_ASSET_CLASSIFICATION_BATCHES.v1.json
- control-center/EDGE_CONTROL_CENTER.md

Validation:
- B27 post-correction manifest asset_count: 58.
- B27 post-correction purpose classification review result: PASS WITH CORRECTION.
- No source, register, map, merge, deletion, retirement, or refactor was performed.
- Scope limited to B27 manifest asset_count correction and purpose classification closure.
## PHASE 2 - B28 PURPOSE CLASSIFICATION REVIEW - CLOSED

Result: PASS WITH CORRECTION

Scope:
- Batch: B28 / ROOT_NON_MD_TXT_FILES
- Manifest asset_count: 55
- Manifest asset_paths reviewed: 55
- Map rows reviewed: 55
- Register/map/tracked/disk coverage: PASS

Correction:
- Updated kabaddiPy purpose/evidence/next_validation.
- Updated sportbook purpose/evidence/next_validation.
- Functional group remains UNCATEGORIZED because current EAC functional_group enums do not include a dedicated SUBMODULE/GITLINK category.

Reason:
- Local validation confirmed both kabaddiPy and sportbook are Gitlink entries: git ls-tree reports mode 160000 commit.
- Local validation confirmed .gitmodules is missing.
- Local validation confirmed git submodule status fails because no submodule mapping exists.
- Therefore they are orphan Gitlink/submodule pointers, not normal readable folders/files.
- This phase records purpose only; restoration, deletion, retirement, or replacement belongs to later phases.

Inspection:
- B28 manifest count/path count/map row count: 55/55/55.
- B28 coverage: PASS.
- Functional group counts before correction: DATABASE_MIGRATION 1, DEPLOYMENT_OPERATIONS 8, DOCUMENTATION_KNOWLEDGE 1, GENERATED_OUTPUT 16, PUBLIC_ASSET 1, SCRIPT_TOOL 15, TEST_PROOF 11, UNCATEGORIZED 2.
- Current state count: UNKNOWN 55.

Changed files:
- control-center/EDGE_REPOSITORY_ASSET_REGISTER.v1.json
- control-center/EDGE_ASSET_REPOSITORY_MAP.md
- control-center/EDGE_CONTROL_CENTER.md

Validation:
- B28 purpose classification review result: PASS WITH CORRECTION.
- No source, manifest, merge, deletion, retirement, submodule repair, or refactor was performed.
- Scope limited to B28 purpose evidence correction and purpose classification closure.
## PHASE 2 - B28 REGISTER SCOPE REPAIR - CLOSED

Result: PASS

Scope:
- Batch: B28 / ROOT_NON_MD_TXT_FILES
- Repair target: EDGE_REPOSITORY_ASSET_REGISTER.v1.json over-broad text replacement from prior B28 closure commit.
- Intended B28 target assets: kabaddiPy and sportbook only.

Correction:
- Reverted over-broad orphan Gitlink/submodule next_validation, purpose, and evidence text from non-target B28 register entries.
- Preserved the orphan Gitlink/submodule purpose/evidence/next_validation correction only for kabaddiPy and sportbook.
- No map correction was required; the map already had only the two intended B28 row corrections.

Reason:
- Post-push verification showed the B28 register replacement was broader than intended.
- The correct B28 purpose correction applies only to kabaddiPy and sportbook.
- This repair restores Phase 2 scope discipline before B29 starts.

Changed files:
- control-center/EDGE_REPOSITORY_ASSET_REGISTER.v1.json
- control-center/EDGE_CONTROL_CENTER.md

Validation:
- Register orphan Gitlink/submodule purpose count: 2.
- Register orphan Gitlink/submodule evidence count: 2.
- Register orphan Gitlink/submodule next_validation count: 2.
- No source, manifest, map, merge, deletion, retirement, submodule repair, or refactor was performed.
- B29 was not started before this repair.
## PHASE 2 - B29 PURPOSE CLASSIFICATION REVIEW - CLOSED

Result: PASS WITH CORRECTION

Scope:
- Batch: B29 / DOT_TOOL_DIRS_AND_SMALL_DIRS
- Manifest asset_count: 26
- Manifest asset_paths reviewed: 26
- Map rows reviewed: 26
- Register/map/tracked/disk coverage: PASS

Correction:
- Updated .qwen/settings.json from UNCATEGORIZED to DOCUMENTATION_KNOWLEDGE.
- Updated .qwen/settings.json.orig from UNCATEGORIZED to DOCUMENTATION_KNOWLEDGE.
- Updated both Qwen purpose descriptions to identify them as local AI-assistant command-permission settings.

Reason:
- Local validation confirmed both files are readable JSON configuration files.
- Their content defines Qwen allowed Bash command permissions.
- They are not source runtime files, generated outputs, deployments, tests, or executable scripts.
- Therefore DOCUMENTATION_KNOWLEDGE is the closest valid current EAC functional group.

Inspection:
- B29 manifest count/path count/map row count: 26/26/26.
- B29 coverage: PASS.
- Functional group counts before correction: API_ROUTE 1, BACKEND_RUNTIME 2, DEPLOYMENT_OPERATIONS 1, DOCUMENTATION_KNOWLEDGE 9, GENERATED_OUTPUT 8, PROVIDER_INTEGRATION 1, PUBLIC_ASSET 1, SCRIPT_TOOL 1, UNCATEGORIZED 2.
- Current state count: UNKNOWN 26.

Changed files:
- control-center/EDGE_REPOSITORY_ASSET_REGISTER.v1.json
- control-center/EDGE_ASSET_REPOSITORY_MAP.md
- control-center/EDGE_CONTROL_CENTER.md

Validation:
- B29 purpose classification review result: PASS WITH CORRECTION.
- No source, manifest, merge, deletion, retirement, runtime repair, or refactor was performed.
- Scope limited to B29 Qwen purpose classification correction and closure.
## PHASE 2 - B22 MANIFEST COUNT REPAIR - CLOSED

Result: PASS

Scope:
- Batch: B22 / SUPABASE_MIGRATIONS
- Repair target: EDGE_ASSET_CLASSIFICATION_BATCHES.v1.json stale asset_count only.

Correction:
- Corrected B22 manifest asset_count from 60 to 61.

Reason:
- Phase 2 final closure control found B22 asset_count 60 but asset_paths.Count 61.
- Read-only B22 inspection confirmed B22 map row count is 61.
- The first and last manifest paths matched the B22 migration range.
- This was a stale manifest count, not missing purpose-classification work.

Changed files:
- control-center/EDGE_ASSET_CLASSIFICATION_BATCHES.v1.json
- control-center/EDGE_CONTROL_CENTER.md

Validation:
- B22 post-repair asset_count: 61.
- B22 post-repair asset_paths.Count: 61.
- Repository-wide manifest count check: PASS.
- No source, register, map, merge, deletion, retirement, runtime repair, or refactor was performed.
- Scope limited to B22 manifest count correction before Phase 2 closure.
## PHASE 2 - PURPOSE CLASSIFICATION REVIEW - CLOSED

Result: PASS WITH CORRECTIONS

Scope:
- Phase: PHASE_2 / Purpose Classification Review
- Batches reviewed under Phase 2 closure controls: B01-B29
- Final closure control HEAD before closure: 50f80ca1
- Final manifest count check: PASS

Corrections completed during late Phase 2 closure:
- B22 manifest asset_count corrected from 60 to 61.
- B25 scratch database-normalization purpose corrected.
- B26 stale manifest workflow entries removed and asset_count corrected to 3.
- B27 archive manifest asset_count corrected to 58.
- B28 orphan Gitlink/submodule purpose evidence corrected for kabaddiPy and sportbook.
- B28 register scope drift repaired after post-push verification.
- B29 Qwen settings files corrected from UNCATEGORIZED to DOCUMENTATION_KNOWLEDGE.

Final validation:
- Working tree clean before closure.
- Local branch synced with origin/main before closure.
- All batch asset_count values match asset_paths.Count.
- Control Center closure notes exist for late Phase 2 corrections and repairs.
- No source deletion, merge, retirement, runtime repair, submodule repair, or refactor was performed as part of final closure.
- Phase 2 is closed; do not reopen without a new explicit Control Center task.

## CONTROL CENTER PHASE-STATE REPAIR - PHASE 3 ACTIVATED

Result: PASS

Scope:
- Repair target: Control Center cleanup programme machine-readable state and checker alignment.
- Prior completed phases preserved: PHASE_1 Exact Duplicate Elimination, PHASE_2 Purpose Classification Review.
- New active phase: PHASE_3 / Active Use Identification.

Phase 3 rule:
- Active question: Is each remaining governed file currently used?
- Outcomes: ACTIVE, INDIRECTLY_ACTIVE, MANUAL_USE, NO_CURRENT_USE_FOUND, UNKNOWN.
- NO_CURRENT_USE_FOUND does not authorize deletion.

Validation boundary:
- No Phase 3 asset-use review was started.
- No product/source/runtime files were changed.
- No deletion, merge, retirement, refactor, Supabase mutation, or classification reopen was performed.

## PHASE 3 — B01 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 — Active Use Identification
- Batch: B01 / CONTROL_CENTER
- Question: Is each B01 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO

Outcome summary:
- ACTIVE: 13
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 2
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B01 outcomes:
1. control-center/check_control_center.js — ACTIVE
2. control-center/check_edge_asset_classification.js — ACTIVE
3. control-center/check_edge_project_register.js — ACTIVE
4. control-center/check_edge_repository_asset_register.js — ACTIVE
5. control-center/check_edge_system_runtime_inventory.js — ACTIVE
6. control-center/EDGE_ASSET_CLASSIFICATION_BATCHES.v1.json — ACTIVE
7. control-center/EDGE_ASSET_REPOSITORY_MAP.md — ACTIVE
8. control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json — ACTIVE
9. control-center/EDGE_CONTROL_CENTER.md — ACTIVE
10. control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json — ACTIVE
11. control-center/EDGE_PROJECT_BACKLOG.md — MANUAL_USE
12. control-center/EDGE_PROJECT_DEPENDENCY_MAP.md — MANUAL_USE
13. control-center/EDGE_REPOSITORY_ASSET_REGISTER.v1.json — ACTIVE
14. control-center/EDGE_SYSTEM_RUNTIME_INVENTORY.v1.json — ACTIVE
15. control-center/EDGE_SYSTEM_RUNTIME_MAP.md — ACTIVE

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B01 batch state not advanced in this patch.

## PHASE 3 — B02 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 — Active Use Identification
- Batch: B02 / BACKEND_DIRECT_FILES
- Question: Is each B02 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO

Outcome summary:
- ACTIVE: 8
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 4
- NO_CURRENT_USE_FOUND: 1
- UNKNOWN: 0

B02 outcomes:
1. backend/.gitignore — ACTIVE
   Evidence: Backend Git operational ignore file excluding backend node_modules, env files, local DB/log/form artifacts, and backend.local-backup.

2. backend/apiClients.js — ACTIVE
   Evidence: Imported by active backend data-provider service and exports provider clients/helper functions used by backend ingestion/provider flows.

3. backend/checkCanonicalEvents.js — MANUAL_USE
   Evidence: Standalone Supabase diagnostic script for canonical_events counts, sport distribution, and future event inspection. No active runtime caller found.

4. backend/config.js — ACTIVE
   Evidence: Runtime configuration module loaded by server, database modules, api clients, and services.

5. backend/database.js — ACTIVE
   Evidence: Runtime PostgreSQL/Supabase database module used by server startup, routes, subscription/profile helpers, query helpers, and transaction helpers.

6. backend/db.js — ACTIVE
   Evidence: Runtime DB helper imported by EdgeMind controller path and active backend code.

7. backend/dbBootstrap.js — ACTIVE
   Evidence: Imported and executed by backend/server-express.js during startup to verify tables, compatibility views, cleanup, and bootstrap state.

8. backend/deploy-trigger-cricket.js — ACTIVE
   Evidence: Render cricket cron start command points to node backend/deploy-trigger-cricket.js; script exits safely unless cricket ingestion is enabled.

9. backend/deploy-trigger.js — ACTIVE
   Evidence: Render weekly global scrape cron start command points to node backend/deploy-trigger.js.

10. backend/edgemind_inference.py — MANUAL_USE
    Evidence: Standalone Python EdgeMind/Antigravity inference bridge with CLI entrypoint requiring python edgemind_inference.py <event_id>. No active Node/server caller found.

11. backend/package-lock.json — NO_CURRENT_USE_FOUND
    Evidence: Minimal backend lockfile with only empty backend package entry. Root install/build uses root package.json; no backend package script caller found.

12. backend/server-express.js — ACTIVE
    Evidence: Root package main/start/dev target and Render backend web start command. Mounts backend API routes and server runtime.

13. backend/test-ultra-slim.js — MANUAL_USE
    Evidence: Standalone local Dolphin inference test script. No active package/runtime caller found.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B02 batch state not advanced in this patch.

## PHASE 3 - B03 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE 3 - Active Use Identification
- Batch: B03 / BACKEND_ROUTES_AND_CONTROLLERS
- Question: Is each B03 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO

Outcome summary:
- ACTIVE: 28
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 0
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B03 outcomes:
1. backend/controllers/edgeMindController.js - ACTIVE
   Evidence: backend/routes/chat.js imports generateBotResponse from this controller, and backend/server-express.js mounts the chat router at /api/chat and /api/edgemind.

2. backend/routes/accuracy.js - ACTIVE
   Evidence: Imported by backend/server-express.js and mounted at /api/accuracy.

3. backend/routes/antigravity.js - ACTIVE
   Evidence: Imported by backend/server-express.js and mounted at /api/antigravity.

4. backend/routes/chat.js - ACTIVE
   Evidence: Imported by backend/server-express.js and mounted at /api/chat and /api/edgemind.

5. backend/routes/controlCenter.js - ACTIVE
   Evidence: Imported by backend/server-express.js and mounted at /api/control-center.

6. backend/routes/cricketCache.js - ACTIVE
   Evidence: Imported by backend/server-express.js and mounted at /api/cricket/cache.

7. backend/routes/cricketCount.js - ACTIVE
   Evidence: Imported by backend/server-express.js and mounted at /api/cricket/count.

8. backend/routes/cricketCron.js - ACTIVE
   Evidence: Imported by backend/server-express.js and mounted at /api/cron.

9. backend/routes/cricketInsights.js - ACTIVE
   Evidence: Imported by backend/server-express.js and mounted at /api/cricket/insights.

10. backend/routes/debug.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted at /api/debug.

11. backend/routes/direct1x2.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted at /api/direct-1x2.

12. backend/routes/divanscore.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted at /api.

13. backend/routes/feedback.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted at /api/feedback.

14. backend/routes/metrics.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted at /api/metrics.

15. backend/routes/pipeline.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted at /api/pipeline.

16. backend/routes/predictions.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted at /api/predictions.

17. backend/routes/refresh-ai.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted at /api/admin.

18. backend/routes/scheduler.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted at /api/scheduler.

19. backend/routes/semanticDrift.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted at /api/semantic-drift-summary.

20. backend/routes/skcsGrading.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted at /api/skcs.

21. backend/routes/sportsEdge.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted at /.

22. backend/routes/tier1.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted at /api/tier1.

23. backend/routes/user.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted at /api/user.

24. backend/routes/v1/acca.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted under /api/v1.

25. backend/routes/v1/predictions.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted under /api/v1.

26. backend/routes/v1/sameMatchBuilder.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted at /api/v1/smb.

27. backend/routes/v1/secondaryMarkets.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted at /api/v1/markets/secondary.

28. backend/routes/vip.js - ACTIVE
    Evidence: Imported by backend/server-express.js and mounted at /api/vip.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B03 batch state not advanced in this patch.


## PHASE 3 — B04 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 — Active Use Identification
- Batch: B04 / BACKEND_UTILS_SEMANTIC_CORE_AND_TEST
- Question: Is each B04 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO

Outcome summary:
- ACTIVE: 37
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 6
- NO_CURRENT_USE_FOUND: 3
- UNKNOWN: 0

B04 outcomes:
1. backend/audit/system_integrity_audit.md — MANUAL_USE
   Evidence: System integrity audit document retained as human/governance evidence. No runtime, package script, or tooling caller found.

2. backend/core/executionPipeline.js — ACTIVE
   Evidence: Referenced by active backend routes, server runtime, cron jobs, sync services, heartbeat service, and pipeline/direct builder services.

3. backend/core/verificationController.js — ACTIVE
   Evidence: Referenced by backend/server-express.js, active prediction route, semantic-layer controllers, AI/context/pipeline services, sync service, and TheSportsDB pipeline.

4. backend/core/verificationSignalContract.js — ACTIVE
   Evidence: Imported by backend/core/verificationController.js and used through the active verification controller path.

5. backend/errors/ProviderQuotaExceededError.js — ACTIVE
   Evidence: Imported by backend/apiClients.js and backend/services/dataProvider.js for active provider quota handling.

6. backend/logic/edgeMind_manifest.json — NO_CURRENT_USE_FOUND
   Evidence: Logic manifest file exists and documents EdgeMind scoring, but no runtime, package script, manual tooling, or documentation consumer was found beyond governance/report registration.

7. backend/middleware/supabaseJwt.js — ACTIVE
   Evidence: Imported by active auth-protected backend routes and backend/server-express.js.

8. backend/parsers/base_sport_parser.py — NO_CURRENT_USE_FOUND
   Evidence: Parser module exists, but no current runtime, package script, manual tooling, or documentation consumer was found beyond governance/report registration.

9. backend/semantic-layer/controlPlaneEvaluator.js — ACTIVE
   Evidence: Referenced by active execution pipeline, verification controller, semantic drift summary service, runtime maps, and audit tooling.

10. backend/semantic-layer/decisionFingerprintService.js — ACTIVE
    Evidence: Referenced by backend/core/executionPipeline.js and execution-spine audit tooling.

11. backend/semantic-layer/enforcementGuard.js — ACTIVE
    Evidence: Referenced by active backend/services/aiPipeline.js and semantic control-plane documentation/runtime maps.

12. backend/semantic-layer/errorMemoryLayer.js — ACTIVE
    Evidence: Referenced by backend/core/executionPipeline.js and execution-spine audit tooling.

13. backend/semantic-layer/gatekeeperAdapter.js — ACTIVE
    Evidence: Referenced by backend/core/executionPipeline.js and execution-spine audit tooling.

14. backend/semantic-layer/governanceGatekeeper.js — ACTIVE
    Evidence: Referenced by active cricket cron route, cron jobs service, gatekeeper adapter, runtime maps, and execution-spine audit tooling.

15. backend/semantic-layer/normalizer.js — ACTIVE
    Evidence: Referenced by enforcementGuard.js, provider normalizer paths, AI/sync service context, and boundary audit tooling.

16. backend/semantic-layer/preflightSimulator.js — ACTIVE
    Evidence: Referenced by backend/core/executionPipeline.js and execution-spine audit tooling.

17. backend/semantic-layer/registry.js — ACTIVE
    Evidence: Referenced by football provider normalizers, semantic normalizer, sportsdataio contract helpers, and provider mapping documentation.

18. backend/semantic-layer/sportsdataioContractHelpers.js — MANUAL_USE
    Evidence: Referenced by scripts/sync-ucl-context.js and provider mapping documentation. No active runtime caller found.

19. backend/semantic-layer/verificationController.js — ACTIVE
    Evidence: Referenced by backend/core/executionPipeline.js, runtime maps, and execution-spine audit tooling.

20. backend/semantic-layer/violationLogger.js — ACTIVE
    Evidence: Referenced by enforcementGuard.js and runtime/compliance maps.

21. backend/test/smoke-test-insight-engine.js — MANUAL_USE
    Evidence: Standalone smoke test file with Node execution instructions and imports from backend/utils/insightEngine.js. No active runtime caller found.

22. backend/test/smoke-test-skcs-law.js — MANUAL_USE
    Evidence: Standalone law-compliance smoke test file with Node execution instructions; referenced by smoke-test-insight-engine.js. No active runtime caller found.

23. backend/utils/accaLogicEngine.js — ACTIVE
    Evidence: Referenced by accaBuilder, acca math utilities, market scoring engine, smoke tests, patch scripts, and football-rules audit tooling.

24. backend/utils/apiCache.js — ACTIVE
    Evidence: Referenced by backend/utils/rapidApiWaterfall.js and cache/provider service paths.

25. backend/utils/apiQueue.js — ACTIVE
    Evidence: Referenced by active cron jobs, enhanced match details service, hybrid sports data service, and TheSportsDB pipeline.

26. backend/utils/apiUsageLimiter.js — MANUAL_USE
    Evidence: Referenced by scripts/import-today-snapshot-pipeline.js. No active runtime caller found.

27. backend/utils/auth.js — ACTIVE
    Evidence: Referenced by active backend routes, backend/server-express.js, runtime inventory, and control-center routes.

28. backend/utils/availability.js — ACTIVE
    Evidence: Referenced by active predictions route and live fixture fetch tooling.

29. backend/utils/conflictResolver.js — ACTIVE
    Evidence: Referenced by backend/services/accaBuilder.js and runtime maps.

30. backend/utils/contextInsights.js — ACTIVE
    Evidence: Referenced by active predictions and VIP routes.

31. backend/utils/dateNormalization.js — ACTIVE
    Evidence: Referenced by backend/server-express.js and active predictions route.

32. backend/utils/db.js — ACTIVE
    Evidence: Runtime re-export to backend/db.js; referenced by active backend routes, server runtime, providers, services, semantic-layer modules, scripts, and system runtime inventory.

33. backend/utils/insightEngine.js — ACTIVE
    Evidence: Referenced by active predictions route, accaBuilder service, patch scripts, and smoke tests.

34. backend/utils/insightValidationMatrix.js — ACTIVE
    Evidence: Referenced by active VIP route and accaBuilder service.

35. backend/utils/jobLogger.js — ACTIVE
    Evidence: Referenced by backend/server-express.js, scheduler/test logger scripts, runtime maps, and AGENTS.md.

36. backend/utils/keyPool.js — ACTIVE
    Evidence: Referenced by backend/apiClients.js, data provider services, rapidApiWaterfall.js, live fixture fetch tooling, and import snapshot tooling.

37. backend/utils/marketConsistency.js — ACTIVE
    Evidence: Referenced by active predictions route and accaBuilder service.

38. backend/utils/pipelineLogger.js — ACTIVE
    Evidence: Referenced by active debug/predictions routes, accaBuilder, aiPipeline, market intelligence, sync service, and insight engine paths.

39. backend/utils/providerCircuitBreaker.js — ACTIVE
    Evidence: Referenced by backend/apiClients.js, api cache service, live fixture fetch tooling, and runtime maps.

40. backend/utils/purgeStaleData.js — MANUAL_USE
    Evidence: One-off CLI utility with explicit usage `node backend/utils/purgeStaleData.js`; no active runtime caller found.

41. backend/utils/rapidApiWaterfall.js — ACTIVE
    Evidence: Referenced by backend/server-express.js, live fixture fetch tooling, cache test tooling, and runtime maps.

42. backend/utils/secondaryMarketSelector.js — ACTIVE
    Evidence: Referenced by backend/services/direct1x2Builder.js and football-rules audit tooling.

43. backend/utils/sportsrcNormalizer.js — ACTIVE
    Evidence: Referenced by backend/services/dataProvider.js.

44. backend/utils/validation.js — ACTIVE
    Evidence: Referenced by accaBuilder, aiPipeline, filterEngine, and runtime inventory.

45. backend/utils/weather.js — ACTIVE
    Evidence: Referenced by active predictions route and live fixture fetch tooling.

46. backend/workers/now_api_pulse.py — NO_CURRENT_USE_FOUND
    Evidence: Background worker module exists, but no current runtime, package script, manual tooling, or documentation consumer was found beyond governance/report registration.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B04 batch state not advanced in this patch.


## PHASE 3 — B05 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 — Active Use Identification
- Batch: B05 / BACKEND_SCRIPTS
- Question: Is each B05 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO

Outcome summary:
- ACTIVE: 1
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 14
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B05 outcomes:
1. backend/scripts/add-avg-total-log.js — MANUAL_USE
   Evidence: Standalone repository patch/diagnostic insertion script targeting backend/services/accaBuilder.js. No runtime, package script, or external tooling caller found.

2. backend/scripts/add-diagnostics.js — MANUAL_USE
   Evidence: Standalone repository patch/diagnostic insertion script targeting backend/services/accaBuilder.js. No runtime, package script, or external tooling caller found.

3. backend/scripts/bridge_frontend.py — MANUAL_USE
   Evidence: Standalone Python Supabase bridge script with environment loading and direct Supabase client usage. Referenced only by runtime consumer audit documentation and governance/report files.

4. backend/scripts/generate_vip_master.py — MANUAL_USE
   Evidence: Standalone Python VIP generation script using Supabase and AI provider clients. Referenced only by runtime consumer audit documentation and governance/report files.

5. backend/scripts/ingest_football.py — MANUAL_USE
   Evidence: Standalone Python football ingestion script using API-Sports and Supabase. Referenced by ingest-map documentation and governance/report files.

6. backend/scripts/patch-acca-builder.js — MANUAL_USE
   Evidence: Standalone repository patch script targeting backend/services/accaBuilder.js. No runtime, package script, or external tooling caller found.

7. backend/scripts/patch-card-uniqueness.js — MANUAL_USE
   Evidence: Standalone repository patch script targeting backend/services/accaBuilder.js for card uniqueness/team-lock logic. No runtime, package script, or external tooling caller found.

8. backend/scripts/patch-final-flow.js — MANUAL_USE
   Evidence: Standalone repository patch script targeting backend/services/accaBuilder.js and insight-engine flow. No runtime, package script, or external tooling caller found.

9. backend/scripts/patch-row-cleanup.js — MANUAL_USE
   Evidence: Standalone repository patch script targeting backend/services/accaBuilder.js to insert stale-row cleanup logic. No runtime, package script, or external tooling caller found.

10. backend/scripts/patch-skcs-law.js — MANUAL_USE
    Evidence: Standalone repository patch script targeting ACCA/SKCS law imports and logic. No runtime, package script, or external tooling caller found.

11. backend/scripts/populate_sports_data.py — MANUAL_USE
    Evidence: Standalone Python data population script with direct provider keys and Supabase client usage; manually referenced from scripts/populate_sports_data.py. No active runtime caller found.

12. backend/scripts/requirements.txt — MANUAL_USE
    Evidence: Python dependency manifest for backend scripts/tooling; referenced by documentation and tooling contexts. No package/runtime execution caller found.

13. backend/scripts/sync-sportsrc-fixtures.js — ACTIVE
    Evidence: Referenced from package.json and implemented as a Supabase-backed SportsRC fixture sync script.

14. backend/scripts/test_ai_providers.py — MANUAL_USE
    Evidence: Standalone Python AI-provider test script with local/OpenAI-style provider configuration. No runtime, package script, or external tooling caller found.

15. backend/scripts/test_ai_real_matches.py — MANUAL_USE
    Evidence: Standalone Python AI real-match test script using Supabase and provider clients. No runtime, package script, or external tooling caller found.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B05 batch state not advanced in this patch.


## PHASE 3 — B06 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 — Active Use Identification
- Batch: B06 / BACKEND_PROVIDERS
- Question: Is each B06 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO

Outcome summary:
- ACTIVE: 0
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 10
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B06 outcomes:
1. backend/providers/football/bigBallsDataNormalizer.js — MANUAL_USE
   Evidence: Referenced by backend/providers/football/bigBallsDataProvider.js and provider documentation. No active runtime or package caller found.

2. backend/providers/football/bigBallsDataProvider.js — MANUAL_USE
   Evidence: Referenced by scripts/verify-bigballs-provider.js and provider documentation. No active runtime or package caller found.

3. backend/providers/football/bsdNormalizer.js — MANUAL_USE
   Evidence: Referenced by backend/providers/football/bsdProvider.js and provider documentation. No active runtime or package caller found.

4. backend/providers/football/bsdProvider.js — MANUAL_USE
   Evidence: Referenced by scripts/verify-bsd-provider.js and provider documentation. No active runtime or package caller found.

5. backend/providers/football/bzzoiroNormalizer.js — MANUAL_USE
   Evidence: Referenced by backend/providers/football/bsdNormalizer.js, backend/providers/football/bzzoiroProvider.js, and provider documentation. No active runtime or package caller found.

6. backend/providers/football/bzzoiroProvider.js — MANUAL_USE
   Evidence: Referenced by scripts/sync-bsd-enrichment.js, scripts/verify-bsd-enrichment.js, and provider documentation. No active runtime or package caller found.

7. backend/providers/football/soccerDataApiNormalizer.js — MANUAL_USE
   Evidence: Referenced by backend/providers/football/soccerDataApiProvider.js, SoccerData audit scripts, and provider documentation. No active runtime or package caller found.

8. backend/providers/football/soccerDataApiProvider.js — MANUAL_USE
   Evidence: Referenced by scripts/verify-soccerdata-provider.js and provider documentation. No active runtime or package caller found.

9. backend/providers/football/sportsApiProFootballAdapter.js — MANUAL_USE
   Evidence: Referenced by scripts/test-sportsapi-pro-football-adapter.js. No active runtime or package caller found.

10. backend/providers/football/sportsApiProFootballNormalizer.js — MANUAL_USE
    Evidence: Referenced by backend/providers/football/sportsApiProFootballAdapter.js. No active runtime or package caller found.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B06 batch state not advanced in this patch.

## PHASE 3 — B07 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 — Active Use Identification
- Batch: B07 / BACKEND_SRC_SERVICES
- Question: Is each B07 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO

Outcome summary:
- ACTIVE: 7
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 0
- NO_CURRENT_USE_FOUND: 2
- UNKNOWN: 0

B07 outcomes:
1. backend/src/services/contextIntelligence/adjustProbability.js — ACTIVE
   Evidence: Imported by backend/services/aiPipeline.js and used by the active prediction pipeline to adjust baseline probabilities and apply market-level context adjustments.

2. backend/src/services/contextIntelligence/aiPipeline_core.js — ACTIVE
   Evidence: Imported by backend/src/services/contextIntelligence/aiPipeline.js and used as the core enrichment pipeline for weather, availability, discipline, stability, and extended context signals.

3. backend/src/services/contextIntelligence/aiPipeline.js — ACTIVE
   Evidence: Imported by backend/services/aiPipeline.js; runtime map records it as consumed by backend/services/aiPipeline.js and using fixture_context_cache.

4. backend/src/services/contextIntelligence/availabilitySignal.js — ACTIVE
   Evidence: Imported by backend/src/services/contextIntelligence/aiPipeline_core.js and used in the active context enrichment path to compute availability_risk.

5. backend/src/services/contextIntelligence/cacheService.js — NO_CURRENT_USE_FOUND
   Evidence: Exports context_intelligence_cache helper functions, but no current runtime, package script, or active service caller was found for the exported helper names.

6. backend/src/services/contextIntelligence/disciplineSignal.js — ACTIVE
   Evidence: Imported by backend/src/services/contextIntelligence/aiPipeline_core.js and used in the active context enrichment path to compute discipline_risk.

7. backend/src/services/contextIntelligence/stabilitySignal.js — ACTIVE
   Evidence: Imported by backend/src/services/contextIntelligence/aiPipeline_core.js and used in the active context enrichment path to compute stability_risk.

8. backend/src/services/contextIntelligence/weatherSignal.js — ACTIVE
   Evidence: Imported by backend/src/services/contextIntelligence/aiPipeline_core.js; runtime map records it as consumed by that core pipeline and tied to api.weatherapi.com.

9. backend/src/services/marketRouter/waterfall.js — NO_CURRENT_USE_FOUND
   Evidence: Exports resolveDecision for market waterfall selection, but no current runtime, package script, or active service caller was found for resolveDecision or the marketRouter waterfall module.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B07 batch state not advanced in this patch.
## PHASE 3 — B08 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 — Active Use Identification
- Batch: B08 / BACKEND_ADAPTERS_AND_CONFIG
- Question: Is each B08 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO

Outcome summary:
- ACTIVE: 9
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 3
- NO_CURRENT_USE_FOUND: 1
- UNKNOWN: 0

B08 outcomes:
1. backend/adapters/f1Adapter.js — NO_CURRENT_USE_FOUND
   Evidence: File exports a disabled F1 adapter that throws "F1 adapter is disabled in this deployment"; repository search found no current caller beyond governance/manifest references.

2. backend/adapters/footballAdapter.js — ACTIVE
   Evidence: Imported by backend/adapters/index.js. The Supabase scheduledFixtureSync function imports loadAdapter from backend/adapters/index.js and dynamically loads configured adapters for enabled sport sync records.

3. backend/adapters/index.js — ACTIVE
   Evidence: Imported by supabase/edge-functions/scheduledFixtureSync/index.ts and used to load configured sport adapters before fixture fetch.

4. backend/adapters/tennisAdapter.js — ACTIVE
   Evidence: Imported by backend/adapters/index.js, which is consumed by scheduledFixtureSync for configured adapter loading.

5. backend/config/activeSports.js — ACTIVE
   Evidence: Imported by active backend scheduler, sync service, AI pipeline, ACCA builder, and EdgeMind controller paths to resolve enabled deployment sports.

6. backend/config/apiEndpoints.js — MANUAL_USE
   Evidence: Imported by backend/utils/apiUsageLimiter.js for API-Sports daily hard-cap constants; current evidence points to utility/script usage rather than a proven active server/runtime path.

7. backend/config/bigBallsLeagueMap.js — ACTIVE
   Evidence: Imported by backend/services/bigBallsFootballBridge.js, which is imported by backend/services/dataProvider.js in the active data-provider path.

8. backend/config/footballRules.js — ACTIVE
   Evidence: Imported by backend/services/accaBuilder.js for active ACCA/football rule thresholds and constraints.

9. backend/config/predictionOutcomes.js — ACTIVE
   Evidence: Imported by backend/services/marketScoringEngine.js and used by scoreMarkets() to resolve the sport market/outcome universe.

10. backend/config/soccerDataLeagueMap.js — MANUAL_USE
    Evidence: Referenced by backend/providers/football/soccerDataApiProvider.js and SoccerData audit/discovery tooling; no active runtime caller was proven for the SoccerData provider path in this phase.

11. backend/config/sportRules.js — MANUAL_USE
    Evidence: Imported by scripts/run-stage2-context.js for staged context math, and that stage is invoked by scripts/run-master-pipeline.js; no active server/package runtime caller was proven.

12. backend/config/subscriptionMatrix.js — ACTIVE
    Evidence: Imported by backend/server-express.js, backend/routes/predictions.js, and backend/controllers/edgeMindController.js for plan capabilities, prediction filtering, daily allocations, and subscription access shaping.

13. backend/config/subscriptionPlans.js — ACTIVE
    Evidence: Imported by backend/routes/user.js, backend/routes/predictions.js, backend/server-express.js, subscriptionMatrix.js, and EdgeMind controller paths for plan normalization and tier-key resolution.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B08 batch state not advanced in this patch.
## PHASE 3 — B09 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 — Active Use Identification
- Batch: B09 / BACKEND_SERVICES
- Question: Is each B09 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO

Outcome summary:
- ACTIVE: 63
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 6
- NO_CURRENT_USE_FOUND: 17
- UNKNOWN: 0

B09 ACTIVE assets:
- backend/services/accaBuilder.js
- backend/services/aiPipeline.js
- backend/services/aiPipelineOrchestrator.js
- backend/services/aiProvider.js
- backend/services/aiScoring.js
- backend/services/aiTelemetryService.js
- backend/services/antigravity/WorkflowEngine.js
- backend/services/apiCacheService.js
- backend/services/apiQuotaRouter.js
- backend/services/apiQuotaRouterProviders.js
- backend/services/bigBallsDataApiClient.js
- backend/services/bigBallsFootballBridge.js
- backend/services/blockedApiCallsLog.js
- backend/services/canonicalEvents.js
- backend/services/canonicalIngestFirewall.js
- backend/services/conflictEngine.js
- backend/services/contextEnrichmentService.js
- backend/services/contextIngestionService.js
- backend/services/contradictionGovernance.js
- backend/services/controlCenterReadService.js
- backend/services/cricApiCacheService.js
- backend/services/cricbuzzService.js
- backend/services/cricketLiveEnrichmentService.js
- backend/services/cricketLiveMatchResolver.js
- backend/services/cricketRulesEngine.js
- backend/services/cronJobs.js
- backend/services/dataProvider.js
- backend/services/dataProviders.js
- backend/services/direct1x2Builder.js
- backend/services/direct1x2Engine.js
- backend/services/divanscoreService.js
- backend/services/enhancedMatchDetailsService.js
- backend/services/espnHiddenApiService.js
- backend/services/filterEngine.js
- backend/services/footballH2HExtractor.js
- backend/services/footballHighlightsService.js
- backend/services/footballRankExtractor.js
- backend/services/freeLivescoreApiService.js
- backend/services/gradingAccuracyCore.js
- backend/services/gradingSnapshotService.js
- backend/services/hybridSportsDataService.js
- backend/services/marketIntelligence.js
- backend/services/marketScoringEngine.js
- backend/services/masterRulebookRiskClassification.js
- backend/services/metrxFactoryService.js
- backend/services/normalizerService.js
- backend/services/oddsBudgetService.js
- backend/services/pipelineMetricsService.js
- backend/services/proFootballDataService.js
- backend/services/providerQuotaService.js
- backend/services/quotaPlanner.js
- backend/services/safeHavenSelector.js
- backend/services/saveContextData.js
- backend/services/saveDirectInsights.js
- backend/services/semanticDriftSummaryService.js
- backend/services/skcsHeartbeat.js
- backend/services/sportsrcHealthService.js
- backend/services/subscriptionTiming.js
- backend/services/syncService.js
- backend/services/systemTruthLogger.js
- backend/services/thesportsdbPipeline.js
- backend/services/tier1BootstrapService.js
- backend/services/tier1SchemaProfile.js

Evidence for ACTIVE group:
Runtime map records confirmed reachability and active consumers through backend routes, server startup, active pipeline services, metrics routes, scheduler routes, cricket routes, control-center routes, semantic drift routes, and service-to-service runtime chains.

B09 MANUAL_USE assets:
- backend/services/bzzoiroApiClient.js
  Evidence: Referenced through the sandboxed Bzzoiro football provider path. That provider path was previously classified as manual/provider-evaluation use, not active runtime use.
- backend/services/bzzoiroCrosswalk.js
  Evidence: Supports Bzzoiro/API-Sports crosswalk and verification-lane logic; no active runtime caller was proven in B09.
- backend/services/freeLivescoreApiExtractor.js
  Evidence: Referenced by test/discovery tooling for Free Livescore payload extraction; no active runtime caller was proven.
- backend/services/soccerDataApiClient.js
  Evidence: Referenced by SoccerData provider/evaluation tooling; no active runtime caller was proven for the SoccerData provider path.
- backend/services/sportsApiProFootballExtractor.js
  Evidence: Supports SportsAPI Pro football provider/evaluation tooling; no active runtime caller was proven.
- backend/services/sportsApiProFootballService.js
  Evidence: Supports SportsAPI Pro football provider/evaluation tooling; no active runtime caller was proven.

B09 NO_CURRENT_USE_FOUND assets:
- backend/services/accaMathUtils.js
- backend/services/aiProvider_odds_update.js
- backend/services/comboEngine.js
- backend/services/football536Extractor.js
- backend/services/football536Service.js
- backend/services/footballRiskTierMapper.js
- backend/services/liveFootballApiExtractor.js
- backend/services/liveFootballApiService.js
- backend/services/metrxFactoryExtractor.js
- backend/services/oddsApiPipeline.js
- backend/services/rateLimitsAnalysis.js
- backend/services/reEvaluationEngine.js
- backend/services/sportsLiveScoresExtractor.js
- backend/services/sportsLiveScoresService.js
- backend/services/unifiedFixturesService.js
- backend/services/unifiedPredictionsService.js
- backend/services/unifiedRulesService.js

Evidence for NO_CURRENT_USE_FOUND group:
Repository search and runtime-map inspection did not prove current backend route, server startup, service-to-service, package script, or active manual-tool consumers for these files during B09 inspection.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B09 batch state not advanced in this patch.
## PHASE 3 — B10 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 — Active Use Identification
- Batch: B10 / SCRIPTS_AUDIT_GOV
- Question: Is each B10 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO

Outcome summary:
- ACTIVE: 0
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 27
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B10 MANUAL_USE assets:
- scripts/apply-db-governance.js
- scripts/apply-migrations.js
- scripts/audit-api-call-map.js
- scripts/audit-api-sports-usage.js
- scripts/audit-bigballs-discovery.js
- scripts/audit-bsd-discovery.js
- scripts/audit-bsd-league-inventory.js
- scripts/audit-cricket-final-tables.js
- scripts/audit-cricket-rules.js
- scripts/audit-cricket-storage.js
- scripts/audit-cricket-tables.js
- scripts/audit-database.js
- scripts/audit-execution-spine.js
- scripts/audit-football-rules-alignment.js
- scripts/audit-grading-pipeline.js
- scripts/audit-placeholders-and-insights.js
- scripts/audit-soccerdata-discovery.js
- scripts/audit-soccerdata-summer-coverage.js
- scripts/audit-sport-values.js
- scripts/audit-sportsdataio-boundary.ps1
- scripts/audit-table-usage.js
- scripts/audit-v2-foundation.js
- scripts/audit-v2-identity-deep.js
- scripts/audit-v2-provider-coverage.js
- scripts/gatekeeper-pipeline.js
- scripts/master-qa.js
- scripts/secondary-market-gatekeeper.js

Evidence:
- B10 is defined as the SCRIPTS_AUDIT_GOV batch.
- B10 manifest rule selects scripts/audit-* plus exact governance script names: apply-db-governance.js, apply-migrations.js, master-qa.js, gatekeeper-pipeline.js, and secondary-market-gatekeeper.js.
- package.json exposes several B10 scripts as npm operator commands: accuracy:audit, audit:api, audit:execution-spine, audit:bsd-discovery, audit:bsd-league-inventory, audit:bigballs-discovery, audit:soccerdata-discovery, and audit:soccerdata-summer.
- The exact governance scripts are manual/operator tools: database governance application, migration application, master QA, and gatekeeper/secondary-market governance.
- No B10 file is classified as active runtime/product code in this phase.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B10 batch state not advanced in this patch.
## PHASE 3 — B11 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 — Active Use Identification
- Batch: B11 / SCRIPTS_CHECK_VALIDATE_VERIFY
- Question: Is each B11 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO

Outcome summary:
- ACTIVE: 0
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 59
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B11 MANUAL_USE assets:
- scripts/_check-db.js
- scripts/_check-final-table.js
- scripts/_check-match-dates.js
- scripts/_check-plan-visibility.js
- scripts/_check-team-locks.js
- scripts/_check-tier.js
- scripts/check-acca-data.js
- scripts/check-accuracy-schema.js
- scripts/check-accuracy-time.js
- scripts/check-all-fixtures.js
- scripts/check-cache-schema.js
- scripts/check-cache.js
- scripts/check-canonical-events-schema.js
- scripts/check-cricket-rows.js
- scripts/check-db-schema.js
- scripts/check-events-schema.js
- scripts/check-events-status.js
- scripts/check-events.js
- scripts/check-filtered-schema.js
- scripts/check-final-table-columns.js
- scripts/check-final-table-schema.js
- scripts/check-fixtures-structure.js
- scripts/check-french-league.js
- scripts/check-graded.js
- scripts/check-match-details.js
- scripts/check-match-id-mapping.js
- scripts/check-match-prediction.js
- scripts/check-old-events.js
- scripts/check-predictions.js
- scripts/check-publication-state.js
- scripts/check-raw-json.js
- scripts/check-raw-prediction-structure.js
- scripts/check-scheduler-schema.js
- scripts/check-schema.js
- scripts/check-stages-schema.js
- scripts/check-supabase-vs-pg-tiers.js
- scripts/check-tables.js
- scripts/check-timestamp-cols.js
- scripts/migration1-plan-visibility.js
- scripts/schema-introspection.js
- scripts/setup-rls.js
- scripts/task1-schema-update.js
- scripts/validate-backfill-accuracy.js
- scripts/validate-keys.js
- scripts/validate-relational-migration.js
- scripts/verify_dom_structure.js
- scripts/verify-acca-legs.js
- scripts/verify-accas.js
- scripts/verify-bigballs-provider.js
- scripts/verify-bsd-crosswalk.js
- scripts/verify-bsd-enrichment.js
- scripts/verify-bsd-provider.js
- scripts/verify-db-rule-alignment.js
- scripts/verify-end-to-end-loop.js
- scripts/verify-master-rulebook-alignment.js
- scripts/verify-new-predictions.js
- scripts/verify-soccerdata-provider.js
- scripts/verify-sportsdb-coverage.js
- scripts/verify-vercel-build.js

Evidence:
- B11 is defined as the SCRIPTS_CHECK_VALIDATE_VERIFY batch.
- B11 manifest rule selects scripts/check-*, scripts/_check-*, scripts/validate-*, scripts/verify-*, plus exact operator scripts: setup-rls.js, schema-introspection.js, task1-schema-update.js, migration1-plan-visibility.js, and verify_dom_structure.js.
- package.json exposes several B11 verification scripts as npm operator commands: verify:vercel, verify:bsd, verify:bsd-provider, verify:bsd-crosswalk, verify:bigballs-provider, verify:soccerdata-provider, db:verify:rules, and verify:rulebook.
- setup-rls.js and schema-introspection.js are database operator tools, not runtime product modules.
- No B11 file is classified as active runtime/product code in this phase.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B11 batch state not advanced in this patch.
## PHASE 3 — B12 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 — Active Use Identification
- Batch: B12 / SCRIPTS_TEST_DIAG_TRACE
- Question: Is each B12 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO

Outcome summary:
- ACTIVE: 0
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 66
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B12 MANUAL_USE assets:
- scripts/browser_console_test.js
- scripts/debug-cricket-ai-predictions.js
- scripts/debug-cricket-insights-schema.js
- scripts/debug-cricket-simple.js
- scripts/debug-key.js
- scripts/debug-matches-content.js
- scripts/debug-matches-json.js
- scripts/diagnose-filtering.js
- scripts/diagnostic-espn-fixed.js
- scripts/diagnostic-espn.js
- scripts/diagnostic-thesportsdb.js
- scripts/examine-prediction-76412.js
- scripts/examine-tier-rules.js
- scripts/simulate-filtering.js
- scripts/smoke-test.js
- scripts/test_full_fallback_flow.js
- scripts/test-ai-predictions-542703.js
- scripts/test-ai-predictions-endpoint.js
- scripts/test-all-rapid-hosts.js
- scripts/test-antigravity.js
- scripts/test-api.js
- scripts/test-api2.js
- scripts/test-cache.js
- scripts/test-corrected-endpoint.js
- scripts/test-cricbuzz.js
- scripts/test-cricket-live-line-advance-provider.js
- scripts/test-cricket-live-line-provider.js
- scripts/test-cron.js
- scripts/test-divanscore-rankings-fallback.js
- scripts/test-fetch.js
- scripts/test-final-endpoint.js
- scripts/test-fixed-ai-predictions.js
- scripts/test-fixed-endpoint.js
- scripts/test-fixed-pipeline.js
- scripts/test-football-h2h-pipeline-integration.js
- scripts/test-football-highlights-h2h.js
- scripts/test-football-risk-tier-mapper.js
- scripts/test-football536-endpoints.js
- scripts/test-football536-fixtures-normalizer.js
- scripts/test-free-livescore-fixtures.js
- scripts/test-free-livescore-search.js
- scripts/test-live-football-api-priority.js
- scripts/test-livescore6-cricket-provider.js
- scripts/test-logger.js
- scripts/test-metrx-factory-top-metrics.js
- scripts/test-metrx-top-metrics.js
- scripts/test-network.js
- scripts/test-odds-integration.js
- scripts/test-optimized-endpoints.js
- scripts/test-pipeline-integration.js
- scripts/test-pro-football-api.js
- scripts/test-rank-calibration.js
- scripts/test-rank-injection.js
- scripts/test-sports-live-rankings.js
- scripts/test-sportsapi-pro-football-adapter.js
- scripts/test-sportsapi-pro-football-joinability.js
- scripts/test-sportsapi-pro-football.js
- scripts/test-sportsrc-fixtures.js
- scripts/test-sportsrc-health.js
- scripts/test-sportsrc-odds.js
- scripts/test-telemetry-integration.js
- scripts/test-thesportsdb-endpoints.js
- scripts/test-weather-pipeline.js
- scripts/trace-data-flow.js
- scripts/trace-filtering-rules.js
- scripts/trace-filtering-timestamp.js

Evidence:
- B12 is defined as the SCRIPTS_TEST_DIAG_TRACE batch with 66 governed assets.
- B12 manifest rule selects scripts whose basename starts with test-, debug-, diagnose-, diagnostic-, examine-, or trace-, plus exact files: simulate-filtering.js, browser_console_test.js, smoke-test.js, and test_full_fallback_flow.js.
- Tracked-reference scan found package.json command exposure for scripts/smoke-test.js through npm test / test:smoke and scripts/test-antigravity.js through antigravity:test.
- AGENTS.md documents smoke/API testing as operator workflows, including scripts/smoke-test.js and scripts/test-api.js.
- Other B12 references found by tracked scan are governance/report/dependency-map references, not runtime/product imports.
- No B12 file is classified as active runtime/product code in this phase.
- B12 files are test, debug, diagnostic, examination, simulation, smoke, or trace operator assets; current-use outcome is MANUAL_USE.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B12 batch state not advanced in this patch.

## PHASE 3 - B13 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 - Active Use Identification
- Batch: B13 / SCRIPTS_RUN_TRIGGER_SCHED
- Question: Is each B13 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO

Outcome summary:
- ACTIVE: 1
- INDIRECTLY_ACTIVE: 4
- MANUAL_USE: 15
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B13 ACTIVE assets:
- scripts/run-master-pipeline.js

B13 INDIRECTLY_ACTIVE assets:
- scripts/run-edgemind-judge.js
- scripts/run-stage1-math.js
- scripts/run-stage2-context.js
- scripts/run-stage3-volatility.js

B13 MANUAL_USE assets:
- scripts/_trigger-sync.js
- scripts/external-scheduler.js
- scripts/run-migration.js
- scripts/run-pipeline-from-context-pack.js
- scripts/run-pipeline.js
- scripts/run-scheduled-sync.js
- scripts/run-test.js
- scripts/scheduler.js
- scripts/start-rapidapi-cricket-mcp.js
- scripts/trigger-grade.js
- scripts/trigger-pipeline-sync.js
- scripts/trigger-publication.js
- scripts/trigger-refresh.js
- scripts/trigger-settlement.js
- scripts/wake-and-sync.js

Evidence:
- B13 is defined as the SCRIPTS_RUN_TRIGGER_SCHED batch with 20 governed assets.
- B13 manifest rule selects scripts whose basename starts with run- or trigger-, plus exact files: _trigger-sync.js, scheduler.js, external-scheduler.js, wake-and-sync.js, and start-rapidapi-cricket-mcp.js.
- Tracked-reference scan found backend/server-express.js references scripts/run-master-pipeline.js; therefore run-master-pipeline.js is currently active through backend runtime.
- scripts/run-master-pipeline.js invokes scripts/run-stage1-math.js, scripts/run-stage2-context.js, scripts/run-stage3-volatility.js, and scripts/run-edgemind-judge.js; therefore those four scripts are indirectly active through the active pipeline orchestrator.
- package.json exposes scripts/run-migration.js, scripts/run-pipeline-from-context-pack.js, scripts/trigger-grade.js, scripts/trigger-refresh.js, and scripts/trigger-settlement.js as npm operator commands.
- SKCS-KNOWLEDGE scheduled jobs documentation references scripts/external-scheduler.js and scripts/scheduler.js, but no active runtime/process-manager caller was proven in this phase.
- Remaining B13 references found by tracked scan are governance, report, dependency-map, archived-comparison, or operator documentation references.
- No deletion, merge, retirement, dependency/security, or source/runtime/product change is authorized by this evidence.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B13 batch state not advanced in this patch.

## PHASE 3 - B14 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 - Active Use Identification
- Batch: B14 / SCRIPTS_INGEST_ENRICH_SYNC_IMPORT
- Question: Is each B14 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO

Outcome summary:
- ACTIVE: 2
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 29
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B14 ACTIVE assets:
- scripts/fetch-live-fixtures.js
- scripts/populate_sports_data.py

B14 MANUAL_USE assets:
- scripts/backfill-direct1x2-final-fields.js
- scripts/backfill-fixture-ids.js
- scripts/backfill-football-context.js
- scripts/backfill-prediction-grading.js
- scripts/backfill-predictions-accuracy.js
- scripts/backfill-provider-event-id.js
- scripts/bridge-raw-predictions-for-grading.js
- scripts/bridge-to-final.sql
- scripts/brute-force-ingest.js
- scripts/compose-context-pack.js
- scripts/cricapi-cache-refresh.js
- scripts/discover-free-livescore-endpoints.js
- scripts/enrich-lineups.js
- scripts/enrich-team-form.js
- scripts/fetch-thesportsdb-day.js
- scripts/force-enrich-match.js
- scripts/import-f1-formula1db.js
- scripts/import-today-snapshot-pipeline.js
- scripts/investigate-football536-current-fixtures.js
- scripts/normalize-frontend-sports.js
- scripts/normalize-sport-values.js
- scripts/publish-cricbuzz-cricket.js
- scripts/publish-cricbuzz-direct-fixtures.js
- scripts/publish-prediction-76412.js
- scripts/py_verify_thesportsdb_coverage.py
- scripts/rebuild-canonical-from-api-sports.js
- scripts/simple-sync.js
- scripts/sync-bsd-enrichment.js
- scripts/sync-ucl-context.js

Evidence:
- B14 is defined as the SCRIPTS_INGEST_ENRICH_SYNC_IMPORT batch with 31 governed assets.
- B14 manifest rule selects scripts whose basename starts with backfill-, bridge-, brute-force, compose-, cricapi-, discover-, enrich-, fetch-, force-enrich-, import-, investigate-, normalize-, publish-, rebuild-, simple-sync, sync-, plus selected exact provider/verification assets.
- Tracked-reference scan found backend/server-express.js references scripts/fetch-live-fixtures.js for full pipeline sync; therefore scripts/fetch-live-fixtures.js is currently active through backend runtime.
- Tracked-reference scan found render.yaml startCommand uses python scripts/populate_sports_data.py; therefore scripts/populate_sports_data.py is currently active through deployment/process configuration.
- package.json exposes operator commands for scripts/backfill-football-context.js, scripts/backfill-prediction-grading.js, scripts/bridge-raw-predictions-for-grading.js, scripts/compose-context-pack.js, scripts/cricapi-cache-refresh.js, scripts/enrich-lineups.js, scripts/enrich-team-form.js, scripts/fetch-thesportsdb-day.js, scripts/sync-bsd-enrichment.js, and scripts/sync-ucl-context.js.
- scripts/backfill-prediction-grading.js invokes scripts/bridge-raw-predictions-for-grading.js, but the parent script is package/operator-driven rather than proven active runtime in this phase.
- Remaining B14 references found by tracked scan are governance, report, dependency-map, audit, documentation, archived-comparison, or operator references.
- No deletion, merge, retirement, dependency/security, or source/runtime/product change is authorized by this evidence.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B14 batch state not advanced in this patch.

## PHASE 3 - B15 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 - Active Use Identification
- Batch: B15 / SCRIPTS_MAINT_FIX_CLEANUP_MIGRATE
- Question: Is each B15 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO
- Dependency/security/vulnerability notice work performed: NO

Outcome summary:
- ACTIVE: 1
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 51
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B15 ACTIVE assets:
- scripts/requirements.txt

B15 MANUAL_USE assets:
- scripts/_bsd_league_inventory.json
- scripts/_local-rebuild.js
- scripts/add-cricket-rls-policies.sql
- scripts/add-event-columns.js
- scripts/analyze-postgres-tables.js
- scripts/analyze-supabase-tables-full.js
- scripts/analyze-supabase-tables.js
- scripts/analyze-supabase-visual.js
- scripts/build-acca.js
- scripts/build-sportsdb-config.js
- scripts/cleanup-competition-allowlists.js
- scripts/cleanup-duplicate-fallbacks.js
- scripts/cleanup-live-direct-duplicates.js
- scripts/cleanup-predictions.js
- scripts/cleanup-unknown-teams.js
- scripts/cleanup.js
- scripts/complete-phase1-testing.js
- scripts/complete-phase2-rules.js
- scripts/complete-phase3-predictions.js
- scripts/create-indexes.js
- scripts/create-migration-plan.js
- scripts/db-cleanup.js
- scripts/deployment_verification.js
- scripts/deployment-status.md
- scripts/fix-ai-predictions-endpoint.js
- scripts/fix-frontend-placeholders.js
- scripts/fix-json-simple.js
- scripts/fix-matches-structure.js
- scripts/fix-placeholders-and-insights.js
- scripts/fix-prediction-76412.js
- scripts/fix-remaining-json-issues.js
- scripts/fix-sport-data.js
- scripts/gulf_in_class_simulation.js
- scripts/hotfix-acca-rules.js
- scripts/implement-phase1-fixtures-corrected.js
- scripts/implement-phase1-fixtures.js
- scripts/implement-phase2-rules-conservative.js
- scripts/implement-phase2-rules.js
- scripts/implement-phase3-predictions.js
- scripts/install-local-git-hooks.js
- scripts/manual-grade.js
- scripts/map-table-dependencies.js
- scripts/purge-fallback-data.js
- scripts/quarantine-database.js
- scripts/render-api-deploy.js
- scripts/repair-unknown-team-names.js
- scripts/resolve-results.js
- scripts/safe-migration-plan.js
- scripts/supabase_health_check.js
- scripts/supabase-diagnostics.js
- scripts/track-prediction-accuracy.js

Evidence:
- B15 is defined as the SCRIPTS_MAINT_FIX_CLEANUP_MIGRATE batch with 52 governed assets.
- B15 manifest rule selects maintenance/fix/migration script basenames beginning with cleanup-, purge-, quarantine-, repair-, fix-, hotfix-, implement-, complete-phase, and add-, plus selected exact maintenance assets.
- Tracked deployment configuration in render.yaml uses scripts/requirements.txt through `pip install -r scripts/requirements.txt`; therefore scripts/requirements.txt is currently active through deployment/build configuration.
- package.json exposes scripts/build-sportsdb-config.js, scripts/track-prediction-accuracy.js, and scripts/install-local-git-hooks.js as npm operator commands.
- scripts/track-prediction-accuracy.js is an executable grading/accuracy utility with `require.main === module` entrypoint and exported functions, but no active runtime caller was proven in this phase.
- scripts/build-sportsdb-config.js is an executable configuration-generation utility that writes generated sports configuration output, but no active runtime caller was proven in this phase.
- scripts/install-local-git-hooks.js is explicitly local-machine setup tooling and says it is run once per clone through npm run install:hooks.
- Remaining B15 references found by tracked scan are governance, report, dependency-map, archived-comparison, or operator/maintenance references.
- No deletion, merge, retirement, dependency/security, vulnerability, source/runtime/product change is authorized by this evidence.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B15 batch state not advanced in this patch.
- GitHub vulnerability notice remains future dependency/security work and was not touched.

## PHASE 3 - B16 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 - Active Use Identification
- Batch: B16 / DOCS_ROOT_MD_TXT
- Question: Is each B16 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO
- Dependency/security/vulnerability notice work performed: NO

Outcome summary:
- ACTIVE: 0
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 36
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B16 MANUAL_USE assets:
- AGENTS.md
- ARCHITECTURE_OVERVIEW.md
- COMPREHENSIVE_AUDIT_REPORT.md
- COMPREHENSIVE_FOOTBALL_RULES_REPORT.md
- CRON_SETUP.md
- DASHBOARD_QUICK_START.md
- DASHBOARD_REFACTOR_GUIDE.md
- DEEPSEEK_SESSION_SKCSTEST.txt
- DEEPSEEK_STATE.md
- DEPLOYMENT_STATUS.md
- DEPLOYMENT_VERIFICATION_GUIDE.md
- football-ecosystem-report.md
- FRONTEND_FIXES_SUMMARY.md
- FRONTEND_INVESTIGATION_REPORT.md
- FULL_WORKSPACE_AUDIT_REPORT.md
- GEMINI.md
- IMPLEMENTATION_GAP_ANALYSIS.md
- IMPLEMENTATION_SUMMARY.md
- MASTER_RULEBOOK_IMPLEMENTATION_GUIDE.md
- MIGRATION_FREEZE.md
- PRIVACY_POLICY.md
- README_DASHBOARD_REFACTOR.md
- README_DATA_INGESTION.md
- README.md
- requirements.txt
- runtime.txt
- SINGLE_USE_AUDIT_REPORT.md
- SKCS_MASTER_RULEBOOK.md
- SMB_WINDSURF_FINAL_IMPLEMENTATION.md
- SMB_WINDSURF_IMPLEMENTATION_PROMPT.md
- SPORT_CONSISTENCY_AUDIT_REPORT.md
- STRICT_RULES.md
- SUPABASE_DIAGNOSTIC_REPORT.md
- SUPABASE_TABLE_ANALYSIS.md
- SUPABASE_TABLES_SUMMARY.md
- TERMS_OF_SERVICE.md

Evidence:
- B16 is defined as the DOCS_ROOT_MD_TXT batch with 36 governed root documentation/text assets.
- B16 manifest rule selects root files with .md and .txt extensions, and the governed B16 asset list also includes root requirements.txt and runtime.txt.
- package.json starts the application through backend/server-express.js and exposes build/test/control/script commands, not B16 root documentation files.
- render.yaml starts the web service with node backend/server-express.js.
- render.yaml uses scripts/requirements.txt for the sports-fixture-population Python cron, not root requirements.txt.
- Root requirements.txt and runtime.txt exist as repository-level Python environment documents, but no active deployment, runtime, package-script, or process-manager caller was proven for them in this phase.
- PRIVACY_POLICY.md and TERMS_OF_SERVICE.md are root policy documents; public delivery uses separate public HTML surfaces, so the root markdown documents are manual/reference assets in this phase.
- AGENTS.md, GEMINI.md, DEEPSEEK_STATE.md, DEEPSEEK_SESSION_SKCSTEST.txt, SMB_WINDSURF_FINAL_IMPLEMENTATION.md, and SMB_WINDSURF_IMPLEMENTATION_PROMPT.md are operator/AI-assistant guidance or session/reference documents, not proven runtime assets.
- Remaining B16 references found by tracked scan are governance, report, documentation, audit, repository-index, or operator references.
- No deletion, merge, retirement, dependency/security, vulnerability, source/runtime/product change is authorized by this evidence.

Validation boundary:
- Evidence text and UTF-8 preservation repair only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B16 batch state not advanced in this patch.
- GitHub vulnerability notice remains future dependency/security work and was not touched.

## PHASE 3 - B17 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 - Active Use Identification
- Batch: B17 / DOCS_DIR
- Question: Is each B17 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO
- Dependency/security/vulnerability notice work performed: NO

Outcome summary:
- ACTIVE: 0
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 24
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B17 MANUAL_USE assets:
- docs/acca_rules_v2.1.md
- docs/alert-routing-degraded-state.md
- docs/api_quota_router.md
- docs/blueprint-semantic-drift-control-plane.md
- docs/canonical_ingest_firewall.spec.md
- docs/control-plane-operational-pack.md
- docs/cricket-providers.md
- docs/DATA_INGESTION.md
- docs/DEPLOYMENT_GUIDE.md
- docs/football-leagues-apisports.md
- docs/pipeline-health-feed.md
- docs/provider-discovery/free-livescore-api.md
- docs/providers/live-football-api-policy.md
- docs/README.md
- docs/runbook_degraded_states.md
- docs/SKCS_ENGINE_V2_ADR.md
- docs/SKCS_ENGINE_V2_PHASE0_DESIGN.md
- docs/SKCS_ENGINE_V2_PHASE05_INGEST_MAP.md
- docs/SKCS_ENGINE_V2_PHASE0B5_REPLAY.md
- docs/skcs_grading_snapshot_v1.spec.md
- docs/sportsdataio-pre-match-directive.md
- docs/supabase-tier-display-requirements.md
- docs/VERCEL_DEPLOY_TROUBLESHOOTING.md
- docs/weekly-global-scrape-scheduler.md

Evidence:
- B17 is defined as the DOCS_DIR batch with 24 governed assets under docs/.
- package.json starts the application through backend/server-express.js and exposes build, test, control, audit, sync, trigger, verification, and script commands outside docs/.
- render.yaml starts the web service through backend/server-express.js and cron services through backend/scripts paths, not docs/.
- Repository search found docs/ references as documentation, specification, governance, runtime-map, audit, or reference links rather than active runtime process targets.
- No B17 asset is a deployment entrypoint, package-script target, server import target, cron command, build command, or active runtime dependency proven in this phase.
- No deletion, merge, retirement, dependency/security, vulnerability, source/runtime/product change is authorized by this evidence.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B17 batch state not advanced in this patch.
- GitHub vulnerability notice remains future dependency/security work and was not touched.

## PHASE 3 - B18 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 - Active Use Identification
- Batch: B18 / SKCS_KNOWLEDGE_GOV_AND_AUDIT
- Question: Is each B18 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO
- Dependency/security/vulnerability notice work performed: NO

Outcome summary:
- ACTIVE: 0
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 23
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B18 MANUAL_USE assets:
- SKCS-KNOWLEDGE/audit/column_dependency_matrix.md
- SKCS-KNOWLEDGE/audit/cron_provider_runtime_map.md
- SKCS-KNOWLEDGE/audit/gap_report.md
- SKCS-KNOWLEDGE/audit/knowledge_layer_completeness_audit.md
- SKCS-KNOWLEDGE/audit/migration_history.md
- SKCS-KNOWLEDGE/audit/observability_registry.md
- SKCS-KNOWLEDGE/audit/prediction_dependency_audit.md
- SKCS-KNOWLEDGE/audit/runtime_consumer_audit_v2.md
- SKCS-KNOWLEDGE/audit/runtime_consumer_audit.md
- SKCS-KNOWLEDGE/audit/schema_drift_log.md
- SKCS-KNOWLEDGE/audit/technical_debt.md
- SKCS-KNOWLEDGE/audit/undocumented_assets.md
- SKCS-KNOWLEDGE/audit/verification_runtime_audit.md
- SKCS-KNOWLEDGE/governance/ai_usage_policy.md
- SKCS-KNOWLEDGE/governance/bigballs_evaluation_focus.md
- SKCS-KNOWLEDGE/governance/bsd_governance_hold.md
- SKCS-KNOWLEDGE/governance/bsd_provider_suitability_scorecard.md
- SKCS-KNOWLEDGE/governance/documentation_policy.md
- SKCS-KNOWLEDGE/governance/feature_risk_registry.md
- SKCS-KNOWLEDGE/governance/naming_standards.md
- SKCS-KNOWLEDGE/governance/edge_asset_work_sequence_policy.md
- SKCS-KNOWLEDGE/governance/provider_scorecard_bsd.md
- SKCS-KNOWLEDGE/governance/verification_layer_spec.md

Evidence:
- B18 is defined as the SKCS_KNOWLEDGE_GOV_AND_AUDIT batch with 23 governed assets under SKCS-KNOWLEDGE/audit/ and SKCS-KNOWLEDGE/governance/.
- The B18 assets are audit, governance, policy, scorecard, registry, drift, runtime-audit, and documentation-control markdown records.
- package.json starts the application through backend/server-express.js and exposes build, test, control, audit, sync, trigger, verification, and script commands outside the B18 knowledge paths.
- render.yaml starts the web service through backend/server-express.js and cron services through backend/scripts or scripts paths, not B18 knowledge paths.
- Repository search found B18 references as documentation, governance, runtime-map, inventory, audit, or repository-index references rather than active runtime process targets.
- No B18 asset is a deployment entrypoint, package-script target, server import target, cron command, build command, or active runtime dependency proven in this phase.
- No deletion, merge, retirement, dependency/security, vulnerability, source/runtime/product change is authorized by this evidence.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B18 batch state not advanced in this patch.
- GitHub vulnerability notice remains future dependency/security work and was not touched.

## PHASE 3 - B19 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 - Active Use Identification
- Batch: B19 / SKCS_KNOWLEDGE_KNOWLEDGE
- Question: Is each B19 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO
- Dependency/security/vulnerability notice work performed: NO

Outcome summary:
- ACTIVE: 0
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 17
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B19 MANUAL_USE assets:
- SKCS-KNOWLEDGE/knowledge/api_registry.md
- SKCS-KNOWLEDGE/knowledge/architecture_decisions.md
- SKCS-KNOWLEDGE/knowledge/business_rules.md
- SKCS-KNOWLEDGE/knowledge/cost_registry.md
- SKCS-KNOWLEDGE/knowledge/database_schema.md
- SKCS-KNOWLEDGE/knowledge/dependency_registry.md
- SKCS-KNOWLEDGE/knowledge/edge_functions.md
- SKCS-KNOWLEDGE/knowledge/formula_registry.md
- SKCS-KNOWLEDGE/knowledge/glossary.md
- SKCS-KNOWLEDGE/knowledge/pipeline_metrics_registry.md
- SKCS-KNOWLEDGE/knowledge/provider_registry.md
- SKCS-KNOWLEDGE/knowledge/scheduled_jobs.md
- SKCS-KNOWLEDGE/knowledge/semantic_field_mapping_registry.md
- SKCS-KNOWLEDGE/knowledge/semantic_violation_log.md
- SKCS-KNOWLEDGE/knowledge/system_topology.md
- SKCS-KNOWLEDGE/knowledge/views_and_materialized_views.md
- SKCS-KNOWLEDGE/README.md

Evidence:
- B19 is defined as the SKCS_KNOWLEDGE_KNOWLEDGE batch with 17 governed assets under SKCS-KNOWLEDGE/knowledge/ plus SKCS-KNOWLEDGE/README.md.
- The B19 assets are knowledge-layer registry, glossary, architecture, dependency, provider, schema, topology, scheduled-job, formula, semantic-mapping, semantic-violation, and README documentation records.
- package.json has no SKCS-KNOWLEDGE or knowledge-path entrypoint reference for B19.
- render.yaml has no SKCS-KNOWLEDGE or knowledge-path service, cron, or deployment command reference for B19.
- Repository search found B19 references mainly in Control Center governance files, the repository asset map/register, execution-spine reports, audit documents, provider directive documentation, and knowledge completeness references.
- No B19 asset is a deployment entrypoint, package-script target, server import target, cron command, build command, or active runtime dependency proven in this phase.
- No deletion, merge, retirement, dependency/security, vulnerability, source/runtime/product change is authorized by this evidence.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B19 batch state not advanced in this patch.
- GitHub Dependabot branch notice remains future dependency/security work and was not touched.

## PHASE 3 - B20 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 - Active Use Identification
- Batch: B20 / SKCS_KNOWLEDGE_PROVIDERS
- Question: Is each B20 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO
- Dependency/security/vulnerability notice work performed: NO

Outcome summary:
- ACTIVE: 0
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 18
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B20 MANUAL_USE assets:
- SKCS-KNOWLEDGE/providers/bigballs_discovery_audit.md
- SKCS-KNOWLEDGE/providers/bigballs_endpoint_catalog.md
- SKCS-KNOWLEDGE/providers/bigballs_primary_assessment.md
- SKCS-KNOWLEDGE/providers/bigballs_provider_health.md
- SKCS-KNOWLEDGE/providers/bigballs_semantic_mapping.md
- SKCS-KNOWLEDGE/providers/bsd_coverage_audit.md
- SKCS-KNOWLEDGE/providers/bsd_endpoint_catalog.md
- SKCS-KNOWLEDGE/providers/bsd_league_inventory.md
- SKCS-KNOWLEDGE/providers/bsd_provider_health.md
- SKCS-KNOWLEDGE/providers/bsd_readiness_assessment.md
- SKCS-KNOWLEDGE/providers/bsd_semantic_mapping.md
- SKCS-KNOWLEDGE/providers/bzzoiro_discovery_audit.md
- SKCS-KNOWLEDGE/providers/bzzoiro_field_audit.md
- SKCS-KNOWLEDGE/providers/bzzoiro_provider_mapping.md
- SKCS-KNOWLEDGE/providers/soccerdata_call_restrictions.md
- SKCS-KNOWLEDGE/providers/soccerdata_endpoint_catalog.md
- SKCS-KNOWLEDGE/providers/soccerdata_notebooklm_synthesis.md
- SKCS-KNOWLEDGE/providers/soccerdata_provider_health.md

Evidence:
- B20 is defined as the SKCS_KNOWLEDGE_PROVIDERS batch with 18 governed provider knowledge assets under SKCS-KNOWLEDGE/providers/.
- The B20 assets are provider discovery, endpoint catalog, provider-health, readiness, coverage, league-inventory, field-audit, semantic-mapping, call-restriction, and synthesis documentation records.
- package.json has no application start, deployment start, build, cron, or production runtime command using the B20 markdown assets as runtime inputs.
- render.yaml has no SKCS-KNOWLEDGE/providers service, cron, or deployment command reference for B20.
- Repository search found B20 references mainly in Control Center governance files, the repository asset map/register, previous duplicate-hash evidence, and provider documentation references.
- SKCS-KNOWLEDGE/providers/bsd_league_inventory.md has a manual audit/update relationship with scripts/audit-bsd-league-inventory.js.
- package.json exposes scripts/audit-bsd-league-inventory.js through the manual command audit:bsd-league-inventory.
- scripts/audit-bsd-league-inventory.js describes itself as read-only and states that it does not touch prediction pipelines.
- No B20 asset is a deployment entrypoint, server import target, cron command, build command, or active runtime dependency proven in this phase.
- No deletion, merge, retirement, dependency/security, vulnerability, source/runtime/product change is authorized by this evidence.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B20 batch state not advanced in this patch.
- GitHub vulnerability and Dependabot notices remain future dependency/security work and were not touched.

## PHASE 3 - B21 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 - Active Use Identification
- Batch: B21 / PUBLIC_UI
- Question: Is each B21 governed file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO
- UI repair performed: NO
- Dependency/security/vulnerability notice work performed: NO

Outcome summary:
- ACTIVE: 64
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 0
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B21 ACTIVE assets:
- public/about-bg.jpg
- public/about-bg.webp
- public/accuracy.html
- public/admin-sync.html
- public/components/HeroCarousel.jsx
- public/components/TrendDashboard.jsx
- public/control-center.html
- public/css/control-center.css
- public/css/hero-carousel.css
- public/css/input.css
- public/css/output.css
- public/css/react-components.css
- public/data/all_leagues_raw.json
- public/data/all_sports_raw.json
- public/data/context-pack-2026-05-17.json
- public/data/event-details-cache.json
- public/data/h2h-2026-05-17.json
- public/data/importance-2026-05-17.json
- public/data/injuries-2026-05-17.json
- public/data/news-injury-cache.json
- public/data/pipeline-dry-2026-05-17.json
- public/data/standings-cache.json
- public/data/team-form-2026-05-17.json
- public/data/team-form-cache.json
- public/data/travel-2026-05-17.json
- public/data/tsdb-coverage-2026-05-17.json
- public/data/tsdb-coverage-2026-05-18.json
- public/data/tsdb-coverage-2026-05-19.json
- public/data/tsdb-day-2026-05-17.json
- public/data/vip-stress-saturday.json
- public/direct-markets.html
- public/experience.html
- public/favicon.ico
- public/hero-page.jpg
- public/hero-page.webp
- public/index.html
- public/js/acca-builder.js
- public/js/ai-reasoning-display.js
- public/js/config.js
- public/js/control-center.js
- public/js/doubleChanceCombos.js
- public/js/hero-carousel.js
- public/js/semantic-drift-dashboard.js
- public/js/smh-hub-master-rulebook.js
- public/js/smh-hub.js
- public/js/supabase-bundle.js
- public/js/supabase-init.js
- public/js/system-health-banner.js
- public/js/user-experience-feedback.js
- public/js/vip-stress-dashboard.js
- public/language-switch.html
- public/language.jpg
- public/login.html
- public/login.jpg
- public/market-explorer.html
- public/payment.html
- public/privacy.html
- public/robots.txt
- public/style.css
- public/subscribe/index.html
- public/subscription.html
- public/terms.html
- public/vip-stress-dashboard.html
- public/windrawwin.jpg

Evidence:
- B21 is defined as the PUBLIC_UI batch with 64 governed public UI, static asset, generated public data, frontend script, CSS, image, and route/page files under public/.
- All 64 B21 assets exist in the current working tree.
- backend/server-express.js defines PUBLIC_DIR as the repository public directory and serves it through express.static(PUBLIC_DIR).
- package.json starts the application through node backend/server-express.js.
- render.yaml starts the web service through node backend/server-express.js.
- package.json also builds public/js/supabase-bundle.js and public/css/output.css from tracked frontend sources.
- B21 includes HTML page entrypoints, browser-delivered JavaScript, CSS, images, generated public JSON/data cache files, robots.txt, and subscription/public route files.
- Repository reference inspection found direct UI/runtime/build/governance references across server static delivery, package scripts, render service startup, frontend links/scripts/fetches, Control Center governance files, execution-spine reports, and historical audit records.
- Static public serving proves these files are currently browser-deliverable from the active web service boundary.
- This phase does not determine whether any public route is desirable, current product UX, legacy, duplicated, or safe to retire; those are future phase questions.
- No deletion, merge, retirement, dependency/security, vulnerability, source/runtime/product change is authorized by this evidence.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B21 batch state not advanced in this patch.
- GitHub vulnerability and Dependabot notices remain future dependency/security work and were not touched.

## PHASE 3 - B22 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 - Active Use Identification
- Batch: B22 / SUPABASE_MIGRATIONS
- Question: Is each B22 governed Supabase migration file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Schema change performed: NO
- Migration execution performed: NO
- Supabase mutation performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO
- Dependency/security/vulnerability notice work performed: NO

Outcome summary:
- ACTIVE: 0
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 61
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B22 MANUAL_USE assets:
- supabase/migrations/20260415000001_create_insight_usage.sql
- supabase/migrations/20260418000002_update_predictions_final_risk_level_check.sql
- supabase/migrations/20260501_skcs_comprehensive_engine.sql
- supabase/migrations/20260512000001_create_canonical_bookmakers.sql
- supabase/migrations/20260512000002_add_odds_to_match_context.sql
- supabase/migrations/20260512000003_create_sport_sync_table.sql
- supabase/migrations/20260512000004_create_upsert_raw_fixture_rpc.sql
- supabase/migrations/20260512000005_create_context_enrichment_trigger.sql
- supabase/migrations/20260512000006_create_fixture_processing_log.sql
- supabase/migrations/20260512000007_create_admin_views.sql
- supabase/migrations/20260512000008_create_event_odds_snapshots.sql
- supabase/migrations/20260512000009_create_get_prediction_rpc.sql
- supabase/migrations/20260512000010_populate_sport_sync.sql
- supabase/migrations/20260512000012_create_get_prediction_function.sql
- supabase/migrations/20260512000013_disable_rls_match_context.sql
- supabase/migrations/20260522000001_add_watchlist_column.sql
- supabase/migrations/20260522000002_add_sport_to_tier_rules.sql
- supabase/migrations/20260523000001_drop_insight_usage.sql
- supabase/migrations/20260524000001_remove_dev_rls_policies.sql
- supabase/migrations/20260524000002_create_upsert_canonical_event_rpc.sql
- supabase/migrations/20260531000001_skcs_engine_v2_phase0_identity.sql
- supabase/migrations/20260531000002_skcs_engine_v2_phase0b_match_results.sql
- supabase/migrations/20260617_add_market_tier.sql
- supabase/migrations/20260619000001_rename_predictions_final_to_direct1x2.sql
- supabase/migrations/20260619000002_align_direct1x2_columns.sql
- supabase/migrations/20260619000003_direct1x2_risk_tier_and_secondary_markets.sql
- supabase/migrations/20260621000001_enforce_league_country_on_direct_matches.sql
- supabase/migrations/20260701000001_normalize_sport_names.sql
- supabase/migrations/20260717000001_create_f1_schema.sql
- supabase/migrations/20260718000001_db_rule_alignment_75_55_30.sql
- supabase/migrations/20260820000001_rename_risk_tiers_and_safe_haven.sql
- supabase/migrations/20260820000002_fix_secondary_governance_80_75.sql
- supabase/migrations/20260822000001_add_partitioning.sql
- supabase/migrations/20260822000002_create_relational_odds_tables.sql
- supabase/migrations/20260822000002a_create_relational_tables.sql
- supabase/migrations/20260822000002b_create_relational_indexes.sql
- supabase/migrations/20260822000002c_create_relational_functions_triggers.sql
- supabase/migrations/20260822000002d_create_relational_views.sql
- supabase/migrations/20260822000003_normalize_prediction_tables.sql
- supabase/migrations/20260822000003a_create_prediction_tables.sql
- supabase/migrations/20260822000003b_create_prediction_indexes.sql
- supabase/migrations/20260822000003c_create_prediction_functions_triggers.sql
- supabase/migrations/20260822000003d_create_prediction_views.sql
- supabase/migrations/20260822000004_create_materialized_admin_views.sql
- supabase/migrations/20260822000005_skcs_engine_v2_engine_core.sql
- supabase/migrations/20260822000006_ai_governance_telemetry.sql
- supabase/migrations/20260822000007_ai_governance_rls_policies.sql
- supabase/migrations/20260822000008_service_role_rls_policies.sql
- supabase/migrations/20260822000009_public_read_config_rls_policies.sql
- supabase/migrations/20260822000010_public_read_reference_rls.sql
- supabase/migrations/20260822000011_system_health_state.sql
- supabase/migrations/20260822000012_semantic_violations.sql
- supabase/migrations/20260822000013_semantic_violation_summary.sql
- supabase/migrations/20260822000014_system_health_state_contract.sql
- supabase/migrations/20260902000000_pipeline_health_feed.sql
- supabase/migrations/20261001000000_runtime_truth_mirror.sql
- supabase/migrations/20261005000000_runtime_truth_mirror_alignment.sql
- supabase/migrations/20261005000001_fix_calculate_team_strength_ambiguity.sql
- supabase/migrations/20261006000000_sportsdataio_contract_alignment.sql
- supabase/migrations/20261006000001_canonical_events.sql
- supabase/migrations/20261007000000_user_experience_feedback.sql

Evidence:
- B22 is defined as the SUPABASE_MIGRATIONS batch with 61 governed SQL migration assets under supabase/migrations/.
- The active application start path is package.json start -> node backend/server-express.js.
- Render web deployment starts node backend/server-express.js and does not execute B22 migrations as part of the web start command.
- Render cron commands in render.yaml do not execute B22 migration files.
- scripts/run-migration.js is a manual migration runner that reads SQL files from supabase/migrations by filename; it also has default migration names from B22.
- package.json exposes db:migrate:rules as a manual command for one B22 migration: 20260820000002_fix_secondary_governance_80_75.sql.
- scripts/apply-migrations.js is a manual migration application script that reads supabase/migrations and filters 20260822 migration files.
- SKCS-KNOWLEDGE/knowledge/database_schema.md treats supabase/migrations/ as schema inventory evidence.
- .githooks/pre-commit includes supabase/migrations/* in the local Master Rulebook guard scope.
- B22 migration files are database schema/change-history assets, not server runtime entrypoints, browser assets, active cron entrypoints, or deployed product code entrypoints.
- This phase does not determine whether any migration has already been applied, should be reapplied, is superseded, is safe to retire, or matches the live Supabase database. Those are future database/schema governance questions.
- No deletion, merge, retirement, dependency/security, vulnerability, source/runtime/product change, schema change, migration execution, or Supabase mutation is authorized by this evidence.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B22 batch state not advanced in this patch.
- GitHub vulnerability and Dependabot notices remain future dependency/security work and were not touched.

## PHASE 3 - B23 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS WITH ABSENT-PATH NOTE

Scope:
- Phase: PHASE_3 - Active Use Identification
- Batch: B23 / DB_SQL_AND_SUPABASE_OTHER
- Question: Is each B23 governed SQL / Supabase non-migration asset currently used?
- Deletion/merge/retirement/refactor performed: NO
- Schema execution performed: NO
- Supabase mutation performed: NO
- Function deployment performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO
- Dependency/security/vulnerability notice work performed: NO

Outcome summary:
- ACTIVE: 0
- INDIRECTLY_ACTIVE: 1
- MANUAL_USE: 18
- NO_CURRENT_USE_FOUND: 1
- UNKNOWN: 0

B23 INDIRECTLY_ACTIVE assets:
- supabase/edge-functions/scheduledFixtureSync/index.ts

B23 MANUAL_USE assets:
- sql/acca_rules.sql
- sql/day_zero_subscription.sql
- sql/extreme_smb_data.sql
- sql/fix_rls_policies.sql
- sql/market_correlations_schema.sql
- sql/master_rulebook_triggers.sql
- sql/monitoring_tables.sql
- sql/performance_optimizations.sql
- sql/rapidapi_cache.sql
- sql/schema_refactor.sql
- sql/supabase_test_user_reset_and_seed.sql
- sql/supabase_test_user_seed_access.sql
- sql/tables.sql
- sql/tier_rules.sql
- supabase/edge-functions/scheduled-fixture-sync/index.ts
- supabase/functions/scheduled-prediction-refresh/index.ts
- supabase/functions/semantic-drift-summary/index.ts
- supabase/schema/ai_pipeline_schema.sql

B23 NO_CURRENT_USE_FOUND assets:
- supabase/functions/sync-sports-data/index.ts

Evidence:
- B23 is defined as DB_SQL_AND_SUPABASE_OTHER with 20 governed SQL / Supabase non-migration assets.
- The 14 sql/*.sql files are manual database/schema/admin SQL assets, not active Node runtime imports, browser-delivered assets, Render start commands, or active cron entrypoints.
- sql/tier_rules.sql also has manual audit-tool evidence through scripts/audit-football-rules-alignment.js, which reads sql/tier_rules.sql for drift comparison.
- supabase/edge-functions/scheduledFixtureSync/index.ts is indirectly active because backend/routes/scheduler.js calls ${SUPABASE_URL}/functions/v1/scheduledFixtureSync, and backend/server-express.js mounts schedulerRouter at /api/scheduler.
- supabase/edge-functions/scheduled-fixture-sync/index.ts is manual/external-scheduler related: scripts/run-scheduled-sync.js builds a scheduled-fixture-sync function URL, but no active package start, Render start command, or mounted backend route was found executing that script during app startup.
- supabase/functions/scheduled-prediction-refresh/index.ts is a standalone Supabase function source describing scheduled prediction refresh behavior; no active package start, Render start command, or mounted backend route was found executing it during app startup.
- supabase/functions/semantic-drift-summary/index.ts is a standalone Supabase function source. The active backend semantic drift path is backend/routes/semanticDrift.js -> backend/services/semanticDriftSummaryService.js, mounted by backend/server-express.js at /api/semantic-drift-summary; that active path uses the backend service and database RPC rather than invoking the Supabase function file.
- supabase/functions/sync-sports-data/index.ts is still listed in the B23 manifest but is absent from GitHub main / current tracked source, so no current use can be found for that path in this phase.
- supabase/schema/ai_pipeline_schema.sql is manual schema reference material, not an active runtime entrypoint.
- No deletion, merge, retirement, dependency/security, vulnerability, source/runtime/product change, schema execution, Supabase mutation, or function deployment is authorized by this evidence.
- The absent sync-sports-data manifest/register condition is a future governance cleanup item only; it is not repaired during Phase 3 B23.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B23 batch state not advanced in this patch.
- GitHub vulnerability and Dependabot notices remain future dependency/security work and were not touched.

## PHASE 3 - B24 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 - Active Use Identification
- Batch: B24 / TESTS
- Question: Is each B24 governed test file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Test rewrite performed: NO
- Runtime/product change performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO
- Dependency/security/vulnerability notice work performed: NO

Outcome summary:
- ACTIVE: 0
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 6
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B24 MANUAL_USE assets:
- tests/edge-asset-classification.test.js
- tests/edge-control-center-ledger.test.js
- tests/edge-control-center-ui.test.js
- tests/edge-project-register.test.js
- tests/edge-repository-asset-register.test.js
- tests/edge-system-runtime-inventory.test.js

Evidence:
- B24 is defined as the TESTS batch with 6 governed test files under tests/.
- package.json exposes test:asset-classification for tests/edge-asset-classification.test.js.
- package.json exposes test:control-center for tests/edge-control-center-ledger.test.js, tests/edge-project-register.test.js, and tests/edge-repository-asset-register.test.js.
- package.json exposes test:control-center-ui for tests/edge-control-center-ui.test.js.
- tests/edge-system-runtime-inventory.test.js is a manual Node test file using node:test and importing control-center/check_edge_system_runtime_inventory.js.
- package.json control:verify runs the control-center validation suite, but does not make these test files runtime entrypoints for the deployed product.
- B24 files are validation/test assets, not active server startup files, browser-delivered assets, Render start commands, cron commands, schema execution files, or Supabase mutation files.
- No deletion, merge, retirement, dependency/security, vulnerability, test rewrite, source/runtime/product change, or test-suite restructuring is authorized by this evidence.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B24 batch state not advanced in this patch.
- GitHub vulnerability and Dependabot notices remain future dependency/security work and were not touched.

## PHASE 3 - B25 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 - Active Use Identification
- Batch: B25 / SCRATCH
- Question: Is each B25 governed scratch file currently used?
- Deletion/merge/retirement/refactor performed: NO
- Script execution performed: NO
- Database mutation performed: NO
- Runtime/product change performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO
- Dependency/security/vulnerability notice work performed: NO

Outcome summary:
- ACTIVE: 0
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 2
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B25 MANUAL_USE assets:
- scratch/db_normalize.js
- scratch/db_sync.js

Evidence:
- B25 is defined as the SCRATCH batch with 2 governed scratch files: scratch/db_normalize.js and scratch/db_sync.js.
- scratch/db_normalize.js is a manual database normalization utility. It imports backend/database and performs UPDATE statements against predictions_raw, leagues, and match_context_data.
- scratch/db_sync.js is a manual database inspection utility. It imports backend/database and reads distinct sport values from predictions_raw and leagues.
- package.json active app startup is node backend/server-express.js; B25 scratch files are not active startup entrypoints.
- No package.json npm script was found that runs scratch/db_normalize.js or scratch/db_sync.js.
- B25 files are manual/admin scratch utilities, not deployed product runtime entrypoints, browser-delivered assets, Render start commands, cron commands, schema migration files, or Supabase function deployment files.
- Because scratch/db_normalize.js can mutate database rows, this phase does not execute either B25 file.
- No deletion, merge, retirement, dependency/security, vulnerability, source/runtime/product change, database mutation, or scratch cleanup is authorized by this evidence.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No active-use outcome authorizes deletion.
- B25 batch state not advanced in this patch.
- GitHub vulnerability and Dependabot notices remain future dependency/security work and were not touched.

## PHASE 3 - B26 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 - Active Use Identification
- Batch: B26 / DEPLOYMENT_CI
- Question: Is each B26 governed deployment/CI asset currently used?
- Deletion/merge/retirement/refactor performed: NO
- Deployment config change performed: NO
- Render change performed: NO
- Vercel change performed: NO
- Docker build performed: NO
- Runtime/product change performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO
- Dependency/security/vulnerability notice work performed: NO

Outcome summary:
- ACTIVE: 2
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 1
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B26 ACTIVE assets:
- render.yaml
- vercel.json

B26 MANUAL_USE assets:
- Dockerfile

Evidence:
- B26 is defined as DEPLOYMENT_CI with 3 governed assets: Dockerfile, render.yaml, and vercel.json.
- render.yaml is active deployment configuration evidence. It defines the Render web service, Node environment, buildCommand, startCommand, healthCheckPath, autoDeploy setting, environment variables, and cron services.
- render.yaml starts the active web app with node backend/server-express.js and defines Render cron start commands for deploy-trigger jobs and fixture population.
- vercel.json is active deployment configuration evidence. It defines Vercel version/framework behavior, installCommand, buildCommand, outputDirectory, function duration config, headers, cron path, and rewrites.
- Dockerfile is container deployment material. It defines a Node 20 Alpine image, installs production dependencies, exposes PORT 8080, and starts node backend/server-express.js.
- Current repo deployment evidence does not show Render using Dockerfile: render.yaml declares env: node and startCommand: node backend/server-express.js.
- Dockerfile is therefore treated as MANUAL_USE / deployment-capable material in this phase, not as an active deployment entrypoint.
- No deletion, merge, retirement, dependency/security, vulnerability, deployment config change, Render change, Vercel change, Docker build, source/runtime/product change, or deployment cleanup is authorized by this evidence.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No deployment configuration files changed.
- No active-use outcome authorizes deletion.
- B26 batch state not advanced in this patch.
- GitHub vulnerability and Dependabot notices remain future dependency/security work and were not touched.

## PHASE 3 - B27 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 - Active Use Identification
- Batch: B27 / ARCHIVE
- Question: Is each B27 governed archived asset currently used?
- Deletion/merge/retirement/refactor performed: NO
- Restore performed: NO
- Archived script execution performed: NO
- Database mutation performed: NO
- Deployment change performed: NO
- Runtime/product change performed: NO
- Phase 1 reopened: NO
- Phase 2 reopened: NO
- Dependency/security/vulnerability notice work performed: NO

Outcome summary:
- ACTIVE: 0
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 58
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B27 MANUAL_USE assets:
- _archive/root/cli_v1.1.0.exe
- _archive/root/render.zip
- _archive/scripts/analyze-routes.js
- _archive/scripts/analyze-table-usage.js
- _archive/scripts/check-confidence.js
- _archive/scripts/check-connectivity.js
- _archive/scripts/check-constraints.js
- _archive/scripts/check-deployment.js
- _archive/scripts/check-direct-predictions.js
- _archive/scripts/check-endpoints.js
- _archive/scripts/check-final-schema.js
- _archive/scripts/check-final-sports.js
- _archive/scripts/check-matches.js
- _archive/scripts/check-metadata-times.js
- _archive/scripts/check-risk-constraint.js
- _archive/scripts/check-schema.js
- _archive/scripts/check-stage-schemas.js
- _archive/scripts/check-supabase-tables.js
- _archive/scripts/check-team-names.js
- _archive/scripts/cors-test.sh
- _archive/scripts/debug-events.js
- _archive/scripts/debug-sport-filter.js
- _archive/scripts/deep-table-analysis.js
- _archive/scripts/definitive-cors-diagnosis.sh
- _archive/scripts/deploy-cloud-scheduler.sh
- _archive/scripts/deploy-render.sh
- _archive/scripts/file-walker.js
- _archive/scripts/files-report.json
- _archive/scripts/final-status.js
- _archive/scripts/final-verification.js
- _archive/scripts/fix-matches-timestamps.sql
- _archive/scripts/fix-sport-filter.js
- _archive/scripts/fix-tier-rules.js
- _archive/scripts/fix-view.js
- _archive/scripts/fix-view.sql
- _archive/scripts/full-nuke.js
- _archive/scripts/migration2-fix.js
- _archive/scripts/migration2-normalized-fixtures.js
- _archive/scripts/migration2-v2.js
- _archive/scripts/migration2-v3.js
- _archive/scripts/normalize-sports.sql
- _archive/scripts/patch-other-routes.js
- _archive/scripts/patch-predictions-visibility.js
- _archive/scripts/phase1-immediate-patch.js
- _archive/scripts/phase1-patch.js
- _archive/scripts/phase2-schema-refactor.js
- _archive/scripts/phase3-cleanup.js
- _archive/scripts/sql/create_event_context_tables.sql
- _archive/scripts/sql/create_prediction_publish_runs.sql
- _archive/scripts/sql/create_predictions_accuracy.sql
- _archive/scripts/test-scheduler-endpoint.sh
- _archive/scripts/trigger-grade.js
- _archive/scripts/trigger-refresh.js
- _archive/scripts/trigger-render-pipeline.js
- _archive/scripts/verify-deployment.sh
- _archive/scripts/verify-predictions.js
- _archive/scripts/verify-route-patches.js
- _archive/scripts/wipe-events-data.js

Evidence:
- B27 is defined as the ARCHIVE batch with 58 governed paths under _archive/.
- B27 assets include archived root artifacts, archived JavaScript utilities, archived shell scripts, archived SQL files, archived reports, and old trigger/verification utilities.
- package.json active app startup is node backend/server-express.js; B27 archive files are not package startup entrypoints.
- render.yaml active web startup is node backend/server-express.js; B27 archive files are not Render web start commands.
- Repository search evidence found _archive/ references in governance/audit files rather than active startup surfaces.
- B27 assets are treated as manual archive / historical reference material in this phase, not active runtime assets.
- Some B27 files appear to be old patch, migration, cleanup, wipe, deployment, and verification utilities. This phase does not execute any archived script or SQL file.
- No deletion, merge, retirement, dependency/security, vulnerability, restore, source/runtime/product change, database mutation, deployment change, archive cleanup, or historical-evidence cleanup is authorized by this evidence.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed.
- No archived file executed.
- No active-use outcome authorizes deletion.
- B27 batch state not advanced in this patch.
- GitHub vulnerability and Dependabot notices remain future dependency/security work and were not touched.

## PHASE 3 - B28 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope:
- Phase: PHASE_3 - Active Use Identification
- Batch: B28 / ROOT_NON_MD_TXT_FILES
- Deletion/merge/retirement/refactor performed: NO
- Script execution performed: NO
- Database mutation performed: NO
- Deployment change performed: NO
- Runtime/product change performed: NO
- Dependency/security/vulnerability notice work performed: NO

Outcome summary:
- ACTIVE: 5
- INDIRECTLY_ACTIVE: 0
- MANUAL_USE: 50
- NO_CURRENT_USE_FOUND: 0
- UNKNOWN: 0

B28 ACTIVE assets:
- .gitignore
- .vercelignore
- package-lock.json
- package.json
- tailwind.config.js

B28 MANUAL_USE summary:
- Remaining 50 B28 root non-MD/TXT assets are manual utility, report, config, launcher, SQL/reference, standalone HTML, or diagnostic assets.

Evidence:
- B28 manifest validation confirmed 55 governed root non-MD/TXT assets.
- ACTIVE assets are limited to Git/Vercel/npm/Tailwind configuration currently used by repository, build, install, or deployment workflows.
- Root scripts, reports, diagnostics, launchers, SQL/reference files, and standalone root HTML are manual-use assets in this phase.
- No root script, SQL file, deployment action, database action, or cleanup action was executed.
- No active-use outcome authorizes deletion.

Validation boundary:
- Evidence only.
- No source/runtime/product files changed except this Control Center evidence append.
- B28 batch state not advanced in this patch.
- GitHub vulnerability and Dependabot notices remain future dependency/security work and were not touched.

## PHASE 3 - B29 ACTIVE USE IDENTIFICATION EVIDENCE

Result: PASS

Scope: PHASE_3 / B29 / DOT_TOOL_DIRS_AND_SMALL_DIRS. Evidence only. No deletion, merge, refactor, script execution, SQL, deployment, database, runtime/product, dependency/security, or vulnerability work performed.

Outcome summary: ACTIVE 3; INDIRECTLY_ACTIVE 0; MANUAL_USE 23; NO_CURRENT_USE_FOUND 0; UNKNOWN 0.

B29 ACTIVE assets: .githooks/pre-commit; api/pipeline/run-full.js; js/supabase-client-src.js.

B29 MANUAL_USE summary: Remaining 23 assets are tool config, assistant/workflow config, local database/session material, Dolphin reference material, governance reports, placeholder/data files, temp snapshots, or non-startup JS/reference material.

Evidence: B29 manifest validation confirmed 26 governed assets. .githooks/pre-commit is active local commit-guard material. api/pipeline/run-full.js is active API route material. js/supabase-client-src.js is active build input for package.json build:supabase. No B29 cleanup or execution is authorized by this evidence.

Validation boundary: Evidence only. No active-use outcome authorizes deletion. B29 batch state not advanced. GitHub vulnerability and Dependabot notices remain future dependency/security work.

## PHASE 3 - ACTIVE USE IDENTIFICATION - CLOSED

Result: PASS

Scope:
- Phase: PHASE_3 - Active Use Identification
- Batches closed: B01-B29
- Closure HEAD before roll-up: 0a2fa88c
- Closure source: Control Center recorded batch evidence
- Deletion/merge/retirement/refactor performed: NO
- Script execution performed except approved guards/checks: NO
- SQL execution performed: NO
- Deployment change performed: NO
- Database/Supabase mutation performed: NO
- Runtime/product change performed: NO
- Dependency/security/vulnerability notice work performed: NO

Final outcome summary:
- ACTIVE: 244
- INDIRECTLY_ACTIVE: 5
- MANUAL_USE: 629
- NO_CURRENT_USE_FOUND: 25
- UNKNOWN: 0
- Total governed batch entries covered: 903

Closure evidence:
- Phase 3 reviewed active-use status across B01-B29.
- All batches have recorded Control Center evidence.
- ACTIVE and INDIRECTLY_ACTIVE outcomes identify current or derived use only.
- MANUAL_USE identifies operator, governance, documentation, archive, migration, test, scratch, deployment-capable, or reference use.
- NO_CURRENT_USE_FOUND does not authorize deletion.
- UNKNOWN is 0 at closure.
- B23 includes an absent-path note for supabase/functions/sync-sports-data/index.ts; this remains future governance cleanup only.
- GitHub vulnerability and Dependabot notices remain future dependency/security work and were not touched.

Validation boundary:
- Evidence-only closure roll-up.
- No active-use outcome authorizes deletion, merge, retirement, refactor, source change, runtime change, product change, SQL execution, deployment change, database mutation, Supabase mutation, dependency update, or vulnerability remediation.
- Phase 3 is closed.
- Do not begin Phase 4 without explicit Control Center activation.

## PHASE 4 - LEGACY AND REPLACEMENT IDENTIFICATION - ACTIVATED

Result: ACTIVE

Activation scope:
- Phase: PHASE_4 - Legacy and Replacement Identification
- Activation HEAD: e11785f9
- Previous phase: PHASE_3 - Active Use Identification
- Previous phase status: CLOSED
- Activation type: Control Center activation only
- Batch inspection begun by this activation: NO
- Deletion/merge/retirement/refactor authorized by this activation: NO
- Source/runtime/product change authorized by this activation: NO
- SQL execution authorized by this activation: NO
- Deployment change authorized by this activation: NO
- Database/Supabase mutation authorized by this activation: NO
- Dependency/security/vulnerability remediation authorized by this activation: NO

Objective:
Identify which governed assets are current, legacy, superseded, replaced, parallel, historical evidence, or unknown based on repository evidence only.

Allowed work:
- Inspect governed asset evidence.
- Record Phase 4 legacy/replacement findings in the Control Center.
- Run approved local guards/checks.
- Commit/push scoped governance evidence only.

Forbidden work:
- No deletion.
- No merge.
- No retirement.
- No refactor.
- No source file repair.
- No runtime behavior change.
- No product behavior change.
- No SQL execution.
- No deployment change.
- No database mutation.
- No Supabase mutation.
- No dependency update.
- No vulnerability remediation.

Phase 4 outcome vocabulary:
- CURRENT
- LEGACY
- SUPERSEDED
- REPLACED_BY
- PARALLEL
- HISTORICAL_EVIDENCE
- UNKNOWN

Batch plan:
- B01-B29 will be inspected in deterministic order.
- B01 is the next batch.
- Each batch must record evidence before outcome.
- UNKNOWN must be zero at closure or explicitly justified.

Definition of Done:
- B01-B29 have Phase 4 evidence recorded.
- Every governed batch entry has a legacy/replacement outcome.
- UNKNOWN is zero or explicitly justified.
- Final Phase 4 roll-up is recorded.
- Rulebook guard passes.
- Working tree is clean.
- Scoped commit is created and pushed.
- No cleanup/remediation work is performed.

Validation boundary:
- This activation creates the Phase 4 governance boundary only.
- No Phase 4 batch inspection is started by this activation.
- Stop after activation commit and report exact start point for B01 before beginning inspection.

