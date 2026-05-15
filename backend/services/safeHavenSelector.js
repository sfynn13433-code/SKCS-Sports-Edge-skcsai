// Safe Haven Market Selector for SKCS Master Rulebook
// Implements fallback logic when main confidence < 80% and no secondary markets >=80%

'use strict';

const { getStandardSecondaryMarkets } = require('./marketIntelligence');

// Safe Haven Market List (from Master Rulebook)
const SAFE_HAVEN_MARKETS = new Set([
    // Double Chance / Draw No Bet
    'double_chance_1x', 'double_chance_x2', 'double_chance_12',
    'draw_no_bet_home', 'draw_no_bet_away',
    
    // Goals Totals
    'over_1_5', 'over_2_5', 'over_3_5', 'over_4_5', 'over_5_5', 'over_6_5',
    'under_2_5', 'under_3_5', 'under_4_5', 'under_5_5', 'under_6_5',
    'home_over_0_5', 'home_over_1_5', 'away_over_0_5', 'away_over_1_5',
    
    // BTTS
    'btts_yes', 'btts_no', 'btts_and_over_2_5', 'btts_and_under_3_5',
    
    // Corners
    'corners_over_6_5', 'corners_over_7_5', 'corners_over_8_5', 'corners_over_9_5', 'corners_over_10_5', 'corners_over_11_5', 'corners_over_12_5',
    'corners_under_6_5', 'corners_under_7_5', 'corners_under_8_5', 'corners_under_9_5', 'corners_under_10_5', 'corners_under_11_5', 'corners_under_12_5',
    
    // Cards
    'yellow_cards_over_1_5', 'yellow_cards_over_2_5', 'yellow_cards_over_3_5', 'yellow_cards_over_4_5', 'yellow_cards_over_5_5', 'yellow_cards_over_6_5',
    'yellow_cards_under_1_5', 'yellow_cards_under_2_5', 'yellow_cards_under_3_5', 'yellow_cards_under_4_5', 'yellow_cards_under_5_5', 'yellow_cards_under_6_5',
    
    // First Half Markets
    'over_0_5_first_half', 'under_1_5_first_half', 'first_half_draw',
    
    // Team Win in Either Half
    'home_win_either_half', 'away_win_either_half'
]);

// Market Categories for Best-in-Category Selection
const MARKET_CATEGORIES = {
    'Double Chance / Draw No Bet': [
        'double_chance_1x', 'double_chance_x2', 'double_chance_12',
        'draw_no_bet_home', 'draw_no_bet_away'
    ],
    'Goals (Totals & Team)': [
        'over_1_5', 'over_2_5', 'over_3_5', 'over_4_5', 'over_5_5', 'over_6_5',
        'under_2_5', 'under_3_5', 'under_4_5', 'under_5_5', 'under_6_5',
        'home_over_0_5', 'home_over_1_5', 'away_over_0_5', 'away_over_1_5'
    ],
    'BTTS': [
        'btts_yes', 'btts_no', 'btts_and_over_2_5', 'btts_and_under_3_5'
    ],
    'Corners': [
        'corners_over_6_5', 'corners_over_7_5', 'corners_over_8_5', 'corners_over_9_5', 'corners_over_10_5', 'corners_over_11_5', 'corners_over_12_5',
        'corners_under_6_5', 'corners_under_7_5', 'corners_under_8_5', 'corners_under_9_5', 'corners_under_10_5', 'corners_under_11_5', 'corners_under_12_5'
    ],
    'Cards': [
        'yellow_cards_over_1_5', 'yellow_cards_over_2_5', 'yellow_cards_over_3_5', 'yellow_cards_over_4_5', 'yellow_cards_over_5_5', 'yellow_cards_over_6_5',
        'yellow_cards_under_1_5', 'yellow_cards_under_2_5', 'yellow_cards_under_3_5', 'yellow_cards_under_4_5', 'yellow_cards_under_5_5', 'yellow_cards_under_6_5'
    ],
    'First Half Markets': [
        'over_0_5_first_half', 'under_1_5_first_half', 'first_half_draw'
    ],
    'Team Win in Either Half': [
        'home_win_either_half', 'away_win_either_half'
    ]
};

/**
 * Get category for a market
 */
function getCategoryForMarket(market) {
    for (const [category, markets] of Object.entries(MARKET_CATEGORIES)) {
        if (markets.includes(market)) {
            return category;
        }
    }
    return null;
}

/**
 * Select Safe Haven markets according to Master Rulebook
 * @param {number} mainConfidence - Main prediction confidence
 * @param {Array} allMarkets - All available market predictions
 * @returns {Array} Selected Safe Haven markets (max 4, one per category)
 */
