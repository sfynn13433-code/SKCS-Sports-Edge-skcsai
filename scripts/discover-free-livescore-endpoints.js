'use strict';

require('dotenv').config();
require('dotenv').config({ path: 'backend/.env', override: false });

const { fetchFreeLivescoreEndpoint } = require('../backend/services/freeLivescoreApiService');

/*
 * Provider status lock (as of 2026-04-27):
 * - Public RapidAPI Endpoints tab exposes only: GET /livescore-get-search
 * - Use this provider as a high-volume entity resolver only.
 * - Do NOT use this provider as SKCS raw fixture source unless RapidAPI later
 *   exposes additional exact endpoints in the Endpoints tab.
 */

const DEFAULT_PARAMS = { sportname: 'soccer' };
const MAX_CANDIDATES = 20;
const DELAY_MS = 250;
const PREVIEW_MAX = 1500;
const PROVIDER_MODE = 'entity_resolver_only';
const CONFIRMED_ENDPOINT = '/livescore-get-search';
const KNOWN_INVALID_GUESSED_ENDPOINTS = [
    '/livescore-get-live',
    '/livescore-get-fixtures',
    '/livescore-get-matches',
    '/livescore-get-schedules',
    '/livescore-get-scores',
    '/livescore-get-events',
    '/livescore-get-standings',
    '/livescore-get-leagues',
    '/livescore-get-teams',
    '/livescore-get-h2h',
    '/livescore-get-lineups',
    '/livescore-get-statistics',
    '/livescore-get-odds',
    '/livescore-get-news'
];

const CANDIDATES = [
    '/livescore-get-search',
    '/livescore-get-live',
    '/livescore-get-fixtures',
    '/livescore-get-matches',
    '/livescore-get-schedules',
    '/livescore-get-scores',
    '/livescore-get-events',
    '/livescore-get-standings',
    '/livescore-get-leagues',
    '/livescore-get-teams',
    '/livescore-get-h2h',
    '/livescore-get-lineups',
    '/livescore-get-statistics',
    '/livescore-get-odds',
    '/livescore-get-news'
];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function keysOf(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : [];
}

function asText(value) {
    if (value === null || value === undefined) return '';
    return String(value);
}

function compactJson(value, max = PREVIEW_MAX) {
    let text;
    try {
        text = JSON.stringify(value, null, 2);
    } catch (error) {
        text = asText(value);
    }
    if (!text) return '';
    return text.length <= max ? text : `${text.slice(0, max)}...<truncated>`;
}

function firstArrayPayload(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.response)) return data.response;
    if (data.response && typeof data.response === 'object') {
        if (Array.isArray(data.response.Events)) return data.response.Events;
        if (Array.isArray(data.response.Matches)) return data.response.Matches;
        if (Array.isArray(data.response.Fixtures)) return data.response.Fixtures;
        for (const value of Object.values(data.response)) {
            if (Array.isArray(value)) return value;
        }
    }
    for (const value of Object.values(data)) {
        if (Array.isArray(value)) return value;
    }
    return [];
}

function inferCountGuess(data) {
    const source = data && typeof data === 'object' ? data : {};
    const response = source.response && typeof source.response === 'object' ? source.response : {};
    const eventLike = ['Events', 'Matches', 'Fixtures', 'Live', 'Scores'];
    for (const key of eventLike) {
        if (Array.isArray(response[key])) return response[key].length;
        if (Array.isArray(source[key])) return source[key].length;
    }
    const list = firstArrayPayload(data);
    return Array.isArray(list) ? list.length : 0;
}

function hasEntitySearchShape(data) {
    const response = data && typeof data === 'object' ? data.response : null;
    return Boolean(
        response
        && typeof response === 'object'
        && Array.isArray(response.Teams)
        && Array.isArray(response.Stages)
        && Array.isArray(response.Categories)
    );
}

function hasFixtureHints(data) {
    const list = firstArrayPayload(data);
    if (!Array.isArray(list) || list.length === 0) return false;

    const keyHints = new Set([
        'ID',
        'Eid',
        'event_id',
        'match_id',
        'home',
        'away',
        'T1',
        'T2',
        'Home',
        'Away',
        'Stime',
        'start_time',
        'league',
        'stage',
        'Sid'
    ]);

    const sample = list.slice(0, 5);
    return sample.some((row) => {
        if (!row || typeof row !== 'object') return false;
        const rowKeys = Object.keys(row);
        return rowKeys.some((key) => keyHints.has(key));
    });
}

