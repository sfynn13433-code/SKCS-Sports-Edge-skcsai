'use strict';

/**
 * SKCS ACCA ENGINE — CORE LAW
 *
 * This module overrides ALL existing ACCA logic.
 * Any conflicting legacy code must be removed.
 *
 * Pipeline: insightEngine → accaLogicEngine → accaBuilder → routes → client
 */

/* ==========================================================================
   1. ALLOWED MARKET FAMILIES (ONLY THESE)
   ========================================================================== */

const ALLOWED_MARKET_FAMILIES = new Set([
    'result',
    'double_chance',
    'totals',
    'btts',
    'team_goals',
    'corners',
    'cards',
]);

/* ==========================================================================
   2. HARD BANNED MARKETS (NEVER GENERATE)
   ========================================================================== */

const BANNED_MARKET_PATTERNS = [
    // Banned market keywords
    'exact_score', 'correct_score', 'correctscore',
    'player_market', 'player_shots', 'player_cards', 'player_goals',
    'clean_sheet', 'cleansheet',
    'win_to_nil', 'wintonil',
    'red_card', 'redcard',
    'penalty',     // all penalty markets
    'var',         // all VAR markets
    'winning_margin',
    'method_of_victory',
    'first_scorer', 'anytime_scorer', 'last_scorer', 'scorer_',
];

// Standalone draw pick check — separate from patterns to avoid catching draw_no_bet
function isStandaloneDrawPick(market, prediction) {
    const predKey = String(prediction || '').toLowerCase();
    const marketKey = String(market || '').toLowerCase();
    return predKey === 'draw' && (marketKey === '1x2' || marketKey === 'match_result' || marketKey === 'match_winner');
}

/* ==========================================================================
   3. FAMILY CAPS (MANDATORY)
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

const MIN_FAMILIES_PER_CARD = 3;

/* ==========================================================================
   4. CONFIDENCE GUARDRAILS
   ========================================================================== */

const MIN_LEG_CONFIDENCE = 72;     // 72%
const MAX_LEG_CONFIDENCE = 97;     // 97%

/* ==========================================================================
   5. DATE / GRACE
   ========================================================================== */

const DAY_GRACE_HOURS = 6;

/* ==========================================================================
   SMALL HELPERS
   ========================================================================== */

function round2(value) {
    return Number(Number(value || 0).toFixed(2));
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

/* ==========================================================================
   DATE / FIXTURE SAFETY
   ========================================================================== */

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

function parseFixtureTimestamp(fixture) {
    const raw = getFixtureDateValue(fixture);
    if (!raw) return null;
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) ? ts : null;
}

function filterUpcomingFixtures(fixtures, now = Date.now()) {
    const graceMs = DAY_GRACE_HOURS * 60 * 60 * 1000;
    let malformedDateCount = 0;

    const result = asArray(fixtures).filter((fixture) => {
        if (!fixture) return false;
        const ts = parseFixtureTimestamp(fixture);
        if (ts === null) {
            malformedDateCount++;
            return true;
        }
        return ts > (now - graceMs);
    });

    result.malformedDateCount = malformedDateCount;
    return result;
}

/* ==========================================================================
   FIXTURE IDENTITY / DEDUPE
   ========================================================================== */

function stableFixtureKey(fixture) {
    if (!fixture) return null;

    const explicitId =
        fixture.fixture_id || fixture.id || fixture.match_id ||
        fixture.event_id || fixture.raw_id || null;

    if (explicitId) return String(explicitId);

    const home = fixture.home_team || fixture.homeTeam ||
        fixture.team_home || fixture.home ||
        fixture.metadata?.home_team || 'unknown-home';
    const away = fixture.away_team || fixture.awayTeam ||
        fixture.team_away || fixture.away ||
        fixture.metadata?.away_team || 'unknown-away';
    const league = fixture.league || fixture.competition ||
        fixture.tournament || fixture.metadata?.league || 'unknown-league';
    const ts = parseFixtureTimestamp(fixture) ?? 'unknown-time';

    return `${home}__${away}__${league}__${ts}`.toLowerCase();
}

/* ==========================================================================
   MARKET NORMALIZATION (SKCS ACCA LAW — SECTION 1 & 2)
   ========================================================================== */

