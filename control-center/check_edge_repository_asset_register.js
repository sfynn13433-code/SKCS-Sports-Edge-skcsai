#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

const ASSET_REGISTER_PATH = path.join(
  __dirname,
  "EDGE_REPOSITORY_ASSET_REGISTER.v1.json"
);
const PROJECT_REGISTER_PATH = path.join(
  __dirname,
  "EDGE_MASTER_PROJECT_REGISTER.v1.json"
);
const LEDGER_PATH = path.join(
  __dirname,
  "EDGE_BUILD_CONTROL_LEDGER.v1.json"
);

const BOOTSTRAP_DATE = "2026-07-05";

const ASSET_TYPES = [
  "SOURCE_CODE",
  "TEST",
  "CONFIG",
  "DOCUMENTATION",
  "DATABASE_MIGRATION",
  "DATABASE_SQL",
  "DATA",
  "DEPLOYMENT",
  "LEGAL_PRODUCT_TEXT",
  "CONTROL_CENTER",
  "GENERATED",
  "OTHER",
];

const SOURCE_STATES = [
  "COMMITTED_REPOSITORY",
  "PRE_EXISTING_MODIFIED",
  "PRE_EXISTING_UNTRACKED",
  "MIXED_SOURCE_STATE",
  "ECC_CONTROL_FOUNDATION",
];

const CURRENT_STATES = [
  "CURRENT",
  "PARALLEL",
  "LEGACY",
  "HISTORICAL_EVIDENCE",
  "STALE_OR_SUPERSEDED",
  "UNKNOWN",
  "GENERATED",
];

const AUTHORITY_CLASSES = [
  "CURRENT_AUTHORITY",
  "ACCEPTED_ADR",
  "LOCKED_DESIGN",
  "ACTIVE_CONTRACT",
  "ACTIVE_GOVERNANCE",
  "ACTIVE_AUDIT",
  "HISTORICAL_EVIDENCE",
  "LEGAL_OR_PRODUCT_TEXT",
  "UNKNOWN",
];

const GOES_SOMEWHERE_STATES = [
  "YES",
  "NO",
  "PARTIAL",
  "UNKNOWN",
];

const REQUIRED_ASSET_FIELDS = [
  "asset_path",
  "asset_type",
  "asset_role",
  "source_state",
  "authority_class",
  "current_state",
  "owner_project_id",
  "governed_by_control_task_id",
  "related_assets",
  "related_tables",
  "related_functions",
  "runtime_consumers",
  "runtime_dependencies",
  "database_objects",
  "deployment_surface",
  "goes_somewhere",
  "known_conflicts",
  "validation_status",
  "next_validation",
  "notes",
];

const ARRAY_FIELDS = [
  "related_assets",
  "related_tables",
  "related_functions",
  "runtime_consumers",
  "runtime_dependencies",
  "database_objects",
  "deployment_surface",
  "known_conflicts",
];

const EPR_IMPLEMENTATION_PATHS = new Set([
  "control-center/EDGE_MASTER_PROJECT_REGISTER.v1.json",
  "control-center/EDGE_PROJECT_BACKLOG.md",
  "control-center/EDGE_PROJECT_DEPENDENCY_MAP.md",
  "control-center/check_edge_project_register.js",
  "tests/edge-project-register.test.js",
  "control-center/EDGE_REPOSITORY_ASSET_REGISTER.v1.json",
  "control-center/check_edge_repository_asset_register.js",
  "tests/edge-repository-asset-register.test.js",
]);

const ECC_FOUNDATION_PATHS = new Set([
  "control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json",
  "control-center/EDGE_CONTROL_CENTER.md",
  "control-center/check_control_center.js",
  "tests/edge-control-center-ledger.test.js",
]);

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

function normalizePath(value) {
  return String(value).replace(/\\/g, "/");
}

function getTrackedPaths() {
  const raw = execFileSync(
    "git",
    ["ls-files", "-z"],
    {
      cwd: ROOT,
      encoding: "utf8",
    }
  );

  return raw
    .split("\0")
    .filter(Boolean)
    .map(normalizePath)
    .sort();
}

function getChangedTrackedPaths() {
  const raw = execFileSync(
    "git",
    ["diff", "--name-only", "HEAD"],
    {
      cwd: ROOT,
      encoding: "utf8",
    }
  );

  return new Set(
    raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map(normalizePath)
  );
}

