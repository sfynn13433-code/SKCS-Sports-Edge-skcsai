const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkEventsSchema() {
    const cols = await pool.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'events' ORDER BY ordinal_position");
    console.log('Events table schema:');
    console.log(JSON.stringify(cols.rows, null, 2));
    
    await pool.end();
    process.exit(0);
}

checkEventsSchema();