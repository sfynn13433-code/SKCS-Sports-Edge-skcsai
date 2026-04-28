'use strict';

require('dotenv').config();
require('dotenv').config({ path: 'backend/.env', override: false });

const assert = require('assert');
const {
    getMetrxFactoryConfig,
    fetchTopMatchMetricsFallback,
    normalizeTopMatchMetrics,
    getMetrxFactoryUsageState,
    resetMetrxFactoryUsageForTests
} = require('../backend/services/metrxFactoryService');
const {
    buildMetrxMatchSignal,
    buildMetrxBatchSummary
} = require('../backend/services/metrxFactoryExtractor');

const EMBEDDED_SAMPLE = {
    success: true,
    bill: { charge: 0 },
    result: [
        {
            MD: {
                id: 'M-1001',
                start: '2026-04-30T18:00:00Z',
                schedule: 'U',
                competition: {
                    id: 'C-11',
                    name: 'Premier League',
                    shortName: 'EPL',
                    rank: 1,
                    index: 97
                },
                competitionStage: {
                    id: 'CS-1',
                    name: 'Regular Season'
                }
            },
            TI: {
                home: { id: '314803', name: 'Team One', shortName: 'ONE' },
                away: { id: '5700782', name: 'Team Two', shortName: 'TWO' }
            },
            XG: {
                period: 'FT',
                quality: 0.86,
                home: 1.92,
                away: 0.88,
                homeExpectedVenueAdvantage: 0.17,
                awayExpectedVenueAdvantage: 0.02
            },
            odds: {
                quality: 0.81,
                handicaps: {
                    expected: {
                        lines: [
                            { line: -0.5, home: 0.58, away: 0.42, main: true }
                        ]
                    }
                },
                points: {
                    expected: {
                        lines: [
                            { line: 2.5, over: 0.57, under: 0.43, main: true }
                        ]
                    }
                }
            }
        },
        {
            MD: {
                id: 'M-1002',
                start: '2026-04-30T20:00:00Z',
                schedule: 'U',
                competition: {
                    id: 'C-12',
                    name: 'La Liga',
                    shortName: 'LL',
                    rank: 2,
                    index: 88
                },
                competitionStage: {
                    id: 'CS-2',
                    name: 'Regular Season'
                }
            },
            TI: {
                home: { id: 'H-22', name: 'Home B', shortName: 'HB' },
                away: { id: 'A-22', name: 'Away B', shortName: 'AB' }
            },
            XG: {
                period: 'FT',
                quality: 0.67,
                home: 1.25,
                away: 1.16
            },
            odds: {
                quality: 0.64,
                handicaps: { expected: { lines: [{ line: 0, home: 0.51, away: 0.49 }] } },
                points: { expected: { lines: [{ line: 2.25, over: 0.54, under: 0.46 }] } }
            }
        }
    ]
};

async function run() {
    const config = getMetrxFactoryConfig();
    console.log('Metrx Factory config:');
    console.log(`apiKeyPresent: ${config.apiKeyPresent}`);
    console.log(`host: ${config.host || '(empty)'}`);
    console.log(`baseUrl: ${config.baseUrl || '(empty)'}`);
    console.log(`dailyLimit: ${config.dailyLimit}`);
    console.log(`timeoutMs: ${config.timeoutMs}`);

    resetMetrxFactoryUsageForTests();

    const normalizedEmbedded = normalizeTopMatchMetrics(EMBEDDED_SAMPLE);
    assert.strictEqual(normalizedEmbedded.matches_available, true, 'embedded normalization should have matches');
    assert.strictEqual(normalizedEmbedded.match_count, 2, 'embedded normalization should include 2 matches');

    normalizedEmbedded.matches.forEach((match, index) => {
        assert.ok(match.competition_rank !== null, `match ${index + 1}: competition_rank missing`);
        assert.ok(match.competition_index !== null, `match ${index + 1}: competition_index missing`);
        assert.ok(match.home_xg !== null, `match ${index + 1}: home_xg missing`);
        assert.ok(match.away_xg !== null, `match ${index + 1}: away_xg missing`);
        assert.ok(match.combined_xg !== null, `match ${index + 1}: combined_xg missing`);
        assert.ok(match.xg_gap !== null, `match ${index + 1}: xg_gap missing`);
        assert.ok(match.main_handicap_line !== null || index === 1, `match ${index + 1}: main_handicap_line missing`);
        assert.ok(match.main_points_line !== null || index === 1, `match ${index + 1}: main_points_line missing`);
        assert.ok(match.main_points_over !== null || index === 1, `match ${index + 1}: main_points_over missing`);
        assert.ok(match.main_points_under !== null || index === 1, `match ${index + 1}: main_points_under missing`);
    });

    const embeddedSignals = normalizedEmbedded.matches.map((match) => buildMetrxMatchSignal(match));
    const embeddedBatch = buildMetrxBatchSummary(normalizedEmbedded);
    console.log('Embedded signals:', embeddedSignals);
    console.log('Embedded batch summary:', embeddedBatch);

    if (!config.apiKeyPresent) {
        const disabledResult = await fetchTopMatchMetricsFallback({ maxCount: 3 });
        assert.strictEqual(disabledResult.skipped, true, 'disabled config should skip');
        assert.strictEqual(disabledResult.reason, 'metrx_factory_disabled', 'disabled reason mismatch');
        console.log('✅ Metrx Factory top metrics fallback test completed safely');
        return;
    }

    const liveResult = await fetchTopMatchMetricsFallback({ maxCount: 3 });
    const usageState = getMetrxFactoryUsageState();
    const liveMatches = liveResult?.data?.matches || [];
    const liveSignals = liveMatches.slice(0, 3).map((match) => buildMetrxMatchSignal(match));
    const liveBatch = liveResult?.data ? buildMetrxBatchSummary(liveResult.data) : null;

    console.log('Metrx Factory live fallback result:');
    console.log(`ok: ${liveResult.ok}`);
    console.log(`skipped: ${liveResult.skipped}`);
    console.log(`reason: ${liveResult.reason}`);
    console.log(`endpoint: ${liveResult.endpoint || null}`);
    console.log(`matches_available: ${liveResult?.data?.matches_available || false}`);
    console.log(`match_count: ${liveResult?.data?.match_count || 0}`);
    console.log('first_3_normalized_matches:', liveMatches.slice(0, 3));
    console.log('first_3_match_signals:', liveSignals);
    console.log('batch_summary:', liveBatch);
    console.log('usage state:', usageState);
    console.log('✅ Metrx Factory top metrics fallback test completed safely');
}

run().catch((error) => {
    console.error('Test failed unexpectedly:', error?.message || error);
    process.exitCode = 1;
});
