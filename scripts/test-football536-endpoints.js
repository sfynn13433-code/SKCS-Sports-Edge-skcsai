'use strict';

require('dotenv').config();
require('dotenv').config({ path: 'backend/.env', override: false });

const { fetchFootball536Endpoint } = require('../backend/services/football536Service');
const {
    extractFootball536Shape,
    classifyFootball536Payload
} = require('../backend/services/football536Extractor');

const DELAY_MS = 250;
const MAX_REQUESTS = 9;

const TESTS = [
    {
        label: 'List Leagues',
        endpoint: '/leagues',
        params: {}
    },
    {
        label: 'List upcoming Fixtures',
        endpoint: '/fixtures',
        params: { status: 'SCHEDULED', date_from: 'today' }
    },
    {
        label: 'List Fixtures by League ID',
        endpoint: '/fixtures',
        params: { league_id: 2 }
    },
    {
        label: 'List Teams by Season ID',
        endpoint: '/teams',
        params: { season_id: 1 }
    },
    {
        label: 'Get Squad by Team ID',
        endpoint: '/squads',
        params: { team_id: 4 }
    },
    {
        label: 'Get League by ID',
        endpoint: '/leagues/1',
        params: {}
    },
    {
        label: 'List Seasons by League ID',
        endpoint: '/seasons',
        params: { league_id: 1 }
    },
    {
        label: 'List Rounds by Season ID',
        endpoint: '/rounds',
        params: { season_id: 1 }
    },
    {
        label: 'Get Player by ID',
        endpoint: '/players/10',
        params: {}
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

function pickRemaining(rateLimit) {
    if (!rateLimit || typeof rateLimit !== 'object') return null;
    return toNumberOrNull(
        rateLimit.requestsRemaining
        || rateLimit.requests_remaining
        || rateLimit.rapidFreeHardLimitRemaining
        || rateLimit.rapid_free_hard_limit_remaining
    );
}

function classifyWithStatus(status, raw, label) {
    const s = Number(status) || null;
    if (!s) return 'request_failed';
    if (s === 404) return 'invalid_endpoint_404';
    if (s === 401 || s === 403) return 'auth_or_subscription_issue';
    if (s === 429 || s >= 500) return 'provider_error';
    if (s >= 200 && s < 300) return classifyFootball536Payload(raw, label);
    return 'request_failed';
}

async function run() {
    const tests = TESTS.slice(0, MAX_REQUESTS);
    const results = [];

    for (let i = 0; i < tests.length; i += 1) {
        const test = tests[i];
        const response = await fetchFootball536Endpoint(test.endpoint, test.params);
        const shape = extractFootball536Shape(response?.data);
        const classification = classifyWithStatus(response?.status, response?.data, test.label);
        const remaining = pickRemaining(response?.rateLimit);

        console.log('\n====================================================');
        console.log(`Label: ${test.label}`);
        console.log(`Endpoint: ${test.endpoint}`);
        console.log('Params:', test.params);
        console.log(`HTTP status: ${response?.status}`);
        console.log(`OK: ${response?.ok}`);
        console.log('RateLimit:', response?.rateLimit || null);
        console.log('Raw top-level keys:', shape.raw_top_level_keys);
        console.log('Response keys:', shape.response_keys);
        console.log('Data keys:', shape.data_keys);
        console.log('Result keys:', shape.result_keys);
        console.log('Array paths:', shape.array_paths);
        console.log('Count guess:', shape.count_guess);
        console.log('Classification:', classification);

        if (!response?.ok) {
            console.log('Error:', response?.error || null);
            console.log('Details:', response?.details || null);
        }

        console.log('Safe preview max 1500 chars:');
        console.log(shape.safe_preview);

        results.push({
            label: test.label,
            endpoint: test.endpoint,
            status: response?.status ?? null,
            classification,
            count_guess: shape.count_guess,
            remaining,
            safe_preview: shape.safe_preview
        });

        if (i < tests.length - 1) {
            await sleep(DELAY_MS);
        }
    }

    const summaryRows = results.map((item) => ({
        label: item.label,
        endpoint: item.endpoint,
        status: item.status,
        classification: item.classification,
        count_guess: item.count_guess,
        remaining: item.remaining
    }));

    const totalTested = results.length;
    const total200 = results.filter((item) => Number(item.status) === 200).length;
    const total404 = results.filter((item) => Number(item.status) === 404).length;
    const totalProviderErrors = results.filter((item) => {
        const status = Number(item.status) || null;
        return status === 429 || (status !== null && status >= 500);
    }).length;
    const confirmedFixtureEndpoints = results.filter((item) => item.classification === 'confirmed_fixture_source').map((item) => item.endpoint);
    const confirmedLeagueEndpoints = results.filter((item) => (
        item.classification === 'confirmed_league_source'
        || item.classification === 'confirmed_league_detail_source'
    )).map((item) => item.endpoint);
    const confirmedTeamSquadEndpoints = results.filter((item) => (
        item.classification === 'confirmed_team_source'
        || item.classification === 'confirmed_squad_source'
    )).map((item) => item.endpoint);
    const latestRemainingQuota = results.length ? results[results.length - 1].remaining : null;

    console.log('\n====================================================');
    console.log('Summary Table');
    console.table(summaryRows);

    console.log('Summary Totals');
    console.log(`total tested: ${totalTested}`);
    console.log(`total 200: ${total200}`);
    console.log(`total 404: ${total404}`);
    console.log(`total provider errors: ${totalProviderErrors}`);
    console.log(`confirmed fixture endpoints: ${confirmedFixtureEndpoints.length ? confirmedFixtureEndpoints.join(', ') : 'none'}`);
    console.log(`confirmed league endpoints: ${confirmedLeagueEndpoints.length ? confirmedLeagueEndpoints.join(', ') : 'none'}`);
    console.log(`confirmed team/squad endpoints: ${confirmedTeamSquadEndpoints.length ? confirmedTeamSquadEndpoints.join(', ') : 'none'}`);
    console.log(`latest remaining quota: ${latestRemainingQuota === null ? 'unknown' : latestRemainingQuota}`);
}

run().catch((error) => {
    console.error('Unexpected failure:', error?.message || error);
    process.exitCode = 1;
});
