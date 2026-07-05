#!/usr/bin/env node

"use strict";

// ESA-001 static inventory checker
// Observational only: no runtime execution and no importing discovered files.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");

const LEDGER_PATH = path.join(
  ROOT,
  "control-center",
  "EDGE_BUILD_CONTROL_LEDGER.v1.json"
);
const ASSET_REGISTER_PATH = path.join(
  ROOT,
  "control-center",
  "EDGE_REPOSITORY_ASSET_REGISTER.v1.json"
);
const INVENTORY_PATH = path.join(
  ROOT,
  "control-center",
  "EDGE_SYSTEM_RUNTIME_INVENTORY.v1.json"
);
const MAP_PATH = path.join(
  ROOT,
  "control-center",
  "EDGE_SYSTEM_RUNTIME_MAP.md"
);

const SURFACE_CLASSES = new Set([
  "RUNTIME_ENTRY_POINT",
  "ROUTE",
  "CONTROLLER",
  "SERVICE",
  "EXTERNAL_PROVIDER",
  "SCOUT_FIP_SURFACE",
  "DATABASE_SURFACE",
  "SCHEDULED_EXECUTION",
  "DEPLOYMENT_SURFACE",
  "GOVERNANCE_ENFORCEMENT",
]);

const REACHABILITY_STATES = new Set([
  "CONFIRMED",
  "CANDIDATE",
  "LEGACY",
  "PARALLEL",
  "UNREACHABLE",
  "UNKNOWN",
  "UNRESOLVED",
]);

const DATABASE_ROLES = new Set([
  "NONE",
  "READ",
  "WRITE",
  "READ_WRITE",
  "RPC",
  "CONNECTION_OR_CLIENT",
  "MIGRATION",
  "TRIGGER",
  "SCHEMA",
  "SEED",
  "MANUAL_TOOL",
  "UNKNOWN",
]);

const GOVERNANCE_REACHABILITY_TYPES = new Set([
  "NONE",
  "RUNTIME",
  "DATABASE",
  "BUILD_GATE",
  "AUDIT_TOOL",
  "TEST_PROOF",
  "DOCUMENT_ONLY",
  "UNKNOWN",
]);

const REQUIRED_ARRAY_FIELDS = [
  "runtime_callers",
  "runtime_consumers",
  "runtime_dependencies",
  "external_providers",
  "environment_key_names",
  "database_objects",
  "evidence",
];

const INVENTORY_SEMANTICS_DEFAULTS = {
  candidate_status_establishes_current_authority: false,
  relationships_establish_authority_precedence: false,
  inventory_declares_future_architecture: false,
  provider_reachability_establishes_retention: false,
  scout_fip_visibility_activates_marriage: false,
  database_visibility_establishes_retention: false,
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readTextIfPresent(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) return "";
  if (!fs.statSync(filePath).isFile()) return "";
  return fs.readFileSync(filePath, "utf8");
}

function normalizePath(value) {
  return String(value || "").replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean).map(normalizePath))].sort();
}

function gitLines(args) {
  const output = execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return output
    .split(/\r?\n/u)
    .map((line) => normalizePath(line.trim()))
    .filter(Boolean);
}

function trackedPaths() {
  return uniqueSorted(gitLines(["ls-files"]));
}

function extractLedgerTasks(ledger) {
  if (Array.isArray(ledger.tasks)) return ledger.tasks;
  for (const v of Object.values(ledger)) {
    if (!Array.isArray(v)) continue;
    if (
      v.every(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          (typeof entry.id === "string" ||
            typeof entry.task_id === "string" ||
            typeof entry.project_id === "string")
      )
    ) {
      return v;
    }
  }
  throw new Error("Unable to locate canonical ledger task array");
}

function taskId(task) {
  return task.id || task.task_id || task.project_id || "";
}

function getWorkspaceCandidates(assetRegister) {
  const snap = assetRegister.workspace_candidate_snapshot;
  const candidates = snap && Array.isArray(snap.candidates) ? snap.candidates : [];
  return candidates;
}

function governedCandidatePaths(assetRegister) {
  return uniqueSorted(
    getWorkspaceCandidates(assetRegister)
      .filter((c) => c.candidate_disposition === "PRESERVED_CANDIDATE")
      .map((c) => c.asset_path)
  );
}

