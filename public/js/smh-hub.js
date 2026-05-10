/**
 * smh-hub.js — Sports Market Hub event wiring (CSP-compliant)
 *
 * All interactions are registered via addEventListener.
 * No inline event handlers (onchange, onclick, onmouseover) anywhere.
 *
 * Select IDs → category label mapping:
 *   global-majors-select   → 'Global Majors'
 *   premium-markets-select → 'Premium Markets'
 *   niche-markets-select   → 'Niche Markets'
 *   acca-select            → 'ACCAs'
 */

(function () {
    'use strict';

    // ── Constants ──────────────────────────────────────────────────────────────
    const BACKEND_URL = window.API_BASE_URL || 'https://skcs-sports-edge-skcsai.onrender.com';
    const API_KEY     = window.USER_API_KEY || 'skcs_user_12345';

    const SELECT_MAP = [
        { id: 'global-majors-select',   category: 'Global Majors'   },
        { id: 'premium-markets-select', category: 'Premium Markets' },
        { id: 'niche-markets-select',   category: 'Niche Markets'   },
        { id: 'acca-select',            category: 'ACCAs'           }
    ];

    const SECTION_LABELS = {
        direct:              'Direct Pick',
        secondary:           'Analytical',
        multi:               'Multi',
        same_match:          'Same Match',
        acca_6match:         'ACCA 6',
        mega_acca_12:        'MEGA ACCA'
    };
    const SECTION_COLORS = {
        direct:              '#38bdf8',
        secondary:           '#a78bfa',
        multi:               '#fb923c',
        same_match:          '#34d399',
        acca_6match:         '#f59e0b',
        mega_acca_12:        '#ef4444'
    };

    // ── DOM helpers ────────────────────────────────────────────────────────────
    function el(id) { return document.getElementById(id); }

    // ── Card registry for click handlers ──────────────────────────────────────
    /**
     * Registers a card in the global registry so the Match Detail modal
     * can access the prediction data.
     */
    function registerSmhCard(cardId, prediction) {
        // Ensure the global registry exists
        if (!window.SMH_CARD_REGISTRY) {
            window.SMH_CARD_REGISTRY = new Map();
        }
        window.SMH_CARD_REGISTRY.set(cardId, prediction);
    }

    // ── Core: handle a sport selection ────────────────────────────────────────
    async function handleSelectChange(selectElement, category) {
        const sport = selectElement.value;
        if (!sport) return;

        const displayTitle = el('displayTitle');
        const codesList    = el('codesList');
        const displayIcon  = el('displayIcon');
        const resultsPanel = el('resultsPanel');

        // Reset all other selects (mutual exclusion)
        document.querySelectorAll('.market-select').forEach(function (s) {
            if (s !== selectElement) s.selectedIndex = 0;
        });

        // Show loading state
        if (displayIcon)  displayIcon.style.display = 'none';
        if (resultsPanel) resultsPanel.style.justifyContent = 'center';
        if (displayTitle) {
            displayTitle.textContent  = 'Connecting to SKCS Engine\u2026';
            displayTitle.style.color    = '#94a3b8';
            displayTitle.style.fontSize = '0.9rem';
        }
        if (codesList) {
            codesList.innerHTML =
                '<div class="loading-spinner"></div>' +
                '<p style="color:#3b82f6;font-size:1rem;font-weight:600;margin-top:10px;">' +
                    'Fetching data for ' + sport + '\u2026' +
                '</p>';
        }

        // Normalize sport to Title Case
        const normalizedSport = sport.charAt(0).toUpperCase() + sport.slice(1);

        try {
            const url = BACKEND_URL + '/api/vip/stress-payload' +
                        '?sport=' + encodeURIComponent(normalizedSport) +
                        '&include_all=true';

            const response = await fetch(url, {
                headers: { 'x-api-key': API_KEY }
            });

            if (!response.ok) throw new Error('Fetch failed: ' + response.status);

            const data = await response.json();
            renderResultsInPanel(data, normalizedSport, category);

            // Bridge to existing showSportInsights if present
            if (typeof window.showSportInsights === 'function') {
                window.showSportInsights(normalizedSport);
            }
        } catch (err) {
            console.error('[SMH] Error fetching sport data:', err);

            if (displayTitle) displayTitle.textContent = 'Connection Error';
            if (codesList) {
                codesList.innerHTML =
                    '<p style="color:#ef4444;font-size:1rem;font-weight:600;">' +
                        'Could not retrieve ' + sport + ' data.' +
                    '</p>' +
                    '<button data-action="smh-retry" ' +
                            'style="margin-top:15px;padding:8px 16px;background:#3b82f6;' +
                                   'color:white;border:none;border-radius:6px;cursor:pointer;">' +
                        'Retry' +
                    '</button>';
            }
        }
    }

    // ── Render: populate the results panel ────────────────────────────────────
    function renderResultsInPanel(data, sport, category) {
        const codesList    = el('codesList');
        const displayTitle = el('displayTitle');
        const resultsPanel = el('resultsPanel');

        // Aggregate all prediction buckets
        var cats = (data.payload && data.payload.categories) ? data.payload.categories : {};
        var allPredictions = [].concat(
            cats.direct              || [],
            cats.analytical_insights || [],
            cats.multi               || [],
            cats.same_match          || [],
            cats.acca_6match         || [],
            cats.mega_acca_12        || []
        );

        console.log('[SMH] ' + sport + ' payload — source_rows=' + (data.source_rows || 0) + ', buckets:', {
            direct:              (cats.direct              || []).length,
            analytical_insights: (cats.analytical_insights || []).length,
            multi:               (cats.multi               || []).length,
            same_match:          (cats.same_match          || []).length,
            acca_6match:         (cats.acca_6match         || []).length,
            mega_acca_12:        (cats.mega_acca_12        || []).length
        });

        // ── Empty state ──────────────────────────────────────────────────────
        if (allPredictions.length === 0) {
            if (resultsPanel) resultsPanel.style.justifyContent = 'center';
            if (displayTitle) displayTitle.textContent = sport + ' \u2014 No Predictions Available';

            var sourceRows = data.source_rows || 0;
            var emptyMsg = sourceRows > 0
                ? 'The database has ' + sourceRows + ' raw row(s) but none passed the category filter. Check confidence thresholds or trigger a new AI pipeline run.'
                : 'No records in the database for this sport. A sync may be needed \u2014 wait for the scheduled refresh or contact your admin.';

            if (codesList) {
                codesList.innerHTML =
                    '<div style="text-align:center;padding:20px;">' +
                        '<div style="font-size:2.5rem;margin-bottom:12px;">\uD83D\uDCED</div>' +
                        '<p style="color:#94a3b8;font-size:1rem;margin-bottom:8px;">' +
                            'No published predictions found for ' +
                            '<strong style="color:#38bdf8;">' + sport + '</strong>.' +
                        '</p>' +
                        '<p style="color:#64748b;font-size:0.85rem;">' + emptyMsg + '</p>' +
                    '</div>';
            }
            return;
        }

        // ── Populated state ──────────────────────────────────────────────────
        if (resultsPanel) resultsPanel.style.justifyContent = 'flex-start';
        if (displayTitle) {
            displayTitle.textContent  = sport + ' \u00b7 ' + allPredictions.length + ' Insight' + (allPredictions.length !== 1 ? 's' : '');
            displayTitle.style.fontSize   = '1rem';
            displayTitle.style.color      = '#94a3b8';
            displayTitle.style.marginBottom = '16px';
        }

        // Clear previous SMH entries if needed, or rely on unique IDs.
        // We avoid clearing window.SMH_CARD_REGISTRY entirely to not break the main dashboard
        // but we ensure these specific sport insights are available.

        var html = '<div class="results-scroll-container" style="width:100%;max-height:420px;overflow-y:auto;padding-right:8px;">';

        allPredictions.forEach(function (pred) {
            var sectionType  = pred.section_type || 'direct';
            var accentColor  = SECTION_COLORS[sectionType] || '#38bdf8';
            var sectionLabel = SECTION_LABELS[sectionType] || sectionType.replace(/_/g, ' ').toUpperCase();
            var legCount     = Array.isArray(pred.matches) ? pred.matches.length : 1;
            var isAcca       = legCount > 1;

            var match = (pred.matches && pred.matches[0]) ? pred.matches[0] : {};
            var meta  = (match.metadata && typeof match.metadata === 'object') ? match.metadata : {};

            var home = match.home_team || meta.home_team || '\u2014';
            var away = match.away_team || meta.away_team || '\u2014';

            var pickRaw = match.prediction
                || (pred.final_recommendation && pred.final_recommendation.market)
                || meta.prediction
                || match.recommendation
                || 'N/A';
            var pick = String(pickRaw).replace(/_/g, ' ').toUpperCase();

            var confidence = Math.round(Number(pred.total_confidence || match.confidence || 0));
            var market     = String(match.market || meta.market || '1X2').toUpperCase();

            // Kickoff time
            var kickoffRaw = match.commence_time || match.match_date
                || meta.match_time || meta.kickoff || meta.kickoff_time
                || pred.created_at;
            var kickoffStr = '';
            if (kickoffRaw) {
                try {
                    var d = new Date(kickoffRaw);
                    if (!isNaN(d.getTime())) {
                        kickoffStr = d.toLocaleString('en-GB', {
                            weekday: 'short', day: '2-digit', month: 'short',
                            hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
                        }) + ' UTC';
                    }
                } catch (e) { /* ignore */ }
            }

            // Odds
            var oddsVal = (meta.odds && meta.odds.home)
                || (meta.sharp_odds && meta.sharp_odds.home_win)
                || match.odds || null;
            var oddsHtml = oddsVal
                ? '<span style="color:#facc15;font-weight:700;margin-left:8px;">@ ' + Number(oddsVal).toFixed(2) + '</span>'
                : '';

            var confColor = confidence >= 80 ? '#4ade80' : confidence >= 65 ? '#facc15' : '#fb923c';
            var timeHtml  = kickoffStr
                ? '<span style="color:#475569;font-size:0.78rem;margin-left:auto;">\uD83D\uDD50 ' + kickoffStr + '</span>'
                : '';

            // Generate unique card ID for this prediction
            var cardId = 'smh_card_' + (pred.id || pred.prediction_id || Math.random().toString(36).substr(2, 9));
            registerSmhCard(cardId, pred); // Register prediction for click handling

            // Use .smh-result-item class for hover (CSP-safe, no inline onmouseover)
            html +=
                '<div class="smh-result-item" data-card-id="' + cardId + '" style="border-left:4px solid ' + accentColor + ';">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;flex-wrap:wrap;">' +
                        '<div style="display:flex;align-items:center;gap:6px;">' +
                            '<span style="font-size:0.7rem;color:' + accentColor + ';font-weight:800;text-transform:uppercase;letter-spacing:0.8px;background:rgba(255,255,255,0.06);padding:2px 7px;border-radius:4px;">' +
                                sectionLabel + (isAcca ? ' \u00b7 ' + legCount + ' legs' : '') +
                            '</span>' +
                            '<span style="font-size:0.7rem;color:#64748b;font-weight:600;text-transform:uppercase;">' + market + '</span>' +
                        '</div>' +
                        '<span style="font-size:0.8rem;color:' + confColor + ';font-weight:800;">' + confidence + '% CONF.</span>' +
                    '</div>' +
                    '<div style="font-size:1.05rem;font-weight:700;color:#f1f5f9;margin-bottom:5px;line-height:1.3;">' +
                        home + ' <span style="color:#475569;font-weight:400;font-size:0.9rem;">vs</span> ' + away +
                        (isAcca ? '<span style="font-size:0.75rem;color:#64748b;font-weight:400;"> +' + (legCount - 1) + ' more</span>' : '') +
                    '</div>' +
                    '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:10px;">' +
                        '<span style="background:rgba(74,222,128,0.12);color:#4ade80;padding:3px 9px;border-radius:4px;font-size:0.88rem;font-weight:700;">\u26A1 ' + pick + '</span>' +
                        oddsHtml + timeHtml +
                    '</div>' +
                    '<button class="insight-btn" data-card-id="' + cardId + '" style="width:100%;padding:10px 16px;background:linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);color:#ffffff;border:none;border-radius:8px;font-size:0.85rem;font-weight:700;letter-spacing:0.5px;cursor:pointer;text-transform:uppercase;box-shadow:0 4px 12px rgba(139,92,246,0.3);transition:all 0.2s ease;margin-top:8px;">Click for insights</button>' +
                '</div>';
        });

        html += '</div>';
        if (codesList) {
            codesList.innerHTML    = html;
            codesList.style.fontSize   = '1rem';
            codesList.style.fontWeight = '400';
            codesList.style.width      = '100%';
        }
    }

    // ── Wire everything on DOM ready ──────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {

        // Attach change listeners to all four market selects
        SELECT_MAP.forEach(function (entry) {
            var select = el(entry.id);
            if (!select) return;
            select.addEventListener('change', function () {
                handleSelectChange(select, entry.category);
            });
        });

        // Delegated click for the dynamically injected Retry button
        // (avoids the need for an onclick attribute on the button)
        var codesList = el('codesList');
        if (codesList) {
            codesList.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-action="smh-retry"]');
                if (btn) location.reload();
            });
        }

        // Bulletproof document-level delegation for "Click for insights" button
        // Attached to document.body to survive DOM updates (codesList gets overwritten)
        document.body.addEventListener('click', function (e) {
            var insightBtn = e.target.closest('.insight-btn');
            if (insightBtn) {
                var cardId = insightBtn.getAttribute('data-card-id');
                console.log("[Trigger] Button clicked! Match ID:", cardId);

                if (typeof window.openMatchDetail === 'function') {
                    window.openMatchDetail(cardId);
                } else {
                    console.error("[Error] openMatchDetail function is missing or not in scope!");
                }
            }
        });
    });

})();