function selectSafeHavenMarkets(mainConfidence, allMarkets = []) {
    // Validate input
    if (!Number.isFinite(mainConfidence) || mainConfidence < 30) {
        return []; // No Safe Haven for extreme risk
    }
    
    // Filter Safe Haven candidates
    const candidates = allMarkets.filter(market => {
        const marketKey = normalizeMarketKey(market.market || market.name);
        
        // Must be in Safe Haven list
        if (!SAFE_HAVEN_MARKETS.has(marketKey)) {
            return false;
        }
        
        // Must have confidence > main confidence
        const confidence = Number(market.confidence || 0);
        if (confidence <= mainConfidence) {
            return false;
        }
        
        // Must have confidence >= 75%
        if (confidence < 75) {
            return false;
        }
        
        return true;
    });
    
    if (candidates.length === 0) {
        return [];
    }
    
    // Best-in-Category selection
    const bestPerCategory = {};
    
    for (const market of candidates) {
        const marketKey = normalizeMarketKey(market.market || market.name);
        const category = getCategoryForMarket(marketKey);
        
        if (!category) {
            continue; // Skip uncategorized markets
        }
        
        const confidence = Number(market.confidence || 0);
        
        // Keep only the highest confidence market in each category
        if (!bestPerCategory[category] || confidence > bestPerCategory[category].confidence) {
            bestPerCategory[category] = {
                ...market,
                market: marketKey,
                confidence,
                category,
                source: 'safe_haven'
            };
        }
    }
    
    // Sort by confidence and take top 4
    const sortedMarkets = Object.values(bestPerCategory)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 4);
    
    return sortedMarkets;
}

/**
 * Check if Safe Haven fallback should be triggered
 * @param {number} mainConfidence - Main prediction confidence
 * @param {Array} secondaryMarkets - Existing secondary markets
 * @returns {boolean} Whether Safe Haven fallback should be triggered
 */
function shouldTriggerSafeHaven(mainConfidence, secondaryMarkets = []) {
    // Trigger if main confidence < 80%
    if (mainConfidence >= 80) {
        return false;
    }
    
    // And no secondary markets with confidence >= 80%
    const hasHighConfidenceSecondary = secondaryMarkets.some(market => 
        Number(market.confidence || 0) >= 80
    );
    
    return !hasHighConfidenceSecondary;
}

/**
 * Generate Safe Haven fallback message
 * @param {number} mainConfidence - Main prediction confidence
 * @returns {string} Fallback message
 */
function generateSafeHavenMessage(mainConfidence) {
    const riskLevel = getRiskLevel(mainConfidence);
    
    return `While the main market carries a ${riskLevel.toLowerCase()} level of confidence, here are safer markets that cross the low-risk threshold of 75%.`;
}

/**
 * Get risk level for confidence
 * @param {number} confidence - Confidence percentage
 * @returns {string} Risk level
 */
function getRiskLevel(confidence) {
    if (confidence >= 75) return 'Low Risk';
    if (confidence >= 55) return 'Medium Risk';
    if (confidence >= 30) return 'High Risk';
    return 'Extreme Risk';
}

/**
 * Get risk color for confidence
 * @param {number} confidence - Confidence percentage
 * @returns {string} Color name
 */
function getRiskColor(confidence) {
    if (confidence >= 75) return 'green';
    if (confidence >= 55) return 'yellow';
    if (confidence >= 30) return 'orange';
    return 'red'; // Extreme risk (not shown)
}

/**
 * Normalize market key
 * @param {string} market - Market identifier
 * @returns {string} Normalized market key
 */
function normalizeMarketKey(market) {
    return String(market || '').trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Complete secondary market selection with Safe Haven fallback
 * @param {number} mainConfidence - Main prediction confidence
 * @param {Array} allMarkets - All available market predictions
 * @returns {Object} Selection result with fallback info
 */
function selectSecondaryMarkets(mainConfidence, allMarkets = []) {
    // Primary rule: markets with confidence >= 80%
    const highConfidenceMarkets = allMarkets.filter(market => 
        Number(market.confidence || 0) >= 80
    );
    
    let selectedMarkets = [];
    let safeHavenTriggered = false;
    let fallbackMessage = null;
    
    if (highConfidenceMarkets.length > 0) {
        // Use primary rule with Best-in-Category
        selectedMarkets = selectSafeHavenMarkets(mainConfidence, highConfidenceMarkets);
    } else if (shouldTriggerSafeHaven(mainConfidence, [])) {
        // Use Safe Haven fallback
        selectedMarkets = selectSafeHavenMarkets(mainConfidence, allMarkets);
        safeHavenTriggered = true;
        fallbackMessage = generateSafeHavenMessage(mainConfidence);
    }
    
    return {
        secondary: selectedMarkets,
        safeHavenTriggered,
        fallbackMessage,
        mainConfidence,
        mainRiskLevel: getRiskLevel(mainConfidence),
        mainRiskColor: getRiskColor(mainConfidence)
    };
}

module.exports = {
    selectSafeHavenMarkets,
    shouldTriggerSafeHaven,
    generateSafeHavenMessage,
    selectSecondaryMarkets,
    getRiskLevel,
    getRiskColor,
    normalizeMarketKey,
    SAFE_HAVEN_MARKETS,
    MARKET_CATEGORIES
};
