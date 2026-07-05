"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  ALLOWED_STATUSES,
  LEDGER_PATH,
  MARRIAGE_PREREQUISITES,
  loadLedger,
  validateLedger,
  getMarriageState,
  runCheck,
} = require(
  "../control-center/check_control_center.js"
);

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

  it("Control Center bootstrap is DONE", () => {
    const task = loadLedger().tasks.find(
      (item) => item.task_id === "ECC-001"
    );

    assert.ok(task);
    assert.equal(task.status, "DONE");
    assert.ok(task.current_evidence.length > 0);
  });

  it("Edge Master Project Register becomes APPROVED", () => {
    const task = loadLedger().tasks.find(
      (item) => item.task_id === "EPR-001"
    );

    assert.ok(task);
    assert.equal(task.status, "APPROVED");
    assert.deepEqual(task.blocked_by, ["ECC-001"]);
  });

  it("EPR-001 governed-unresolved ownership contract is updated", () => {
    const task = loadLedger().tasks.find(
      (item) => item.task_id === "EPR-001"
    );

    assert.ok(task);
    assert.equal(task.status, "APPROVED");
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
      /Implement the approved pre-existing untracked workspace candidate discovery and rule\/governance authority candidate graph correction/
    );
    assert.match(
      task.next_action,
      /preserve tracked-path count semantics/
    );
    assert.match(
      task.next_action,
      /keep unknown Control Center task bindings fail-closed/
    );
    assert.match(
      task.next_action,
      /do not declare candidate authority/
    );
    assert.match(
      task.next_action,
      /return closure evidence for separate EPR-001 TESTED promotion/
    );
  });

  it("EPR-001 becomes the single auto-startable task", () => {
    const result = runCheck({
      ledgerPath: LEDGER_PATH,
    });

    assert.equal(result.startable.length, 1);
    assert.ok(result.next);
    assert.equal(result.next.task_id, "EPR-001");
    assert.equal(result.next.status, "APPROVED");
    assert.equal(result.gated, null);
  });

  it("EPR-001 is not selected as gated task once APPROVED", () => {
    const result = runCheck({
      ledgerPath: LEDGER_PATH,
    });

    assert.equal(result.gated, null);
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
