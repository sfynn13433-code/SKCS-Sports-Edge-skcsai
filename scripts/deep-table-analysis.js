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

async function deepCheck() {
    console.log('=== DEEP TABLE ANALYSIS ===\n');
    
    // 1. Check predictions_final actual structure
    console.log('1. PREDICTIONS_FINAL ACTUAL STRUCTURE:');
    const pfCols = await pool.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'predictions_final'
        ORDER BY ordinal_position
    `);
    pfCols.rows.forEach(c => {
        console.log(`   ${c.column_name}: ${c.data_type} ${c.column_default ? '(' + c.column_default + ')' : ''}`);
    });
    
    // 2. Check prediction_publish_runs actual structure
    console.log('\n2. PREDICTION_PUBLISH_RUNS ACTUAL STRUCTURE:');
    const prCols = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'prediction_publish_runs'
        ORDER BY ordinal_position
    `);
    prCols.rows.forEach(c => console.log(`   ${c.column_name}: ${c.data_type}`));
    
    // 3. Sample predictions_final data with correct columns
    console.log('\n3. SAMPLE predictions_final DATA:');
    try {
        const sample = await pool.query(`
            SELECT id, tier, type, total_confidence, created_at
            FROM predictions_final
            ORDER BY created_at DESC
            LIMIT 5
        `);
        if (sample.rows.length === 0) {
            console.log('   (empty)');
        } else {
            sample.rows.forEach(r => {
                console.log(`   ID:${r.id} | tier:${r.tier} | type:${r.type} | conf:${r.total_confidence}%`);
                console.log(`      matches: ${JSON.stringify(r.matches).substring(0, 100)}...`);
            });
        }
    } catch (e) {
        console.log('   ERROR:', e.message);
    }
    
    // 4. Check how code accesses these tables
    console.log('\n4. CHECKING MATCH_ID REFERENCES:');
    const matchIdCheck = await pool.query(`
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN match_id IS NOT NULL THEN 1 END) as with_match_id
        FROM predictions_raw
    `);
    console.log(`   predictions_raw: ${matchIdCheck.rows[0].total} total, ${matchIdCheck.rows[0].with_match_id} with match_id`);
    
    // 5. Check prediction_publish_runs recent runs
    console.log('\n5. RECENT PREDICTION_PUBLISH_RUNS:');
    try {
        const runs = await pool.query(`
            SELECT id, status, created_at, metadata
            FROM prediction_publish_runs
            ORDER BY created_at DESC
            LIMIT 5
        `);
        runs.rows.forEach(r => {
            console.log(`   Run#${r.id} | ${r.status} | ${r.created_at}`);
            if (r.metadata) {
                const meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
                console.log(`      metadata: ${JSON.stringify(meta).substring(0, 150)}`);
            }
        });
    } catch (e) {
        console.log('   ERROR:', e.message);
    }
    
    // 6. Check the tier_rules table
    console.log('\n6. TIER_RULES CONTENT:');
    try {
        const rules = await pool.query('SELECT * FROM tier_rules');
        rules.rows.forEach(r => console.log(`   ${JSON.stringify(r)}`));
    } catch (e) {
        console.log('   ERROR:', e.message);
    }
    
    // 7. Check acca_rules table
    console.log('\n7. ACCA_RULES CONTENT:');
    try {
        const acca = await pool.query('SELECT * FROM acca_rules');
        acca.rows.forEach(r => console.log(`   ${JSON.stringify(r)}`));
    } catch (e) {
        console.log('   ERROR:', e.message);
    }
    
    // 8. Check events table structure
    console.log('\n8. EVENTS TABLE STRUCTURE:');
    const evCols = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'events'
        ORDER BY ordinal_position
    `);
    evCols.rows.forEach(c => console.log(`   ${c.column_name}: ${c.data_type}`));
    
    // 9. Sample from events
    console.log('\n9. SAMPLE EVENTS DATA:');
    try {
        const events = await pool.query('SELECT id, sport_key, home_team, away_team, commence_time FROM events LIMIT 3');
        events.rows.forEach(e => console.log(`   ${e.id}: ${e.home_team} vs ${e.away_team} (${e.sport_key})`));
    } catch (e) {
        console.log('   ERROR:', e.message);
    }
    
    // 10. Summary of missing critical tables
    console.log('\n10. CRITICAL MISSING TABLES:');
    console.log('    ┌─────────────────────────────────────────────────────────────────┐');
    console.log('    │ TABLE                    │ STATUS       │ PURPOSE                │');
    console.log('    ├─────────────────────────────────────────────────────────────────┤');
    
    const missingTables = [
        ['normalized_fixtures', 'MISSING', 'New fixture normalization'],
        ['predictions_stage_1/2/3', 'MISSING', '3-stage prediction pipeline'],
        ['subscription_plans', 'MISSING', 'Plan-based access control'],
        ['scheduling_logs', 'MISSING', 'Pipeline execution logs'],
    ];
    
    missingTables.forEach(([table, status, purpose]) => {
        console.log(`    │ ${table.padEnd(25)} │ ${status.padEnd(11)} │ ${purpose.padEnd(23)} │`);
    });
    console.log('    └─────────────────────────────────────────────────────────────────┘');
    
    await pool.end();
}

deepCheck().catch(e => {
    console.error('FATAL:', e.message);
    pool.end();
});
