'use strict';

require('dotenv').config();
require('dotenv').config({ path: 'backend/.env', override: false });

const assert = require('assert');
const {
    getDivanscoreConfig,
    fetchTeamRankingsFallback,
    getDivanscoreUsageState,
    resetDivanscoreUsageForTests
} = require('../backend/services/divanscoreService');

async function run() {
    const config = getDivanscoreConfig();
    console.log('Divanscore config:');
    console.log(`apiKeyPresent: ${config.apiKeyPresent}`);
    console.log(`host: ${config.host || '(empty)'}`);
    console.log(`baseUrl: ${config.baseUrl || '(empty)'}`);
    console.log(`dailyLimit: ${config.dailyLimit}`);
    console.log(`timeoutMs: ${config.timeoutMs}`);

    resetDivanscoreUsageForTests();

    const missingTeamResult = await fetchTeamRankingsFallback(null);
    assert.strictEqual(missingTeamResult.skipped, true, 'missing team should be skipped');
    assert.strictEqual(missingTeamResult.reason, 'missing_team_id', 'missing team reason mismatch');

    if (!config.apiKeyPresent) {
        const disabledResult = await fetchTeamRankingsFallback(38);
        assert.strictEqual(disabledResult.skipped, true, 'disabled config should be skipped');
        assert.strictEqual(disabledResult.reason, 'divanscore_disabled', 'disabled reason mismatch');
        console.log('✅ Divanscore rankings fallback test completed safely');
        return;
    }

    const result = await fetchTeamRankingsFallback(38);
    const usage = getDivanscoreUsageState();

    console.log('Divanscore fallback call result:');
    console.log(`ok: ${result.ok}`);
    console.log(`skipped: ${result.skipped}`);
    console.log(`reason: ${result.reason}`);
    console.log(`endpoint: ${result.endpoint || null}`);
    console.log(`teamId: ${result.teamId || null}`);
    console.log('normalized data:', result.data);
    console.log('usage state:', usage);

    console.log('✅ Divanscore rankings fallback test completed safely');
}

run().catch((error) => {
    console.error('Test failed unexpectedly:', error?.message || error);
    process.exitCode = 1;
});
