#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REGISTER_PATH = path.join(
  __dirname,
  "EDGE_MASTER_PROJECT_REGISTER.v1.json"
);
const LEDGER_PATH = path.join(
  __dirname,
  "EDGE_BUILD_CONTROL_LEDGER.v1.json"
);
const BACKLOG_PATH = path.join(
  __dirname,
  "EDGE_PROJECT_BACKLOG.md"
);
const DEPENDENCY_MAP_PATH = path.join(
  __dirname,
  "EDGE_PROJECT_DEPENDENCY_MAP.md"
);

const BOOTSTRAP_DATE = "2026-07-05";

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

const NON_LEDGER_ACTIVE_STATUSES = new Set([
  "APPROVED",
  "IN_PROGRESS",
  "TESTED",
  "COMMITTED",
  "DONE",
]);

const REQUIRED_FIELDS = [
  "project_id",
  "project_name",
  "category",
  "description",
  "why_it_matters",
  "current_status",
  "priority",
  "blocked_by",
  "blocks",
  "affected_layers",
  "related_tasks",
  "related_contracts",
  "related_files",
  "related_tables",
  "known_issues",
  "required_decisions",
  "completion_definition",
  "proof_required",
  "risks_if_ignored",
  "recommended_order",
  "next_action",
  "owner_note",
  "last_updated",
  "governed_by_control_task_id",
  "current_evidence",
];

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function getLedgerTasks(ledger) {
  if (Array.isArray(ledger.tasks)) return ledger.tasks;
  if (Array.isArray(ledger.control_tasks)) return ledger.control_tasks;

  throw new Error(
    "EDGE_BUILD_CONTROL_LEDGER.v1.json has no supported tasks array"
  );
}

function taskId(task) {
  return task.task_id || task.id || null;
}

function taskName(task) {
  return task.task_name || task.name || task.title || null;
}

function taskStatus(task) {
  return task.status || task.current_status || null;
}

function taskBlockedBy(task) {
  return asArray(task.blocked_by);
}

function taskCompletionDefinition(task) {
  return (
    task.completion_definition ||
    task.completion ||
    task.done_when ||
    null
  );
}

function taskProofRequired(task) {
  return asArray(
    task.proof_required ||
      task.proof_requirements ||
      task.required_proof
  );
}

function taskNextAction(task) {
  return task.next_action || task.nextAction || null;
}

function taskEvidence(task) {
  return asArray(
    task.current_evidence ||
      task.evidence ||
      task.proof_evidence
  );
}

function loadLedger(filePath = LEDGER_PATH) {
  return loadJson(filePath);
}

function loadRegister(filePath = REGISTER_PATH) {
  return loadJson(filePath);
}

function buildProjectRegister(ledger) {
  const tasks = getLedgerTasks(ledger);

  const taskIds = tasks.map(taskId);

  if (taskIds.some((id) => !id)) {
    throw new Error("Ledger task missing task_id/id");
  }

  if (new Set(taskIds).size !== taskIds.length) {
    throw new Error("Ledger contains duplicate task IDs");
  }

  const blockedByMap = new Map();
  const blocksMap = new Map();

  for (const task of tasks) {
    const id = taskId(task);
    const deps = taskBlockedBy(task);

    blockedByMap.set(id, deps);

    if (!blocksMap.has(id)) {
      blocksMap.set(id, []);
    }

    for (const dep of deps) {
      if (!blocksMap.has(dep)) {
        blocksMap.set(dep, []);
      }

      blocksMap.get(dep).push(id);
    }
  }

  const projects = tasks.map((task, index) => {
    const id = taskId(task);
    const name = taskName(task);
    const status = taskStatus(task);
    const completionDefinition =
      taskCompletionDefinition(task);
    const proofRequired = taskProofRequired(task);
    const nextAction = taskNextAction(task);

    if (!name) {
      throw new Error(`${id}: ledger task missing name/title`);
    }

    if (!status) {
      throw new Error(`${id}: ledger task missing status`);
    }

    if (!completionDefinition) {
      throw new Error(
        `${id}: ledger task missing completion definition`
      );
    }

    if (proofRequired.length === 0) {
      throw new Error(
        `${id}: ledger task missing proof requirements`
      );
    }

    if (!nextAction) {
      throw new Error(
        `${id}: ledger task missing next action`
      );
    }

    return {
      project_id: id,
      project_name: name,
      category:
        task.category ||
        task.workstream ||
        "Edge Control Center Sequencing",
      description:
        task.description ||
        task.purpose ||
        `${id} — ${name} — tracked in the Edge Master Project Register.`,
      why_it_matters:
        task.why_it_matters ||
        task.purpose ||
        "Governed Edge work must remain visible to Control Center sequencing.",
      current_status: status,
      priority: task.priority || "medium",
      blocked_by: blockedByMap.get(id) || [],
      blocks: blocksMap.get(id) || [],
      affected_layers: asArray(
        task.affected_layers || ["edge"]
      ),
      related_tasks: [id],
      related_contracts: asArray(
        task.related_contracts
      ),
      related_files: asArray(task.related_files),
      related_tables: asArray(task.related_tables),
      known_issues: asArray(task.known_issues),
      required_decisions: asArray(
        task.required_decisions
      ),
      completion_definition: completionDefinition,
      proof_required: proofRequired,
      risks_if_ignored: asArray(
        task.risks_if_ignored || [
          "Hidden Edge work",
          "Control Center sequencing bypass",
        ]
      ),
      recommended_order:
        task.recommended_order || index + 1,
      next_action: nextAction,
      owner_note:
        "Bootstrapped from the canonical Edge Control Center ledger. Exact task-ID overlaps mirror ledger sequencing state.",
      last_updated:
        task.last_updated || BOOTSTRAP_DATE,
      governed_by_control_task_id: id,
      current_evidence: taskEvidence(task),
    };
  });

  return {
    version: "1.0",
    title: "SKCS Edge Master Project Register",
    generated_at: BOOTSTRAP_DATE,
    source_ledger:
      "control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json",
    project_policy:
      "The Master Project Register owns project/workstream truth. Exact project_id to ledger.task_id overlaps must mirror canonical Control Center sequencing state. Files are assets, not automatically projects.",
    project_count: projects.length,
    projects,
  };
}

