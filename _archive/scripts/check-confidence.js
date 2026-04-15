'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkData() {
    console.log('Checking confidence data...\n');

    // Stats
    const stats = await pool.query('SELECT COUNT(*) as total, AVG(confidence) as avg, MIN(confidence) as min, MAX(confidence) as max FROM predictions_raw');
    console.log('predictions_raw confidence stats:');
    const s = stats.rows[0];
    console.log('  Total: ' + s.total);
    console.log('  Avg: ' + Math.round(s.avg) + '%');
    console.log('  Min: ' + s.min + '%');
    console.log('  Max: ' + s.max + '%');

    // Distribution
    console.log('\nConfidence distribution:');
    const dist = await pool.query(`
        SELECT 
            CASE 
                WHEN confidence < 20 THEN '00-20'
                WHEN confidence >= 20 AND confidence < 40 THEN '20-40'
                WHEN confidence >= 40 AND confidence < 60 THEN '40-60'
                WHEN confidence >= 60 AND confidence < 80 THEN '60-80'
                ELSE '80-100'
            END as bucket,
            COUNT(*) as count
        FROM predictions_raw
        GROUP BY bucket
        ORDER BY bucket
    `);
    dist.rows.forEach(row => {
        const bar = '█'.repeat(Math.floor(row.count / 10));
        console.log('  ' + row.bucket.padEnd(10) + row.count.toString().padStart(5) + ' ' + bar);
    });

    // Events
    const events = await pool.query('SELECT COUNT(*) as cnt FROM events');
    console.log('\nEvents: ' + events.rows[0].cnt);

    // Rejection reasons
    console.log('\nRejection reasons from predictions_filtered:');
    const reasons = await pool.query(`
        SELECT reject_reason, COUNT(*) as cnt
        FROM predictions_filtered
        WHERE is_valid = false
        GROUP BY reject_reason
        ORDER BY cnt DESC
        LIMIT 10
    `);
    reasons.rows.forEach(row => {
        console.log('  ' + row.cnt + 'x: ' + row.reject_reason);
    });

    await pool.end();
}

checkData().catch(e => {
    console.error(e.message);
    pool.end();
});
