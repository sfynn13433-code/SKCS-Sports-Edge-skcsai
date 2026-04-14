'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL;

console.log('Fixing active_predictions_by_sport view...\n');

const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
});

async function fixView() {
    // Drop existing view
    await pool.query('DROP VIEW IF EXISTS active_predictions_by_sport');
    
    // Create view - sport is now directly in predictions_final
    await pool.query(`
        CREATE OR REPLACE VIEW active_predictions_by_sport AS
        SELECT 
            COALESCE(pf.sport, 'unknown') as sport,
            pf.tier,
            COUNT(*) as prediction_count,
            AVG(pf.total_confidence)::int as avg_confidence,
            MAX(pf.total_confidence)::int as max_confidence,
            MIN(pf.total_confidence)::int as min_confidence
        FROM predictions_final pf
        WHERE pf.expires_at > NOW() OR pf.expires_at IS NULL
        GROUP BY pf.sport, pf.tier
        ORDER BY pf.sport, pf.tier
    `);
    
    const result = await pool.query('SELECT * FROM active_predictions_by_sport ORDER BY sport');
    console.log('View contents:');
    result.rows.forEach(r => {
        console.log(`  ${r.sport}: ${r.prediction_count} predictions (${r.tier})`);
    });
    
    await pool.end();
}

fixView().catch(e => {
    console.error('Error:', e.message);
    pool.end();
});
