const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkEvents() {
    const result = await pool.query('SELECT COUNT(*) as cnt FROM events');
    console.log('Events table:', result.rows[0].cnt, 'rows');
    
    const sample = await pool.query('SELECT * FROM events LIMIT 3');
    console.log('Sample:', JSON.stringify(sample.rows, null, 2));
    
    await pool.end();
    process.exit(0);
}

checkEvents();