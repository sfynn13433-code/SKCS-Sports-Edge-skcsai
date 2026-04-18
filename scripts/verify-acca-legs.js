require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    const r = await pool.query(`
        SELECT id, recommendation, 
               jsonb_array_length(matches) as legs,
               tier, type
        FROM predictions_final 
        WHERE type = 'acca' AND recommendation IN ('Standard 6-Fold', 'Mega 12-Fold')
    `);
    console.log('Accas with leg count:', JSON.stringify(r.rows, null, 2));
    await pool.end();
    process.exit(0);
})();