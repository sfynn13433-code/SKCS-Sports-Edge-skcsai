'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

console.log('═'.repeat(60));
console.log('   FIXING TIER RULES & CONFIDENCE THRESHOLDS');
console.log('═'.repeat(60) + '\n');

async function fixThresholds() {
    console.log('STEP 1: Current tier_rules...\n');
    const current = await pool.query('SELECT * FROM tier_rules');
    current.rows.forEach(r => console.log('  ' + JSON.stringify(r)));

    console.log('\nSTEP 2: Updating tier_rules to lower thresholds...\n');

    // Update tier_rules to be more lenient (use JSONB format)
    await pool.query(`
        UPDATE tier_rules SET
            min_confidence = 40,
            allowed_volatility = '["low", "medium", "high"]'::jsonb,
            allowed_markets = '["ALL"]'::jsonb
        WHERE tier = 'normal'
    `);
    console.log('  ✓ normal: min_confidence=40, volatility=[low,medium,high]');

    await pool.query(`
        UPDATE tier_rules SET
            min_confidence = 50,
            allowed_volatility = '["low", "medium", "high"]'::jsonb,
            allowed_markets = '["ALL"]'::jsonb
        WHERE tier = 'deep'
    `);
    console.log('  ✓ deep: min_confidence=50, volatility=[low,medium,high]');

    console.log('\nSTEP 3: Verify tier_rules...\n');
    const updated = await pool.query('SELECT * FROM tier_rules');
    updated.rows.forEach(r => console.log('  ' + JSON.stringify(r)));

    console.log('\nSTEP 4: Clearing predictions_filtered for re-run...\n');
    await pool.query('TRUNCATE TABLE predictions_filtered');
    console.log('  ✓ predictions_filtered cleared');

    console.log('\nSTEP 5: Check events table...\n');
    const events = await pool.query('SELECT COUNT(*) as cnt FROM events');
    console.log('  Events: ' + events.rows[0].cnt);

    if (parseInt(events.rows[0].cnt) === 0) {
        console.log('\n  ⚠️  WARNING: Events table is empty!');
        console.log('  The pipeline needs to fetch fresh events before re-running.');
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ TIER RULES UPDATED');
    console.log('═'.repeat(60));
    console.log(`
    Changes made:
    ─────────────────────────────────────────────────────────
    normal tier:
      min_confidence: 50 → 40
      allowed_volatility: [low, medium] → [low, medium, high]

    deep tier:
      min_confidence: 60 → 50
      allowed_volatility: [low] → [low, medium, high]
    
    This will allow predictions with 58% confidence to pass through.
    `);

    await pool.end();
}

fixThresholds().catch(e => {
    console.error('FATAL:', e.message);
    pool.end();
});
