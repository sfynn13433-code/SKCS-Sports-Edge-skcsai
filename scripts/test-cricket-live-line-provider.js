'use strict';

require('dotenv').config();
require('dotenv').config({ path: 'backend/.env' });

const axios = require('axios');

const BASE_URL = 'https://cricket-live-line1.p.rapidapi.com';
const LIST_ENDPOINTS = ['/upcomingMatches', '/liveMatches', '/recentMatches'];
const DETAIL_ENDPOINTS = [
    '/matchInfo',
    '/matchLineLine',
    '/matchScorecard',
    '/matchCommentary',
    '/matchOverHistory',
    '/matchPlaying11',
    '/matchSquads',
    '/matchBenchPlayers',
    '/matchImpactPlayers',
    '/matchOdds',
    '/matchFancy',
    '/matchStats',
    '/matchTeamLastWins',
    '/matchTeamLastTossWins',
    '/matchTeamStats',
    '/matchTeamComparison'
];
const DETAIL_PARAM_KEYS = ['match_id', 'matchId', 'id'];
const MATCH_ID_FIELDS = ['match_id', 'matchId', 'matchid', 'match_key', 'id', 'cid'];

const capabilityMap = {
    '/matchInfo': 'fixture enrichment',
    '/matchLineLine': 'live match state',
    '/matchScorecard': 'scorecard / innings / runs / wickets',
    '/matchCommentary': 'live commentary context',
    '/matchOverHistory': 'over-by-over momentum',
    '/matchPlaying11': 'confirmed playing XI',
    '/matchSquads': 'squad/player pool',
    '/matchBenchPlayers': 'bench/depth context',
    '/matchImpactPlayers': 'impact player context',
    '/matchOdds': 'odds snapshot',
    '/matchFancy': 'fancy market snapshot',
    '/matchStats': 'match stats',
    '/matchTeamLastWins': 'team recent win form',
    '/matchTeamLastTossWins': 'toss trend',
    '/matchTeamStats': 'team stats',
    '/matchTeamComparison': 'team comparison stats'
};

function loadConfig() {
    const apiKey =
        process.env.RAPIDAPI_CRICKET_LIVE_LINE_KEY ||
        process.env.RAPIDAPI_KEY ||
        process.env.X_RAPIDAPI_KEY;

    const host = process.env.RAPIDAPI_HOST_CRICKET_LIVE_LINE || 'cricket-live-line1.p.rapidapi.com';

    return { apiKey, host };
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
    return false;
}

function isUsablePayload(payload) {
    if (payload === null || payload === undefined) return false;

    if (payload.status === false && isEmptyValue(payload.data)) {
        return false;
    }

    if (isPlainObject(payload)) {
        if (!isEmptyValue(payload.data)) return true;
        return Object.keys(payload).length > 0;
    }

    if (Array.isArray(payload)) return payload.length > 0;

    return true;
}

function getTopLevelKeys(payload) {
    if (!payload || typeof payload !== 'object') return [];
    return Object.keys(payload);
}

function findItemsArray(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.data)) return payload.data;

    if (isPlainObject(payload.data)) {
        const values = Object.values(payload.data);
        const arrayCandidate = values.find((value) => Array.isArray(value) && value.length > 0);
        if (arrayCandidate) return arrayCandidate;
    }

    if (isPlainObject(payload)) {
        const values = Object.values(payload);
        const arrayCandidate = values.find((value) => Array.isArray(value) && value.length > 0);
        if (arrayCandidate) return arrayCandidate;
    }

    return [];
}

function findMatchId(item) {
    if (!item || typeof item !== 'object') return null;
    for (const field of MATCH_ID_FIELDS) {
        const value = item[field];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return { field, value: String(value).trim() };
        }
    }
    return null;
}

async function requestEndpoint(config, endpoint, params = {}) {
    const url = `${BASE_URL}${endpoint}`;

    try {
        const response = await axios.get(url, {
            params,
            timeout: 20000,
            headers: {
                'Content-Type': 'application/json',
                'x-rapidapi-host': config.host,
                'x-rapidapi-key': config.apiKey
            }
        });

        return {
            ok: true,
            status: response.status,
            payload: response.data
        };
    } catch (error) {
        const status = error?.response?.status || null;
        const payload = error?.response?.data;
        return {
            ok: false,
            status,
            payload,
            error: error.message
        };
    }
}

