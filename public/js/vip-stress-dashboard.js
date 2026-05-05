(function () {
    'use strict';

    // ============================================
    // STEP 1: CENTRALIZED STATE MANAGEMENT
    // ============================================
    const STATE = {
        currentNavGroup: 'Global Majors',
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
    // NAVIGATION GROUPS & SPORTS
    // ============================================
    const SPORTS_CATALOG = {
        'Global Majors': [
            { id: 'football', name: '⚽ Football', icon: '⚽' },
            { id: 'basketball', name: '🏀 Basketball', icon: '🏀' },
            { id: 'tennis', name: '🎾 Tennis', icon: '🎾' },
            { id: 'cricket', name: '🏏 Cricket', icon: '🏏' }
        ],
        'American Sports': [
            { id: 'american_football', name: '🏈 American Football', icon: '🏈' },
            { id: 'baseball', name: '⚾ Baseball', icon: '⚾' },
            { id: 'hockey', name: '🏒 Hockey', icon: '🏒' }
        ],
        'Niche Sports': [
            { id: 'rugby', name: '🏉 Rugby', icon: '🏉' },
            { id: 'volleyball', name: '🏐 Volleyball', icon: '🏐' },
            { id: 'handball', name: '🤝 Handball', icon: '🤝' },
            { id: 'afl', name: '🦗 AFL', icon: '🦗' }
        ],
        'Motor & Combat': [
            { id: 'formula1', name: '🏎️ Formula 1', icon: '🏎️' },
            { id: 'mma', name: '🥊 MMA', icon: '🥊' }
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
        return `
            <section class="hero">
                <h1>SportAnalytics Pro</h1>
                <p>Advanced multi-sport prediction analytics and portfolio management.</p>
                <div class="stats" style="margin-top: 16px; gap: 16px;">
                    <div class="stat">
                        <div class="label">STATUS</div>
                        <div class="value">${STATE.viewState}</div>
                    </div>
                    <div class="stat">
                        <div class="label">VIEW</div>
                        <div class="value">${STATE.currentNavGroup}</div>
                    </div>
                    <div class="stat">
                        <div class="label">SELECTION</div>
                        <div class="value">${STATE.selectedSport ? STATE.selectedSport.toUpperCase() : 'None'}</div>
                    </div>
                    <div class="stat">
                        <div class="label">ANIM SPEED</div>
                        <div class="value">${STATE.animationSpeed}ms</div>
                    </div>
                </div>
            </section>
        `;
    }

    // COMPONENT: BottomControls
    function BottomControls() {
        return `
            <div class="controls" style="flex-direction: column; gap: 16px; margin-top: 24px; padding: 16px; border: 1px solid rgba(148, 163, 184, 0.28); border-radius: 12px; background: rgba(15, 30, 44, 0.5);">
                <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                    <label for="navGroupSelect" style="font-weight: 700;">Navigation:</label>
                    <select id="navGroupSelect" style="border: 1px solid rgba(148, 163, 184, 0.35); background: rgba(15, 23, 42, 0.78); color: var(--text); border-radius: 10px; padding: 10px 12px; font-size: 0.92rem; cursor: pointer;">
                        ${Object.keys(SPORTS_CATALOG).map(group => `
                            <option value="${group}" ${group === STATE.currentNavGroup ? 'selected' : ''}>${group}</option>
                        `).join('')}
                    </select>
                </div>
                <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                    <label for="animSpeed" style="font-weight: 700;">Animation Speed:</label>
                    <input type="range" id="animSpeed" min="1" max="50" value="${STATE.animationSpeed}" style="width: 200px; cursor: pointer;">
                    <span id="speedValue" style="color: var(--muted); font-size: 0.9rem; min-width: 60px;">${STATE.animationSpeed}ms</span>
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

        if (STATE.selectedSport === null) {
            // Sport selection grid
            return `
                <section class="section" style="margin-top: 24px;">
                    <h3 style="margin: 0 0 20px;">
                        <span>${STATE.currentNavGroup}</span>
                    </h3>
                    <div class="cards" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                        ${sports.map(sport => `
                            <div class="card" style="cursor: pointer; transition: all 0.3s ease; text-align: center; padding: 20px;" onclick="window.selectSport('${sport.id}')">
                                <div style="font-size: 3rem; margin-bottom: 12px;">${sport.icon}</div>
                                <div style="font-weight: 700; font-size: 1.1rem;">${sport.name}</div>
                                <div style="color: var(--muted); font-size: 0.9rem; margin-top: 8px;">Click to explore</div>
                            </div>
                        `).join('')}
                    </div>
                </section>
            `;
        } else {
            // Show VIP dashboard (existing functionality) for selected sport
            return `
                <div style="margin-top: 24px;">
                    <div style="margin-bottom: 16px;">
                        <button onclick="window.deselectSport()" style="border: 1px solid rgba(148, 163, 184, 0.35); background: rgba(15, 23, 42, 0.78); color: var(--text); border-radius: 10px; padding: 10px 12px; font-size: 0.92rem; cursor: pointer; font-weight: 700;">← Back to ${STATE.currentNavGroup}</button>
                    </div>
                    ${renderVIPDashboard()}
                </div>
            `;
        }
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

    // COMPONENT: AccaEngine
    function AccaEngine() {
        const radius = 150;
        const speed = (60 - STATE.animationSpeed) / 10; // Inverse: higher speed value = faster rotation
        const dotsCount = 12;

        return `
            <section class="section" style="margin-top: 24px; text-align: center;">
                <h3>🎯 ACCA Engine</h3>
                <p class="meta">Multi-leg combination builder with circular layout.</p>
                <div style="display: flex; justify-content: center; align-items: center; padding: 40px 20px;">
                    <svg width="400" height="400" viewBox="0 0 400 400" style="filter: drop-shadow(0 0 20px rgba(59, 130, 246, 0.2));">
                        <defs>
                            <style>
                                @keyframes spinDots {
                                    from { transform: rotate(0deg); }
                                    to { transform: rotate(360deg); }
                                }
                                .rotating-group {
                                    transform-origin: 200px 200px;
                                    animation: spinDots ${speed}s linear infinite;
                                }
                            </style>
                        </defs>
                        <circle cx="200" cy="200" r="100" fill="none" stroke="rgba(59, 130, 246, 0.2)" stroke-width="2"/>
                        <circle cx="200" cy="200" r="150" fill="none" stroke="rgba(59, 130, 246, 0.1)" stroke-width="1" stroke-dasharray="5,5"/>
                        <g class="rotating-group">
                            ${Array.from({ length: dotsCount }).map((_, i) => {
                                const angle = (i / dotsCount) * Math.PI * 2;
                                const x = 200 + radius * Math.cos(angle);
                                const y = 200 + radius * Math.sin(angle);
                                const color = i % 2 === 0 ? '#3b82f6' : '#f59e0b';
                                return `
                                    <circle cx="${x}" cy="${y}" r="8" fill="${color}" opacity="0.7"/>
                                    <text x="${x}" y="${y + 25}" text-anchor="middle" fill="var(--muted)" font-size="12" font-weight="700">Leg ${i + 1}</text>
                                `;
                            }).join('')}
                        </g>
                        <circle cx="200" cy="200" r="20" fill="#10b981" opacity="0.8"/>
                        <text x="200" y="207" text-anchor="middle" fill="white" font-size="14" font-weight="700">ACCA</text>
                    </svg>
                </div>
                <div style="margin-top: 24px; color: var(--muted);">
                    <p>Animation Speed: ${STATE.animationSpeed}ms | Rotation: ${speed.toFixed(1)}s/cycle</p>
                    <p style="font-size: 0.9rem;">Combine up to 12 legs in parallel streams for enhanced odds.</p>
                </div>
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
        // For now, keep the VIP dashboard as primary view when viewing PORTAL with sport selected
        // The components above provide the framework for future expansion
        if (STATE.viewState === 'PORTAL' && STATE.selectedSport === null) {
            // Show sport selection instead
            statsGrid.parentElement.style.display = 'none';
            coverageTableWrap.parentElement.style.display = 'none';
            sectionsWrap.innerHTML = SportCategoryPortal();
        } else {
            // Show VIP dashboard
            statsGrid.parentElement.style.display = 'grid';
            coverageTableWrap.parentElement.style.display = 'block';
            sectionsWrap.parentElement.style.display = 'block';
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
        updateState({ viewState: 'PORTAL' });
    };

    // Wire up controls
    document.addEventListener('DOMContentLoaded', function() {
        // Navigation group selector
        setTimeout(() => {
            const navSelect = document.getElementById('navGroupSelect');
            if (navSelect) {
                navSelect.addEventListener('change', (e) => {
                    updateState({ currentNavGroup: e.target.value });
                });
            }

            // Animation speed slider
            const animSpeedInput = document.getElementById('animSpeed');
            if (animSpeedInput) {
                animSpeedInput.addEventListener('input', (e) => {
                    const speed = parseInt(e.target.value);
                    updateState({ animationSpeed: speed });
                    const speedValue = document.getElementById('speedValue');
                    if (speedValue) speedValue.textContent = speed + 'ms';
                });
            }
        }, 100);
    });

    refreshBtn.addEventListener('click', refresh);
    daySelect.addEventListener('change', refresh);
    downloadBtn.addEventListener('click', downloadPayload);
    refresh();
})();
