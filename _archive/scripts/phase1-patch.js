'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL;

console.log('=== PHASE 1: IMMEDIATE PATCHES ===\n');
console.log('Connection:', connStr.substring(0, 50) + '...\n');

const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000
});

async function executePhase1() {
    const results = [];

    // 1. Add plan_visibility column
    console.log('STEP 1: Adding plan_visibility column to predictions_final...');
    try {
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
            results.push({ step: 1, status: 'success' });
        } else {
            console.log('   ℹ Column already exists - skipping');
            results.push({ step: 1, status: 'skipped' });
        }
    } catch (e) {
        console.log('   ✗ FAILED:', e.message);
        results.push({ step: 1, status: 'failed', message: e.message });
    }

    // 2. Add other missing columns
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
                results.push({ step: 2, status: 'success', col: col.name });
            } else {
                console.log(`   ℹ ${col.name} already exists`);
            }
        } catch (e) {
            console.log(`   ✗ Failed to add ${col.name}:`, e.message.split('\n')[0]);
        }
    }

    // 3. Drop orphaned foreign keys
    console.log('\nSTEP 3: Dropping orphaned foreign keys...');
    const orphanedFKs = [
        { fk: 'injury_reports_player_id_fkey' },
        { fk: 'injury_reports_team_id_fkey' },
        { fk: 'players_team_id_fkey' }
    ];
    
    for (const fk of orphanedFKs) {
        try {
            await pool.query(`ALTER TABLE injury_reports DROP CONSTRAINT IF EXISTS ${fk.fk}`);
            console.log(`   ✓ Dropped ${fk.fk}`);
        } catch (e) {
            if (e.message.includes('does not exist')) {
                console.log(`   ℹ ${fk.fk} doesn't exist`);
            } else {
                console.log(`   ✗ Failed:`, e.message.split('\n')[0]);
            }
        }
    }
    try {
        await pool.query(`ALTER TABLE players DROP CONSTRAINT IF EXISTS players_team_id_fkey`);
        console.log(`   ✓ Dropped players_team_id_fkey`);
    } catch (e) {
        if (!e.message.includes('does not exist')) {
            console.log(`   ℹ players_team_id_fkey:`, e.message.split('\n')[0]);
        }
    }

    // 4. Verify structure
    console.log('\nSTEP 4: Verifying predictions_final structure...');
    try {
        const cols = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'predictions_final'
            ORDER BY ordinal_position
        `);
        console.log('   Columns:');
        cols.rows.forEach(c => console.log(`     - ${c.column_name}`));
    } catch (e) {
        console.log('   ✗ Failed:', e.message);
    }

    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log('PHASE 1 COMPLETE');
    console.log('═'.repeat(50));

    await pool.end();
}

executePhase1().catch(e => {
    console.error('FATAL:', e.message);
    pool.end();
});