// ============================================
// GLOBAL MATCH DETAIL MODAL FUNCTIONS
// Defined at top level for global scope access
// ============================================

// Data source for the pipeline UI
const SKCS_PIPELINE_DATA = [
    {
        title: "📥 API Data Collection",
        purpose: "Collect raw facts. No intelligence yet.",
        json: `{\n  "homeTeam": "Arsenal",\n  "awayTeam": "Chelsea",\n  "odds": { "home": 1.85, "draw": 3.4, "away": 4.2 },\n  "weather": "Rain",\n  "injuries": ["Player A", "Player B"]\n}` 
    },
    {
        title: "🔄 Data Normalization",
        purpose: "Convert all APIs to uniform SKCS format. Clean, consistent fuel.",
        json: `{\n  "match_id": "EPL_ARS_CHE_2026_02_10",\n  "teams": { "home": "Arsenal", "away": "Chelsea" },\n  "markets": { "1x2": { "home": 1.85, "draw": 3.4, "away": 4.2 } },\n  "context": { "weather": "Rain", "injuries": 2 }\n}` 
    },
    {
        title: "🤖 AI Stage 1: Initial Prediction",
        purpose: "Baseline probability analysis. 'On paper, who should win?'",
        json: `{\n  "stage_1": {\n    "1x2": { "home": 54, "draw": 26, "away": 20 },\n    "confidence": "medium"\n  }\n}` 
    },
    {
        title: "🧠 AI Stage 2: Deep Context",
        purpose: "Team & Player Intelligence. Adjustments for injuries, fatigue, etc.",
        json: `{\n  "stage_2": {\n    "adjustments": { "home": -6, "draw": +3, "away": +3 },\n    "confidence": "medium-low"\n  }\n}` 
    },
    {
        title: "⚠️ AI Stage 3: Reality Check",
        purpose: "External Factor Analysis. Volatility scoring based on news/weather.",
        json: `{\n  "stage_3": {\n    "volatility": "high",\n    "risk_flags": ["weather", "team unrest"]\n  }\n}` 
    },
    {
        title: "🎯 AI Stage 4: Decision Engine",
        purpose: "Final SKCS Insights. Combine all stages for market recommendations.",
        json: `{\n  "final_prediction": {\n    "recommended": ["Home Win", "Over 1.5"],\n    "avoid": ["BTTS"],\n    "acca_safe": false,\n    "confidence": 72\n  }\n}` 
    }
];

