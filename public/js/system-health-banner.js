(function () {
  'use strict';

  const REFRESH_MS = 60000;
  const HEALTH_ENDPOINT = '/api/health';
  const SLOT_ID = 'system-health-banner';

  function ensureStyles() {
    if (document.getElementById('system-health-banner-styles')) return;
    const style = document.createElement('style');
    style.id = 'system-health-banner-styles';
    style.textContent = `
      #${SLOT_ID} { width: 100%; }
      .skcs-health-banner {
        display: none;
        width: 100%;
        margin: 0;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        font-family: inherit;
      }
      .skcs-health-banner.is-visible { display: block; }
      .skcs-health-banner__inner {
        max-width: 1200px;
        margin: 0 auto;
        padding: 10px 14px;
        border-radius: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px 14px;
        align-items: flex-start;
        justify-content: space-between;
      }
      .skcs-health-banner__headline { font-weight: 700; font-size: 0.95rem; margin: 0; }
      .skcs-health-banner__meta { font-size: 0.82rem; opacity: 0.92; margin: 0; }
      .skcs-health-banner__reasons { margin: 0; padding-left: 18px; font-size: 0.82rem; }
      .skcs-health-banner__pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .skcs-health-banner--warn .skcs-health-banner__inner { background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff7ed; }
      .skcs-health-banner--degraded .skcs-health-banner__inner { background: linear-gradient(135deg, #fb923c, #ea580c); color: #fff7ed; }
      .skcs-health-banner--critical .skcs-health-banner__inner,
      .skcs-health-banner--blocked .skcs-health-banner__inner {
        background: linear-gradient(135deg, #dc2626, #7f1d1d);
        color: #fff1f2;
      }
      .skcs-health-banner__dismiss {
        border: 0;
        background: rgba(255,255,255,0.16);
        color: inherit;
        border-radius: 999px;
        padding: 6px 10px;
        cursor: pointer;
        font-weight: 700;
      }
    `;
    document.head.appendChild(style);
  }

  function getContainer() {
    return document.getElementById(SLOT_ID);
  }

  function stateClass(state) {
    const normalized = String(state || '').trim().toUpperCase();
    if (normalized === 'WARN') return 'skcs-health-banner--warn';
    if (normalized === 'DEGRADED') return 'skcs-health-banner--degraded';
    if (normalized === 'BLOCKED') return 'skcs-health-banner--blocked';
    return 'skcs-health-banner--critical';
  }

  function formatReasons(systemHealth) {
    const reasons = Array.isArray(systemHealth?.reasons) ? systemHealth.reasons : [];
    const controlReasons = Array.isArray(systemHealth?.controlPlane?.reasons)
      ? systemHealth.controlPlane.reasons
      : [];
    const merged = Array.from(new Set(reasons.concat(controlReasons).filter(Boolean)));
    return merged.length ? merged.slice(0, 3) : ['No additional health reasons were provided.'];
  }

  async function loadHealth() {
    const container = getContainer();
    if (!container) return;

    try {
      const response = await fetch(HEALTH_ENDPOINT, { cache: 'no-store' });
      const data = await response.json();
      const systemHealth = data?.system_health || {};
      const state = String(systemHealth.state || 'UNKNOWN').toUpperCase();

      if (!response.ok || state === 'HEALTHY' || state === 'UNKNOWN') {
        container.innerHTML = '';
        container.className = '';
        return;
      }

      ensureStyles();

      const wrapper = document.createElement('section');
      wrapper.className = `skcs-health-banner is-visible ${stateClass(state)}`;
      wrapper.setAttribute('role', 'status');
      wrapper.setAttribute('aria-live', 'polite');

      const reasons = formatReasons(systemHealth)
        .map((reason) => `<li>${String(reason)}</li>`)
        .join('');

      wrapper.innerHTML = `
        <div class="skcs-health-banner__inner">
          <div>
            <p class="skcs-health-banner__headline">Pre-match health: ${state}</p>
            <p class="skcs-health-banner__meta">
              Pre-match context refreshed ${systemHealth.lastUpdatedAt ? new Date(systemHealth.lastUpdatedAt).toLocaleString() : 'moments ago'}
            </p>
            <ul class="skcs-health-banner__reasons">${reasons}</ul>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
            <span class="skcs-health-banner__pill">${state}</span>
            <button class="skcs-health-banner__dismiss" type="button" aria-label="Dismiss health banner">Dismiss</button>
          </div>
        </div>
      `;

      container.innerHTML = '';
      container.appendChild(wrapper);

      const dismissBtn = wrapper.querySelector('.skcs-health-banner__dismiss');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
          container.innerHTML = '';
          container.className = '';
        });
      }
    } catch (error) {
      console.error('[system-health-banner] Failed to load health state:', error);
    }
  }

  function start() {
    const container = getContainer();
    if (!container) return;
    loadHealth();
    window.setInterval(loadHealth, REFRESH_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
