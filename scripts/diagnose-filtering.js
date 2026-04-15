const db = require('../backend/database');

(async () => {
    const client = await db.pool.connect();
    try {
        // Check tier distribution in predictions_filtered
        const tierDist = await client.query(`
            SELECT tier, is_valid, COUNT(*) as count 
            FROM predictions_filtered 
            GROUP BY tier, is_valid 
            ORDER BY tier, is_valid
        `);
        console.log('predictions_filtered distribution:');
        tierDist.rows.forEach(r => console.log(`  ${r.tier} | is_valid=${r.is_valid} | ${r.count}`));

        // Check raw_id join success
        const joinCheck = await client.query(`
            SELECT 
                pf.tier,
                CASE WHEN pr.id IS NOT NULL THEN 'joined' ELSE 'no_raw' END as join_status,
                COUNT(*) as count
            FROM predictions_filtered pf
            LEFT JOIN predictions_raw pr ON pr.id = pf.raw_id
            WHERE pf.is_valid = true
            GROUP BY pf.tier, CASE WHEN pr.id IS NOT NULL THEN 'joined' ELSE 'no_raw' END
        `);
        console.log('\nJoin success check:');
        joinCheck.rows.forEach(r => console.log(`  ${r.tier} | ${r.join_status} | ${r.count}`));

        // Get all unique tiers in predictions_filtered
        const allTiers = await client.query(`SELECT DISTINCT tier FROM predictions_filtered`);
        console.log('\nAll tiers in predictions_filtered:', allTiers.rows.map(r => r.tier));

    } finally {
        client.release();
    }
})();
