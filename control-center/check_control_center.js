#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const LEDGER_PATH = path.join(
  __dirname,
  "EDGE_BUILD_CONTROL_LEDGER.v1.json"
);

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

function loadLedger(filePath = LEDGER_PATH) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
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

  const {
    errors,
    warnings,
    tasks,
  } = validateLedger(ledger);

  const startable = getStartableTasks(tasks);
  const next = getNextAllowedTask(tasks);
  const gated = next
    ? null
    : getNextGatedTask(tasks);

  return {
    passed: errors.length === 0,
    ledger,
    errors,
    warnings,
    tasks,
    blocked: listBlockedTasks(tasks),
    startable,
    next,
    gated,
    marriage: getMarriageState(tasks, ledger),
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

  if (next) {
    console.log(
      `Next allowed task: ${next.task_id} — ${next.task_name}`
    );
    console.log(
      `  Next action: ${next.next_action}`
    );
  } else if (gated) {
    console.log(
      "Next allowed task: (none — no auto-startable tasks)"
    );
    console.log(
      `Next gated task: ${gated.task_id} — ${gated.task_name} [${gated.status}]`
    );
    console.log(
      "  Requires separate approval before start"
    );

    if (gated.next_action) {
      console.log(`  Note: ${gated.next_action}`);
    }
  } else {
    console.log(
      "Next allowed task: (none — resolve blockers or approve tasks first)"
    );
  }

  console.log("");

  console.log(
    passed ? "RESULT: PASS" : "RESULT: FAIL"
  );

  return passed;
}

if (require.main === module) {
  const result = runCheck();
  const passed = printReport(result);

  process.exit(passed ? 0 : 1);
}

module.exports = {
  ALLOWED_STATUSES,
  ALLOWED_GATE_STATUSES,
  LEDGER_PATH,
  MARRIAGE_PREREQUISITES,
  SATISFIED_STATUSES,
  loadLedger,
  validateLedger,
  isDependencySatisfied,
  getSatisfiedTaskIds,
  getStartableTasks,
  getNextAllowedTask,
  getNextGatedTask,
  getMarriageState,
  listBlockedTasks,
  runCheck,
};
