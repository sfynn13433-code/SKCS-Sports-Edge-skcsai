const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'scheduling_logs' ORDER BY ordinal_position");
    console.log('scheduling_logs schema:', JSON.stringify(r.rows, null, 2));
    await pool.end();
    process.exit(0);
})();