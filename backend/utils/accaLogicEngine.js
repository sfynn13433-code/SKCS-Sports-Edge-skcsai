'use strict';

/**
 * ACCA math + leg selection utilities.
 *
 * Design goals:
 * - True combo math (intersection probability only).
 * - True ticket math (strict compound multiplication).
 * - Enforce 80% floor for leg selection.
 * - Preserve market variety and cap condition bloat.
 * - Avoid "junk value" auto-picks like obvious Over 0.5 / Over 1.5 traps.
 */

const MIN_CONFIDENCE = 80;
const MAX_CONFIDENCE = 99;

const BANNED_PATTERNS = [
    'exact_score',
    'correct_score',
    'player',
    'clean_sheet',
    'win_to_nil',
    'red_card',
    'penalty',
    'var',
    'winning_margin',
    'method_of_victory',
    'first_scorer',
    'last_scorer',
    'shots'
];

const ALLOWED_FAMILIES = new Set([
    'result',
    'double_chance',
    'draw_no_bet',
    'totals',
    'btts',
    'team_goals',
    'handicap',
    'ht_ft',
    'corners',
    'cards',
    'combo'
]);

const FAMILY_CAPS_6 = {
    result: 2,
    double_chance: 2,
    draw_no_bet: 2,
    totals: 2,
    btts: 2,
    team_goals: 2,
    handicap: 2,
    ht_ft: 1,
    corners: 1,
    cards: 1,
    combo: 2
};

const FAMILY_CAPS_12 = {
    result: 3,
    double_chance: 3,
    draw_no_bet: 3,
    totals: 3,
    btts: 3,
    team_goals: 3,
    handicap: 3,
    ht_ft: 2,
    corners: 2,
    cards: 2,
    combo: 4
};

const BUILD_ORDER = [
    'combo',
    'double_chance',
    'draw_no_bet',
    'handicap',
    'team_goals',
    'btts',
    'totals',
    'result',
    'ht_ft',
    'corners',
    'cards'
];

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function isComboMarket(market = {}) {
    const joined = `${market?.type || ''} ${market?.name || ''} ${market?.market || ''}`.toLowerCase();
    return joined.includes('combo') || joined.includes('+');
}

function parseGoalLineFromMarket(market = {}) {
    const raw = `${market?.name || market?.market || ''}`.toLowerCase();
    const prediction = `${market?.prediction || market?.pick || ''}`.toLowerCase();
    const joined = `${raw} ${prediction}`;
    const match = joined.match(/(\d+)[._](\d+)/);
    if (!match) return null;
    const line = Number(`${match[1]}.${match[2]}`);
    return Number.isFinite(line) ? line : null;
}

function normalizeMarketFamily(value) {
    const raw = String(value || '').toLowerCase();
    if (!raw) return null;

    for (const pattern of BANNED_PATTERNS) {
        if (raw.includes(pattern)) return null;
    }

    if (raw.includes('combo') || raw.includes('+')) return 'combo';
    if (raw.includes('draw_no_bet') || raw.includes('dnb')) return 'draw_no_bet';
    if (raw.includes('double_chance') || raw.startsWith('dc_')) return 'double_chance';
    if (raw.includes('team_total') || raw.includes('team_goals')) return 'team_goals';
    if (raw.includes('asian_handicap') || raw.includes('european_handicap') || raw.includes('handicap')) return 'handicap';
    if (raw.includes('btts')) return 'btts';
    if (raw.includes('ht_ft') || raw.includes('half-time/full-time')) return 'ht_ft';
    if (raw.includes('corner')) return 'corners';
    if (raw.includes('card') || raw.includes('yellow')) return 'cards';
    if (
        raw.includes('over_under')
        || raw.includes('over_')
        || raw.includes('under_')
        || raw.includes('total_goals')
        || raw.includes('total_points')
        || raw.includes('total_runs')
    ) {
        return 'totals';
    }
    if (raw.includes('1x2') || raw.includes('match_result') || raw.includes('match_winner') || raw.includes('winner')) {
        return 'result';
    }

    return null;
}

function normalizeMarketTypeForVariety(market = {}) {
    const raw = `${market?.type || ''} ${market?.name || ''} ${market?.market || ''}`.toLowerCase();

    if (raw.includes('combo') || raw.includes('+')) return 'combo';
    if (raw.includes('double_chance') || raw.includes('dc_')) return 'double_chance';
    if (raw.includes('draw_no_bet') || raw.includes('dnb')) return 'draw_no_bet';
    if (raw.includes('asian_handicap') || raw.includes('european_handicap') || raw.includes('handicap')) return 'handicap';
    if (raw.includes('team_total') || raw.includes('team_goals')) return 'team_goals';
    if (raw.includes('btts')) return 'btts';
    if (raw.includes('ht_ft')) return 'ht_ft';
    if (
        raw.includes('over_under')
        || raw.includes('over_')
        || raw.includes('under_')
        || raw.includes('total_goals')
        || raw.includes('total_points')
        || raw.includes('total_runs')
    ) {
        return 'totals';
    }
    if (raw.includes('corner')) return 'corners';
    if (raw.includes('card') || raw.includes('yellow')) return 'cards';
    if (raw.includes('1x2') || raw.includes('match_result') || raw.includes('match_winner') || raw.includes('winner')) return 'result';

    return 'market';
}

function isLowValueTrapMarket(market = {}) {
    const raw = `${market?.name || market?.market || ''}`.toLowerCase();
    const prediction = `${market?.prediction || market?.pick || ''}`.toLowerCase();
    const line = parseGoalLineFromMarket(market);

    if (raw.includes('over_0_5') || prediction.includes('over_0_5')) return true;
    if ((raw.includes('over_1_5') || prediction.includes('over_1_5')) && line !== null && line <= 1.5) return true;

    return false;
}

