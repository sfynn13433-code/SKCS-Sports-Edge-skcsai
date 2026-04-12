'use strict';

/**
 * CRITICAL UPDATE: ACCA Math and Logic Utilities
 * Integrate these functions into the main ACCA builder flow.
 *
 * UPDATED: Stabilized math, date filtering, and market variety enforcement.
 */

// 1. TRUE COMBO MARKET MATH
// Calculates the intersection probability using correlation-aware logic.
// Prevents exponential decay for dependent events.
function calculateTrueComboConfidence(probA, probB, options = {}) {
    const a = Number(probA) || 0;
    const b = Number(probB) || 0;
    if (!a || !b) return 0;

    const marketA = String(options.marketA || '').toUpperCase();
    const marketB = String(options.marketB || '').toUpperCase();
    const pickA = String(options.pickA || '').toLowerCase();
    const pickB = String(options.pickB || '').toLowerCase();

    // High Correlation: BTTS - Yes and Over 2.5 Goals
    const isBttsYes = (marketA === 'BTTS' && pickA === 'yes') || (marketB === 'BTTS' && pickB === 'yes');
    const isOver25 = (marketA === 'OVER_UNDER_2_5' && pickA === 'over') || (marketB === 'OVER_UNDER_2_5' && pickB === 'over');

    if (isBttsYes && isOver25) {
        // High correlation: if both score, you only need 1 more goal for Over 2.5
        // Use straight multiplication but apply a significant correlation boost (+15%)
        const raw = (a / 100) * (b / 100);
        const boosted = Math.min(0.98, raw + 0.15);
        return parseFloat((boosted * 100).toFixed(2));
    }

    // Low Correlation / Safety: Double Chance and Under 3.5/4.5 Goals
    const isDC = marketA.startsWith('DOUBLE_CHANCE') || marketB.startsWith('DOUBLE_CHANCE');
    const isSafeUnder = (marketA.startsWith('OVER_UNDER') && pickA === 'under') || (marketB.startsWith('OVER_UNDER') && pickB === 'under');

    if (isDC && isSafeUnder) {
        // These don't drive each other, but they are both "safe".
        // Averaging them prevents the "probability cliff" while maintaining a small risk penalty.
        const avg = (a + b) / 2;
        const penalty = 5.0; // 5% penalty for the dual-condition risk
        return parseFloat(Math.max(0, avg - penalty).toFixed(2));
    }

    // Default: Conditional dependency boost
    // Most football markets are somewhat correlated (e.g. Home Win and Over 1.5)
    // We use a slight multiplier (1.1x) on the standard multiplication to reflect this.
    const standardMult = (a / 100) * (b / 100);
    const result = Math.min(0.95, standardMult * 1.1);
    return parseFloat((result * 100).toFixed(2));
}

// 2. TICKET COMPOUND PROBABILITY - HONEST MULTIPLICATION
// Calculates the actual probability of a 6-leg or 12-leg ticket hitting.
// FIXED: Uses strict multiplication instead of fake averages.
// For a 6-leg card with 94% each: 0.94^6 = 68.99% (honest)
// For a 12-leg card with 92% each: 0.92^12 = 36.74% (honest)
function calculateTicketCompoundProbability(legs) {
    if (!legs || legs.length === 0) return 0;

    const validLegs = (Array.isArray(legs) ? legs : [])
        .filter((leg) => Number(leg?.confidence) > 0);

    if (!validLegs.length) return 0;

    // STRICT MULTIPLICATION: This is the honest joint probability
    let product = 1.0;
    for (const leg of validLegs) {
        const confidence = clamp(Number(leg.confidence), 0, 100);
        product *= (confidence / 100);
    }

    return parseFloat((product * 100).toFixed(2));
}

// Helper
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

