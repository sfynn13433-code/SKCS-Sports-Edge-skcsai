(function () {
    'use strict';

    // ============================================
    // STEP 1: CENTRALIZED STATE MANAGEMENT
    // ============================================
    const STATE = {
        currentNavGroup: 'Niche Markets', // Default to Niche Markets per design
        viewState: 'PORTAL', // 'PORTAL', 'MARKET', 'ACCA'
        selectedSport: null,
        animationSpeed: 10,
        lastPayload: null
    };

    function updateState(updates) {
        Object.assign(STATE, updates);
        render();
    }

    // ============================================
    // API & CONFIG
    // ============================================
    const API_BASE = window.API_BASE_URL || 'https://skcs-sports-edge-skcsai.onrender.com';
    const API_KEY = window.USER_API_KEY || (window.SKCS_CONFIG && window.SKCS_CONFIG.userApiKey) || 'skcs_user_12345';
    const includeAllParam = new URLSearchParams(window.location.search).get('include_all');
    const INCLUDE_ALL_MODE = !['0', 'false'].includes(String(includeAllParam || '1').trim().toLowerCase());

    const daySelect = document.getElementById('daySelect');
    const refreshBtn = document.getElementById('refreshBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const statsGrid = document.getElementById('statsGrid');
    const coverageTableWrap = document.getElementById('coverageTableWrap');
    const sectionsWrap = document.getElementById('sectionsWrap');
    const errorBox = document.getElementById('errorBox');

    // ============================================
    // MARKET CATEGORIES & SPORTS (Portal Design)
    // ============================================
    const SPORTS_CATALOG = {
        'Niche Markets': [
            { id: 'rugby', name: 'Rugby', icon: '🏉', color: '#60a5fa' },
            { id: 'mma', name: 'MMA', icon: '🥊', color: '#4ade80' },
            { id: 'darts', name: 'Darts', icon: '🎯', color: '#fbbf24' }
        ],
        'Premium Markets': [
            { id: 'cricket', name: 'Cricket', icon: '🏏', color: '#f87171' },
            { id: 'esports', name: 'eSports', icon: '🎮', color: '#a78bfa' }
        ],
        'Global Majors': [
            { id: 'football', name: 'Football', icon: '⚽', color: '#3b82f6' },
            { id: 'basketball', name: 'Basketball', icon: '🏀', color: '#f97316' },
            { id: 'tennis', name: 'Tennis', icon: '🎾', color: '#22c55e' }
        ],
        'American Sports': [
            { id: 'american_football', name: 'American Football', icon: '🏈', color: '#8b5cf6' },
            { id: 'baseball', name: 'Baseball', icon: '⚾', color: '#ef4444' },
            { id: 'hockey', name: 'Hockey', icon: '🏒', color: '#06b6d4' }
        ]
    };

    const SECTION_META = [
        { key: 'direct', title: '⚽ Direct', className: '', pill: 'direct' },
        { key: 'analytical_insights', title: '📊 Analytical Insights', className: 'analytical', pill: 'insight' },
        { key: 'multi', title: '🔀 Multi', className: '', pill: 'multi' },
        { key: 'same_match', title: '🎯 Same Match', className: '', pill: 'same' },
        { key: 'acca_6match', title: '🔥 6-Match ACCA', className: '', pill: 'acca6' },
        { key: 'mega_acca_12', title: '🌐 12-Leg Mega ACCA', className: '', pill: 'mega12' }
    ];

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
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

            STATE.lastPayload = data;
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
        if (!STATE.lastPayload) return;
        const day = (STATE.lastPayload.payload && STATE.lastPayload.payload.day) || 'saturday';
        const blob = new Blob([JSON.stringify(STATE.lastPayload, null, 2)], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.download = `skcs-vip-stress-payload-${day}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(href);
    }

    // ============================================
    // STEP 2: ISOLATED COMPONENTS
    // ============================================

    // COMPONENT: DashboardHeader
    function DashboardHeader() {
        // Determine view label: PORTAL when no sport selected, MARKET when viewing a sport
        const viewLabel = STATE.selectedSport ? 'MARKET' : 
                          STATE.viewState === 'ACCA' ? 'ACCA' : 'PORTAL';
        return `
            <section class="hero" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
                <div>
                    <h1 style="margin: 0;">SportAnalytics Pro</h1>
                    <p style="margin: 8px 0 0; color: var(--muted);">Advanced multi-sport prediction analytics and portfolio management.</p>
                </div>
                <div class="stats" style="gap: 24px; margin: 0;">
                    <div class="stat" style="text-align: right;">
                        <div class="label" style="font-size: 0.75rem; letter-spacing: 0.05em; color: var(--muted);">STATUS</div>
                        <div class="value" style="font-size: 0.95rem; font-weight: 700; color: #4ade80;">Live</div>
                    </div>
                    <div class="stat" style="text-align: right;">
                        <div class="label" style="font-size: 0.75rem; letter-spacing: 0.05em; color: var(--muted);">VIEW</div>
                        <div class="value" style="font-size: 0.95rem; font-weight: 700;">${viewLabel}</div>
                    </div>
                    <div class="stat" style="text-align: right;">
                        <div class="label" style="font-size: 0.75rem; letter-spacing: 0.05em; color: var(--muted);">SELECTION</div>
                        <div class="value" style="font-size: 0.95rem; font-weight: 700;">${STATE.selectedSport ? STATE.selectedSport.toUpperCase() : 'None'}</div>
                    </div>
                </div>
            </section>
        `;
    }

    // COMPONENT: BottomControls
    function BottomControls() {
        return `
            <div class="controls" style="flex-direction: row; gap: 24px; margin-top: 24px; padding: 16px 20px; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 12px; background: rgba(15, 30, 44, 0.5); align-items: center; flex-wrap: wrap;">
                <div style="display: flex; gap: 12px; align-items: center;">
                    <label for="navGroupSelect" style="font-weight: 600; color: var(--muted); font-size: 0.9rem;">Navigation</label>
                    <select id="navGroupSelect" style="border: 1px solid rgba(148, 163, 184, 0.35); background: rgba(15, 23, 42, 0.78); color: var(--text); border-radius: 10px; padding: 10px 14px; font-size: 0.92rem; cursor: pointer; min-width: 160px;">
                        ${Object.keys(SPORTS_CATALOG).map(group => `
                            <option value="${group}" ${group === STATE.currentNavGroup ? 'selected' : ''}>${group}</option>
                        `).join('')}
                    </select>
                </div>
                <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                    <label for="animSpeed" style="font-weight: 600; color: var(--muted); font-size: 0.9rem;">Anim Speed</label>
                    <input type="range" id="animSpeed" min="1" max="50" value="${STATE.animationSpeed}" style="width: 160px; cursor: pointer;">
                    <span id="speedValue" style="background: rgba(30, 41, 59, 0.8); color: var(--text); font-size: 0.9rem; padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.2); min-width: 40px; text-align: center; font-weight: 600;">${STATE.animationSpeed}</span>
                </div>
            </div>
        `;
    }

    // COMPONENT: MainContentArea (Router)
    function MainContentArea() {
        const { viewState } = STATE;

        let content = '';
        if (viewState === 'PORTAL') {
            content = SportCategoryPortal();
        } else if (viewState === 'MARKET') {
            content = SportInsights();
        } else if (viewState === 'ACCA') {
            content = AccaEngine();
        } else {
            content = '<div style="padding: 20px; color: var(--muted);">Select a view</div>';
        }

        return content;
    }

    // COMPONENT: SportCategoryPortal
    function SportCategoryPortal() {
        const sports = SPORTS_CATALOG[STATE.currentNavGroup] || [];
        const marketTitle = STATE.currentNavGroup; // "Niche Markets", "Premium Markets", etc.

        if (STATE.selectedSport === null) {
            // Sport selection grid - matches screenshot design
            return `
                <section style="margin-top: 24px; background: rgba(15, 23, 42, 0.6); border-radius: 16px; padding: 32px 24px;">
                    <h2 style="text-align: center; margin: 0 0 32px; font-size: 1.5rem; font-weight: 600; color: var(--text);">
                        Explore ${marketTitle}
                    </h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; justify-items: center;">
                        ${sports.map(sport => `
                            <div onclick="window.selectSport('${sport.id}')" 
                                 style="cursor: pointer; 
                                        background: rgba(30, 41, 59, 0.8); 
                                        border-radius: 16px; 
                                        padding: 40px 24px; 
                                        width: 100%; 
                                        max-width: 220px;
                                        text-align: center; 
                                        transition: all 0.3s ease;
                                        border: 1px solid rgba(148, 163, 184, 0.1);
                                        display: flex;
                                        flex-direction: column;
                                        align-items: center;
                                        min-height: 180px;"
                                 onmouseover="this.style.transform='translateY(-4px)'; this.style.borderColor='rgba(148, 163, 184, 0.3)';"
                                 onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='rgba(148, 163, 184, 0.1)';">
                                <div style="font-size: 3.5rem; margin-bottom: 20px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); color: ${sport.color};">${sport.icon}</div>
                                <div style="font-weight: 700; font-size: 1.25rem; color: var(--text);">${sport.name}</div>
                            </div>
                        `).join('')}
                    </div>
                </section>
            `;
        } else {
            // Show sport insights with back button
            const selectedSportData = sports.find(s => s.id === STATE.selectedSport);
            const sportName = selectedSportData ? selectedSportData.name : STATE.selectedSport;
            return `
                <div style="margin-top: 16px;">
                    <div style="margin-bottom: 20px;">
                        <button onclick="window.deselectSport()" 
                                style="display: inline-flex; 
                                       align-items: center; 
                                       gap: 8px;
                                       border: 1px solid rgba(148, 163, 184, 0.2); 
                                       background: rgba(30, 41, 59, 0.8); 
                                       color: #60a5fa; 
                                       border-radius: 10px; 
                                       padding: 12px 18px; 
                                       font-size: 0.95rem; 
                                       cursor: pointer; 
                                       font-weight: 600;
                                       transition: all 0.2s ease;"
                                onmouseover="this.style.background='rgba(51, 65, 85, 0.9)';"
                                onmouseout="this.style.background='rgba(30, 41, 59, 0.8)';">
                            <span style="font-size: 1.2rem;">←</span>
                            <span>Back to ${marketTitle}</span>
                        </button>
                    </div>
                    ${SportInsightsLoading(sportName)}
                </div>
            `;
        }
    }

    // COMPONENT: Sport Insights Loading (matches screenshot placeholder UI)
    function SportInsightsLoading(sportName) {
        return `
            <section style="background: rgba(15, 23, 42, 0.6); border-radius: 16px; padding: 32px 40px;">
                <h2 style="margin: 0 0 28px; font-size: 1.5rem; font-weight: 600; color: var(--text);">
                    ${sportName} Insights
                </h2>
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    ${Array.from({ length: 3 }).map(() => `
                        <div style="background: rgba(51, 65, 85, 0.6); border-radius: 10px; padding: 24px;">
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                <div style="height: 16px; background: rgba(148, 163, 184, 0.4); border-radius: 4px; width: 40%;"></div>
                                <div style="height: 12px; background: rgba(148, 163, 184, 0.25); border-radius: 4px; width: 25%;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>
        `;
    }

    // COMPONENT: SportInsights
    function SportInsights() {
        return `
            <section class="section" style="margin-top: 24px;">
                <h3 style="display: flex; justify-content: space-between; align-items: center;">
                    <span>📊 Deep Insights: ${STATE.selectedSport ? STATE.selectedSport.toUpperCase() : 'All Sports'}</span>
                    <button onclick="window.resetView()" style="border: 1px solid rgba(148, 163, 184, 0.35); background: rgba(15, 23, 42, 0.78); color: var(--text); border-radius: 10px; padding: 8px 12px; font-size: 0.85rem; cursor: pointer;">Reset</button>
                </h3>
                <p class="meta">Advanced analytics and contextual insights.</p>
                <div class="cards">
                    <div class="card">
                        <div class="teams" style="margin-bottom: 12px;">📈 Form Analysis</div>
                        <div class="line">Recent team performance trends and trajectories.</div>
                    </div>
                    <div class="card">
                        <div class="teams" style="margin-bottom: 12px;">⚠️ Risk Assessment</div>
                        <div class="line">Injury reports, weather impact, and external factors.</div>
                    </div>
                    <div class="card">
                        <div class="teams" style="margin-bottom: 12px;">🔬 Statistical Edge</div>
                        <div class="line">Head-to-head records, seasonal patterns, and anomalies.</div>
                    </div>
                    <div class="card">
                        <div class="teams" style="margin-bottom: 12px;">💡 AI Recommendation</div>
                        <div class="line">Machine learning confidence tiers and secondary pivots.</div>
                    </div>
                </div>
            </section>
        `;
    }

    // COMPONENT: AccaEngine (Cross-Sport Accumulator Engine per screenshot)
    function AccaEngine() {
        const radius = 140;
        const speed = Math.max(2, (55 - STATE.animationSpeed) / 5); // Rotation speed
        const dotsCount = 10;

        return `
            <section style="margin-top: 24px; background: rgba(15, 23, 42, 0.6); border-radius: 16px; padding: 40px 24px; text-align: center;">
                <h2 style="margin: 0 0 40px; font-size: 1.5rem; font-weight: 600; color: var(--text);">
                    Cross-Sport Accumulator Engine
                </h2>
                <div style="display: flex; justify-content: center; align-items: center; padding: 20px;">
                    <svg width="360" height="360" viewBox="0 0 360 360" style="filter: drop-shadow(0 0 30px rgba(139, 92, 246, 0.15));">
                        <defs>
                            <style>
                                @keyframes spinDots {
                                    from { transform: rotate(0deg); }
                                    to { transform: rotate(360deg); }
                                }
                                .rotating-group {
                                    transform-origin: 180px 180px;
                                    animation: spinDots ${speed}s linear infinite;
                                }
                            </style>
                        </defs>
                        <!-- Outer ring -->
                        <circle cx="180" cy="180" r="${radius}" fill="none" stroke="rgba(148, 163, 184, 0.3)" stroke-width="1.5"/>
                        
                        <!-- Rotating dots -->
                        <g class="rotating-group">
                            ${Array.from({ length: dotsCount }).map((_, i) => {
                                const angle = (i / dotsCount) * Math.PI * 2 - Math.PI / 2; // Start from top
                                const x = 180 + radius * Math.cos(angle);
                                const y = 180 + radius * Math.sin(angle);
                                // Purple for most, blue for a few (matching screenshot)
                                const color = i < 3 ? '#3b82f6' : '#8b5cf6';
                                return `
                                    <circle cx="${x}" cy="${y}" r="12" fill="${color}" opacity="0.9"/>
                                `;
                            }).join('')}
                        </g>
                    </svg>
                </div>
                <p style="margin: 24px 0 0; color: #8b5cf6; font-size: 1rem; font-weight: 500;">
                    Real-time correlation matrix active
                </p>
            </section>
        `;
    }

    // VIP Dashboard (original functionality wrapped)
    function renderVIPDashboard() {
        if (!STATE.lastPayload) {
            return '<div style="padding: 20px; color: var(--muted);">Loading payload...</div>';
        }

        const payload = STATE.lastPayload.payload || {};
        return `
            <section id="statsGridVIP" class="stats"></section>
            <section class="coverage">
                <h2>Offer Coverage Matrix</h2>
                <div id="coverageTableWrapVIP"></div>
            </section>
            <section id="sectionsWrapVIP" class="sections"></section>
        `;
    }

    // ============================================
    // MAIN RENDER & EVENT WIRING
    // ============================================
    function render() {
        // Render header
        const headerContainer = document.getElementById('dashboardHeader');
        if (headerContainer) {
            headerContainer.innerHTML = DashboardHeader();
        }

        // Render main content area
        const mainContainer = document.getElementById('mainContentArea');
        if (mainContainer) {
            mainContainer.innerHTML = MainContentArea();
        }

        // Render bottom controls
        const controlsContainer = document.getElementById('bottomControls');
        if (controlsContainer) {
            controlsContainer.innerHTML = BottomControls();
        }

        // Wire up control event listeners after render
        wireControls();
    }

    function wireControls() {
        // Navigation group selector
        const navSelect = document.getElementById('navGroupSelect');
        if (navSelect) {
            navSelect.addEventListener('change', (e) => {
                updateState({ currentNavGroup: e.target.value, selectedSport: null });
            });
        }

        // Animation speed slider
        const animSpeedInput = document.getElementById('animSpeed');
        if (animSpeedInput) {
            animSpeedInput.addEventListener('input', (e) => {
                const speed = parseInt(e.target.value);
                updateState({ animationSpeed: speed });
            });
        }
    }

    // Global functions for sport selection
    window.selectSport = function(sportId) {
        updateState({ selectedSport: sportId });
        refresh();
    };

    window.deselectSport = function() {
        updateState({ selectedSport: null });
    };

    window.resetView = function() {
        updateState({ viewState: 'PORTAL', selectedSport: null });
    };

    // Legacy button wiring (for VIP data loading)
    if (refreshBtn) refreshBtn.addEventListener('click', refresh);
    if (daySelect) daySelect.addEventListener('change', refresh);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadPayload);

    // Initial render
    render();
})();
