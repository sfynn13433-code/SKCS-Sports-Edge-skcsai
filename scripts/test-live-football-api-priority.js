'use strict';

require('dotenv').config();
require('dotenv').config({ path: 'backend/.env', override: false });

const { fetchLiveFootballApiEndpoint } = require('../backend/services/liveFootballApiService');
const {
    extractLiveFootballApiShape,
    classifyLiveFootballApiPayload
} = require('../backend/services/liveFootballApiExtractor');

const DELAY_MS = 300;

const TESTS = [
    {
        label: 'getLeagueStanding',
        endpoint: '/league-standing',
        params: { league_id: 618, season: 2024 }
    },
    {
        label: 'getHeadToHeadMatches',
        endpoint: '/head-to-head',
        params: { league_id: 618, team_id1: 60, team_id2: 69 }
    },
    {
        label: 'getMatchStatistics',
        endpoint: '/match-statistics',
        params: { match_id: 372452 }
    },
    {
        label: 'getMatchLineup',
        endpoint: '/match-lineup',
        params: { match_id: 372452 }
    },
    {
        label: 'getMatchEvents',
        endpoint: '/match-events',
        params: { match_id: 372452 }
    },
    {
        label: 'getTopScorers',
        endpoint: '/top-scorers',
        params: { season: 2024, league_id: 621 }
    },
    {
        label: 'getPredictions',
        endpoint: '/predictions',
        params: { id: 372452 }
    }
];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function getRapidRequestsRemaining(rateLimit) {
    if (!rateLimit || typeof rateLimit !== 'object') return null;
    return toNumberOrNull(
        rateLimit.rapidRequestsRemaining
        || rateLimit['x-ratelimit-requests-remaining']
    );
}

function getProviderDayRemaining(rateLimit) {
    if (!rateLimit || typeof rateLimit !== 'object') return null;
    return toNumberOrNull(
        rateLimit.providerDayRemaining
        || rateLimit['x-rate-remaining-day']
    );
}

function uniqueTests(tests) {
    const seen = new Set();
    const output = [];

    for (const test of tests) {
        const key = `${test.endpoint}|${JSON.stringify(test.params || {})}`;
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(test);
    }

    return output;
}

function printPerTestResult(test, response, shape, classification) {
    console.log('\n====================================================');
    console.log(`label: ${test.label}`);
    console.log(`endpoint: ${test.endpoint}`);
    console.log('params:', test.params);
    console.log(`HTTP status: ${response?.status ?? null}`);
    console.log(`ok: ${Boolean(response?.ok)}`);
    console.log('rateLimit:', response?.rateLimit || null);
    console.log('raw_top_level_keys:', shape.raw_top_level_keys);
    console.log('response_keys:', shape.response_keys);
    console.log('data_keys:', shape.data_keys);
    console.log('result_keys:', shape.result_keys);
    console.log('array_paths:', shape.array_paths);
    console.log('count_guess:', shape.count_guess);
    console.log('classification:', classification);
    console.log('safe_preview max 1500 chars:');
    console.log(String(shape.safe_preview || '').slice(0, 1500));
}

function buildFinalRecommendation(summary) {
    const confirmedUseful = summary.confirmedUsefulEnrichmentEndpoints;
    const emptyEndpoints = summary.endpointsReturnedEmpty;
    const errorCount = summary.totalErrors;

    if (confirmedUseful.length >= 4 && errorCount <= 2) {
        return 'Proceed with isolated mapper design for confirmed enrichment endpoints. Keep /predictions comparison-only.';
    }
    if (confirmedUseful.length >= 2) {
        return 'Run one controlled follow-up test for weak/unknown endpoints before any integration. Keep /predictions comparison-only.';
    }
    if (emptyEndpoints.length > 0) {
        return 'Validate IDs and season/league params with provider docs, then re-run only failed/empty endpoints in a minimal pass.';
    }
    return 'Provider response shape is inconclusive; validate authentication/plan coverage before additional calls.';
}