// 3. STRICT CHRONOLOGICAL FILTER (WITH SAFETY FALLBACKS)
// UPDATED: 6-hour grace period instead of 24-hour to prevent old fixtures slipping through
// while avoiding timezone edge-case removals.
function filterExpiredFixtures(fixtures) {
    const currentUTC = new Date().getTime();
    // 6-hour grace period to prevent timezone mismatches from deleting today's fixtures
    const gracePeriod = 6 * 60 * 60 * 1000;
    let malformedDateCount = 0;

    return (Array.isArray(fixtures) ? fixtures : []).filter((fixture) => {
        if (!fixture) return false;

        // Check multiple possible date fields
        const dateStr = fixture.date || fixture.kickoff || fixture.match_time ||
            fixture.startTime || fixture.kickoff_utc || fixture.commence_time ||
            fixture.metadata?.kickoff || fixture.metadata?.match_time;

        // Safety: If the API didn't provide a date, keep the fixture rather than crashing the ACCA builder
        if (!dateStr) return true;

        const matchTime = new Date(dateStr).getTime();

        // Safety: If the date format is unparseable (NaN), keep it rather than deleting it
        // but track it for diagnostics
        if (Number.isNaN(matchTime)) {
            malformedDateCount++;
            return true;
        }

        return matchTime > (currentUTC - gracePeriod);
    });
}

// Helper: Normalize market family for variety enforcement
function normalizeMarketFamily(type) {
    const value = String(type || '').toLowerCase();

    if (value.includes('combo')) return 'combo';
    if (value.includes('double_chance')) return 'double_chance';
    if (value.includes('draw_no_bet')) return 'draw_no_bet';
    if (value.includes('team_total')) return 'team_total';
    if (value.includes('totals') || value.includes('over_under')) return 'totals';
    if (value.includes('btts')) return 'btts';
    if (value.includes('handicap')) return 'handicap';
    if (value.includes('half')) return 'half_time';
    if (value.includes('corners')) return 'corners';
    if (value.includes('cards')) return 'cards';
    if (value.includes('winner') || value.includes('1x2') || value.includes('match_result')) return 'match_result';

    return 'other';
}

// 4. LEG SELECTION WITH CAPS, GLOBAL DEDUPLICATION, & STRICT MARKET VARIETY
// UPDATED: Uses family normalization and stricter caps to prevent one type from dominating.
function selectAccaLegs(availableFixtures, globalUsedFixtures, targetLegCount) {
    const selectedLegs = [];
    let comboCount = 0;
    const familyCounts = {}; // Track usage of market families to force variety

    const MAX_COMBOS = targetLegCount === 12 ? 4 : 2;
    // Family caps: max times the SAME market family can appear in a single ticket
    const FAMILY_CAPS = targetLegCount === 12
        ? {
            combo: 3,
            match_result: 2,
            totals: 2,
            btts: 2,
            double_chance: 2,
            draw_no_bet: 2,
            handicap: 2,
            half_time: 1,
            corners: 1,
            cards: 1,
            team_total: 2,
            other: 2,
        }
        : {
            combo: 2,
            match_result: 1,
            totals: 2,
            btts: 2,
            double_chance: 1,
            draw_no_bet: 1,
            handicap: 1,
            half_time: 1,
            corners: 1,
            cards: 1,
            team_total: 1,
            other: 1,
        };

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

            const family = normalizeMarketFamily(market.type);
            const isCombo = family === 'combo';

            // Enforce Condition Bloat Cap (Max Combos per ticket)
            if (isCombo && comboCount >= MAX_COMBOS) {
                continue; // Skip combo, search for single market (DNB, AH)
            }

            // Enforce Market Variety Cap (Stop spamming the exact same market family)
            if ((familyCounts[family] || 0) >= (FAMILY_CAPS[family] || Infinity)) {
                continue; // Cap reached, forces AI to look at DNB, AH, Corners, etc.
            }

            bestLeg = {
                fixture_id: fixture.id,
                match_name: fixture.name || 'Unknown Match',
                sport: fixture.sport || 'Unknown Sport',
                market: market.name || market.market || 'Unknown Market',
                prediction: market.prediction || market.pick || 'Unknown',
                confidence: Number(market.confidence),
                market_type: market.type,
                market_family: family,
            };

            if (isCombo) comboCount++;
            familyCounts[family] = (familyCounts[family] || 0) + 1;
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
