const db = require('../backend/database');

(async () => {
    const client = await db.pool.connect();
    try {
        // Check sport value case in predictions_final
        const sports = await client.query(`
            SELECT DISTINCT sport, LOWER(sport) as lower_sport, COUNT(*) as count 
            FROM predictions_final 
            GROUP BY sport 
            ORDER BY count DESC
        `);
        console.log('Sport values analysis:');
        sports.rows.forEach(r => console.log(`  sport='${r.sport}' | lower='${r.lower_sport}' | count=${r.count}`));

        // Check if there are NULL sports
        const nullCheck = await client.query(`
            SELECT COUNT(*) as null_count FROM predictions_final WHERE sport IS NULL
        `);
        console.log(`\nNULL sport count: ${nullCheck.rows[0].null_count}`);

        // Test the query with sport filter
        console.log('\nTesting sport filter query...');
        const testQuery = await client.query(`
            SELECT COUNT(*) as count 
            FROM predictions_final 
            WHERE LOWER(COALESCE(sport, 'football')) IN ($1)
        `, ['football']);
        console.log(`Football count with LOWER filter: ${testQuery.rows[0].count}`);

        const testBasketball = await client.query(`
            SELECT COUNT(*) as count 
            FROM predictions_final 
            WHERE LOWER(COALESCE(sport, 'football')) IN ($1)
        `, ['basketball']);
        console.log(`Basketball count with LOWER filter: ${testBasketball.rows[0].count}`);

    } finally {
        client.release();
    }
})();
