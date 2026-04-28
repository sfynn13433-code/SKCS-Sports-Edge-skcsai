'use strict';

require('dotenv').config();
require('dotenv').config({ path: 'backend/.env', override: false });

const assert = require('assert');
const {
    getFootballHighlightsConfig,
    fetchHeadToHeadFallback,
    normalizeHeadToHeadMatches,
    getFootballHighlightsUsageState,
    resetFootballHighlightsUsageForTests
} = require('../backend/services/footballHighlightsService');
const {
    buildH2HSignal,
    getH2HVolatilityAdjustment
} = require('../backend/services/footballH2HExtractor');

const SAMPLE_H2H = [
    {
        id: 'm1',
        startingAt: '2026-04-01T18:30:00Z',
        tournament: { id: 101, name: 'Premier League', category: { country: { name: 'England' } } },
        roundInfo: { round: 'Round 30' },
        homeTeam: { id: 314803, name: 'Team One' },
        awayTeam: { id: 5700782, name: 'Team Two' },
        state: { score: { current: '2 - 1' }, status: 'finished' }
    },
    {
        id: 'm2',
        startingAt: '2026-03-01T18:30:00Z',
        tournament: { id: 101, name: 'Premier League', category: { country: { name: 'England' } } },
        roundInfo: { round: 'Round 26' },
        homeTeam: { id: 5700782, name: 'Team Two' },
        awayTeam: { id: 314803, name: 'Team One' },
        state: { score: { current: '1 - 1' }, status: 'finished' }
    },
    {
        id: 'm3',
        startingAt: '2026-01-18T18:30:00Z',
        tournament: { id: 101, name: 'Premier League', category: { country: { name: 'England' } } },
        roundInfo: { round: 'Round 20' },
        homeTeam: { id: 314803, name: 'Team One' },
        awayTeam: { id: 5700782, name: 'Team Two' },
        state: { score: { current: '3 - 0' }, status: 'finished' }
    }
];

function printConfig(config) {
    console.log('Football Highlights config:');
    console.log(`apiKeyPresent: ${config.apiKeyPresent}`);
    console.log(`host: ${config.host || '(empty)'}`);
    console.log(`baseUrl: ${config.baseUrl || '(empty)'}`);
    console.log(`dailyLimit: ${config.dailyLimit}`);
    console.log(`timeoutMs: ${config.timeoutMs}`);
}

function runLocalNormalizationTests() {
    const normalized = normalizeHeadToHeadMatches(SAMPLE_H2H, 314803, 5700782);
    assert.strictEqual(normalized.match_count, 3, 'match_count must be 3');
    assert.strictEqual(normalized.completed_match_count, 3, 'completed_match_count must be 3');
    assert.strictEqual(normalized.summary.draws, 1, 'draw count must be 1');
    assert.strictEqual(normalized.summary.btts_count, 2, 'btts_count must be 2');
    assert.strictEqual(normalized.summary.over_1_5_count, 3, 'over_1_5_count must be 3');
    assert.strictEqual(normalized.summary.over_2_5_count, 2, 'over_2_5_count must be 2');
    assert.strictEqual(normalized.summary.h2h_edge_label, 'TEAM_ONE_EDGE', 'h2h_edge_label must be TEAM_ONE_EDGE');

    const signal = buildH2HSignal(normalized);
    assert.strictEqual(signal.available, true, 'signal should be available for 3 completed matches');
    const volatilityAdjustment = getH2HVolatilityAdjustment(signal);
    assert.ok(Number.isFinite(volatilityAdjustment), 'volatility adjustment should be numeric');

    return { normalized, signal, volatilityAdjustment };
}

async function run() {
    const config = getFootballHighlightsConfig();
    printConfig(config);

    resetFootballHighlightsUsageForTests();

    const missingIds = await fetchHeadToHeadFallback(null, 5700782);
    assert.strictEqual(missingIds.skipped, true, 'missing IDs should be skipped');
    assert.strictEqual(missingIds.reason, 'missing_team_id', 'missing IDs reason mismatch');

    const sameIds = await fetchHeadToHeadFallback(314803, 314803);
    assert.strictEqual(sameIds.skipped, true, 'same IDs should be skipped');
    assert.strictEqual(sameIds.reason, 'same_team_id', 'same IDs reason mismatch');

    const local = runLocalNormalizationTests();
    console.log('Embedded sample normalized summary:', local.normalized.summary);
    console.log('Embedded sample h2h signal:', local.signal);
    console.log(`Embedded sample volatility adjustment: ${local.volatilityAdjustment}`);

    if (!config.apiKeyPresent) {
        const disabled = await fetchHeadToHeadFallback(314803, 5700782);
        assert.strictEqual(disabled.skipped, true, 'disabled service should skip');
        assert.strictEqual(disabled.reason, 'football_highlights_disabled', 'disabled reason mismatch');
        console.log('✅ Football Highlights H2H fallback test completed safely');
        return;
    }

    const result = await fetchHeadToHeadFallback(314803, 5700782);
    const usage = getFootballHighlightsUsageState();
    const signal = result?.data ? buildH2HSignal(result.data) : null;

    console.log('Football Highlights live fallback result:');
    console.log(`ok: ${result.ok}`);
    console.log(`skipped: ${result.skipped}`);
    console.log(`reason: ${result.reason}`);
    console.log(`endpoint: ${result.endpoint || null}`);
    console.log(`teamIdOne: ${result.teamIdOne || null}`);
    console.log(`teamIdTwo: ${result.teamIdTwo || null}`);
    console.log('normalized summary:', result?.data?.summary || null);
    console.log('h2h signal:', signal);
    console.log('usage state:', usage);
    console.log('✅ Football Highlights H2H fallback test completed safely');
}

run().catch((error) => {
    console.error('Test failed unexpectedly:', error?.message || error);
    process.exitCode = 1;
});
