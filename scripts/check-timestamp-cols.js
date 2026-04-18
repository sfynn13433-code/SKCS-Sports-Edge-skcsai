const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    const tables = ['predictions_raw', 'predictions_filtered', 'api_raw', 'scheduling_logs', 'rapidapi_cache'];
    for (const t of tables) {
        const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t}' AND column_name LIKE '%created%' OR column_name LIKE '%updated%' OR column_name LIKE '%started%'`);
        console.log(t + ':', r.rows.map(x => x.column_name));
    }
    await pool.end();
    process.exit(0);
})();