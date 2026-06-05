(function () {
  'use strict';

  const REFRESH_MS = 60000;
  const SUMMARY_ENDPOINT = '/api/semantic-drift-summary?pipeline=aiPipeline';
  const SLOT_ID = 'semantic-drift-dashboard';

  function ensureStyles() {
    if (document.getElementById('semantic-drift-dashboard-styles')) return;
    const style = document.createElement('style');
    style.id = 'semantic-drift-dashboard-styles';
    style.textContent = `
      #${SLOT_ID} {
        width: 100%;
        max-width: 1200px;
        margin: 24px auto 0;
        color: #e2e8f0;
      }
      .skcs-drift-dashboard {
        background: linear-gradient(180deg, #0f172a, #020617);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 18px;
        padding: 20px;
        box-shadow: 0 18px 50px rgba(2, 6, 23, 0.35);
      }
      .skcs-drift-dashboard__header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 18px;
      }
      .skcs-drift-dashboard__title {
        margin: 0;
        font-size: 1.35rem;
        font-weight: 800;
        color: #f8fafc;
      }
      .skcs-drift-dashboard__subtitle {
        margin: 4px 0 0;
        font-size: 0.9rem;
        color: #94a3b8;
      }
      .skcs-drift-dashboard__state {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .skcs-drift-dashboard__state--pass { background: rgba(34, 197, 94, 0.18); color: #bbf7d0; }
      .skcs-drift-dashboard__state--warn { background: rgba(245, 158, 11, 0.18); color: #fde68a; }
      .skcs-drift-dashboard__state--degraded { background: rgba(251, 146, 60, 0.18); color: #fed7aa; }
      .skcs-drift-dashboard__state--fail { background: rgba(239, 68, 68, 0.18); color: #fecaca; }
      .skcs-drift-dashboard__grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 18px;
      }
      .skcs-drift-dashboard__card {
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(148, 163, 184, 0.12);
        border-radius: 14px;
        padding: 14px;
      }
      .skcs-drift-dashboard__card-label {
        display: block;
        font-size: 0.78rem;
        color: #94a3b8;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .skcs-drift-dashboard__card-value {
        font-size: 1.4rem;
        font-weight: 800;
        color: #f8fafc;
      }
      .skcs-drift-dashboard__section {
        margin-top: 16px;
      }
      .skcs-drift-dashboard__section h3 {
        margin: 0 0 10px;
        font-size: 1rem;
        color: #e2e8f0;
      }
      .skcs-drift-dashboard__table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.88rem;
        overflow: hidden;
      }
      .skcs-drift-dashboard__table th,
      .skcs-drift-dashboard__table td {
        border-bottom: 1px solid rgba(148, 163, 184, 0.14);
        padding: 10px 8px;
        text-align: left;
        vertical-align: top;
      }
      .skcs-drift-dashboard__table th {
        color: #cbd5e1;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .skcs-drift-dashboard__list {
        display: grid;
        gap: 10px;
      }
      .skcs-drift-dashboard__feed-item {
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(148, 163, 184, 0.12);
        border-radius: 12px;
        padding: 12px;
      }
      .skcs-drift-dashboard__feed-item small {
        display: block;
        color: #94a3b8;
        margin-bottom: 6px;
      }
      .skcs-drift-dashboard__providers {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
      }
      .skcs-drift-dashboard__provider {
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(148, 163, 184, 0.12);
        border-radius: 12px;
        padding: 12px;
      }
      .skcs-drift-dashboard__bars {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(28px, 1fr));
        gap: 4px;
        align-items: end;
        height: 72px;
      }
      .skcs-drift-dashboard__bar {
        background: linear-gradient(180deg, #38bdf8, #0f172a);
        border-radius: 6px 6px 2px 2px;
        min-height: 8px;
      }
      .skcs-drift-dashboard__empty {
        color: #94a3b8;
        font-size: 0.9rem;
      }
      @media (max-width: 900px) {
        .skcs-drift-dashboard__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 640px) {
        #${SLOT_ID} { margin-top: 16px; }
        .skcs-drift-dashboard { padding: 16px; }
        .skcs-drift-dashboard__grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function getContainer() {
    return document.getElementById(SLOT_ID);
  }

  function stateClass(state) {
    const normalized = String(state || '').trim().toUpperCase();
    if (normalized === 'PASS' || normalized === 'HEALTHY') return 'skcs-drift-dashboard__state--pass';
    if (normalized === 'WARN') return 'skcs-drift-dashboard__state--warn';
    if (normalized === 'DEGRADED') return 'skcs-drift-dashboard__state--degraded';
    return 'skcs-drift-dashboard__state--fail';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function renderGrid(summary, controlDecision) {
    const bySeverity = summary.by_severity || {};
    const drift = summary.drift_velocity || {};
    const state = controlDecision?.state || 'PASS';
    const score = number(controlDecision?.healthScore);
    return `
      <div class="skcs-drift-dashboard__grid">
        <div class="skcs-drift-dashboard__card"><span class="skcs-drift-dashboard__card-label">Control State</span><div class="skcs-drift-dashboard__card-value">${escapeHtml(state)}</div></div>
        <div class="skcs-drift-dashboard__card"><span class="skcs-drift-dashboard__card-label">Health Score</span><div class="skcs-drift-dashboard__card-value">${score || 0}</div></div>
        <div class="skcs-drift-dashboard__card"><span class="skcs-drift-dashboard__card-label">Total Violations</span><div class="skcs-drift-dashboard__card-value">${number(summary.total_violations)}</div></div>
        <div class="skcs-drift-dashboard__card"><span class="skcs-drift-dashboard__card-label">Critical / Warn / Blocked</span><div class="skcs-drift-dashboard__card-value">${number(summary.critical_violations)} / ${number(summary.warning_violations)} / ${number(summary.blocked_violations)}</div></div>
      </div>
      <div class="skcs-drift-dashboard__grid">
        <div class="skcs-drift-dashboard__card"><span class="skcs-drift-dashboard__card-label">Trend</span><div class="skcs-drift-dashboard__card-value">${escapeHtml(drift.trend || 'stable')}</div></div>
        <div class="skcs-drift-dashboard__card"><span class="skcs-drift-dashboard__card-label">Canonical Integrity</span><div class="skcs-drift-dashboard__card-value">${summary.canonical_integrity_broken ? 'Broken' : 'Clear'}</div></div>
        <div class="skcs-drift-dashboard__card"><span class="skcs-drift-dashboard__card-label">Degraded Flag</span><div class="skcs-drift-dashboard__card-value">${summary.degraded_flag ? 'True' : 'False'}</div></div>
        <div class="skcs-drift-dashboard__card"><span class="skcs-drift-dashboard__card-label">Window</span><div class="skcs-drift-dashboard__card-value">${escapeHtml(summary.window?.from ? new Date(summary.window.from).toLocaleTimeString() : '24h')}</div></div>
      </div>
      <div class="skcs-drift-dashboard__section">
        <h3>Drift Velocity</h3>
        <div class="skcs-drift-dashboard__bars">
          ${(Array.isArray(drift.per_hour_last_24h) ? drift.per_hour_last_24h : []).map((value) => {
            const height = Math.max(8, Math.min(64, number(value) * 4));
            return `<div class="skcs-drift-dashboard__bar" title="${escapeHtml(value)}" style="height:${height}px"></div>`;
          }).join('')}
        </div>
      </div>
      <div class="skcs-drift-dashboard__section">
        <h3>Rule Failure Heatmap</h3>
        ${Array.isArray(summary.rule_failure_heatmap) && summary.rule_failure_heatmap.length
          ? `
            <table class="skcs-drift-dashboard__table">
              <thead>
                <tr><th>Rule</th><th>Field Path</th><th>Count</th><th>% of Total</th></tr>
              </thead>
              <tbody>
                ${summary.rule_failure_heatmap.map((row) => `
                  <tr>
                    <td>${escapeHtml(row.rule_id)}</td>
                    <td>${escapeHtml(row.field_path || '')}</td>
                    <td>${number(row.count)}</td>
                    <td>${number(row.pct_of_total).toFixed(2)}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
          : '<p class="skcs-drift-dashboard__empty">No heatmap rows are available for the selected window.</p>'}
      </div>
      <div class="skcs-drift-dashboard__section">
        <h3>Provider Drift</h3>
        ${Array.isArray(summary.provider_drift) && summary.provider_drift.length
          ? `
            <div class="skcs-drift-dashboard__providers">
              ${summary.provider_drift.map((provider) => `
                <div class="skcs-drift-dashboard__provider">
                  <strong>${escapeHtml(provider.provider || 'unknown')}</strong>
                  <p class="skcs-drift-dashboard__empty" style="margin:8px 0 0;">Missing canonical IDs: ${number(provider.missing_canonical_ids)}</p>
                  <p class="skcs-drift-dashboard__empty" style="margin:6px 0 0;">New field intrusions: ${(provider.new_field_intrusions || []).length}</p>
                </div>
              `).join('')}
            </div>`
          : '<p class="skcs-drift-dashboard__empty">No provider drift has been recorded in this window.</p>'}
      </div>
      <div class="skcs-drift-dashboard__section">
        <h3>Recent Criticals</h3>
        ${Array.isArray(summary.recent_criticals) && summary.recent_criticals.length
          ? `<div class="skcs-drift-dashboard__list">
              ${summary.recent_criticals.map((item) => `
                <article class="skcs-drift-dashboard__feed-item">
                  <small>${escapeHtml(item.occurred_at ? new Date(item.occurred_at).toLocaleString() : '')} • ${escapeHtml(item.pipeline || '')} • ${escapeHtml(item.violation_type || '')}</small>
                  <div>${escapeHtml(item.message || 'Critical semantic violation')}</div>
                </article>
              `).join('')}
            </div>`
          : '<p class="skcs-drift-dashboard__empty">No critical violations were found in the selected window.</p>'}
      </div>
    `;
  }

  async function loadDashboard() {
    const container = getContainer();
    if (!container) return;

    try {
      const response = await fetch(SUMMARY_ENDPOINT, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Request failed with status ${response.status}`);
      }

      const summary = data.summary || {};
      const controlDecision = data.controlDecision || {};

      ensureStyles();
      container.innerHTML = `
        <section class="skcs-drift-dashboard">
          <div class="skcs-drift-dashboard__header">
            <div>
              <h2 class="skcs-drift-dashboard__title">Semantic Drift Dashboard</h2>
              <p class="skcs-drift-dashboard__subtitle">
                Backend facts only. The control plane is evaluated server-side and this view renders the returned state.
              </p>
            </div>
            <span class="skcs-drift-dashboard__state ${stateClass(controlDecision.state)}">
              ${escapeHtml(controlDecision.state || 'PASS')}
            </span>
          </div>
          ${renderGrid(summary, controlDecision)}
        </section>
      `;
    } catch (error) {
      console.error('[semantic-drift-dashboard] Failed to load summary:', error);
      container.innerHTML = `
        <section class="skcs-drift-dashboard">
          <div class="skcs-drift-dashboard__header">
            <div>
              <h2 class="skcs-drift-dashboard__title">Semantic Drift Dashboard</h2>
              <p class="skcs-drift-dashboard__subtitle">Unable to load drift summary from the backend.</p>
            </div>
          </div>
          <p class="skcs-drift-dashboard__empty">${escapeHtml(error.message || 'Unknown error')}</p>
        </section>
      `;
    }
  }

  function start() {
    if (!getContainer()) return;
    loadDashboard();
    window.setInterval(loadDashboard, REFRESH_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
