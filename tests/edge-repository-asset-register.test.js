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
  getWorkspaceDiscoveredPaths,
  loadAssetRegister,
  validateRegister,
} = require("../control-center/check_edge_repository_asset_register.js");

const LEDGER = require("../control-center/EDGE_BUILD_CONTROL_LEDGER.v1.json");

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

  it("GOVERNED UNRESOLVED OWNER SURVIVES PROJECTED TESTED STATE", () => {
    const base = structuredClone(loadAssetRegister());

    const ledgerOverride = structuredClone(LEDGER);
    const eprTask = (ledgerOverride.tasks || ledgerOverride.control_tasks || []).find(
      (t) => (t.task_id || t.id) === "EPR-001"
    );
    assert.ok(eprTask, "EPR-001 task must exist in ledger override");
    eprTask.status = "TESTED";

    const result = validateRegister(base, { ledgerOverride });

    assert.equal(result.passed, true);
    assert.equal(
      result.errors.filter((e) =>
        e.startsWith("ASSET_OWNER_PROJECT_UNKNOWN:")
      ).length,
      0
    );
  });

  it("UNKNOWN CONTROL TASK remains fail-closed for UNRESOLVED owner assets", () => {
    const base = structuredClone(loadAssetRegister());

    const target = base.assets.find(
      (a) =>
        a.owner_project_id === "UNRESOLVED" &&
        a.governed_by_control_task_id === "EPR-001"
    );
    assert.ok(target, "Expected at least one UNRESOLVED asset governed by EPR-001");

    target.governed_by_control_task_id = "UNKNOWN-FAKE-TASK";
    const result = validateRegister(base);

    assert.equal(result.passed, false);
    assert.ok(
      result.errors.some((e) =>
        e.startsWith(`ASSET_CONTROL_TASK_UNKNOWN: ${target.asset_path}`)
      ),
      result.errors.join("; ")
    );
  });

  it("EMPTY NEXT_VALIDATION remains fail-closed for UNRESOLVED owner assets", () => {
    const base = structuredClone(loadAssetRegister());

    const target = base.assets.find(
      (a) =>
        a.owner_project_id === "UNRESOLVED" &&
        a.governed_by_control_task_id === "EPR-001"
    );
    assert.ok(target, "Expected at least one UNRESOLVED asset governed by EPR-001");

    target.next_validation = "";

    const result = validateRegister(base);

    assert.equal(result.passed, false);
    assert.ok(
      result.errors.some((e) =>
        e.startsWith(`ASSET_NEXT_VALIDATION_MISSING: ${target.asset_path}`)
      ),
      result.errors.join("; ")
    );
  });

  it("CURRENT GOVERNED UNRESOLVED POPULATION remains valid", () => {
    const result = validateRegister(loadAssetRegister());
    assert.equal(result.passed, true);

    const unresolved = loadAssetRegister().assets.filter(
      (a) => a.owner_project_id === "UNRESOLVED"
    );

    for (const asset of unresolved) {
      assert.ok(asset.governed_by_control_task_id, "Missing governed task binding");
      assert.ok(asset.next_validation && String(asset.next_validation).trim(), "Missing next_validation");
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

  it("workspace candidate snapshot covers current git discovery", () => {
    const register = loadAssetRegister();

    assert.ok(register.workspace_candidate_snapshot);
    assert.ok(Array.isArray(register.workspace_candidate_snapshot.candidates));

    const discovered = getWorkspaceDiscoveredPaths();
    const covered = new Set(
      register.workspace_candidate_snapshot.candidates.map(
        (c) => c.asset_path
      )
    );

    for (const p of discovered) {
      assert.ok(
        covered.has(p),
        `missing workspace candidate snapshot record: ${p}`
      );
    }

    for (const candidate of register.workspace_candidate_snapshot
      .candidates) {
      assert.equal(
        candidate.source_state,
        "PRE_EXISTING_UNTRACKED"
      );
      assert.ok(
        candidate.next_validation && String(candidate.next_validation).trim(),
        `${candidate.asset_path} missing next_validation`
      );
      assert.ok(
        candidate.notes && String(candidate.notes).trim(),
        `${candidate.asset_path} missing notes`
      );
    }
  });

  it("authority graph includes the known overlapping rule/concept evidence set", () => {
    const register = loadAssetRegister();

    const known = [
      "AGENTS.md",
      "COMPREHENSIVE_FOOTBALL_RULES_REPORT.md",
      "MASTER_RULEBOOK_IMPLEMENTATION_GUIDE.md",
      "SKCS-KNOWLEDGE/governance/bsd_provider_suitability_scorecard.md",
      "SKCS-KNOWLEDGE/governance/provider_scorecard_bsd.md",
      "SKCS-KNOWLEDGE/knowledge/business_rules.md",
      "SKCS_MASTER_RULEBOOK.md",
      "STRICT_RULES.md",
      "docs/acca_rules_v2.1.md",
      "scripts/apply-db-governance.js",
      "scripts/audit-football-rules-alignment.js",
      "scripts/verify-master-rulebook-alignment.js",
      "sql/master_rulebook_triggers.sql",
      "supabase/migrations/20260718000001_db_rule_alignment_75_55_30.sql",
      "supabase/migrations/20260820000002_fix_secondary_governance_80_75.sql",
      "test_scenarios_master_rulebook.js",
      "smb_combo_rules_refined.txt",
    ];

    const nodePaths = new Set(
      register.rule_authority_candidate_graph.nodes.map(
        (n) => n.asset_path
      )
    );

    for (const p of known) {
      assert.ok(
        nodePaths.has(p),
        `missing authority graph node for ${p}`
      );
    }
  });

  it("FAILS if a currently discovered untracked path is missing from snapshot", () => {
    const base = loadAssetRegister();
    const discovered = getWorkspaceDiscoveredPaths();
    const missing = "tests/__tmp__/missing_workspace_candidate.txt";

    const result = validateRegister(base, {
      workspaceDiscoveredPaths: [...discovered, missing],
    });

    assert.equal(result.passed, false);
    assert.ok(
      result.errors.some((e) =>
        e.startsWith(
          `WORKSPACE_CANDIDATE_UNGOVERNED: ${missing}`
        )
      ),
      result.errors.join("; ")
    );
  });

  it("does not require underlying untracked artifacts to exist for preserved evidence", () => {
    const base = structuredClone(loadAssetRegister());
    const discovered = getWorkspaceDiscoveredPaths();

    const fakePath = "tests/__tmp__/nonexistent_workspace_candidate.txt";
    const fakeCandidate = {
      asset_path: fakePath,
      source_state: "PRE_EXISTING_UNTRACKED",
      candidate_disposition: "PRESERVED_CANDIDATE",
      governed_by_control_task_id: "EPR-001",
      next_validation:
        "EPR-001 governed workspace candidate review: evidence only (no commit required).",
      notes:
        "Evidence of path discovery only; underlying artifact may be absent in this test.",
    };

    base.workspace_candidate_snapshot.candidates.push(fakeCandidate);

    const result = validateRegister(base, {
      workspaceDiscoveredPaths: [...discovered, fakePath],
    });

    assert.equal(result.passed, true);
  });

  it("explicit workspace candidate exclusion requires non-empty exclusion_reason", () => {
    const base = structuredClone(loadAssetRegister());
    const candidate =
      base.workspace_candidate_snapshot.candidates[0];

    candidate.candidate_disposition = "EXPLICITLY_EXCLUDED";
    candidate.exclusion_reason = "";

    const result = validateRegister(base);

    assert.equal(result.passed, false);
    assert.ok(
      result.errors.some((e) =>
        e.includes("WORKSPACE_CANDIDATE_EXCLUSION_REASON_EMPTY")
      ),
      result.errors.join("; ")
    );
  });

  it("duplicate workspace candidate asset_path fails", () => {
    const base = structuredClone(loadAssetRegister());
    const candidate =
      base.workspace_candidate_snapshot.candidates[0];
    base.workspace_candidate_snapshot.candidates.push(
      structuredClone(candidate)
    );

    const result = validateRegister(base);

    assert.equal(result.passed, false);
    assert.ok(
      result.errors.some((e) =>
        e.startsWith(
          `DUPLICATE_WORKSPACE_CANDIDATE_PATH: ${candidate.asset_path}`
        )
      ),
      result.errors.join("; ")
    );
  });

  it("unknown governed_by_control_task_id for workspace candidates fails closed", () => {
    const base = structuredClone(loadAssetRegister());
    const candidate =
      base.workspace_candidate_snapshot.candidates[0];
    candidate.governed_by_control_task_id = "UNKNOWN_TASK";

    const result = validateRegister(base);
    assert.equal(result.passed, false);
    assert.ok(
      result.errors.some((e) =>
        e.startsWith(
          `WORKSPACE_CANDIDATE_CONTROL_TASK_UNKNOWN: ${candidate.asset_path}`
        )
      ),
      result.errors.join("; ")
    );
  });

  it("preserved workspace candidates require non-empty next_validation", () => {
    const base = structuredClone(loadAssetRegister());
    const candidate =
      base.workspace_candidate_snapshot.candidates[0];
    candidate.next_validation = "";

    const result = validateRegister(base);
    assert.equal(result.passed, false);
    assert.ok(
      result.errors.some((e) =>
        e.startsWith(
          `WORKSPACE_CANDIDATE_NEXT_VALIDATION_EMPTY: ${candidate.asset_path}`
        )
      ),
      result.errors.join("; ")
    );
  });

  it("dependency/environment false positives are excluded from authority candidate discovery", () => {
    const base = structuredClone(loadAssetRegister());

    const depPath = "node_modules/fakepkg/rulebookrules.md";
    base.workspace_candidate_snapshot.candidates.push({
      asset_path: depPath,
      source_state: "PRE_EXISTING_UNTRACKED",
      candidate_disposition: "PRESERVED_CANDIDATE",
      governed_by_control_task_id: "EPR-001",
      next_validation:
        "EPR-001 governed workspace candidate review: evidence only.",
      notes:
        "Dependency/environment false positive evidence; must not be promoted into first-party authority candidate graph.",
    });

    const result = validateRegister(base, {
      workspaceDiscoveredPaths: [
        ...getWorkspaceDiscoveredPaths(),
        depPath,
      ],
    });

    assert.equal(result.passed, true);
    const nodePaths = new Set(
      base.rule_authority_candidate_graph.nodes.map(
        (n) => n.asset_path
      )
    );
    assert.equal(nodePaths.has(depPath), false);
  });

  it("authority graph semantic flags cannot establish CURRENT_AUTHORITY", () => {
    const base = structuredClone(loadAssetRegister());
    base.rule_authority_candidate_graph
      .candidate_status_establishes_current_authority = true;

    const result = validateRegister(base);
    assert.equal(result.passed, false);
    assert.ok(
      result.errors.some((e) =>
        e.includes(
          "AUTHORITY_GRAPH_FLAGS_INVALID_CURRENT_AUTHORITY"
        )
      ),
      result.errors.join("; ")
    );
  });

  it("authority graph forbidden relationship types fail", () => {
    const base = structuredClone(loadAssetRegister());
    base.rule_authority_candidate_graph.edges[0].relationship_type =
      "PRECEDES";

    const result = validateRegister(base);
    assert.equal(result.passed, false);
  });

  it("detected first-party rule/governance candidates must be present as graph nodes", () => {
    const base = structuredClone(loadAssetRegister());
    const discovered = getWorkspaceDiscoveredPaths();

    const newCandidate = "tmp/another_rules_refined.txt";
    base.workspace_candidate_snapshot.candidates.push({
      asset_path: newCandidate,
      source_state: "PRE_EXISTING_UNTRACKED",
      candidate_disposition: "PRESERVED_CANDIDATE",
      governed_by_control_task_id: "EPR-001",
      next_validation:
        "EPR-001 governed workspace candidate review: evidence only.",
      notes:
        "New first-party authority candidate evidence in test; graph node intentionally omitted.",
    });

    const result = validateRegister(base, {
      workspaceDiscoveredPaths: [...discovered, newCandidate],
    });

    assert.equal(result.passed, false);
    assert.ok(
      result.errors.some((e) =>
        e.startsWith(
          `AUTHORITY_CANDIDATE_MISSING_FROM_GRAPH: ${newCandidate}`
        )
      ),
      result.errors.join("; ")
    );
  });

  it("graph nodes cannot reference unknown assets/workspace candidates", () => {
    const base = structuredClone(loadAssetRegister());
    base.rule_authority_candidate_graph.nodes.push({
      asset_path: "nonexistent/unknown_asset.md",
      candidate_role: "RULE_GUIDE_OR_REPORT",
      authority_review_status: "UNRESOLVED_REVIEW",
      standalone_review_candidate: true,
      standalone_justification: "Test node referencing unknown asset.",
    });

    const result = validateRegister(base);
    assert.equal(result.passed, false);
    assert.ok(
      result.errors.some((e) =>
        e.startsWith(
          "AUTHORITY_CANDIDATE_UNKNOWN_REFERENCE: nonexistent/unknown_asset.md"
        )
      ),
      result.errors.join("; ")
    );
  });

  it("authority candidate with no edges and no standalone justification fails", () => {
    const base = structuredClone(loadAssetRegister());
    const target = "AGENTS.md";

    // Remove all edges incident to the target.
    base.rule_authority_candidate_graph.edges = base.rule_authority_candidate_graph.edges.filter(
      (e) =>
        e.from_asset_path !== target &&
        e.to_asset_path !== target
    );

    const node = base.rule_authority_candidate_graph.nodes.find(
      (n) => n.asset_path === target
    );
    node.standalone_review_candidate = false;
    node.standalone_justification = "";

    const result = validateRegister(base);
    assert.equal(result.passed, false);
    assert.ok(
      result.errors.some((e) =>
        e.startsWith(
          `AUTHORITY_CANDIDATE_UNLINKED: ${target}`
        )
      ),
      result.errors.join("; ")
    );
  });

  it("standalone review candidate passes when justified and unlinked", () => {
    const base = structuredClone(loadAssetRegister());
    const target = "AGENTS.md";

    base.rule_authority_candidate_graph.edges = base.rule_authority_candidate_graph.edges.filter(
      (e) =>
        e.from_asset_path !== target &&
        e.to_asset_path !== target
    );

    const node = base.rule_authority_candidate_graph.nodes.find(
      (n) => n.asset_path === target
    );
    node.standalone_review_candidate = true;
    node.standalone_justification = "Standalone justification present in test.";

    const result = validateRegister(base);
    assert.equal(result.passed, true);
  });

  it("smb_combo_rules_refined.txt is preserved as a PRE_EXISTING_UNTRACKED workspace candidate and included as an authority node", () => {
    const register = loadAssetRegister();

    const candidate = register.workspace_candidate_snapshot.candidates.find(
      (c) => c.asset_path === "smb_combo_rules_refined.txt"
    );
    assert.ok(candidate);
    assert.equal(candidate.source_state, "PRE_EXISTING_UNTRACKED");

    const node = register.rule_authority_candidate_graph.nodes.find(
      (n) => n.asset_path === "smb_combo_rules_refined.txt"
    );
    assert.ok(node);
  });

  it("known overlapping rule/concept evidence remains review-linked (not only standalone)", () => {
    const register = loadAssetRegister();

    const known = [
      "AGENTS.md",
      "COMPREHENSIVE_FOOTBALL_RULES_REPORT.md",
      "MASTER_RULEBOOK_IMPLEMENTATION_GUIDE.md",
      "SKCS-KNOWLEDGE/governance/bsd_provider_suitability_scorecard.md",
      "SKCS-KNOWLEDGE/governance/provider_scorecard_bsd.md",
      "SKCS-KNOWLEDGE/knowledge/business_rules.md",
      "SKCS_MASTER_RULEBOOK.md",
      "STRICT_RULES.md",
      "docs/acca_rules_v2.1.md",
      "scripts/apply-db-governance.js",
      "scripts/audit-football-rules-alignment.js",
      "scripts/verify-master-rulebook-alignment.js",
      "sql/master_rulebook_triggers.sql",
      "supabase/migrations/20260718000001_db_rule_alignment_75_55_30.sql",
      "supabase/migrations/20260820000002_fix_secondary_governance_80_75.sql",
      "test_scenarios_master_rulebook.js",
      "smb_combo_rules_refined.txt",
    ];

    const incident = new Map();
    for (const n of register.rule_authority_candidate_graph.nodes) {
      incident.set(n.asset_path, 0);
    }
    for (const e of register.rule_authority_candidate_graph.edges) {
      incident.set(e.from_asset_path, (incident.get(e.from_asset_path) || 0) + 1);
      incident.set(e.to_asset_path, (incident.get(e.to_asset_path) || 0) + 1);
    }

    for (const p of known) {
      assert.ok(
        (incident.get(p) || 0) > 0,
        `expected review-linked edges for ${p}`
      );
    }
  });
});
