'use strict';

const fs = require('fs');
const path = require('path');

const eacChecker = require('../../control-center/check_edge_asset_classification.js');
const ccChecker = require('../../control-center/check_control_center.js');
const runtimeChecker = require('../../control-center/check_edge_system_runtime_inventory.js');

const CONTROL_CENTER_DIR = path.resolve(
  __dirname,
  '../../control-center'
);

const LEDGER_PATH = path.join(
  CONTROL_CENTER_DIR,
  'EDGE_BUILD_CONTROL_LEDGER.v1.json'
);
const PROJECT_REGISTER_PATH = path.join(
  CONTROL_CENTER_DIR,
  'EDGE_MASTER_PROJECT_REGISTER.v1.json'
);
const ASSET_REGISTER_PATH = path.join(
  CONTROL_CENTER_DIR,
  'EDGE_REPOSITORY_ASSET_REGISTER.v1.json'
);
const RUNTIME_INVENTORY_PATH = path.join(
  CONTROL_CENTER_DIR,
  'EDGE_SYSTEM_RUNTIME_INVENTORY.v1.json'
);
const RUNTIME_MAP_PATH = path.join(
  CONTROL_CENTER_DIR,
  'EDGE_SYSTEM_RUNTIME_MAP.md'
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

let cachedInputs = null;
let cachedEac = null;
let cachedCc = null;
let cachedRuntime = null;

function loadInputs() {
  if (cachedInputs) return cachedInputs;

  const ledger = readJson(LEDGER_PATH);
  const projectsRegister = readJson(PROJECT_REGISTER_PATH);
  const assetRegister = readJson(ASSET_REGISTER_PATH);
  const runtimeInventory = readJson(RUNTIME_INVENTORY_PATH);
  const runtimeMapText = readText(RUNTIME_MAP_PATH);

  cachedInputs = {
    ledger,
    projectsRegister,
    assetRegister,
    runtimeInventory,
    runtimeMapText,
  };
  return cachedInputs;
}

function getEacSummary() {
  if (cachedEac) return cachedEac;
  cachedEac = eacChecker.runCheck({
    closure: false,
    refreshManifest: false,
    writeMap: false,
  });
  return cachedEac;
}

function getControlCenterSummary() {
  if (cachedCc) return cachedCc;
  cachedCc = ccChecker.runCheck();
  return cachedCc;
}

function getRuntimeSummary() {
  if (cachedRuntime) return cachedRuntime;

  const { ledger, assetRegister, runtimeInventory, runtimeMapText } =
    loadInputs();

  const result = runtimeChecker.validateInventory({
    ledger,
    assetRegister,
    inventory: runtimeInventory,
    mapText: runtimeMapText,
  });

  cachedRuntime = {
    errors: result.errors,
    warnings: result.warnings,
    discovered: result.discovered,
  };
  return cachedRuntime;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function overview() {
  const { ledger, projectsRegister, assetRegister, runtimeInventory } =
    loadInputs();

  const eac = getEacSummary();
  const cc = getControlCenterSummary();
  const runtime = getRuntimeSummary();

  const tasks = safeArray(cc.tasks);
  const statusCounts = new Map();
  for (const t of tasks) {
    const s = String(t.status || '').trim() || '(UNKNOWN)';
    statusCounts.set(s, (statusCounts.get(s) || 0) + 1);
  }

  const projects = safeArray(projectsRegister.projects);
  const totalLedgerTasks = safeArray(ledger.tasks).length;

  // EAC completeness: foundation run reports closureReady when fully classified == total.
  const totalGovernedAssets = assetRegister.assets.length;
  const fullyClassifiedAssets = eac.summary?.fullyClassifiedAssets || 0;
  const classificationPendingAssets = eac.summary?.classificationPendingAssets || 0;
  const classificationInventoryComplete =
    Boolean(eac.closureReady) && classificationPendingAssets === 0;

  const runtimeSurfacesTotal = safeArray(
    runtimeInventory?.surfaces
  ).length;

  return {
    classification: {
      totalGovernedAssets,
      fullyClassifiedAssets,
      classificationPendingAssets,
      classificationInventoryComplete,
    },
    projects: {
      projectCount: projects.length,
      ledgerTaskCount: totalLedgerTasks,
      taskCountsByStatus: Object.fromEntries(statusCounts.entries()),
      currentStartableTaskCount: safeArray(cc.startable).length,
      nextGatedTask: cc.gated?.task_id || null,
    },
    gates: {
      scoutEdgeMarriageGate: ledger.scout_edge_marriage_gate || null,
      supabaseStorageGate: ledger.supabase_storage_gate || null,
    },
    runtime: {
      runtimeSurfacesTotal,
      runtimeWarningCount: runtime.warnings.length,
    },
  };
}

function projectList() {
  const { projectsRegister } = loadInputs();
  const projects = safeArray(projectsRegister.projects);

  return {
    version: projectsRegister.version || '1.0',
    title: projectsRegister.title || 'SKCS Edge Master Project Register',
    projectCount: projects.length,
    projects: projects.map((p) => ({
      project_id: p.project_id,
      project_name: p.project_name,
      category: p.category,
      current_status: p.current_status,
      blocked_by: safeArray(p.blocked_by),
      next_action: p.next_action,
      governed_by_control_task_id:
        p.governed_by_control_task_id || p.project_id,
    })),
  };
}

function assetList({ q, state, group, owner, page, pageSize }) {
  const { assetRegister } = loadInputs();
  const assets = safeArray(assetRegister.assets);

  const query = String(q || '').trim().toLowerCase();
  const stateFilter = state ? String(state).trim() : null;
  const groupFilter = group ? String(group).trim() : null;
  const ownerFilter = owner ? String(owner).trim() : null;

  const filtered = assets.filter((a) => {
    if (stateFilter && String(a.current_state) !== stateFilter) return false;
    if (groupFilter && String(a.functional_group) !== groupFilter) return false;
    if (ownerFilter && String(a.owner_project_id) !== ownerFilter) return false;

    if (query) {
      const haystack =
        `${a.asset_path} ${a.purpose_description || ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const p = Number.isFinite(Number(page)) ? Math.max(1, Number(page)) : 1;
  const ps = Number.isFinite(Number(pageSize))
    ? Math.max(1, Math.min(100, Number(pageSize)))
    : 50;

  const start = (p - 1) * ps;
  const end = start + ps;
  const items = filtered.slice(start, end);

  return {
    page: p,
    pageSize: ps,
    total: filtered.length,
    items: items.map((a) => ({
      asset_path: a.asset_path,
      asset_type: a.asset_type,
      purpose_description: a.purpose_description,
      functional_group: a.functional_group,
      current_state: a.current_state,
      owner_project_id: a.owner_project_id,
      governed_by_control_task_id:
        a.governed_by_control_task_id,
      relationship_tags: safeArray(a.relationship_tags),
      next_validation: a.next_validation,
    })),
  };
}

function gates() {
  const { ledger } = loadInputs();
  return {
    scoutEdgeMarriageGate: ledger.scout_edge_marriage_gate || null,
    supabaseStorageGate: ledger.supabase_storage_gate || null,
  };
}

function runtime() {
  const { runtimeInventory } = loadInputs();
  const runtimeSum = getRuntimeSummary();
  return {
    runtimeSurfacesTotal: safeArray(runtimeInventory.surfaces).length,
    runtimeWarningCount: runtimeSum.warnings.length,
  };
}

function findings() {
  const { assetRegister } = loadInputs();
  const assets = safeArray(assetRegister.assets);

  const counts = new Map();
  for (const a of assets) {
    const key = String(a.current_state || 'UNKNOWN');
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  // Keep keys readable and stable in the response.
  const order = [
    'CURRENT',
    'PARALLEL',
    'LEGACY',
    'HISTORICAL_EVIDENCE',
    'STALE_OR_SUPERSEDED',
    'UNKNOWN',
    'GENERATED',
  ];

  const ordered = {};
  for (const k of order) {
    ordered[k] = counts.get(k) || 0;
  }

  // Include any other taxonomy keys if present.
  for (const [k, v] of counts.entries()) {
    if (!(k in ordered)) ordered[k] = v;
  }

  return {
    totalAssets: assets.length,
    currentStateCounts: ordered,
  };
}

module.exports = {
  overview,
  projectList,
  assetList,
  gates,
  runtime,
  findings,
};

