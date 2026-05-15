// Master Rulebook Risk Classification Service
// Replaces old 59% thresholds with new 75%/55%/30% system

/**
 * Master Rulebook Risk Tier Classification
 * @param {number} confidence - Confidence percentage (0-100)
 * @returns {string} Risk tier classification
 */
function determineRiskTier(confidence) {
    if (!Number.isFinite(confidence)) return 'EXTREME_RISK';
    
    if (confidence >= 75) return 'LOW_RISK';
    if (confidence >= 55) return 'MEDIUM_RISK';
    if (confidence >= 30) return 'HIGH_RISK';
    return 'EXTREME_RISK';
}

/**
 * Master Rulebook Bet Recommendation
 * @param {number} confidence - Confidence percentage (0-100)
 * @returns {string} Bet recommendation
 */
function getBetRecommendation(confidence) {
    if (!Number.isFinite(confidence)) return 'AVOID';
    
    if (confidence >= 75) return 'STRONG_BET';
    if (confidence >= 55) return 'CONSIDER';
    if (confidence >= 30) return 'CAUTIOUS';
    return 'AVOID';
}

/**
 * Master Rulebook Risk Level for ACCA
 * @param {number} confidence - Confidence percentage (0-100)
 * @returns {number} Risk level (0=Low, 1=Medium, 2=High, 3=Extreme)
 */
function getAccaRiskLevel(confidence) {
    if (!Number.isFinite(confidence)) return 3;
    
    if (confidence >= 75) return 0; // Low Risk
    if (confidence >= 55) return 1; // Medium Risk
    if (confidence >= 30) return 2; // High Risk
    return 3; // Extreme Risk
}

/**
 * Check if prediction is in high risk band
 * @param {number} confidence - Confidence percentage (0-100)
 * @returns {boolean} True if in high risk band (30-54%)
 */
function isInHighRiskBand(confidence) {
    return Number.isFinite(confidence) && confidence >= 30 && confidence < 55;
}

/**
 * Check if prediction is in extreme risk band
 * @param {number} confidence - Confidence percentage (0-100)
 * @returns {boolean} True if in extreme risk band (<30%)
 */
function isInExtremeRiskBand(confidence) {
    return Number.isFinite(confidence) && confidence < 30;
}

/**
 * Check if prediction is in low risk band
 * @param {number} confidence - Confidence percentage (0-100)
 * @returns {boolean} True if in low risk band (≥75%)
 */
function isInLowRiskBand(confidence) {
    return Number.isFinite(confidence) && confidence >= 75;
}

/**
 * Check if prediction is in medium risk band
 * @param {number} confidence - Confidence percentage (0-100)
 * @returns {boolean} True if in medium risk band (55-74%)
 */
function isInMediumRiskBand(confidence) {
    return Number.isFinite(confidence) && confidence >= 55 && confidence < 75;
}

/**
 * Get risk color for UI display
 * @param {number} confidence - Confidence percentage (0-100)
 * @returns {string} Color class or hex code
 */
function getRiskColor(confidence) {
    if (!Number.isFinite(confidence)) return '#ef4444'; // red for extreme
    
    if (confidence >= 75) return '#4ade80'; // green
    if (confidence >= 55) return '#facc15'; // yellow
    if (confidence >= 30) return '#fb923c'; // orange
    return '#ef4444'; // red
}

/**
 * Get risk tier label for display
 * @param {number} confidence - Confidence percentage (0-100)
 * @returns {string} Human-readable risk tier label
 */
function getRiskTierLabel(confidence) {
    const tier = determineRiskTier(confidence);
    
    const labels = {
        'LOW_RISK': 'Low Risk',
        'MEDIUM_RISK': 'Medium Risk',
        'HIGH_RISK': 'High Risk',
        'EXTREME_RISK': 'Extreme Risk'
    };
    
    return labels[tier] || 'Unknown';
}

/**
 * Check if secondary markets are required
 * @param {number} confidence - Confidence percentage (0-100)
 * @returns {boolean} True if secondary markets should be shown
 */
function requiresSecondaryMarkets(confidence) {
    // Show secondary markets for all published predictions
    return Number.isFinite(confidence) && confidence >= 30;
}

/**
 * Check if Safe Haven fallback should be triggered
 * @param {number} mainConfidence - Main prediction confidence
 * @param {Array} secondaryMarkets - Array of secondary market predictions
 * @returns {boolean} True if Safe Haven should be triggered
 */
function shouldTriggerSafeHaven(mainConfidence, secondaryMarkets = []) {
    // Trigger if main confidence < 80% and no secondary markets ≥80%
    if (mainConfidence >= 80) return false;
    
    return !secondaryMarkets.some(market => (market.confidence || 0) >= 80);
}

/**
 * Filter Safe Haven eligible markets
 * @param {Array} markets - Array of market predictions
 * @param {number} mainConfidence - Main prediction confidence
 * @returns {Array} Filtered markets meeting Safe Haven criteria
 */
