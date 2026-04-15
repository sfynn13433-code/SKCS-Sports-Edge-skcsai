'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL;

console.log('═'.repeat(60));
console.log('   FIX SPORT FILTER ISSUE');
console.log('═'.repeat(60) + '\n');

const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
});

async function fixSportFilter() {
    console.log('STEP 1: Checking current state...\n');
    
    // Check sport column
    const sportCheck = await pool.query(`
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN sport IS NULL THEN 1 END) as null_sport,
               COUNT(CASE WHEN sport IS NOT NULL THEN 1 END) as has_sport
        FROM predictions_final
    `);
    console.log(`   predictions_final:`);
    console.log(`     total: ${sportCheck.rows[0].total}`);
    console.log(`     null sport: ${sportCheck.rows[0].null_sport}`);
    console.log(`     has sport: ${sportCheck.rows[0].has_sport}`);
    
    console.log('\nSTEP 2: Extracting sport from matches JSONB...\n');
    
    // Extract sport from matches[0].sport or matches[0].metadata.sport
    const updateSQL = `
        UPDATE predictions_final
        SET sport = (
            SELECT 
                COALESCE(
                    m->>'sport',
                    m->'metadata'->>'sport',
                    m->'metadata'->>'sport_type'
                )::text
            FROM jsonb_array_elements(matches) WITH ORDINALITY arr(m, idx)
            WHERE idx = 1
            LIMIT 1
        )
        WHERE sport IS NULL
        AND matches IS NOT NULL
        AND jsonb_array_length(matches) > 0
    `;
    
    try {
        const result = await pool.query(updateSQL);
        console.log(`   ✓ Updated ${result.rowCount} rows with sport from matches\n`);
    } catch (e) {
        console.log(`   ✗ Error: ${e.message}\n`);
    }
    
    console.log('STEP 3: Verify sport column...\n');
    
    const afterSport = await pool.query(`
        SELECT sport, COUNT(*) as cnt
        FROM predictions_final
        GROUP BY sport
        ORDER BY cnt DESC
    `);
    
    console.log('   Sport distribution:');
    afterSport.rows.forEach(r => console.log(`     ${r.sport || '(null)'}: ${r.cnt}`));
    
    console.log('\nSTEP 4: Fixing active_predictions_by_sport view...\n');
    
    // Drop and recreate the view with proper sport extraction
    const viewSQL = `
        DROP VIEW IF EXISTS active_predictions_by_sport;
        
        CREATE OR REPLACE VIEW active_predictions_by_sport AS
        SELECT 
            COALESCE(
                pf.sport,
                (SELECT 
                    COALESCE(
                        m->>'sport',
                        m->'metadata'->>'sport',
                        m->'metadata'->>'sport_type'
                    )::text
                FROM jsonb_array_elements(pf.matches) WITH ORDINALITY arr(m, idx)
                WHERE idx = 1
                LIMIT 1
            ) as sport,
            pf.tier,
            COUNT(*) as prediction_count,
            AVG(pf.total_confidence) as avg_confidence,
            MAX(pf.total_confidence) as max_confidence,
            MIN(pf.total_confidence) as min_confidence
        FROM predictions_final pf
        WHERE pf.expires_at > NOW() OR pf.expires_at IS NULL
        GROUP BY sport, pf.tier
        ORDER BY sport, pf.tier
    `;
    
    try {
        await pool.query(viewSQL);
        console.log('   ✓ Recreated active_predictions_by_sport view\n');
    } catch (e) {
        console.log(`   ✗ Error recreating view: ${e.message}\n`);
    }
    
    console.log('STEP 5: Verify view...\n');
    
    const viewData = await pool.query('SELECT * FROM active_predictions_by_sport ORDER BY sport');
    console.log('   View contents:');
    viewData.rows.forEach(r => {
        console.log(`     ${r.sport}: ${r.prediction_count} predictions (${r.tier})`);
    });
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ SPORT FILTER FIX COMPLETE');
    console.log('═'.repeat(60));
    console.log(`
    The active_predictions_by_sport view now correctly extracts
    the sport from the matches JSONB array.
    
    The sport filter in predictions.js should now work correctly.
    `);
    
    await pool.end();
}

fixSportFilter().catch(e => {
    console.error('FATAL:', e.message);
    pool.end();
});
