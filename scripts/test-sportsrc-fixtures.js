'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const dataProvider = require('../backend/services/dataProvider');

async function testFixtures() {
    console.log('=== SKCS SportSRC Integration Test ===');
    try {
        console.log('\n1. Calling buildLiveData() for Football...');
        // We will fetch for the next 24 hours
        const fixtures = await dataProvider.buildLiveData('football', 1);
        
        console.log(`\n✅ Successfully pulled ${fixtures.length} fixtures!`);
        
        const sportsrcFixtures = fixtures.filter(f => f.provider === 'sportsrc');
        console.log(`\n📊 Breakdown: ${sportsrcFixtures.length} came directly from SportSRC.`);
        
        if (sportsrcFixtures.length > 0) {
            console.log('\nSample Fixture:');
            const sample = sportsrcFixtures[0];
            console.log(`Match: ${sample.home_team} vs ${sample.away_team}`);
            console.log(`League: ${sample.league}`);
            console.log(`Status: ${sample.status}`);
            console.log(`Kickoff: ${sample.kickoff_time}`);
            console.log(`Fixture Key: ${sample.fixture_key}`);
        }
        
    } catch (err) {
        console.error('❌ Test failed:', err.message);
    }
    process.exit(0);
}

testFixtures();