async function testListEndpoints(config) {
    const results = [];
    let discoveredMatch = null;

    console.log('\n[LIST ENDPOINTS]');

    for (const endpoint of LIST_ENDPOINTS) {
        const result = await requestEndpoint(config, endpoint);
        const payload = result.payload;
        const topLevelKeys = getTopLevelKeys(payload);
        const items = findItemsArray(payload);
        const firstItem = items[0];
        const usable = result.status === 200 && isUsablePayload(payload);

        if (usable) {
            console.log(`\n✅ ${endpoint}`);
        } else {
            console.log(`\n⚠️ ${endpoint}`);
        }
        console.log(`HTTP: ${result.status || 'n/a'}`);
        console.log(`Top-level keys: ${topLevelKeys.length ? topLevelKeys.join(', ') : '(none)'}`);
        console.log(`Items found: ${items.length}`);
        console.log('First item preview:');
        console.log(safePreview(firstItem || payload || null));

        if (!discoveredMatch && firstItem) {
            const match = findMatchId(firstItem);
            if (match) {
                discoveredMatch = match;
                console.log('\n✅ Discovered match ID');
                console.log(`Field: ${match.field}`);
                console.log(`Value: ${match.value}`);
            }
        }

        results.push({
            endpoint,
            type: 'list',
            status: result.status,
            usable,
            topLevelKeys,
            itemsFound: items.length,
            hasMatchId: Boolean(discoveredMatch)
        });
    }

    return { results, discoveredMatch };
}

async function testDetailEndpoints(config, matchId) {
    const results = [];

    console.log('\n[DETAIL ENDPOINTS]');

    if (!matchId) {
        console.log('\n⚠️ No match ID discovered from list endpoints. Skipping detail checks.');
        return results;
    }

    for (const endpoint of DETAIL_ENDPOINTS) {
        let endpointResult = null;
        const attemptedParams = [];

        for (const paramKey of DETAIL_PARAM_KEYS) {
            attemptedParams.push(paramKey);
            const params = { [paramKey]: matchId };
            const result = await requestEndpoint(config, endpoint, params);
            const usable = result.status === 200 && isUsablePayload(result.payload);

            if (usable) {
                endpointResult = {
                    endpoint,
                    status: result.status,
                    usable,
                    topLevelKeys: getTopLevelKeys(result.payload),
                    matchedParam: paramKey,
                    payload: result.payload
                };
                break;
            }
        }

        if (endpointResult) {
            console.log(`\n✅ ${endpoint}?${endpointResult.matchedParam}=${matchId}`);
            console.log('Usable: yes');
            console.log(`Top-level keys: ${endpointResult.topLevelKeys.join(', ') || '(none)'}`);
            console.log(`Useful for: ${capabilityMap[endpoint] || 'analysis'}`);
        } else {
            console.log(`\n⚠️ ${endpoint}`);
            console.log('No usable response.');
            console.log(`Tried params: ${attemptedParams.join(', ')}`);
        }

        results.push({
            endpoint,
            type: 'detail',
            usable: Boolean(endpointResult),
            status: endpointResult?.status || null,
            matchedParam: endpointResult?.matchedParam || null,
            topLevelKeys: endpointResult?.topLevelKeys || [],
            attemptedParams
        });
    }

    return results;
}

function printCapabilitySummary(listResults, detailResults) {
    const usableLists = listResults.some((result) => result.usable);
    const detailByEndpoint = new Map(detailResults.map((result) => [result.endpoint, result]));

    function has(endpoint) {
        return detailByEndpoint.get(endpoint)?.usable === true;
    }

    console.log('\n[PROVIDER CAPABILITY SUMMARY]\n');
    console.log(`Fixture list available: ${usableLists ? 'yes' : 'no'}`);
    console.log(`Match info available: ${has('/matchInfo') ? 'yes' : 'no'}`);
    console.log(`Scorecard available: ${has('/matchScorecard') ? 'yes' : 'no'}`);
    console.log(`Playing XI available: ${has('/matchPlaying11') ? 'yes' : 'no'}`);
    console.log(`Squad available: ${has('/matchSquads') ? 'yes' : 'no'}`);
    console.log(`Team stats available: ${has('/matchTeamStats') ? 'yes' : 'no'}`);
    console.log(`Team comparison available: ${has('/matchTeamComparison') ? 'yes' : 'no'}`);
    console.log(`Last wins available: ${has('/matchTeamLastWins') ? 'yes' : 'no'}`);
    console.log(`Toss trends available: ${has('/matchTeamLastTossWins') ? 'yes' : 'no'}`);
    console.log(`Odds/fancy available: ${has('/matchOdds') || has('/matchFancy') ? 'yes' : 'no'}`);
    console.log(`Commentary/live context available: ${has('/matchCommentary') || has('/matchLineLine') ? 'yes' : 'no'}`);
}

async function main() {
    const config = loadConfig();

    console.log('SKCS Cricket Live Line Provider Discovery');
    console.log(`Host: ${config.host}`);

    if (!config.apiKey) {
        console.error('\nMissing RapidAPI key. Set one of: RAPIDAPI_CRICKET_LIVE_LINE_KEY, RAPIDAPI_KEY, X_RAPIDAPI_KEY');
        process.exit(1);
    }

    const { results: listResults, discoveredMatch } = await testListEndpoints(config);
    const detailResults = await testDetailEndpoints(config, discoveredMatch?.value || null);

    printCapabilitySummary(listResults, detailResults);
}

main().catch((error) => {
    console.error('\nProvider discovery failed:', error.message);
    process.exit(1);
});
