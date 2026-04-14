'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL;

console.log('═'.repeat(60));
console.log('   MIGRATION 2: NORMALIZED FIXTURES (FIXED)');
console.log('═'.repeat(60) + '\n');

const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000
});

async function migrateNormalizedFixtures() {
    // First, check events table structure
    console.log('STEP 1: Checking events table structure...\n');
    
    const structure = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'events'
        ORDER BY ordinal_position
    `);
    
    console.log('Events columns:');
    structure.rows.forEach(c => console.log(`   - ${c.column_name}: ${c.data_type}`));
    
    // Check a sample row
    console.log('\nSample row:');
    const sample = await pool.query('SELECT * FROM events LIMIT 1');
    if (sample.rows.length > 0) {
        console.log(JSON.stringify(sample.rows[0], null, 2));
    }
    
    // Check normalized_fixtures structure
    console.log('\n\nNormalized fixtures columns:');
    const nfStructure = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'normalized_fixtures'
        ORDER BY ordinal_position
    `);
    nfStructure.rows.forEach(c => console.log(`   - ${c.column_name}: ${c.data_type}`));
    
    await pool.end();
}

migrateNormalizedFixtures().catch(e => {
    console.error('ERROR:', e.message);
    pool.end();
});