/**
 * Normalize any market type/token into one of the 7 allowed families.
 * Returns null if the market is banned.
 */
function normalizeInsightFamily(typeOrMarket) {
    const raw = String(typeOrMarket || '').toLowerCase().trim();
    if (!raw) return null;

    // --- Banned market check first ---
    for (const pattern of BANNED_MARKET_PATTERNS) {
        if (raw.includes(pattern)) return null;
    }

    // --- Allowed family mapping (specific BEFORE generic) ---
    if (raw.includes('draw_no_bet') || raw.includes('dnb')) return 'result';
    if (raw.includes('double_chance') || raw === '1x' || raw === 'x2' || raw === '12') return 'double_chance';
    if (raw === '1x2' || raw === 'match_result' || raw === 'match_winner' ||
        raw === 'home_win' || raw === 'away_win' || raw === 'home' || raw === 'away') return 'result';
    // Specific families BEFORE generic over/under
    if (raw.includes('team_total') || raw.includes('team_goals') || raw.includes('team_over') || raw.includes('team_under')) return 'team_goals';
    if (raw.includes('corner')) return 'corners';
    if (raw.includes('card') || raw.includes('yellow') || raw.includes('booking')) return 'cards';
    if (raw.includes('btts') || raw.includes('both_teams')) return 'btts';
    // Generic totals (must be last)
    if (raw.includes('over') || raw.includes('under') || raw.includes('totals') || raw.includes('over_under')) return 'totals';

    return null;
}

/**
 * Check if a specific market/prediction combination is banned.
 * Catches standalone "draw" picks and other edge cases.
 */
function isBannedMarket(market, prediction) {
    // Standalone draw check (separate to avoid catching draw_no_bet)
    if (isStandaloneDrawPick(market, prediction)) return true;

    const marketKey = String(market || '').toLowerCase();
    for (const pattern of BANNED_MARKET_PATTERNS) {
        if (marketKey.includes(pattern)) return true;
    }
    return false;
}

/**
 * Validate that a market/prediction is allowed.
 * Returns the family string or null if banned.
 */
function validateAndNormalizeMarket(market, prediction, type) {
    if (isBannedMarket(market, prediction)) return null;

    const typeResult = normalizeInsightFamily(type);
    if (typeResult === null) return null;

    // Double-check: the family must be in the allowed set
    if (!ALLOWED_MARKET_FAMILIES.has(typeResult)) return null;

    return typeResult;
}

/* ==========================================================================
   CONFIDENCE GUARDRAILS (SECTION 8)
   ========================================================================== */

function isValidConfidence(confidence) {
    const c = Number(confidence);
    if (!Number.isFinite(c)) return false;
    return c >= MIN_LEG_CONFIDENCE && c <= MAX_LEG_CONFIDENCE;
}

function clampConfidence(confidence) {
    const c = Number(confidence);
    if (!Number.isFinite(c)) return 0;
    return round2(clamp(c, MIN_LEG_CONFIDENCE, MAX_LEG_CONFIDENCE));
}

/* ==========================================================================
   PROBABILITY LAW (SECTION 6 — STRICT MULTIPLICATION)
   ========================================================================== */

function calculateCardProbability(legs) {
    const validLegs = asArray(legs).filter((leg) => Number(leg?.confidence) > 0);
    if (!validLegs.length) return 0;

    const product = validLegs.reduce((acc, leg) => {
        return acc * (clamp(Number(leg.confidence), 0, 100) / 100);
    }, 1);

    return round2(product * 100);
}

function calculateAverageLegConfidence(legs) {
    const validLegs = asArray(legs).filter((leg) => Number(leg?.confidence) > 0);
    if (!validLegs.length) return 0;
    const avg = validLegs.reduce((sum, leg) => sum + Number(leg.confidence), 0) / validLegs.length;
    return round2(avg);
}

/**
 * Integrity check: total must never exceed average for multi-leg cards.
 */
function verifyProbabilityIntegrity(legs) {
    const total = calculateCardProbability(legs);
    const avg = calculateAverageLegConfidence(legs);
    if (legs.length > 1 && total > avg) return false;
    return true;
}

