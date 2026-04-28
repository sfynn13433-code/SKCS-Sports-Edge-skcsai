'use strict';

require('dotenv').config();
require('dotenv').config({ path: 'backend/.env' });

const axios = require('axios');

const BASE_URL = 'https://livescore6.p.rapidapi.com';
const MAX_CALLS = 10;
const LIST_DAYS = [0, 1, 2];
const CRICKET_KEYWORDS = [
    'cricket',
    'icc',
    'ipl',
    'psl',
    'bbl',
    'cpl',
    'sa20',
    'odi',
    't20',
    'test',
    'county championship',
    'ashes',
    'hundred',
    'wicket',
    'innings'
];

const detailEndpoints = [
    {
        path: '/matches/v2/get-info',
        name: 'get-info',
        skcsUse: 'fixture details / teams / venue / start time'
    },
    {
        path: '/matches/v2/get-h2h',
        name: 'get-h2h',
        skcsUse: 'head-to-head history'
    },
    {
        path: '/matches/v2/get-pregame-form',
        name: 'get-pregame-form',
        skcsUse: 'pre-match team form'
    },
    {
        path: '/matches/v2/get-statistics',
        name: 'get-statistics',
        skcsUse: 'team/match statistics'
    },
    {
        path: '/matches/v2/get-lineups',
        name: 'get-lineups',
        skcsUse: 'lineups / squads / player availability'
    }
];

function loadConfig() {
    return {
        host: process.env.RAPIDAPI_HOST_LIVESCORE6 || 'livescore6.p.rapidapi.com',
        apiKey:
            process.env.RAPIDAPI_LIVESCORE6_KEY ||
            process.env.RAPIDAPI_KEY ||
            process.env.X_RAPIDAPI_KEY
    };
}

function formatYyyyMmDd(date) {
    const yyyy = String(date.getUTCFullYear());
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
}

function safePreview(value, maxLength = 1200) {
    try {
        const json = JSON.stringify(value, null, 2);
        if (json.length <= maxLength) return json;
        return `${json.slice(0, maxLength)}\n...truncated`;
    } catch (_err) {
        return String(value);
    }
}

function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}

function isEmptyValue(value) {
    if (value === null || value === undefined) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (isPlainObject(value)) return Object.keys(value).length === 0;
    if (typeof value === 'string') return value.trim() === '';
    return false;
}

function containsCricketKeywords(value) {
    const text = String(value || '').toLowerCase();
    return CRICKET_KEYWORDS.some((keyword) => text.includes(keyword));
}

function hasCricketLookingContent(payload) {
    if (!payload) return false;
    return containsCricketKeywords(safePreview(payload, 4000));
}

function isUsablePayload(payload, expectCricket) {
    if (payload === null || payload === undefined) return false;
    if (isEmptyValue(payload)) return false;

    if (payload.status === false && isEmptyValue(payload.data)) return false;

    if (expectCricket && !hasCricketLookingContent(payload)) return false;

    return true;
}

function isMeaningfulObjectPayload(payload) {
    if (!isPlainObject(payload)) return false;
    return Object.keys(payload).length > 0;
}

function getTopLevelKeys(payload) {
    if (!payload || typeof payload !== 'object') return [];
    return Object.keys(payload);
}

function walkForArrayCandidates(root) {
    const out = [];
    const queue = [root];
    const seen = new Set();

    while (queue.length > 0) {
        const node = queue.shift();
        if (!node || typeof node !== 'object') continue;
        if (seen.has(node)) continue;
        seen.add(node);

        if (Array.isArray(node)) {
            if (node.length > 0) out.push(node);
            continue;
        }

        for (const value of Object.values(node)) {
            if (value && typeof value === 'object') queue.push(value);
        }
    }

    return out;
}

function findItemsArray(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;

    const candidates = walkForArrayCandidates(payload);
    return candidates[0] || [];
}

