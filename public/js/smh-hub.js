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
     * (defined in vip-stress-dashboard.js) can access the prediction data.
     */
    function registerSmhCard(cardId, prediction) {
        // Ensure the global registry exists (used by vip-stress-dashboard.js)
        if (!window.CARD_REGISTRY) {
            window.CARD_REGISTRY = new Map();
        }
        window.CARD_REGISTRY.set(cardId, prediction);
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
        // We avoid clearing window.CARD_REGISTRY entirely to not break the main dashboard
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

// Bulletproof Global Click Listener for Insight Buttons
document.body.addEventListener('click', function(e) {
    const btn = e.target.closest('.insight-btn');
    if (!btn) return; // If they didn't click the button, ignore it.

    e.preventDefault(); // Stop any default button behavior
    
    const cardId = btn.getAttribute('data-card-id');
    console.log("[Trigger] Insight button clicked! Extracted ID:", cardId);

    // Ensure the function exists before calling it
    if (typeof window.openMatchDetail === 'function') {
        window.openMatchDetail(cardId);
    } else {
        console.error("[Fatal Error] window.openMatchDetail is not defined in the global scope!");
        alert("System Error: Modal function is not accessible.");
    }
});