async function run() {
    const tests = uniqueTests(TESTS).slice(0, 7);
    const results = [];
    let stopForQuota = false;

    for (let i = 0; i < tests.length; i += 1) {
        const test = tests[i];
        const response = await fetchLiveFootballApiEndpoint(test.endpoint, test.params);
        const shape = extractLiveFootballApiShape(response?.data);
        const classification = classifyLiveFootballApiPayload(response?.data, test.label, response?.status);
        const rapidRequestsRemaining = getRapidRequestsRemaining(response?.rateLimit);
        const providerDayRemaining = getProviderDayRemaining(response?.rateLimit);

        printPerTestResult(test, response, shape, classification);

        results.push({
            label: test.label,
            endpoint: test.endpoint,
            status: response?.status ?? null,
            ok: Boolean(response?.ok),
            classification,
            count_guess: shape.count_guess,
            rapidRequestsRemaining,
            providerDayRemaining
        });

        if (
            rapidRequestsRemaining !== null
            && rapidRequestsRemaining <= 20
            && i < tests.length - 1
        ) {
            console.log('\nStopping early due to low remaining RapidAPI window (rapidRequestsRemaining <= 20).');
            stopForQuota = true;
            break;
        }

        if (i < tests.length - 1) {
            await sleep(DELAY_MS);
        }
    }

    const totalConfigured = tests.length;
    const totalTested = results.length;
    const total200 = results.filter((item) => Number(item.status) === 200).length;
    const totalErrors = results.filter((item) => !item.ok).length;
    const confirmedUsefulEnrichmentEndpoints = results
        .filter((item) => [
            'confirmed_standing_source',
            'confirmed_h2h_source',
            'confirmed_match_statistics_source',
            'confirmed_match_lineup_source',
            'confirmed_match_event_source',
            'confirmed_top_scorers_source',
            'confirmed_prediction_source'
        ].includes(item.classification))
        .map((item) => item.endpoint);
    const endpointsReturnedEmpty = results
        .filter((item) => item.classification === 'empty_success')
        .map((item) => item.endpoint);
    const currentRapidRequestsRemaining = totalTested
        ? results[totalTested - 1].rapidRequestsRemaining
        : null;
    const currentProviderDayRemaining = totalTested
        ? results[totalTested - 1].providerDayRemaining
        : null;

    console.log('\n====================================================');
    console.log('Summary Table');
    console.table(
        results.map((item) => ({
            label: item.label,
            endpoint: item.endpoint,
            status: item.status,
            classification: item.classification,
            count_guess: item.count_guess,
            rapidRequestsRemaining: item.rapidRequestsRemaining,
            providerDayRemaining: item.providerDayRemaining
        }))
    );

    const summary = {
        totalConfigured,
        totalTested,
        total200,
        totalErrors,
        confirmedUsefulEnrichmentEndpoints,
        endpointsReturnedEmpty,
        currentRapidRequestsRemaining,
        currentProviderDayRemaining
    };

    console.log('Summary Totals');
    console.log(`total configured: ${summary.totalConfigured}`);
    console.log(`total tested: ${summary.totalTested}`);
    console.log(`total 200: ${summary.total200}`);
    console.log(`total errors: ${summary.totalErrors}`);
    console.log(`confirmed useful enrichment endpoints: ${summary.confirmedUsefulEnrichmentEndpoints.length ? summary.confirmedUsefulEnrichmentEndpoints.join(', ') : 'none'}`);
    console.log(`endpoints that returned empty: ${summary.endpointsReturnedEmpty.length ? summary.endpointsReturnedEmpty.join(', ') : 'none'}`);
    console.log(`current rapidRequestsRemaining: ${summary.currentRapidRequestsRemaining === null ? 'unknown' : summary.currentRapidRequestsRemaining}`);
    console.log(`current providerDayRemaining: ${summary.currentProviderDayRemaining === null ? 'unknown' : summary.currentProviderDayRemaining}`);
    console.log(`final recommendation: ${buildFinalRecommendation(summary)}`);
    console.log(`predictions endpoint policy: comparison-only source, not final SKCS decision engine.`);

    if (stopForQuota) {
        process.exitCode = 0;
    }
}

run().catch((error) => {
    console.error('Unexpected failure:', error?.message || error);
    process.exitCode = 1;
});