function getLedgerTasks(ledger) {
  if (Array.isArray(ledger.tasks)) {
    return ledger.tasks;
  }

  if (Array.isArray(ledger.control_tasks)) {
    return ledger.control_tasks;
  }

  throw new Error(
    "EDGE_BUILD_CONTROL_LEDGER.v1.json has no supported tasks array"
  );
}

function taskId(task) {
  return task.task_id || task.id || null;
}

function taskStatus(task) {
  return task.status || task.current_status || null;
}

function classifyAssetType(assetPath) {
  const lower = assetPath.toLowerCase();
  const base = path.posix.basename(lower);

  if (assetPath.startsWith("control-center/")) {
    return "CONTROL_CENTER";
  }

  if (
    assetPath.startsWith("tests/") ||
    /\.test\.[cm]?[jt]sx?$/.test(lower)
  ) {
    return "TEST";
  }

  if (
    assetPath.startsWith("supabase/migrations/") &&
    lower.endsWith(".sql")
  ) {
    return "DATABASE_MIGRATION";
  }

  if (lower.endsWith(".sql")) {
    return "DATABASE_SQL";
  }

  if (
    lower.includes("privacy") ||
    lower.includes("terms") ||
    lower.includes("legal")
  ) {
    return "LEGAL_PRODUCT_TEXT";
  }

  if (
    base === "dockerfile" ||
    base.startsWith("dockerfile.") ||
    lower === "render.yaml" ||
    lower === "render.yml" ||
    lower === "vercel.json"
  ) {
    return "DEPLOYMENT";
  }

  if (
    lower.endsWith(".js") ||
    lower.endsWith(".cjs") ||
    lower.endsWith(".mjs") ||
    lower.endsWith(".ts") ||
    lower.endsWith(".tsx") ||
    lower.endsWith(".jsx") ||
    lower.endsWith(".py")
  ) {
    return "SOURCE_CODE";
  }

  if (lower.endsWith(".md") || lower.endsWith(".txt")) {
    return "DOCUMENTATION";
  }

  if (
    lower.endsWith(".json") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".yml") ||
    lower.endsWith(".toml") ||
    lower.endsWith(".ini") ||
    lower.endsWith(".env") ||
    base === ".env.example"
  ) {
    return "CONFIG";
  }

  if (assetPath.startsWith("public/") || lower.endsWith(".csv")) {
    return "DATA";
  }

  return "OTHER";
}

function classifyAssetRole(assetType) {
  const roles = {
    SOURCE_CODE: "APPLICATION_SOURCE",
    TEST: "TEST_PROOF",
    CONFIG: "CONFIGURATION",
    DOCUMENTATION: "DOCUMENTATION",
    DATABASE_MIGRATION: "DATABASE_MIGRATION",
    DATABASE_SQL: "DATABASE_DEFINITION",
    DATA: "DATA_ASSET",
    DEPLOYMENT: "DEPLOYMENT_CONFIGURATION",
    LEGAL_PRODUCT_TEXT: "LEGAL_OR_PRODUCT_TEXT",
    CONTROL_CENTER: "CONTROL_GOVERNANCE",
    GENERATED: "GENERATED_ARTIFACT",
    OTHER: "UNCLASSIFIED_ASSET_ROLE",
  };

  return roles[assetType];
}

function classifyAuthority(assetType) {
  if (assetType === "CONTROL_CENTER") {
    return "ACTIVE_GOVERNANCE";
  }

  if (assetType === "TEST") {
    return "ACTIVE_AUDIT";
  }

  if (assetType === "LEGAL_PRODUCT_TEXT") {
    return "LEGAL_OR_PRODUCT_TEXT";
  }

  return "UNKNOWN";
}

function sourceStateFor(assetPath, changedPaths) {
  if (
    EPR_IMPLEMENTATION_PATHS.has(assetPath) ||
    ECC_FOUNDATION_PATHS.has(assetPath)
  ) {
    return "ECC_CONTROL_FOUNDATION";
  }

  if (changedPaths.has(assetPath)) {
    return "PRE_EXISTING_MODIFIED";
  }

  return "COMMITTED_REPOSITORY";
}

