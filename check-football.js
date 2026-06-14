require('dotenv').config({ path: require('path').resolve(__dirname, 'backend', '.env') });
const pool = require('./backend/database');

async function checkFootballData() {
    try {
        console.log('--- DB Check ---');
        
        // 1. Upcoming fixtures
        // The table is usually named "fixtures" or "raw_fixtures". Let's try "fixtures".
        let upcomingFixtures = 0;
        try {
            const res1 = await pool.query("SELECT COUNT(*) FROM fixtures WHERE match_date >= NOW()");
            upcomingFixtures = res1.rows[0].count;
        } catch(e) {
            console.log('fixtures table error:', e.message);
        }

        // 2. Recent publish runs
        let recentRuns = 0;
        try {
            const res2 = await pool.query("SELECT COUNT(*) FROM prediction_publish_runs WHERE created_at >= NOW() - INTERVAL '24 hours'");
            recentRuns = res2.rows[0].count;
        } catch(e) {
            console.log('publish runs error:', e.message);
        }

        // 3. Football finals
        let footballFinals = 0;
        try {
            const res3 = await pool.query("SELECT COUNT(*) FROM direct1x2_prediction_final WHERE sport='Football'");
            footballFinals = res3.rows[0].count;
        } catch(e) {
            console.log('direct1x2_prediction_final error:', e.message);
        }

        console.log({
            upcoming_fixtures: parseInt(upcomingFixtures),
            recent_publish_runs: parseInt(recentRuns),
            football_finals: parseInt(footballFinals)
        });

    } catch (e) {
        console.error('Connection failed:', e);
    } finally {
        pool.end();
    }
}

checkFootballData();
