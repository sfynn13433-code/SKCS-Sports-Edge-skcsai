/**
 * SKCS Gatekeeper Pipeline - Secondary Market Filtering
 * Strict enforcement of Secondary Insights market governance
 */

const SECONDARY_MARKET_ALLOWLIST = [
    // Double Chance
    'Double Chance 1X', 'Double Chance X2', 'Double Chance 12',
    'DC 1X', 'DC X2', 'DC 12',
    '1X', 'X2', '12',
    
    // Draw No Bet
    'Draw No Bet Home', 'Draw No Bet Away', 'DNB Home', 'DNB Away',
    'Home DNB', 'Away DNB',
    
    // Goals Totals
    'Over 0.5 Goals', 'Over 1.5 Goals', 'Over 2.5 Goals', 'Over 3.5 Goals',
    'Under 2.5 Goals', 'Under 3.5 Goals',
    'O 0.5', 'O 1.5', 'O 2.5', 'O 3.5',
    'U 2.5', 'U 3.5',
    
    // Team Totals
    'Home Over 0.5', 'Home Over 1.5', 'Away Over 0.5', 'Away Over 1.5',
    'Home O 0.5', 'Home O 1.5', 'Away O 0.5', 'Away O 1.5',
    'Home Team Over 0.5', 'Away Team Over 0.5',
    
    // BTTS
    'BTTS YES', 'BTTS NO', 'Both Teams To Score Yes', 'Both Teams To Score No',
    'BTTS & Over 2.5', 'BTTS & Under 3.5',
    'BTTS + O2.5', 'BTTS + U3.5',
    'Win & BTTS YES', 'Win & BTTS NO',
    
    // Defensive/Low Risk
    'Under 4.5 Goals', 'Over 1.5 Goals',
    'Home Team Over 0.5', 'Away Team Over 0.5',
    'Double Chance + Under 3.5', 'Double Chance + Over 1.5',
    'DC + U3.5', 'DC + O1.5',
    
    // Half Markets
    'Over 0.5 First Half', 'Under 1.5 First Half', 'First Half Draw',
    'FH Over 0.5', 'FH Under 1.5', 'FH Draw',
    'Home Win Either Half', 'Away Win Either Half',
    'Home Win 2nd Half', 'Away Win 2nd Half',
    
    // Corners
    'Over 6.5 Corners', 'Over 7.5 Corners', 'Over 8.5 Corners', 'Over 9.5 Corners', 
    'Over 10.5 Corners', 'Over 11.5 Corners', 'Over 12.5 Corners',
    'Under 7.5 Corners', 'Under 8.5 Corners', 'Under 9.5 Corners', 
    'Under 10.5 Corners', 'Under 11.5 Corners', 'Under 12.5 Corners',
    'Corners O 6.5', 'Corners O 7.5', 'Corners O 8.5', 'Corners O 9.5', 
    'Corners O 10.5', 'Corners O 11.5', 'Corners O 12.5',
    'Corners U 7.5', 'Corners U 8.5', 'Corners U 9.5',
    'Corners U 10.5', 'Corners U 11.5', 'Corners U 12.5',
    
    // Cards/Yellow Cards
    'Over 1.5 Yellow Cards', 'Over 2.5 Yellow Cards', 'Over 3.5 Yellow Cards', 
    'Over 4.5 Yellow Cards', 'Over 5.5 Yellow Cards', 'Over 6.5 Yellow Cards',
    'Under 1.5 Yellow Cards', 'Under 2.5 Yellow Cards', 'Under 3.5 Yellow Cards',
    'Under 4.5 Yellow Cards', 'Under 5.5 Yellow Cards', 'Under 6.5 Yellow Cards',
    'Cards O 1.5', 'Cards O 2.5', 'Cards O 3.5', 'Cards O 4.5', 'Cards O 5.5', 'Cards O 6.5',
    'Cards U 1.5', 'Cards U 2.5', 'Cards U 3.5', 'Cards U 4.5', 'Cards U 5.5', 'Cards U 6.5'
];

/**
 * Filter secondary markets according to strict governance rules
 * @param {Array} allGeneratedSecondaryMarkets - Raw markets from AI generation
 * @returns {Array} - Filtered and validated secondary markets
 */
