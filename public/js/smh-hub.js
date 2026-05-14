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

// Backend URL for API calls (defined outside IIFE for global helper function access)
const BACKEND_URL = "https://skcs-sports-edge-skcsai.onrender.com";
const API_KEY = window.USER_API_KEY || 'skcs_user_12345';

(function () {
    'use strict';

    // ── Constants ──────────────────────────────────────────────────────────────
    // BACKEND_URL and API_KEY are defined globally at the top of this file

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
        if (displayIcon)  displayIcon.style.display = 'None';
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
                                   'color:white;border:None;border-radius:6px;cursor:pointer;">' +
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

        // FILTER: Only show predictions matching the current sport
        var sportLower = sport.toLowerCase().trim();

        // Safe stringified log before filter runs
        if (allPredictions.length > 0) {
            // console.log removed
        }

        // Helper: Safely extract sport string from potentially nested object or string
        function extractSportString(sportValue, predictionObj) {
            if (typeof sportValue === 'string') {
                return sportValue.toLowerCase().trim();
            } else if (typeof sportValue === 'object' && sportValue !== None) {
                // Handle TheSportsDB format: { strSport: "Soccer" }
                if (sportValue.strSport) {
                    return String(sportValue.strSport).toLowerCase().trim();
                }
                // Handle other object formats with sport property
                if (sportValue.sport) {
                    return extractSportString(sportValue.sport, predictionObj);
                }
                // Fallback: stringify and try to extract
                return String(JSON.stringify(sportValue)).toLowerCase().trim();
            }

            // If no direct sport value found, try to infer from nested metadata
            if (predictionObj && predictionObj.matches && predictionObj.matches.length > 0) {
                var match = predictionObj.matches[0];
                var meta = match.metadata || {};

                // Check metadata.provider for sport clues (e.g., "football-data-org" -> Soccer)
                if (meta.provider) {
                    var providerLower = String(meta.provider).toLowerCase();
                    if (providerLower.includes('football')) {
                        return 'soccer';
                    } else if (providerLower.includes('baseball')) {
                        return 'baseball';
                    } else if (providerLower.includes('tennis')) {
                        return 'tennis';
                    } else if (providerLower.includes('cricket')) {
                        return 'cricket';
                    } else if (providerLower.includes('basketball')) {
                        return 'basketball';
                    }
                }

                // Check metadata.sport or metadata.strSport
                if (meta.sport) {
                    return extractSportString(meta.sport, predictionObj);
                }
                if (meta.strSport) {
                    return extractSportString(meta.strSport, predictionObj);
                }

                // Check match.sport or match.strSport
                if (match.sport) {
                    return extractSportString(match.sport, predictionObj);
                }
                if (match.strSport) {
                    return extractSportString(match.strSport, predictionObj);
                }

                // Check metadata.league for sport clues
                if (meta.league) {
                    var leagueLower = String(meta.league).toLowerCase();
                    if (leagueLower.includes('premier') || leagueLower.includes('la liga') || leagueLower.includes('bundesliga') || leagueLower.includes('serie') || leagueLower.includes('ligue')) {
                        return 'soccer';
                    } else if (leagueLower.includes('mlb')) {
                        return 'baseball';
                    } else if (leagueLower.includes('atp') || leagueLower.includes('wta')) {
                        return 'tennis';
                    }
                }
            }

            // Safe default: return 'Unknown' instead of Unknown/empty string
            return 'unknown';
        }

        // Sport Name Mapping: Frontend "Football" should match backend "Soccer"
        var sportAliases = {};
        if (sportLower === 'football') {
            sportAliases['soccer'] = true;
        }

        var filteredPredictions = allPredictions.filter(function(pred) {
            var match = (pred.matches && pred.matches[0]) ? pred.matches[0] : {};
            var meta = (match.metadata && typeof match.metadata === 'object') ? match.metadata : {};

            // Safely extract sport from multiple possible locations
            var predSportValues = [
                pred.sport,
                match.sport,
                meta.sport,
                pred.raw_fixtures?.sport,
                pred.sport_name,
                pred.raw_fixtures?.strSport,
                meta.strSport,
                match.strSport
            ];

            var predSport = '';
            for (var i = 0; i < predSportValues.length; i++) {
                var extracted = extractSportString(predSportValues[i], pred);
                if (extracted && extracted !== 'unknown') {
                    predSport = extracted;
                    break;
                }
            }

            // If still no sport found, try direct metadata inference
            if (!predSport || predSport === 'unknown') {
                predSport = extractSportString(None, pred);
            }

            // Strict tab routing: Match against current sport or its aliases only
            // No Fallback that dumps unfiltered data into tabs
            return predSport === sportLower || sportAliases[predSport] === true;
        });

        console.log('[SMH] ' + sport + ' payload — source_rows=' + (data.source_rows || 0) + ', buckets:', {
            direct:              (cats.direct              || []).length,
            analytical_insights: (cats.analytical_insights || []).length,
            multi:               (cats.multi               || []).length,
            same_match:          (cats.same_match          || []).length,
            acca_6match:         (cats.acca_6match         || []).length,
            mega_acca_12:        (cats.mega_acca_12        || []).length
        });
        // console.log removed

        // ── Empty state ──────────────────────────────────────────────────────
        if (filteredPredictions.length === 0) {
            if (resultsPanel) resultsPanel.style.justifyContent = 'center';
            if (displayTitle) displayTitle.textContent = sport + ' \u2014 No Predictions Available';

            var sourceRows = data.source_rows || 0;
            var emptyMsg = sourceRows > 0
                ? 'The database has ' + sourceRows + ' raw row(s) but None passed the category filter. Check confidence thresholds or trigger a new AI pipeline run.'
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
            displayTitle.textContent  = sport + ' \u00b7 ' + filteredPredictions.length + ' Insight' + (filteredPredictions.length !== 1 ? 's' : '');
            displayTitle.style.fontSize   = '1rem';
            displayTitle.style.color      = '#94a3b8';
            displayTitle.style.marginBottom = '16px';
        }

        // Clear previous SMH entries if needed, or rely on unique IDs.
        // We avoid clearing window.SMH_CARD_REGISTRY entirely to not break the main dashboard
        // but we ensure these specific sport insights are available.

        var html = '<div class="results-scroll-container" style="width:100%;max-height:420px;overflow-y:auto;padding-right:8px;">';

        filteredPredictions.forEach(function (pred) {
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
                || 'Not Available';
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
                || match.odds || None;
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

            // Dynamic risk logic for badges
            var isHighVariance = confidence < 59;
            var pickTypeLabel  = isHighVariance ? "Risk-Adjusted" : "Direct Pick";
            var marketLabel    = isHighVariance ? "Double Chance" : "1X2";
            var pickTypeColor  = isHighVariance ? "text-amber-500" : "text-slate-400";
            var marketBgColor  = isHighVariance ? "bg-amber-950/50 text-amber-400 border border-amber-700/50" : "bg-slate-800 text-white";

            // Use .smh-result-item class for hover (CSP-safe, no inline onmouseover)
            html +=
                '<div class="smh-result-item" data-card-id="' + cardId + '" style="border-left:4px solid ' + accentColor + ';">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;flex-wrap:wrap;">' +
                        '<div>' +
                            '<div class="text-[10px] font-bold ' + pickTypeColor + ' uppercase tracking-wider">' + pickTypeLabel + (isAcca && !isHighVariance ? ' \u00b7 ' + legCount + ' legs' : '') + '</div>' +
                            '<div class="text-xs font-black ' + marketBgColor + ' px-2 py-1 rounded inline-block mt-0.5">' + marketLabel + '</div>' +
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
                    '<button class="insight-btn" data-card-id="' + cardId + '" style="width:100%;padding:10px 16px;background:linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);color:#ffffff;border:None;border-radius:8px;font-size:0.85rem;font-weight:700;letter-spacing:0.5px;cursor:pointer;text-transform:uppercase;box-shadow:0 4px 12px rgba(139,92,246,0.3);transition:all 0.2s ease;margin-top:8px;">Click for insights</button>' +
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

// Helper: Update modal with AI prediction data
window.updateModalWithAIData = function(aiPrediction) {
    const confidenceScoreEl = document.getElementById('ai-confidence-score');
    const edgemindFeedbackEl = document.getElementById('edgemind-feedback');
    const valueCombosEl = document.getElementById('value-combos');
    
    if (confidenceScoreEl && aiPrediction.confidence_score !== Unknown) {
        confidenceScoreEl.textContent = aiPrediction.confidence_score + '%';
        const progressBar = document.getElementById('ai-confidence-bar');
        if (progressBar) {
            progressBar.style.width = aiPrediction.confidence_score + '%';
        }
    }
    
    if (edgemindFeedbackEl && aiPrediction.edgemind_feedback) {
        edgemindFeedbackEl.textContent = aiPrediction.edgemind_feedback;
        edgemindFeedbackEl.classList.remove('text-slate-400');
        edgemindFeedbackEl.classList.add('text-emerald-400');
    }

    // Update value combos with actual data instead of "Pending"
    if (valueCombosEl && aiPrediction.value_combos) {
        const combos = aiPrediction.value_combos;
        let combosHtml = '';
        
        if (combos.under_over) {
            combosHtml += '<div style="margin-bottom:8px;padding:8px 12px;background:rgba(34,197,94,0.1);border-radius:6px;border:1px solid rgba(34,197,94,0.2);"><span style="font-size:0.85rem;color:#4ade80;font-weight:600;">Goals:</span> <span style="font-size:0.85rem;color:#e2e8f0;">' + combos.under_over + '</span></div>';
        }
        if (combos.double_chance) {
            combosHtml += '<div style="margin-bottom:8px;padding:8px 12px;background:rgba(59,130,246,0.1);border-radius:6px;border:1px solid rgba(59,130,246,0.2);"><span style="font-size:0.85rem;color:#60a5fa;font-weight:600;">Safety:</span> <span style="font-size:0.85rem;color:#e2e8f0;">' + combos.double_chance + '</span></div>';
        }
        
        if (combosHtml) {
            valueCombosEl.innerHTML = combosHtml;
        }
    }

    // Hide loading state
    const loadingEl = document.getElementById('ai-loading-state');
    if (loadingEl) {
        loadingEl.style.display = 'None';
    }
};

// Helper: Update modal loading state
window.updateModalWithLoadingState = function(showLoading) {
    const loadingEl = document.getElementById('ai-loading-state');
    if (loadingEl) {
        loadingEl.style.display = showLoading ? 'block' : 'None';
    }
};

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

window.openMatchDetail = async function(cardId) {
    const prediction = window.SMH_CARD_REGISTRY.get(cardId);
    if (!prediction) {
        console.error('[SMH] No prediction found for card ID:', cardId);
        return;
    }

    // CRITICAL DIRECTIVE: Console.log the incoming data object to verify JSON paths
    // console.log removed

    const leg = Array.isArray(prediction.matches) && prediction.matches[0] ? prediction.matches[0] : {};
    // Enhanced team name extraction with multiple Fallback locations
    const home = leg.home_team || leg.strHomeTeam || (leg.metadata && leg.metadata.home_team) || (leg.metadata && leg.metadata.strHomeTeam) || 'Home';
    const away = leg.away_team || leg.strAwayTeam || (leg.metadata && leg.metadata.away_team) || (leg.metadata && leg.metadata.strAwayTeam) || 'Away';
    const sectionType = String(prediction.section_type || prediction.type || 'direct');
    const confidence = Math.round(Number(prediction.total_confidence || 0));
    const league = leg.metadata && leg.metadata.league ? leg.metadata.league : (leg.sport || sectionType);

    // SIDE-BY-SIDE: Fetch AI predictions from ai_predictions table
    let aiPrediction = None;
    let isCalculating = false;
    
    // Extract match_id for AI predictions lookup (use id_event or fixture_id if available)
    const matchId = leg.id_event || leg.fixture_id || leg.match_id || prediction.id;
    
    if (matchId) {
        // Show loading state initially
        isCalculating = true;
        
        try {
            const response = await fetch(`${BACKEND_URL}/api/ai-predictions/${matchId}`, {
                headers: { 'x-api-key': API_KEY }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            isCalculating = false;
            
            if (data.data) {
                aiPrediction = data.data;
                // Update modal if it's already open
                updateModalWithAIData(aiPrediction);
            } else {
                // No AI prediction available, hide loading state
                updateModalWithLoadingState(false);
            }
        } catch (err) {
            // Silently handle 404s - prediction not yet available
            if (err.message.includes('404')) {
                console.log(`[SMH] AI prediction not yet available for match ${matchId}`);
            } else {
                console.error('[SMH] Failed to fetch AI prediction:', err);
            }
            isCalculating = false;
            updateModalWithLoadingState(false);
        }
    } else {
        isCalculating = false;
    }

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
        const mPick = String(m.prediction || m.recommendation || (m.metadata && m.metadata.prediction) || 'Not Available').replace(/_/g,' ').toUpperCase();
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
                '<div style="font-size:0.82rem;color:#e2e8f0;margin-top:4px;">' + String(sm.prediction || sm.pick || 'Not Available').replace(/_/g,' ').toUpperCase() + '</div>' +
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

    // Dynamically build secondary markets HTML with a robust Fallback
    let secondaryMarketsHTML = '';
    let secInsights = prediction.secondary_insights || prediction.secondary_markets || [];
    let dcHTML = '';
    let smbHTML = '';

    // Fallback: If Supabase doesn't send the array, build a basic one from 1X2 data
    if (confidence < 59 && (!Array.isArray(secInsights) || secInsights.length === 0)) {
        // Assuming prediction has home, draw, away properties
        const pHome = prediction.home || 45; 
        const pDraw = prediction.draw || 35;
        const pAway = prediction.away || 20;
        
        secInsights = [
            { market: '1X (Home/Draw)', confidence: Math.min(99, pHome + pDraw) },
            { market: '12 (Any Winner)', confidence: Math.min(99, pHome + pAway) },
            { market: 'X2 (Draw/Away)', confidence: Math.min(99, pDraw + pAway) }
        ];
    }

    if (confidence < 59 && Array.isArray(secInsights) && secInsights.length > 0) {
        dcHTML = '';
        smbHTML = '';

        secInsights.forEach((insight, index) => {
            const marketLabel = (insight.market || insight.prediction || '').toLowerCase();
            const isDoubleChance = marketLabel.includes('double chance') || marketLabel.includes('1x') || marketLabel.includes('12') || marketLabel.includes('x2');
            
            if (isDoubleChance) {
                 const isPrimaryDC = dcHTML === ''; // Highlight the first one we find
                 const bgClass = isPrimaryDC ? 'bg-emerald-900/20 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'bg-slate-800/50 border-slate-700';
                 const titleClass = isPrimaryDC ? 'text-emerald-500' : 'text-slate-400';
                 const pctClass = isPrimaryDC ? 'text-emerald-400' : 'text-slate-300';
                 
                 dcHTML += '<div class="bg-emerald-900/20 border border-emerald-500/40 rounded-lg p-3 text-center shadow-[0_0_10px_rgba(16,185,129,0.05)]">' +
                             '<div class="text-[10px] text-emerald-500 font-bold mb-1 uppercase">Double Chance</div>' +
                             '<div class="font-bold text-emerald-400 text-sm">' + (insight.market || insight.prediction) + '</div>' +
                             '<div class="font-mono text-xs text-emerald-500/70 mt-1">' + (insight.confidence || 0) + '% Conf</div>' +
                           '</div>';
            } else {
                 smbHTML += '<tr class="hover:bg-slate-800/30"><td class="py-2 px-4">' + (insight.market || insight.prediction) + '</td><td class="py-2 px-4 font-bold text-white text-right">' + (insight.confidence || 0) + '%</td></tr>';
            }
        });

        // If no Same-Match builds were found or generated, provide a data so the section doesn't look broken
        if (smbHTML === '') {
            smbHTML = '<tr class="hover:bg-slate-800/30"><td class="py-2 px-4 text-xs text-slate-500 italic" colspan="2">Pending correlation analysis...</td></tr>';
        }

        secondaryMarketsHTML = 
            '<div class="mt-4 bg-amber-950/40 border border-amber-700/50 rounded-lg p-3 flex items-start gap-3">' +
                '<span class="text-amber-500 mt-0.5">⚠️</span>' +
                '<div>' +
                    '<h4 class="text-[11px] font-bold text-amber-500 uppercase tracking-wide">High Variance Alert</h4>' +
                    '<p class="text-[11px] text-amber-200/70 mt-1 leading-relaxed">The 1X2 outcome carries higher risk for this fixture. Consider the risk-adjusted secondary markets below.</p>' +
                '</div>' +
            '</div>' +
            '<div class="mt-6 border-t border-slate-700/50 pt-5">' +
                '<h3 class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">' +
                    '<span class="w-2 h-2 rounded-full bg-blue-500"></span> Secondary Alternatives' +
                '</h3>' +
                '<div class="mb-5">' +
                    '<h4 class="text-[10px] uppercase text-slate-500 font-bold mb-2">Double Chance</h4>' +
                    '<div class="flex gap-2">' + dcHTML + '</div>' +
                '</div>' +
                '<div>' +
                    '<h4 class="text-[10px] uppercase text-slate-500 font-bold mb-2">Correlated Markets <span>(S)</span></h4>' +
                    smbHTML +
                '</div>' +
            '</div>';
    }

    if (!dcHTML) dcHTML = '<div class="bg-slate-800/40 border border-slate-700 rounded-lg p-3 text-center"><div class="text-xs text-slate-500 italic">Pending analysis...</div></div>';
    if (!smbHTML) smbHTML = '<tr class="hover:bg-slate-800/30"><td class="py-2 px-4 text-xs text-slate-500 italic" colspan="2">Pending correlation analysis...</td></tr>';

    // Create modal if it doesn't exist
    let modal = document.getElementById('skcsMatchDetailModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'skcsMatchDetailModal';
        modal.className = 'modal-backdrop';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:None;justify-content:center;align-items:center;z-index:10000;padding:20px;';
        modal.innerHTML =
            '<div style="background:#1c1f26;border-radius:16px;padding:24px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto;border:1px solid rgba(255,255,255,0.1);box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
                    '<button class="close-match-modal-btn" style="background:transparent;border:None;color:#3b82f6;font-size:0.95rem;font-weight:600;cursor:pointer;padding:0;display:flex;align-items:center;gap:4px;transition:color 0.2s;">← Back to Fixtures</button>' +
                    '<button class="close-match-modal-btn" style="background:None;border:None;color:#94a3b8;font-size:1.5rem;cursor:pointer;padding:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:6px;transition:background 0.2s;">&times;</button>' +
                '</div>' +
                '<div id="skcsModalBody"></div>' +
            '</div>';
        document.body.appendChild(modal);
    }

    const body = document.getElementById('skcsModalBody');
    if (body) {
        body.innerHTML = `
<div class="bg-[#0f172a] text-slate-300 rounded-xl overflow-hidden shadow-2xl border border-slate-700/50 flex flex-col max-h-[85vh]">
    <div class="bg-slate-900 p-6 border-b border-slate-800">
        <div class="flex justify-between items-start mb-4">
            <div>
                <div class="text-[10px] uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-2">
                    <span>${leg.metadata?.country || 'Global'}</span> <span class="w-1 h-1 bg-slate-600 rounded-full"></span> <span>${league || 'League'}</span>
                </div>
                <h2 class="text-2xl font-bold text-white tracking-tight">${home || 'Home Team'} <span class="text-slate-500 font-normal text-lg mx-1">vs</span> ${away || 'Away Team'}</h2>
            </div>
            <div class="text-right">
                <div class="text-xs font-mono text-slate-400">${kickoffStr}</div>
            </div>
        </div>
        <div class="flex gap-2">
            <span class="bg-slate-800 border border-slate-700 px-2 py-1 rounded text-[10px] text-slate-300">🌤️ ${prediction.weather || 'Unavailable'}</span>
            <span class="bg-emerald-900/30 border border-emerald-800/50 px-2 py-1 rounded text-[10px] text-emerald-400">👥 ${prediction.injuries || 'No major absences'}</span>
        </div>
    </div>

    <div class="p-6 overflow-y-auto custom-scrollbar space-y-8">
        <section>
            <h3 class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-blue-500"></span> Direct 1X2 & EdgeMind Analysis
            </h3>
            <div class="bg-slate-800/40 border border-slate-700/50 rounded-t-lg p-4 flex justify-between">
                <div class="text-center flex-1 border-r border-slate-700/50"><div class="text-[10px] text-slate-400 mb-1">HT (1)</div><div class="text-lg font-mono font-bold text-white">${prediction.home || 45}%</div></div>
                <div class="text-center flex-1 border-r border-slate-700/50"><div class="text-[10px] text-slate-400 mb-1">D (X)</div><div class="text-lg font-mono font-bold text-slate-300">${prediction.draw || 35}%</div></div>
                <div class="text-center flex-1"><div class="text-[10px] text-slate-400 mb-1">AT (2)</div><div class="text-lg font-mono font-bold text-slate-400">${prediction.away || 20}%</div></div>
            </div>
            <div class="bg-slate-900 border-x border-b border-slate-700/50 rounded-b-lg p-4">
                <div class="flex justify-between items-center mb-3">
                    <div class="text-sm font-bold text-white flex items-center gap-2">🤖 EdgeMind BOT</div>
                    <div class="bg-amber-900/30 border border-amber-500/50 text-amber-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase">${confidence >= 70 ? 'High' : (confidence >= 59 ? 'Medium' : 'Low')} Viability</div>
                </div>
                
                <!-- SIDE-BY-SIDE: AI Prediction Loading State -->
                <div id="ai-loading-state" style="display:${isCalculating ? 'block' : 'None'};" class="mb-3">
                    <div class="flex items-center gap-2 text-xs text-slate-400">
                        <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Calculating AI Edge...</span>
                    </div>
                </div>
                
                <div class="w-full bg-slate-800 rounded-full h-1.5 mb-3">
                    <div id="ai-confidence-bar" class="bg-amber-500 h-1.5 rounded-full" style="width: ${confidence}%"></div>
                </div>
                <p class="text-[11px] text-slate-400 leading-relaxed">
                    The primary 1X2 outcome holds a <span class="text-white font-bold">${confidence}% confidence</span> rating. ${confidence < 59 ? 'Match tempo is highly unpredictable. We strongly advise utilizing a risk-adjusted secondary insight.' : 'This indicates a stable market probability.'}
                </p>
                
                <!-- AI Reasoning from Backend -->
                <div class="mt-3 text-[11px] text-slate-300 leading-relaxed">
                    ${leg.metadata?.ai_reasoning || leg.metadata?.edgeMind_analysis || prediction.ai_reasoning || prediction.engine_log || 'AI analysis is being processed...'}
                </div>
                
                <!-- SIDE-BY-SIDE: AI EdgeMind Feedback -->
                <div id="edgemind-feedback" class="mt-3 text-[11px] text-slate-400 leading-relaxed italic">
                    ${aiPrediction ? aiPrediction.edgemind_feedback : ''}
                </div>
            </div>
        </section>

        <section>
            <h3 class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Secondary Alternatives
            </h3>
            <div class="grid grid-cols-2 gap-3">
                ${dcHTML || '<div class="text-xs text-slate-500 col-span-2">No secondary markets available.</div>'}
            </div>
        </section>

        <section>
            <h3 class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-purple-500"></span> Value Combos
            </h3>
            <div id="value-combos" class="space-y-2">
                ${prediction.value_combos ? 
                    Object.entries(prediction.value_combos).map(([key, value]) => 
                        `<div class="bg-slate-800/40 border border-slate-700 rounded-lg p-3 flex justify-between items-center">
                            <div class="flex items-center gap-3">
                                <span class="bg-purple-900/30 border border-purple-700/50 px-2 py-1 rounded text-xs font-bold text-purple-400">${key.replace(/_/g, ' ').toUpperCase()}</span>
                            </div>
                            <div class="font-mono text-xs text-slate-300">${value}</div>
                        </div>`
                    ).join('') : 
                    '<div class="text-xs text-slate-500 italic text-center py-4">No value combinations available</div>'
                }
            </div>
        </section>

        <section>
            <h3 class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-indigo-500"></span> Same Match Builder
            </h3>
            <div class="bg-indigo-950/20 border border-indigo-900/50 rounded-lg overflow-hidden p-2">
                ${smbHTML && smbHTML.includes('Pending correlation analysis') === false ? smbHTML : '<div class="text-xs text-slate-500 italic text-center py-4">No same match combinations available</div>'}
            </div>
        </section>
    </div>
</div>
`;
    }
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.closeMatchDetail = function() {
    const modal = document.getElementById('skcsMatchDetailModal');
    if (modal) modal.style.display = 'None';
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

    // Global Event Delegation for Pipeline Stepper
    const stepBtn = e.target.closest('.pipeline-step-btn');
    if (stepBtn) {
        const index = parseInt(stepBtn.getAttribute('data-index'));
        const data = SKCS_PIPELINE_DATA[index];
        
        if (!data) return;

        // 1. Update Terminal Content
        document.getElementById('terminal-title').innerHTML = data.title;
        document.getElementById('terminal-purpose').innerText = `Purpose: ${data.purpose}`;
        document.getElementById('terminal-json').textContent = data.json;
        document.getElementById('terminal-stage-badge').innerText = `STAGE ${index + 1}/6`;

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
