require('dotenv').config();

const axios = require('axios');

console.log('=== DEBUGGING API KEY ===');
console.log('X_APISPORTS_KEY:', process.env.X_APISPORTS_KEY ? 'SET' : 'NOT SET');
console.log('RAPIDAPI_KEY:', process.env.RAPIDAPI_KEY ? 'SET' : 'NOT SET');

// Try direct call
const testKey = process.env.X_APISPORTS_KEY || process.env.RAPIDAPI_KEY;

if (!testKey) {
    console.log('NO API KEY FOUND!');
    process.exit(1);
}

console.log('\n=== TESTING WITH KEY ===');
console.log('Key (first 10 chars):', testKey.substring(0, 10) + '...');

async function test() {
    try {
        // Try different endpoints
        const response = await axios.get('https://v3.football.api-sports.io/fixtures', {
            params: { date: '2026-04-16' },
            headers: { 
                'x-apisports-key': testKey,
                'x-rapidapi-host': 'v3.football.api-sports.io'
            },
            timeout: 15000
        });
        console.log('Status:', response.status);
        console.log('Results:', response.data.results);
    } catch (err) {
        console.log('Error:', err.message);
        console.log('Response status:', err.response?.status);
        console.log('Response data:', err.response?.data);
    }
}

test();