require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    const r = await pool.query('SELECT COUNT(*) as cnt FROM predictions_filtered');
    console.log('predictions_filtered:', r.rows[0].cnt);
    
    const f = await pool.query("SELECT COUNT(*) as cnt FROM predictions_final WHERE type = 'acca'");
    console.log('predictions_final acca:', f.rows[0].cnt);
    
    // Check events for future matches
    const e = await pool.query(`
        SELECT COUNT(*) as cnt FROM events 
        WHERE commence_time > NOW() AND status != 'FT'
    `);
    console.log('future events:', e.rows[0].cnt);
    
    await pool.end();
    process.exit(0);
})();