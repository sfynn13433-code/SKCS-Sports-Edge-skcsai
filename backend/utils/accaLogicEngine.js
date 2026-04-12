'use strict';

/**
 * SKCS ACCA ENGINE — ACCA LOGIC LAYER
 *
 * Enforces:
 * - Strict multiplication probability
 * - 6-hour grace window
 * - New family caps per SKCS law
 * - Banned market filtering
 * - Confidence guardrails (72%-97%)
 * - Build order enforcement
 */

/* ==========================================================================
   1. TRUE COMBO MARKET MATH
   ========================================================================== */

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
        const raw = (a / 100) * (b / 100);
        const boosted = Math.min(0.98, raw + 0.15);
        return parseFloat((boosted * 100).toFixed(2));
    }

    // Low Correlation: Double Chance and Under
    const isDC = marketA.startsWith('DOUBLE_CHANCE') || marketB.startsWith('DOUBLE_CHANCE');
    const isSafeUnder = (marketA.startsWith('OVER_UNDER') && pickA === 'under') || (marketB.startsWith('OVER_UNDER') && pickB === 'under');

    if (isDC && isSafeUnder) {
        const avg = (a + b) / 2;
        const penalty = 5.0;
        return parseFloat(Math.max(0, avg - penalty).toFixed(2));
    }

    // Default: multiplication with slight correlation factor
    const standardMult = (a / 100) * (b / 100);
    const result = Math.min(0.95, standardMult * 1.1);
    return parseFloat((result * 100).toFixed(2));
}

/* ==========================================================================
   2. TICKET COMPOUND PROBABILITY — STRICT MULTIPLICATION (SKCS LAW SECTION 6)
   ========================================================================== */