function authorityCandidatePaths(assetRegister) {
  const graph = assetRegister.rule_authority_candidate_graph;
  const nodes = graph && Array.isArray(graph.nodes) ? graph.nodes : [];
  return new Set(nodes.map((n) => normalizePath(n.asset_path)).filter(Boolean));
}

function candidateUniverse(assetRegister) {
  return uniqueSorted([...trackedPaths(), ...governedCandidatePaths(assetRegister)]);
}

function isCodeLike(relativePath) {
  return /\.(?:js|cjs|mjs|ts|tsx|py)$/iu.test(relativePath);
}

function resolveLocalModule(fromRelativePath, request) {
  const base = path.posix.normalize(
    path.posix.join(path.posix.dirname(fromRelativePath), request)
  );
  const attempts = [
    base,
    `${base}.js`,
    `${base}.cjs`,
    `${base}.mjs`,
    `${base}.ts`,
    `${base}.py`,
    path.posix.join(base, "index.js"),
  ];
  const resolved = attempts.find((attempt) =>
    fs.existsSync(path.join(ROOT, attempt))
  );
  return resolved ? normalizePath(resolved) : null;
}

function localDependencies(relativePath, source) {
  const dependencies = [];
  const patterns = [
    /require\(\s*["'](\.[^"']+)["']\s*\)/gu,
    /from\s+["'](\.[^"']+)["']/gu,
    /import\s+["'](\.[^"']+)["']/gu,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const request = match[1];
      const resolved = resolveLocalModule(relativePath, request);
      if (resolved) dependencies.push(resolved);
    }
  }

  return uniqueSorted(dependencies);
}

function packageRuntimeRoots() {
  const packageJson = readJson(path.join(ROOT, "package.json"));
  const roots = [];

  for (const [name, command] of Object.entries(packageJson.scripts || {})) {
    if (!["start", "dev"].includes(name)) continue;
    const matches = String(command).matchAll(
      /\b(?:node|nodemon)\s+([^\s;&|]+)/gu
    );
    for (const m of matches) roots.push(normalizePath(m[1]));
  }

  return uniqueSorted(roots);
}

function deploymentRuntimeRoots(universe) {
  const roots = [];
  const renderText = readTextIfPresent("render.yaml");
  const vercelText = readTextIfPresent("vercel.json");

  const sources = [
    renderText ? ["render.yaml", renderText] : null,
    vercelText ? ["vercel.json", vercelText] : null,
  ].filter(Boolean);

  for (const [, source] of sources) {
    for (const match of source.matchAll(
      /\b(?:node|nodemon)\s+([A-Za-z0-9_./-]+\.(?:js|cjs|mjs|ts|py))/gu
    )) {
      roots.push(normalizePath(match[1]));
    }
  }

  return uniqueSorted(roots);
}

function discoverReachableGraph(roots) {
  const discovered = new Set();
  const queue = [...roots];

  while (queue.length > 0) {
    const current = normalizePath(queue.shift());
    if (!current || discovered.has(current)) continue;
    if (!fs.existsSync(path.join(ROOT, current))) continue;
    if (!isCodeLike(current)) continue;

    discovered.add(current);
    const source = readTextIfPresent(current);

    for (const dep of localDependencies(current, source)) {
      if (!discovered.has(dep)) queue.push(dep);
    }
  }

  return uniqueSorted([...discovered]);
}

function extractEnvironmentKeyNames(source) {
  const names = [];
  for (const match of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/gu)) {
    names.push(match[1]);
  }
  for (const match of source.matchAll(
    /process\.env\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\]/gu
  )) {
    names.push(match[1]);
  }
  return [...new Set(names)].sort();
}

function extractProviderHosts(source) {
  const hosts = [];
  for (const match of source.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/gu)) {
    const host = match[1].toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local")
    ) {
      continue;
    }
    hosts.push(host);
  }
  return [...new Set(hosts)].sort();
}

