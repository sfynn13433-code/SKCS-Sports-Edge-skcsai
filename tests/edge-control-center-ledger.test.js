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
