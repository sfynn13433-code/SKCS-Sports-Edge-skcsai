// Master Rulebook Secondary Market Processing for smh-hub.js
// Replaces the old 59% logic with Safe Haven and Best-in-Category selection

// Market category mapping for Master Rulebook
const MARKET_CATEGORIES = {
    'DOUBLE_CHANCE': {
        markets: ['double_chance_1x', 'double_chance_x2', 'double_chance_12', '1x', 'x2', '12', 'home_or_draw', 'draw_or_away', 'home_or_away'],
        label: 'Double Chance / Draw No Bet',
        color: 'emerald'
    },
    'GOALS': {
        markets: ['over_0_5', 'over_1_5', 'over_2_5', 'over_3_5', 'under_0_5', 'under_1_5', 'under_2_5', 'under_3_5', 'team_total_over', 'team_total_under'],
        label: 'Goals (Totals & Team)',
        color: 'blue'
    },
    'BTTS': {
        markets: ['btts_yes', 'btts_no', 'both_teams_to_score', 'both_teams_to_score_no'],
        label: 'BTTS',
        color: 'purple'
    },
    'CORNERS': {
        markets: ['corners_over_8_5', 'corners_over_9_5', 'corners_over_10_5', 'corners_under_8_5', 'corners_under_9_5', 'corners_under_10_5', 'team_corners_over', 'team_corners_under'],
        label: 'Corners',
        color: 'indigo'
    },
    'CARDS': {
        markets: ['yellow_cards_over_2_5', 'yellow_cards_under_2_5', 'red_cards_over_0_5', 'red_cards_under_0_5', 'total_cards_over', 'total_cards_under'],
        label: 'Cards',
        color: 'orange'
    },
    'FIRST_HALF': {
        markets: ['first_half_over_0_5', 'first_half_over_1_5', 'first_half_under_1_5', 'first_half_home_win', 'first_half_draw', 'first_half_away_win'],
        label: 'First Half',
        color: 'pink'
    },
    'TEAM_WIN_EITHER_HALF': {
        markets: ['home_win_either_half', 'away_win_either_half', 'team_win_either_half'],
        label: 'Team Win Either Half',
        color: 'teal'
    }
};

// Safe Haven market list (from Master Rulebook)
const SAFE_HAVEN_MARKETS = new Set([
    'double_chance_1x', 'double_chance_x2', 'double_chance_12',
    'over_0_5', 'over_1_5', 'under_3_5', 'under_4_5',
    'btts_no',
    'corners_over_8_5', 'corners_over_9_5', 'corners_under_10_5', 'corners_under_11_5',
    'yellow_cards_over_2_5', 'yellow_cards_under_3_5',
    'first_half_over_0_5', 'first_half_under_1_5',
    'home_win_either_half', 'away_win_either_half'
]);

// Function to categorize a market
function categorizeMarket(marketName) {
    const normalized = String(marketName || '').toLowerCase().replace(/\s+/g, '_');
    
    for (const [category, config] of Object.entries(MARKET_CATEGORIES)) {
        if (config.markets.some(market => normalized.includes(market))) {
            return category;
        }
    }
    
    return 'OTHER';
}

// Function to select Best-in-Category secondary markets
function selectBestInCategoryMarkets(allMarkets, maxMarkets = 4) {
    // Group markets by category
    const categoryGroups = {};
    
    allMarkets.forEach(market => {
        const category = categorizeMarket(market.market || market.prediction);
        
        if (!categoryGroups[category]) {
            categoryGroups[category] = [];
        }
        
        categoryGroups[category].push(market);
    });
    
    // Find the best market in each category (highest confidence)
    const bestInCategory = [];
    
    for (const [category, markets] of Object.entries(categoryGroups)) {
        if (markets.length > 0) {
            // Sort by confidence descending and take the best one
            markets.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
            bestInCategory.push({
                ...markets[0],
                category,
                categoryLabel: MARKET_CATEGORIES[category]?.label || category,
                categoryColor: MARKET_CATEGORIES[category]?.color || 'gray'
            });
        }
    }
    
    // Sort all best-in-category markets by confidence and take top N
    bestInCategory.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    
    return bestInCategory.slice(0, maxMarkets);
}

