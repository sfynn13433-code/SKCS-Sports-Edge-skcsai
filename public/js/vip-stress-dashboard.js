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
    const includeAllParam = new URLSearchParams(window.location.search).get('include_all');
    const INCLUDE_ALL_MODE = !['0', 'false'].includes(String(includeAllParam || '1').trim().toLowerCase());

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

    function toNumber(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function parseMetadata(metadata) {
        if (!metadata) return {};
        if (typeof metadata === 'string') {
            try {
                const parsed = JSON.parse(metadata);
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (_error) {
                return {};
            }
        }
        return typeof metadata === 'object' ? metadata : {};
    }

    function resolveIntelligenceBadgeState(prediction, leg) {
        const parsedMeta = parseMetadata(leg?.metadata || prediction?.metadata || {});
        const contextIntell = (parsedMeta.context_intelligence && typeof parsedMeta.context_intelligence === 'object')
            ? parsedMeta.context_intelligence
            : {};
        const signals = (contextIntell.signals && typeof contextIntell.signals === 'object')
            ? contextIntell.signals
            : ((parsedMeta.signals && typeof parsedMeta.signals === 'object') ? parsedMeta.signals : {});

        const weatherRiskRaw = (
            signals.weather_risk
            ?? contextIntell.weather_risk
            ?? parsedMeta.weather_risk_coefficient
            ?? prediction?.weather_risk_coefficient
            ?? 0
        );
        const weatherRisk = Math.max(0, Math.min(1, toNumber(weatherRiskRaw, 0)));

        const confidenceRaw = (
            contextIntell.p_adj
            ?? parsedMeta.p_adj_after_context_risks
            ?? parsedMeta.confidence_pct
            ?? prediction?.confidence_pct
            ?? prediction?.total_confidence
            ?? leg?.confidence
            ?? 0
        );
        const normalizedRawConfidence = toNumber(confidenceRaw, 0);
        const confidence = normalizedRawConfidence > 0 && normalizedRawConfidence < 1
            ? normalizedRawConfidence * 100
            : normalizedRawConfidence;

        const statusRaw = (
            prediction?.ai_insight
            ?? parsedMeta.ai_insight
            ?? contextIntell.ai_insight
            ?? (
                confidence >= 80
                    ? 'VERIFIED_EDGE'
                    : (confidence >= 70 ? 'MODERATE_RISK' : (confidence >= 59 ? 'HIGH_RISK' : 'EXTREME_RISK'))
            )
        );
        const status = String(statusRaw || 'PENDING').trim().toUpperCase();

        return {
            weatherRisk,
            confidence: Number.isFinite(confidence) ? confidence : 0,
            status
        };
    }

    function renderIntelligenceBadges(prediction, leg) {
        const badgeState = resolveIntelligenceBadgeState(prediction, leg);
        const confidence = Math.max(0, Math.min(100, badgeState.confidence));
        const weatherRiskPercent = Math.round(badgeState.weatherRisk * 100);
        const parts = [];

        if (badgeState.status === 'VERIFIED_EDGE') {
            parts.push(`
                <div class="intel-badge ultra">
                  <span class="intel-icon">💎</span>
                  ULTRA TIER: ${confidence.toFixed(1)}% Confidence
                </div>
            `);
        }

        if (badgeState.weatherRisk > 0) {
            parts.push(`
                <div class="intel-badge weather">
                  <span class="intel-icon">🌧️</span>
                  Weather Risk: ${weatherRiskPercent}% Penalty Applied
                </div>
            `);
        }

        if (confidence >= 70 && confidence < 80) {
            parts.push(`
                <div class="intel-badge weather">
                  <span class="intel-icon">📊</span>
                  Moderate Caution: ${confidence.toFixed(1)}% (Review context before selection)
                </div>
            `);
        } else if (badgeState.status === 'EXPECTED_VARIANCE' || (confidence >= 59 && confidence < 70)) {
            parts.push(`
                <div class="intel-badge filtered">
                  <span class="intel-icon">⚠️</span>
                  High Caution: ${confidence.toFixed(1)}% (Pivot to Secondary Insights)
                </div>
            `);
        } else if (confidence < 59) {
            parts.push(`
                <div class="intel-badge filtered">
                  <span class="intel-icon">🛑</span>
                  Extreme Caution Advised: ${confidence.toFixed(1)}% (Pivot to Secondary Insights)
                </div>
            `);
        }

        if (!parts.length) return '';
        return `<div class="intel-badges">${parts.join('')}</div>`;
    }

    function firstLeg(prediction) {
        return Array.isArray(prediction.matches) && prediction.matches.length ? prediction.matches[0] : {};
    }

    function normalizeMarketKey(value) {
        return String(value || '').trim().toLowerCase();
    }

    function resolveLegPrediction(match) {
        return String(
            match?.prediction
            || match?.recommendation
            || match?.pick
            || match?.selection
            || match?.outcome
            || match?.metadata?.prediction
            || match?.metadata?.recommendation
            || match?.metadata?.pick
            || match?.metadata?.selection
            || match?.metadata?.predicted_outcome
            || ''
        ).trim();
    }

    function formatLegSelection(match) {
        const market = String(match?.market || match?.market_type || '').trim();
        let prediction = resolveLegPrediction(match);
        const marketKey = normalizeMarketKey(market);

        if (!prediction) {
            if (marketKey === '1x2' || marketKey === 'match_result' || marketKey === 'full_time_result') prediction = 'home_win';
            else if (marketKey.includes('double_chance')) prediction = '1x';
            else if (marketKey.includes('over')) prediction = 'over';
            else if (marketKey.includes('under')) prediction = 'under';
            else prediction = 'selection';
        }

        const predKey = String(prediction).trim().toLowerCase();
        if (marketKey === '1x2' || marketKey === 'match_result' || marketKey === 'full_time_result') {
            if (predKey === 'home_win' || predKey === 'home') return 'HOME WIN';
            if (predKey === 'away_win' || predKey === 'away') return 'AWAY WIN';
            if (predKey === 'draw' || predKey === 'x') return 'DRAW';
        }
        if (marketKey.includes('double_chance')) {
            if (predKey === '1x') return 'DOUBLE CHANCE 1X';
            if (predKey === 'x2') return 'DOUBLE CHANCE X2';
            if (predKey === '12') return 'DOUBLE CHANCE 12';
        }
        if (marketKey.includes('over')) return `OVER (${market || 'line'})`;
        if (marketKey.includes('under')) return `UNDER (${market || 'line'})`;
        return String(prediction || 'SELECTION').replace(/_/g, ' ').toUpperCase();
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
        const isDirect = sectionType === 'direct' || sectionType === 'single';
        const teams = `${safe(leg.home_team || leg.metadata?.home_team)} vs ${safe(leg.away_team || leg.metadata?.away_team)}`;
        const compound = Math.max(0, Math.min(100, Math.round(Number(prediction.total_confidence || 0) * 100) / 100));
        const line = isAcca
            ? `Total Ticket Probability: ${compound}%`
            : `${safe(leg.market)} • ${safe(leg.prediction)} • ${compound}%`;
        const kickoff = safe(leg.commence_time || leg.match_date || leg.metadata?.kickoff_time || leg.metadata?.match_time);
        const league = safe(leg.metadata?.league || leg.league || leg.sport || prediction.section_type);
        const intelligenceBadges = renderIntelligenceBadges(prediction, leg);
        const validation = prediction.validation_matrix;

        const legsPreview = Array.isArray(prediction.matches) && prediction.matches.length > 1
            ? `<div class="legs">${prediction.matches.map((m, idx) => {
                const legConfidence = Math.max(0, Math.min(100, Math.round(Number(m.confidence || 0))));
                return `${idx + 1}. ${safe(m.home_team || m.metadata?.home_team)} vs ${safe(m.away_team || m.metadata?.away_team)} — ${safe(m.market)} ${formatLegSelection(m)} | ${legConfidence}%`;
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
        const secondaryInsights = Array.isArray(prediction.secondary_insights) ? prediction.secondary_insights.slice(0, 4) : [];
        const isHighRiskDirect = isDirect && compound >= 59 && compound <= 69;
        const isExtremeRiskDirect = isDirect && compound >= 0 && compound <= 58;
        const secondaryPivotHtml = (isHighRiskDirect || isExtremeRiskDirect)
            ? `
            <div style="margin-top:10px;padding:${isExtremeRiskDirect ? '12px' : '10px'};border:${isExtremeRiskDirect ? '2px solid #dc2626' : '1px solid #f97316'};background:${isExtremeRiskDirect ? '#fee2e2' : '#fff7ed'};color:${isExtremeRiskDirect ? '#7f1d1d' : '#9a3412'};border-radius:8px;">
              <div style="font-weight:800;font-size:${isExtremeRiskDirect ? '0.95rem' : '0.88rem'};line-height:1.4;">
                ${isExtremeRiskDirect ? 'EXTREME CAUTION ADVISED: SELECT SECONDARY INSIGHTS.' : 'HIGH CAUTION: PIVOT TO SECONDARY INSIGHTS.'}
              </div>
              <div style="margin-top:6px;font-size:0.8rem;font-weight:700;">
                ${isExtremeRiskDirect ? `Secondary set: ${secondaryInsights.length}/4` : `Secondary set available: ${secondaryInsights.length}`}
              </div>
              ${secondaryInsights.length ? `
                <ul style="margin-top:8px;padding-left:16px;">
                    ${secondaryInsights.map((item) => {
                        const label = safe(item?.label || item?.market || item?.prediction, 'Secondary');
                        const conf = toNumber(item?.confidence, 0);
                        return `<li>${label} (${conf.toFixed(0)}%)</li>`;
                    }).join('')}
                </ul>
              ` : ''}
            </div>
            `
            : '';

        return `
          <article class="card">
            <div class="teams">${teams}</div>
            <div class="line">${line}</div>
            <div class="line">${league} • ${kickoff}</div>
            ${intelligenceBadges}
            ${secondaryPivotHtml}
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
        const endpoint = `${API_BASE}/api/vip/stress-payload?day=${encodeURIComponent(day)}${INCLUDE_ALL_MODE ? '&include_all=1' : ''}`;
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
