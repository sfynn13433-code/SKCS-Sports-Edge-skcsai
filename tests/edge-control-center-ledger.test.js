"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  ALLOWED_STATUSES,
  CONTROL_CENTER_PATH,
  CONTROL_CENTER_GATE_GROUP,
  createControlCenterGateState,
  getNextGovernedAssetGroup,
  LEDGER_PATH,
  MARRIAGE_PREREQUISITES,
  evaluateControlCenterProposal,
  loadControlCenterDocument,
  loadLedger,
  validateLedger,
  validateControlCenterPolicy,
  getMarriageState,
  runCheck,
} = require(
  "../control-center/check_control_center.js"
);

function buildGroupProposal(overrides = {}) {
  return {
    request_type: "INSPECT_GROUP",
    mode: "INSPECT",
    inspection_only: true,
    preserves_unrelated_changes: true,
    scope_kind: "EXACT_GROUP",
    active_asset_group: {
      group_id: CONTROL_CENTER_GATE_GROUP.group_id,
      asset_paths: [...CONTROL_CENTER_GATE_GROUP.asset_paths],
    },
    ...overrides,
  };
}

function buildCloseProposal(overrides = {}) {
  return {
    request_type: "CLOSE_GROUP",
    mode: "CLOSE",
    preserves_unrelated_changes: true,
    changed_files: [...CONTROL_CENTER_GATE_GROUP.asset_paths],
    active_asset_group: {
      group_id: CONTROL_CENTER_GATE_GROUP.group_id,
      asset_paths: [...CONTROL_CENTER_GATE_GROUP.asset_paths],
    },
    evidence_completion: {
      contents_and_purpose: true,
      references_and_consumers: true,
      runtime_use: true,
      dependencies: true,
      overlap_or_duplication: true,
    },
    disposition: "USE",
    ...overrides,
  };
}

function buildControlProposal(overrides = {}) {
  return {
    request_type: "CONTROL_CENTER_MAINTENANCE",
    mode: "CONTROL",
    owner_authorized: true,
    proven_control_center_defect: true,
    changed_files: [...CONTROL_CENTER_GATE_GROUP.asset_paths],
    product_asset_paths: [],
    ...overrides,
  };
}

function buildActivateProposal(overrides = {}) {
  return {
    request_type: "ACTIVATE_NEXT_GROUP",
    mode: "ACTIVATE",
    preserves_unrelated_changes: true,
    ...overrides,
  };
}

