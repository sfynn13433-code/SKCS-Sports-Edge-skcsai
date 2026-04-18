require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    const e = await pool.query(`
        SELECT status, COUNT(*) as cnt 
        FROM events 
        GROUP BY status
    `);
    console.log('Events by status:', JSON.stringify(e.rows, null, 2));
    
    const f = await pool.query(`
        SELECT * FROM events 
        WHERE commence_time > NOW()
        LIMIT 5
    `);
    console.log('Future events:', JSON.stringify(f.rows, null, 2));
    
    await pool.end();
    process.exit(0);
})();