function buildBacklog(register) {
  const lines = [
    "# SKCS Edge Project Backlog",
    "",
    "Generated from `EDGE_MASTER_PROJECT_REGISTER.v1.json`.",
    "",
    "A repository file is an asset. It is not automatically a project.",
    "",
    "| Project ID | Project | Category | Status | Priority | Governed By | Next Action |",
    "|---|---|---|---|---|---|---|",
  ];

  for (const project of register.projects) {
    const clean = (value) =>
      String(value || "").replace(/\|/g, "\\|").replace(/\n/g, " ");

    lines.push(
      `| ${clean(project.project_id)} | ${clean(
        project.project_name
      )} | ${clean(project.category)} | ${clean(
        project.current_status
      )} | ${clean(project.priority)} | ${clean(
        project.governed_by_control_task_id
      )} | ${clean(project.next_action)} |`
    );
  }

  return `${lines.join("\n")}\n`;
}

function buildDependencyMap(register) {
  const lines = [
    "# SKCS Edge Project Dependency Map",
    "",
    "Generated from `EDGE_MASTER_PROJECT_REGISTER.v1.json`.",
    "",
  ];

  for (const project of register.projects) {
    lines.push(
      `## ${project.project_id} — ${project.project_name}`
    );
    lines.push("");
    lines.push(`Status: ${project.current_status}`);
    lines.push(
      `Governed by: ${project.governed_by_control_task_id}`
    );
    lines.push(
      `Blocked by: ${
        project.blocked_by.length
          ? project.blocked_by.join(", ")
          : "none"
      }`
    );
    lines.push(
      `Blocks: ${
        project.blocks.length
          ? project.blocks.join(", ")
          : "none"
      }`
    );
    lines.push("");
  }

  while (lines.length && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return `${lines.join("\n")}\n`;
}

function bootstrap() {
  const ledger = loadLedger();
  const register = buildProjectRegister(ledger);

  writeJson(REGISTER_PATH, register);
  fs.writeFileSync(
    BACKLOG_PATH,
    buildBacklog(register),
    "utf8"
  );
  fs.writeFileSync(
    DEPENDENCY_MAP_PATH,
    buildDependencyMap(register),
    "utf8"
  );

  console.log(
    `BOOTSTRAP PASS: ${register.projects.length} Edge projects registered`
  );
}

function sameStringArray(left, right) {
  return (
    JSON.stringify(asArray(left)) ===
    JSON.stringify(asArray(right))
  );
}

function validateRegister(
  register,
  ledger = loadLedger()
) {
  const errors = [];
  const warnings = [];

  const projects = Array.isArray(register.projects)
    ? register.projects
    : [];

  const tasks = getLedgerTasks(ledger);
  const ledgerById = new Map(
    tasks.map((task) => [taskId(task), task])
  );

  if (register.version !== "1.0") {
    errors.push(
      `INVALID_REGISTER_VERSION: ${register.version}`
    );
  }

  if (projects.length === 0) {
    errors.push("EMPTY_PROJECT_REGISTER");
  }

  if (register.project_count !== projects.length) {
    errors.push(
      `PROJECT_COUNT_MISMATCH: declared=${register.project_count} actual=${projects.length}`
    );
  }

  const projectById = new Map();

  for (const project of projects) {
    for (const field of REQUIRED_FIELDS) {
      if (
        project[field] === undefined ||
        project[field] === null
      ) {
        errors.push(
          `PROJECT_REQUIRED_FIELD_MISSING: ${
            project.project_id || "?"
          } ${field}`
        );
      }
    }

    if (!project.project_id) continue;

    if (projectById.has(project.project_id)) {
      errors.push(
        `DUPLICATE_PROJECT_ID: ${project.project_id}`
      );
      continue;
    }

    projectById.set(project.project_id, project);

    if (
      !ALLOWED_STATUSES.includes(
        project.current_status
      )
    ) {
      errors.push(
        `INVALID_PROJECT_STATUS: ${project.project_id} ${project.current_status}`
      );
    }

    if (
      !ledgerById.has(
        project.governed_by_control_task_id
      )
    ) {
      errors.push(
        `PROJECT_CONTROL_TASK_UNKNOWN: ${project.project_id} ${project.governed_by_control_task_id}`
      );
    }

    const exactTask = ledgerById.get(
      project.project_id
    );

    if (exactTask) {
      if (
        project.current_status !==
        taskStatus(exactTask)
      ) {
        errors.push(
          `PROJECT_LEDGER_STATUS_DRIFT: ${project.project_id} register=${project.current_status} ledger=${taskStatus(
            exactTask
          )}`
        );
      }

      if (
        project.project_name !== taskName(exactTask)
      ) {
        errors.push(
          `PROJECT_LEDGER_NAME_DRIFT: ${project.project_id}`
        );
      }

      if (
        !sameStringArray(
          project.blocked_by,
          taskBlockedBy(exactTask)
        )
      ) {
        errors.push(
          `PROJECT_LEDGER_DEPENDENCY_DRIFT: ${project.project_id}`
        );
      }
    } else if (
      NON_LEDGER_ACTIVE_STATUSES.has(
        project.current_status
      )
    ) {
      errors.push(
        `NON_LEDGER_PROJECT_BYPASSES_CONTROL_CENTER: ${project.project_id} ${project.current_status}`
      );
    }
  }

  for (const task of tasks) {
    const id = taskId(task);

    if (!projectById.has(id)) {
      errors.push(
        `LEDGER_TASK_UNREGISTERED: ${id}`
      );
    }
  }

  for (const project of projects) {
    for (const dependency of asArray(
      project.blocked_by
    )) {
      if (!projectById.has(dependency)) {
        errors.push(
          `PROJECT_DEPENDENCY_UNKNOWN: ${project.project_id} ${dependency}`
        );
      }
    }
  }

  if (!fs.existsSync(BACKLOG_PATH)) {
    errors.push("PROJECT_BACKLOG_MISSING");
  }

  if (!fs.existsSync(DEPENDENCY_MAP_PATH)) {
    errors.push("PROJECT_DEPENDENCY_MAP_MISSING");
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    projects,
    ledgerTasks: tasks,
  };
}

function runCheck() {
  return validateRegister(loadRegister());
}

function printReport(result) {
  console.log(
    "=== SKCS Edge Master Project Register Check ==="
  );
  console.log(`Projects: ${result.projects.length}`);
  console.log(
    `Ledger tasks: ${result.ledgerTasks.length}`
  );

  if (result.errors.length) {
    console.log("");
    console.log("ERRORS:");

    for (const error of result.errors) {
      console.log(`  ✗ ${error}`);
    }
  }

  if (result.warnings.length) {
    console.log("");
    console.log("WARNINGS:");

    for (const warning of result.warnings) {
      console.log(`  ! ${warning}`);
    }
  }

  console.log("");
  console.log(
    result.passed ? "RESULT: PASS" : "RESULT: FAIL"
  );

  return result.passed;
}

if (require.main === module) {
  if (process.argv.includes("--bootstrap")) {
    bootstrap();
  }

  const result = runCheck();
  const passed = printReport(result);

  process.exit(passed ? 0 : 1);
}

module.exports = {
  ALLOWED_STATUSES,
  REQUIRED_FIELDS,
  REGISTER_PATH,
  LEDGER_PATH,
  BACKLOG_PATH,
  DEPENDENCY_MAP_PATH,
  asArray,
  getLedgerTasks,
  taskId,
  taskName,
  taskStatus,
  taskBlockedBy,
  loadLedger,
  loadRegister,
  buildProjectRegister,
  validateRegister,
  runCheck,
};