describe("Edge Control Center Ledger v1", () => {
  it("loads valid Edge ledger JSON", () => {
    const ledger = loadLedger();

    assert.equal(ledger.version, "1.0");
    assert.equal(
      ledger.title,
      "SKCS Edge Build Control Ledger"
    );
    assert.ok(Array.isArray(ledger.tasks));
    assert.ok(ledger.tasks.length >= 14);
  });

  it("documents the closed investigation state snapshot", () => {
    const documentText = loadControlCenterDocument();
    const result = validateControlCenterPolicy(documentText);

    assert.equal(result.errors.length, 0);
    assert.equal(CONTROL_CENTER_PATH.endsWith("EDGE_CONTROL_CENTER.md"), true);
    assert.ok(result.state);
    assert.deepEqual(
      result.state.required_modes,
      ["INSPECT", "CLOSE", "CONTROL", "ACTIVATE"]
    );
    assert.deepEqual(
      result.state.required_lifecycle,
      [
        "PENDING",
        "INSPECTING",
        "DISPOSITION_READY",
        "CLOSURE_READY",
        "CLOSED",
      ]
    );
    assert.equal(
      result.state.active_asset_group.group_id,
      CONTROL_CENTER_GATE_GROUP.group_id
    );
    assert.deepEqual(
      result.state.active_asset_group.asset_paths,
      CONTROL_CENTER_GATE_GROUP.asset_paths
    );
    assert.equal(result.state.lifecycle_state, "CLOSED");
    assert.equal(result.state.disposition, "USE");
    assert.equal(result.state.closure_status, "CLOSED");
    assert.equal(result.state.investigated_assets, 3);
    assert.equal(result.state.closed_assets, 3);
    assert.equal(result.state.remaining_assets, 903);
    assert.deepEqual(
      result.state.evidence_completion,
      {
        contents_and_purpose: true,
        references_and_consumers: true,
        runtime_use: true,
        dependencies: true,
        overlap_or_duplication: true,
      }
    );
    assert.deepEqual(result.state.inspected_groups, [
      CONTROL_CENTER_GATE_GROUP.group_id,
    ]);
    assert.deepEqual(result.state.closed_groups, [
      CONTROL_CENTER_GATE_GROUP.group_id,
    ]);
    assert.deepEqual(
      result.state.closed_asset_paths,
      CONTROL_CENTER_GATE_GROUP.asset_paths
    );
    assert.equal(result.state.total_governed_assets, 906);
  });

  it("every task has a unique task_id and allowed status", () => {
    const { tasks } = loadLedger();
    const ids = new Set();

    for (const task of tasks) {
      assert.ok(task.task_id, "task_id required");
      assert.ok(
        !ids.has(task.task_id),
        `duplicate ${task.task_id}`
      );

      ids.add(task.task_id);

      assert.ok(
        ALLOWED_STATUSES.includes(task.status),
        `${task.task_id} status ${task.status}`
      );
    }
  });

  it("every task has completion proof and next action", () => {
    const { tasks } = loadLedger();

    for (const task of tasks) {
      assert.ok(
        task.completion_definition &&
          String(task.completion_definition).trim(),
        `${task.task_id} missing completion_definition`
      );

      assert.ok(
        Array.isArray(task.proof_required) &&
          task.proof_required.length > 0,
        `${task.task_id} missing proof_required`
      );

      assert.ok(
        task.next_action &&
          String(task.next_action).trim(),
        `${task.task_id} missing next_action`
      );
    }
  });

  it("DONE tasks have current evidence", () => {
    const { tasks } = loadLedger();

    for (const task of tasks.filter(
      (item) => item.status === "DONE"
    )) {
      assert.ok(
        Array.isArray(task.current_evidence) &&
          task.current_evidence.length > 0,
        `${task.task_id} DONE without current_evidence`
      );
    }
  });

  it("BLOCKED tasks have explicit dependencies", () => {
    const { tasks } = loadLedger();

    for (const task of tasks.filter(
      (item) => item.status === "BLOCKED"
    )) {
      assert.ok(
        Array.isArray(task.blocked_by) &&
          task.blocked_by.length > 0,
        `${task.task_id} BLOCKED without blocked_by`
      );
    }
  });

  it("all blocked_by dependencies resolve", () => {
    const { tasks } = loadLedger();
    const ids = new Set(
      tasks.map((task) => task.task_id)
    );

    for (const task of tasks) {
      for (const dependencyId of task.blocked_by || []) {
        assert.ok(
          ids.has(dependencyId),
          `${task.task_id} unknown dependency ${dependencyId}`
        );
      }
    }
  });

  it("ledger validation passes", () => {
    const ledger = loadLedger();
    const result = validateLedger(ledger);

    assert.deepEqual(result.errors, []);
  });

  it("runCheck without a proposal defaults the gate to HOLD", () => {
    const result = runCheck({
      ledgerPath: LEDGER_PATH,
      controlCenterPath: CONTROL_CENTER_PATH,
    });

    assert.equal(result.passed, true);
    assert.deepEqual(result.policy.errors, []);
    assert.equal(result.gateDecision.gate, "HOLD");
    assert.equal(
      result.gateDecision.reason,
      "MISSING_INSTRUCTION_OR_STATE"
    );
  });

  it("no instruction or state defaults to HOLD", () => {
    const result = evaluateControlCenterProposal(null, null);

    assert.equal(result.gate, "HOLD");
    assert.equal(result.reason, "MISSING_INSTRUCTION_OR_STATE");
  });

  it("exact asset inspection is GREEN", () => {
    const state = createControlCenterGateState();
    const result = evaluateControlCenterProposal(
      buildGroupProposal(),
      state
    );

    assert.equal(result.gate, "GREEN");
    assert.equal(result.mode, "INSPECT");
    assert.equal(result.reason, "INSPECTION_ACCEPTED");
    assert.equal(
      result.activeAssetGroup,
      CONTROL_CENTER_GATE_GROUP.group_id
    );
    assert.equal(result.lifecycleState, "PENDING");
    assert.equal(result.nextState.lifecycle_state, "INSPECTING");
  });

  it("broad repository inspection is HOLD", () => {
    const result = evaluateControlCenterProposal(
      buildGroupProposal({
        request_type: "BROAD_REPOSITORY_INSPECTION",
        scope_kind: "BROAD_REPOSITORY",
      }),
      createControlCenterGateState()
    );

    assert.equal(result.gate, "HOLD");
    assert.equal(result.reason, "BROAD_REPOSITORY_WORK");
  });

  it("no explicit inspected group is HOLD", () => {
    const result = evaluateControlCenterProposal(
      {
        request_type: "INSPECT_GROUP",
        mode: "INSPECT",
        inspection_only: true,
        preserves_unrelated_changes: true,
      },
      createControlCenterGateState()
    );

    assert.equal(result.gate, "HOLD");
    assert.equal(result.reason, "MISSING_ACTIVE_GROUP");
  });

  it("premature deletion is HOLD", () => {
    const result = evaluateControlCenterProposal(
      {
        request_type: "PREMATURE_DELETE",
        mode: "CLOSE",
        active_asset_group: {
          group_id: CONTROL_CENTER_GATE_GROUP.group_id,
          asset_paths: [...CONTROL_CENTER_GATE_GROUP.asset_paths],
        },
        preserves_unrelated_changes: true,
      },
      createControlCenterGateState()
    );

    assert.equal(result.gate, "HOLD");
    assert.equal(result.reason, "PREMATURE_DELETE");
  });

  it("premature merge is HOLD", () => {
    const result = evaluateControlCenterProposal(
      {
        request_type: "PREMATURE_MERGE",
        mode: "CLOSE",
        active_asset_group: {
          group_id: CONTROL_CENTER_GATE_GROUP.group_id,
          asset_paths: [...CONTROL_CENTER_GATE_GROUP.asset_paths],
        },
        preserves_unrelated_changes: true,
      },
      createControlCenterGateState()
    );

    assert.equal(result.gate, "HOLD");
    assert.equal(result.reason, "PREMATURE_MERGE");
  });

  it("feature work is HOLD", () => {
    const result = evaluateControlCenterProposal(
      {
        request_type: "FEATURE_WORK",
        mode: "INSPECT",
      },
      createControlCenterGateState()
    );

    assert.equal(result.gate, "HOLD");
    assert.equal(result.reason, "FEATURE_WORK");
  });

  it("inspected group with incomplete evidence CLOSE is HOLD", () => {
    const state = createControlCenterGateState({
      lifecycle_state: "CLOSURE_READY",
      evidence_completion: {
        contents_and_purpose: true,
        references_and_consumers: true,
        runtime_use: true,
        dependencies: true,
        overlap_or_duplication: true,
      },
      investigated_assets:
        CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      remaining_assets: 906 - CONTROL_CENTER_GATE_GROUP.asset_paths.length,
    });

    const result = evaluateControlCenterProposal(
      buildCloseProposal({
        evidence_completion: {
          contents_and_purpose: true,
          references_and_consumers: false,
          runtime_use: true,
          dependencies: true,
          overlap_or_duplication: true,
        },
      }),
      state
    );

    assert.equal(result.gate, "HOLD");
    assert.equal(result.reason, "CLOSURE_EVIDENCE_INCOMPLETE");
  });

  it("fully investigated group with disposition CLOSE is GREEN", () => {
    const state = createControlCenterGateState({
      lifecycle_state: "CLOSURE_READY",
      evidence_completion: {
        contents_and_purpose: true,
        references_and_consumers: true,
        runtime_use: true,
        dependencies: true,
        overlap_or_duplication: true,
      },
      investigated_assets:
        CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      remaining_assets: 906 - CONTROL_CENTER_GATE_GROUP.asset_paths.length,
    });

    const result = evaluateControlCenterProposal(
      buildCloseProposal(),
      state
    );

    assert.equal(result.gate, "GREEN");
    assert.equal(result.mode, "CLOSE");
    assert.equal(result.reason, "CLOSURE_ACCEPTED");
    assert.equal(result.nextState.lifecycle_state, "CLOSED");
  });

  it("closure containing unrelated files is HOLD", () => {
    const state = createControlCenterGateState({
      lifecycle_state: "CLOSURE_READY",
      evidence_completion: {
        contents_and_purpose: true,
        references_and_consumers: true,
        runtime_use: true,
        dependencies: true,
        overlap_or_duplication: true,
      },
      investigated_assets:
        CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      remaining_assets: 906 - CONTROL_CENTER_GATE_GROUP.asset_paths.length,
    });

    const result = evaluateControlCenterProposal(
      buildCloseProposal({
        changed_files: [
          ...CONTROL_CENTER_GATE_GROUP.asset_paths,
          "public/unrelated-file.txt",
        ],
      }),
      state
    );

    assert.equal(result.gate, "HOLD");
    assert.equal(result.reason, "CLOSURE_SCOPE_MISMATCH");
  });

  it("closed group cannot be silently reopened", () => {
    const state = createControlCenterGateState({
      lifecycle_state: "CLOSED",
      closure_status: "CLOSED",
      evidence_completion: {
        contents_and_purpose: true,
        references_and_consumers: true,
        runtime_use: true,
        dependencies: true,
        overlap_or_duplication: true,
      },
      disposition: "USE",
      investigated_assets:
        CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      closed_assets: CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      remaining_assets: 906 - CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      inspected_groups: [CONTROL_CENTER_GATE_GROUP.group_id],
      closed_groups: [CONTROL_CENTER_GATE_GROUP.group_id],
    });

    const result = evaluateControlCenterProposal(
      buildGroupProposal(),
      state
    );

    assert.equal(result.gate, "HOLD");
    assert.equal(result.reason, "GROUP_ALREADY_CLOSED");
  });

  it("next asset cannot start before current group closes", () => {
    const state = createControlCenterGateState({
      lifecycle_state: "INSPECTING",
      evidence_completion: {
        contents_and_purpose: true,
        references_and_consumers: false,
        runtime_use: false,
        dependencies: false,
        overlap_or_duplication: false,
      },
      investigated_assets:
        CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      remaining_assets: 906 - CONTROL_CENTER_GATE_GROUP.asset_paths.length,
    });

    const result = evaluateControlCenterProposal(
      {
        request_type: "INSPECT_GROUP",
        mode: "INSPECT",
        inspection_only: true,
        preserves_unrelated_changes: true,
        scope_kind: "EXACT_GROUP",
        active_asset_group: {
          group_id: "next-group",
          asset_paths: ["control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json"],
        },
      },
      state
    );

    assert.equal(result.gate, "HOLD");
    assert.equal(result.reason, "ACTIVE_GROUP_MISMATCH");
  });

  it("closed group plus ACTIVATE is GREEN", () => {
    const state = createControlCenterGateState({
      lifecycle_state: "CLOSED",
      closure_status: "CLOSED",
      evidence_completion: {
        contents_and_purpose: true,
        references_and_consumers: true,
        runtime_use: true,
        dependencies: true,
        overlap_or_duplication: true,
      },
      disposition: "USE",
      investigated_assets:
        CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      closed_assets: CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      remaining_assets: 906 - CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      inspected_groups: [CONTROL_CENTER_GATE_GROUP.group_id],
      closed_groups: [CONTROL_CENTER_GATE_GROUP.group_id],
      closed_asset_paths: [...CONTROL_CENTER_GATE_GROUP.asset_paths],
    });

    const result = evaluateControlCenterProposal(
      buildActivateProposal(),
      state
    );

    assert.equal(result.gate, "GREEN");
    assert.equal(result.mode, "ACTIVATE");
    assert.equal(result.reason, "NEXT_GROUP_ACTIVATED");
  });

  it("open group plus ACTIVATE is HOLD", () => {
    const state = createControlCenterGateState({
      lifecycle_state: "INSPECTING",
      closure_status: "OPEN",
    });

    const result = evaluateControlCenterProposal(
      buildActivateProposal(),
      state
    );

    assert.equal(result.gate, "HOLD");
    assert.equal(result.reason, "OPEN_GROUP_MUST_CLOSE_FIRST");
  });

  it("already-closed asset cannot reactivate", () => {
    const state = createControlCenterGateState({
      lifecycle_state: "CLOSED",
      closure_status: "CLOSED",
      investigated_assets:
        CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      closed_assets: CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      remaining_assets: 906 - CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      closed_asset_paths: [...CONTROL_CENTER_GATE_GROUP.asset_paths],
    });

    const result = evaluateControlCenterProposal(
      buildActivateProposal({
        next_active_group: {
          group_id: CONTROL_CENTER_GATE_GROUP.group_id,
          asset_paths: [...CONTROL_CENTER_GATE_GROUP.asset_paths],
        },
      }),
      state
    );

    assert.equal(result.gate, "HOLD");
    assert.equal(result.reason, "NEXT_GROUP_MISMATCH");
  });

  it("deterministic next governed asset is selected", () => {
    const state = createControlCenterGateState({
      lifecycle_state: "CLOSED",
      closure_status: "CLOSED",
      investigated_assets:
        CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      closed_assets: CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      remaining_assets: 906 - CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      closed_asset_paths: [...CONTROL_CENTER_GATE_GROUP.asset_paths],
    });

    const expectedNextGroup = getNextGovernedAssetGroup(state);
    const result = evaluateControlCenterProposal(
      buildActivateProposal(),
      state
    );

    assert.deepEqual(result.nextState.active_asset_group, expectedNextGroup);
    assert.deepEqual(expectedNextGroup, {
      group_id: ".bat",
      asset_paths: [".bat"],
    });
  });

  it("new group enters PENDING", () => {
    const state = createControlCenterGateState({
      lifecycle_state: "CLOSED",
      closure_status: "CLOSED",
      investigated_assets:
        CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      closed_assets: CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      remaining_assets: 906 - CONTROL_CENTER_GATE_GROUP.asset_paths.length,
      closed_asset_paths: [...CONTROL_CENTER_GATE_GROUP.asset_paths],
    });

    const result = evaluateControlCenterProposal(
      buildActivateProposal(),
      state
    );

    assert.equal(result.nextState.lifecycle_state, "PENDING");
    assert.equal(result.nextState.closure_status, "OPEN");
    assert.equal(result.nextState.disposition, null);
    assert.deepEqual(result.nextState.evidence_completion, {
      contents_and_purpose: false,
      references_and_consumers: false,
      runtime_use: false,
      dependencies: false,
      overlap_or_duplication: false,
    });
  });

  it("CONTROL without owner authorization is HOLD", () => {
    const result = evaluateControlCenterProposal(
      buildControlProposal({ owner_authorized: false }),
      createControlCenterGateState()
    );

    assert.equal(result.gate, "HOLD");
    assert.equal(result.reason, "OWNER_AUTHORIZATION_REQUIRED");
  });

  it("CONTROL without proven defect is HOLD", () => {
    const result = evaluateControlCenterProposal(
      buildControlProposal({ proven_control_center_defect: false }),
      createControlCenterGateState()
    );

    assert.equal(result.gate, "HOLD");
    assert.equal(result.reason, "PROVEN_CONTROL_CENTER_DEFECT_REQUIRED");
  });

  it("CONTROL touching product files is HOLD", () => {
    const result = evaluateControlCenterProposal(
      buildControlProposal({
        changed_files: [
          ...CONTROL_CENTER_GATE_GROUP.asset_paths,
          "backend/server-express.js",
        ],
        product_asset_paths: ["backend/server-express.js"],
      }),
      createControlCenterGateState()
    );

    assert.equal(result.gate, "HOLD");
    assert.equal(result.reason, "CONTROL_SCOPE_MISMATCH");
  });

  it("proven owner-authorized Control Center defect is GREEN", () => {
    const result = evaluateControlCenterProposal(
      buildControlProposal(),
      createControlCenterGateState()
    );

    assert.equal(result.gate, "GREEN");
    assert.equal(result.mode, "CONTROL");
    assert.equal(result.reason, "CONTROL_CENTER_MAINTENANCE_ACCEPTED");
  });

  it("Control Center bootstrap is DONE", () => {
    const task = loadLedger().tasks.find(
      (item) => item.task_id === "ECC-001"
    );

    assert.ok(task);
    assert.equal(task.status, "DONE");
    assert.ok(task.current_evidence.length > 0);
  });

  it("Edge Master Project Register becomes TESTED", () => {
    const task = loadLedger().tasks.find(
      (item) => item.task_id === "EPR-001"
    );

    assert.ok(task);
    assert.equal(task.status, "TESTED");
    assert.deepEqual(task.blocked_by, ["ECC-001"]);
  });

  it("EPR-001 governed-unresolved ownership contract is updated", () => {
    const task = loadLedger().tasks.find(
      (item) => item.task_id === "EPR-001"
    );

    assert.ok(task);
    assert.equal(task.status, "TESTED");
    assert.equal(
      task.blocked_by[0],
      "ECC-001"
    );

    // Completion definition (semantic substrings; not dependent on unresolved counts)
    assert.match(
      task.completion_definition,
      /A complete Edge Master Project Register and Repository Asset Register foundation exist/
    );
    assert.match(
      task.completion_definition,
      /project register is synchronized with canonical Edge Control Center sequencing/
    );
    assert.match(
      task.completion_definition,
      /every tracked repository path is registered or explicitly excluded/
    );
    assert.match(
      task.completion_definition,
      /every registered tracked asset declares a valid governed_by_control_task_id/
    );
    assert.match(
      task.completion_definition,
      /unresolved final project ownership may remain as a governed cleanup finding/
    );
    assert.match(
      task.completion_definition,
      /non-empty next_validation/
    );
    assert.match(
      task.completion_definition,
      /no tracked path is unclassified/
    );
    assert.match(
      task.completion_definition,
      /candidate status does not establish CURRENT_AUTHORITY/
    );
    assert.match(
      task.completion_definition,
      /non-ignored pre-existing untracked workspace paths are discovered separately from the tracked repository universe/i
    );
    assert.match(
      task.completion_definition,
      /preserved as governed workspace candidate evidence or explicitly excluded with a reason/i
    );
    assert.match(
      task.completion_definition,
      /without requiring the underlying file to be committed/i
    );
    assert.match(
      task.completion_definition,
      /known first-party rule and governance authority candidates remain identifiable by review role/i
    );
    assert.match(
      task.completion_definition,
      /governed candidate relationship graph|explicitly justified as standalone review candidates/i
    );
    assert.match(
      task.completion_definition,
      /ignored dependency, environment, and cache paths are excluded from first-party authority candidate discovery/i
    );
    assert.match(
      task.completion_definition,
      /asset integrity does not fail merely because an asset is/i
    );

    // Proof requirements (must include all governed-unresolved semantics)
    assert.ok(Array.isArray(task.proof_required));
    const proofText = task.proof_required.join("\n");

    assert.match(
      proofText,
      /Edge Repository Asset Register exists and validates\./
    );
    assert.match(
      proofText,
      /Unclassified tracked path count is zero\./
    );
    assert.match(
      proofText,
      /UNRESOLVED final project ownership remains a non-fatal governed cleanup finding only when the asset has a valid Control Center task binding and non-empty next_validation\./
    );
    assert.match(
      proofText,
      /Invalid or unknown governed_by_control_task_id remains fail-closed\./
    );
    assert.match(
      proofText,
      /Non-ignored untracked workspace candidate discovery is performed separately from tracked-path counting\./
    );
    assert.match(
      proofText,
      /git-aware non-ignored path discovery such as git ls-files --others --exclude-standard/
    );
    assert.match(
      proofText,
      /Preserving a pre-existing untracked workspace candidate does not require committing the underlying artifact\./
    );
    assert.ok(
      proofText.includes(
        "node_modules, .venv, venv, **pycache**, and .pyc"
      )
    );
    assert.match(
      proofText,
      /Candidate-role assignment is a review classification and does not establish CURRENT_AUTHORITY\./
    );
    assert.match(
      proofText,
      /linked through governed related-asset relationships or an equivalent candidate relationship graph\./
    );
    assert.match(
      proofText,
      /no relationship edge must be explicitly marked as a standalone review candidate with a non-empty justification\./
    );
    assert.match(
      proofText,
      /Relationship edges identify review relationships only and do not assert authority precedence\./
    );
    assert.match(
      proofText,
      /candidate relationship graph integrity fails for missing candidate references|Tests prove candidate relationship graph integrity fails for missing candidate references/
    );
    assert.match(
      proofText,
      /Final authority classification remains subject to governed review\./
    );
    assert.match(
      proofText,
      /No runtime provider removal, Scout\/FIP intake, Supabase mutation, prediction-rule change, ACCA-rule change, migration execution, or deployment change occurs as part of EPR-001\./
    );
    assert.match(
      proofText,
      /Tests prove EPR-001 may close without inventing final ownership for bootstrap-registered legacy\/unknown assets\./
    );

    // Next action must preserve fail-closed semantics and set closure evidence for TESTED promotion.
    assert.match(
      task.next_action,
      /foundation closed and TESTED/i
    );
    assert.match(
      task.next_action,
      /Preserve the Edge Master Project Register/i
    );
    assert.match(
      task.next_action,
      /complete tracked repository asset coverage/i
    );
    assert.match(
      task.next_action,
      /governed pre-existing untracked workspace candidate snapshot/i
    );
    assert.match(
      task.next_action,
      /governed unresolved final project ownership findings/i
    );
    assert.match(
      task.next_action,
      /Do not start ESA-001/i
    );
  });

  it("ESA-001 is not auto-startable once TESTED", () => {
    const result = runCheck({
      ledgerPath: LEDGER_PATH,
    });

    assert.ok(result.startable.some((t) => t.task_id === "EAC-001"));
    assert.ok(result.next);
    assert.equal(result.next.task_id, "EAC-001");
    assert.equal(result.next.status, "APPROVED");
    assert.equal(result.gated, null);
  });

  it("EPR-001 remains TESTED and is not startable once ESA-001 is TESTED", () => {
    const result = runCheck({
      ledgerPath: LEDGER_PATH,
    });

    assert.ok(!result.startable.some((t) => t.task_id === "ESA-001"));
    assert.ok(!result.startable.some((t) => t.task_id === "EPR-001"));
  });

  it("ESA-001 completion_definition preserves the inventory closure contract", () => {
    const task = loadLedger().tasks.find(
      (item) => item.task_id === "ESA-001"
    );

    assert.ok(task);
    assert.equal(task.status, "TESTED");

    const cd = task.completion_definition;

    // Coverage classes
    assert.match(cd, /complete material Edge system and runtime inventory foundation exists/i);
    assert.match(cd, /synchronized with the Edge Master Project Register/i);
    assert.match(cd, /runtime entry points|entry points/i);
    assert.match(cd, /mounted route surfaces/i);
    assert.match(cd, /runtime-reachable controller and service paths|controller and service paths/i);
    assert.match(cd, /external provider reachability/i);
    assert.match(cd, /Scout\/FIP-related Edge surfaces/i);
    assert.match(cd, /database and Supabase runtime read\/write surfaces/i);
    assert.match(cd, /scheduled and background execution surfaces/i);
    assert.match(cd, /deployment surfaces/i);

    // Governed unresolved / next_validation requirements
    assert.match(cd, /unresolved or unknown runtime relationships remain governed findings/i);
    assert.match(cd, /non-empty next_validation/i);
    assert.match(cd, /valid Control Center task binding/i);
    assert.match(cd, /inventory distinguishes confirmed, candidate, legacy, parallel, unreachable, unknown, and unresolved/i);

    // Rule/governance enforcement reachability inventory without declaring authority.
    assert.match(
      cd,
      /runtime\/database\/build-gate rule or governance enforcement surfaces/i
    );
    assert.match(
      cd,
      /without declaring canonical rule authority|authority precedence|rule-threshold changes/i
    );

    // Forbidden future architecture declarations
    assert.match(cd, /without declaring future Edge architecture/i);
    assert.match(cd, /provider-retirement decisions/i);
    assert.match(cd, /Scout\/FIP activation/i);
    assert.match(cd, /database-retention decisions/i);
    assert.match(cd, /canonical rule authority|authority precedence|rule-threshold changes/i);

    // Canonical artifacts and fail-closed integrity
    assert.match(cd, /canonical machine-readable Edge System Runtime Inventory/i);
    assert.match(cd, /synchronized human-readable runtime map/i);
    assert.match(cd, /integrity checker/i);
    assert.match(cd, /contract tests prove complete material coverage/i);
    assert.match(cd, /fail closed when required runtime surfaces silently disappear from governance/i);
  });

  it("Scout-Edge marriage gate is explicitly blocked", () => {
    const result = runCheck({
      ledgerPath: LEDGER_PATH,
    });

    assert.equal(
      result.ledger.scout_edge_marriage_gate,
      "BLOCKED"
    );
    assert.equal(result.marriage.allowed, false);
    assert.equal(
      result.marriage.reason,
      "scout_edge_marriage_gate_explicitly_blocked"
    );
  });

  it("all marriage prerequisite tasks exist", () => {
    const { tasks } = loadLedger();
    const ids = new Set(
      tasks.map((task) => task.task_id)
    );

    for (const taskId of MARRIAGE_PREREQUISITES) {
      assert.ok(
        ids.has(taskId),
        `missing marriage prerequisite ${taskId}`
      );
    }
  });

  it("marriage prerequisites are incomplete", () => {
    const ledger = loadLedger();
    const state = getMarriageState(
      ledger.tasks,
      ledger
    );

    assert.equal(
      state.prerequisitesComplete,
      false
    );
    assert.ok(state.incomplete.length > 0);
  });

  it("external provider removal is PARTIAL and waits for FIP intake", () => {
    const ledger = loadLedger();
    const task = ledger.tasks.find(
      (item) => item.task_id === "EPRV-001"
    );

    assert.ok(task);
    assert.equal(task.status, "PARTIAL");
    assert.ok(task.blocked_by.includes("EFI-001"));
    assert.equal(
      ledger.provider_removal_state,
      "PARTIAL"
    );
  });

  it("Supabase storage governance explicitly tracks the 0.5 GB constraint", () => {
    const ledger = loadLedger();
    const task = ledger.tasks.find(
      (item) => item.task_id === "EST-001"
    );

    assert.ok(task);
    assert.equal(task.status, "PROPOSED");
    assert.match(
      `${task.description} ${task.current_evidence.join(" ")}`,
      /0\.5 GB/i
    );

    assert.equal(
      ledger.supabase_storage_gate,
      "BLOCKED"
    );
  });

  it("Supabase is not designated as a Scout evidence mirror", () => {
    const ledger = loadLedger();

    assert.match(
      ledger.supabase_storage_policy,
      /must not become a permanent mirror of Scout raw evidence/i
    );
  });

  it("full Control Center check passes", () => {
    const result = runCheck({
      ledgerPath: LEDGER_PATH,
    });

    assert.equal(
      result.errors.length,
      0,
      result.errors.join("; ")
    );

    assert.equal(result.passed, true);
  });
});
