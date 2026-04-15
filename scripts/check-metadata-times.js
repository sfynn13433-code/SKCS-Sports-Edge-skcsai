const db = require('../backend/database');

(async () => {
    const client = await db.pool.connect();
    try {
        // Check commence_time in the raw data
        const hasTime = await client.query(`
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN pr.metadata->>'commence_time' IS NOT NULL THEN 1 END) as has_commence_time,
                   COUNT(CASE WHEN pr.metadata->>'match_time' IS NOT NULL THEN 1 END) as has_match_time,
                   COUNT(CASE WHEN pr.metadata->>'kickoff' IS NOT NULL THEN 1 END) as has_kickoff
            FROM predictions_raw pr
            LIMIT 1
        `);
        console.log('Time field analysis:');
        console.log(JSON.stringify(hasTime.rows[0], null, 2));

        // Check a sample raw prediction
        const sample = await client.query(`
            SELECT pr.match_id, pr.sport, pr.prediction, pr.confidence, 
                   pr.metadata->>'commence_time' as commence_time,
                   pr.metadata->>'match_time' as match_time,
                   pr.metadata->>'home_team' as home_team,
                   pr.metadata->>'away_team' as away_team
            FROM predictions_raw pr
            LIMIT 3
        `);
        console.log('\nSample raw prediction:');
        console.log(JSON.stringify(sample.rows, null, 2));

        // Check predictions_final sample
        const finalSample = await client.query(`
            SELECT id, matches
            FROM predictions_final
            LIMIT 2
        `);
        console.log('\nSample predictions_final matches:');
        finalSample.rows.forEach(r => {
            console.log(`ID ${r.id}:`, JSON.stringify(r.matches, null, 2).substring(0, 500));
        });

    } finally {
        client.release();
    }
})();
