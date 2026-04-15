const db = require('../backend/database');

(async () => {
    const client = await db.pool.connect();
    try {
        // Check sport values in predictions_final
        const sports = await client.query(`
            SELECT DISTINCT sport, COUNT(*) as count 
            FROM predictions_final 
            GROUP BY sport 
            ORDER BY count DESC
        `);
        console.log('Sports in predictions_final:');
        sports.rows.forEach(r => console.log(`  ${r.sport}: ${r.count}`));

        // Check a sample record structure
        const sample = await client.query(`
            SELECT id, tier, type, sport, market_type, recommendation, 
                   total_confidence, risk_level, plan_visibility,
                   expires_at, created_at
            FROM predictions_final 
            LIMIT 3
        `);
        console.log('\nSample record:');
        console.log(JSON.stringify(sample.rows[0], null, 2));

    } finally {
        client.release();
    }
})();