function classify(result) {
    const status = Number(result?.status) || null;
    const data = result?.data;

    if (!status) return 'request_failed';
    if (status === 401 || status === 403) return 'auth_or_subscription_issue';
    if (status === 404) return 'invalid_endpoint_404';
    if (status === 429 || status >= 500) return 'provider_error';
    if (status >= 200 && status < 300) {
        if (hasEntitySearchShape(data)) return 'valid_entity_search';
        if (hasFixtureHints(data)) return 'likely_fixture_or_match_source';
        return 'valid_but_unknown_shape';
    }
    return 'request_failed';
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

async function run() {
    console.log('Provider mode:', PROVIDER_MODE);
    console.log('Confirmed endpoint:', CONFIRMED_ENDPOINT);
    console.log('Known invalid guessed endpoints (from controlled discovery):');
    console.log(KNOWN_INVALID_GUESSED_ENDPOINTS.join(', '));

    const endpoints = CANDIDATES.slice(0, MAX_CANDIDATES);
    const results = [];

    for (let i = 0; i < endpoints.length; i += 1) {
        const endpoint = endpoints[i];
        const params = endpoint === '/livescore-get-search'
            ? { sportname: 'soccer', search: 'romania' }
            : { ...DEFAULT_PARAMS };

        const result = await fetchFreeLivescoreEndpoint(endpoint, params);
        const data = result?.data && typeof result.data === 'object' ? result.data : {};
        const response = data.response && typeof data.response === 'object' ? data.response : null;
        const rateRemaining = pickRemaining(result?.rateLimit);
        const classification = classify(result);
        const row = {
            endpoint,
            status: result?.status ?? null,
            classification,
            top_level_keys: keysOf(data).join(','),
            response_keys: keysOf(response).join(','),
            count_guess: inferCountGuess(data),
            remaining: rateRemaining
        };

        results.push({
            endpoint,
            status: result?.status ?? null,
            classification,
            topLevelKeys: keysOf(data),
            responseKeys: keysOf(response),
            countGuess: row.count_guess,
            remaining: rateRemaining,
            preview: classification.startsWith('valid_') || classification === 'likely_fixture_or_match_source'
                ? compactJson(data, PREVIEW_MAX)
                : ''
        });

        if (i < endpoints.length - 1) {
            await sleep(DELAY_MS);
        }

        if (rateRemaining !== null && rateRemaining < 1000) {
            break;
        }
    }

    const tableRows = results.map((item) => ({
        endpoint: item.endpoint,
        status: item.status,
        classification: item.classification,
        top_level_keys: item.topLevelKeys.join(','),
        response_keys: item.responseKeys.join(','),
        count_guess: item.countGuess,
        remaining: item.remaining
    }));

    console.log('\nEndpoint Discovery Results');
    console.table(tableRows);

    console.log('\nSafe Preview (200 endpoints only)');
    const previews = results.filter((item) => Number(item.status) === 200);
    if (previews.length === 0) {
        console.log('No 200 endpoints discovered.');
    } else {
        for (const item of previews) {
            console.log(`\nEndpoint: ${item.endpoint}`);
            console.log(item.preview);
        }
    }

    const totalTested = results.length;
    const valid200 = results.filter((item) => Number(item.status) === 200);
    const invalid404 = results.filter((item) => Number(item.status) === 404);
    const authIssues = results.filter((item) => item.status === 401 || item.status === 403);
    const fixtureCandidates = results.filter((item) => item.classification === 'likely_fixture_or_match_source');
    const latestRemaining = results.length ? results[results.length - 1].remaining : null;

    let recommendedNext = null;
    if (fixtureCandidates.length > 0) {
        recommendedNext = fixtureCandidates[0].endpoint;
    } else if (valid200.length > 0) {
        recommendedNext = valid200[0].endpoint;
    }

    console.log('\nSummary');
    console.log(`Total tested: ${totalTested}`);
    console.log(`Valid 200 endpoints: ${valid200.length}`);
    console.log(`Invalid 404 endpoints: ${invalid404.length}`);
    console.log(`Auth/subscription issues: ${authIssues.length}`);
    console.log(`Possible fixture sources: ${fixtureCandidates.length ? fixtureCandidates.map((i) => i.endpoint).join(', ') : 'none'}`);
    console.log(`Recommended next endpoint to deep-test: ${recommendedNext || 'none'}`);
    console.log(`Latest remaining quota observed: ${latestRemaining === null ? 'unknown' : latestRemaining}`);
    console.log('Implementation rule: use Free Livescore API only for provider ID mapping and entity discovery.');
    console.log('Implementation rule: do not use Free Livescore API as SKCS raw fixture source.');
}

run().catch((error) => {
    console.error('Discovery failed:', error?.message || error);
    process.exitCode = 1;
});
