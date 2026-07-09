'use strict';

const ADMIN_KEY_STORAGE = 'skcs_admin_api_key';

function $id(id) {
  return document.getElementById(id);
}

function getApiKey() {
  try {
    return window.localStorage.getItem(ADMIN_KEY_STORAGE) || '';
  } catch (_) {
    return '';
  }
}

function setApiKey(key) {
  window.localStorage.setItem(ADMIN_KEY_STORAGE, key);
}

function setText(id, value) {
  const el = $id(id);
  if (!el) return;
  el.textContent = value == null ? '—' : String(value);
}

function showLocked(statusText) {
  const lockScreen = $id('lock-screen');
  const dashboard = $id('dashboard');
  if (lockScreen) lockScreen.classList.remove('hidden');
  if (dashboard) dashboard.classList.add('hidden');

  const status = $id('lockStatus');
  if (status) status.textContent = statusText || '';
}

function showDashboard() {
  const lockScreen = $id('lock-screen');
  const dashboard = $id('dashboard');
  if (lockScreen) lockScreen.classList.add('hidden');
  if (dashboard) dashboard.classList.remove('hidden');
}

async function apiGet(pathname) {
  const apiBase = window.API_BASE_URL || '';
  const key = getApiKey();

  const url = `${apiBase}${pathname}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': key,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

function renderStatusItem(parent, text) {
  const wrap = document.createElement('div');
  wrap.className = 'list-item';
  wrap.textContent = text;
  parent.appendChild(wrap);
}

function renderProjects(projects) {
  const tbody = $id('projectsTable')?.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  for (const p of projects) {
    const tr = document.createElement('tr');
    const blocked = Array.isArray(p.blocked_by) ? p.blocked_by.join(', ') : '';

    tr.innerHTML = `
      <td>${escapeHtml(p.project_id)}</td>
      <td>${escapeHtml(p.project_name)}</td>
      <td>${escapeHtml(p.current_status)}</td>
      <td>${escapeHtml(blocked || 'none')}</td>
      <td>${escapeHtml(p.next_action || '')}</td>
    `;
    tbody.appendChild(tr);
  }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parseNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

let assetsState = {
  q: '',
  state: '',
  group: '',
  owner: '',
  page: 1,
  pageSize: 20,
  total: 0,
  items: [],
  initialized: false,
};

function updatePaginationLabel() {
  const label = $id('assetsPageLabel');
  if (!label) return;
  const totalPages = Math.max(1, Math.ceil(assetsState.total / assetsState.pageSize));
  label.textContent = `Page ${assetsState.page} / ${totalPages}`;
}

function renderAssets(items) {
  const tbody = $id('assetsTable')?.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  for (const a of items) {
    const tr = document.createElement('tr');
    const tags = Array.isArray(a.relationship_tags) ? a.relationship_tags : [];
    const tagsHtml = tags.length
      ? `<div class="tag-row">${tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
      : `<span class="muted">none</span>`;

    tr.innerHTML = `
      <td>${escapeHtml(a.asset_path)}</td>
      <td>${escapeHtml(a.purpose_description || '')}</td>
      <td>${escapeHtml(a.functional_group || '')}</td>
      <td>${escapeHtml(a.current_state || '')}</td>
      <td>${escapeHtml(a.owner_project_id || '')}</td>
      <td>${escapeHtml(a.next_validation || '')}</td>
      <td>${tagsHtml}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderGates(gates) {
  const list = $id('gatesList');
  if (!list) return;
  list.innerHTML = '';

  // Dedicated Gates view projects the same canonical ledger gate fields
  // already used by Overview — no invented rows, no hard-coded status.
  const rows = [
    {
      label: 'Scout–Edge Marriage Gate',
      status: gates?.scoutEdgeMarriageGate,
    },
    {
      label: 'Supabase Storage Gate',
      status: gates?.supabaseStorageGate,
    },
  ];

  for (const row of rows) {
    if (row.status == null || row.status === '') continue;
    renderStatusItem(list, `${row.label} — ${row.status}`);
  }
}

async function loadGates() {
  const gates = await apiGet('/api/control-center/gates');
  renderGates(gates);
}

async function loadRuntime() {
  const runtime = await apiGet('/api/control-center/runtime');
  setText('runtimeSurfaces', runtime.runtimeSurfacesTotal);
  setText('runtimeWarnings', runtime.runtimeWarningCount);
}

async function loadFindings() {
  const data = await apiGet('/api/control-center/findings');
  const counts = data.currentStateCounts || {};

  const select = $id('stateFilter');
  if (select) {
    // Keep stable: clear existing and re-add sorted keys.
    const current = String(select.value || '');
    select.innerHTML = `<option value="">All states</option>`;
    const keys = Object.keys(counts).sort((a, b) => String(a).localeCompare(String(b)));
    for (const k of keys) {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = `${k} (${counts[k]})`;
      select.appendChild(opt);
    }
    if (current && keys.includes(current)) select.value = current;
  }

  const list = $id('findingsList');
  if (list) {
    list.innerHTML = '';
    const keys = Object.keys(counts);
    for (const k of keys) {
      renderStatusItem(list, `${k}: ${counts[k]}`);
    }
  }
}

async function loadOverviewAndProjects() {
  const overview = await apiGet('/api/control-center/overview');

  setText(
    'cardAssetsClassified',
    `${overview.classification.fullyClassifiedAssets} / ${overview.classification.totalGovernedAssets}`
  );
  setText('cardClassificationPending', overview.classification.classificationPendingAssets);
  setText('cardProjectsCount', overview.projects.projectCount);

  const startableCount = overview.projects.currentStartableTaskCount;
  const nextGated = overview.projects.nextGatedTask;
  setText('cardStartableWork', `${startableCount}`);
  setText('cardNextGated', nextGated || '—');

  setText('cardRuntimeSurfaces', overview.runtime.runtimeSurfacesTotal);
  setText('cardRuntimeWarnings', overview.runtime.runtimeWarningCount);

  const marriage = overview.gates.scoutEdgeMarriageGate || '—';
  setText('cardMarriageGate', marriage);

  const projects = await apiGet('/api/control-center/projects');
  renderProjects(projects.projects || []);
}

async function loadAssets() {
  const data = await apiGet(
    `/api/control-center/assets?q=${encodeURIComponent(assetsState.q)}&state=${encodeURIComponent(
      assetsState.state
    )}&group=${encodeURIComponent(assetsState.group)}&owner=${encodeURIComponent(
      assetsState.owner
    )}&page=${assetsState.page}&pageSize=${assetsState.pageSize}`
  );

  assetsState.total = data.total || 0;
  assetsState.items = data.items || [];
  renderAssets(assetsState.items);
  updatePaginationLabel();
}

async function initUnlocked() {
  try {
    await loadOverviewAndProjects();
    await loadGates();
    await loadRuntime();
    await loadFindings();

    // Prime assets filters.
    if (!assetsState.initialized) {
      assetsState.initialized = true;
      assetsState.page = 1;
    }
    await loadAssets();
  } catch (err) {
    showLocked(String(err?.message || err));
  }
}

function bindUi() {
  const unlockBtn = $id('unlockBtn');
  const clearBtn = $id('clearBtn');
  const lockBtn = $id('lockBtn');

  if (unlockBtn) {
    unlockBtn.addEventListener('click', async () => {
      const key = $id('adminApiKeyInput')?.value || '';
      if (!key.trim()) {
        showLocked('Enter an admin API key first.');
        return;
      }
      setApiKey(key.trim());
      showDashboard();
      $id('sessionChip').textContent = 'Admin unlocked';
      await initUnlocked();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      try {
        window.localStorage.removeItem(ADMIN_KEY_STORAGE);
      } catch (_) {}
      if ($id('adminApiKeyInput')) $id('adminApiKeyInput').value = '';
      showLocked('Admin key cleared.');
    });
  }

  if (lockBtn) {
    lockBtn.addEventListener('click', () => {
      try {
        window.localStorage.removeItem(ADMIN_KEY_STORAGE);
      } catch (_) {}
      $id('sessionChip').textContent = 'Locked';
      showLocked('Locked.');
    });
  }

  // Navigation: simple scroll via showing section.
  document.querySelectorAll('.navbtn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      const el = document.querySelector(target);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  $id('assetSearchBtn')?.addEventListener('click', async () => {
    assetsState.q = $id('assetSearchInput').value || '';
    assetsState.state = $id('stateFilter').value || '';
    assetsState.group = $id('groupFilterInput').value || '';
    assetsState.owner = $id('ownerFilterInput').value || '';
    assetsState.page = 1;
    await loadAssets();
  });

  $id('assetsPrevBtn')?.addEventListener('click', async () => {
    assetsState.page = Math.max(1, assetsState.page - 1);
    await loadAssets();
  });

  $id('assetsNextBtn')?.addEventListener('click', async () => {
    const totalPages = Math.max(
      1,
      Math.ceil(assetsState.total / assetsState.pageSize)
    );
    assetsState.page = Math.min(totalPages, assetsState.page + 1);
    await loadAssets();
  });
}

(function bootstrap() {
  bindUi();

  const existing = getApiKey();
  if (existing && existing.trim()) {
    setApiKey(existing);
    showDashboard();
    $id('sessionChip').textContent = 'Admin unlocked';
    initUnlocked();
  } else {
    showLocked('');
  }
})();

