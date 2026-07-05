"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const {
  REQUIRED_FIELDS,
  REGISTER_PATH,
  BACKLOG_PATH,
  DEPENDENCY_MAP_PATH,
  getLedgerTasks,
  taskId,
  taskName,
  taskStatus,
  taskBlockedBy,
  loadLedger,
  loadRegister,
  validateRegister,
} = require("../control-center/check_edge_project_register.js");

describe("Edge Master Project Register v1", () => {
  it("register exists", () => {
    assert.ok(fs.existsSync(REGISTER_PATH));
  });

  it("register loads with canonical version and projects", () => {
    const register = loadRegister();

    assert.equal(register.version, "1.0");
    assert.ok(Array.isArray(register.projects));
    assert.ok(register.projects.length > 0);
    assert.equal(
      register.project_count,
      register.projects.length
    );
  });

  it("every project has every required field", () => {
    const register = loadRegister();

    for (const project of register.projects) {
      for (const field of REQUIRED_FIELDS) {
        assert.notEqual(
          project[field],
          undefined,
          `${project.project_id} missing ${field}`
        );
        assert.notEqual(
          project[field],
          null,
          `${project.project_id} null ${field}`
        );
      }
    }
  });

  it("every ledger task is registered", () => {
    const ledger = loadLedger();
    const register = loadRegister();

    const projectIds = new Set(
      register.projects.map(
        (project) => project.project_id
      )
    );

    for (const task of getLedgerTasks(ledger)) {
      assert.ok(
        projectIds.has(taskId(task)),
        `ledger task ${taskId(task)} is unregistered`
      );
    }
  });

  it("exact project/task IDs mirror canonical ledger state", () => {
    const ledger = loadLedger();
    const register = loadRegister();

    const taskById = new Map(
      getLedgerTasks(ledger).map((task) => [
        taskId(task),
        task,
      ])
    );

    for (const project of register.projects) {
      const task = taskById.get(project.project_id);

      if (!task) continue;

      assert.equal(
        project.project_name,
        taskName(task),
        `${project.project_id} name drift`
      );
      assert.equal(
        project.current_status,
        taskStatus(task),
        `${project.project_id} status drift`
      );
      assert.deepEqual(
        project.blocked_by,
        taskBlockedBy(task),
        `${project.project_id} dependency drift`
      );
    }
  });

  it("EPR-001 remains TESTED and self-governed", () => {
    const epr = loadRegister().projects.find(
      (project) => project.project_id === "EPR-001"
    );

    assert.ok(epr);
    assert.equal(epr.current_status, "TESTED");
    assert.equal(
      epr.governed_by_control_task_id,
      "EPR-001"
    );

    // Explicit mirror proof between ledger task status and register current_status.
    const ledger = loadLedger();
    const eprLedgerTask = getLedgerTasks(ledger).find(
      (task) => taskId(task) === "EPR-001"
    );
    assert.ok(eprLedgerTask);
    assert.equal(
      epr.current_status,
      eprLedgerTask.status,
      "EPR-001 project register status must mirror canonical ledger status"
    );
  });

  it("PROJECT_LEDGER_STATUS_DRIFT remains fail-closed for EPR-001 mismatched mirror", () => {
    const ledger = loadLedger();
    const ledgerTask = getLedgerTasks(ledger).find(
      (task) => taskId(task) === "EPR-001"
    );
    assert.ok(ledgerTask);
    assert.equal(ledgerTask.status, "TESTED");

    const register = loadRegister();
    const cloned = JSON.parse(JSON.stringify(register));
    const epr = cloned.projects.find(
      (project) => project.project_id === "EPR-001"
    );
    assert.ok(epr);

    // Deliberate mismatch for negative test: register=APPROVED while ledger=TESTED.
    epr.current_status = "APPROVED";

    const result = validateRegister(cloned);
    assert.ok(
      result.errors.includes(
        "PROJECT_LEDGER_STATUS_DRIFT: EPR-001 register=APPROVED ledger=TESTED"
      )
    );
    assert.equal(result.passed, false);
  });

  it("backlog and dependency map exist", () => {
    assert.ok(fs.existsSync(BACKLOG_PATH));
    assert.ok(fs.existsSync(DEPENDENCY_MAP_PATH));
  });

  it("backlog and dependency map contain every project ID", () => {
    const register = loadRegister();
    const backlog = fs.readFileSync(
      BACKLOG_PATH,
      "utf8"
    );
    const dependencyMap = fs.readFileSync(
      DEPENDENCY_MAP_PATH,
      "utf8"
    );

    for (const project of register.projects) {
      assert.match(backlog, new RegExp(project.project_id));
      assert.match(
        dependencyMap,
        new RegExp(project.project_id)
      );
    }
  });

  it("register integrity checker passes", () => {
    const result = validateRegister(loadRegister());

    assert.deepEqual(result.errors, []);
    assert.equal(result.passed, true);
  });
});
