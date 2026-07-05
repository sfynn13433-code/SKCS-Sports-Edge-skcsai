"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  discoverMaterialSurfaces,
  renderRuntimeMap,
  validateInventory,
  isScoutFipSurface,
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