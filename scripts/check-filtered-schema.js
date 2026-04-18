const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'predictions_filtered' ORDER BY ordinal_position");
    console.log('predictions_filtered schema:', JSON.stringify(r.rows, null, 2));
    await pool.end();
    process.exit(0);
})();