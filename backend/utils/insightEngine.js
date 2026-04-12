'use strict';

/**
 * Safe sports analytics utility layer.
 * This module is deliberately generic: it selects diverse high-confidence insights
 * and computes honest aggregate probabilities for multi-leg/cards.
 *
 * PURPOSE: Stabilize the card builder pipeline so that:
 *   - No past fixtures slip through
 *   - No full wipeout when one date is malformed
 *   - No repeated fixtures across cards
 *   - No fake 92% totals on long cards
 *   - No UNKNOWN footer labels
 *   - No single insight type dominating every card
 */

/** ---------- CONSTANTS ---------- */

const DEFAULT_MIN_CONFIDENCE = 80;
const DAY_GRACE_HOURS = 6;

/** ---------- SMALL HELPERS ---------- */

function round2(value) {
    return Number(Number(value || 0).toFixed(2));
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

/** ---------- DATE / FIXTURE SAFETY ---------- */

/**
 * Try multiple possible fixture datetime fields.
 */
function getFixtureDateValue(fixture) {
    return (
        fixture?.kickoff_utc ||
        fixture?.kickoff ||
        fixture?.start_time ||
        fixture?.startTime ||
        fixture?.date_utc ||
        fixture?.date ||
        fixture?.match_time ||
        fixture?.commence_time ||
        fixture?.metadata?.kickoff ||
        fixture?.metadata?.match_time ||
        null
    );
}

/**
 * Robust date parsing. Returns timestamp or null.
 */
function parseFixtureTimestamp(fixture) {
    const raw = getFixtureDateValue(fixture);
    if (!raw) return null;

    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) ? ts : null;
}

/**
 * Keep only upcoming fixtures, but do not wipe the entire run if some dates are bad.
 * Grace window prevents timezone edge-case removals.
 */
function filterUpcomingFixtures(fixtures, now = Date.now()) {
    const graceMs = DAY_GRACE_HOURS * 60 * 60 * 1000;
    let malformedDateCount = 0;

    const result = asArray(fixtures).filter((fixture) => {
        if (!fixture) return false;

        const ts = parseFixtureTimestamp(fixture);

        // If date is missing or unparseable, keep it for downstream validation
        // instead of causing a catastrophic empty result set.
        if (ts === null) {
            malformedDateCount++;
            return true;
        }

        return ts > (now - graceMs);
    });

    // Attach diagnostics for debugging
    result.malformedDateCount = malformedDateCount;
    return result;
}

/** ---------- FIXTURE IDENTITY / DEDUPE ---------- */

function stableFixtureKey(fixture) {
    if (!fixture) return null;

    const explicitId =
        fixture.fixture_id ||
        fixture.id ||
        fixture.match_id ||
        fixture.event_id ||
        fixture.raw_id ||
        null;

    if (explicitId) return String(explicitId);

    const home =
        fixture.home_team ||
        fixture.homeTeam ||
        fixture.team_home ||
        fixture.home ||
        fixture.metadata?.home_team ||
        'unknown-home';

    const away =
        fixture.away_team ||
        fixture.awayTeam ||
        fixture.team_away ||
        fixture.away ||
        fixture.metadata?.away_team ||
        'unknown-away';

    const league =
        fixture.league ||
        fixture.competition ||
        fixture.tournament ||
        fixture.metadata?.league ||
        'unknown-league';

    const ts = parseFixtureTimestamp(fixture) ?? 'unknown-time';

    return `${home}__${away}__${league}__${ts}`.toLowerCase();
}

/** ---------- CONFIDENCE MATH ---------- */

/**
 * True joint probability for two dependent-looking selections should usually be modeled
 * conservatively. For a safe generic implementation, we use a capped intersection estimate.
 *
 * joint = min(pA, pB) * dependencyFactor * (max(pA,pB)/100)
 *
 * But if you want a strict lower-bound estimate, use pure multiplication.
 */
function calculateIntersectionProbability(probA, probB, mode = 'strict') {
    const a = clamp(Number(probA) || 0, 0, 100) / 100;
    const b = clamp(Number(probB) || 0, 0, 100) / 100;

    if (a <= 0 || b <= 0) return 0;

    let joint;

    if (mode === 'strict') {
        // Lower-bound style estimate
        joint = a * b;
    } else {
        // Slightly less harsh but still conservative
        const minP = Math.min(a, b);
        const maxP = Math.max(a, b);
        const dependencyFactor = 0.92;
        joint = minP * dependencyFactor * maxP;
    }

    return round2(joint * 100);
}

/**
 * Honest multi-leg/card probability.
 * Multiply decimal confidences.
 */
function calculateCardProbability(legs) {
    const validLegs = asArray(legs).filter((leg) => Number(leg?.confidence) > 0);
    if (!validLegs.length) return 0;

    const product = validLegs.reduce((acc, leg) => {
        return acc * (clamp(Number(leg.confidence), 0, 100) / 100);
    }, 1);

    return round2(product * 100);
}

/**
 * Average leg confidence is useful for display, but should not replace real total probability.
 */
function calculateAverageLegConfidence(legs) {
    const validLegs = asArray(legs).filter((leg) => Number(leg?.confidence) > 0);
    if (!validLegs.length) return 0;

    const avg =
        validLegs.reduce((sum, leg) => sum + Number(leg.confidence), 0) /
        validLegs.length;

    return round2(avg);
}

/** ---------- MARKET / INSIGHT VARIETY ---------- */

/**
 * Normalize insight family so one type does not dominate.
 */
function normalizeInsightFamily(type) {
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
    if (value.includes('asian')) return 'handicap';
    if (value.includes('european')) return 'handicap';

    return 'other';
}

