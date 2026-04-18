const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    const result = await pool.query(`
        SELECT id, home_team, away_team, commence_time, status, home_score, away_score
        FROM events
        WHERE commence_time < NOW() - INTERVAL '3 hours'
        ORDER BY commence_time DESC
        LIMIT 10
    `);
    console.log('Old matches:', JSON.stringify(result.rows, null, 2));
    await pool.end();
    process.exit(0);
}

check();