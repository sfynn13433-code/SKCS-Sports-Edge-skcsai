const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkPredictions() {
    try {
        console.log('Checking predictions_final table...');
        
        const countResult = await pool.query('SELECT COUNT(*) as total FROM predictions_final');
        console.log('Total rows:', countResult.rows[0].total);
        
        const recentResult = await pool.query('SELECT id, market, prediction, confidence, created_at FROM predictions_final ORDER BY created_at DESC LIMIT 10');
        console.log('Recent rows:', JSON.stringify(recentResult.rows, null, 2));
        
        const sportResult = await pool.query("SELECT sport, COUNT(*) as count FROM predictions_final GROUP BY sport ORDER BY count DESC");
        console.log('By sport:', JSON.stringify(sportResult.rows, null, 2));
        
        await pool.end();
        process.exit(0);
    } catch(e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

checkPredictions();