function ownershipFor(assetPath, projectIds) {
  if (EPR_IMPLEMENTATION_PATHS.has(assetPath)) {
    return {
      owner_project_id: "EPR-001",
      governed_by_control_task_id: "EPR-001",
    };
  }

  if (ECC_FOUNDATION_PATHS.has(assetPath) && projectIds.has("ECC-001")) {
    return {
      owner_project_id: "ECC-001",
      governed_by_control_task_id: "ECC-001",
    };
  }

  return {
    owner_project_id: "UNRESOLVED",
    governed_by_control_task_id: "EPR-001",
  };
}

function buildDefaultAsset(assetPath, projectIds, changedPaths) {
  const assetType = classifyAssetType(assetPath);
  const ownership = ownershipFor(assetPath, projectIds);

  const controlFoundation =
    EPR_IMPLEMENTATION_PATHS.has(assetPath) ||
    ECC_FOUNDATION_PATHS.has(assetPath);

  return {
    asset_path: assetPath,
    asset_type: assetType,
    asset_role: classifyAssetRole(assetType),
    source_state: sourceStateFor(assetPath, changedPaths),
    authority_class: classifyAuthority(assetType),
    current_state: controlFoundation ? "CURRENT" : "UNKNOWN",
    owner_project_id: ownership.owner_project_id,
    governed_by_control_task_id: ownership.governed_by_control_task_id,
    related_assets: [],
    related_tables: [],
    related_functions: [],
    runtime_consumers: [],
    runtime_dependencies: [],
    database_objects: [],
    deployment_surface: [],
    goes_somewhere: controlFoundation ? "YES" : "UNKNOWN",
    known_conflicts: [],
    validation_status: "REGISTERED",
    next_validation: controlFoundation
      ? "Validate with the governing Control Center project proof."
      : "Resolve ownership, purpose, consumers, dependencies, database role, Scout/FIP relationship, conflicts, and governed outcome during project review.",
    notes: controlFoundation
      ? "Control Center foundation asset."
      : "Bootstrap registration only. Registration does not assert correctness, currency, approval, permanence, runtime use, or compatibility with Scout/FIP.",
  };
}

function bootstrap() {
  const trackedPaths = getTrackedPaths();
  const changedPaths = getChangedTrackedPaths();

  const projectRegister = loadJson(PROJECT_REGISTER_PATH);

  const projectIds = new Set(
    projectRegister.projects.map((project) => project.project_id)
  );

  let previous = {
    assets: [],
    explicit_exclusions: [],
  };

  if (fs.existsSync(ASSET_REGISTER_PATH)) {
    previous = loadJson(ASSET_REGISTER_PATH);
  }

  const previousAssets = new Map(
    (previous.assets || []).map((asset) => [
      normalizePath(asset.asset_path),
      asset,
    ])
  );

  const exclusions = Array.isArray(previous.explicit_exclusions)
    ? previous.explicit_exclusions
    : [];

  const excludedPaths = new Set(
    exclusions.map((entry) => normalizePath(entry.asset_path))
  );

  const assets = trackedPaths
    .filter((assetPath) => !excludedPaths.has(assetPath))
    .map((assetPath) => {
      const existing = previousAssets.get(assetPath);

      if (existing) {
        return {
          ...existing,
          asset_path: assetPath,
        };
      }

      return buildDefaultAsset(assetPath, projectIds, changedPaths);
    });

  const register = {
    version: "1.0",
    title: "SKCS Edge Repository Asset Register",
    generated_at: BOOTSTRAP_DATE,
    source_command: "git ls-files",
    coverage_policy:
      "Every tracked repository path must be REGISTERED_ASSET or EXPLICITLY_EXCLUDED. Registration records existence and governance visibility; it does not assert correctness, currency, approval, permanence, consumer presence, or Scout/FIP compatibility.",
    unclassified_tracked_paths_allowed: false,
    tracked_path_count: trackedPaths.length,
    registered_asset_count: assets.length,
    explicit_exclusion_count: exclusions.length,
    assets,
    explicit_exclusions: exclusions,
  };

  writeJson(ASSET_REGISTER_PATH, register);

  console.log(
    `BOOTSTRAP PASS: tracked=${trackedPaths.length} registered=${assets.length} excluded=${exclusions.length}`
  );
}

function loadAssetRegister(filePath = ASSET_REGISTER_PATH) {
  return loadJson(filePath);
}

