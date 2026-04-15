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

async function executePhase1() {
    console.log('=== PHASE 1: IMMEDIATE PATCHES ===\n');
    console.log('This will:');
    console.log('  1. Add plan_visibility column to predictions_final');
    console.log('  2. Drop orphaned foreign keys');
    console.log('  3. Verify changes\n');
    console.log('─'.repeat(50) + '\n');

    const results = [];

    // 1. Add plan_visibility column
    console.log('STEP 1: Adding plan_visibility column to predictions_final...');
    try {
        // Check if column exists first
        const exists = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'predictions_final' AND column_name = 'plan_visibility'
        `);
        
        if (exists.rows.length === 0) {
            await pool.query(`
                ALTER TABLE predictions_final 
                ADD COLUMN plan_visibility JSONB DEFAULT '[]'::jsonb
            `);
            console.log('   ✓ Added plan_visibility column');
            results.push({ step: 1, status: 'success', message: 'Added plan_visibility column' });
        } else {
            console.log('   ℹ Column already exists - skipping');
            results.push({ step: 1, status: 'skipped', message: 'Column already exists' });
        }
    } catch (e) {
        console.log('   ✗ FAILED:', e.message);
        results.push({ step: 1, status: 'failed', message: e.message });
    }

    // 2. Add other missing columns that might be needed
    console.log('\nSTEP 2: Adding other missing columns...');
    const missingColumns = [
        { name: 'sport', type: 'TEXT' },
        { name: 'market_type', type: 'TEXT' },
        { name: 'recommendation', type: 'TEXT' },
        { name: 'expires_at', type: 'TIMESTAMPTZ' }
    ];
    
    for (const col of missingColumns) {
        try {
            const exists = await pool.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'predictions_final' AND column_name = $1
            `, [col.name]);
            
            if (exists.rows.length === 0) {
                await pool.query(`ALTER TABLE predictions_final ADD COLUMN ${col.name} ${col.type}`);
                console.log(`   ✓ Added ${col.name}`);
                results.push({ step: 2, status: 'success', message: `Added ${col.name}` });
            } else {
                console.log(`   ℹ ${col.name} already exists`);
            }
        } catch (e) {
            console.log(`   ✗ Failed to add ${col.name}:`, e.message);
            results.push({ step: 2, status: 'failed', message: `${col.name}: ${e.message}` });
        }
    }

    // 3. Drop orphaned foreign keys
    console.log('\nSTEP 3: Dropping orphaned foreign keys...');
    const orphanedFKs = [
        { table: 'injury_reports', fk: 'injury_reports_player_id_fkey' },
        { table: 'injury_reports', fk: 'injury_reports_team_id_fkey' },
        { table: 'players', fk: 'players_team_id_fkey' }
    ];
    
    for (const fk of orphanedFKs) {
        try {
            await pool.query(`ALTER TABLE ${fk.table} DROP CONSTRAINT IF EXISTS ${fk.fk}`);
            console.log(`   ✓ Dropped ${fk.fk}`);
            results.push({ step: 3, status: 'success', message: `Dropped ${fk.fk}` });
        } catch (e) {
            if (e.message.includes('does not exist')) {
                console.log(`   ℹ ${fk.fk} doesn't exist (already dropped)`);
            } else {
                console.log(`   ✗ Failed:`, e.message);
                results.push({ step: 3, status: 'failed', message: `${fk.fk}: ${e.message}` });
            }
        }
    }

    // 4. Verify predictions_final structure
    console.log('\nSTEP 4: Verifying predictions_final structure...');
    try {
        const cols = await pool.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'predictions_final'
            ORDER BY ordinal_position
        `);
        console.log('   Current columns:');
        cols.rows.forEach(c => {
            const defaultStr = c.column_default ? ` DEFAULT ${c.column_default.substring(0, 30)}...` : '';
            console.log(`     - ${c.column_name}: ${c.data_type}${defaultStr}`);
        });
    } catch (e) {
        console.log('   ✗ Failed to verify:', e.message);
    }

    // 5. Summary
    console.log('\n' + '═'.repeat(50));
    console.log('PHASE 1 SUMMARY:');
    console.log('═'.repeat(50));
    
    const succeeded = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    
    console.log(`   ✓ Success: ${succeeded}`);
    console.log(`   ℹ Skipped: ${skipped}`);
    console.log(`   ✗ Failed: ${failed}`);
    
    if (failed === 0) {
        console.log('\n   ✅ Phase 1 completed successfully!');
        console.log('   Ready to proceed with Phase 2 (Schema Refactor)');
    } else {
        console.log('\n   ⚠ Phase 1 completed with errors');
        console.log('   Review failed items before proceeding');
    }

    await pool.end();
}

executePhase1().catch(e => {
    console.error('FATAL ERROR:', e.message);
    pool.end();
    process.exit(1);
});