function findEid(obj) {
    if (!obj || typeof obj !== 'object') return null;

    const candidateFields = ['Eid', 'eid', 'eventId', 'event_id', 'id', 'Id'];
    for (const field of candidateFields) {
        const value = obj[field];
        if (value !== null && value !== undefined && String(value).trim() !== '') {
            return String(value).trim();
        }
    }

    return null;
}

function findFirstEventObject(item) {
    if (!item || typeof item !== 'object') return null;

    if (Array.isArray(item.Events) && item.Events.length > 0 && typeof item.Events[0] === 'object') {
        return item.Events[0];
    }

    if (Array.isArray(item.events) && item.events.length > 0 && typeof item.events[0] === 'object') {
        return item.events[0];
    }

    return null;
}

function getMaybeValue(item, fields) {
    for (const field of fields) {
        const value = item && item[field];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value).trim();
        }
    }
    return null;
}

function extractFixtureMeta(item) {
    const event = findFirstEventObject(item) || item;

    const homeFromEvent =
        (Array.isArray(event.T1) && event.T1[0] && event.T1[0].Nm) ||
        (Array.isArray(event.home) && event.home[0] && event.home[0].Nm) ||
        null;
    const awayFromEvent =
        (Array.isArray(event.T2) && event.T2[0] && event.T2[0].Nm) ||
        (Array.isArray(event.away) && event.away[0] && event.away[0].Nm) ||
        null;

    return {
        home_team: homeFromEvent || getMaybeValue(event, ['home', 'homeTeam', 'home_team', 'team1']) || getMaybeValue(item, ['home', 'homeTeam', 'home_team', 'team1']),
        away_team: awayFromEvent || getMaybeValue(event, ['away', 'awayTeam', 'away_team', 'team2']) || getMaybeValue(item, ['away', 'awayTeam', 'away_team', 'team2']),
        competition: getMaybeValue(item, ['Snm', 'league', 'competition', 'tournament', 'Comp', 'Cnm']),
        start_time: getMaybeValue(event, ['Esd', 'startTime', 'start_time', 'time', 'date']) || getMaybeValue(item, ['startTime', 'start_time', 'time', 'date']),
        venue: getMaybeValue(event, ['Vnm', 'venue', 'ground', 'location']) || getMaybeValue(item, ['Vnm', 'venue', 'ground', 'location']),
        status: getMaybeValue(event, ['EpsL', 'Eps', 'status', 'state', 'match_status']) || getMaybeValue(item, ['status', 'state', 'match_status'])
    };
}

function printRateRemaining(headers) {
    return headers?.['x-ratelimit-requests-remaining'] || 'unknown';
}

async function callApi(context, path, params) {
    if (context.callsUsed >= MAX_CALLS) {
        return {
            blockedByBudget: true
        };
    }

    context.callsUsed += 1;
    const callNumber = context.callsUsed;

    try {
        const response = await axios.get(`${BASE_URL}${path}`, {
            params,
            timeout: 20000,
            headers: {
                'Content-Type': 'application/json',
                'x-rapidapi-host': context.config.host,
                'x-rapidapi-key': context.config.apiKey
            }
        });

        context.lastRateRemaining = printRateRemaining(response.headers);

        return {
            callNumber,
            status: response.status,
            payload: response.data,
            rateRemaining: context.lastRateRemaining,
            headers: response.headers
        };
    } catch (error) {
        const status = error?.response?.status || null;
        const payload = error?.response?.data;
        const headers = error?.response?.headers || {};

        context.lastRateRemaining = printRateRemaining(headers);

        return {
            callNumber,
            status,
            payload,
            rateRemaining: context.lastRateRemaining,
            headers,
            error: error.message
        };
    }
}