window.openMatchDetail = function(cardId) {
    const prediction = window.SMH_CARD_REGISTRY.get(cardId);
    if (!prediction) {
        console.error('[SMH] No prediction found for card ID:', cardId);
        return;
    }

    const leg = Array.isArray(prediction.matches) && prediction.matches[0] ? prediction.matches[0] : {};
    const home = leg.home_team || (leg.metadata && leg.metadata.home_team) || 'Home';
    const away = leg.away_team || (leg.metadata && leg.metadata.away_team) || 'Away';
    const sectionType = String(prediction.section_type || prediction.type || 'direct');
    const confidence = Math.round(Number(prediction.total_confidence || 0));
    const league = leg.metadata && leg.metadata.league ? leg.metadata.league : (leg.sport || sectionType);

    // Kickoff time
    const kickoffRaw = leg.commence_time || leg.match_date
        || (leg.metadata && (leg.metadata.match_time || leg.metadata.kickoff || leg.metadata.kickoff_time))
        || prediction.created_at;
    let kickoffStr = 'TBC';
    if (kickoffRaw) {
        try {
            const d = new Date(kickoffRaw);
            if (!isNaN(d.getTime())) kickoffStr = d.toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
        } catch (e) {}
    }

    // Build markets list from all legs
    const legs = Array.isArray(prediction.matches) ? prediction.matches : [leg];
    const CONF_COLORS = ['#ef4444','#f97316','#facc15','#84cc16','#22c55e','#4ade80'];
    function confColor(c) { const idx = Math.min(5, Math.floor(c / 17)); return CONF_COLORS[idx]; }

    const marketsHtml = legs.map(function(m, i) {
        const mHome = m.home_team || (m.metadata && m.metadata.home_team) || home;
        const mAway = m.away_team || (m.metadata && m.metadata.away_team) || away;
        const mMarket = String(m.market || (m.metadata && m.metadata.market) || '1X2').toUpperCase();
        const mPick = String(m.prediction || m.recommendation || (m.metadata && m.metadata.prediction) || 'N/A').replace(/_/g,' ').toUpperCase();
        const mConf = Math.round(Number(m.confidence || 0));
        const color = confColor(mConf);
        const pct = Math.min(100, mConf);
        // Secondary markets if available
        const secMarkets = Array.isArray(m.secondary_markets) ? m.secondary_markets : [];
        const secHtml = secMarkets.map(function(sm) {
            const smConf = Math.round(Number(sm.confidence || 0));
            return '<div style="margin-top:8px;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.06);">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                    '<span style="font-size:0.78rem;color:#94a3b8;font-weight:600;">' + String(sm.market || 'Secondary').toUpperCase() + '</span>' +
                    '<span style="font-size:0.78rem;color:' + confColor(smConf) + ';font-weight:700;">' + smConf + '%</span>' +
                '</div>' +
                '<div style="font-size:0.82rem;color:#e2e8f0;margin-top:4px;">' + String(sm.prediction || sm.pick || 'N/A').replace(/_/g,' ').toUpperCase() + '</div>' +
            '</div>';
        }).join('');
        return '<div style="background:rgba(15,23,42,0.7);border-radius:12px;padding:16px;border:1px solid rgba(255,255,255,0.07);">' +
            (legs.length > 1 ? '<div style="font-size:0.72rem;color:#64748b;font-weight:700;margin-bottom:6px;">LEG ' + (i+1) + '</div>' : '') +
            '<div style="font-size:0.95rem;font-weight:700;color:#f1f5f9;margin-bottom:10px;">' + mHome + ' <span style="color:#475569;font-weight:400;">vs</span> ' + mAway + '</div>' +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
                '<span style="font-size:0.75rem;color:#94a3b8;font-weight:700;text-transform:uppercase;min-width:90px;">' + mMarket + '</span>' +
                '<div style="flex:1;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">' +
                    '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:3px;transition:width 0.6s ease;"></div>' +
                '</div>' +
                '<span style="font-size:0.8rem;color:' + color + ';font-weight:800;min-width:36px;text-align:right;">' + mConf + '%</span>' +
            '</div>' +
            '<div style="display:inline-block;background:rgba(74,222,128,0.1);color:#4ade80;padding:4px 10px;border-radius:5px;font-size:0.85rem;font-weight:700;">⚡ ' + mPick + '</div>' +
            secHtml +
        '</div>';
    }).join('');

    // Insights chips
    const insights = prediction.insights || {};
    const chips = [
        insights.weather ? '<span style="font-size:0.78rem;background:rgba(96,165,250,0.1);color:#60a5fa;padding:4px 10px;border-radius:20px;">🌤 ' + insights.weather + '</span>' : '',
        insights.availability ? '<span style="font-size:0.78rem;background:rgba(74,222,128,0.1);color:#4ade80;padding:4px 10px;border-radius:20px;">👥 ' + insights.availability + '</span>' : '',
        insights.stability ? '<span style="font-size:0.78rem;background:rgba(251,191,36,0.1);color:#fbbf24;padding:4px 10px;border-radius:20px;">📊 ' + insights.stability + '</span>' : ''
    ].filter(Boolean).join(' ');

    // Create modal if it doesn't exist
    let modal = document.getElementById('skcsMatchDetailModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'skcsMatchDetailModal';
        modal.className = 'modal-backdrop';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:none;justify-content:center;align-items:center;z-index:10000;padding:20px;';
        modal.innerHTML =
            '<div style="background:#1c1f26;border-radius:16px;padding:24px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto;border:1px solid rgba(255,255,255,0.1);box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
                    '<button class="close-match-modal-btn" style="background:transparent;border:none;color:#3b82f6;font-size:0.95rem;font-weight:600;cursor:pointer;padding:0;display:flex;align-items:center;gap:4px;transition:color 0.2s;">← Back to Fixtures</button>' +
                    '<button class="close-match-modal-btn" style="background:none;border:none;color:#94a3b8;font-size:1.5rem;cursor:pointer;padding:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:6px;transition:background 0.2s;">&times;</button>' +
                '</div>' +
                '<div id="skcsModalBody"></div>' +
            '</div>';
        document.body.appendChild(modal);
    }

    const body = document.getElementById('skcsModalBody');
    if (body) {
        body.innerHTML =
            '<div style="margin-bottom:20px;">' +
                '<div style="font-size:1.4rem;font-weight:800;color:#f1f5f9;margin-bottom:4px;">' + home + ' <span style="color:#475569;">vs</span> ' + away + '</div>' +
                '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:6px;">' +
                    '<span style="font-size:0.8rem;color:#94a3b8;">🕐 ' + kickoffStr + '</span>' +
                    (league ? '<span style="font-size:0.8rem;color:#94a3b8;">🏆 ' + league + '</span>' : '') +
                    '<span style="font-size:0.8rem;font-weight:700;color:' + confColor(confidence) + ';">⚡ ' + confidence + '% overall confidence</span>' +
                '</div>' +
                (chips ? '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">' + chips + '</div>' : '') +
            '</div>' +
            '<div style="font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:12px;">Market Breakdown</div>' +
            '<div class="market-1x2-breakdown" style="display: flex; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 15px;">' +
                '<div style="text-align: center;"><span style="color: #94a3b8; font-size: 12px; display: block;">HT</span><strong style="color: #fff; font-size: 16px;">45%</strong></div>' +
                '<div style="text-align: center;"><span style="color: #94a3b8; font-size: 12px; display: block;">D</span><strong style="color: #fff; font-size: 16px;">35%</strong></div>' +
                '<div style="text-align: center;"><span style="color: #94a3b8; font-size: 12px; display: block;">AT</span><strong style="color: #fff; font-size: 16px;">20%</strong></div>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:10px;">' + marketsHtml + '</div>' +
            '<div class="pipeline-container" style="padding:16px;margin-top:24px;border-top:1px solid rgba(71,85,105,0.5);padding-top:24px;">' +
                '<div style="font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:24px;">Decision Engine Pipeline (Pro View)</div>' +
                '<div class="relative" style="border-left:2px solid #334155;margin-left:16px;space-y:24px;" id="ai-pipeline-accordion">' +
                    '<div class="relative pl-6 pipeline-stage" data-stage="1">' +
                        '<div class="absolute" style="left:-34px;top:4px;width:32px;height:32px;border-radius:50%;background:#2563eb;border:4px solid #0f172a;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;color:#ffffff;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);node-circle">1</div>' +
                        '<div class="cursor-pointer" style="background:rgba(30,41,59,0.5);border:1px solid #334155;border-radius:6px;padding:12px;display:flex;justify-content:space-between;align-items:center;pipeline-toggle">' +
                            '<span class="font-semibold" style="color:#60a5fa;display:flex;align-items:center;gap:8px;">🤖 AI Stage 1: Initial Prediction</span>' +
                            '<span class="text-xs transform transition-transform chevron" style="color:#64748b;">▼</span>' +
                        '</div>' +
                        '<div class="pipeline-content block" style="background:#0f172a;border-left:1px solid #334155;border-right:1px solid #334155;border-bottom:1px solid #334155;border-radius:0 0 6px 6px;padding:16px;">' +
                            '<p class="text-xs" style="color:#94a3b8;margin-bottom:8px;"><strong>Purpose:</strong> Baseline probability analysis</p>' +
                            '<pre class="p-3 rounded text-[10px] font-mono overflow-x-auto border border-slate-800" style="background:#020617;color:#34d399;">{ "stage_1": { "1x2": { "home": 54, "draw": 26, "away": 20 }, "confidence": "medium" } }</pre>' +
                        '</div>' +
                    '</div>' +
                    '<div class="relative pl-6 pipeline-stage" data-stage="2" style="margin-top:24px;">' +
                        '<div class="absolute" style="left:-34px;top:4px;width:32px;height:32px;border-radius:50%;background:#334155;border:4px solid #0f172a;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;color:#cbd5e1;node-circle">2</div>' +
                        '<div class="cursor-pointer" style="background:rgba(30,41,59,0.5);border:1px solid #334155;border-radius:6px;padding:12px;display:flex;justify-content:space-between;align-items:center;pipeline-toggle">' +
                            '<span class="font-semibold" style="color:#cbd5e1;display:flex;align-items:center;gap:8px;">🧠 AI Stage 2: Deep Context</span>' +
                            '<span class="text-xs transform transition-transform chevron -rotate-90" style="color:#64748b;">▼</span>' +
                        '</div>' +
                        '<div class="pipeline-content hidden" style="background:#0f172a;border-left:1px solid #334155;border-right:1px solid #334155;border-bottom:1px solid #334155;border-radius:0 0 6px 6px;padding:16px;">' +
                            '<p class="text-xs" style="color:#94a3b8;margin-bottom:8px;"><strong>Purpose:</strong> Team & Player Intelligence</p>' +
                            '<pre class="p-3 rounded text-[10px] font-mono overflow-x-auto border border-slate-800" style="background:#020617;color:#34d399;">{ "stage_2": { "adjustments": { "home": -6, "draw": +3, "away": +3 }, "confidence": "medium-low" } }</pre>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.closeMatchDetail = function() {
    const modal = document.getElementById('skcsMatchDetailModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
};

// Global event listener for closing modal via delegation (CSP-safe)
document.body.addEventListener('click', function(e) {
    // Check if they clicked the back arrow, the 'x', or the dark backdrop overlay
    if (e.target.closest('.close-match-modal-btn') || e.target.matches('.modal-backdrop')) {
        if (typeof window.closeMatchDetail === 'function') {
            window.closeMatchDetail();
        }
        return;
    }

    // AI Pipeline Accordion Logic
    const toggleBtn = e.target.closest('.pipeline-toggle');
    if (toggleBtn) {
        const currentStage = toggleBtn.closest('.pipeline-stage');
        const allStages = document.querySelectorAll('.pipeline-stage');

        allStages.forEach(function(stage) {
            const content = stage.querySelector('.pipeline-content');
            const chevron = stage.querySelector('.chevron');
            const node = stage.querySelector('.node-circle');
            const btn = stage.querySelector('.pipeline-toggle');

            if (stage === currentStage) {
                // Toggle clicked stage
                var isHidden = content.classList.contains('hidden');
                if (isHidden) {
                    content.classList.remove('hidden');
                    content.classList.add('block');
                    btn.style.borderRadius = '6px 6px 0 0';
                    chevron.classList.remove('-rotate-90');
                    node.style.background = '#2563eb';
                    node.style.color = '#ffffff';
                    btn.querySelector('span:first-child').style.color = '#60a5fa';
                } else {
                    content.classList.add('hidden');
                    content.classList.remove('block');
                    btn.style.borderRadius = '6px';
                    chevron.classList.add('-rotate-90');
                    node.style.background = '#334155';
                    node.style.color = '#cbd5e1';
                    btn.querySelector('span:first-child').style.color = '#cbd5e1';
                }
            } else {
                // Force close all other stages
                content.classList.add('hidden');
                content.classList.remove('block');
                btn.style.borderRadius = '6px';
                chevron.classList.add('-rotate-90');
                node.style.background = '#334155';
                node.style.color = '#cbd5e1';
                btn.querySelector('span:first-child').style.color = '#cbd5e1';
            }
        });
    }

    // Global Event Delegation for Pipeline Stepper
    const stepBtn = e.target.closest('.pipeline-step-btn');
    if (stepBtn) {
        const index = parseInt(stepBtn.getAttribute('data-index'));
        const data = SKCS_PIPELINE_DATA[index];
        
        if (!data) return;

        // Update Terminal Content
        var terminalTitle = document.getElementById('terminal-title');
        var terminalPurpose = document.getElementById('terminal-purpose');
        var terminalJson = document.getElementById('terminal-json');
        var terminalBadge = document.getElementById('terminal-stage-badge');
        
        if (terminalTitle) terminalTitle.innerHTML = data.title;
        if (terminalPurpose) terminalPurpose.innerText = 'Purpose: ' + data.purpose;
        if (terminalJson) terminalJson.textContent = data.json;
        if (terminalBadge) terminalBadge.innerText = 'STAGE ' + (index + 1) + '/6';

        // Update UI States for all buttons
        document.querySelectorAll('.pipeline-step-btn').forEach(function(btn, i) {
            var circle = btn.querySelector('.step-circle');
            var label = btn.querySelector('.step-label');
            
            if (i === index) {
                // Active State
                circle.className = "w-10 h-10 rounded-full bg-blue-600 border-4 border-slate-900 flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(37,99,235,0.6)] transition-all step-circle";
                label.className = "absolute top-12 whitespace-nowrap text-xs font-semibold text-blue-400 step-label";
            } else if (i < index) {
                // Completed State
                circle.className = "w-10 h-10 rounded-full bg-blue-900/50 border-4 border-slate-900 flex items-center justify-center text-blue-400 transition-all step-circle";
                label.className = "absolute top-12 whitespace-nowrap text-xs font-semibold text-slate-400 step-label";
            } else {
                // Future State
                circle.className = "w-10 h-10 rounded-full bg-slate-800 border-4 border-slate-900 flex items-center justify-center text-slate-400 transition-all step-circle hover:bg-slate-700";
                label.className = "absolute top-12 whitespace-nowrap text-xs font-semibold text-slate-500 step-label";
            }
        });
    }
});
