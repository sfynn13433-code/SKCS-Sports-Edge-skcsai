#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const LEDGER_PATH = path.join(
  __dirname,
  "EDGE_BUILD_CONTROL_LEDGER.v1.json"
);

const ASSET_REGISTER_PATH = path.join(
  __dirname,
  "EDGE_REPOSITORY_ASSET_REGISTER.v1.json"
);

const CONTROL_CENTER_DOCUMENT_PATH = path.join(
  __dirname,
  "EDGE_CONTROL_CENTER.md"
);

const BATCH_MANIFEST_PATH = path.join(
  __dirname,
  "EDGE_ASSET_CLASSIFICATION_BATCHES.v1.json"
);

const CONTROL_CENTER_GATE_GROUP = Object.freeze({
  group_id: "control-center-gate-group",
  asset_paths: Object.freeze([
    "control-center/EDGE_CONTROL_CENTER.md",
    "control-center/check_control_center.js",
    "tests/edge-control-center-ledger.test.js",
  ]),
});

const BATCH_MANIFEST_RELATIVE_PATH =
  "control-center/EDGE_ASSET_CLASSIFICATION_BATCHES.v1.json";

const CLEANUP_PHASE_ORDER = Object.freeze([
  "PHASE_0",
  "PHASE_1",
  "PHASE_2",
  "PHASE_3",
  "PHASE_4",
  "PHASE_5",
  "PHASE_6",
  "PHASE_7",
  "PHASE_8",
]);

const PHASE_QUESTIONS = Object.freeze({
  PHASE_0: "What exact repository state is the cleanup programme starting from?",
  PHASE_1: "Are any governed files byte-for-byte identical?",
  PHASE_2: "What does each remaining governed file represent?",
  PHASE_3: "Is each remaining governed file currently used?",
  PHASE_4: "Has each applicable file been superseded or left behind by a newer implementation?",
  PHASE_5: "Are different remaining files doing the same or substantially overlapping job?",
  PHASE_6: "Which Phase 5 overlap candidate families should have canonical authority selected?",
  PHASE_7: "Which confirmed canonical authority decisions should be implemented through merge and consolidation?",
  PHASE_8: "Is the cleaned repository internally consistent?",
});

const REQUIRED_LIFECYCLE_STATES = Object.freeze([
  "PHASE_PENDING",
  "PHASE_ACTIVE",
  "BATCH_ACTIVE",
  "BATCH_COMPLETE",
  "PHASE_READY_TO_CLOSE",
  "PHASE_CLOSED",
]);

const REQUIRED_EXECUTION_MODES = Object.freeze([
  "PHASE_WORK",
  "COMPLETE_BATCH",
  "CLOSE_PHASE",
  "RECORD_FUTURE_PHASE_NOTE",
  "CONTROL",
]);

const RECOGNIZED_REQUEST_TYPES = Object.freeze([
  "PHASE_WORK",
  "COMPLETE_BATCH",
  "CLOSE_PHASE",
  "RECORD_FUTURE_PHASE_NOTE",
  "CONTROL_CENTER_MAINTENANCE",
  "FEATURE_WORK",
  "GOVERNANCE_CLEANUP",
  "PREMATURE_DELETE",
  "PREMATURE_MERGE",
  "PREMATURE_REPLACE",
  "BROAD_REPOSITORY_INSPECTION",
  "CROSS_PHASE_DRIFT",
  "NO_INSTRUCTION",
  // Historical request types remain recognized only to fail closed.
  "INSPECT_GROUP",
  "CLOSE_GROUP",
  "ACTIVATE_NEXT_GROUP",
]);

const ACTIVE_CLEANUP_PHASE = "PHASE_8";

const PHASE_6_CANONICAL_AUTHORITY_REVIEW_ORDER = Object.freeze([
  "B02-B03",
  "B04-B06",
  "B07-B10",
  "B11-B14",
  "B15-B18",
  "B19-B22",
  "B23-B26",
  "B27-B29",
]);

const PHASE_7_MERGE_CONSOLIDATION_REVIEW_ORDER = Object.freeze([
  "B01-B03",
  "B04-B06",
  "B07-B10",
  "B11-B14",
  "B15-B18",
  "B19-B22",
  "B23-B26",
  "B27-B29",
]);

const PHASE_3_OUTCOMES = Object.freeze([
  "ACTIVE",
  "INDIRECTLY_ACTIVE",
  "MANUAL_USE",
  "NO_CURRENT_USE_FOUND",
  "UNKNOWN",
]);

const PHASE_1_FORBIDDEN_WORK = Object.freeze([
  "PURPOSE_IDENTIFICATION",
  "LEGACY_IDENTIFICATION",
  "OVERLAP_IDENTIFICATION",
  "REPAIR",
  "REFACTOR",
  "MERGE_IMPLEMENTATION",
  "RETIREMENT",
  "ARCHITECTURE_REDESIGN",
]);

const PHASE_3_ALLOWED_WORK = Object.freeze([
  "ACTIVE_USE_IDENTIFICATION",
]);

const REQUIRED_EVIDENCE_KEYS = Object.freeze([
  "contents_and_purpose",
  "references_and_consumers",
  "runtime_use",
  "dependencies",
  "overlap_or_duplication",
]);

const ALLOWED_DISPOSITIONS = Object.freeze([
  "KEEP",
  "USE",
  "MERGE",
  "REPLACE",
  "RETIRE",
  "HOLD",
]);

const EAC_BATCH_IDS = Object.freeze(["B01","B02","B03","B04","B05","B06","B07","B08","B09","B10","B11","B12","B13","B14","B15","B16","B17","B18","B19","B20","B21","B22","B23","B24","B25","B26","B27","B28","B29"]);

const ALLOWED_STATUSES = [
  "NOT_STARTED",
  "PROPOSED",
  "APPROVED",
  "IN_PROGRESS",
  "BLOCKED",
  "PARTIAL",
  "TESTED",
  "COMMITTED",
  "DONE",
  "DEFERRED",
];

const ALLOWED_GATE_STATUSES = [
  "BLOCKED",
  "APPROVED",
];

const STARTABLE_STATUSES = new Set([
  "APPROVED",
  "IN_PROGRESS",
]);

const SATISFIED_STATUSES = new Set([
  "DONE",
  "TESTED",
  "COMMITTED",
]);

const MARRIAGE_PREREQUISITES = [
  "EMG-001",
  "EFI-001",
  "EST-001",
  "ESEC-001",
  "EPI-001",
  "EPRV-001",
  "E2E-001",
];

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function loadLedger(filePath = LEDGER_PATH) {
  return loadJson(filePath);
}

function loadAssetRegister(filePath = ASSET_REGISTER_PATH) {
  return loadJson(filePath);
}

function readControlCenterDocument(
  filePath = CONTROL_CENTER_DOCUMENT_PATH
) {
  return fs.readFileSync(filePath, "utf8");
}

function getTotalGovernedAssets(assetRegister) {
  return Array.isArray(assetRegister?.assets)
    ? assetRegister.assets.length
    : 0;
}

function getGovernedAssetPaths(assetRegister) {
  if (!Array.isArray(assetRegister?.assets)) {
    return [];
  }

  return assetRegister.assets
    .map((asset) => asset?.asset_path)
    .filter((assetPath) => typeof assetPath === "string" && assetPath.trim());
}


function loadBatchManifest(filePath = BATCH_MANIFEST_PATH) {
  return loadJson(filePath);
}

function getEacBatchIds(manifest = loadBatchManifest()) {
  if (!Array.isArray(manifest?.batches)) {
    return [...EAC_BATCH_IDS];
  }

  return manifest.batches
    .map((batch) => batch?.batch_id)
    .filter((batchId) => typeof batchId === "string" && batchId.trim());
}

function getNextIncompleteBatch(state) {
  const completed = new Set(
    Array.isArray(state?.completed_batches) ? state.completed_batches : []
  );
  const remaining = Array.isArray(state?.remaining_batches)
    ? state.remaining_batches
    : getEacBatchIds().filter((batchId) => !completed.has(batchId));
  return remaining[0] || null;
}

function getCleanupReviewUnitsForPhase(phase) {
  if (phase === "PHASE_6") {
    return [...PHASE_6_CANONICAL_AUTHORITY_REVIEW_ORDER];
  }

  if (phase === "PHASE_7") {
    return [...PHASE_7_MERGE_CONSOLIDATION_REVIEW_ORDER];
  }

  if (phase === "PHASE_8") {
    return [];
  }

  return getEacBatchIds();
}

