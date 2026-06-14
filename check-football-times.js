require('dotenv').config({ path: require('path').resolve(__dirname, 'backend', '.env') });
const pool = require('./backend/database');

async function checkTimes() {
    try {
        console.log('--- Deep Dive ---');
        
        // 1. Raw Fixtures (Future)
        const res1 = await pool.query("SELECT COUNT(*) as c FROM raw_fixtures WHERE start_time >= NOW() - INTERVAL '2 hours'");
        console.log(`Upcoming/Recent raw_fixtures: ${res1.rows[0].c}`);

        // 2. Publish Runs
        const res2 = await pool.query("SELECT MAX(created_at) as m FROM prediction_publish_runs");
        console.log(`Latest publish run: ${res2.rows[0].m}`);

        // 3. Final Predictions by Sport
        const res3 = await pool.query("SELECT sport, COUNT(*) as c FROM direct1x2_prediction_final GROUP BY sport");
        console.log(`Final Predictions Breakdown:`);
        res3.rows.forEach(r => console.log(`  - ${r.sport}: ${r.c}`));

    } catch (e) {
        console.error('Failed:', e);
    } finally {
        // Exit process to avoid pool.end() error
        process.exit(0);
    }
}
checkTimes();
