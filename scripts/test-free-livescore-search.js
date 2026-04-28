'use strict';

require('dotenv').config();
require('dotenv').config({ path: 'backend/.env', override: false });

const { fetchFreeLivescoreSearch } = require('../backend/services/freeLivescoreApiService');
const { extractFreeLivescoreSearch } = require('../backend/services/freeLivescoreApiExtractor');

function safePreview(value, maxLength = 3000) {
    let text;
    try {
        text = JSON.stringify(value, null, 2);
    } catch (error) {
        text = String(value);
    }
    if (!text) return '';
    return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...<truncated>`;
}

async function run() {
    const sportname = String(process.argv[2] || 'soccer').trim() || 'soccer';
    const search = String(process.argv[3] || 'romania').trim() || 'romania';

    const result = await fetchFreeLivescoreSearch({ sportname, search });
    const normalized = extractFreeLivescoreSearch(result?.data);

    console.log('Provider:', result.provider);
    console.log('Endpoint:', result.endpoint);
    console.log('Params:', result.params);
    console.log('HTTP status:', result.status);
    console.log('OK:', result.ok);
    console.log('Rate limit:', result.rateLimit);
    console.log('Raw top-level keys:', normalized.raw_top_level_keys);
    console.log('Response keys:', normalized.response_keys);
    console.log('Sorting:', normalized.sorting);
    console.log('Counts:', normalized.counts);
    console.log('First 5 teams:', normalized.teams.slice(0, 5));
    console.log('First 5 stages:', normalized.stages.slice(0, 5));
    console.log('First 5 categories:', normalized.categories.slice(0, 5));
    console.log('Safe raw preview max 3000 chars:');
    console.log(safePreview(result?.data, 3000));

    if (!result.ok) {
        console.log('Error:', result.error);
        console.log('Details:', result.details);
        process.exitCode = 1;
    }
}

run().catch((error) => {
    console.error('Unexpected failure:', error?.message || error);
    process.exitCode = 1;
});
