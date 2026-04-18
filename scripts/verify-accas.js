require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    const r = await pool.query("SELECT id, tier, type, recommendation, total_confidence FROM predictions_final WHERE type = 'acca'");
    console.log('Accas in predictions_final:', JSON.stringify(r.rows, null, 2));
    await pool.end();
    process.exit(0);
})();