'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL;

console.log('═'.repeat(60));
console.log('   FULL DATA NUKE & SPORT FILTER FIX');
console.log('═'.repeat(60) + '\n');

const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
});

async function nukeAndFix() {
    console.log('⚠️  WARNING: This will delete ALL data from:');
    console.log('   - rapidapi_cache');
    console.log('   - events');
    console.log('   - canonical_events');
    console.log('   - normalized_fixtures');
    console.log('   - predictions_final\n');

    console.log('STEP 1: Disabling triggers and FK checks...\n');
    await pool.query('SET session_replication_role = replica');

    console.log('STEP 2: Truncating all tables...\n');
    
    const tables = ['rapidapi_cache', 'events', 'canonical_events', 'normalized_fixtures', 'predictions_final'];
    
    for (const table of tables) {
        try {
            await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
            console.log(`   ✓ ${table}`);
        } catch (e) {
            console.log(`   ✗ ${table}: ${e.message}`);
        }
    }

    console.log('\nSTEP 3: Re-enabling triggers...\n');
    await pool.query('SET session_replication_role = DEFAULT');
    console.log('   ✓ Done\n');

    console.log('STEP 4: Verification...\n');
    
    const tables2 = ['rapidapi_cache', 'events', 'canonical_events', 'normalized_fixtures', 'predictions_final'];
    
    for (const table of tables2) {
        const result = await pool.query(`SELECT COUNT(*) as cnt FROM ${table}`);
        console.log(`   ${table}: ${result.rows[0].cnt} rows`);
    }

    await pool.end();
    console.log('\n✅ DATA NUKE COMPLETE!\n');
}

nukeAndFix().catch(e => {
    console.error('FATAL:', e.message);
    pool.end();
});