function printListResult(path, query, result, expectCricket) {
    const payload = result.payload;
    const keys = getTopLevelKeys(payload);
    const items = findItemsArray(payload);
    const usable = result.status === 200 && isUsablePayload(payload, expectCricket);
    const hasKeyword = hasCricketLookingContent(payload);
    const endpointText = `${path}?Category=${query.Category}&Date=${query.Date}&Timezone=${query.Timezone}`;

    console.log(`\nCall #${result.callNumber}`);
    console.log(`Endpoint: ${endpointText}`);
    console.log(`HTTP status: ${result.status || 'n/a'}`);
    console.log(`Rate-limit remaining: ${result.rateRemaining}`);
    console.log(`Top-level keys: ${keys.join(', ') || '(none)'}`);
    console.log(`Fixture count: ${items.length}`);
    console.log(`Cricket keyword found: ${hasKeyword ? 'yes' : 'no'}`);
    console.log(`Usable: ${usable ? 'yes' : 'no'}`);
    console.log('First safe fixture preview:');
    console.log(safePreview(items[0] || payload || null));
}

function printDetailResult(endpoint, query, result, usable) {
    const payload = result.payload;
    const keys = getTopLevelKeys(payload);
    const pathWithParams = `${endpoint.path}?${query}`;

    console.log(`\nEndpoint: ${pathWithParams}`);
    console.log(`HTTP status: ${result.status || 'n/a'}`);
    console.log(`Rate-limit remaining: ${result.rateRemaining}`);
    console.log(`Usable: ${usable ? 'yes' : 'no'}`);
    console.log(`Top-level keys: ${keys.join(', ') || '(none)'}`);
    console.log(`SKCS use: ${endpoint.skcsUse}`);
    console.log('Safe preview:');
    console.log(safePreview(payload || null));
}

function decideRecommendedRole(summary) {
    if (!summary.listByDateWorks || !summary.cricketEidFound) {
        return 'not useful for cricket';
    }

    const hasInfo = summary.detailWorks['get-info'] === true;
    const hasAnyExtra = ['get-h2h', 'get-pregame-form', 'get-statistics'].some((k) => summary.detailWorks[k] === true);

    if (hasInfo && hasAnyExtra) return 'cricket top-10 enrichment provider';
    if (summary.listByDateWorks) return 'cricket fixture fallback';
    return 'not useful for cricket';
}

async function testListByDate(context, summary) {
    console.log('\n[STEP 1] list-by-date Category=cricket');

    const today = new Date();
    for (const dayOffset of LIST_DAYS) {
        const date = new Date(today);
        date.setUTCDate(today.getUTCDate() + dayOffset);

        const query = {
            Category: 'cricket',
            Date: formatYyyyMmDd(date),
            Timezone: 2
        };

        const result = await callApi(context, '/matches/v2/list-by-date', query);
        if (result.blockedByBudget) {
            console.log('\nCall budget reached before finishing list-by-date checks.');
            break;
        }

        printListResult('/matches/v2/list-by-date', query, result, true);

        const usable = result.status === 200 && isUsablePayload(result.payload, true);
        if (!usable) {
            continue;
        }

        summary.listByDateWorks = true;

        const items = findItemsArray(result.payload);
        for (const item of items) {
            if (!containsCricketKeywords(safePreview(item, 1000))) continue;

            const event = findFirstEventObject(item);
            const eid = findEid(event || item);
            if (!eid) continue;

            summary.cricketEidFound = true;
            summary.eid = eid;
            summary.fixtureMeta = extractFixtureMeta(item);
            return;
        }
    }
}

async function testDetails(context, summary) {
    if (!summary.cricketEidFound) {
        console.log('\nNo cricket Eid found within safe call budget.');
        console.log('Do not test detail endpoints.');
        return;
    }

    console.log('\n[STEP 3] detail endpoints Category=cricket');
    console.log(`Using Eid: ${summary.eid}`);
    console.log(`Fixture meta: ${safePreview(summary.fixtureMeta)}`);

    for (const endpoint of detailEndpoints) {
        if (context.callsUsed >= MAX_CALLS) {
            console.log('\nCall budget reached before all detail endpoints were tested.');
            return;
        }

        const params =
            endpoint.name === 'get-lineups'
                ? { Category: 'cricket', Eid: summary.eid }
                : { Eid: summary.eid, Category: 'cricket' };

        const query = Object.entries(params)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join('&');

        const result = await callApi(context, endpoint.path, params);
        if (result.blockedByBudget) {
            console.log('\nCall budget reached before all detail endpoints were tested.');
            return;
        }

        const baseUsable = result.status === 200 && isUsablePayload(result.payload, false);
        const usable = baseUsable && (isMeaningfulObjectPayload(result.payload) || hasCricketLookingContent(result.payload));
        summary.detailWorks[endpoint.name] = usable;

        printDetailResult(endpoint, query, result, usable);
    }
}

