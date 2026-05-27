require('dotenv').config();
const { apiSportsUrls } = require('../backend/config/apiEndpoints');

async function testApiSportsFetch() {
    console.log('🚀 Initiating secure connection to API-Sports (Football)...');

    // We will ask for exactly 1 fixture ID just to see the data structure
    // (You can replace 158169 with any valid match ID from your logs)
    const testFixtureId = 158169;
    const url = `${apiSportsUrls.football}/fixtures?id=${testFixtureId}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-apisports-key': process.env.X_APISPORTS_KEY
            }
        });

        const data = await response.json();

        if (data.errors && Object.keys(data.errors).length > 0) {
            console.error('❌ API returned an error:', data.errors);
            return;
        }

        console.log('✅ Success! Connection established.');
        console.log(`📊 Calls Remaining Today: ${response.headers.get('x-ratelimit-remaining')}`);
        console.log('\n👇 HERE IS YOUR RAW MATCH DATA 👇\n');

        // Print the JSON beautifully to the terminal
        console.dir(data.response?.[0], { depth: null, colors: true });
    } catch (error) {
        console.error('🛑 Network Error:', error.message);
    }
}

testApiSportsFetch();
