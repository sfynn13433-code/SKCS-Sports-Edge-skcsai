const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'predictions_accuracy' AND column_name LIKE '%time%' OR column_name LIKE '%date%'");
    console.log('predictions_accuracy timestamp cols:', r.rows);
    await pool.end();
})();