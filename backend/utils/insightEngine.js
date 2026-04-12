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
   WEEKLY TEAM LOCK (SECTION 4)
   ========================================================================== */

function startOfWeekUtc(now = new Date()) {
    const current = new Date(now);
    const day = current.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    current.setUTCDate(current.getUTCDate() + diffToMonday);
    current.setUTCHours(0, 0, 0, 0);
    return current;
}

function endOfWeekUtc(now = new Date()) {
    const start = startOfWeekUtc(now);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return end;
}

/**
 * Extract team → competition pairs from a match/leg.
 */
function extractTeamCompetitionPairs(match) {
    const meta = match?.metadata || {};
    const competition = String(
        meta.competition || meta.league || meta.tournament ||
        match?.league || match?.competition || match?.sport || ''
    ).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');

    const home = String(match?.home_team || meta.home_team || '').trim().toLowerCase();
    const away = String(match?.away_team || meta.away_team || '').trim().toLowerCase();

    const pairs = [];
    if (home) pairs.push({ team: home, competition });
    if (away) pairs.push({ team: away, competition });
    return pairs;
}

/**
 * Check if adding a match would violate the weekly team lock.
 * A team can appear in different competitions but not the same competition twice in one week.
 *
 * @param {Array} matches - Array of match objects in the proposed card
 * @param {Map} usedTeamsWeekly - Map of team → Set of competitions already used this week
 * @returns {{ valid: boolean, rejectedTeams: string[] }}
 */
function weeklyTeamLock(matches, usedTeamsWeekly) {
    const rejectedTeams = [];

    for (const match of asArray(matches)) {
        const pairs = extractTeamCompetitionPairs(match);
        for (const { team, competition } of pairs) {
            if (!team || !competition) continue;

            const existingCompetitions = usedTeamsWeekly.get(team);
            if (existingCompetitions && existingCompetitions.has(competition)) {
                rejectedTeams.push(team);
            }
        }
    }

    return {
        valid: rejectedTeams.length === 0,
        rejectedTeams: [...new Set(rejectedTeams)],
    };
}

/**
 * Reserve teams from a completed card into the weekly lock map.
 */
function reserveTeamsWeekly(matches, usedTeamsWeekly) {
    for (const match of asArray(matches)) {
        const pairs = extractTeamCompetitionPairs(match);
        for (const { team, competition } of pairs) {
            if (!team || !competition) continue;
            if (!usedTeamsWeekly.has(team)) {
                usedTeamsWeekly.set(team, new Set());
            }
            usedTeamsWeekly.get(team).add(competition);
        }
    }
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
    startOfWeekUtc,
    endOfWeekUtc,
    extractTeamCompetitionPairs,
    weeklyTeamLock,
    reserveTeamsWeekly,

    // Card builder (section 9)
    getCardDescriptor,
    getFamilyCaps,
    pickBestInsightForFixture,
    buildAccaCard,
};
