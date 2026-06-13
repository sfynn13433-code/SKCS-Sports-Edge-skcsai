/**
 * Direct ESPN Hidden API test
 * Tests the exact URL patterns used by dataProvider.js
 */

async function testESPN() {
    const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';
    
    const leagues = [
        { sport: 'soccer', league: 'eng.1', name: 'EPL' },
        { sport: 'soccer', league: 'esp.1', name: 'La Liga' },
        { sport: 'soccer', league: 'ita.1', name: 'Serie A' },
        { sport: 'soccer', league: 'ger.1', name: 'Bundesliga' },
        { sport: 'soccer', league: 'fra.1', name: 'Ligue 1' },
        { sport: 'soccer', league: 'usa.1', name: 'MLS' },
        { sport: 'soccer', league: 'uefa.champions', name: 'UCL' },
    ];

    // Build date range like dataProvider does
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 3);
    
    const fmtDate = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
    const dateParam = `${fmtDate(today)}-${fmtDate(end)}`;
    
    console.log('========================================');
    console.log('ESPN HIDDEN API DIRECT TEST');
    console.log(`Date range param: ${dateParam}`);
    console.log('========================================\n');

    for (const { sport, league, name } of leagues) {
        // Test WITH date range
        const urlWithDates = `${ESPN_BASE_URL}/${sport}/${league}/scoreboard?dates=${dateParam}`;
        console.log(`\n--- ${name} (with dates) ---`);
        console.log(`URL: ${urlWithDates}`);
        
        try {
            const res = await fetch(urlWithDates);
            console.log(`Status: ${res.status}`);
            
            if (res.ok) {
                const data = await res.json();
                const events = data.events || [];
                console.log(`Events found: ${events.length}`);
                
                if (events.length > 0) {
                    const pre = events.filter(e => e.status?.type?.state === 'pre');
                    const inProg = events.filter(e => e.status?.type?.state === 'in');
                    const post = events.filter(e => e.status?.type?.state === 'post');
                    console.log(`  Pre (upcoming): ${pre.length}, In-progress: ${inProg.length}, Post (completed): ${post.length}`);
                    
                    // Show first event
                    const first = events[0];
                    const comps = first.competitions?.[0]?.competitors || [];
                    const home = comps.find(c => c.homeAway === 'home')?.team?.displayName;
                    const away = comps.find(c => c.homeAway === 'away')?.team?.displayName;
                    console.log(`  Sample: ${home} vs ${away} | State: ${first.status?.type?.state} | Date: ${first.date}`);
                }
            } else {
                const text = await res.text();
                console.log(`Error body: ${text.slice(0, 200)}`);
            }
        } catch (err) {
            console.log(`Fetch error: ${err.message}`);
        }

        // Test WITHOUT date range
        const urlNoDates = `${ESPN_BASE_URL}/${sport}/${league}/scoreboard`;
        console.log(`\n--- ${name} (no dates) ---`);
        console.log(`URL: ${urlNoDates}`);
        
        try {
            const res = await fetch(urlNoDates);
            if (res.ok) {
                const data = await res.json();
                const events = data.events || [];
                console.log(`Events found: ${events.length}`);
                
                if (events.length > 0) {
                    const pre = events.filter(e => e.status?.type?.state === 'pre');
                    const inProg = events.filter(e => e.status?.type?.state === 'in');
                    const post = events.filter(e => e.status?.type?.state === 'post');
                    console.log(`  Pre (upcoming): ${pre.length}, In-progress: ${inProg.length}, Post (completed): ${post.length}`);
                }
            }
        } catch (err) {
            console.log(`Fetch error: ${err.message}`);
        }
    }
}

testESPN().catch(console.error);
