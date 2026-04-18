const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function addColumns() {
    const client = await pool.connect();
    try {
        // Add missing columns to events table
        await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT`);
        await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS home_score INTEGER`);
        await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS away_score INTEGER`);
        console.log('Added status, home_score, away_score columns to events table');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        client.release();
    }
    await pool.end();
    process.exit(0);
}

addColumns();