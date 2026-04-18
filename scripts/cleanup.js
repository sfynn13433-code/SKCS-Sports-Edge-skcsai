const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function cleanup() {
    try {
        console.log('Starting cleanup...');
        
        await pool.query("DELETE FROM predictions_final WHERE matches::text LIKE '%Unknown%'");
        console.log('Deleted Unknown matches');
        
        await pool.query("DELETE FROM predictions_final WHERE recommendation LIKE '%RED CARDS%'");
        console.log('Deleted RED CARDS predictions');
        
        await pool.query('ALTER TABLE tier_rules DROP CONSTRAINT IF EXISTS tier_rules_tier_check');
        console.log('Dropped tier_rules constraint');
        
        await pool.end();
        console.log('Cleanup complete');
        process.exit(0);
    } catch(e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

cleanup();