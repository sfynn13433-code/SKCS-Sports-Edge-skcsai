'use strict';

/**
 * Smoke test for the stabilized insight engine.
 * Validates math integrity, fixture filtering, and card building.
 *
 * Run with: node backend/test/smoke-test-insight-engine.js
 */

const {
    filterUpcomingFixtures,
    stableFixtureKey,
    calculateCardProbability,
    calculateAverageLegConfidence,
    normalizeInsightFamily,
    buildInsightCard,
    getCardDescriptor,
} = require('../utils/insightEngine');

const {
    calculateTicketCompoundProbability,
    filterExpiredFixtures,
    selectAccaLegs,
} = require('../utils/accaLogicEngine');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  PASS: ${message}`);
        passed++;
    } else {
        console.error(`  FAIL: ${message}`);
        failed++;
    }
}

// ============================================================
// MOCK DATA
// ============================================================

function createMockFixture(id, home, away, daysFromNow, sport = 'football', league = 'EPL') {
    const kickoff = new Date();
    kickoff.setUTCDate(kickoff.getUTCDate() + daysFromNow);
    kickoff.setUTCHours(15, 0, 0, 0);

    return {
        id: String(id),
        fixture_id: String(id),
        name: `${home} vs ${away}`,
        home_team: home,
        away_team: away,
        sport,
        league,
        competition: league,
        kickoff: kickoff.toISOString(),
        kickoff_utc: kickoff.toISOString(),
        scoredMarkets: [
            { type: '1x2', market: '1x2', name: 'Match Winner', prediction: 'home', confidence: 92 },
            { type: 'over_under_2_5', market: 'Over/Under 2.5', name: 'Over 2.5 Goals', prediction: 'over', confidence: 88 },
            { type: 'btts', market: 'BTTS', name: 'BTTS Yes', prediction: 'yes', confidence: 85 },
            { type: 'double_chance_1x', market: 'Double Chance', name: 'Double Chance 1X', prediction: '1x', confidence: 95 },
            { type: 'combo_1x_over_2_5', market: 'Combo', name: 'Home Win + Over 2.5', prediction: 'combo', confidence: 82 },
        ],
    };
}

function createMalformedFixture(id, home, away) {
    return {
        id: String(id),
        fixture_id: String(id),
        name: `${home} vs ${away}`,
        home_team: home,
        away_team: away,
        sport: 'football',
        league: 'EPL',
        // No date field - should be kept, not rejected
        scoredMarkets: [
            { type: '1x2', market: '1x2', name: 'Match Winner', prediction: 'home', confidence: 90 },
        ],
    };
}

// ============================================================
// TESTS
// ============================================================

console.log('\n=== FIXTURE DATE FILTERING ===\n');

const upcomingFixtures = [
    createMockFixture(1, 'Arsenal', 'Chelsea', 1),
    createMockFixture(2, 'Man Utd', 'Liverpool', 2),
    createMockFixture(3, 'Tottenham', 'Man City', 5),
    createMalformedFixture(4, 'Newcastle', 'Brighton'),
];

const filtered = filterUpcomingFixtures(upcomingFixtures);
assert(filtered.length === 4, `Should keep all 4 fixtures including malformed date (got ${filtered.length})`);
assert(filtered.malformedDateCount === 1, `Should track 1 malformed date (got ${filtered.malformedDateCount})`);

const expiredFixtures = [
    createMockFixture(10, 'Old Team', 'Older Team', -5),
    createMockFixture(11, 'Recent Past', 'Even Older', -1),
    createMockFixture(12, 'Future Team', 'Future Team', 3),
];

const filteredExpired = filterExpiredFixtures(expiredFixtures);
assert(filteredExpired.length >= 1, 'Should keep at least the future fixture');
assert(
    filteredExpired.some(f => f.id === '12'),
    'Should keep future fixture (ID 12)'
);

console.log('\n=== FIXTURE DEDUPLICATION ===\n');

const dedupeFixtures = [
    createMockFixture(1, 'Arsenal', 'Chelsea', 1),
    createMockFixture(1, 'Arsenal', 'Chelsea', 1), // duplicate
    createMockFixture(2, 'Man Utd', 'Liverpool', 2),
];

const key1 = stableFixtureKey(dedupeFixtures[0]);
const key2 = stableFixtureKey(dedupeFixtures[1]);
assert(key1 === key2, 'Duplicate fixtures should have same stable key');

const usedKeys = new Set();
const card1 = buildInsightCard(dedupeFixtures, { legCount: 6, globalUsedFixtureKeys: usedKeys });
assert(card1.legs.length <= 2, `Should not duplicate fixtures (got ${card1.legs.length} legs from 3 fixtures with 1 duplicate)`);

console.log('\n=== CONFIDENCE MATH (HONEST MULTIPLICATION) ===\n');

// 6 legs at 94% each: 0.94^6 = 0.6899 = 68.99%
const sixLegs94 = Array(6).fill(null).map((_, i) => ({
    fixtureId: `f${i}`,
    matchName: `Team ${i}A vs Team ${ i}B`,
    confidence: 94,
}));

const sixLegProb = calculateCardProbability(sixLegs94);
console.log(`  6 legs @ 94% each -> total probability: ${sixLegProb}%`);
assert(sixLegProb <= 70, `6-leg @ 94% should be <= 70% (got ${sixLegProb}%)`);
assert(sixLegProb >= 68, `6-leg @ 94% should be >= 68% (got ${sixLegProb}%)`);

// 12 legs at 92% each: 0.92^12 = 0.3674 = 36.74%
const twelveLegs92 = Array(12).fill(null).map((_, i) => ({
    fixtureId: `f${i}`,
    matchName: `Team ${i} A vs Team ${i} B`,
    confidence: 92,
}));

const twelveLegProb = calculateCardProbability(twelveLegs92);
console.log(`  12 legs @ 92% each -> total probability: ${twelveLegProb}%`);
assert(twelveLegProb <= 40, `12-leg @ 92% should be <= 40% (got ${twelveLegProb}%)`);
assert(twelveLegProb >= 35, `12-leg @ 92% should be >= 35% (got ${twelveLegProb}%)`);

// Verify total probability <= average confidence
assert(
    sixLegProb <= calculateAverageLegConfidence(sixLegs94),
    'Total probability should be <= average confidence for 6-leg card'
);
assert(
    twelveLegProb <= calculateAverageLegConfidence(twelveLegs92),
    'Total probability should be <= average confidence for 12-leg card'
);

// Test the accaLogicEngine version too
const ticketProb = calculateTicketCompoundProbability(sixLegs94);
console.log(`  accaLogicEngine: 6 legs @ 94% -> ${ticketProb}%`);
assert(ticketProb <= 70, `accaLogicEngine 6-leg @ 94% should be <= 70% (got ${ticketProb}%)`);

console.log('\n=== MARKET VARIETY ENFORCEMENT ===\n');

const family1 = normalizeInsightFamily('1x2');
const family2 = normalizeInsightFamily('match_result');
const family3 = normalizeInsightFamily('over_under_2_5');
const family4 = normalizeInsightFamily('combo_1x_over_2_5');
const family5 = normalizeInsightFamily('btts');

assert(family1 === 'match_result', `1x2 -> match_result (got ${family1})`);
assert(family2 === 'match_result', `match_result -> match_result (got ${family2})`);
assert(family3 === 'totals', `over_under_2_5 -> totals (got ${family3})`);
assert(family4 === 'combo', `combo_1x_over_2_5 -> combo (got ${family4})`);
assert(family5 === 'btts', `btts -> btts (got ${family5})`);

console.log('\n=== CARD BUILDING & LABELS ===\n');

const cardLabel6 = getCardDescriptor(6);
const cardLabel12 = getCardDescriptor(12);
const cardLabelUnknown = getCardDescriptor(0);

assert(cardLabel6 === '6 MATCH CARD', `6 legs -> "6 MATCH CARD" (got "${cardLabel6}")`);
assert(cardLabel12 === '12 MATCH CARD', `12 legs -> "12 MATCH CARD" (got "${cardLabel12}")`);
assert(cardLabelUnknown === '0 MATCH CARD', `0 legs -> "0 MATCH CARD" (got "${cardLabelUnknown}")`);

// Build a real card from mock fixtures
const mockFixtures = [];
for (let i = 0; i < 15; i++) {
    mockFixtures.push(createMockFixture(
        100 + i,
        `Home Team ${i}`,
        `Away Team ${i}`,
        (i % 7) + 1,
        'football',
        ['EPL', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1'][i % 5]
    ));
}

const globalUsedKeys = new Set();
const sixLegCard = buildInsightCard(mockFixtures, {
    legCount: 6,
    minConfidence: 80,
    globalUsedFixtureKeys: globalUsedKeys,
});

assert(sixLegCard.label === '6 MATCH CARD', `Card label should be "6 MATCH CARD" (got "${sixLegCard.label}")`);
assert(sixLegCard.displayLabel === '6 MATCH CARD', `Card displayLabel should be "6 MATCH CARD"`);
assert(sixLegCard.legs.length <= 6, `Should have <= 6 legs (got ${sixLegCard.legs.length})`);
assert(
    sixLegCard.totalCardProbability <= sixLegCard.averageLegConfidence,
    `Total probability (${sixLegCard.totalCardProbability}%) should be <= avg confidence (${sixLegCard.averageLegConfidence}%)`
);
assert(sixLegCard.diversityBreakdown, 'Should have diversity breakdown');
console.log(`  Market variety: ${JSON.stringify(sixLegCard.diversityBreakdown)}`);

// Ensure no fixture is reused
const fixtureIdsInCard = sixLegCard.legs.map(l => l.fixtureKey);
const uniqueIds = new Set(fixtureIdsInCard);
assert(
    uniqueIds.size === fixtureIdsInCard.length,
    'No fixture should appear twice in the same card'
);

// Build second card - should not reuse fixtures from first card
const sixLegCard2 = buildInsightCard(mockFixtures, {
    legCount: 6,
    minConfidence: 80,
    globalUsedFixtureKeys: globalUsedKeys,
});

const allFixtureKeys = [
    ...sixLegCard.legs.map(l => l.fixtureKey),
    ...sixLegCard2.legs.map(l => l.fixtureKey),
];
const allUniqueKeys = new Set(allFixtureKeys);
assert(
    allUniqueKeys.size === allFixtureKeys.length,
    'No fixture should be reused across cards in same build cycle'
);

console.log('\n=== DIAGNOSTICS ===\n');

console.log(`  Total upcoming fixtures scanned: ${sixLegCard.diagnostics?.totalFixturesScanned || 'N/A'}`);
console.log(`  Legs selected: ${sixLegCard.diagnostics?.legsSelected || 'N/A'}`);
console.log(`  Skipped due to dedupe: ${sixLegCard.diagnostics?.skippedDueToDedupe || 'N/A'}`);
console.log(`  Skipped due to family cap: ${sixLegCard.diagnostics?.skippedDueToFamilyCap || 'N/A'}`);
console.log(`  Skipped due to low confidence: ${sixLegCard.diagnostics?.skippedDueToLowConfidence || 'N/A'}`);

console.log('\n=== SUMMARY ===\n');

console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);

if (failed > 0) {
    console.error('\n  ❌ SOME TESTS FAILED\n');
    process.exit(1);
} else {
    console.log('\n  ✅ ALL TESTS PASSED\n');
    process.exit(0);
}
