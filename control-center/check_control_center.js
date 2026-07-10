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

const CONTROL_CENTER_GATE_GROUP = Object.freeze({
  group_id: "control-center-gate-group",
  asset_paths: Object.freeze([
    "control-center/EDGE_CONTROL_CENTER.md",
    "control-center/check_control_center.js",
    "tests/edge-control-center-ledger.test.js",
  ]),
});

const REQUIRED_LIFECYCLE_STATES = Object.freeze([
  "PENDING",
  "INSPECTING",
  "DISPOSITION_READY",
  "CLOSURE_READY",
  "CLOSED",
]);

const REQUIRED_EXECUTION_MODES = Object.freeze([
  "INSPECT",
  "CLOSE",
]);

const RECOGNIZED_REQUEST_TYPES = Object.freeze([
  "INSPECT_GROUP",
  "CLOSE_GROUP",
  "FEATURE_WORK",
  "GOVERNANCE_CLEANUP",
  "PREMATURE_DELETE",
  "PREMATURE_MERGE",
  "PREMATURE_REPLACE",
  "BROAD_REPOSITORY_INSPECTION",
  "NO_INSTRUCTION",
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

function createControlCenterGateState(overrides = {}) {
  const assetRegister = loadAssetRegister();
  const totalGovernedAssets = getTotalGovernedAssets(assetRegister);
  const baseState = {
    active_asset_group: {
      group_id: CONTROL_CENTER_GATE_GROUP.group_id,
      asset_paths: [...CONTROL_CENTER_GATE_GROUP.asset_paths],
    },
    lifecycle_state: "PENDING",
    evidence_completion: {
      contents_and_purpose: false,
      references_and_consumers: false,
      runtime_use: false,
      dependencies: false,
      overlap_or_duplication: false,
    },
    disposition: null,
    closure_status: "OPEN",
    total_governed_assets: totalGovernedAssets,
    investigated_assets: 0,
    closed_assets: 0,
    remaining_assets: totalGovernedAssets,
    required_closure_files: [...CONTROL_CENTER_GATE_GROUP.asset_paths],
    inspected_groups: [],
    closed_groups: [],
  };

  return {
    ...baseState,
    ...overrides,
    active_asset_group: {
      ...baseState.active_asset_group,
      ...(overrides.active_asset_group || {}),
      asset_paths: Array.isArray(
        overrides.active_asset_group?.asset_paths
      )
        ? [...overrides.active_asset_group.asset_paths]
        : [...baseState.active_asset_group.asset_paths],
    },
    evidence_completion: {
      ...baseState.evidence_completion,
      ...(overrides.evidence_completion || {}),
    },
    required_closure_files: Array.isArray(
      overrides.required_closure_files
    )
      ? [...overrides.required_closure_files]
      : [...baseState.required_closure_files],
    inspected_groups: Array.isArray(overrides.inspected_groups)
      ? [...overrides.inspected_groups]
      : [],
    closed_groups: Array.isArray(overrides.closed_groups)
      ? [...overrides.closed_groups]
      : [],
  };
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
    !listsMatchExactly(
      activeGroup.asset_paths,
      CONTROL_CENTER_GATE_GROUP.asset_paths
    )
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
      CONTROL_CENTER_GATE_GROUP.asset_paths
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

function evaluateControlCenterProposal(
  proposalInput,
  stateInput = createControlCenterGateState()
) {
  const proposal = normalizeProposal(proposalInput);
  const state = stateInput || createControlCenterGateState();

  if (
    !proposal ||
    !state ||
    !state.active_asset_group ||
    !state.lifecycle_state
  ) {
    return buildGateResponse({
      gate: "HOLD",
      mode: proposal?.mode || "NONE",
      reason: "MISSING_INSTRUCTION_OR_STATE",
      activeAssetGroup: state?.active_asset_group?.group_id || "NONE",
      lifecycleState: state?.lifecycle_state || "NONE",
      approvedScope: "NONE",
      nextState: state || null,
    });
  }

  const requestType = proposal.request_type || "NO_INSTRUCTION";

  if (!RECOGNIZED_REQUEST_TYPES.includes(requestType)) {
    return buildGateResponse({
      gate: "HOLD",
      mode: proposal.mode || "NONE",
      reason: "UNRECOGNIZED_REQUEST_TYPE",
      activeAssetGroup: state.active_asset_group.group_id,
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
      activeAssetGroup: state.active_asset_group.group_id,
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
      activeAssetGroup: state.active_asset_group.group_id,
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
      activeAssetGroup: state.active_asset_group.group_id,
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
      activeAssetGroup: state.active_asset_group.group_id,
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
      activeAssetGroup: state.active_asset_group.group_id,
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
      activeAssetGroup: state.active_asset_group.group_id,
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
      activeAssetGroup: state.active_asset_group.group_id,
      lifecycleState: state.lifecycle_state,
      approvedScope: "NONE",
      nextState: state,
    });
  }

  const proposalGroup = proposal.active_asset_group;

  if (
    !proposalGroup ||
    typeof proposalGroup !== "object" ||
    typeof proposalGroup.group_id !== "string" ||
    proposalGroup.group_id.trim() === "" ||
    !Array.isArray(proposalGroup.asset_paths)
  ) {
    return buildGateResponse({
      gate: "HOLD",
      mode: proposal.mode || "NONE",
      reason: "MISSING_ACTIVE_GROUP",
      activeAssetGroup: state.active_asset_group.group_id,
      lifecycleState: state.lifecycle_state,
      approvedScope: "NONE",
      nextState: state,
    });
  }

  const exactGroupMatch = isExactGroupMatch(
    proposalGroup,
    state.active_asset_group
  );

  if (!exactGroupMatch) {
    return buildGateResponse({
      gate: "HOLD",
      mode: proposal.mode || "NONE",
      reason: "ACTIVE_GROUP_MISMATCH",
      activeAssetGroup: state.active_asset_group.group_id,
      lifecycleState: state.lifecycle_state,
      approvedScope: "NONE",
      nextState: state,
    });
  }

  if (!proposal.preserves_unrelated_changes) {
    return buildGateResponse({
      gate: "HOLD",
      mode: proposal.mode || "NONE",
      reason: "UNRELATED_CHANGES_NOT_PRESERVED",
      activeAssetGroup: state.active_asset_group.group_id,
      lifecycleState: state.lifecycle_state,
      approvedScope: "NONE",
      nextState: state,
    });
  }

  if (proposal.mode === "INSPECT") {
    if (proposal.inspection_only !== true) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "INSPECT",
        reason: "INSPECTION_ONLY_REQUIRED",
        activeAssetGroup: state.active_asset_group.group_id,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    if (state.lifecycle_state === "CLOSED") {
      return buildGateResponse({
        gate: "HOLD",
        mode: "INSPECT",
        reason: "GROUP_ALREADY_CLOSED",
        activeAssetGroup: state.active_asset_group.group_id,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    if (
      !["PENDING", "INSPECTING"].includes(state.lifecycle_state)
    ) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "INSPECT",
        reason: "INSPECT_MISALIGNED_WITH_LIFECYCLE",
        activeAssetGroup: state.active_asset_group.group_id,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    const nextState = {
      ...state,
      lifecycle_state: "INSPECTING",
      investigated_assets:
        Number(state.investigated_assets) +
        state.active_asset_group.asset_paths.length,
      remaining_assets:
        Number(state.total_governed_assets) -
        (Number(state.investigated_assets) +
          state.active_asset_group.asset_paths.length),
      inspected_groups: [
        ...state.inspected_groups,
        state.active_asset_group.group_id,
      ],
    };

    return buildGateResponse({
      gate: "GREEN",
      mode: "INSPECT",
      reason: "INSPECTION_ACCEPTED",
      activeAssetGroup: state.active_asset_group.group_id,
      lifecycleState: state.lifecycle_state,
      approvedScope:
        "Inspect only the exact active asset group and capture contents, purpose, references, consumers, runtime use, dependencies, overlap, and reuse evidence.",
      nextState,
    });
  }

  if (proposal.mode === "CLOSE") {
    if (
      state.lifecycle_state !== "DISPOSITION_READY" &&
      state.lifecycle_state !== "CLOSURE_READY"
    ) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "CLOSE",
        reason: "CLOSURE_EVIDENCE_INCOMPLETE",
        activeAssetGroup: state.active_asset_group.group_id,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    if (!isEvidenceComplete(proposal.evidence_completion)) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "CLOSE",
        reason: "CLOSURE_EVIDENCE_INCOMPLETE",
        activeAssetGroup: state.active_asset_group.group_id,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    if (
      !proposal.disposition ||
      !ALLOWED_DISPOSITIONS.includes(proposal.disposition)
    ) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "CLOSE",
        reason: "MISSING_DISPOSITION",
        activeAssetGroup: state.active_asset_group.group_id,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    if (
      !listsMatchExactly(
        proposal.changed_files,
        state.required_closure_files
      )
    ) {
      return buildGateResponse({
        gate: "HOLD",
        mode: "CLOSE",
        reason: "CLOSURE_SCOPE_MISMATCH",
        activeAssetGroup: state.active_asset_group.group_id,
        lifecycleState: state.lifecycle_state,
        approvedScope: "NONE",
        nextState: state,
      });
    }

    const nextState = {
      ...state,
      lifecycle_state: "CLOSED",
      closure_status: "CLOSED",
      disposition: proposal.disposition,
      closed_assets:
        Number(state.closed_assets) +
        state.active_asset_group.asset_paths.length,
      remaining_assets:
        Number(state.total_governed_assets) -
        (Number(state.investigated_assets) ||
          state.active_asset_group.asset_paths.length),
      closed_groups: [
        ...state.closed_groups,
        state.active_asset_group.group_id,
      ],
    };

    return buildGateResponse({
      gate: "GREEN",
      mode: "CLOSE",
      reason: "CLOSURE_ACCEPTED",
      activeAssetGroup: state.active_asset_group.group_id,
      lifecycleState: state.lifecycle_state,
      approvedScope:
        "Close only the exact previously inspected group and the required Control Center projection files.",
      nextState,
    });
  }

  return buildGateResponse({
    gate: "HOLD",
    mode: proposal.mode || "NONE",
    reason: "UNSUPPORTED_MODE",
    activeAssetGroup: state.active_asset_group.group_id,
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

  console.log("Control Center investigation state:");
  console.log(
    `  Lifecycle state: ${controlCenterState.lifecycle_state}`
  );
  console.log(
    `  Active asset/group: ${controlCenterState.active_asset_group.group_id}`
  );
  console.log(
    `  Total governed assets: ${controlCenterState.total_governed_assets}`
  );
  console.log(
    `  Investigated assets: ${controlCenterState.investigated_assets}`
  );
  console.log(
    `  Closed assets: ${controlCenterState.closed_assets}`
  );
  console.log(
    `  Remaining assets: ${controlCenterState.remaining_assets}`
  );
  console.log("");

  console.log(`CONTROL CENTER GATE: ${gateDecision.gate}`);
  console.log(`MODE: ${gateDecision.mode}`);
  console.log(`REASON: ${gateDecision.reason}`);
  console.log(
    `ACTIVE ASSET/GROUP: ${gateDecision.activeAssetGroup}`
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
  REQUIRED_LIFECYCLE_STATES,
  REQUIRED_EXECUTION_MODES,
  RECOGNIZED_REQUEST_TYPES,
  REQUIRED_EVIDENCE_KEYS,
  ALLOWED_DISPOSITIONS,
  SATISFIED_STATUSES,
  loadLedger,
  loadAssetRegister,
  loadControlCenterDocument: readControlCenterDocument,
  readControlCenterDocument,
  getTotalGovernedAssets,
  createControlCenterGateState,
  parseControlCenterStateDocument,
  normalizeFileList,
  listsMatchExactly,
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
