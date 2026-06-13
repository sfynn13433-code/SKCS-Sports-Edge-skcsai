'use strict';

/**
 * Soccer Data API provider health check.
 * Default call budget: 6 (free tier is 75/day).
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const {
    getApiToken,
    getCallStats,
    isSoccerDataApiEnabled,
    resetCallStats
} = require('../backend/services/soccerDataApiClient');
const provider = require('../backend/providers/football/soccerDataApiProvider');

const MAX_CALLS = Math.min(
    Number(process.env.SOCCER_DATA_VERIFY_MAX_CALLS) || 6,
    Number(process.env.SOCCER_DATA_HARD_DAILY_CAP) || 75
);

async function main() {
    const report = {
        generated_at: new Date().toISOString(),
        provider: 'soccer_data_api',
        config: {
            enable_flag: isSoccerDataApiEnabled(),
            api_key_configured: Boolean(getApiToken()),
            max_calls: MAX_CALLS,
            hard_daily_cap: Number(process.env.SOCCER_DATA_HARD_DAILY_CAP) || 75
        },
        restrictions: {
            free_tier_daily_requests: 75,
            gzip_header_required: true,
            auth: 'auth_token query param',
            throttle_message: 'Request was throttled. Expected available in 60 seconds.',
            blocked_endpoints_for_skcs: ['match-preview', 'match-previews-upcoming', 'livescores (canonical ingest)']
        }
    };

    if (!isSoccerDataApiEnabled()) {
        console.log(JSON.stringify({
            ...report,
            note: 'Set ENABLE_SOCCER_DATA_API=true in .env to run authenticated probes'
        }, null, 2));
        process.exit(1);
    }

    if (!getApiToken()) {
        console.log(JSON.stringify({
            ...report,
            note: 'Set SOCCER_DATA_API_KEY from https://soccerdataapi.com/dashboard/get-started/'
        }, null, 2));
        process.exit(1);
    }

    resetCallStats();
    const health = await provider.healthSummary({ maxCalls: MAX_CALLS });
    const stats = getCallStats();

    const output = {
        ...report,
        health,
        calls_used: stats.total,
        calls_remaining_budget: Math.max(0, MAX_CALLS - stats.total),
        rate_hints: stats.lastHeaders,
        last_detail: stats.lastDetail
    };

    console.log(JSON.stringify(output, null, 2));

    const passed = health.summary?.passed || 0;
    const withinBudget = stats.total <= MAX_CALLS;
    process.exit(passed >= 3 && withinBudget ? 0 : 1);
}

main().catch((error) => {
    console.error('[verify-soccerdata-provider] failed:', error.message);
    process.exit(1);
});