function validateRegister(register) {
  const errors = [];
  const warnings = [];

  const trackedPaths = getTrackedPaths();
  const trackedSet = new Set(trackedPaths);

  const projectRegister = loadJson(PROJECT_REGISTER_PATH);
  const ledger = loadJson(LEDGER_PATH);

  const projectIds = new Set(
    projectRegister.projects.map((project) => project.project_id)
  );

  const tasks = getLedgerTasks(ledger);
  const taskById = new Map(tasks.map((task) => [taskId(task), task]));

  const assets = Array.isArray(register.assets) ? register.assets : [];

  const exclusions = Array.isArray(register.explicit_exclusions)
    ? register.explicit_exclusions
    : [];

  if (register.version !== "1.0") {
    errors.push(`INVALID_ASSET_REGISTER_VERSION: ${register.version}`);
  }

  if (register.unclassified_tracked_paths_allowed !== false) {
    errors.push("UNCLASSIFIED_TRACKED_PATHS_ALLOWED");
  }

  if (register.tracked_path_count !== trackedPaths.length) {
    errors.push(
      `TRACKED_PATH_COUNT_MISMATCH: declared=${register.tracked_path_count} actual=${trackedPaths.length}`
    );
  }

  if (register.registered_asset_count !== assets.length) {
    errors.push(
      `REGISTERED_ASSET_COUNT_MISMATCH: declared=${register.registered_asset_count} actual=${assets.length}`
    );
  }

  if (register.explicit_exclusion_count !== exclusions.length) {
    errors.push(
      `EXCLUSION_COUNT_MISMATCH: declared=${register.explicit_exclusion_count} actual=${exclusions.length}`
    );
  }

  const seen = new Set();
  const covered = new Set();

  for (const asset of assets) {
    for (const field of REQUIRED_ASSET_FIELDS) {
      if (asset[field] === undefined || asset[field] === null) {
        errors.push(
          `ASSET_REQUIRED_FIELD_MISSING: ${
            asset.asset_path || "?"
          } ${field}`
        );
      }
    }

    if (!asset.asset_path) continue;

    const assetPath = normalizePath(asset.asset_path);

    if (seen.has(assetPath)) {
      errors.push(`DUPLICATE_ASSET_PATH: ${assetPath}`);
      continue;
    }

    seen.add(assetPath);
    covered.add(assetPath);

    if (!trackedSet.has(assetPath)) {
      errors.push(`REGISTERED_ASSET_PATH_MISSING: ${assetPath}`);
    }

    if (!ASSET_TYPES.includes(asset.asset_type)) {
      errors.push(`INVALID_ASSET_TYPE: ${assetPath} ${asset.asset_type}`);
    }

    if (!SOURCE_STATES.includes(asset.source_state)) {
      errors.push(`INVALID_SOURCE_STATE: ${assetPath} ${asset.source_state}`);
    }

    if (!CURRENT_STATES.includes(asset.current_state)) {
      errors.push(`INVALID_CURRENT_STATE: ${assetPath} ${asset.current_state}`);
    }

    if (!AUTHORITY_CLASSES.includes(asset.authority_class)) {
      errors.push(
        `INVALID_AUTHORITY_CLASS: ${assetPath} ${asset.authority_class}`
      );
    }

    if (!GOES_SOMEWHERE_STATES.includes(asset.goes_somewhere)) {
      errors.push(
        `INVALID_GOES_SOMEWHERE_STATE: ${assetPath} ${asset.goes_somewhere}`
      );
    }

    if (!asset.asset_role || !String(asset.asset_role).trim()) {
      errors.push(`ASSET_ROLE_MISSING: ${assetPath}`);
    }

    if (!asset.validation_status || !String(asset.validation_status).trim()) {
      errors.push(
        `ASSET_VALIDATION_STATUS_MISSING: ${assetPath}`
      );
    }

    if (!asset.next_validation || !String(asset.next_validation).trim()) {
      errors.push(`ASSET_NEXT_VALIDATION_MISSING: ${assetPath}`);
    }

    for (const field of ARRAY_FIELDS) {
      if (!Array.isArray(asset[field])) {
        errors.push(
          `ASSET_ARRAY_FIELD_INVALID: ${assetPath} ${field}`
        );
      }
    }

    if (!taskById.has(asset.governed_by_control_task_id)) {
      errors.push(
        `ASSET_CONTROL_TASK_UNKNOWN: ${assetPath} ${asset.governed_by_control_task_id}`
      );
    }

    if (asset.owner_project_id === "UNRESOLVED") {
      const eprTask = taskById.get("EPR-001");
      const eprStatus = eprTask ? taskStatus(eprTask) : null;

      if (
        asset.governed_by_control_task_id !== "EPR-001" ||
        !["APPROVED", "IN_PROGRESS"].includes(eprStatus)
      ) {
        errors.push(
          `ASSET_OWNER_PROJECT_UNKNOWN: ${assetPath} UNRESOLVED outside controlled EPR-001 bootstrap`
        );
      } else {
        warnings.push(`UNRESOLVED_ASSET_OWNER: ${assetPath}`);
      }
    } else if (!projectIds.has(asset.owner_project_id)) {
      errors.push(
        `ASSET_OWNER_PROJECT_UNKNOWN: ${assetPath} ${asset.owner_project_id}`
      );
    }

    if (asset.current_state === "UNKNOWN") {
      warnings.push(`UNKNOWN_ASSET_STATE: ${assetPath}`);
    }

    if (asset.goes_somewhere === "NO") {
      warnings.push(`NO_CONSUMER_ASSET: ${assetPath}`);
    }

    if (Array.isArray(asset.known_conflicts) && asset.known_conflicts.length > 0) {
      warnings.push(`CONFLICT_FINDING: ${assetPath}`);
    }
  }

  for (const exclusion of exclusions) {
    if (!exclusion || !exclusion.asset_path || !exclusion.reason) {
      errors.push("INVALID_EXPLICIT_EXCLUSION");
      continue;
    }

    const excludedPath = normalizePath(exclusion.asset_path);

    if (seen.has(excludedPath)) {
      errors.push(`DUPLICATE_ASSET_PATH: ${excludedPath}`);
      continue;
    }

    seen.add(excludedPath);
    covered.add(excludedPath);

    if (!trackedSet.has(excludedPath)) {
      errors.push(
        `EXPLICITLY_EXCLUDED_PATH_MISSING: ${excludedPath}`
      );
    }
  }

  for (const trackedPath of trackedPaths) {
    if (!covered.has(trackedPath)) {
      errors.push(`TRACKED_ASSET_UNREGISTERED: ${trackedPath}`);
      errors.push(`UNCLASSIFIED_TRACKED_PATH: ${trackedPath}`);
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    assets,
    exclusions,
    trackedPaths,
  };
}

function runCheck() {
  return validateRegister(loadAssetRegister());
}

function printReport(result) {
  const unresolved = result.warnings.filter(
    (warning) => warning.startsWith("UNRESOLVED_ASSET_OWNER:")
  ).length;

  const unknown = result.warnings.filter(
    (warning) => warning.startsWith("UNKNOWN_ASSET_STATE:")
  ).length;

  const noConsumer = result.warnings.filter(
    (warning) => warning.startsWith("NO_CONSUMER_ASSET:")
  ).length;

  const conflicts = result.warnings.filter(
    (warning) => warning.startsWith("CONFLICT_FINDING:")
  ).length;

  console.log("=== SKCS Edge Repository Asset Register Check ===");
  console.log(`Tracked paths: ${result.trackedPaths.length}`);
  console.log(`Registered assets: ${result.assets.length}`);
  console.log(`Explicit exclusions: ${result.exclusions.length}`);
  console.log("");
  console.log("Governed cleanup findings (non-fatal):");
  console.log(`  Unresolved owners: ${unresolved}`);
  console.log(`  Unknown states: ${unknown}`);
  console.log(`  No-consumer findings: ${noConsumer}`);
  console.log(`  Conflict findings: ${conflicts}`);

  if (result.errors.length) {
    console.log("");
    console.log("ERRORS:");

    for (const error of result.errors) {
      console.log(`  ✗ ${error}`);
    }
  }

  console.log("");
  console.log(result.passed ? "RESULT: PASS" : "RESULT: FAIL");

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
  ASSET_TYPES,
  SOURCE_STATES,
  CURRENT_STATES,
  AUTHORITY_CLASSES,
  GOES_SOMEWHERE_STATES,
  REQUIRED_ASSET_FIELDS,
  ARRAY_FIELDS,
  ASSET_REGISTER_PATH,
  PROJECT_REGISTER_PATH,
  normalizePath,
  getTrackedPaths,
  loadAssetRegister,
  validateRegister,
  runCheck,
};
