'use strict';

require('dotenv').config();
require('dotenv').config({ path: 'backend/.env', override: false });

const { fetchFootball536Endpoint } = require('../backend/services/football536Service');
const { extractFootball536Fixtures } = require('../backend/services/football536Extractor');

function safeKeys(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : [];
}

function safePreview(value, maxChars = 3000) {
    let text;
    try {
        text = JSON.stringify(value, null, 2);
    } catch (error) {
        text = String(value);
    }
    if (!text) return '';
    return text.length <= maxChars ? text : `${text.slice(0, maxChars)}...<truncated>`;
}

function getByPath(obj, path) {
    return String(path || '')
        .split('.')
        .reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);
}

function buildCoverage(fixtures, fields) {
    const total = Array.isArray(fixtures) ? fixtures.length : 0;
    const out = {};
    for (const field of fields) {
        const populated = fixtures.filter((fixture) => {
            const value = getByPath(fixture, field);
            return value !== undefined && value !== null && value !== '';
        }).length;
        out[field] = { populated, total };
    }
    return out;
}

async function run() {
    const endpoint = '/fixtures';
    const params = { league_id: 2 };
    const result = await fetchFootball536Endpoint(endpoint, params);
    const normalizedFixtures = extractFootball536Fixtures(result?.data);

    const coverageFields = [
        'provider_fixture_id',
        'kickoff_time',
        'status',
        'league.name',
        'home_team.name',
        'away_team.name',
        'score.home',
        'score.away',
        'goals.home',
        'goals.away',
        'provider_ids.league_id',
        'provider_ids.season_id',
        'provider_ids.home_team_id',
        'provider_ids.away_team_id'
    ];
    const coverage = buildCoverage(normalizedFixtures, coverageFields);

    const firstRawFixture = Array.isArray(result?.data?.data) && result.data.data.length > 0
        ? result.data.data[0]
        : (Array.isArray(result?.data) && result.data.length > 0 ? result.data[0] : null);
    const firstNestedKeys = normalizedFixtures[0]?.nested_keys || {};

    console.log('provider:', result?.provider || null);
    console.log('endpoint:', result?.endpoint || endpoint);
    console.log('params:', result?.params || params);
    console.log('HTTP status:', result?.status ?? null);
    console.log('rate limit:', result?.rateLimit || null);
    console.log('raw top-level keys:', safeKeys(result?.data));
    console.log('normalized fixture count:', normalizedFixtures.length);
    console.log('first 5 normalized fixtures:', normalizedFixtures.slice(0, 5));
    console.log('field coverage summary:', coverage);
    console.log('nested_keys for first fixture:', firstNestedKeys);
    console.log('safe raw first fixture preview max 3000 chars:');
    console.log(safePreview(firstRawFixture, 3000));

    if (!result?.ok) {
        console.log('error:', result?.error || null);
        console.log('details:', result?.details || null);
        process.exitCode = 1;
    }
}

run().catch((error) => {
    console.error('Unexpected failure:', error?.message || error);
    process.exitCode = 1;
});
