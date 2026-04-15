'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL;

console.log('═'.repeat(60));
console.log('   DATA WIPE - FRESH START');
console.log('═'.repeat(60) + '\n');

console.log('⚠️  WARNING: This will delete ALL data from:');
console.log('   - events');
console.log('   - canonical_events');
console.log('   - normalized_fixtures');
console.log('\n');

const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
});

async function wipeData() {
    console.log('STEP 1: Getting current counts...\n');
    
    const counts = await pool.query(`
        SELECT 
            (SELECT COUNT(*) FROM events) as events_count,
            (SELECT COUNT(*) FROM canonical_events) as canonical_count,
            (SELECT COUNT(*) FROM normalized_fixtures) as fixtures_count
    `);
    
    const c = counts.rows[0];
    console.log(`   events: ${c.events_count} rows`);
    console.log(`   canonical_events: ${c.canonical_count} rows`);
    console.log(`   normalized_fixtures: ${c.fixtures_count} rows\n`);
    
    console.log('STEP 2: Truncating tables...\n');
    
    try {
        // Disable foreign key checks temporarily
        await pool.query('SET session_replication_role = replica');
        
        // Truncate tables (will also truncate dependent tables if CASCADE is set)
        await pool.query('TRUNCATE TABLE events CASCADE');
        console.log('   ✓ Truncated events');
        
        await pool.query('TRUNCATE TABLE canonical_events CASCADE');
        console.log('   ✓ Truncated canonical_events');
        
        await pool.query('TRUNCATE TABLE normalized_fixtures CASCADE');
        console.log('   ✓ Truncated normalized_fixtures');
        
        // Re-enable foreign key checks
        await pool.query('SET session_replication_role = DEFAULT');
        
    } catch (e) {
        console.log('   ✗ Error:', e.message);
        await pool.query('SET session_replication_role = DEFAULT');
    }
    
    console.log('\nSTEP 3: Verification...\n');
    
    const afterCounts = await pool.query(`
        SELECT 
            (SELECT COUNT(*) FROM events) as events_count,
            (SELECT COUNT(*) FROM canonical_events) as canonical_count,
            (SELECT COUNT(*) FROM normalized_fixtures) as fixtures_count
    `);
    
    const a = afterCounts.rows[0];
    console.log(`   events: ${a.events_count} rows`);
    console.log(`   canonical_events: ${a.canonical_count} rows`);
    console.log(`   normalized_fixtures: ${a.fixtures_count} rows\n`);
    
    if (a.events_count === '0' && a.canonical_count === '0' && a.fixtures_count === '0') {
        console.log('✅ DATA WIPE COMPLETE - Ready for fresh pull!\n');
    } else {
        console.log('⚠️  Some data may remain. Check constraints.\n');
    }
    
    await pool.end();
}

wipeData().catch(e => {
    console.error('FATAL:', e.message);
    pool.end();
});
