'use strict';

/**
 * CRITICAL UPDATE: ACCA Math and Logic Utilities
 * Integrate these functions into the main ACCA builder flow.
 */

// 1. TRUE COMBO MARKET MATH
// Calculates the intersection probability of two mutually exclusive events
function calculateTrueComboConfidence(probA, probB) {
    if (!probA || !probB) return 0;
    // Example: 90% Win * 80% Under 2.5 = 72% True Confidence
    const comboConfidence = (Number(probA) / 100) * (Number(probB) / 100) * 100;
    return parseFloat(comboConfidence.toFixed(2));
}

// 2. TICKET COMPOUND PROBABILITY
// Calculates the actual probability of a 6-leg or 12-leg ticket hitting
function calculateTicketCompoundProbability(legs) {
    if (!legs || legs.length === 0) return 0;
    let totalProbability = 1.0;

    legs.forEach((leg) => {
        totalProbability *= (Number(leg?.confidence || 0) / 100);
    });

    return parseFloat((totalProbability * 100).toFixed(2));
}

// 3. STRICT CHRONOLOGICAL FILTER (WITH SAFETY FALLBACKS)
// Prevents time-travel, but includes robust parsing to prevent deleting all data
function filterExpiredFixtures(fixtures) {
    const currentUTC = new Date().getTime();
    // 24-hour grace period to prevent timezone mismatches from deleting today's fixtures
    const gracePeriod = 24 * 60 * 60 * 1000;

    return (Array.isArray(fixtures) ? fixtures : []).filter((fixture) => {
        if (!fixture) return false;

        // Check multiple possible date fields
        const dateStr = fixture.date || fixture.kickoff || fixture.match_time || fixture.startTime;

        // Safety: If the API didn't provide a date, keep the fixture rather than crashing the ACCA builder
        if (!dateStr) return true;

        const matchTime = new Date(dateStr).getTime();

        // Safety: If the date format is unparseable (NaN), keep it rather than deleting it
        if (Number.isNaN(matchTime)) return true;

        return matchTime > (currentUTC - gracePeriod);
    });
}

// 4. LEG SELECTION WITH CAPS, GLOBAL DEDUPLICATION, & STRICT MARKET VARIETY
function selectAccaLegs(availableFixtures, globalUsedFixtures, targetLegCount) {
    const selectedLegs = [];
    let comboCount = 0;
    const marketTypeCounts = {}; // Track usage of market types to force variety

    const MAX_COMBOS = targetLegCount === 12 ? 4 : 2;
    // Max times the SAME market type (e.g., '1x2' or 'over_under') can appear in a single ticket
    const MAX_SAME_MARKET_TYPE = targetLegCount === 12 ? 3 : 2;
    const MIN_CONFIDENCE = 80.00;
    const usedSet = globalUsedFixtures instanceof Set ? globalUsedFixtures : new Set();

    for (const fixture of Array.isArray(availableFixtures) ? availableFixtures : []) {
        if (selectedLegs.length >= targetLegCount) break;

        // Safety check for fixture ID
        if (!fixture || !fixture.id) continue;

        // GLOBAL DEDUPLICATION: Skip if used in ANY previous ticket
        if (usedSet.has(fixture.id)) continue;

        let bestLeg = null;

        // Evaluate all markets in dictionary safely
        const markets = Array.isArray(fixture.scoredMarkets) ? fixture.scoredMarkets : [];

        // Sort markets by true confidence descending
        markets.sort((a, b) => Number(b?.confidence || 0) - Number(a?.confidence || 0));

        for (const market of markets) {
            if (!market || !market.confidence || !market.type) continue;

            // Ignore low confidence
            if (Number(market.confidence) < MIN_CONFIDENCE) continue;

            const marketType = String(market.type || '').toLowerCase();
            const isCombo = marketType.includes('combo') || marketType.includes('+');

            // Enforce Condition Bloat Cap (Max Combos per ticket)
            if (isCombo && comboCount >= MAX_COMBOS) {
                continue; // Skip combo, search for single market (DNB, AH)
            }

            // Enforce Market Variety Cap (Stop spamming the exact same market type)
            // Normalizes market.type by stripping "combo_" prefix to group them broadly
            const baseType = marketType.replace(/combo_/g, '').trim();
            if ((marketTypeCounts[baseType] || 0) >= MAX_SAME_MARKET_TYPE) {
                continue; // Cap reached, forces AI to look at DNB, AH, Corners, etc.
            }

            bestLeg = {
                fixture_id: fixture.id,
                match_name: fixture.name || 'Unknown Match',
                sport: fixture.sport || 'Unknown Sport',
                market: market.name || market.market || 'Unknown Market',
                prediction: market.prediction || market.pick || 'Unknown',
                confidence: Number(market.confidence),
                market_type: baseType
            };

            if (isCombo) comboCount++;
            marketTypeCounts[baseType] = (marketTypeCounts[baseType] || 0) + 1;
            break; // Found the best, valid, diverse market for this fixture
        }

        if (bestLeg) {
            selectedLegs.push(bestLeg);
            usedSet.add(fixture.id); // LOCK FIXTURE GLOBALLY
        }
    }

    return selectedLegs;
}

module.exports = {
    calculateTrueComboConfidence,
    calculateTicketCompoundProbability,
    filterExpiredFixtures,
    selectAccaLegs
};