function extractDatabaseObjects(source) {
  const objects = [];
  const patterns = [
    /\.from\(\s*["']([^"']+)["']\s*\)/gu,
    /\.rpc\(\s*["']([^"']+)["']\s*/gu,
    /\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+["'`]?([A-Za-z_][A-Za-z0-9_.]*)/giu,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      objects.push(match[1]);
    }
  }
  return [...new Set(objects)].sort();
}

function detectDatabaseRole(relativePath, source) {
  if (/\/migrations?\//iu.test(`/${relativePath}`)) return "MIGRATION";
  if (/trigger/iu.test(relativePath) && /\.sql$/iu.test(relativePath))
    return "TRIGGER";
  if (/schema/iu.test(relativePath) && /\.sql$/iu.test(relativePath))
    return "SCHEMA";
  if (/seed/iu.test(relativePath)) return "SEED";

  const hasClient =
    /\bcreateClient\s*\(/u.test(source) ||
    /\bnew\s+Pool\s*\(/u.test(source) ||
    /\bnew\s+Client\s*\(/u.test(source);

  const hasRead =
    /\.select\s*\(/u.test(source) || /\bSELECT\b/iu.test(source) || /\.rpc\s*\(/u.test(source);

  const hasWrite =
    /\.(?:insert|upsert|update|delete)\s*\(/iu.test(source) ||
    /\b(?:INSERT|UPDATE|DELETE)\b/iu.test(source);

  if (hasRead && hasWrite) return "READ_WRITE";
  if (hasWrite) return "WRITE";
  if (hasRead) return "READ";
  if (/\.rpc\s*\(/u.test(source)) return "RPC";
  if (hasClient) return "CONNECTION_OR_CLIENT";
  return "NONE";
}

function isScheduledExecution(relativePath, source) {
  return (
    /cron\.schedule\s*\(/u.test(source) ||
    /\bsetInterval\s*\(/u.test(source) ||
    /\bsetImmediate\s*\(/u.test(source) ||
    /scheduler/iu.test(relativePath)
  );
}

function isScoutFipDiscoveryInfrastructurePath(relativePath) {
  return (
    relativePath.startsWith("control-center/") ||
    relativePath.startsWith("tests/")
  );
}

function isScoutFipSurface(relativePath, source) {
  if (isScoutFipDiscoveryInfrastructurePath(relativePath)) {
    return false;
  }

  return (
    /scout|fixture intelligence package|\bfip\b|SCOUT_DATABASE_URL|scout_raw_match_signals/iu.test(
      `${relativePath}\n${source}`
    )
  );
}

function discoverRouteMounts(serverPath, reachableRootsSet) {
  const source = readTextIfPresent(serverPath);
  const mounts = [];

  const requireVarToAsset = new Map();
  for (const match of source.matchAll(
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*["'](\.[^"']+)["']\s*\)/gu
  )) {
    const variable = match[1];
    const request = match[2];
    const resolved = resolveLocalModule(serverPath, request);
    if (resolved && reachableRootsSet.has(resolved)) requireVarToAsset.set(variable, resolved);
  }

  for (const match of source.matchAll(
    /app\.use\(\s*["']([^"']+)["']\s*,\s*([A-Za-z_$][\w$]*)/gu
  )) {
    const mountPath = match[1];
    const variable = match[2];
    const asset_path = requireVarToAsset.get(variable);
    if (asset_path) {
      mounts.push({ mount_path: mountPath, asset_path });
    }
  }

  return mounts;
}

function renderRuntimeMap(inventory) {
  const hash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        inventory_version: inventory.inventory_version,
        source_contract: inventory.source_contract,
        semantics: inventory.semantics,
        surfaces: [...inventory.surfaces].sort((a, b) =>
          String(a.asset_path).localeCompare(String(b.asset_path))
        ),
      })
    )
    .digest("hex");

  const lines = [
    "# Edge System Runtime Map",
    "",
    `Inventory version: ${inventory.inventory_version}`,
    `Inventory SHA-256: ${hash}`,
    "",
    "> Synchronized review surface for `EDGE_SYSTEM_RUNTIME_INVENTORY.v1.json`.",
    "> This map is observational and does not declare future Edge architecture or canonical authority.",
    "",
    "## Summary",
    "",
    `- Runtime/system surfaces: ${inventory.surfaces.length}`,
    `- Candidate status establishes authority: ${inventory.semantics.candidate_status_establishes_current_authority}`,
    `- Inventory declares future architecture: ${inventory.semantics.inventory_declares_future_architecture}`,
    "",
    "## Surfaces",
    "",
  ];

  const sortedSurfaces = [...inventory.surfaces].sort((a, b) =>
    String(a.asset_path).localeCompare(String(b.asset_path))
  );

  for (const surface of sortedSurfaces) {
    lines.push(`### ${surface.asset_path}`);
    lines.push("");
    lines.push(
      `- Surface classes: ${Array.isArray(surface.surface_classes) ? surface.surface_classes.join(", ") : ""}`
    );
    lines.push(`- Reachability: ${surface.reachability_state}`);
    lines.push(`- Source state: ${surface.source_state}`);
    lines.push(`- Governed by: ${surface.governed_by_control_task_id}`);
    lines.push(
      `- Runtime callers: ${
        surface.runtime_callers && surface.runtime_callers.length
          ? surface.runtime_callers.join(", ")
          : "None recorded"
      }`
    );
    lines.push(
      `- Runtime consumers: ${
        surface.runtime_consumers && surface.runtime_consumers.length
          ? surface.runtime_consumers.join(", ")
          : "None recorded"
      }`
    );
    lines.push(`- Database role: ${surface.database_role}`);
    lines.push(
      `- Database objects: ${
        surface.database_objects && surface.database_objects.length
          ? surface.database_objects.join(", ")
          : "None recorded"
      }`
    );
    lines.push(
      `- External providers: ${
        surface.external_providers && surface.external_providers.length
          ? surface.external_providers.join(", ")
          : "None recorded"
      }`
    );
    lines.push(`- Next validation: ${surface.next_validation}`);
    lines.push("");
  }

  // Avoid emitting a trailing blank line (which would create an extra `\n` at EOF).
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return `${lines.join("\n")}\n`;
}

function sourceStateForPath(assetRegister, relativePath) {
  const asset = (assetRegister.assets || []).find(
    (a) => normalizePath(a.asset_path) === normalizePath(relativePath)
  );
  if (asset && asset.source_state) return asset.source_state;

  const cand = getWorkspaceCandidates(assetRegister).find(
    (c) => normalizePath(c.asset_path) === normalizePath(relativePath)
  );
  if (cand) return "PRE_EXISTING_UNTRACKED";

  return "COMMITTED_REPOSITORY";
}

function discoverMaterialSurfaces(assetRegister) {
  const universe = candidateUniverse(assetRegister);
  const packageRoots = packageRuntimeRoots();
  const deploymentRoots = deploymentRuntimeRoots(universe);
  const runtimeRoots = uniqueSorted([...packageRoots, ...deploymentRoots]);

  const reachableList = discoverReachableGraph(runtimeRoots);
  const reachable = new Set(reachableList);
  const reachableRootsSet = new Set(reachableList);
  for (const root of runtimeRoots) reachableRootsSet.add(root);

  const ruleAuthPaths = authorityCandidatePaths(assetRegister);

  // Mount discovery only from likely server entry points.
  const routeMounts = [];
  for (const root of runtimeRoots) {
    if (!String(root).startsWith("backend/server")) continue;
    routeMounts.push(...discoverRouteMounts(root, reachableRootsSet));
  }

  const getMountedPathsFor = (assetPath) =>
    routeMounts.filter((m) => normalizePath(m.asset_path) === normalizePath(assetPath)).map((m) => m.mount_path).sort();

  const surfaces = [];

  for (const relativePath of universe) {
    // Avoid scanning binaries/zips/archives as UTF-8, which can produce massive false positives.
    // Discovery must be observational only, so for non-text artifacts we treat "source" as empty.
    const isCodeLikeFile = isCodeLike(relativePath);
    const isSqlFile = /\.sql$/iu.test(relativePath);
    const isYamlOrJsonConfig =
      relativePath === "render.yaml" ||
      relativePath === "vercel.json" ||
      relativePath === "package.json";
    const isDock = /^Dockerfile(?:\.|$)/u.test(path.posix.basename(relativePath));
    const isYamlOrJson = /\.ya?ml$/iu.test(relativePath) || /\.json$/iu.test(relativePath);

    const isTextLike =
      isCodeLikeFile ||
      isSqlFile ||
      isYamlOrJsonConfig ||
      isDock ||
      isYamlOrJson;

    const source = isTextLike ? readTextIfPresent(relativePath) : "";

    const classes = new Set();
    if (runtimeRoots.includes(relativePath)) classes.add("RUNTIME_ENTRY_POINT");
    if (relativePath.startsWith("backend/routes/")) classes.add("ROUTE");
    if (relativePath.startsWith("backend/controllers/")) classes.add("CONTROLLER");
    if (relativePath.startsWith("backend/services/")) classes.add("SERVICE");

    // Only extract env/provider/db evidence from code or sql.
    const envKeyNames = isCodeLikeFile ? extractEnvironmentKeyNames(source) : [];
    const providerHosts = isCodeLikeFile ? extractProviderHosts(source) : [];

    if (providerHosts.length > 0 && reachable.has(relativePath)) {
      classes.add("EXTERNAL_PROVIDER");
    }

    if (isCodeLikeFile && isScoutFipSurface(relativePath, source)) {
      classes.add("SCOUT_FIP_SURFACE");
    }

    const databaseRole = isCodeLikeFile || isSqlFile
      ? detectDatabaseRole(relativePath, source)
      : "NONE";
    if (databaseRole !== "NONE") {
      classes.add("DATABASE_SURFACE");
    }

    if (isScheduledExecution(relativePath, source)) {
      classes.add("SCHEDULED_EXECUTION");
    }

    if (
      relativePath === "render.yaml" ||
      relativePath === "vercel.json" ||
      relativePath === "package.json" ||
      /^Dockerfile(?:\.|$)/u.test(path.posix.basename(relativePath))
    ) {
      classes.add("DEPLOYMENT_SURFACE");
    }

    if (ruleAuthPaths.has(relativePath)) {
      classes.add("GOVERNANCE_ENFORCEMENT");
    }

    const classArr = [...classes].sort();

    const reachability_state = reachable.has(relativePath)
      ? "CONFIRMED"
      : "CANDIDATE";

    const material =
      classArr.length > 0 &&
      (reachable.has(relativePath) ||
        classArr.includes("SCOUT_FIP_SURFACE") ||
        classArr.includes("DEPLOYMENT_SURFACE") ||
        classArr.includes("GOVERNANCE_ENFORCEMENT") ||
        databaseRole !== "NONE" && ["MIGRATION","TRIGGER","SCHEMA","SEED"].includes(databaseRole));

    if (!material) continue;

    const runtime_dependencies = localDependencies(relativePath, source);
    const runtime_consumers = uniqueSorted(
      [...reachable].filter((candidate) => {
        const candidateSource = readTextIfPresent(candidate);
        return localDependencies(candidate, candidateSource).includes(relativePath);
      })
    );

    const surface = {
      asset_path: relativePath,
      source_state: sourceStateForPath(assetRegister, relativePath),
      surface_classes: classArr,
      reachability_state,
      mount_paths: getMountedPathsFor(relativePath),

      runtime_callers: [],
      runtime_consumers,
      runtime_dependencies,

      external_providers: providerHosts,
      environment_key_names: envKeyNames,
      database_role: databaseRole,
      database_objects:
        databaseRole !== "NONE" || isSqlFile ? extractDatabaseObjects(source) : [],

      schedule_or_trigger: "",
      deployment_surface: "",

      governance_reachability_type: ruleAuthPaths.has(relativePath)
        ? reachable.has(relativePath)
          ? "RUNTIME"
          : "DOCUMENT_ONLY"
        : "NONE",

      governed_by_control_task_id: "ESA-001",
      next_validation:
        "Revalidate runtime reachability and relationships during the next governed Edge architecture review.",

      evidence: ["Static package/deployment/import/mount evidence."],

      notes:
        "Current-state inventory evidence only; this record does not declare future Edge architecture.",
    };

    surfaces.push(surface);
  }

  return surfaces.sort((a, b) => a.asset_path.localeCompare(b.asset_path));
}

function validateInventory({ ledger, assetRegister, inventory, mapText }) {
  const errors = [];
  const warnings = [];

  const tasks = extractLedgerTasks(ledger);
  const knownTaskIds = new Set(tasks.map(taskId).filter(Boolean));

  if (inventory.inventory_version !== "1.0.0") {
    errors.push("INVALID_RUNTIME_INVENTORY_VERSION");
  }

  if (
    !inventory.source_contract ||
    inventory.source_contract.control_task_id !== "ESA-001"
  ) {
    errors.push("INVALID_RUNTIME_INVENTORY_SOURCE_CONTRACT");
  }

  const semantics = inventory.semantics || {};

  if (semantics.candidate_status_establishes_current_authority !== false) {
    errors.push("CANDIDATE_STATUS_ESTABLISHES_AUTHORITY");
  }
  if (semantics.relationships_establish_authority_precedence !== false) {
    errors.push(
      "INVENTORY_RELATIONSHIP_ESTABLISHES_AUTHORITY_PRECEDENCE"
    );
  }
  if (semantics.inventory_declares_future_architecture !== false) {
    errors.push("INVENTORY_DECLARES_FUTURE_ARCHITECTURE");
  }

  if (!Array.isArray(inventory.surfaces)) {
    errors.push("RUNTIME_SURFACES_NOT_ARRAY");
    return { errors, warnings, discovered: [] };
  }

  if (typeof mapText !== "string") {
    errors.push("RUNTIME_MAP_TEXT_MISSING");
  }

  // Validate inventory surfaces schema.
  for (const surface of inventory.surfaces) {
    if (!surface || typeof surface !== "object") {
      errors.push("RUNTIME_SURFACE_INVALID_OBJECT");
      continue;
    }

    if (!surface.asset_path || !String(surface.asset_path).trim()) {
      errors.push("RUNTIME_SURFACE_PATH_MISSING");
      continue;
    }

    if (!Array.isArray(surface.surface_classes) || surface.surface_classes.length === 0) {
      errors.push(`RUNTIME_SURFACE_CLASS_MISSING: ${surface.asset_path}`);
    } else {
      for (const c of surface.surface_classes) {
        if (!SURFACE_CLASSES.has(c)) {
          errors.push(`INVALID_RUNTIME_SURFACE_CLASS: ${surface.asset_path} ${c}`);
        }
      }
    }

    if (!REACHABILITY_STATES.has(surface.reachability_state)) {
      errors.push(
        `INVALID_RUNTIME_REACHABILITY_STATE: ${surface.asset_path} ${surface.reachability_state}`
      );
    }

    if (!DATABASE_ROLES.has(surface.database_role)) {
      errors.push(`INVALID_DATABASE_ROLE: ${surface.asset_path} ${surface.database_role}`);
    }

    if (!GOVERNANCE_REACHABILITY_TYPES.has(surface.governance_reachability_type)) {
      errors.push(
        `INVALID_GOVERNANCE_REACHABILITY_TYPE: ${surface.asset_path} ${surface.governance_reachability_type}`
      );
    }

    for (const field of REQUIRED_ARRAY_FIELDS) {
      if (!Array.isArray(surface[field])) {
        errors.push(
          `RUNTIME_SURFACE_ARRAY_FIELD_INVALID: ${surface.asset_path} ${field}`
        );
      }
    }

    const governedTaskId = String(surface.governed_by_control_task_id || "").trim();
    if (!knownTaskIds.has(governedTaskId)) {
      errors.push(`RUNTIME_CONTROL_TASK_UNKNOWN: ${surface.asset_path} ${governedTaskId || "(empty)"}`);
    }

    if (
      ["UNKNOWN", "UNRESOLVED"].includes(surface.reachability_state) &&
      !String(surface.next_validation || "").trim()
    ) {
      errors.push(`RUNTIME_NEXT_VALIDATION_MISSING: ${surface.asset_path}`);
    }

    if (
      Array.isArray(surface.environment_key_names) &&
      surface.environment_key_names.some(
        (name) => typeof name !== "string" || !/^[A-Z][A-Z0-9_]*$/u.test(name)
      )
    ) {
      errors.push(`INVALID_ENVIRONMENT_KEY_NAME: ${surface.asset_path}`);
    }

    if (
      Object.prototype.hasOwnProperty.call(surface, "environment_values") ||
      Object.prototype.hasOwnProperty.call(surface, "secret_values") ||
      Object.prototype.hasOwnProperty.call(surface, "api_keys")
    ) {
      errors.push(`SECRET_VALUE_FIELD_FORBIDDEN: ${surface.asset_path}`);
    }
  }

  // Completeness + fail-closed: every discovered material surface must exist in the inventory.
  const discovered = discoverMaterialSurfaces(assetRegister);
  const discoveredByPath = new Map(discovered.map((s) => [normalizePath(s.asset_path), s]));

  const inventoryByPath = new Map(
    inventory.surfaces.map((s) => [normalizePath(s.asset_path), s])
  );

  for (const discoveredSurface of discovered) {
    const assetPath = normalizePath(discoveredSurface.asset_path);
    const inv = inventoryByPath.get(assetPath);
    if (!inv) {
      errors.push(`MATERIAL_RUNTIME_SURFACE_UNGOVERNED: ${discoveredSurface.asset_path}`);
      continue;
    }

    for (const surfaceClass of discoveredSurface.surface_classes) {
      if (!inv.surface_classes.includes(surfaceClass)) {
        errors.push(
          `DISCOVERED_RUNTIME_CLASS_MISSING: ${discoveredSurface.asset_path} ${surfaceClass}`
        );
      }
    }
  }

  // Map sync
  const expectedMap = renderRuntimeMap(inventory);
  if (mapText !== expectedMap) {
    errors.push("RUNTIME_MAP_OUT_OF_SYNC");
  }

  // Unknown/unresolved governance findings are governed (warnings only).
  for (const surface of inventory.surfaces) {
    if (["LEGACY", "PARALLEL", "UNREACHABLE", "UNKNOWN", "UNRESOLVED"].includes(surface.reachability_state)) {
      warnings.push(`RUNTIME_REVIEW_FINDING: ${surface.asset_path} ${surface.reachability_state}`);
    }
  }

  return { errors, warnings, discovered: discoveredByPath.size ? discovered : discovered };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const ledger = readJson(LEDGER_PATH);
  const assetRegister = readJson(ASSET_REGISTER_PATH);

  if (args.has("--discover")) {
    const surfaces = discoverMaterialSurfaces(assetRegister);

    if (args.has("--write-inventory")) {
      const existing = fs.existsSync(INVENTORY_PATH)
        ? readJson(INVENTORY_PATH)
        : null;

      const inventory =
        existing && existing.surfaces && Array.isArray(existing.surfaces)
          ? existing
          : {
              inventory_version: "1.0.0",
              source_contract: {
                control_task_id: "ESA-001",
                repository_asset_truth:
                  "control-center/EDGE_REPOSITORY_ASSET_REGISTER.v1.json",
                inventory_scope:
                  "CURRENT_STATE_STATIC_RUNTIME_AND_SYSTEM_REACHABILITY",
              },
              semantics: { ...INVENTORY_SEMANTICS_DEFAULTS },
              surfaces: [],
            };

      inventory.surfaces = surfaces;
      if (!inventory.semantics) inventory.semantics = { ...INVENTORY_SEMANTICS_DEFAULTS };
      fs.writeFileSync(
        INVENTORY_PATH,
        `${JSON.stringify(inventory, null, 2)}\n`,
        "utf8"
      );
      return;
    }

    process.stdout.write(`${JSON.stringify(surfaces, null, 2)}\n`);
    return;
  }

  if (args.has("--render-map")) {
    const inventory = readJson(INVENTORY_PATH);
    const mapText = renderRuntimeMap(inventory);

    if (args.has("--write-map")) {
      fs.writeFileSync(MAP_PATH, mapText, "utf8");
      return;
    }

    process.stdout.write(mapText);
    return;
  }

  if (!fs.existsSync(INVENTORY_PATH)) {
    console.error("Missing inventory file: EDGE_SYSTEM_RUNTIME_INVENTORY.v1.json");
    process.exitCode = 1;
    return;
  }

  const inventory = readJson(INVENTORY_PATH);
  const mapText = fs.existsSync(MAP_PATH) ? fs.readFileSync(MAP_PATH, "utf8") : "";

  const result = validateInventory({
    ledger,
    assetRegister,
    inventory,
    mapText,
  });

  console.log("ESA-001 — EDGE SYSTEM RUNTIME INVENTORY");
  console.log(`Inventory surfaces: ${inventory.surfaces.length}`);
  console.log(`Discovered surfaces: ${result.discovered.length}`);
  console.log(`Warnings: ${result.warnings.length}`);

  if (result.errors.length) {
    for (const e of result.errors) console.error(`ERROR: ${e}`);
    console.log("RESULT: FAIL");
    process.exitCode = 1;
    return;
  }

  console.log("RESULT: PASS");
}

if (require.main === module) {
  main();
}

module.exports = {
  discoverMaterialSurfaces,
  renderRuntimeMap,
  validateInventory,
  isScoutFipSurface,
};