async function testNewsIfBudgetAllows(context, summary) {
    if (context.callsUsed >= MAX_CALLS) {
        console.log('\n[STEP 4] news endpoint skipped due to call budget.');
        return;
    }

    console.log('\n[STEP 4] news endpoint');

    const params = {
        countryCode: 'US',
        locale: 'en',
        bet: 'true'
    };

    const result = await callApi(context, '/news/v3/list', params);
    if (result.blockedByBudget) {
        console.log('News endpoint skipped due to call budget.');
        return;
    }

    const usable = result.status === 200 && !isEmptyValue(result.payload);
    summary.newsTested = true;
    summary.newsUsable = usable;

    const query = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');

    console.log(`\nEndpoint: /news/v3/list?${query}`);
    console.log(`HTTP status: ${result.status || 'n/a'}`);
    console.log(`Rate-limit remaining: ${result.rateRemaining}`);
    console.log(`Usable: ${usable ? 'yes' : 'no'}`);
    console.log(`Top-level keys: ${getTopLevelKeys(result.payload).join(', ') || '(none)'}`);
    console.log('Safe preview:');
    console.log(safePreview(result.payload || null));
}

function printFinalSummary(context, summary) {
    const role = decideRecommendedRole(summary);

    console.log('\nSKCS Livescore6 Cricket Provider Summary\n');
    console.log(`Total calls used: ${context.callsUsed}`);
    console.log(`Rate-limit remaining: ${context.lastRateRemaining}`);
    console.log(`Category=cricket list-by-date works: ${summary.listByDateWorks ? 'yes' : 'no'}`);
    console.log(`Cricket Eid found: ${summary.cricketEidFound ? 'yes' : 'no'}`);
    console.log(`Match info works: ${summary.detailWorks['get-info'] ? 'yes' : 'no'}`);
    console.log(`H2H works: ${summary.detailWorks['get-h2h'] ? 'yes' : 'no'}`);
    console.log(`Pregame form works: ${summary.detailWorks['get-pregame-form'] ? 'yes' : 'no'}`);
    console.log(`Statistics works: ${summary.detailWorks['get-statistics'] ? 'yes' : 'no'}`);
    console.log(`Lineups works: ${summary.detailWorks['get-lineups'] ? 'yes' : 'no'}`);
    console.log(`News tested: ${summary.newsTested ? 'yes' : 'no'}`);
    console.log(`Recommended provider role: ${role}`);
}

async function main() {
    const config = loadConfig();
    if (!config.apiKey) {
        console.error('Missing API key. Set RAPIDAPI_LIVESCORE6_KEY or RAPIDAPI_KEY or X_RAPIDAPI_KEY.');
        process.exit(1);
    }

    const context = {
        config,
        callsUsed: 0,
        lastRateRemaining: 'unknown'
    };

    const summary = {
        listByDateWorks: false,
        cricketEidFound: false,
        eid: null,
        fixtureMeta: null,
        detailWorks: {
            'get-info': false,
            'get-h2h': false,
            'get-pregame-form': false,
            'get-statistics': false,
            'get-lineups': false
        },
        newsTested: false,
        newsUsable: false
    };

    await testListByDate(context, summary);
    await testDetails(context, summary);
    await testNewsIfBudgetAllows(context, summary);
    printFinalSummary(context, summary);
}

main().catch((error) => {
    console.error('Discovery script failed:', error.message);
    process.exit(1);
});