// Function to implement Safe Haven fallback logic
function selectSafeHavenMarkets(mainConfidence, allMarkets, maxMarkets = 4) {
    // Check if Safe Haven should be triggered
    const shouldTrigger = mainConfidence < 80 && 
                         !allMarkets.some(market => (market.confidence || 0) >= 80);
    
    if (!shouldTrigger) {
        // Use primary rule: select markets >=80%
        const highConfidenceMarkets = allMarkets.filter(market => (market.confidence || 0) >= 80);
        return selectBestInCategoryMarkets(highConfidenceMarkets, maxMarkets);
    }
    
    // Safe Haven fallback: markets > main confidence AND >=75%
    const safeHavenCandidates = allMarkets.filter(market => {
        const marketKey = String(market.market || market.prediction || '').toLowerCase().replace(/\s+/g, '_');
        const confidence = market.confidence || 0;
        
        return SAFE_HAVEN_MARKETS.has(marketKey) &&
               confidence > mainConfidence &&
               confidence >= 75;
    });
    
    return selectBestInCategoryMarkets(safeHavenCandidates, maxMarkets);
}

// Function to generate dynamic EdgeMind BOT message
function generateEdgeMindMessage(mainConfidence, riskTier, safeHavenTriggered, secondaryCount) {
    if (safeHavenTriggered) {
        return `While the main market carries a ${riskTier.toLowerCase()} level of confidence (${mainConfidence}%), here are safer markets that cross the low-risk threshold of 75%.`;
    } else if (riskTier === 'Low Risk') {
        return `Strong prediction confidence (${mainConfidence}%). Secondary markets are available for additional betting options.`;
    } else if (riskTier === 'Medium Risk') {
        return `The primary 1X2 outcome holds a ${mainConfidence}% confidence rating with ${riskTier.toLowerCase()} exposure. Consider the secondary markets below for alternative options.`;
    } else if (riskTier === 'High Risk') {
        return `The primary 1X2 outcome carries ${riskTier.toLowerCase()} risk at ${mainConfidence}% confidence. Exercise caution and consider the secondary markets below.`;
    } else {
        return `Extreme risk detected - primary prediction not recommended for betting.`;
    }
}

