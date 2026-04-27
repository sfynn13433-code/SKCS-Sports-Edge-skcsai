require('dotenv').config({ path: 'backend/.env' });

const { fetchCricbuzzMatches, normalizeCricbuzzData } = require('../backend/services/cricbuzzService');

async function test() {
    console.log('Testing Cricbuzz service...\n');
    
    const raw = await fetchCricbuzzMatches();
    
    if (!raw) {
        console.log('❌ No data received');
        process.exit(1);
    }
    
    console.log('✅ Data received');
    
    const matches = normalizeCricbuzzData(raw);
    console.log(`✅ Matches found: ${matches.length}\n`);
    
    matches.slice(0, 5).forEach(m => {
        console.log(`   ${m.team1} vs ${m.team2} [${m.status}]`);
    });
    
    process.exit(0);
}

test().catch(e => {
    console.log('Error:', e.message);
    process.exit(1);
});