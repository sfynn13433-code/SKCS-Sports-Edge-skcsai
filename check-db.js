require('dotenv').config({ path: require('path').resolve(__dirname, 'backend', '.env') });
const pool = require('./backend/database');

async function checkPredictions() {
    try {
        const result = await pool.query('SELECT count(*) as count FROM direct1x2_prediction_final WHERE created_at > NOW() - INTERVAL \'1 hour\'');
        console.log(`New predictions in the last hour: ${result.rows[0].count}`);
        
        if (parseInt(result.rows[0].count) > 0) {
            const sample = await pool.query('SELECT match_id, home_team, away_team, date, provider, tier, analysis_summary FROM direct1x2_prediction_final ORDER BY created_at DESC LIMIT 2');
            console.log('\nSample predictions:');
            console.log(JSON.stringify(sample.rows, null, 2));
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        pool.end();
    }
}

checkPredictions();