/* ==========================================================================
   MARKET DIVERSITY (SECTION 7 — MIN 3 FAMILIES)
   ========================================================================== */

function validateMarketDiversity(legs) {
    const families = new Set(asArray(legs).map(l => l.family).filter(Boolean));
    return families.size >= MIN_FAMILIES_PER_CARD;
}

/* ==========================================================================
   WEEKLY TEAM LOCK (SECTION 4 — EXACT SPEC)
   ========================================================================== */

function normalizeTeamName(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function normalizeCompetitionKey(fixture) {
    return String(
        fixture.competition_key ||
        fixture.competition ||
        fixture.league ||
        fixture.tournament ||
        'unknown_competition'
    ).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function getWeekKey(dateValue) {
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return 'unknown_week';

    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);

    return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function isTeamLockedForWeek(fixture, usedTeamsWeekly) {
    const weekKey = getWeekKey(fixture.startTime || fixture.kickoff || fixture.date);
    const competitionKey = normalizeCompetitionKey(fixture);

    const home = normalizeTeamName(fixture.homeTeam || fixture.home_team || fixture.home);
    const away = normalizeTeamName(fixture.awayTeam || fixture.away_team || fixture.away);

    if (!usedTeamsWeekly.has(weekKey)) return false;

    const byCompetition = usedTeamsWeekly.get(weekKey);
    if (!byCompetition.has(competitionKey)) return false;

    const usedTeams = byCompetition.get(competitionKey);
    return usedTeams.has(home) || usedTeams.has(away);
}

function lockTeamsForWeek(fixture, usedTeamsWeekly) {
    const weekKey = getWeekKey(fixture.startTime || fixture.kickoff || fixture.date);
    const competitionKey = normalizeCompetitionKey(fixture);

    const home = normalizeTeamName(fixture.homeTeam || fixture.home_team || fixture.home);
    const away = normalizeTeamName(fixture.awayTeam || fixture.away_team || fixture.away);

    if (!usedTeamsWeekly.has(weekKey)) {
        usedTeamsWeekly.set(weekKey, new Map());
    }

    const byCompetition = usedTeamsWeekly.get(weekKey);

    if (!byCompetition.has(competitionKey)) {
        byCompetition.set(competitionKey, new Set());
    }

    const usedTeams = byCompetition.get(competitionKey);
    usedTeams.add(home);
    usedTeams.add(away);
}

/* ==========================================================================
   STABLE FIXTURE IDENTITY (EXACT SPEC)
   ========================================================================== */

function stableFixtureKeyForCard(fixture) {
    const home = normalizeTeamName(fixture.homeTeam || fixture.home_team || fixture.home);
    const away = normalizeTeamName(fixture.awayTeam || fixture.away_team || fixture.away);
    const competition = normalizeCompetitionKey(fixture);
    const kickoff = String(fixture.startTime || fixture.kickoff || fixture.date || 'unknown_time');

    return `${home}__${away}__${competition}__${kickoff}`;
}

/* ==========================================================================
   CARD OVERLAP REJECTION (EXACT SPEC)
   ========================================================================== */

function getCardFixtureKeySet(card) {
    return new Set((card.legs || []).map(leg => leg.fixtureKey));
}

function countSetOverlap(setA, setB) {
    let count = 0;
    for (const item of setA) {
        if (setB.has(item)) count += 1;
    }
    return count;
}

function exceedsCardOverlapLimit(candidateCard, publishedCards) {
    const candidateLegs = Array.isArray(candidateCard?.legs) ? candidateCard.legs : [];
    if (!candidateLegs.length) {
        return { reject: false, overlap: 0 };
    }

    const candidateSet = getCardFixtureKeySet({ legs: candidateLegs });
    const limit = candidateLegs.length === 12 ? 4 : 2;

    for (const existingCard of Array.isArray(publishedCards) ? publishedCards : []) {
        const existingLegs = Array.isArray(existingCard?.legs) ? existingCard.legs : [];
        if (existingLegs.length !== candidateLegs.length) continue;

        const existingSet = getCardFixtureKeySet({ legs: existingLegs });
        const overlap = countSetOverlap(candidateSet, existingSet);

        if (overlap > limit) {
            return {
                reject: true,
                overlap,
                comparedAgainst: existingCard?.display_label || `${existingLegs.length} card`,
            };
        }
    }

    return { reject: false, overlap: 0 };
}

/* ==========================================================================
   CANDIDATE POOL ROTATION (EXACT SPEC)
   ========================================================================== */

function removeUsedFixturesFromPool(pool, usedFixtureKeys) {
    return pool.filter(fixture => {
        const key = stableFixtureKey(fixture);
        return key && !usedFixtureKeys.has(key);
    });
}

function removeLockedTeamFixturesFromPool(pool, usedTeamsWeekly) {
    return pool.filter(fixture => !isTeamLockedForWeek(fixture, usedTeamsWeekly));
}

function rotateCandidatePool(pool, usedFixtureKeys, usedTeamsWeekly) {
    let nextPool = removeUsedFixturesFromPool(pool, usedFixtureKeys);
    nextPool = removeLockedTeamFixturesFromPool(nextPool, usedTeamsWeekly);
    return nextPool;
}

/* ==========================================================================
   MEGA DIAGNOSTICS (EXACT SPEC)
   ========================================================================== */

function initMegaDiagnostics() {
    return {
        mega_candidate_fixtures_before_filter: 0,
        mega_candidate_fixtures_after_filter: 0,
        mega_rejected_for_weekly_team_lock: 0,
        mega_rejected_for_family_caps: 0,
        mega_rejected_for_duplicate_overlap: 0,
        mega_rejected_for_confidence_floor: 0,
        mega_rejected_for_banned_market: 0,
        mega_rejected_for_low_diversity: 0,
        mega_rejected_for_insufficient_legs: 0,
        mega_final_cards_built: 0,
        mega_zero_reason: null,
    };
}

function resolveMegaZeroReason(diag) {
    if (diag.mega_final_cards_built > 0) return null;

    const reasons = [
        ['weekly_team_lock', diag.mega_rejected_for_weekly_team_lock],
        ['family_caps', diag.mega_rejected_for_family_caps],
        ['duplicate_overlap', diag.mega_rejected_for_duplicate_overlap],
        ['confidence_floor', diag.mega_rejected_for_confidence_floor],
        ['banned_market', diag.mega_rejected_for_banned_market],
        ['low_diversity', diag.mega_rejected_for_low_diversity],
        ['insufficient_legs', diag.mega_rejected_for_insufficient_legs],
    ];

    reasons.sort((a, b) => b[1] - a[1]);
    return reasons[0][1] > 0 ? reasons[0][0] : 'unknown';
}

/* ==========================================================================
   CARD BUILDER (SECTION 9 — CONSTRUCTION ORDER)
   ========================================================================== */

/**
 * Build order for card construction:
 * 1. result (1 pick)
 * 2. double_chance (1 pick)
 * 3. totals (up to cap)
 * 4. btts (up to cap)
 * 5. corners/cards (combined cap)
 * 6. fill remaining with highest confidence
 */
const BUILD_ORDER = ['result', 'double_chance', 'totals', 'btts', 'team_goals', 'corners', 'cards'];

function getCardDescriptor(legCount) {
    if (legCount === 12) return '12 MATCH MEGA ACCA';
    if (legCount === 6) return '6 MATCH ACCA';
    return `${legCount || 0} MATCH ACCA`;
}

function getFamilyCaps(legCount) {
    return legCount >= 12 ? { ...FAMILY_CAPS_12 } : { ...FAMILY_CAPS_6 };
}

/**
 * Pick the best eligible insight for one fixture with:
 * - banned market filtering
 * - family caps enforcement
 * - construction order preference
 * - confidence guardrails
 */
function pickBestInsightForFixture(fixture, options = {}) {
    const minConfidence = options.minConfidence ?? MIN_LEG_CONFIDENCE;
    const maxConfidence = MAX_LEG_CONFIDENCE;
    const familyCounts = options.familyCounts || {};
    const familyCaps = options.familyCaps || getFamilyCaps(options.legCount || 6);
    const buildOrder = options.buildOrder || BUILD_ORDER;

    // Support both scoredInsights and scoredMarkets
    const insights = asArray(fixture?.scoredInsights || fixture?.scoredMarkets);

    // Filter and score
    const scored = insights
        .map((insight) => {
            // Banned market check
            if (isBannedMarket(insight?.market, insight?.prediction)) return null;

            const family = normalizeInsightFamily(insight?.type || insight?.market);
            if (!family || !ALLOWED_MARKET_FAMILIES.has(family)) return null;

            // Confidence guardrails
            const confidence = Number(insight?.confidence);
            if (!Number.isFinite(confidence)) return null;
            if (confidence < minConfidence || confidence > maxConfidence) return null;

            return {
                ...insight,
                family,
                selectionScore: confidence,
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.selectionScore - a.selectionScore);

    // Apply build order preference: try families in construction order
    for (const preferredFamily of buildOrder) {
        for (const insight of scored) {
            if (insight.family !== preferredFamily) continue;

            // Check family cap
            if ((familyCounts[insight.family] || 0) >= (familyCaps[insight.family] ?? Infinity)) continue;

            // Corners/cards combined cap for 6-leg
            if (options.legCount < 12) {
                const cornersCardsTotal = (familyCounts.corners || 0) + (familyCounts.cards || 0);
                if ((insight.family === 'corners' || insight.family === 'cards') && cornersCardsTotal >= 1) continue;
            }

            return insight;
        }
    }

    // Fallback: any family with remaining cap (fill remaining)
    for (const insight of scored) {
        if ((familyCounts[insight.family] || 0) >= (familyCaps[insight.family] ?? Infinity)) continue;

        if (options.legCount < 12) {
            const cornersCardsTotal = (familyCounts.corners || 0) + (familyCounts.cards || 0);
            if ((insight.family === 'corners' || insight.family === 'cards') && cornersCardsTotal >= 1) continue;
        }

        return insight;
    }

    return null;
}

/**
 * Build an ACCA card with full SKCS law enforcement.
 */
function buildAccaCard(fixtures, config = {}) {
    const {
        legCount = 6,
        minConfidence = MIN_LEG_CONFIDENCE,
        globalUsedFixtureKeys = new Set(),
        usedTeamsWeekly = new Map(),
    } = config;

    const familyCaps = getFamilyCaps(legCount);
    const familyCounts = {};
    const legs = [];
    const diagnostics = {
        skippedDueToDedupe: 0,
        skippedDueToFamilyCap: 0,
        skippedDueToLowConfidence: 0,
        skippedDueToBannedMarket: 0,
        skippedDueToTeamLock: 0,
        bannedMarketsRemoved: 0,
        totalFixturesScanned: asArray(fixtures).length,
        legsSelected: 0,
    };

    for (const fixture of asArray(fixtures)) {
        if (legs.length >= legCount) break;

        const key = stableFixtureKey(fixture);
        if (!key || globalUsedFixtureKeys.has(key)) {
            diagnostics.skippedDueToDedupe++;
            continue;
        }

        const chosen = pickBestInsightForFixture(fixture, {
            minConfidence,
            familyCounts,
            familyCaps,
            legCount,
        });

        if (!chosen) {
            const insights = asArray(fixture?.scoredInsights || fixture?.scoredMarkets);
            const hadBanned = insights.some(i => isBannedMarket(i?.market, i?.prediction));
            if (hadBanned) {
                diagnostics.skippedDueToBannedMarket++;
                diagnostics.bannedMarketsRemoved++;
            } else {
                const hadHighConf = insights.some(i => Number(i?.confidence) >= minConfidence);
                if (hadHighConf) diagnostics.skippedDueToFamilyCap++;
                else diagnostics.skippedDueToLowConfidence++;
            }
            continue;
        }

        // Weekly team lock check
        const tempMatch = {
            home_team: fixture.home_team || fixture.homeTeam || fixture.metadata?.home_team,
            away_team: fixture.away_team || fixture.awayTeam || fixture.metadata?.away_team,
            metadata: fixture.metadata || {},
            competition: fixture.competition || fixture.league || fixture.metadata?.league,
        };
        const lockCheck = weeklyTeamLock([tempMatch], usedTeamsWeekly);
        if (!lockCheck.valid) {
            diagnostics.skippedDueToTeamLock++;
            continue;
        }

        legs.push({
            fixtureKey: key,
            fixtureId: fixture.fixture_id || fixture.id || fixture.match_id || key,
            sport: fixture.sport || 'Unknown Sport',
            competition: fixture.competition || fixture.league || 'Unknown Competition',
            matchName:
                fixture.name ||
                `${fixture.home_team || fixture.homeTeam || fixture.metadata?.home_team || 'Unknown Home'} vs ${fixture.away_team || fixture.awayTeam || fixture.metadata?.away_team || 'Unknown Away'}`,
            homeTeam: fixture.home_team || fixture.homeTeam || fixture.metadata?.home_team,
            awayTeam: fixture.away_team || fixture.awayTeam || fixture.metadata?.away_team,
            startTime: getFixtureDateValue(fixture),
            insightName: chosen.name || chosen.market || 'Unknown Insight',
            insightType: chosen.type || chosen.market || 'other',
            confidence: round2(chosen.confidence),
            family: chosen.family,
        });

        globalUsedFixtureKeys.add(key);
        familyCounts[chosen.family] = (familyCounts[chosen.family] || 0) + 1;
        reserveTeamsWeekly([tempMatch], usedTeamsWeekly);
    }

    // Post-build validation
    const avgConfidence = calculateAverageLegConfidence(legs);
    const totalProbability = calculateCardProbability(legs);
    const hasDiversity = validateMarketDiversity(legs);
    const hasHonestMath = verifyProbabilityIntegrity(legs);
    const displayLabel = getCardDescriptor(legCount);

    return {
        label: displayLabel,
        displayLabel,
        legCount,
        legs,
        averageLegConfidence: avgConfidence,
        totalCardProbability: totalProbability,
        diversityBreakdown: { ...familyCounts },
        isValid: legs.length === legCount && hasDiversity && hasHonestMath,
        validationErrors: [
            legs.length < legCount ? `incomplete_card: ${legs.length}/${legCount} legs` : null,
            !hasDiversity ? `insufficient_diversity: ${Object.keys(familyCounts).length} families (need ${MIN_FAMILIES_PER_CARD})` : null,
            !hasHonestMath ? 'fake_math_detected: total > average' : null,
        ].filter(Boolean),
        diagnostics,
    };
}

module.exports = {
    // Core constants
    ALLOWED_MARKET_FAMILIES,
    BANNED_MARKET_PATTERNS,
    FAMILY_CAPS_6,
    FAMILY_CAPS_12,
    MIN_LEG_CONFIDENCE,
    MAX_LEG_CONFIDENCE,
    MIN_FAMILIES_PER_CARD,
    BUILD_ORDER,
    DAY_GRACE_HOURS,

    // Date/fixture
    filterUpcomingFixtures,
    stableFixtureKey,
    getFixtureDateValue,
    parseFixtureTimestamp,

    // Market normalization (SKCS Law sections 1-2)
    normalizeInsightFamily,
    isBannedMarket,
    validateAndNormalizeMarket,

    // Confidence guardrails (section 8)
    isValidConfidence,
    clampConfidence,

    // Probability (section 6)
    calculateCardProbability,
    calculateAverageLegConfidence,
    verifyProbabilityIntegrity,

    // Diversity (section 7)
    validateMarketDiversity,

    // Weekly team lock (section 4)
    normalizeTeamName,
    normalizeCompetitionKey,
    getWeekKey,
    isTeamLockedForWeek,
    lockTeamsForWeek,

    // Stable fixture identity
    stableFixtureKeyForCard,

    // Card overlap rejection
    getCardFixtureKeySet,
    countSetOverlap,
    exceedsCardOverlapLimit,

    // Candidate pool rotation
    removeUsedFixturesFromPool,
    removeLockedTeamFixturesFromPool,
    rotateCandidatePool,

    // Mega diagnostics
    initMegaDiagnostics,
    resolveMegaZeroReason,

    // Card builder (section 9)
    getCardDescriptor,
    getFamilyCaps,
    pickBestInsightForFixture,
    buildAccaCard,
};
