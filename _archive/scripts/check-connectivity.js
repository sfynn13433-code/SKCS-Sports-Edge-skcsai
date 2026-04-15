'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

let connStr = process.env.DATABASE_URL;
if (connStr && connStr.includes('db.ghzjntdvaptuxfpvhybb.supabase.co')) {
    connStr = connStr
        .replace('db.ghzjntdvaptuxfpvhybb.supabase.co:5432', 'aws-1-eu-central-1.pooler.supabase.com:6543')
        .replace('postgres:', 'postgres.ghzjntdvaptuxfpvhybb:');
    if (!connStr.includes('pgbouncer=')) {
        connStr += (connStr.includes('?') ? '&' : '?') + 'pgbouncer=true';
    }
}

const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
});

async function checkConnectivity() {
    console.log('=== SUPABASE CONNECTIVITY DEEP DIVE ===\n');
    
    // 1. Test basic connectivity
    console.log('1. CONNECTION TEST:');
    try {
        const res = await pool.query('SELECT 1 as test');
        console.log('   ✓ Basic connection: OK');
    } catch (e) {
        console.log('   ✗ Basic connection: FAILED -', e.message);
    }
    
    // 2. Check predictions_final structure
    console.log('\n2. PREDICTIONS_FINAL STRUCTURE:');
    try {
        const cols = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'predictions_final'
            ORDER BY ordinal_position
        `);
        cols.rows.forEach(c => {
            console.log(`   ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`);
        });
    } catch (e) {
        console.log('   ERROR:', e.message);
    }
    
    // 3. Check predictions_raw structure
    console.log('\n3. PREDICTIONS_RAW STRUCTURE:');
    try {
        const cols = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'predictions_raw'
            ORDER BY ordinal_position
        `);
        cols.rows.forEach(c => {
            console.log(`   ${c.column_name}: ${c.data_type}`);
        });
    } catch (e) {
        console.log('   ERROR:', e.message);
    }
    
    // 4. Check for plan_visibility column (critical for plan-based filtering)
    console.log('\n4. PLAN VISIBILITY CHECK:');
    const hasVisibility = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'predictions_final' AND column_name = 'plan_visibility'
    `);
    if (hasVisibility.rows.length === 0) {
        console.log('   ✗ plan_visibility column MISSING (required for subscription filtering)');
    } else {
        console.log('   ✓ plan_visibility column exists');
    }
    
    // 5. Sample data from predictions_final
    console.log('\n5. SAMPLE DATA FROM predictions_final (first 3 rows):');
    try {
        const sample = await pool.query(`
            SELECT id, sport, market_type, confidence, tier, created_at
            FROM predictions_final
            LIMIT 3
        `);
        if (sample.rows.length === 0) {
            console.log('   (empty)');
        } else {
            sample.rows.forEach(r => {
                console.log(`   ID:${r.id} | ${r.sport} | ${r.market_type} | ${r.confidence}% | tier:${r.tier}`);
            });
        }
    } catch (e) {
        console.log('   ERROR:', e.message);
    }
    
    // 6. Check subscription_plans (expected but missing)
    console.log('\n6. SUBSCRIPTION_PLANS TABLE:');
    const hasSubPlans = await pool.query(`
        SELECT EXISTS(
            SELECT FROM information_schema.tables 
            WHERE table_name = 'subscription_plans'
        ) as exists
    `);
    if (hasSubPlans.rows[0].exists) {
        const plans = await pool.query('SELECT plan_id, tier FROM subscription_plans');
        plans.rows.forEach(p => console.log(`   ${p.plan_id} (${p.tier})`));
    } else {
        console.log('   ✗ MISSING - This is required for subscription-based filtering!');
    }
    
    // 7. Check normalized_fixtures (expected but missing)
    console.log('\n7. NORMALIZED_FIXTURES TABLE:');
    const hasNormFixtures = await pool.query(`
        SELECT EXISTS(
            SELECT FROM information_schema.tables 
            WHERE table_name = 'normalized_fixtures'
        ) as exists
    `);
    if (hasNormFixtures.rows[0].exists) {
        console.log('   ✓ EXISTS');
    } else {
        console.log('   ✗ MISSING - This is the new normalized fixtures table!');
    }
    
    // 8. Check for orphaned FK relationships
    console.log('\n8. ORPHANED FOREIGN KEY CHECK:');
    const fkCheck = await pool.query(`
        SELECT 
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu 
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu 
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_schema = 'public'
    `);
    
    for (const fk of fkCheck.rows) {
        const refExists = await pool.query(`
            SELECT 1 FROM "${fk.foreign_table}" LIMIT 1
        `);
        if (refExists.rows.length === 0) {
            console.log(`   ✗ ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table} (table is empty)`);
        }
    }
    
    // 9. Check prediction publish runs
    console.log('\n9. PREDICTION_PUBLISH_RUNS STATUS:');
    const runs = await pool.query(`
        SELECT id, status, completed_at, 
               COALESCE(predictions_generated, 0) as generated,
               COALESCE(predictions_published, 0) as published
        FROM prediction_publish_runs
        ORDER BY created_at DESC
        LIMIT 5
    `);
    runs.rows.forEach(r => {
        const status = r.status === 'completed' ? '✓' : r.status === 'failed' ? '✗' : '○';
        console.log(`   ${status} Run#${r.id} | ${r.status} | generated:${r.generated} | published:${r.published}`);
    });
    
    // 10. Check supabase auth
    console.log('\n10. SUPABASE AUTH CONFIG:');
    const hasAuth = await pool.query(`
        SELECT EXISTS(
            SELECT FROM information_schema.tables 
            WHERE table_name = 'users'
        ) as exists
    `);
    const usersCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`    users table: ${usersCount.rows[0].count} rows`);
    
    const hasProfiles = await pool.query(`
        SELECT EXISTS(
            SELECT FROM information_schema.tables 
            WHERE table_name = 'profiles'
        ) as exists
    `);
    const profilesCount = await pool.query('SELECT COUNT(*) FROM profiles');
    console.log(`    profiles table: ${profilesCount.rows[0].count} rows`);
    
    await pool.end();
}

checkConnectivity().catch(e => {
    console.error('FATAL:', e.message);
    pool.end();
});
