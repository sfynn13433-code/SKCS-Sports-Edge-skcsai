const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    const result = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'predictions_accuracy' ORDER BY ordinal_position`);
    console.log('predictions_accuracy schema:', JSON.stringify(result.rows, null, 2));
    await pool.end();
    process.exit(0);
}

check();