// Function to build secondary markets HTML with Master Rulebook logic
function buildSecondaryMarketsHTML(prediction, mainConfidence, riskTier) {
    let secondaryMarketsHTML = '';
    const secInsights = prediction.secondary_insights || prediction.secondary_markets || [];
    
    if (!Array.isArray(secInsights) || secInsights.length === 0) {
        // No secondary markets available
        if (riskTier === 'Extreme Risk') {
            secondaryMarketsHTML = `
                <div class="mt-4 bg-red-950/40 border border-red-700/50 rounded-lg p-3 flex items-start gap-3">
                    <span class="text-red-500 mt-0.5">🛑</span>
                    <div>
                        <h4 class="text-[11px] font-bold text-red-500 uppercase tracking-wide">Extreme Risk Alert</h4>
                        <p class="text-[11px] text-red-200/70 mt-1 leading-relaxed">Primary prediction confidence too low for safe betting recommendations.</p>
                    </div>
                </div>`;
        } else {
            secondaryMarketsHTML = `
                <div class="mt-4 bg-slate-800/40 border border-slate-700 rounded-lg p-3 text-center">
                    <div class="text-xs text-slate-500 italic">Secondary markets not available for this fixture</div>
                </div>`;
        }
        return secondaryMarketsHTML;
    }
    
    // Apply Safe Haven selection logic
    const selectedMarkets = selectSafeHavenMarkets(mainConfidence, secInsights, 4);
    const safeHavenTriggered = mainConfidence < 80 && !secInsights.some(m => (m.confidence || 0) >= 80);
    
    if (selectedMarkets.length === 0) {
        // No markets meet criteria
        secondaryMarketsHTML = `
            <div class="mt-4 bg-amber-950/40 border border-amber-700/50 rounded-lg p-3 flex items-start gap-3">
                <span class="text-amber-500 mt-0.5">⚠️</span>
                <div>
                    <h4 class="text-[11px] font-bold text-amber-500 uppercase tracking-wide">Limited Options</h4>
                    <p class="text-[11px] text-amber-200/70 mt-1 leading-relaxed">No secondary markets meet the confidence criteria for this fixture.</p>
                </div>
            </div>`;
        return secondaryMarketsHTML;
    }
    
    // Generate dynamic message
    const edgeMindMessage = generateEdgeMindMessage(mainConfidence, riskTier, safeHavenTriggered, selectedMarkets.length);
    
    // Build category-based HTML
    const categoryHTML = {};
    
    selectedMarkets.forEach(market => {
        const category = market.category || 'OTHER';
        const categoryLabel = market.categoryLabel || category;
        const categoryColor = market.categoryColor || 'gray';
        
        if (!categoryHTML[category]) {
            categoryHTML[category] = [];
        }
        
        const confidence = Math.round(Number(market.confidence || 0));
        const marketName = market.market || market.prediction || 'Unknown';
        const colorClass = getCategoryColorClass(categoryColor);
        
        categoryHTML[category].push(`
            <div class="bg-${categoryColor}-950/20 border border-${categoryColor}-500/40 rounded-lg p-3 text-center shadow-[0_0_10px_rgba(16,185,129,0.05)]">
                <div class="text-[10px] text-${categoryColor}-500 font-bold mb-1 uppercase">${categoryLabel}</div>
                <div class="font-bold text-${categoryColor}-400 text-sm">${marketName}</div>
                <div class="font-mono text-xs text-${categoryColor}-500/70 mt-1">${confidence}% Conf</div>
            </div>
        `);
    });
    
    // Build final HTML
    let categoriesHTML = '';
    
    for (const [category, markets] of Object.entries(categoryHTML)) {
        const categoryLabel = selectedMarkets.find(m => m.category === category)?.categoryLabel || category;
        categoriesHTML += `
            <div class="mb-5">
                <h4 class="text-[10px] uppercase text-slate-500 font-bold mb-2">${categoryLabel}</h4>
                <div class="flex gap-2">${markets.join('')}</div>
            </div>`;
    }
    
    secondaryMarketsHTML = `
        ${safeHavenTriggered || riskTier !== 'Low Risk' ? `
        <div class="mt-4 bg-${riskTier === 'Extreme Risk' ? 'red' : safeHavenTriggered ? 'amber' : 'orange'}-950/40 border border-${riskTier === 'Extreme Risk' ? 'red' : safeHavenTriggered ? 'amber' : 'orange'}-700/50 rounded-lg p-3 flex items-start gap-3">
            <span class="text-${riskTier === 'Extreme Risk' ? 'red' : safeHavenTriggered ? 'amber' : 'orange'}-500 mt-0.5">${riskTier === 'Extreme Risk' ? '🛑' : '⚠️'}</span>
            <div>
                <h4 class="text-[11px] font-bold text-${riskTier === 'Extreme Risk' ? 'red' : safeHavenTriggered ? 'amber' : 'orange'}-500 uppercase tracking-wide">${riskTier === 'Extreme Risk' ? 'Extreme Risk' : safeHavenTriggered ? 'Safe Haven Activated' : 'Risk Alert'}</h4>
                <p class="text-[11px] text-${riskTier === 'Extreme Risk' ? 'red' : safeHavenTriggered ? 'amber' : 'orange'}-200/70 mt-1 leading-relaxed">${edgeMindMessage}</p>
            </div>
        </div>` : ''}
        <div class="mt-6 border-t border-slate-700/50 pt-5">
            <h3 class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-blue-500"></span> Secondary Alternatives
            </h3>
            ${categoriesHTML}
        </div>`;
    
    return secondaryMarketsHTML;
}

// Helper function to get Tailwind color classes
function getCategoryColorClass(color) {
    const colorMap = {
        'emerald': 'emerald',
        'blue': 'blue',
        'purple': 'purple',
        'indigo': 'indigo',
        'orange': 'orange',
        'pink': 'pink',
        'teal': 'teal',
        'gray': 'slate'
    };
    return colorMap[color] || 'slate';
}

// Export functions for use in smh-hub.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MARKET_CATEGORIES,
        SAFE_HAVEN_MARKETS,
        categorizeMarket,
        selectBestInCategoryMarkets,
        selectSafeHavenMarkets,
        generateEdgeMindMessage,
        buildSecondaryMarketsHTML
    };
}
