require('dotenv').config();

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    // Check cache table
    const r = await pool.query('SELECT cache_key, provider_name, updated_at FROM rapidapi_cache ORDER BY updated_at DESC LIMIT 5');
    console.log('Cache entries:', JSON.stringify(r.rows, null, 2));
    await pool.end();
    process.exit(0);
})();