function filterSecondaryMarkets(allGeneratedSecondaryMarkets) {
    if (!Array.isArray(allGeneratedSecondaryMarkets)) {
        return [];
    }
    
    // Step 1: Filter by confidence threshold (MUST be >= 76%)
    const highConfidenceMarkets = allGeneratedSecondaryMarkets.filter(market => {
        const confidence = typeof market === 'object' && market !== null 
            ? parseFloat(market.confidence) 
            : 50;
        return confidence >= 76;
    });
    
    // Step 2: Filter by allowlist
    const validMarkets = highConfidenceMarkets.filter(market => {
        const marketType = typeof market === 'object' && market !== null 
            ? (market.type || market.label || market.prediction || market.market || '')
            : String(market);
        
        return SECONDARY_MARKET_ALLOWLIST.some(allowed => 
            marketType.toLowerCase().includes(allowed.toLowerCase()) ||
            allowed.toLowerCase().includes(marketType.toLowerCase())
        );
    });
    
    // Step 3: Sort by confidence (highest first) and limit to MAX 4
    return validMarkets
        .sort((a, b) => {
            const confA = typeof a === 'object' ? parseFloat(a.confidence) : 50;
            const confB = typeof b === 'object' ? parseFloat(b.confidence) : 50;
            return confB - confA;
        })
        .slice(0, 4);
}

/**
 * Generate EdgeMind Bot Report narrative
 * Follows the SKCS Pipeline stages
 */
function generateEdgeMindReport(baselineProb, contextAdjustments, volatilityAdjustments, finalConfidence, prediction) {
    const confidence = parseFloat(finalConfidence) || 50;
    
    // Stage 1: Baseline
    let report = `📊 **Stage 1 (Baseline):** On paper, this match shows a ${baselineProb}% initial probability based on historical data and form analysis.`;
    
    // Stage 2: Deep Context
    if (contextAdjustments && contextAdjustments.length > 0) {
        report += `\n\n🧠 **Stage 2 (Deep Context):** After reviewing team intelligence, player availability, and head-to-head records:`;
        contextAdjustments.forEach(adj => {
            report += `\n   • ${adj}`;
        });
    }
    
    // Stage 3: Reality Check
    if (volatilityAdjustments && volatilityAdjustments.length > 0) {
        report += `\n\n🌦️ **Stage 3 (Reality Check):** External factors being factored in:`;
        volatilityAdjustments.forEach(factor => {
            report += `\n   • ${factor}`;
        });
    }
    
    // Stage 4: Decision Engine
    report += `\n\n🎯 **Stage 4 (Decision Engine):** Final confidence score: **${confidence}%**`;
    
    // Secondary Market Pivot (CRITICAL: 50-68% trigger)
    if (confidence >= 50 && confidence <= 68) {
        report += `\n\n⚠️ **ADVISORY:** The Direct 1X2 market at ${confidence}% is classified as HIGH RISK. The volatility is too high for a confident straight bet.`;
        report += `\n\n💡 **RECOMMENDATION:** Consider the Secondary Insights below - these have been filtered for markets with 76%+ confidence and represent much safer betting opportunities.`;
    }
    
    return report;
}

/**
 * Validate Direct Market (1X2) prediction
 * Must be between 50% and 75% confidence
 */
function validateDirectMarket(prediction) {
    const confidence = parseFloat(prediction.confidence) || 0;
    const allowedOutcomes = ['home', 'away', 'draw', '1', 'x', '2', 'home win', 'away win', 'draw'];
    
    if (confidence < 50 || confidence > 75) {
        return {
            valid: false,
            reason: `Direct market confidence ${confidence}% is outside allowed range (50-75%)`
        };
    }
    
    const outcome = (prediction.prediction || prediction.market || '').toLowerCase();
    const isValidOutcome = allowedOutcomes.some(o => outcome.includes(o));
    
    if (!isValidOutcome) {
        return {
            valid: false,
            reason: `Direct market outcome "${outcome}" is not in allowed 1X2 list`
        };
    }
    
    return { valid: true };
}

/**
 * Process complete prediction with governance rules
 */
function processPredictionWithGovernance(rawPrediction) {
    const result = {
        direct_market: null,
        secondary_insights: [],
        edgemind_report: null,
        warnings: []
    };
    
    // Validate and extract direct market
    const directValidation = validateDirectMarket(rawPrediction);
    if (directValidation.valid) {
        result.direct_market = rawPrediction;
    } else {
        result.warnings.push(directValidation.reason);
    }
    
    // Filter secondary markets
    const rawSecondary = rawPrediction.secondary_markets || [];
    result.secondary_insights = filterSecondaryMarkets(rawSecondary);
    
    // Generate EdgeMind report if we have a valid prediction
    if (result.direct_market) {
        result.edgemind_report = generateEdgeMindReport(
            rawPrediction.baseline_prob || 50,
            rawPrediction.context_adjustments || [],
            rawPrediction.volatility_adjustments || [],
            rawPrediction.confidence,
            rawPrediction
        );
    }
    
    return result;
}

module.exports = {
    SECONDARY_MARKET_ALLOWLIST,
    filterSecondaryMarkets,
    generateEdgeMindReport,
    validateDirectMarket,
    processPredictionWithGovernance
};
