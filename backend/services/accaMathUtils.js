'use strict';

/**
 * CRITICAL UPDATE: ACCA Math and Logic Utilities
 * Shared by accaBuilder and marketScoringEngine.
 */

// 1. TRUE COMBO MARKET MATH
// Calculates the intersection probability of two mutually exclusive events
function calculateTrueComboConfidence(probA, probB) {
    if (!probA || !probB) return 0;
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
    if (!legs || legs.length === 0) return 0;
    let totalProbability = 1.0;

    legs.forEach((leg) => {
        const confidence = Number(leg?.confidence);
        totalProbability *= Number.isFinite(confidence) ? (confidence / 100) : 0;
    });

    return parseFloat((totalProbability * 100).toFixed(2));
}

// 3. STRICT CHRONOLOGICAL FILTER (WITH SAFETY FALLBACKS)
// Prevents time-travel, but includes robust parsing to prevent deleting all data
function filterExpiredFixtures(fixtures) {
    const currentUTC = new Date().getTime();
    // 24-hour grace period to prevent timezone mismatches from deleting today's fixtures
    const gracePeriod = 24 * 60 * 60 * 1000;
    const rows = Array.isArray(fixtures) ? fixtures : [];

    return rows.filter((fixture) => {
        if (!fixture) return false;

        // Check multiple possible date fields
        const fallbackMetadata = fixture?.metadata || {};
        const dateStr = fixture.date
            || fixture.kickoff
            || fixture.match_time
            || fixture.startTime
            || fixture.kickoff_utc
            || fallbackMetadata.match_time
            || fallbackMetadata.kickoff
            || fallbackMetadata.kickoff_time;

        // Safety: If the API didn't provide a date, keep the fixture rather than crashing the ACCA builder
        if (!dateStr) return true;

        const matchTime = new Date(dateStr).getTime();

        // Safety: If the date format is unparseable (NaN), keep it rather than deleting it
        if (Number.isNaN(matchTime)) return true;

        return matchTime > (currentUTC - gracePeriod);
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

// 4. LEG SELECTION WITH CAPS & GLOBAL DEDUPLICATION
// Forces the use of Asian Handicaps/DNB when combo caps are reached
function selectAccaLegs(availableFixtures, globalUsedFixtures, targetLegCount) {
    const selectedLegs = [];
    let comboCount = 0;
    const MAX_COMBOS = targetLegCount === 12 ? 4 : 2;
    const MIN_CONFIDENCE = 80.00;
    const usedSet = globalUsedFixtures instanceof Set ? globalUsedFixtures : new Set();
    const fixtures = Array.isArray(availableFixtures) ? availableFixtures : [];

    for (const fixture of fixtures) {
        if (selectedLegs.length >= targetLegCount) break;

        // Safety check for fixture ID
        const fixtureId = fixture?.id || fixture?.fixture_id || fixture?.match_id;
        if (!fixtureId) continue;

        // GLOBAL DEDUPLICATION: Skip if used in ANY previous ticket
        if (usedSet.has(fixtureId)) continue;

        let bestLeg = null;

        // Evaluate all markets in dictionary (requires marketScoringEngine integration)
        const markets = Array.isArray(fixture?.scoredMarkets) ? fixture.scoredMarkets : [];

        // Sort markets by true confidence descending
        markets.sort((a, b) => Number(b?.confidence || 0) - Number(a?.confidence || 0));

        for (const market of markets) {
            if (!market || !market.confidence || !market.type) continue;
            const confidence = Number(market.confidence);
            if (!Number.isFinite(confidence)) continue;

            const isCombo = isComboMarketType(market);

            // Enforce Condition Bloat Cap
            if (isCombo && comboCount >= MAX_COMBOS) {
                continue; // Skip combo, keep searching for single market (DNB, AH, 1x2)
            }

            // Ignore low confidence
            if (confidence < MIN_CONFIDENCE) continue;

            bestLeg = {
                fixture_id: fixtureId,
                match_name: fixture?.name || 'Unknown Match',
                sport: fixture?.sport || 'Unknown Sport',
                market: market?.name || market?.market || 'Unknown Market',
                prediction: market?.prediction || market?.pick || 'Unknown',
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
