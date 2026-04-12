(function () {
    'use strict';

    const API_BASE = window.API_BASE_URL || 'https://skcs-sports-edge-skcsai.onrender.com';
    const API_KEY = window.USER_API_KEY || (window.SKCS_CONFIG && window.SKCS_CONFIG.userApiKey) || 'skcs_user_12345';

    const daySelect = document.getElementById('daySelect');
    const refreshBtn = document.getElementById('refreshBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const statsGrid = document.getElementById('statsGrid');
    const coverageTableWrap = document.getElementById('coverageTableWrap');
    const sectionsWrap = document.getElementById('sectionsWrap');
    const errorBox = document.getElementById('errorBox');

    let lastPayload = null;

    const SECTION_META = [
        { key: 'direct', title: '⚽ Direct', className: '', pill: 'direct' },
        { key: 'analytical_insights', title: '📊 Analytical Insights', className: 'analytical', pill: 'insight' },
        { key: 'multi', title: '🔀 Multi', className: '', pill: 'multi' },
        { key: 'same_match', title: '🎯 Same Match', className: '', pill: 'same' },
        { key: 'acca_6match', title: '🔥 6-Match ACCA', className: '', pill: 'acca6' },
        { key: 'mega_acca_12', title: '🌐 12-Leg Mega ACCA', className: '', pill: 'mega12' }
    ];

    function showError(message) {
        errorBox.style.display = 'block';
        errorBox.textContent = message;
    }

    function clearError() {
        errorBox.style.display = 'none';
        errorBox.textContent = '';
    }

    function safe(value, fallback) {
        return value === undefined || value === null || value === '' ? (fallback || '-') : value;
    }

    function firstLeg(prediction) {
        return Array.isArray(prediction.matches) && prediction.matches.length ? prediction.matches[0] : {};
    }

    function renderStats(payload) {
        const fulfilled = payload.fulfilled || {};
        const quotas = payload.quotas || {};
        const totalSelected = Number(payload.total_selected || 0);

        const rows = [
            { label: 'Total Selected', value: totalSelected },
            { label: 'Direct', value: `${fulfilled.direct || 0} / ${quotas.direct || 0}` },
            { label: 'Analytical Insights', value: `${fulfilled.analytical_insights || 0} / ${quotas.analytical_insights || 0}` },
            { label: 'Multi', value: `${fulfilled.multi || 0} / ${quotas.multi || 0}` },
            { label: 'Same Match', value: `${fulfilled.same_match || 0} / ${quotas.same_match || 0}` },
            { label: '6-Match ACCA', value: `${fulfilled.acca_6match || 0} / ${quotas.acca_6match || 0}` },
            { label: '12-Leg Mega ACCA', value: `${fulfilled.mega_acca_12 || 0} / ${quotas.mega_acca_12 || 0}` }
        ];

        statsGrid.innerHTML = rows.map((row) => `
            <article class="stat">
              <div class="label">${row.label}</div>
              <div class="value">${row.value}</div>
            </article>
        `).join('');
    }

    function renderCoverage(coverage) {
        const entries = Object.values(coverage || {});
        entries.sort((a, b) => String(a.plan_id).localeCompare(String(b.plan_id)));

        const headers = ['Plan', 'Direct', 'Insights', 'Multi', 'Same', '6-ACCA', '12-Mega', 'Coverage'];
        const tableRows = entries.map((row) => {
            const req = row.required || {};
            const statusClass = row.covered ? 'ok' : 'warn';
            const statusText = row.covered ? 'Covered' : `Shortfall: ${Object.keys(row.shortages || {}).join(', ')}`;
            return `
              <tr>
                <td>${safe(row.plan_name)}</td>
                <td>${safe(req.direct, 0)}</td>
                <td>${safe(req.analytical_insights, 0)}</td>
                <td>${safe(req.multi, 0)}</td>
                <td>${safe(req.same_match, 0)}</td>
                <td>${safe(req.acca_6match, 0)}</td>
                <td>${safe(req.mega_acca_12, 0)}</td>
                <td class="${statusClass}">${statusText}</td>
              </tr>
            `;
        }).join('');

        coverageTableWrap.innerHTML = `
          <table>
            <thead>
              <tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        `;
    }

    function renderCard(prediction) {
        const leg = firstLeg(prediction);
        const sectionType = String(prediction.section_type || prediction.type || '').toLowerCase();
        const isAcca = sectionType === 'acca_6match' || sectionType === 'mega_acca_12';
        const teams = `${safe(leg.home_team || leg.metadata?.home_team)} vs ${safe(leg.away_team || leg.metadata?.away_team)}`;
        const compound = Math.max(0, Math.min(100, Math.round(Number(prediction.total_confidence || 0) * 100) / 100));
        const line = isAcca
            ? `Total Ticket Probability: ${compound}%`
            : `${safe(leg.market)} • ${safe(leg.prediction)} • ${compound}%`;
        const kickoff = safe(leg.commence_time || leg.match_date || leg.metadata?.kickoff_time || leg.metadata?.match_time);
        const league = safe(leg.metadata?.league || leg.league || leg.sport || prediction.section_type);
        const validation = prediction.validation_matrix;

        const legsPreview = Array.isArray(prediction.matches) && prediction.matches.length > 1
            ? `<div class="legs">${prediction.matches.map((m, idx) => {
                const legConfidence = Math.max(0, Math.min(100, Math.round(Number(m.confidence || 0))));
                return `${idx + 1}. ${safe(m.home_team || m.metadata?.home_team)} vs ${safe(m.away_team || m.metadata?.away_team)} — ${safe(m.market)} ${safe(m.prediction)} | ${legConfidence}%`;
            }).join('<br>')}</div>`
            : '';

        const validationInfo = validation
            ? `<div class="line">Validation: ${validation.valid ? 'PASS' : 'FAIL'} • Min Goals: ${validation.min_total_goals_required}</div>`
            : '';
        const insights = prediction.insights || {};
        const insightsFooter = (insights.weather || insights.availability || insights.stability)
            ? `<div class="line">Weather: ${safe(insights.weather)} • Availability: ${safe(insights.availability)} • Stability: ${safe(insights.stability)}</div>`
            : '';
        const engineLog = Array.isArray(prediction.engine_log) ? prediction.engine_log.slice(0, 2) : [];
        const engineLogFooter = engineLog.length
            ? `<div class="line">${engineLog.map((line) => safe(line)).join(' | ')}</div>`
            : '';

        return `
          <article class="card">
            <div class="teams">${teams}</div>
            <div class="line">${line}</div>
            <div class="line">${league} • ${kickoff}</div>
            ${validationInfo}
            ${legsPreview}
            ${insightsFooter}
            ${engineLogFooter}
          </article>
        `;
    }

    function renderSections(payload) {
        const categories = payload.categories || {};
        sectionsWrap.innerHTML = SECTION_META.map((section) => {
            const items = Array.isArray(categories[section.key]) ? categories[section.key] : [];
            return `
              <section class="section ${section.className}">
                <h3>
                  <span>${section.title}</span>
                  <span class="pill ${section.pill}">${items.length} Picks</span>
                </h3>
                <p class="meta">Derived from 30-Day Deep VIP baseline for ${payload.day}.</p>
                <div class="cards">${items.map(renderCard).join('')}</div>
              </section>
            `;
        }).join('');
    }

    async function fetchPayload() {
        clearError();
        const day = daySelect.value || 'saturday';
        const endpoint = `${API_BASE}/api/vip/stress-payload?day=${encodeURIComponent(day)}`;
        try {
            const response = await fetch(endpoint, {
                headers: {
                    'x-api-key': API_KEY
                }
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Request failed (${response.status}): ${text}`);
            }

            return response.json();
        } catch (error) {
            const fallback = await fetch('data/vip-stress-saturday.json');
            if (!fallback.ok) throw error;
            const payload = await fallback.json();
            return {
                ok: true,
                source_rows: payload.total_selected || 0,
                payload,
                tier_coverage: {}
            };
        }
    }

    async function refresh() {
        try {
            refreshBtn.disabled = true;
            refreshBtn.textContent = 'Refreshing...';
            const data = await fetchPayload();
            if (!data || !data.ok || !data.payload) {
                throw new Error('Payload format is invalid');
            }

            lastPayload = data;
            renderStats(data.payload);
            renderCoverage(data.tier_coverage || {});
            renderSections(data.payload);
        } catch (error) {
            showError(error.message);
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.textContent = 'Refresh Payload';
        }
    }

    function downloadPayload() {
        if (!lastPayload) return;
        const day = (lastPayload.payload && lastPayload.payload.day) || 'saturday';
        const blob = new Blob([JSON.stringify(lastPayload, null, 2)], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.download = `skcs-vip-stress-payload-${day}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(href);
    }

    refreshBtn.addEventListener('click', refresh);
    daySelect.addEventListener('change', refresh);
    downloadBtn.addEventListener('click', downloadPayload);
    refresh();
})();
