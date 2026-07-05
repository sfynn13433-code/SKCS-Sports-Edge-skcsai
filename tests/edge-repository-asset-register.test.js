"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const {
  ASSET_TYPES,
  SOURCE_STATES,
  CURRENT_STATES,
  AUTHORITY_CLASSES,
  GOES_SOMEWHERE_STATES,
  REQUIRED_ASSET_FIELDS,
  ARRAY_FIELDS,
  ASSET_REGISTER_PATH,
  getTrackedPaths,
  loadAssetRegister,
  validateRegister,
} = require("../control-center/check_edge_repository_asset_register.js");

describe("Edge Repository Asset Register v1", () => {
  it("asset register exists", () => {
    assert.ok(fs.existsSync(ASSET_REGISTER_PATH));
  });

  it("asset register has canonical version", () => {
    const register = loadAssetRegister();

    assert.equal(register.version, "1.0");
    assert.equal(
      register.unclassified_tracked_paths_allowed,
      false
    );
    assert.ok(Array.isArray(register.assets));
    assert.ok(
      Array.isArray(register.explicit_exclusions)
    );
  });

  it("every asset has every required field", () => {
    const register = loadAssetRegister();

    for (const asset of register.assets) {
      for (const field of REQUIRED_ASSET_FIELDS) {
        assert.notEqual(
          asset[field],
          undefined,
          `${asset.asset_path} missing ${field}`
        );
        assert.notEqual(
          asset[field],
          null,
          `${asset.asset_path} null ${field}`
        );
      }
    }
  });

  it("every asset enum value is legal", () => {
    const register = loadAssetRegister();

    for (const asset of register.assets) {
      assert.ok(
        ASSET_TYPES.includes(asset.asset_type),
        `${asset.asset_path} invalid asset_type`
      );
      assert.ok(
        SOURCE_STATES.includes(asset.source_state),
        `${asset.asset_path} invalid source_state`
      );
      assert.ok(
        CURRENT_STATES.includes(asset.current_state),
        `${asset.asset_path} invalid current_state`
      );
      assert.ok(
        AUTHORITY_CLASSES.includes(
          asset.authority_class
        ),
        `${asset.asset_path} invalid authority_class`
      );
      assert.ok(
        GOES_SOMEWHERE_STATES.includes(
          asset.goes_somewhere
        ),
        `${asset.asset_path} invalid goes_somewhere`
      );

      for (const field of ARRAY_FIELDS) {
        assert.ok(
          Array.isArray(asset[field]),
          `${asset.asset_path} ${field} must be array`
        );
      }
    }
  });

  it("every tracked path is registered or explicitly excluded", () => {
    const register = loadAssetRegister();
    const trackedPaths = getTrackedPaths();

    const covered = new Set([
      ...register.assets.map(
        (asset) => asset.asset_path
      ),
      ...register.explicit_exclusions.map(
        (exclusion) => exclusion.asset_path
      ),
    ]);

    for (const trackedPath of trackedPaths) {
      assert.ok(
        covered.has(trackedPath),
        `unclassified tracked path ${trackedPath}`
      );
    }
  });

  it("tracked path count is deterministic", () => {
    const register = loadAssetRegister();
    const trackedPaths = getTrackedPaths();

    assert.equal(
      register.tracked_path_count,
      trackedPaths.length
    );
    assert.equal(
      register.registered_asset_count,
      register.assets.length
    );
    assert.equal(
      register.explicit_exclusion_count,
      register.explicit_exclusions.length
    );
  });

  it("UNRESOLVED owners remain under EPR-001 bootstrap governance", () => {
    const register = loadAssetRegister();

    for (const asset of register.assets) {
      if (asset.owner_project_id !== "UNRESOLVED") {
        continue;
      }

      assert.equal(
        asset.governed_by_control_task_id,
        "EPR-001",
        `${asset.asset_path} unresolved owner bypasses EPR-001`
      );
    }
  });

  it("legacy, historical, unknown, no-consumer, and conflict findings are non-fatal", () => {
    const register = structuredClone(
      loadAssetRegister()
    );

    assert.ok(register.assets.length > 0);

    const asset = register.assets[0];

    asset.current_state = "LEGACY";
    asset.authority_class =
      "HISTORICAL_EVIDENCE";
    asset.goes_somewhere = "NO";
    asset.known_conflicts = [
      "TEST_CONFLICT_FINDING",
    ];
    asset.runtime_consumers = [];

    const result = validateRegister(register);

    assert.equal(
      result.errors.length,
      0,
      result.errors.join("; ")
    );
    assert.equal(result.passed, true);
  });

  it("duplicate asset paths fail integrity", () => {
    const register = structuredClone(
      loadAssetRegister()
    );

    assert.ok(register.assets.length > 0);

    register.assets.push(
      structuredClone(register.assets[0])
    );
    register.registered_asset_count =
      register.assets.length;

    const result = validateRegister(register);

    assert.ok(
      result.errors.some((error) =>
        error.startsWith("DUPLICATE_ASSET_PATH:")
      )
    );
    assert.equal(result.passed, false);
  });

  it("asset register integrity checker passes", () => {
    const result = validateRegister(
      loadAssetRegister()
    );

    assert.deepEqual(result.errors, []);
    assert.equal(result.passed, true);
  });
});
