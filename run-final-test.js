require('dotenv').config({ path: require('path').resolve(__dirname, 'backend', '.env') });
const pool = require('./backend/database');

async function runFinalTest() {
    try {
        console.log('--- FINAL SKCS TRUTH TEST ---');
        
        // 1. Upcoming fixtures
        const res1 = await pool.query("SELECT COUNT(*) as c FROM raw_fixtures WHERE start_time >= NOW()");
        console.log(`1. Upcoming raw_fixtures (start_time >= NOW): ${res1.rows[0].c}`);

        // 2. Recent publish runs
        const res2 = await pool.query("SELECT COUNT(*) as c FROM prediction_publish_runs WHERE created_at >= NOW() - INTERVAL '24 hours'");
        console.log(`2. Recent publish_runs (last 24 hours): ${res2.rows[0].c}`);

        // 3. Football finals
        const res3 = await pool.query("SELECT COUNT(*) as c FROM direct1x2_prediction_final WHERE sport = 'Football'");
        console.log(`3. Football direct1x2_prediction_finals: ${res3.rows[0].c}`);

        // 4. Odds coverage
        // In raw_fixtures we don't have an odds column based on earlier inspection, 
        // raw_fixtures columns: id_event, sport, league_id, home_team_id, away_team_id, start_time, status, raw_json, updated_at
        // But we can check raw_json for odds if needed. Let's just output it safely.
        let oddsCount = 'N/A (check raw_json)';
        try {
            const res4 = await pool.query("SELECT COUNT(*) as total, COUNT(raw_json->'odds') as odds_count FROM raw_fixtures WHERE start_time >= NOW()");
            console.log(`4. Upcoming raw_fixtures total: ${res4.rows[0].total}, with odds: ${res4.rows[0].odds_count}`);
        } catch(e) {
            console.log(`4. Odds query skipped (schema check): ${e.message}`);
        }

    } catch (e) {
        console.error('Test failed:', e.message);
    } finally {
        process.exit(0);
    }
}
runFinalTest();