function filterSafeHavenMarkets(markets, mainConfidence) {
    const SAFE_HAVEN_MARKETS = new Set([
        'double_chance_1x', 'double_chance_x2', 'double_chance_12',
        'over_0_5', 'over_1_5', 'under_3_5', 'under_4_5',
        'btts_no',
        'corners_over_8_5', 'corners_over_9_5', 'corners_under_10_5', 'corners_under_11_5',
        'yellow_cards_over_2_5', 'yellow_cards_under_3_5',
        'first_half_over_0_5', 'first_half_under_1_5',
        'home_win_either_half', 'away_win_either_half'
    ]);
    
    return markets.filter(market => {
        const marketKey = String(market.market || market.prediction || '').toLowerCase().replace(/\s+/g, '_');
        const confidence = market.confidence || 0;
        
        return SAFE_HAVEN_MARKETS.has(marketKey) &&
               confidence > mainConfidence &&
               confidence >= 75;
    });
}

/**
 * Generate Master Rulebook AI report
 * @param {number} confidence - Confidence percentage (0-100)
 * @param {string} homeTeam - Home team name
 * @param {string} awayTeam - Away team name
 * @param {string} marketLabel - Market label (e.g., "Home Win")
 * @returns {string} AI report text
 */
function generateAIReport(confidence, homeTeam, awayTeam, marketLabel) {
    const tier = determineRiskTier(confidence);
    const conf = Math.round(confidence);
    
    switch (tier) {
        case 'LOW_RISK':
            return `Stage 1 (Baseline): On paper, ${homeTeam} shows a strong ${conf}% baseline probability. Stage 2 (Deep Context): Deep analysis confirms a formidable form advantage. Stage 3 (Reality Check): Conditions remain stable with minimal external volatility. Stage 4 (Decision Engine): Final confidence is ${conf}%. LOW RISK ${marketLabel} selection.`;
            
        case 'MEDIUM_RISK':
            return `Stage 1 (Baseline): On paper, ${homeTeam} has a fair ${conf}% baseline probability against ${awayTeam}. Stage 2 (Deep Context): Contextual data shows a moderate edge. Stage 3 (Reality Check): Standard sports volatility applies. Stage 4 (Decision Engine): Final confidence is ${conf}%. MEDIUM RISK ${marketLabel} selection.`;
            
        case 'HIGH_RISK':
            return `Stage 1 (Baseline): On paper, this is a tight matchup with a ${conf}% baseline probability. Stage 2 (Deep Context): Form data is heavily contested. Stage 3 (Reality Check): Reality check indicates high volatility and unstable conditions. Stage 4 (Decision Engine): Final confidence is ${conf}%. HIGH RISK. Consider secondary markets for alternative options.`;
            
        case 'EXTREME_RISK':
            return `Stage 1 (Baseline): On paper, there is no clear mathematical advantage (${conf}%). Stage 2 (Deep Context): Contextual indicators are weak for a direct outcome. Stage 3 (Reality Check): Extreme volatility detected in external factors. Stage 4 (Decision Engine): Final confidence is ${conf}%. EXTREME RISK. Primary prediction not recommended for betting.`;
            
        default:
            return `Stage 1 (Baseline): Unable to determine baseline probability. Stage 2 (Deep Context): Insufficient contextual data. Stage 3 (Reality Check): High uncertainty detected. Stage 4 (Decision Engine): Final confidence is ${conf}%. EXTREME RISK. Avoid betting on this fixture.`;
    }
}

/**
 * Update AI provider prompt with Master Rulebook rules
 * @returns {string} Updated AI provider instructions
 */
function getMasterRulebookPrompt() {
    return `IMPORTANT Direct 1X2 risk rules (Master Rulebook v2.0):
- 75-100%: Low Risk / Safe.
- 55-74%: Medium Risk. Consider secondary markets.
- 30-54%: High Risk. Advise user to consider secondary markets.
- 0-29%: Extreme Risk. Do NOT bet direct 1X2. Use Safe Haven secondary markets instead.

Safe Haven markets: Double Chance, Over/Under Goals, BTTS No, Corners, Cards, First Half markets, Team Win Either Half.

Output ONLY valid JSON with this exact structure:
{
  "market": "HOME_WIN|DRAW|AWAY_WIN",
  "confidence": number,
  "risk_tier": "LOW_RISK|MEDIUM_RISK|HIGH_RISK|EXTREME_RISK",
  "edgemind_report": "string",
  "secondary_markets": [
    {
      "market": "string",
      "confidence": number
    }
  ]
}`;
}

module.exports = {
    determineRiskTier,
    getBetRecommendation,
    getAccaRiskLevel,
    isInHighRiskBand,
    isInExtremeRiskBand,
    isInLowRiskBand,
    isInMediumRiskBand,
    getRiskColor,
    getRiskTierLabel,
    requiresSecondaryMarkets,
    shouldTriggerSafeHaven,
    filterSafeHavenMarkets,
    generateAIReport,
    getMasterRulebookPrompt
};
