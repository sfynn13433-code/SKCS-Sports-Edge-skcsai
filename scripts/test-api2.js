const axios = require('axios');
const APISPORTS_KEY = process.env.X_APISPORTS_KEY;

async function testFetch() {
    console.log('=== TESTING ACTUAL PIPELINE CODE ===');
    
    const today = new Date();
    const dates = [];
    for (let i = 0; i <= 14; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
    }
    
    console.log('Fetching for dates:', dates.slice(0, 3).join(', '), '...');
    
    const allFixtures = [];
    
    for (const date of dates.slice(0, 3)) { // Just first 3 days
        try {
            const url = `https://v3.football.api-sports.io/fixtures?date=${date}`;
            console.log(`Calling: ${url}`);
            
            const response = await axios.get(url, {
                headers: { 'x-apisports-key': APISPORTS_KEY },
                timeout: 30000
            });
            
            const fixtures = response.data?.response || [];
            console.log(`${date}: ${fixtures.length} fixtures`);
            
            for (const f of fixtures) {
                const home = f.teams?.home?.name;
                const away = f.teams?.away?.name;
                if (home && away) {
                    allFixtures.push({ home, away, date: f.fixture?.date, league: f.league?.name });
                }
            }
            
        } catch (err) {
            console.error(`Error for ${date}:`, err.message);
        }
    }
    
    console.log('\n=== TOTAL VALID FIXTURES ===');
    console.log(allFixtures.length);
    console.log('Sample fixtures:');
    console.log(allFixtures.slice(0, 5));
}

testFetch().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });