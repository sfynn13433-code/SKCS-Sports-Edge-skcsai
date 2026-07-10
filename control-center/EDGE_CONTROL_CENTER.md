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
  "required_modes": ["PHASE_WORK", "COMPLETE_BATCH", "CLOSE_PHASE", "RECORD_FUTURE_PHASE_NOTE", "CONTROL"],
  "required_lifecycle": ["PHASE_PENDING", "PHASE_ACTIVE", "BATCH_ACTIVE", "BATCH_COMPLETE", "PHASE_READY_TO_CLOSE", "PHASE_CLOSED"],
  "cleanup_phase_order": ["PHASE_0", "PHASE_1", "PHASE_2", "PHASE_3", "PHASE_4", "PHASE_5", "PHASE_6", "PHASE_7", "PHASE_8"],
  "eac_evidence_reusable": true,
  "eac_batch_manifest": "control-center/EDGE_ASSET_CLASSIFICATION_BATCHES.v1.json",
  "total_governed_assets": 906,
  "phase_0": {
    "status": "PHASE_CLOSED",
    "question": "What exact repository state is the cleanup programme starting from?",
    "evidence": {
      "repository_root": "C:/Users/user/Desktop/Stephen Fynn/SKCS-test",
      "active_branch": "main",
      "head_commit": "7d21fc276629bb6aec056299d70e1541b462934f",
      "working_tree_status": "dirty_unrelated_changes_preserved",
      "governed_asset_count": 906,
      "eac_batch_manifest": "control-center/EDGE_ASSET_CLASSIFICATION_BATCHES.v1.json",
      "eac_batch_count": 29,
      "already_completed_or_removal_work": "Partial external sports provider removal (PARTIAL); EAC-001 B01-B29 classification inventory complete; prior Control Center per-asset investigations preserved as historical evidence",
      "unrelated_local_changes_preserved": true
    }
  },
  "active_phase": "PHASE_1",
  "active_phase_question": "Are any governed files byte-for-byte identical?",
  "lifecycle_state": "PHASE_ACTIVE",
  "active_batch": null,
  "completed_batches": [],
  "remaining_batches": ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B09", "B10", "B11", "B12", "B13", "B14", "B15", "B16", "B17", "B18", "B19", "B20", "B21", "B22", "B23", "B24", "B25", "B26", "B27", "B28", "B29"],
  "next_deterministic_batch": "B01",
  "phase_1_duplicate_scan_executed": false,
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
  ]
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

FUTURE_PHASE_NOTE

- asset_paths:
  - scripts/enrich-h2h.js
  - scripts/enrich-importance.js
  - scripts/enrich-injuries.js
  - scripts/enrich-travel.js
- issue: B14 manifest-derived paths are missing from the working tree, so exact local Get-FileHash SHA-256 verification cannot complete for those assets.
- likely_future_phase: Control Center manifest reconciliation / asset inventory repair