/**
 * A mild value penalty so ultra-obvious low-information picks do not dominate.
 * This is generic product logic, not wagering advice.
 */
function applySelectionPenalty(insight) {
    const family = normalizeInsightFamily(insight?.type);
    const confidence = Number(insight?.confidence) || 0;
    let adjusted = confidence;

    // Penalize very low-information selections if confidence is suspiciously extreme
    if (family === 'totals' && /0\.5/.test(String(insight?.name || insight?.market || '')) && confidence > 95) {
        adjusted -= 10;
    }

    if (family === 'match_result' && confidence > 94) {
        adjusted -= 3;
    }

    if (family === 'combo') {
        adjusted -= 4;
    }

    return round2(adjusted);
}

/**
 * Pick the best eligible insight for one fixture with diversity caps.
 */
function pickBestInsightForFixture(fixture, options = {}) {
    const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
    const familyCounts = options.familyCounts || {};
    const familyCaps = options.familyCaps || {};
    const comboCap = options.comboCap ?? 2;
    const currentComboCount = options.currentComboCount ?? 0;

    // Support both scoredInsights (new format) and scoredMarkets (legacy format)
    const insights = asArray(fixture?.scoredInsights || fixture?.scoredMarkets);

    const scored = insights
        .map((insight) => {
            const family = normalizeInsightFamily(insight?.type);
            return {
                ...insight,
                family,
                selectionScore: applySelectionPenalty(insight),
            };
        })
        .filter((insight) => Number(insight.confidence) >= minConfidence)
        .sort((a, b) => b.selectionScore - a.selectionScore);

    for (const insight of scored) {
        const family = insight.family;

        if ((familyCounts[family] || 0) >= (familyCaps[family] || Infinity)) {
            continue;
        }

        if (family === 'combo' && currentComboCount >= comboCap) {
            continue;
        }

        return insight;
    }

    return null;
}

/** ---------- CARD BUILDER ---------- */

/**
 * Get the proper display label for a card based on leg count.
 */
function getCardDescriptor(legCount) {
    if (legCount === 12) return '12 MATCH CARD';
    if (legCount === 6) return '6 MATCH CARD';
    return `${legCount || 0} MATCH CARD`;
}

function buildInsightCard(fixtures, config = {}) {
    const {
        legCount = 6,
        minConfidence = DEFAULT_MIN_CONFIDENCE,
        comboCap = legCount >= 12 ? 4 : 2,
        familyCaps = legCount >= 12
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
            },
        globalUsedFixtureKeys = new Set(),
    } = config;

    const familyCounts = {};
    let currentComboCount = 0;
    const legs = [];
    let skippedDueToDedupe = 0;
    let skippedDueToFamilyCap = 0;
    let skippedDueToLowConfidence = 0;

    for (const fixture of asArray(fixtures)) {
        if (legs.length >= legCount) break;

        const key = stableFixtureKey(fixture);
        if (!key || globalUsedFixtureKeys.has(key)) {
            skippedDueToDedupe++;
            continue;
        }

        const chosen = pickBestInsightForFixture(fixture, {
            minConfidence,
            familyCounts,
            familyCaps,
            comboCap,
            currentComboCount,
        });

        if (!chosen) {
            // Determine why it was skipped
            const insights = asArray(fixture?.scoredInsights || fixture?.scoredMarkets);
            const hasHighConfidence = insights.some((i) => Number(i?.confidence) >= minConfidence);
            if (hasHighConfidence) {
                skippedDueToFamilyCap++;
            } else {
                skippedDueToLowConfidence++;
            }
            continue;
        }

        legs.push({
            fixtureKey: key,
            fixtureId: fixture?.fixture_id || fixture?.id || fixture?.match_id || key,
            sport: fixture?.sport || 'Unknown Sport',
            competition: fixture?.competition || fixture?.league || 'Unknown Competition',
            matchName:
                fixture?.name ||
                `${fixture?.home_team || fixture?.homeTeam || fixture?.metadata?.home_team || 'Unknown Home'} vs ${fixture?.away_team || fixture?.awayTeam || fixture?.metadata?.away_team || 'Unknown Away'}`,
            startTime: getFixtureDateValue(fixture),
            insightName: chosen?.name || chosen?.market || 'Unknown Insight',
            insightType: chosen?.type || 'other',
            confidence: round2(chosen?.confidence),
            family: chosen.family,
        });

        globalUsedFixtureKeys.add(key);
        familyCounts[chosen.family] = (familyCounts[chosen.family] || 0) + 1;

        if (chosen.family === 'combo') {
            currentComboCount += 1;
        }
    }

    return {
        label: getCardDescriptor(legCount),
        displayLabel: getCardDescriptor(legCount),
        legCount,
        legs,
        averageLegConfidence: calculateAverageLegConfidence(legs),
        totalCardProbability: calculateCardProbability(legs),
        diversityBreakdown: familyCounts,
        diagnostics: {
            skippedDueToDedupe,
            skippedDueToFamilyCap,
            skippedDueToLowConfidence,
            totalFixturesScanned: asArray(fixtures).length,
            legsSelected: legs.length,
        },
    };
}

module.exports = {
    // Date/fixture safety
    filterUpcomingFixtures,
    stableFixtureKey,
    getFixtureDateValue,
    parseFixtureTimestamp,

    // Confidence math
    calculateIntersectionProbability,
    calculateCardProbability,
    calculateAverageLegConfidence,

    // Market/insight variety
    normalizeInsightFamily,
    applySelectionPenalty,
    pickBestInsightForFixture,

    // Card builder
    buildInsightCard,
    getCardDescriptor,

    // Constants
    DEFAULT_MIN_CONFIDENCE,
    DAY_GRACE_HOURS,
};
