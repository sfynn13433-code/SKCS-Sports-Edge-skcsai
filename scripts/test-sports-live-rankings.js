'use strict';

require('dotenv').config();
require('dotenv').config({ path: 'backend/.env', override: false });

const assert = require('assert');
const {
    getSportsLiveScoresConfig,
    fetchFootballLeagueRankingsFallback,
    normalizeFootballLeagueRankings,
    parseRankingTextRow,
    getSportsLiveScoresUsageState,
    resetSportsLiveScoresUsageForTests
} = require('../backend/services/sportsLiveScoresService');
const {
    buildLeagueRankingSignal
} = require('../backend/services/sportsLiveScoresExtractor');

const EMBEDDED_SAMPLE = {
    standings: [
        { position: 1, points: 82, played: 35, wins: 26, draws: 4, losses: 5, goals_for: 78, goals_against: 31, goal_difference: 47, form: 'WWDWW', team: { id: 314803, name: 'Team One' } },
        { position: 3, points: 73, played: 35, wins: 22, draws: 7, losses: 6, goals_for: 69, goals_against: 40, goal_difference: 29, form: 'WDWLW', team: { id: 5700782, name: 'Team Two' } },
        { position: 6, points: 58, played: 35, wins: 17, draws: 7, losses: 11, goals_for: 51, goals_against: 44, goal_difference: 7, form: 'LLWDW', team: { id: 900001, name: 'Team Three' } }
    ]
};

async function run() {
    const requestedLeagueId = String(process.argv[2] || '33').trim() || '33';
    const config = getSportsLiveScoresConfig();
    console.log('Sports Live Scores config:');
    console.log(`apiKeyPresent: ${config.apiKeyPresent}`);
    console.log(`host: ${config.host || '(empty)'}`);
    console.log(`baseUrl: ${config.baseUrl || '(empty)'}`);
    console.log(`dailyLimit: ${config.dailyLimit}`);
    console.log(`timeoutMs: ${config.timeoutMs}`);
    console.log(`leagueId: ${requestedLeagueId}`);

    resetSportsLiveScoresUsageForTests();

    const missingLeagueResult = await fetchFootballLeagueRankingsFallback(null);
    assert.strictEqual(missingLeagueResult.skipped, true, 'missing league should be skipped');
    assert.strictEqual(missingLeagueResult.reason, 'missing_league_id', 'missing league reason mismatch');

    const normalizedSample = normalizeFootballLeagueRankings(EMBEDDED_SAMPLE, requestedLeagueId);
    assert.strictEqual(normalizedSample.rankings_available, true, 'embedded normalization should produce rankings');
    assert.strictEqual(normalizedSample.team_count, 3, 'embedded sample should produce 3 teams');

    const rankingSignal = buildLeagueRankingSignal(normalizedSample, 314803, 5700782);
    assert.strictEqual(rankingSignal.available, true, 'ranking signal should be available');

    console.log('Embedded normalized ranking signal:', rankingSignal);

    const parseCases = [
        '1 Manchester City 38 28 7 3 96:34 +62 91',
        '2 Arsenal 38 26 6 6 91-29 62 84',
        '3 Liverpool | 38 | 24 | 10 | 4 | 86:41 | +45 | 82'
    ];
    const parseResults = parseCases.map((text) => parseRankingTextRow(text));
    parseResults.forEach((parsed, idx) => {
        assert.ok(parsed.team_name, `parse case ${idx + 1}: expected team_name`);
        assert.ok(Number.isFinite(parsed.position), `parse case ${idx + 1}: expected position`);
        assert.ok(Number.isFinite(parsed.played), `parse case ${idx + 1}: expected played`);
        assert.ok(Number.isFinite(parsed.points), `parse case ${idx + 1}: expected points`);
    });
    console.log('Embedded parse test results:', parseResults);

    if (!config.apiKeyPresent) {
        const disabledResult = await fetchFootballLeagueRankingsFallback(requestedLeagueId);
        assert.strictEqual(disabledResult.skipped, true, 'disabled config should skip');
        assert.strictEqual(disabledResult.reason, 'sports_live_scores_disabled', 'disabled reason mismatch');
        console.log('✅ Sports Live Scores rankings fallback test completed safely');
        return;
    }

    const liveResult = await fetchFootballLeagueRankingsFallback(requestedLeagueId);
    const usageState = getSportsLiveScoresUsageState();

    console.log('Sports Live Scores live fallback result:');
    console.log(`ok: ${liveResult.ok}`);
    console.log(`skipped: ${liveResult.skipped}`);
    console.log(`reason: ${liveResult.reason}`);
    console.log(`endpoint: ${liveResult.endpoint || null}`);
    console.log(`leagueId: ${liveResult.leagueId || null}`);
    if (liveResult.reason === 'empty_result' && liveResult.raw_preview) {
        console.log('raw_preview:', liveResult.raw_preview);
    }
    const firstRawRow = Array.isArray(liveResult?.raw?.rankings) && liveResult.raw.rankings.length > 0
        ? liveResult.raw.rankings[0]
        : null;
    const firstRankingTextPreview = firstRawRow && typeof firstRawRow === 'object'
        ? String(firstRawRow.Text || firstRawRow.text || '').slice(0, 300)
        : '';
    console.log('first_raw_ranking_row_keys:', firstRawRow && typeof firstRawRow === 'object'
        ? Object.keys(firstRawRow).slice(0, 20)
        : (liveResult?.raw_preview?.firstRankingRowKeys || []));
    console.log('firstRankingTextPreview:', firstRankingTextPreview || null);
    console.log(`rankings_available: ${liveResult?.data?.rankings_available || false}`);
    console.log(`team_count: ${liveResult?.data?.team_count || 0}`);
    console.log('first_5_teams:', (liveResult?.data?.teams || []).slice(0, 5));
    console.log('usage state:', usageState);
    console.log('✅ Sports Live Scores rankings fallback test completed safely');
}

run().catch((error) => {
    console.error('Test failed unexpectedly:', error?.message || error);
    process.exitCode = 1;
});