function getPhaseActivationBatchState(nextPhase) {
  if (nextPhase === "PHASE_7") {
    return {
      completed_batches: [],
      remaining_batches: [...PHASE_7_MERGE_CONSOLIDATION_REVIEW_ORDER],
      next_deterministic_batch: PHASE_7_MERGE_CONSOLIDATION_REVIEW_ORDER[0] || null,
    };
  }

  if (nextPhase === "PHASE_8") {
    return {
      completed_batches: [],
      remaining_batches: [],
      next_deterministic_batch: null,
    };
  }

  const batchIds = getEacBatchIds();
  return {
    completed_batches: [],
    remaining_batches: [...batchIds],
    next_deterministic_batch: batchIds[0] || null,
  };
}

function getExpectedLifecycleState(state) {
  const reviewUnits = getCleanupReviewUnitsForPhase(state.active_phase);

  if (reviewUnits.length === 0) {
    if (
      state.lifecycle_state === "PHASE_READY_TO_CLOSE" ||
      state.lifecycle_state === "PHASE_CLOSED"
    ) {
      return state.lifecycle_state;
    }

    return "PHASE_ACTIVE";
  }

  if (
    Array.isArray(state.remaining_batches) &&
    state.remaining_batches.length === 0
  ) {
    return "PHASE_READY_TO_CLOSE";
  }

  return "BATCH_COMPLETE";
}

function createControlCenterGateState(overrides = {}) {
  const assetRegister = loadAssetRegister();
  const totalGovernedAssets = getTotalGovernedAssets(assetRegister);
  const batchIds = getEacBatchIds();
  const reviewUnits = getCleanupReviewUnitsForPhase(ACTIVE_CLEANUP_PHASE);
  const baseState = {
    governance_model: "REPOSITORY_CLEANUP_PROGRAMME",
    required_modes: [...REQUIRED_EXECUTION_MODES],
    required_lifecycle: [...REQUIRED_LIFECYCLE_STATES],
    cleanup_phase_order: [...CLEANUP_PHASE_ORDER],
    eac_evidence_reusable: true,
    eac_batch_manifest: BATCH_MANIFEST_RELATIVE_PATH,
    total_governed_assets: totalGovernedAssets,
    phase_0: {
      status: "PHASE_CLOSED",
      question: PHASE_QUESTIONS.PHASE_0,
      evidence: {
        repository_root: path.resolve(__dirname, "..").replace(/\\/g, "/"),
        active_branch: "main",
        head_commit: "7d21fc276629bb6aec056299d70e1541b462934f",
        working_tree_status: "dirty_unrelated_changes_preserved",
        governed_asset_count: totalGovernedAssets,
        eac_batch_manifest: BATCH_MANIFEST_RELATIVE_PATH,
        eac_batch_count: batchIds.length,
        already_completed_or_removal_work:
          "Partial external sports provider removal (PARTIAL); EAC-001 B01-B29 classification inventory complete; prior Control Center per-asset investigations preserved as historical evidence",
        unrelated_local_changes_preserved: true,
      },
    },
    phase_1: {
      status: "PHASE_CLOSED",
      question: PHASE_QUESTIONS.PHASE_1,
      evidence: {
        result: "CLOSED",
        duplicate_scan_executed: true,
        final_repository_wide_check: "PASS",
        closure_note:
          "Phase 1 Exact Duplicate Elimination is closed. Do not reopen without explicit Control Center approval.",
      },
    },
    phase_2: {
      status: "PHASE_CLOSED",
      question: PHASE_QUESTIONS.PHASE_2,
      evidence: {
        result: "PASS WITH CORRECTIONS",
        batches_reviewed: "B01-B29",
        final_manifest_count_check: "PASS",
        closure_note:
          "Phase 2 Purpose Classification Review is closed. Do not reopen without explicit Control Center approval.",
      },
    },
    phase_5: {
      status: "PHASE_CLOSED",
      question: PHASE_QUESTIONS.PHASE_5,
      evidence: {
        result: "PASS WITH OVERLAP CANDIDATES",
        batches_reviewed: "B01-B29",
        closure_commit: "b71b411d",
        closure_note:
          "Phase 5 Functional Overlap Identification is evidence-complete. No canonical authority was selected during Phase 5.",
      },
    },
    phase_6: {
      status: "PHASE_CLOSED",
      question: PHASE_QUESTIONS.PHASE_6,
      evidence: {
        result: "PASS WITH CANONICAL AUTHORITY DECISIONS",
        batches_reviewed:
          "B02-B03,B04-B06,B07-B10,B11-B14,B15-B18,B19-B22,B23-B26,B27-B29",
        closure_commit: "1bd3adad",
        closure_note:
          "Phase 6 Canonical Authority Selection is closed. PHASE_7 activation does not authorize merge/consolidation implementation until a separate Phase 7 batch mini-project is approved.",
      },
    },
    phase_7: {
      status: "PHASE_CLOSED",
      question: PHASE_QUESTIONS.PHASE_7,
      evidence: {
        result: "PASS WITH NO_ACTION AND RUNTIME-PROOF HOLDS",
        batches_reviewed:
          "B01-B03,B04-B06,B07-B10,B11-B14,B15-B18,B19-B22,B23-B26,B27-B29",
        review_order_model: "GROUPED_REVIEW_UNITS",
        closure_commit: "746a2231",
        closure_note:
          "Phase 7 Merge and Consolidation is closed. PHASE_8 activation does not authorize a new cleanup hunt or individual EAC batch re-sequencing.",
      },
    },
    phase_8: {
      status: "PHASE_READY_TO_CLOSE",
      question: PHASE_QUESTIONS.PHASE_8,
      evidence: {
        result: "PASS",
        validation_start_commit: "900650e4",
        lifecycle_before_validation: "PHASE_ACTIVE",
        phase_7_grouped_review_units_preserved:
          "B01-B03,B04-B06,B07-B10,B11-B14,B15-B18,B19-B22,B23-B26,B27-B29",
        review_order_model: "NO_BATCH_MODEL",
        classification_repair_commit: "26acdedc",
        runtime_inventory_repair_commit: "900650e4",
        control_verify: "PASS",
        deferred_holds:
          "HOLD_NEEDS_RUNTIME_PROOF and HOLD_ABSENT_PATH remain deferred future work, not Phase 8 defects",
        validation_note:
          "Phase 8 final repository validation evidence is complete. Phase 8 is ready for a separate closure summary/control packet.",
      },
    },
    active_phase: ACTIVE_CLEANUP_PHASE,
    active_phase_question: PHASE_QUESTIONS[ACTIVE_CLEANUP_PHASE],
    lifecycle_state: "PHASE_READY_TO_CLOSE",
    active_batch: null,
    completed_batches: [],
    remaining_batches: [],
    next_deterministic_batch: null,
    phase_3_outcomes: [...PHASE_3_OUTCOMES],
    phase_3_no_deletion_law: "NO_CURRENT_USE_FOUND does not authorize deletion.",
    future_phase_notes: [],
    standing_git_authority: true,
    dangerous_git_actions_approval_gated: true,
    historical_per_asset_forensic_lifecycle: "PRESERVED_AS_HISTORY_ONLY",
    historical_closed_asset_paths: [
      ...CONTROL_CENTER_GATE_GROUP.asset_paths,
      ".bat",
      ".dockerignore",
      ".env.example",
      ".gitignore",
      ".gcloudignore",
    ],
  };

  const merged = {
    ...baseState,
    ...overrides,
    phase_0: {
      ...baseState.phase_0,
      ...(overrides.phase_0 || {}),
      evidence: {
        ...baseState.phase_0.evidence,
        ...(overrides.phase_0?.evidence || {}),
      },
    },
    completed_batches: Array.isArray(overrides.completed_batches)
      ? [...overrides.completed_batches]
      : [...baseState.completed_batches],
    remaining_batches: Array.isArray(overrides.remaining_batches)
      ? [...overrides.remaining_batches]
      : [...baseState.remaining_batches],
    future_phase_notes: Array.isArray(overrides.future_phase_notes)
      ? [...overrides.future_phase_notes]
      : [...baseState.future_phase_notes],
    historical_closed_asset_paths: Array.isArray(
      overrides.historical_closed_asset_paths
    )
      ? [...overrides.historical_closed_asset_paths]
      : [...baseState.historical_closed_asset_paths],
    cleanup_phase_order: Array.isArray(overrides.cleanup_phase_order)
      ? [...overrides.cleanup_phase_order]
      : [...baseState.cleanup_phase_order],
    required_modes: Array.isArray(overrides.required_modes)
      ? [...overrides.required_modes]
      : [...baseState.required_modes],
    required_lifecycle: Array.isArray(overrides.required_lifecycle)
      ? [...overrides.required_lifecycle]
      : [...baseState.required_lifecycle],
  };

  if (!merged.next_deterministic_batch) {
    merged.next_deterministic_batch = getNextIncompleteBatch(merged);
  }

  return merged;
}

