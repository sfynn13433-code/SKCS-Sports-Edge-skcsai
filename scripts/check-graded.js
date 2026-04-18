const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    const result = await pool.query(`
        SELECT id, home_team, away_team, commence_time, status, home_score, away_score
        FROM events
        WHERE status = 'FT'
        ORDER BY commence_time DESC
        LIMIT 10
    `);
    console.log('FT matches:', JSON.stringify(result.rows, null, 2));
    
    const accResult = await pool.query('SELECT COUNT(*) as cnt FROM predictions_accuracy');
    console.log('predictions_accuracy count:', accResult.rows[0].cnt);
    
    await pool.end();
    process.exit(0);
}

check();