function isEscalatedValueMarket(market = {}) {
    const raw = `${market?.type || ''} ${market?.name || ''} ${market?.market || ''}`.toLowerCase();
    const line = parseGoalLineFromMarket(market);

    if (raw.includes('combo') || raw.includes('+')) return true;
    if (raw.includes('double_chance') || raw.includes('draw_no_bet')) return true;
    if (raw.includes('btts')) return true;
    if (raw.includes('team_total')) return true;
    if (raw.includes('handicap')) return true;

    if (raw.includes('over_') || raw.includes('under_') || raw.includes('over_under')) {
        return Number.isFinite(line) ? line >= 2.5 : false;
    }

    return false;
}

function isValidConfidence(confidence) {
    const c = Number(confidence);
    return Number.isFinite(c) && c >= MIN_CONFIDENCE && c <= MAX_CONFIDENCE;
}

/**
 * True intersection probability for combo events.
 * Example: 90% * 80% = 72%.
 */
function calculateTrueComboConfidence(probA, probB) {
    const a = clamp(toNumber(probA), 0, 100);
    const b = clamp(toNumber(probB), 0, 100);
    if (!a || !b) return 0;
    const comboConfidence = (a / 100) * (b / 100) * 100;
    return Number(comboConfidence.toFixed(2));
}

/**
 * True compound ticket probability for all legs.
 */
function calculateTicketCompoundProbability(legs) {
    const rows = Array.isArray(legs) ? legs : [];
    if (!rows.length) return 0;

    let totalProbability = 1.0;
    for (const leg of rows) {
        const confidence = clamp(toNumber(leg?.confidence), 0, 100);
        totalProbability *= (confidence / 100);
    }

    return Number((totalProbability * 100).toFixed(2));
}

/**
 * Chronological filter with resilient parsing.
 * - Uses 24h grace for timezone mismatch protection.
 * - Keeps fixtures with missing/unparseable date to avoid accidental full wipe.
 */
function filterExpiredFixtures(fixtures) {
    const currentUTC = Date.now();
    const gracePeriod = 24 * 60 * 60 * 1000;

    return (Array.isArray(fixtures) ? fixtures : []).filter((fixture) => {
        if (!fixture) return false;

        const dateStr = fixture.date
            || fixture.kickoff
            || fixture.kickoff_utc
            || fixture.match_time
            || fixture.startTime
            || fixture.commence_time
            || fixture?.metadata?.match_time
            || fixture?.metadata?.kickoff
            || fixture?.metadata?.kickoff_time
            || null;

        if (!dateStr) return true;

        const matchTime = new Date(dateStr).getTime();
        if (Number.isNaN(matchTime)) return true;

        return matchTime > (currentUTC - gracePeriod);
    });
}

/**
 * ACCA leg selection:
 * - Global fixture dedupe across the entire run.
 * - Max combo conditions (2 for 6-leg, 4 for 12-leg).
 * - Market-type repetition cap to enforce variance.
 * - Reject low-value trap markets when stronger alternatives exist.
 */
function selectAccaLegs(availableFixtures, globalUsedFixtures, targetLegCount) {
    const selectedLegs = [];
    const usedSet = globalUsedFixtures instanceof Set ? globalUsedFixtures : new Set();

    const maxCombos = Number(targetLegCount) === 12 ? 4 : 2;
    const maxSameMarketType = Number(targetLegCount) === 12 ? 3 : 2;
    let comboCount = 0;
    const marketTypeCounts = {};

    for (const fixture of Array.isArray(availableFixtures) ? availableFixtures : []) {
        if (selectedLegs.length >= Number(targetLegCount || 0)) break;
        if (!fixture || !fixture.id) continue;
        if (usedSet.has(fixture.id)) continue;

        const markets = Array.isArray(fixture.scoredMarkets) ? fixture.scoredMarkets.slice() : [];
        markets.sort((a, b) => toNumber(b?.confidence) - toNumber(a?.confidence));

        const hasEscalatedAlternative = markets.some((market) =>
            isEscalatedValueMarket(market) && isValidConfidence(market?.confidence)
        );

        let bestLeg = null;
        for (const family of BUILD_ORDER) {
            for (const market of markets) {
                const confidence = toNumber(market?.confidence);
                if (!isValidConfidence(confidence)) continue;

                const familyKey = normalizeMarketFamily(`${market?.type || ''} ${market?.name || ''} ${market?.market || ''}`);
                if (!familyKey || !ALLOWED_FAMILIES.has(familyKey)) continue;
                if (familyKey !== family) continue;

                if (isLowValueTrapMarket(market) && confidence >= 95 && hasEscalatedAlternative) {
                    continue;
                }

                const marketType = normalizeMarketTypeForVariety(market);
                const isCombo = isComboMarket(market);

                if (isCombo && comboCount >= maxCombos) continue;
                if ((marketTypeCounts[marketType] || 0) >= maxSameMarketType) continue;

                bestLeg = {
                    fixture_id: fixture.id,
                    match_name: fixture.name || 'Unknown Match',
                    sport: fixture.sport || 'Unknown Sport',
                    market: market.name || market.market || 'Unknown Market',
                    prediction: market.prediction || market.pick || 'Unknown',
                    confidence: Number(confidence.toFixed(2)),
                    market_type: marketType,
                    market_family: familyKey
                };

                if (isCombo) comboCount += 1;
                marketTypeCounts[marketType] = (marketTypeCounts[marketType] || 0) + 1;
                break;
            }

            if (bestLeg) break;
        }

        if (!bestLeg) continue;
        selectedLegs.push(bestLeg);
        usedSet.add(fixture.id);
    }

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
    BANNED_PATTERNS
};
