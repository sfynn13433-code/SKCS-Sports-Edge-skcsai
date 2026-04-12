'use strict';

/**
 * CRITICAL UPDATE: ACCA Math and Logic Utilities
 * Shared by accaBuilder and marketScoringEngine.
 */

// 1. TRUE COMBO MARKET MATH
// Calculates the intersection probability of two mutually exclusive events
function calculateTrueComboConfidence(probA, probB) {
    const a = Number(probA);
    const b = Number(probB);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    // Example: 90% Win * 80% Under 2.5 = 72% True Confidence
    const comboConfidence = (a / 100) * (b / 100) * 100;
    return parseFloat(comboConfidence.toFixed(2));
}

// 2. TICKET COMPOUND PROBABILITY
// Calculates the actual probability of a 6-leg or 12-leg ticket hitting
function calculateTicketCompoundProbability(legs) {
    if (!Array.isArray(legs) || legs.length === 0) return 0;
    let totalProbability = 1.0;

    legs.forEach((leg) => {
        const confidence = Number(leg?.confidence);
        totalProbability *= Number.isFinite(confidence) ? (confidence / 100) : 0;
    });

    return parseFloat((totalProbability * 100).toFixed(2));
}

// 3. STRICT CHRONOLOGICAL FILTER
// Prevents time-travel by ensuring matches are strictly in the future
function filterExpiredFixtures(fixtures) {
    const currentUTC = Date.now();
    const rows = Array.isArray(fixtures) ? fixtures : [];
    return rows.filter((fixture) => {
        const fallbackMetadata = fixture?.metadata || {};
        const rawTime = fixture?.date
            || fixture?.kickoff
            || fixture?.kickoff_utc
            || fixture?.match_time
            || fallbackMetadata.match_time
            || fallbackMetadata.kickoff
            || fallbackMetadata.kickoff_time;
        const matchTime = new Date(rawTime).getTime();
        return Number.isFinite(matchTime) && matchTime > currentUTC;
    });
}

function isComboMarketType(market) {
    const marketType = String(market?.type || '').toLowerCase();
    const marketName = String(market?.name || market?.market || '').toLowerCase();
    const prediction = String(market?.prediction || '').toLowerCase();
    return marketType.includes('combo')
        || marketType.includes('+')
        || marketName.includes('combo')
        || prediction.includes('+');
}

function normalizeFixtureId(fixture) {
    return String(fixture?.id || fixture?.fixture_id || fixture?.match_id || '').trim();
}

// 4. LEG SELECTION WITH CAPS & GLOBAL DEDUPLICATION
// Forces the use of Asian Handicaps/DNB when combo caps are reached
function selectAccaLegs(availableFixtures, globalUsedFixtures, targetLegCount) {
    const selectedLegs = [];
    let comboCount = 0;
    const MAX_COMBOS = Number(targetLegCount) === 12 ? 4 : 2;
    const MIN_CONFIDENCE = 80.00;
    const usedSet = globalUsedFixtures instanceof Set ? globalUsedFixtures : new Set();
    const fixtures = Array.isArray(availableFixtures) ? availableFixtures : [];

    for (const fixture of fixtures) {
        if (selectedLegs.length >= targetLegCount) break;

        const fixtureId = normalizeFixtureId(fixture);
        if (!fixtureId) continue;

        // GLOBAL DEDUPLICATION: Skip if used in ANY previous ticket
        if (usedSet.has(fixtureId)) continue;

        let bestLeg = null;

        // Evaluate all markets in dictionary (requires marketScoringEngine integration)
        const markets = Array.isArray(fixture?.scoredMarkets) ? fixture.scoredMarkets.slice() : [];

        // Sort markets by true confidence descending
        markets.sort((a, b) => Number(b?.confidence || 0) - Number(a?.confidence || 0));

        for (const market of markets) {
            const confidence = Number(market?.confidence);
            if (!Number.isFinite(confidence) || confidence < MIN_CONFIDENCE) continue;

            const isCombo = isComboMarketType(market);

            // Enforce Condition Bloat Cap
            if (isCombo && comboCount >= MAX_COMBOS) {
                continue; // Skip combo, keep searching for single market (DNB, AH, 1x2)
            }

            bestLeg = {
                fixture_id: fixtureId,
                match_name: fixture?.name || `${fixture?.home_team || ''} vs ${fixture?.away_team || ''}`.trim() || null,
                sport: fixture?.sport || null,
                market: market?.name || market?.market || null,
                prediction: market?.prediction || market?.pick || null,
                confidence
            };

            if (isCombo) comboCount += 1;
            break; // Found the best valid market for this fixture
        }

        if (bestLeg) {
            selectedLegs.push(bestLeg);
            usedSet.add(fixtureId); // LOCK FIXTURE GLOBALLY
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