function parseControlCenterStateDocument(documentText) {
  const startMarker = "<!-- CONTROL_CENTER_STATE_START -->";
  const endMarker = "<!-- CONTROL_CENTER_STATE_END -->";
  const startIndex = documentText.indexOf(startMarker);
  const endIndex = documentText.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  const section = documentText.slice(startIndex, endIndex);
  const match = section.match(/```json\s*([\s\S]*?)\s*```/i);

  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[1]);
  } catch (_) {
    return null;
  }
}

function normalizeFileList(fileList) {
  if (!Array.isArray(fileList)) {
    return null;
  }

  return [...new Set(fileList.map((item) => String(item)))].sort();
}

function listsMatchExactly(left, right) {
  const normalizedLeft = normalizeFileList(left);
  const normalizedRight = normalizeFileList(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every(
    (value, index) => value === normalizedRight[index]
  );
}

function isSubsetOfList(items, allowedItems) {
  const normalizedItems = normalizeFileList(items);
  const normalizedAllowedItems = normalizeFileList(allowedItems);

  if (!normalizedItems || !normalizedAllowedItems) {
    return false;
  }

  const allowed = new Set(normalizedAllowedItems);
  return normalizedItems.every((item) => allowed.has(item));
}

function getClosedAssetPaths(state) {
  return normalizeFileList(state?.historical_closed_asset_paths) || [];
}

function getNextGovernedAssetGroup(state, assetRegister = loadAssetRegister()) {
  const governedAssetPaths = getGovernedAssetPaths(assetRegister);
  const closedAssetPaths = new Set(getClosedAssetPaths(state));
  const nextAssetPath = governedAssetPaths.find(
    (assetPath) => !closedAssetPaths.has(assetPath)
  );

  if (!nextAssetPath) {
    return null;
  }

  return {
    group_id: nextAssetPath,
    asset_paths: [nextAssetPath],
  };
}

function isEvidenceComplete(evidenceCompletion) {
  if (!evidenceCompletion || typeof evidenceCompletion !== "object") {
    return false;
  }

  return REQUIRED_EVIDENCE_KEYS.every(
    (key) => evidenceCompletion[key] === true
  );
}

function normalizeProposal(input) {
  if (input == null) {
    return null;
  }

  if (typeof input === "string") {
    return {
      request_type: "NO_INSTRUCTION",
      raw_instruction: input,
    };
  }

  if (typeof input !== "object") {
    return null;
  }

  return {
    ...input,
    mode:
      typeof input.mode === "string"
        ? input.mode.toUpperCase()
        : input.mode,
    request_type:
      typeof input.request_type === "string"
        ? input.request_type.toUpperCase()
        : input.request_type,
  };
}

function validateLedger(ledger) {
  const errors = [];
  const warnings = [];
  const tasks = ledger.tasks || [];

  if (!ledger.version) {
    errors.push("Ledger missing version");
  }

  if (!Array.isArray(tasks) || tasks.length === 0) {
    errors.push("Ledger has no tasks");
  }

  if (!ALLOWED_GATE_STATUSES.includes(ledger.scout_edge_marriage_gate)) {
    errors.push(
      `Invalid scout_edge_marriage_gate "${ledger.scout_edge_marriage_gate}"`
    );
  }

  if (!ALLOWED_GATE_STATUSES.includes(ledger.supabase_storage_gate)) {
    errors.push(
      `Invalid supabase_storage_gate "${ledger.supabase_storage_gate}"`
    );
  }

  const ids = new Set();

  for (const task of tasks) {
    if (!task.task_id) {
      errors.push("Task missing task_id");
      continue;
    }

    if (ids.has(task.task_id)) {
      errors.push(`Duplicate task_id: ${task.task_id}`);
    }

    ids.add(task.task_id);

    if (!ALLOWED_STATUSES.includes(task.status)) {
      errors.push(
        `${task.task_id}: invalid status "${task.status}"`
      );
    }

    if (
      !task.completion_definition ||
      String(task.completion_definition).trim() === ""
    ) {
      errors.push(
        `${task.task_id}: missing completion_definition`
      );
    }

    if (
      !task.proof_required ||
      (
        Array.isArray(task.proof_required) &&
        task.proof_required.length === 0
      )
    ) {
      errors.push(
        `${task.task_id}: missing proof_required`
      );
    }

    if (
      !task.next_action ||
      String(task.next_action).trim() === ""
    ) {
      errors.push(
        `${task.task_id}: missing next_action`
      );
    }

    if (task.status === "DONE") {
      const evidence = task.current_evidence;

      if (
        !evidence ||
        (
          Array.isArray(evidence) &&
          evidence.length === 0
        ) ||
        (
          typeof evidence === "string" &&
          evidence.trim() === ""
        )
      ) {
        errors.push(
          `${task.task_id}: DONE without current_evidence`
        );
      }
    }

    if (
      task.status === "BLOCKED" &&
      (
        !Array.isArray(task.blocked_by) ||
        task.blocked_by.length === 0
      )
    ) {
      errors.push(
        `${task.task_id}: BLOCKED without blocked_by`
      );
    }
  }

  for (const task of tasks) {
    for (const dependencyId of task.blocked_by || []) {
      if (!ids.has(dependencyId)) {
        errors.push(
          `${task.task_id}: blocked_by unknown task ${dependencyId}`
        );
      }
    }

    for (const blockedTaskId of task.blocks || []) {
      if (!ids.has(blockedTaskId)) {
        warnings.push(
          `${task.task_id}: blocks references unknown task ${blockedTaskId}`
        );
      }
    }
  }

  for (const taskId of MARRIAGE_PREREQUISITES) {
    if (!ids.has(taskId)) {
      errors.push(
        `Marriage prerequisite missing from ledger: ${taskId}`
      );
    }
  }

  return {
    errors,
    warnings,
    tasks,
  };
}

function validateControlCenterPolicy(documentText) {
  const errors = [];
  const state = parseControlCenterStateDocument(documentText);
  const assetRegister = loadAssetRegister();
  const expectedTotalGovernedAssets =
    getTotalGovernedAssets(assetRegister);
  const governedAssetPaths = getGovernedAssetPaths(assetRegister);

  if (!state) {
    errors.push(
      "EDGE_CONTROL_CENTER.md missing structured control center state"
    );
    return {
      errors,
      state: null,
    };
  }

  if (!Array.isArray(state.required_modes)) {
    errors.push("Control Center state missing required_modes");
  } else if (
    !listsMatchExactly(
      state.required_modes,
      REQUIRED_EXECUTION_MODES
    )
  ) {
    errors.push("Control Center state required_modes drift");
  }

  if (!Array.isArray(state.required_lifecycle)) {
    errors.push("Control Center state missing required_lifecycle");
  } else if (
    !listsMatchExactly(
      state.required_lifecycle,
      REQUIRED_LIFECYCLE_STATES
    )
  ) {
    errors.push("Control Center state required_lifecycle drift");
  }

  const activeGroup = state.active_asset_group;

  if (
    !activeGroup ||
    typeof activeGroup !== "object" ||
    typeof activeGroup.group_id !== "string" ||
    activeGroup.group_id.trim() === "" ||
    !Array.isArray(activeGroup.asset_paths) ||
    activeGroup.asset_paths.length === 0 ||
    !isSubsetOfList(activeGroup.asset_paths, governedAssetPaths)
  ) {
    errors.push("Control Center state active_asset_group drift");
  }

  if (!REQUIRED_LIFECYCLE_STATES.includes(state.lifecycle_state)) {
    errors.push("Control Center state lifecycle_state invalid");
  }

  if (
    !state.evidence_completion ||
    typeof state.evidence_completion !== "object"
  ) {
    errors.push("Control Center state missing evidence_completion");
  } else if (
    !REQUIRED_EVIDENCE_KEYS.every(
      (key) => Object.prototype.hasOwnProperty.call(
        state.evidence_completion,
        key
      )
    )
  ) {
    errors.push("Control Center state evidence_completion drift");
  }

  if (
    state.disposition !== null &&
    !ALLOWED_DISPOSITIONS.includes(state.disposition)
  ) {
    errors.push("Control Center state disposition invalid");
  }

  if (!["OPEN", "CLOSED"].includes(state.closure_status)) {
    errors.push("Control Center state closure_status invalid");
  }

  const totalGovernedAssets =
    Number(state.total_governed_assets) || 0;
  const investigatedAssets = Number(state.investigated_assets);
  const closedAssets = Number(state.closed_assets);
  const remainingAssets = Number(state.remaining_assets);

  if (
    totalGovernedAssets <= 0 ||
    investigatedAssets < 0 ||
    closedAssets < 0 ||
    remainingAssets < 0
  ) {
    errors.push("Control Center state counts invalid");
  }

  if (totalGovernedAssets !== expectedTotalGovernedAssets) {
    errors.push("Control Center state total_governed_assets drift");
  }

  if (remainingAssets !== totalGovernedAssets - investigatedAssets) {
    errors.push("Control Center state remaining_assets drift");
  }

  if (closedAssets > investigatedAssets) {
    errors.push("Control Center state closed_assets exceeds investigated_assets");
  }

  if (
    !Array.isArray(state.required_closure_files) ||
    !listsMatchExactly(
      state.required_closure_files,
      activeGroup?.asset_paths
    )
  ) {
    errors.push("Control Center state required_closure_files drift");
  }

  if (!Array.isArray(state.inspected_groups)) {
    errors.push("Control Center state missing inspected_groups");
  }

  if (!Array.isArray(state.closed_groups)) {
    errors.push("Control Center state missing closed_groups");
  }

  if (
    !Array.isArray(state.closed_asset_paths) ||
    !isSubsetOfList(state.closed_asset_paths, governedAssetPaths)
  ) {
    errors.push("Control Center state closed_asset_paths drift");
  }

  return {
    errors,
    state,
  };
}

function isExactGroupMatch(proposalGroup, stateGroup) {
  if (!proposalGroup || !stateGroup) {
    return false;
  }

  return (
    typeof proposalGroup.group_id === "string" &&
    proposalGroup.group_id === stateGroup.group_id &&
    listsMatchExactly(
      proposalGroup.asset_paths,
      stateGroup.asset_paths
    )
  );
}

function buildGateResponse({
  gate,
  mode,
  reason,
  activeAssetGroup,
  lifecycleState,
  approvedScope,
  nextState,
}) {
  return {
    gate,
    mode,
    reason,
    activeAssetGroup,
    lifecycleState,
    approvedScope,
    nextState,
  };
}



function validateControlCenterPolicy(documentText) {
  const errors = [];
  const state = parseControlCenterStateDocument(documentText);
  const assetRegister = loadAssetRegister();
  const expectedTotalGovernedAssets = getTotalGovernedAssets(assetRegister);
  const batchIds = getEacBatchIds();
  const reviewUnits = getCleanupReviewUnitsForPhase(ACTIVE_CLEANUP_PHASE);

  if (!state) {
    errors.push(
      "EDGE_CONTROL_CENTER.md missing structured control center state"
    );
    return { errors, state: null };
  }

  if (state.governance_model !== "REPOSITORY_CLEANUP_PROGRAMME") {
    errors.push("Control Center state governance_model drift");
  }

  if (!Array.isArray(state.required_modes)) {
    errors.push("Control Center state missing required_modes");
  } else if (!listsMatchExactly(state.required_modes, REQUIRED_EXECUTION_MODES)) {
    errors.push("Control Center state required_modes drift");
  }

  if (!Array.isArray(state.required_lifecycle)) {
    errors.push("Control Center state missing required_lifecycle");
  } else if (
    !listsMatchExactly(state.required_lifecycle, REQUIRED_LIFECYCLE_STATES)
  ) {
    errors.push("Control Center state required_lifecycle drift");
  }

  if (!Array.isArray(state.cleanup_phase_order)) {
    errors.push("Control Center state missing cleanup_phase_order");
  } else if (!listsMatchExactly(state.cleanup_phase_order, CLEANUP_PHASE_ORDER)) {
    errors.push("Control Center state cleanup_phase_order drift");
  }

  if (state.eac_evidence_reusable !== true) {
    errors.push("Control Center state must recognize reusable EAC-001 evidence");
  }

  if (state.eac_batch_manifest !== BATCH_MANIFEST_RELATIVE_PATH) {
    errors.push("Control Center state eac_batch_manifest drift");
  }

  if (Number(state.total_governed_assets) !== expectedTotalGovernedAssets) {
    errors.push("Control Center state total_governed_assets drift");
  }

  if (!state.phase_0 || state.phase_0.status !== "PHASE_CLOSED") {
    errors.push("Control Center state phase_0 must be PHASE_CLOSED with evidence");
  } else {
    const evidence = state.phase_0.evidence || {};
    for (const key of [
      "repository_root",
      "active_branch",
      "head_commit",
      "working_tree_status",
      "governed_asset_count",
      "eac_batch_manifest",
      "eac_batch_count",
      "already_completed_or_removal_work",
    ]) {
      if (
        evidence[key] == null ||
        (typeof evidence[key] === "string" && evidence[key].trim() === "")
      ) {
        errors.push(`Control Center state phase_0 evidence missing ${key}`);
      }
    }
    if (Number(evidence.governed_asset_count) !== expectedTotalGovernedAssets) {
      errors.push("Control Center state phase_0 governed_asset_count drift");
    }
    if (Number(evidence.eac_batch_count) !== batchIds.length) {
      errors.push("Control Center state phase_0 eac_batch_count drift");
    }
  }

  if (!state.phase_1 || state.phase_1.status !== "PHASE_CLOSED") {
    errors.push("Control Center state phase_1 must be PHASE_CLOSED");
  }

  if (!state.phase_2 || state.phase_2.status !== "PHASE_CLOSED") {
    errors.push("Control Center state phase_2 must be PHASE_CLOSED");
  }

  if (!state.phase_6 || state.phase_6.status !== "PHASE_CLOSED") {
    errors.push("Control Center state phase_6 must be PHASE_CLOSED");
  }

  if (!state.phase_7 || state.phase_7.status !== "PHASE_CLOSED") {
    errors.push("Control Center state phase_7 must be PHASE_CLOSED");
  }

  if (!state.phase_8 || state.phase_8.status !== "PHASE_READY_TO_CLOSE") {
    errors.push(
      "Control Center state phase_8 must be PHASE_READY_TO_CLOSE with evidence"
    );
  } else {
    const evidence = state.phase_8.evidence || {};
    for (const key of [
      "result",
      "validation_start_commit",
      "lifecycle_before_validation",
      "phase_7_grouped_review_units_preserved",
      "review_order_model",
      "classification_repair_commit",
      "runtime_inventory_repair_commit",
      "control_verify",
      "deferred_holds",
      "validation_note",
    ]) {
      if (
        evidence[key] == null ||
        (typeof evidence[key] === "string" && evidence[key].trim() === "")
      ) {
        errors.push(`Control Center state phase_8 evidence missing ${key}`);
      }
    }
  }

  if (state.active_phase !== ACTIVE_CLEANUP_PHASE) {
    errors.push(`Control Center state active_phase must be ${ACTIVE_CLEANUP_PHASE}`);
  }

  if (state.active_phase_question !== PHASE_QUESTIONS[ACTIVE_CLEANUP_PHASE]) {
    errors.push("Control Center state active_phase_question drift");
  }

  if (!listsMatchExactly(state.phase_3_outcomes, PHASE_3_OUTCOMES)) {
    errors.push("Control Center state phase_3_outcomes drift");
  }

  if (
    typeof state.phase_3_no_deletion_law !== "string" ||
    !state.phase_3_no_deletion_law.includes("NO_CURRENT_USE_FOUND does not authorize deletion")
  ) {
    errors.push("Control Center state phase_3_no_deletion_law missing");
  }

  if (!REQUIRED_LIFECYCLE_STATES.includes(state.lifecycle_state)) {
    errors.push("Control Center state lifecycle_state invalid");
  }

  const expectedLifecycleState = getExpectedLifecycleState(state);
  if (state.lifecycle_state !== expectedLifecycleState) {
    errors.push(
      `Control Center state lifecycle_state must be ${expectedLifecycleState}`
    );
  }

  if (!Array.isArray(state.completed_batches)) {
    errors.push("Control Center state missing completed_batches");
  }

  if (!Array.isArray(state.remaining_batches)) {
    errors.push("Control Center state missing remaining_batches");
  } else {
    const expectedRemaining = reviewUnits.filter(
      (unit) => !(state.completed_batches || []).includes(unit)
    );
    if (!listsMatchExactly(state.remaining_batches, expectedRemaining)) {
      errors.push("Control Center state remaining_batches drift");
    }
  }

  const expectedNext = getNextIncompleteBatch(state);
  if (state.next_deterministic_batch !== expectedNext) {
    errors.push("Control Center state next_deterministic_batch drift");
  }


  if (!Array.isArray(state.future_phase_notes)) {
    errors.push("Control Center state missing future_phase_notes");
  }

  if (state.standing_git_authority !== true) {
    errors.push("Control Center state standing_git_authority missing");
  }

  if (state.dangerous_git_actions_approval_gated !== true) {
    errors.push("Control Center state dangerous_git_actions_approval_gated missing");
  }

  if (
    state.historical_per_asset_forensic_lifecycle !==
    "PRESERVED_AS_HISTORY_ONLY"
  ) {
    errors.push("Control Center state must preserve historical forensic lifecycle evidence");
  }

  if (!Array.isArray(state.historical_closed_asset_paths)) {
    errors.push("Control Center state missing historical_closed_asset_paths");
  }

  if (!String(documentText).includes("### Historical Control Center evidence")) {
    errors.push("EDGE_CONTROL_CENTER.md missing historical evidence section");
  }

  if (!String(documentText).includes("## PHASE 6 CLOSURE SUMMARY")) {
    errors.push("EDGE_CONTROL_CENTER.md missing PHASE 6 closure summary");
  }

  if (!String(documentText).includes("## PHASE 7 CLOSURE SUMMARY")) {
    errors.push("EDGE_CONTROL_CENTER.md missing PHASE 7 closure summary");
  }

  if (
    !String(documentText).includes(
      "PHASE_7 activation does not authorize implementation"
    )
  ) {
    errors.push("EDGE_CONTROL_CENTER.md missing PHASE_7 activation warning");
  }

  if (
    !String(documentText).includes(
      "PHASE_8 activation does not authorize a new cleanup hunt"
    )
  ) {
    errors.push("EDGE_CONTROL_CENTER.md missing PHASE_8 activation warning");
  }

  if (
    !String(documentText).includes(
      "## PHASE 8 FINAL REPOSITORY VALIDATION EVIDENCE"
    )
  ) {
    errors.push(
      "EDGE_CONTROL_CENTER.md missing PHASE 8 final repository validation evidence"
    );
  }

  if (
    !String(documentText).includes(
      "## PHASE 7 - B01 MERGE AND CONSOLIDATION EVIDENCE"
    )
  ) {
    errors.push("EDGE_CONTROL_CENTER.md missing PHASE 7 B01 evidence");
  }

  if (
    !String(documentText).includes(
      "## PHASE 7 - B01-B03 MERGE AND CONSOLIDATION EVIDENCE"
    )
  ) {
    errors.push("EDGE_CONTROL_CENTER.md missing PHASE 7 B01-B03 evidence");
  }

  if (
    !String(documentText).includes(
      "## PHASE 7 - B04-B06 MERGE AND CONSOLIDATION EVIDENCE"
    )
  ) {
    errors.push("EDGE_CONTROL_CENTER.md missing PHASE 7 B04-B06 evidence");
  }

  if (
    !String(documentText).includes(
      "## PHASE 7 - B07-B10 MERGE AND CONSOLIDATION EVIDENCE"
    )
  ) {
    errors.push("EDGE_CONTROL_CENTER.md missing PHASE 7 B07-B10 evidence");
  }

  if (
    !String(documentText).includes(
      "## PHASE 7 - B11-B14 MERGE AND CONSOLIDATION EVIDENCE"
    )
  ) {
    errors.push("EDGE_CONTROL_CENTER.md missing PHASE 7 B11-B14 evidence");
  }

  if (
    !String(documentText).includes(
      "## PHASE 7 - B15-B18 MERGE AND CONSOLIDATION EVIDENCE"
    )
  ) {
    errors.push("EDGE_CONTROL_CENTER.md missing PHASE 7 B15-B18 evidence");
  }

  if (
    !String(documentText).includes(
      "## PHASE 7 - B19-B22 MERGE AND CONSOLIDATION EVIDENCE"
    )
  ) {
    errors.push("EDGE_CONTROL_CENTER.md missing PHASE 7 B19-B22 evidence");
  }

  if (
    !String(documentText).includes(
      "## PHASE 7 - B23-B26 MERGE AND CONSOLIDATION EVIDENCE"
    )
  ) {
    errors.push("EDGE_CONTROL_CENTER.md missing PHASE 7 B23-B26 evidence");
  }

  if (
    !String(documentText).includes(
      "## PHASE 7 - B27-B29 MERGE AND CONSOLIDATION EVIDENCE"
    )
  ) {
    errors.push("EDGE_CONTROL_CENTER.md missing PHASE 7 B27-B29 evidence");
  }

  if (
    String(documentText).includes(
      "locked until every governed asset has reached CLOSED"
    )
  ) {
    errors.push("EDGE_CONTROL_CENTER.md still contains conflicting per-asset lock law");
  }

  return { errors, state };
}

function isExactGroupMatch(proposalGroup, stateGroup) {
  if (!proposalGroup || !stateGroup) {
    return false;
  }

  return (
    typeof proposalGroup.group_id === "string" &&
    proposalGroup.group_id === stateGroup.group_id &&
    listsMatchExactly(proposalGroup.asset_paths, stateGroup.asset_paths)
  );
}

function buildGateResponse({
  gate,
  mode,
  reason,
  activeAssetGroup,
  lifecycleState,
  approvedScope,
  nextState,
}) {
  return {
    gate,
    mode,
    reason,
    activeAssetGroup,
    lifecycleState,
    approvedScope,
    nextState,
  };
}

function evaluateControlCenterProposal(
  proposalInput,
  stateInput = createControlCenterGateState()
) {
  const proposal = normalizeProposal(proposalInput);
  const state = stateInput || createControlCenterGateState();

  if (!proposal || !state || !state.active_phase || !state.lifecycle_state) {
    return buildGateResponse({
      gate: "HOLD",
      mode: proposal?.mode || "NONE",
      reason: "MISSING_INSTRUCTION_OR_STATE",
      activeAssetGroup: state?.active_phase || "NONE",
      lifecycleState: state?.lifecycle_state || "NONE",
      approvedScope: "NONE",
      nextState: state || null,
    });
  }

  const requestType = proposal.request_type || "NO_INSTRUCTION";
  const activeLabel = `${state.active_phase}:${state.active_batch || state.next_deterministic_batch || "NONE"}`;

  if (!RECOGNIZED_REQUEST_TYPES.includes(requestType)) {
    return buildGateResponse({
      gate: "HOLD",
      mode: proposal.mode || "NONE",
      reason: "UNRECOGNIZED_REQUEST_TYPE",
      activeAssetGroup: activeLabel,
      lifecycleState: state.lifecycle_state,
      approvedScope: "NONE",
      nextState: state,
    });
  }

  if (requestType === "NO_INSTRUCTION") {
    return buildGateResponse({
      gate: "HOLD",
      mode: "NONE",
      reason: "NO_INSTRUCTION",
      activeAssetGroup: activeLabel,
      lifecycleState: state.lifecycle_state,
      approvedScope: "NONE",
      nextState: state,
    });
  }

  if (requestType === "FEATURE_WORK") {
    return buildGateResponse({
      gate: "HOLD",
      mode: proposal.mode || "NONE",
      reason: "FEATURE_WORK",
      activeAssetGroup: activeLabel,
      lifecycleState: state.lifecycle_state,
      approvedScope: "NONE",
      nextState: state,
    });
  }

  if (requestType === "GOVERNANCE_CLEANUP") {
    return buildGateResponse({
      gate: "HOLD",
      mode: proposal.mode || "NONE",
      reason: "UNRELATED_GOVERNANCE_CLEANUP",
      activeAssetGroup: activeLabel,
      lifecycleState: state.lifecycle_state,
      approvedScope: "NONE",
      nextState: state,
    });
  }

  if (requestType === "PREMATURE_DELETE") {
    return buildGateResponse({
      gate: "HOLD",
      mode: proposal.mode || "NONE",
      reason: "PREMATURE_DELETE",
      activeAssetGroup: activeLabel,
      lifecycleState: state.lifecycle_state,
      approvedScope: "NONE",
      nextState: state,
    });
  }

  if (requestType === "PREMATURE_MERGE") {
    return buildGateResponse({
      gate: "HOLD",
      mode: proposal.mode || "NONE",
      reason: "PREMATURE_MERGE",
      activeAssetGroup: activeLabel,
      lifecycleState: state.lifecycle_state,
      approvedScope: "NONE",
      nextState: state,
    });
  }

  if (requestType === "PREMATURE_REPLACE") {
    return buildGateResponse({
      gate: "HOLD",
      mode: proposal.mode || "NONE",
      reason: "PREMATURE_REPLACE",
      activeAssetGroup: activeLabel,
      lifecycleState: state.lifecycle_state,
      approvedScope: "NONE",
      nextState: state,
    });
  }

  if (requestType === "BROAD_REPOSITORY_INSPECTION") {
    return buildGateResponse({
      gate: "HOLD",
      mode: proposal.mode || "NONE",
      reason: "BROAD_REPOSITORY_WORK",
      activeAssetGroup: activeLabel,
      lifecycleState: state.lifecycle_state,
      approvedScope: "NONE",
      nextState: state,
    });
  }

  if (
    requestType === "INSPECT_GROUP" ||
    requestType === "CLOSE_GROUP" ||
    requestType === "ACTIVATE_NEXT_GROUP" ||
    ["INSPECT", "CLOSE", "ACTIVATE"].includes(proposal.mode)
  ) {
    return buildGateResponse({
      gate: "HOLD",
      mode: proposal.mode || "NONE",
      reason: "LEGACY_PER_ASSET_FORENSIC_LIFECYCLE_RETIRED",
      activeAssetGroup: activeLabel,
      lifecycleState: state.lifecycle_state,
      approvedScope: "NONE",
      nextState: state,
    });
  }

  if (requestType === "CROSS_PHASE_DRIFT" || proposal.cross_phase_work === true) {
    return buildGateResponse({
      gate: "HOLD",
      mode: proposal.mode || "NONE",
      reason: "CROSS_PHASE_DRIFT",
      activeAssetGroup: activeLabel,
      lifecycleState: state.lifecycle_state,
      approvedScope: "NONE",
      nextState: state,
    });
  }

  if (proposal.mode === "CONTROL") {
    if (requestType !== "CONTROL_CENTER_MAINTENANCE") {
      return buildGateResponse({
        gate: "HOLD",
        mode: "CONTROL",
        reason: "CONTROL_REQUEST_TYPE_REQUIRED",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    if (proposal.owner_authorized !== true) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "CONTROL",
        reason: "OWNER_AUTHORIZATION_REQUIRED",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    if (proposal.proven_control_center_defect !== true) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "CONTROL",
        reason: "PROVEN_CONTROL_CENTER_DEFECT_REQUIRED",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    if (
      !listsMatchExactly(
        proposal.changed_files,
        CONTROL_CENTER_GATE_GROUP.asset_paths
      )
    ) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "CONTROL",
        reason: "CONTROL_SCOPE_MISMATCH",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    if (
      Array.isArray(proposal.product_asset_paths) &&
      proposal.product_asset_paths.length > 0
    ) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "CONTROL",
        reason: "PRODUCT_ASSET_CHANGE_BLOCKED",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    return buildGateResponse({
      gate: "GREEN",
      mode: "CONTROL",
      reason: "CONTROL_CENTER_MAINTENANCE_ACCEPTED",
      activeAssetGroup: activeLabel,
      lifecycleState: state.lifecycle_state,
      approvedScope: CONTROL_CENTER_GATE_GROUP.asset_paths.join(","),
      nextState: state,
    });
  }

  if (proposal.mode === "RECORD_FUTURE_PHASE_NOTE") {
    if (requestType !== "RECORD_FUTURE_PHASE_NOTE") {
      return buildGateResponse({
        gate: "HOLD",
        mode: "RECORD_FUTURE_PHASE_NOTE",
        reason: "FUTURE_PHASE_NOTE_REQUEST_TYPE_REQUIRED",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    const note = proposal.future_phase_note;
    if (
      !note ||
      typeof note !== "object" ||
      !note.asset_paths ||
      !Array.isArray(note.asset_paths) ||
      note.asset_paths.length === 0 ||
      !note.observed_issue ||
      !note.likely_future_phase
    ) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "RECORD_FUTURE_PHASE_NOTE",
        reason: "FUTURE_PHASE_NOTE_INCOMPLETE",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    if (note.likely_future_phase === state.active_phase) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "RECORD_FUTURE_PHASE_NOTE",
        reason: "FUTURE_PHASE_NOTE_MUST_TARGET_OTHER_PHASE",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    const nextState = {
      ...state,
      future_phase_notes: [
        ...(state.future_phase_notes || []),
        {
          asset_paths: [...note.asset_paths],
          observed_issue: String(note.observed_issue),
          likely_future_phase: String(note.likely_future_phase),
        },
      ],
    };

    return buildGateResponse({
      gate: "GREEN",
      mode: "RECORD_FUTURE_PHASE_NOTE",
      reason: "FUTURE_PHASE_NOTE_RECORDED",
      activeAssetGroup: activeLabel,
      lifecycleState: state.lifecycle_state,
      approvedScope: "FUTURE_PHASE_NOTE",
      nextState,
    });
  }

  if (proposal.mode === "PHASE_WORK") {
    if (requestType !== "PHASE_WORK") {
      return buildGateResponse({
        gate: "HOLD",
        mode: "PHASE_WORK",
        reason: "PHASE_WORK_REQUEST_TYPE_REQUIRED",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    if (proposal.phase !== state.active_phase) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "PHASE_WORK",
        reason: "CROSS_PHASE_DRIFT",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    if (
      state.active_phase === "PHASE_1" &&
      PHASE_1_FORBIDDEN_WORK.includes(proposal.work_kind)
    ) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "PHASE_WORK",
        reason: "PHASE_1_FORBIDDEN_WORK",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    if (
      state.active_phase === "PHASE_1" &&
      proposal.requires_full_forensic_evidence === true
    ) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "PHASE_WORK",
        reason: "PHASE_1_FULL_FORENSIC_EVIDENCE_NOT_REQUIRED",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    if (
      state.active_phase === "PHASE_3" &&
      !PHASE_3_ALLOWED_WORK.includes(proposal.work_kind)
    ) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "PHASE_WORK",
        reason: "PHASE_3_ACTIVE_USE_WORK_REQUIRED",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    const targetBatch =
      proposal.batch_id || state.active_batch || state.next_deterministic_batch;

    if (
      ["PHASE_1", "PHASE_2", "PHASE_3", "PHASE_4", "PHASE_5"].includes(
        state.active_phase
      )
    ) {
      if (!targetBatch || targetBatch !== state.next_deterministic_batch) {
        if (state.active_batch && targetBatch === state.active_batch) {
          // continue active batch
        } else {
          return buildGateResponse({
            gate: "HOLD",
            mode: "PHASE_WORK",
            reason: "BATCH_ORDER_VIOLATION",
            activeAssetGroup: activeLabel,
            lifecycleState: state.lifecycle_state,
            approvedScope: "NONE",
            nextState: state,
          });
        }
      }
    }

    const nextState = {
      ...state,
      lifecycle_state: targetBatch ? "BATCH_ACTIVE" : state.lifecycle_state,
      active_batch: targetBatch || state.active_batch,
    };

    return buildGateResponse({
      gate: "GREEN",
      mode: "PHASE_WORK",
      reason: "PHASE_WORK_ACCEPTED",
      activeAssetGroup: `${state.active_phase}:${nextState.active_batch || "NONE"}`,
      lifecycleState: state.lifecycle_state,
      approvedScope: `${state.active_phase}/${nextState.active_batch || "PHASE"}`,
      nextState,
    });
  }

  if (proposal.mode === "COMPLETE_BATCH") {
    if (requestType !== "COMPLETE_BATCH") {
      return buildGateResponse({
        gate: "HOLD",
        mode: "COMPLETE_BATCH",
        reason: "COMPLETE_BATCH_REQUEST_TYPE_REQUIRED",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    const batchId = proposal.batch_id || state.active_batch;
    if (!batchId || batchId !== (state.active_batch || state.next_deterministic_batch)) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "COMPLETE_BATCH",
        reason: "BATCH_MISMATCH",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    if (proposal.requires_full_forensic_lifecycle === true) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "COMPLETE_BATCH",
        reason: "FULL_FORENSIC_LIFECYCLE_NOT_REQUIRED_FOR_BATCH",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    const completed = [...new Set([...(state.completed_batches || []), batchId])];
    const remaining = (state.remaining_batches || []).filter((id) => id !== batchId);
    const nextState = {
      ...state,
      completed_batches: completed,
      remaining_batches: remaining,
      active_batch: null,
      next_deterministic_batch: remaining[0] || null,
      lifecycle_state: remaining.length === 0 ? "PHASE_READY_TO_CLOSE" : "BATCH_COMPLETE",
    };

    return buildGateResponse({
      gate: "GREEN",
      mode: "COMPLETE_BATCH",
      reason: "BATCH_COMPLETED",
      activeAssetGroup: `${state.active_phase}:${batchId}`,
      lifecycleState: state.lifecycle_state,
      approvedScope: `${state.active_phase}/${batchId}`,
      nextState,
    });
  }

  if (proposal.mode === "CLOSE_PHASE") {
    if (requestType !== "CLOSE_PHASE") {
      return buildGateResponse({
        gate: "HOLD",
        mode: "CLOSE_PHASE",
        reason: "CLOSE_PHASE_REQUEST_TYPE_REQUIRED",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    if (proposal.phase !== state.active_phase) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "CLOSE_PHASE",
        reason: "CROSS_PHASE_DRIFT",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    if (
      state.lifecycle_state !== "PHASE_READY_TO_CLOSE" &&
      !(
        Array.isArray(state.remaining_batches) &&
        state.remaining_batches.length === 0
      )
    ) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "CLOSE_PHASE",
        reason: "PHASE_NOT_READY_TO_CLOSE",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    const currentIndex = CLEANUP_PHASE_ORDER.indexOf(state.active_phase);
    const nextPhase =
      currentIndex >= 0 && currentIndex < CLEANUP_PHASE_ORDER.length - 1
        ? CLEANUP_PHASE_ORDER[currentIndex + 1]
        : null;

    if (proposal.activate_phase && proposal.activate_phase !== nextPhase) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "CLOSE_PHASE",
        reason: "PHASE_ORDER_VIOLATION",
        activeAssetGroup: activeLabel,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    const activationBatchState = nextPhase
      ? getPhaseActivationBatchState(nextPhase)
      : {
          completed_batches: [],
          remaining_batches: [],
          next_deterministic_batch: null,
        };
    const closedPhaseKey = `phase_${String(state.active_phase || "").replace("PHASE_", "")}`;

    const nextState = nextPhase
      ? {
          ...state,
          ...(Object.prototype.hasOwnProperty.call(state, closedPhaseKey)
            ? {
                [closedPhaseKey]: {
                  ...state[closedPhaseKey],
                  status: "PHASE_CLOSED",
                },
              }
            : {}),
          active_phase: nextPhase,
          active_phase_question: PHASE_QUESTIONS[nextPhase],
          lifecycle_state: "PHASE_ACTIVE",
          active_batch: null,
          ...activationBatchState,
        }
      : {
          ...state,
          ...(Object.prototype.hasOwnProperty.call(state, closedPhaseKey)
            ? {
                [closedPhaseKey]: {
                  ...state[closedPhaseKey],
                  status: "PHASE_CLOSED",
                },
              }
            : {}),
          lifecycle_state: "PHASE_CLOSED",
          active_batch: null,
          next_deterministic_batch: null,
        };

    return buildGateResponse({
      gate: "GREEN",
      mode: "CLOSE_PHASE",
      reason: nextPhase ? "PHASE_CLOSED_NEXT_ACTIVATED" : "PROGRAMME_CLOSED",
      activeAssetGroup: nextPhase || state.active_phase,
      lifecycleState: state.lifecycle_state,
      approvedScope: state.active_phase,
      nextState,
    });
  }

  return buildGateResponse({
    gate: "HOLD",
    mode: proposal.mode || "NONE",
    reason: "UNHANDLED_PROPOSAL",
    activeAssetGroup: activeLabel,
    lifecycleState: state.lifecycle_state,
    approvedScope: "NONE",
    nextState: state,
  });
}

function isDependencySatisfied(task) {
  return SATISFIED_STATUSES.has(task.status);
}

function getSatisfiedTaskIds(tasks) {
  return new Set(
    tasks
      .filter(isDependencySatisfied)
      .map((task) => task.task_id)
  );
}

function getStartableTasks(tasks) {
  const blockedIds = new Set(
    tasks
      .filter((task) => task.status === "BLOCKED")
      .map((task) => task.task_id)
  );

  const satisfiedIds = getSatisfiedTaskIds(tasks);

  return tasks.filter((task) => {
    if (task.startable === false) {
      return false;
    }

    if (!STARTABLE_STATUSES.has(task.status)) {
      return false;
    }

    const dependencies = task.blocked_by || [];

    if (
      dependencies.some(
        (dependencyId) =>
          blockedIds.has(dependencyId) ||
          !satisfiedIds.has(dependencyId)
      )
    ) {
      return false;
    }

    return true;
  });
}

function sortTasksByPriority(tasks) {
  const priorityOrder = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return [...tasks].sort((left, right) => {
    const leftPriority =
      priorityOrder[left.priority] ?? 9;
    const rightPriority =
      priorityOrder[right.priority] ?? 9;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.task_id.localeCompare(right.task_id);
  });
}

function getNextAllowedTask(tasks) {
  const startableTasks = getStartableTasks(tasks);

  if (startableTasks.length === 0) {
    return null;
  }

  return sortTasksByPriority(startableTasks)[0];
}

function getNextGatedTask(tasks) {
  const blockedIds = new Set(
    tasks
      .filter((task) => task.status === "BLOCKED")
      .map((task) => task.task_id)
  );

  const satisfiedIds = getSatisfiedTaskIds(tasks);

  const gatedTasks = tasks.filter((task) => {
    if (
      ![
        "NOT_STARTED",
        "PROPOSED",
        "PARTIAL",
        "IN_PROGRESS",
      ].includes(task.status)
    ) {
      return false;
    }

    if (task.startable === false) {
      return false;
    }

    if (SATISFIED_STATUSES.has(task.status)) {
      return false;
    }

    const dependencies = task.blocked_by || [];

    if (
      dependencies.some(
        (dependencyId) =>
          blockedIds.has(dependencyId) ||
          !satisfiedIds.has(dependencyId)
      )
    ) {
      return false;
    }

    return true;
  });

  if (gatedTasks.length === 0) {
    return null;
  }

  return sortTasksByPriority(gatedTasks)[0];
}

function getMarriageState(tasks, ledger) {
  const byId = new Map(
    tasks.map((task) => [task.task_id, task])
  );

  const incomplete = MARRIAGE_PREREQUISITES
    .map((taskId) => byId.get(taskId))
    .filter(
      (task) =>
        !task ||
        !SATISFIED_STATUSES.has(task.status)
    );

  const prerequisitesComplete =
    incomplete.length === 0;

  if (ledger.scout_edge_marriage_gate === "BLOCKED") {
    return {
      allowed: false,
      prerequisitesComplete,
      incomplete,
      reason:
        "scout_edge_marriage_gate_explicitly_blocked",
    };
  }

  return {
    allowed: prerequisitesComplete,
    prerequisitesComplete,
    incomplete,
    reason: prerequisitesComplete
      ? null
      : "marriage_prerequisites_incomplete",
  };
}

function listBlockedTasks(tasks) {
  return tasks.filter(
    (task) => task.status === "BLOCKED"
  );
}

function runCheck(options = {}) {
  const ledger = loadLedger(options.ledgerPath);
  const controlCenterDocument = readControlCenterDocument(
    options.controlCenterDocumentPath ||
      options.controlCenterPath
  );
  const policy = validateControlCenterPolicy(
    controlCenterDocument
  );
  const controlCenterState =
    policy.state || createControlCenterGateState();
  const proposal = normalizeProposal(
    options.proposal ??
      options.gateProposal ??
      options.proposalJson ??
      options.instructionText ??
      null
  );
  const gateDecision = evaluateControlCenterProposal(
    proposal,
    controlCenterState
  );

  const {
    errors,
    warnings,
    tasks,
  } = validateLedger(ledger);
  const combinedErrors = [...errors, ...policy.errors];

  const startable = getStartableTasks(tasks);
  const next = getNextAllowedTask(tasks);
  const gated = next
    ? null
    : getNextGatedTask(tasks);

  return {
    passed: combinedErrors.length === 0,
    ledger,
    errors: combinedErrors,
    warnings,
    tasks,
    blocked: listBlockedTasks(tasks),
    startable,
    next,
    gated,
    marriage: getMarriageState(tasks, ledger),
    controlCenterState,
    gateDecision,
    policy,
    proposal,
  };
}

function printReport(result) {
  const {
    passed,
    ledger,
    errors,
    warnings,
    blocked,
    startable,
    next,
    gated,
    marriage,
    gateDecision,
    controlCenterState,
  } = result;

  console.log(
    "=== SKCS Edge Control Center Check ==="
  );
  console.log(`Ledger version: ${ledger.version}`);
  console.log(`Tasks: ${ledger.tasks.length}`);
  console.log(
    `Generated: ${ledger.generated_at || "unknown"}`
  );
  console.log("");

  console.log("Architecture law:");
  console.log(
    "  Scout = governed sports truth provider"
  );
  console.log(
    "  Edge = analysis, prediction, publication, users and subscribers"
  );
  console.log(
    "  Neon and Supabase remain separate systems"
  );
  console.log("");

  console.log("Control Center cleanup programme state:");
  console.log(
    `  Active phase: ${controlCenterState.active_phase}`
  );
  console.log(
    `  Phase question: ${controlCenterState.active_phase_question}`
  );
  console.log(
    `  Lifecycle state: ${controlCenterState.lifecycle_state}`
  );
  console.log(
    `  Next batch: ${controlCenterState.next_deterministic_batch}`
  );
  console.log(
    `  Total governed assets: ${controlCenterState.total_governed_assets}`
  );
  console.log(
    `  Future phase notes: ${(controlCenterState.future_phase_notes || []).length}`
  );
  console.log("");

  console.log(`CONTROL CENTER GATE: ${gateDecision.gate}`);
  console.log(`MODE: ${gateDecision.mode}`);
  console.log(`REASON: ${gateDecision.reason}`);
  console.log(
    `ACTIVE PHASE/BATCH: ${gateDecision.activeAssetGroup}`
  );
  console.log(
    `LIFECYCLE STATE: ${gateDecision.lifecycleState}`
  );
  console.log(
    `APPROVED SCOPE: ${gateDecision.approvedScope}`
  );
  console.log("");

  if (errors.length > 0) {
    console.log("ERRORS:");

    for (const error of errors) {
      console.log(`  ✗ ${error}`);
    }

    console.log("");
  }

  if (warnings.length > 0) {
    console.log("WARNINGS:");

    for (const warning of warnings) {
      console.log(`  ! ${warning}`);
    }

    console.log("");
  }

  console.log(
    `Blocked tasks (${blocked.length}):`
  );

  if (blocked.length === 0) {
    console.log("  (none)");
  }

  for (const task of blocked) {
    console.log(
      `  - ${task.task_id} ${task.task_name} [${task.status}]`
    );
  }

  console.log("");

  console.log("Scout ↔ Edge marriage prerequisites:");

  if (marriage.prerequisitesComplete) {
    console.log(
      "  ✓ COMPLETE — all technical prerequisites satisfied"
    );
  } else {
    console.log(
      "  ✗ INCOMPLETE"
    );

    for (const task of marriage.incomplete) {
      if (!task) {
        continue;
      }

      console.log(
        `    - ${task.task_id} ${task.task_name} (${task.status})`
      );
    }
  }

  console.log("");

  console.log("Scout ↔ Edge marriage gate:");

  if (marriage.allowed) {
    console.log(
      "  ✓ APPROVED — governed Scout-to-Edge integration may proceed"
    );
  } else if (
    marriage.reason ===
    "scout_edge_marriage_gate_explicitly_blocked"
  ) {
    console.log(
      "  ✗ BLOCKED — explicit gate; separate approval required"
    );
    console.log(
      `    Gate status: ${ledger.scout_edge_marriage_gate}`
    );
  } else {
    console.log(
      "  ✗ BLOCKED — marriage prerequisites incomplete"
    );
  }

  console.log("");

  console.log("Supabase storage gate:");
  console.log(
    `  ${ledger.supabase_storage_gate === "APPROVED" ? "✓" : "✗"} ${ledger.supabase_storage_gate}`
  );
  console.log(
    "  FIP transport and permanent Supabase retention are separate decisions"
  );
  console.log("");

  console.log(
    `External provider removal: ${ledger.provider_removal_state}`
  );
  console.log("");

  console.log(
    `Startable tasks (${startable.length}):`
  );

  if (startable.length === 0) {
    console.log("  (none ready)");
  }

  for (const task of startable.slice(0, 10)) {
    console.log(
      `  → ${task.task_id} ${task.task_name} [${task.status}]`
    );
  }

  console.log("");

  console.log("Ledger sequencing (informational only):");

  if (next) {
    console.log(
      `  Current next sequenced task: ${next.task_id} — ${next.task_name}`
    );
    console.log(
      `  Next action: ${next.next_action}`
    );
  } else if (gated) {
    console.log(
      "  Current next sequenced task: (none — no auto-startable tasks)"
    );
    console.log(
      `  Current next gated task: ${gated.task_id} — ${gated.task_name} [${gated.status}]`
    );
    console.log(
      "  Requires separate approval before start"
    );

    if (gated.next_action) {
      console.log(`  Note: ${gated.next_action}`);
    }
  } else {
    console.log(
      "  Current next sequenced task: (none — resolve blockers or approve tasks first)"
    );
  }

  console.log("");

  console.log(
    passed ? "RESULT: PASS" : "RESULT: FAIL"
  );

  return passed;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let proposal = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--proposal-file") {
      const filePath = args[index + 1];
      if (filePath) {
        proposal = loadJson(filePath);
      }
      index += 1;
      continue;
    }

    if (arg.startsWith("--proposal-file=")) {
      proposal = loadJson(arg.slice("--proposal-file=".length));
      continue;
    }

    if (arg === "--proposal-json") {
      const valueParts = [];
      let cursor = index + 1;

      while (cursor < args.length && !args[cursor].startsWith("--")) {
        valueParts.push(args[cursor]);
        cursor += 1;
      }

      const raw = valueParts.join(" ");
      proposal = raw ? JSON.parse(raw) : null;
      index = cursor - 1;
      continue;
    }

    if (arg.startsWith("--proposal-json=")) {
      proposal = JSON.parse(arg.slice("--proposal-json=".length));
    }
  }

  const result = runCheck({
    proposal,
  });
  const passed = printReport(result);

  process.exit(passed ? 0 : 1);
}

module.exports = {
  ALLOWED_STATUSES,
  ALLOWED_GATE_STATUSES,
  LEDGER_PATH,
  CONTROL_CENTER_PATH: CONTROL_CENTER_DOCUMENT_PATH,
  MARRIAGE_PREREQUISITES,
  ASSET_REGISTER_PATH,
  CONTROL_CENTER_DOCUMENT_PATH,
  CONTROL_CENTER_GATE_GROUP,
  BATCH_MANIFEST_PATH,
  BATCH_MANIFEST_RELATIVE_PATH,
  CLEANUP_PHASE_ORDER,
  PHASE_QUESTIONS,
  PHASE_1_FORBIDDEN_WORK,
  EAC_BATCH_IDS,
  REQUIRED_LIFECYCLE_STATES,
  REQUIRED_EXECUTION_MODES,
  RECOGNIZED_REQUEST_TYPES,
  REQUIRED_EVIDENCE_KEYS,
  ALLOWED_DISPOSITIONS,
  SATISFIED_STATUSES,
  loadLedger,
  loadAssetRegister,
  loadBatchManifest,
  loadControlCenterDocument: readControlCenterDocument,
  readControlCenterDocument,
  getTotalGovernedAssets,
  getGovernedAssetPaths,
  getEacBatchIds,
  getNextIncompleteBatch,
  createControlCenterGateState,
  parseControlCenterStateDocument,
  normalizeFileList,
  listsMatchExactly,
  isSubsetOfList,
  getClosedAssetPaths,
  getNextGovernedAssetGroup,
  isEvidenceComplete,
  normalizeProposal,
  validateLedger,
  validateControlCenterPolicy,
  isDependencySatisfied,
  getSatisfiedTaskIds,
  getStartableTasks,
  getNextAllowedTask,
  getNextGatedTask,
  getMarriageState,
  listBlockedTasks,
  isExactGroupMatch,
  buildGateResponse,
  evaluateControlCenterProposal,
  buildInstructionGateResult: evaluateControlCenterProposal,
  runCheck,
};
