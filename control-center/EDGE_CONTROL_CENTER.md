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
