'use strict';

require('dotenv').config();
const axios = require('axios');

async function test() {
    const key = process.env.BIG_BALLS_DATA_API_KEY || process.env.BBS_API_KEY;
    const baseUrl = process.env.BIG_BALLS_BASE_URL || 'https://api.bigballsports.com';

    console.log('========================================');
    console.log('BIG BALLS API DIRECT TEST');
    console.log('========================================');
    console.log('Base URL:', baseUrl);
    console.log('API Key:', key ? `${key.substring(0, 10)}...` : 'MISSING');

    if (!key) {
        console.error('Error: BIG_BALLS_DATA_API_KEY is missing from .env');
        return;
    }

    const path = '/v1/stored/matches';
    const url = `${baseUrl}${path}`;
    const params = { sport: 'football', league: 'mls', limit: 5 };
    const headers = { Authorization: `Bearer ${key}` };

    console.log(`\nFetching: ${url}`);
    console.log('Params:', params);

    try {
        const response = await axios.get(url, { headers, params, timeout: 10000 });
        console.log('\nStatus:', response.status);
        console.log('Headers:', response.headers);
        console.log('Response Body:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('\nAPI Request Failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response Data:', error.response.data);
        } else {
            console.error('Message:', error.message);
        }
    }
}

test().catch(console.error);
