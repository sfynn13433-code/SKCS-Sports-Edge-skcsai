"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  discoverMaterialSurfaces,
  renderRuntimeMap,
  validateInventory,
  detectDatabaseRole,
  detectDeploymentSurface,
  extractScheduleOrTrigger,
  isScoutFipSurface,
  extractDatabaseObjects,
  detectGovernanceReachability,
  compareRelationshipEvidence,
} = require("../control-center/check_edge_system_runtime_inventory");

const ROOT = path.resolve(__dirname, "..");

const ledger = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, "control-center", "EDGE_BUILD_CONTROL_LEDGER.v1.json"),
    "utf8"
  )
);

const assetRegister = JSON.parse(
  fs.readFileSync(
    path.join(
      ROOT,
      "control-center",
      "EDGE_REPOSITORY_ASSET_REGISTER.v1.json"
    ),
    "utf8"
  )
);

const canonicalInventory = JSON.parse(
  fs.readFileSync(
    path.join(
      ROOT,
      "control-center",
      "EDGE_SYSTEM_RUNTIME_INVENTORY.v1.json"
    ),
    "utf8"
  )
);

const canonicalMap = fs.readFileSync(
  path.join(ROOT, "control-center", "EDGE_SYSTEM_RUNTIME_MAP.md"),
  "utf8"
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validate(inventory, mapText = renderRuntimeMap(inventory)) {
  return validateInventory({
    ledger,
    assetRegister,
    inventory,
    mapText,
  });
}

test("canonical ESA-001 runtime inventory passes integrity validation", () => {
  const result = validateInventory({
    ledger,
    assetRegister,
    inventory: canonicalInventory,
    mapText: canonicalMap,
  });

  assert.deepEqual(result.errors, []);
});

test("all statically discovered material runtime surfaces are governed", () => {
  const discovered = discoverMaterialSurfaces(assetRegister);
  const governedPaths = new Set(
    canonicalInventory.surfaces.map((surface) => surface.asset_path)
  );

  const missing = discovered
    .map((surface) => surface.asset_path)
    .filter((assetPath) => !governedPaths.has(assetPath));

  assert.deepEqual(missing, []);
});

test("silently removing a material runtime surface fails closed", () => {
  const discovered = discoverMaterialSurfaces(assetRegister);
  assert.ok(discovered.length > 0);

  const inventory = clone(canonicalInventory);
  inventory.surfaces = inventory.surfaces.filter(
    (surface) => surface.asset_path !== discovered[0].asset_path
  );

  const result = validate(inventory);

  assert.ok(
    result.errors.some((error) =>
      error.startsWith("MATERIAL_RUNTIME_SURFACE_UNGOVERNED:")
    )
  );
});

test("unknown Control Center task binding fails closed", () => {
  const inventory = clone(canonicalInventory);
  assert.ok(inventory.surfaces.length > 0);

  inventory.surfaces[0].governed_by_control_task_id =
    "UNKNOWN-FAKE-TASK";

  const result = validate(inventory);

  assert.ok(
    result.errors.some((error) =>
      error.startsWith("RUNTIME_CONTROL_TASK_UNKNOWN:")
    )
  );
});

test("UNKNOWN runtime relationship requires next_validation", () => {
  const inventory = clone(canonicalInventory);
  assert.ok(inventory.surfaces.length > 0);

  inventory.surfaces[0].reachability_state = "UNKNOWN";
  inventory.surfaces[0].next_validation = "";

  const result = validate(inventory);

  assert.ok(
    result.errors.some((error) =>
      error.startsWith("RUNTIME_NEXT_VALIDATION_MISSING:")
    )
  );
});

test("UNRESOLVED runtime relationship requires next_validation", () => {
  const inventory = clone(canonicalInventory);
  assert.ok(inventory.surfaces.length > 0);

  inventory.surfaces[0].reachability_state = "UNRESOLVED";
  inventory.surfaces[0].next_validation = "";

  const result = validate(inventory);

  assert.ok(
    result.errors.some((error) =>
      error.startsWith("RUNTIME_NEXT_VALIDATION_MISSING:")
    )
  );
});

test("candidate status cannot establish current authority", () => {
  const inventory = clone(canonicalInventory);

  inventory.semantics.candidate_status_establishes_current_authority =
    true;

  const result = validate(inventory);

  assert.ok(
    result.errors.includes("CANDIDATE_STATUS_ESTABLISHES_AUTHORITY")
  );
});

test("runtime inventory cannot declare future architecture", () => {
  const inventory = clone(canonicalInventory);

  inventory.semantics.inventory_declares_future_architecture = true;

  const result = validate(inventory);

  assert.ok(
    result.errors.includes("INVENTORY_DECLARES_FUTURE_ARCHITECTURE")
  );
});

test("inventory relationships cannot establish authority precedence", () => {
  const inventory = clone(canonicalInventory);

  inventory.semantics.relationships_establish_authority_precedence = true;

  const result = validate(inventory);

  assert.ok(
    result.errors.includes(
      "INVENTORY_RELATIONSHIP_ESTABLISHES_AUTHORITY_PRECEDENCE"
    )
  );
});

test("secret value fields are forbidden from runtime inventory", () => {
  const inventory = clone(canonicalInventory);
  assert.ok(inventory.surfaces.length > 0);

  inventory.surfaces[0].api_keys = ["DO_NOT_STORE_SECRET_VALUES"];

  const result = validate(inventory);

  assert.ok(
    result.errors.some((error) =>
      error.startsWith("SECRET_VALUE_FIELD_FORBIDDEN:")
    )
  );
});

test("human-readable runtime map must remain synchronized", () => {
  const result = validateInventory({
    ledger,
    assetRegister,
    inventory: canonicalInventory,
    mapText: `${canonicalMap}\nmanual drift\n`,
  });

  assert.ok(result.errors.includes("RUNTIME_MAP_OUT_OF_SYNC"));
});

test("canonical map exactly matches deterministic inventory rendering", () => {
  assert.equal(canonicalMap, renderRuntimeMap(canonicalInventory));
});

test("Scout/FIP visibility does not activate marriage semantics", () => {
  assert.equal(
    canonicalInventory.semantics.scout_fip_visibility_activates_marriage,
    false
  );
});

test("provider reachability does not establish retention", () => {
  assert.equal(
    canonicalInventory.semantics.provider_reachability_establishes_retention,
    false
  );
});

test("database visibility does not establish retention", () => {
  assert.equal(
    canonicalInventory.semantics.database_visibility_establishes_retention,
    false
  );
});

test("runtime inventory covers required material surface classes", () => {
  const classes = new Set(
    canonicalInventory.surfaces.flatMap((surface) => surface.surface_classes)
  );

  for (const requiredClass of [
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
  ]) {
    assert.ok(
      classes.has(requiredClass),
      `Missing required material surface class: ${requiredClass}`
    );
  }
});

test("Control Center and contract-test Scout/FIP vocabulary does not create runtime surfaces by itself", () => {
  assert.equal(
    isScoutFipSurface(
      "control-center/check_edge_system_runtime_inventory.js",
      'classes.add("SCOUT_FIP_SURFACE"); scout_fip_visibility_activates_marriage'
    ),
    false
  );

  assert.equal(
    isScoutFipSurface(
      "tests/edge-system-runtime-inventory.test.js",
      "Scout/FIP visibility does not activate marriage semantics"
    ),
    false
  );
});

test("actual Edge Scout/FIP evidence remains discoverable", () => {
  assert.equal(
    isScoutFipSurface(
      "backend/services/scoutSignalSync.js",
      "const url = process.env.SCOUT_DATABASE_URL;"
    ),
    true
  );

  assert.equal(
    isScoutFipSurface(
      "supabase/migrations/20260616_scout_signal_mirror.sql",
      "CREATE TABLE scout_raw_match_signals"
    ),
    true
  );
});

test("Prose false positives: natural-language text does not create Edge/Scout objects, but .from('scout_raw_match_signals') still is detected", () => {
  const source = `
    update Edge after data arrives from Scout
    const { data } = await supabase.from("scout_raw_match_signals").select("*");
  `;

  const objects = extractDatabaseObjects(
    "backend/services/proseFalsePositive.js",
    source
  );

  assert.ok(!objects.includes("Edge"));
  assert.ok(!objects.includes("Scout"));
  assert.ok(objects.includes("scout_raw_match_signals"));
});

test("Raw SQL inside JS template literal detects qualified database objects", () => {
  const source =
    "const sql = `SELECT * FROM public.predictions_raw " +
    "JOIN public.teams t ON t.id = pr.team_id " +
    "INSERT INTO public.prediction_publish_runs (prediction_id) " +
    "VALUES (123);`; " +
    'await supabase.rpc("noop", {});';

  const objects = extractDatabaseObjects(
    "backend/services/sqlTemplateLiteral.js",
    source
  );

  assert.ok(objects.includes("public.predictions_raw"));
  assert.ok(objects.includes("public.teams"));
  assert.ok(objects.includes("public.prediction_publish_runs"));
});

test("SQL comments do not create fake objects, but CREATE TABLE detects real table", () => {
  const source = `
    -- FROM public.fake_from_comment
    /* JOIN public.fake_join_block */
    CREATE TABLE public.real_table (
      id uuid PRIMARY KEY
    );
  `;

  const objects = extractDatabaseObjects("scratch/test.sql", source);

  assert.ok(objects.includes("public.real_table"));
  assert.ok(!objects.includes("public.fake_from_comment"));
  assert.ok(!objects.includes("public.fake_join_block"));
});

test("RPC classification returns RPC for rpc-only Supabase usage", () => {
  const role = detectDatabaseRole(
    "backend/services/rpcOnly.js",
    'await supabase.rpc("refresh_predictions", {});'
  );

  assert.equal(role, "RPC");
});

test("scheduled execution discovery preserves static trigger evidence", () => {
  assert.equal(
    extractScheduleOrTrigger(
      "backend/services/cronJobs.js",
      'cron.schedule("0 * * * *", runJob);'
    ),
    "cron:0 * * * *"
  );

  assert.equal(
    extractScheduleOrTrigger(
      "backend/routes/scheduler.js",
      "setImmediate(() => runPipeline());"
    ),
    "scheduler-path; setImmediate"
  );
});

test("deployment surfaces receive evidence-backed current-state roles", () => {
  assert.equal(detectDeploymentSurface("render.yaml"), "RENDER_CONFIGURATION");
  assert.equal(detectDeploymentSurface("vercel.json"), "VERCEL_CONFIGURATION");
  assert.equal(
    detectDeploymentSurface("package.json"),
    "PACKAGE_RUNTIME_SCRIPTS"
  );
  assert.equal(detectDeploymentSurface("Dockerfile"), "CONTAINER_BUILD");
  assert.equal(
    detectDeploymentSurface("dolphin-server/Dockerfile"),
    "CONTAINER_BUILD"
  );
});

test("Governance reachability classification uses executable/test/audit/build/sql evidence precedence", () => {
  const sql = fs.readFileSync(
    path.join(ROOT, "sql", "master_rulebook_triggers.sql"),
    "utf8"
  );
  assert.equal(
    detectGovernanceReachability("sql/master_rulebook_triggers.sql", sql),
    "DATABASE"
  );

  const audit = fs.readFileSync(
    path.join(ROOT, "scripts", "audit-football-rules-alignment.js"),
    "utf8"
  );
  assert.equal(
    detectGovernanceReachability(
      "scripts/audit-football-rules-alignment.js",
      audit
    ),
    "AUDIT_TOOL"
  );

  const verify = fs.readFileSync(
    path.join(ROOT, "scripts", "verify-master-rulebook-alignment.js"),
    "utf8"
  );
  assert.equal(
    detectGovernanceReachability(
      "scripts/verify-master-rulebook-alignment.js",
      verify
    ),
    "BUILD_GATE"
  );

  const scenarios = fs.readFileSync(
    path.join(ROOT, "test_scenarios_master_rulebook.js"),
    "utf8"
  );
  assert.equal(
    detectGovernanceReachability(
      "test_scenarios_master_rulebook.js",
      scenarios
    ),
    "TEST_PROOF"
  );

  // Synthetic runtime enforcement evidence: this must not become DOCUMENT_ONLY.
  const runtimeEvidence = `
    if (request.state === "forbidden") {
      throw new Error("blocked publish");
    }
    return { ok: true };
  `;
  assert.equal(
    detectGovernanceReachability("backend/runtimeRuleEnforcer.js", runtimeEvidence),
    "RUNTIME"
  );

  // Documentary-only markdown must remain DOCUMENT_ONLY.
  const docEvidence = `# Rulebook\nThis is documentation only.`;
  assert.equal(
    detectGovernanceReachability("docs/governance_spec.md", docEvidence),
    "DOCUMENT_ONLY"
  );
});

test("Ambiguous governance candidate remains UNKNOWN (not generic DOCUMENT_ONLY)", () => {
  const ambiguousSource = `
    This script mentions governance and rules, but it does not execute,
    does not throw, and does not declare database triggers/policies.
  `;

  assert.equal(
    detectGovernanceReachability("scripts/ambiguousGovernance.js", ambiguousSource),
    "UNKNOWN"
  );
});

test("Relationship evidence parity: matching evidence passes despite database_objects ordering", () => {
  const discovered = {
    asset_path: "backend/example.js",
    database_role: "RPC",
    database_objects: ["public.predictions", "public.accas"],
    schedule_or_trigger: "cron.schedule: */15 * * * *",
    deployment_surface: "RENDER_CONFIGURATION",
    governance_reachability: "RUNTIME",
  };

  const inventoried = {
    asset_path: "backend/example.js",
    database_role: "RPC",
    database_objects: ["public.accas", "public.predictions"],
    schedule_or_trigger: "cron.schedule: */15 * * * *",
    deployment_surface: "RENDER_CONFIGURATION",
    governance_reachability: "RUNTIME",
  };

  assert.deepEqual(compareRelationshipEvidence(discovered, inventoried), []);
});

test("Relationship evidence parity: drift in any supported field fails closed with exactly one finding", () => {
  const base = {
    asset_path: "backend/example.js",
    database_role: "RPC",
    database_objects: ["public.predictions", "public.accas"],
    schedule_or_trigger: "cron.schedule: */15 * * * *",
    deployment_surface: "RENDER_CONFIGURATION",
    governance_reachability: "RUNTIME",
  };

  const cases = [
    {
      field: "database_role",
      discovered: { ...base, database_role: "READ" },
    },
    {
      field: "database_objects",
      discovered: { ...base, database_objects: ["public.accas"] },
      expectedInventoried: { ...base, database_objects: ["public.predictions", "public.accas"] },
    },
    {
      field: "schedule_or_trigger",
      discovered: { ...base, schedule_or_trigger: null },
    },
    {
      field: "deployment_surface",
      discovered: { ...base, deployment_surface: "VERCEL_CONFIGURATION" },
    },
    {
      field: "governance_reachability",
      discovered: { ...base, governance_reachability: "DOCUMENT_ONLY" },
    },
  ];

  for (const c of cases) {
    const discovered = c.discovered;
    const inventoried = c.expectedInventoried || base;

    const findings = compareRelationshipEvidence(discovered, inventoried);

    assert.equal(findings.length, 1);
    assert.equal(findings[0].field, c.field);
  }
});

test("Canonical checker emits RUNTIME_RELATIONSHIP_EVIDENCE_DRIFT when supported relationship evidence drifts for same asset_path", () => {
  const inventory = clone(canonicalInventory);
  const target = inventory.surfaces.find(
    (s) => s.asset_path === "sql/master_rulebook_triggers.sql"
  );
  assert.ok(target);

  // Introduce a supported relationship-evidence drift: governance reachability type.
  target.governance_reachability_type = "DOCUMENT_ONLY";

  const result = validate(inventory);
  const driftErrors = result.errors.filter((e) =>
    e.startsWith("RUNTIME_RELATIONSHIP_EVIDENCE_DRIFT:")
  );

  assert.equal(driftErrors.length, 1);
  assert.ok(driftErrors[0].includes("field=governance_reachability"));
});