'use strict';

require('dotenv').config();
require('dotenv').config({ path: 'backend/.env', override: false });

const assert = require('assert');

const aiPipeline = require('../backend/services/aiPipeline');
const footballHighlightsService = require('../backend/services/footballHighlightsService');
const footballH2HExtractor = require('../backend/services/footballH2HExtractor');

async function run() {
    assert.ok(aiPipeline && typeof aiPipeline === 'object', 'aiPipeline module load failed');
    assert.ok(footballHighlightsService && typeof footballHighlightsService.fetchHeadToHeadFallback === 'function', 'footballHighlightsService export missing');
    assert.ok(footballH2HExtractor && typeof footballH2HExtractor.buildH2HSignal === 'function', 'footballH2HExtractor export missing');

    const testApi = aiPipeline.__test || {};
    assert.ok(typeof testApi.extractFootballHighlightsTeamIds === 'function', 'extractFootballHighlightsTeamIds not exposed for tests');
    assert.ok(typeof testApi.applyFootballH2HEnrichment === 'function', 'applyFootballH2HEnrichment not exposed for tests');

    const ids = testApi.extractFootballHighlightsTeamIds({
        match_info: { home_team_id: 314803, away_team_id: 5700782 }
    });
    assert.strictEqual(ids.homeTeamId, '314803', 'homeTeamId extraction failed');
    assert.strictEqual(ids.awayTeamId, '5700782', 'awayTeamId extraction failed');

    let externalCalls = 0;
    const simulatedApplied = await testApi.applyFootballH2HEnrichment(
        {
            sport: 'football',
            fixtureId: 'FX-100',
            candidatePrediction: 'home_win',
            candidateConfidence: 70,
            match: {
                homeTeam: { id: 314803 },
                awayTeam: { id: 5700782 }
            },
            currentVolatilityScore: 48
        },
        {
            canUseFootballHighlights: () => true,
            fetchHeadToHeadFallback: async () => {
                externalCalls += 1;
                return {
                    ok: true,
                    skipped: false,
                    reason: null,
                    source: 'football_highlights',
                    endpoint: 'head-2-head',
                    teamIdOne: '314803',
                    teamIdTwo: '5700782',
                    data: {
                        match_count: 6,
                        summary: {
                            h2h_edge_label: 'TEAM_ONE_EDGE'
                        }
                    }
                };
            },
            buildH2HSignal: () => ({
                available: true,
                match_count: 6,
                h2h_edge_team_id: '314803',
                h2h_edge_label: 'TEAM_ONE_EDGE',
                draw_rate: 0.22,
                btts_rate: 0.61,
                over_1_5_rate: 0.88,
                over_2_5_rate: 0.53,
                volatility_hint: 'MEDIUM',
                confidence_adjustment: 3,
                notes: ['clear_h2h_edge']
            }),
            getH2HVolatilityAdjustment: () => -2
        }
    );
    assert.strictEqual(externalCalls, 1, 'expected exactly one external call for eligible case');
    assert.strictEqual(simulatedApplied.confidence, 73, 'confidence adjustment not applied correctly');
    assert.strictEqual(simulatedApplied.metadata.h2h_enrichment_status, 'applied', 'h2h status should be applied');
    assert.strictEqual(simulatedApplied.metadata.h2h_edge_label, 'TEAM_ONE_EDGE', 'h2h edge label missing');
    assert.strictEqual(simulatedApplied.metadata.h2h_confidence_adjustment, 3, 'h2h confidence adjustment missing');

    const skippedWindow = await testApi.applyFootballH2HEnrichment(
        {
            sport: 'football',
            fixtureId: 'FX-101',
            candidatePrediction: 'home_win',
            candidateConfidence: 90,
            match: {
                homeTeam: { id: 314803 },
                awayTeam: { id: 5700782 }
            },
            currentVolatilityScore: 50
        },
        {
            canUseFootballHighlights: () => true,
            fetchHeadToHeadFallback: async () => {
                externalCalls += 1;
                return { ok: true };
            },
            buildH2HSignal: () => ({ confidence_adjustment: 2 })
        }
    );
    assert.strictEqual(skippedWindow.metadata.h2h_enrichment_status, 'skipped', 'confidence-outside-window should skip');
    assert.strictEqual(skippedWindow.metadata.h2h_enrichment_reason, 'confidence_outside_h2h_window', 'skip reason mismatch for confidence window');
    assert.strictEqual(externalCalls, 1, 'no extra external call expected outside confidence window');

    const skippedMissingIds = await testApi.applyFootballH2HEnrichment(
        {
            sport: 'football',
            fixtureId: 'FX-102',
            candidatePrediction: 'home_win',
            candidateConfidence: 70,
            match: {},
            currentVolatilityScore: 50
        },
        {
            canUseFootballHighlights: () => true,
            fetchHeadToHeadFallback: async () => {
                externalCalls += 1;
                return { ok: true };
            },
            buildH2HSignal: () => ({ confidence_adjustment: 2 })
        }
    );
    assert.strictEqual(skippedMissingIds.metadata.h2h_enrichment_status, 'skipped', 'missing IDs should skip');
    assert.strictEqual(skippedMissingIds.metadata.h2h_enrichment_reason, 'missing_team_id', 'missing IDs reason mismatch');
    assert.strictEqual(externalCalls, 1, 'no external call expected when IDs are missing');

    const skippedSport = await testApi.applyFootballH2HEnrichment(
        {
            sport: 'cricket',
            fixtureId: 'FX-103',
            candidatePrediction: 'home_win',
            candidateConfidence: 70,
            match: {
                homeTeam: { id: 314803 },
                awayTeam: { id: 5700782 }
            },
            currentVolatilityScore: 50
        },
        {
            canUseFootballHighlights: () => true,
            fetchHeadToHeadFallback: async () => {
                externalCalls += 1;
                return { ok: true };
            },
            buildH2HSignal: () => ({ confidence_adjustment: 2 })
        }
    );
    assert.strictEqual(skippedSport.metadata.h2h_enrichment_status, 'skipped', 'non-football should skip');
    assert.strictEqual(skippedSport.metadata.h2h_enrichment_reason, 'non_football_sport', 'non-football reason mismatch');
    assert.strictEqual(externalCalls, 1, 'no external call expected for non-football');

    console.log('✅ Football H2H pipeline integration test completed safely');
}

run().catch((error) => {
    console.error('Test failed unexpectedly:', error?.message || error);
    process.exitCode = 1;
});