function calculateTicketCompoundProbability(legs) {
    if (!legs || legs.length === 0) return 0;

    const validLegs = (Array.isArray(legs) ? legs : [])
        .filter((leg) => Number(leg?.confidence) > 0);

    if (!validLegs.length) return 0;

    // STRICT MULTIPLICATION only — no averaging, no boosting, no smoothing
    let product = 1.0;
    for (const leg of validLegs) {
        const confidence = clamp(Number(leg.confidence), 0, 100);
        product *= (confidence / 100);
    }

    return parseFloat((product * 100).toFixed(2));
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

/* ==========================================================================
   3. STRICT CHRONOLOGICAL FILTER (6-HOUR GRACE)
   ========================================================================== */

function filterExpiredFixtures(fixtures) {
    const currentUTC = new Date().getTime();
    const gracePeriod = 6 * 60 * 60 * 1000;
    let malformedDateCount = 0;

    return (Array.isArray(fixtures) ? fixtures : []).filter((fixture) => {
        if (!fixture) return false;

        const dateStr = fixture.date || fixture.kickoff || fixture.match_time ||
            fixture.startTime || fixture.kickoff_utc || fixture.commence_time ||
            fixture.metadata?.kickoff || fixture.metadata?.match_time;

        if (!dateStr) return true;

        const matchTime = new Date(dateStr).getTime();

        if (Number.isNaN(matchTime)) {
            malformedDateCount++;
            return true;
        }

        return matchTime > (currentUTC - gracePeriod);
    });
}

/* ==========================================================================
   4. MARKET NORMALIZATION (SKCS LAW — 7 ALLOWED FAMILIES ONLY)
   ========================================================================== */

const ALLOWED_FAMILIES = new Set([
    'result', 'double_chance', 'totals', 'btts',
    'team_goals', 'corners', 'cards',
]);

const BANNED_PATTERNS = [
    'exact_score', 'correct_score', 'player', 'clean_sheet',
    'win_to_nil', 'red_card', 'penalty', 'var', 'winning_margin',
    'method_of_victory', 'scorer', 'shots',
];

function normalizeMarketFamily(type) {
    const value = String(type || '').toLowerCase();

    // Banned check
    for (const pattern of BANNED_PATTERNS) {
        if (value.includes(pattern)) return null;
    }

    if (value.includes('draw_no_bet') || value.includes('dnb')) return 'result';
    if (value.includes('double_chance')) return 'double_chance';
    if (value.includes('team_total') || value.includes('team_goals')) return 'team_goals';
    if (value.includes('over') || value.includes('under') || value.includes('totals')) return 'totals';
    if (value.includes('btts')) return 'btts';
    if (value.includes('corner')) return 'corners';
    if (value.includes('card') || value.includes('yellow')) return 'cards';
    if (value.includes('1x2') || value.includes('match_result') || value.includes('winner')) return 'result';
    if (value.includes('combo')) return null; // Combos banned under SKCS law
    if (value.includes('handicap') || value.includes('asian')) return null; // Not in allowed list

    return null;
}

/* ==========================================================================
   5. FAMILY CAPS (SKCS LAW — SECTION 3)
   ========================================================================== */

const FAMILY_CAPS_6 = {
    result: 1,
    double_chance: 1,
    totals: 2,
    btts: 1,
    team_goals: 1,
    corners: 1,
    cards: 0,  // corners OR cards combined max 1
};

const FAMILY_CAPS_12 = {
    result: 2,
    double_chance: 2,
    totals: 3,
    btts: 2,
    team_goals: 1,
    corners: 2,
    cards: 1,
};

/* ==========================================================================
   6. CONFIDENCE GUARDRAILS (72%-97%)
   ========================================================================== */

const MIN_CONFIDENCE = 72;
const MAX_CONFIDENCE = 97;

function isValidConfidence(confidence) {
    const c = Number(confidence);
    return Number.isFinite(c) && c >= MIN_CONFIDENCE && c <= MAX_CONFIDENCE;
}

/* ==========================================================================
   7. BUILD ORDER (SKCS LAW — SECTION 9)
   ========================================================================== */

const BUILD_ORDER = ['result', 'double_chance', 'totals', 'btts', 'team_goals', 'corners', 'cards'];

/* ==========================================================================
   8. LEG SELECTION WITH SKCS LAW ENFORCEMENT
   ========================================================================== */

function selectAccaLegs(availableFixtures, globalUsedFixtures, targetLegCount, options = {}) {
    const familyCaps = targetLegCount >= 12 ? { ...FAMILY_CAPS_12 } : { ...FAMILY_CAPS_6 };
    const familyCounts = {};
    const selectedLegs = [];
    const usedSet = globalUsedFixtures instanceof Set ? globalUsedFixtures : new Set();

    let stats = {
        bannedMarketsRemoved: 0,
        confidenceOutOfRange: 0,
        familyCapEnforced: 0,
        dedupeSkipped: 0,
    };

    for (const fixture of Array.isArray(availableFixtures) ? availableFixtures : []) {
        if (selectedLegs.length >= targetLegCount) break;
        if (!fixture || !fixture.id) continue;
        if (usedSet.has(fixture.id)) {
            stats.dedupeSkipped++;
            continue;
        }

        const markets = Array.isArray(fixture.scoredMarkets) ? fixture.scoredMarkets : [];
        markets.sort((a, b) => Number(b?.confidence || 0) - Number(a?.confidence || 0));

        // Try markets in build order preference
        for (const preferredFamily of BUILD_ORDER) {
            let found = false;
            for (const market of markets) {
                if (!market || !market.confidence || !market.type) continue;

                // Banned market check
                const family = normalizeMarketFamily(market.type);
                if (!family || !ALLOWED_FAMILIES.has(family)) {
                    stats.bannedMarketsRemoved++;
                    continue;
                }

                // Must match preferred family in this pass
                if (family !== preferredFamily) continue;

                // Confidence guardrails
                if (!isValidConfidence(market.confidence)) {
                    stats.confidenceOutOfRange++;
                    continue;
                }

                // Family cap
                if ((familyCounts[family] || 0) >= (familyCaps[family] ?? Infinity)) {
                    stats.familyCapEnforced++;
                    continue;
                }

                // Corners/cards combined cap for 6-leg
                if (targetLegCount < 12) {
                    const ccTotal = (familyCounts.corners || 0) + (familyCounts.cards || 0);
                    if ((family === 'corners' || family === 'cards') && ccTotal >= 1) continue;
                }

                selectedLegs.push({
                    fixture_id: fixture.id,
                    match_name: fixture.name || 'Unknown Match',
                    sport: fixture.sport || 'Unknown Sport',
                    market: market.name || market.market || 'Unknown Market',
                    prediction: market.prediction || market.pick || 'Unknown',
                    confidence: Number(market.confidence),
                    market_type: market.type,
                    market_family: family,
                });

                familyCounts[family] = (familyCounts[family] || 0) + 1;
                usedSet.add(fixture.id);
                found = true;
                break;
            }
            if (found) break;
        }

        // If build order pass didn't find anything, do a general pass
        if (selectedLegs.length < targetLegCount && !usedSet.has(fixture.id)) {
            for (const market of markets) {
                if (!market || !market.confidence || !market.type) continue;
                if (usedSet.has(fixture.id)) break;

                const family = normalizeMarketFamily(market.type);
                if (!family || !ALLOWED_FAMILIES.has(family)) continue;
                if (!isValidConfidence(market.confidence)) continue;
                if ((familyCounts[family] || 0) >= (familyCaps[family] ?? Infinity)) continue;

                if (targetLegCount < 12) {
                    const ccTotal = (familyCounts.corners || 0) + (familyCounts.cards || 0);
                    if ((family === 'corners' || family === 'cards') && ccTotal >= 1) continue;
                }

                selectedLegs.push({
                    fixture_id: fixture.id,
                    match_name: fixture.name || 'Unknown Match',
                    sport: fixture.sport || 'Unknown Sport',
                    market: market.name || market.market || 'Unknown Market',
                    prediction: market.prediction || market.pick || 'Unknown',
                    confidence: Number(market.confidence),
                    market_type: market.type,
                    market_family: family,
                });

                familyCounts[family] = (familyCounts[family] || 0) + 1;
                usedSet.add(fixture.id);
                break;
            }
        }
    }

    selectedLegs.stats = stats;
    selectedLegs.familyBreakdown = { ...familyCounts };

    return selectedLegs;
}

module.exports = {
    calculateTrueComboConfidence,
    calculateTicketCompoundProbability,
    filterExpiredFixtures,
    normalizeMarketFamily,
    selectAccaLegs,
    isValidConfidence,
    MIN_CONFIDENCE,
    MAX_CONFIDENCE,
    FAMILY_CAPS_6,
    FAMILY_CAPS_12,
    BUILD_ORDER,
    ALLOWED_FAMILIES,
    BANNED_PATTERNS,
};
