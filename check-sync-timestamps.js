require('dotenv').config();
const { pool } = require('./backend/db');

async function checkSyncTimestamps() {
    const today = new Date().toISOString().split('T')[0];
    console.log('=== Checking if sports data was populated today ===');
    console.log(`Today (UTC): ${today}\n`);

    try {
        // Check fixtures table
        console.log('--- FIXTURES TABLE ---');
        const fixturesCheck = await pool.query(`
            SELECT 
                COUNT(*) as total_count,
                COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_count,
                MAX(created_at) as latest_created
            FROM fixtures
        `);
        console.log(`Total fixtures: ${fixturesCheck.rows[0].total_count}`);
        console.log(`Created today: ${fixturesCheck.rows[0].today_count}`);
        console.log(`Latest created_at: ${fixturesCheck.rows[0].latest_created}\n`);

        // Check predictions_final table
        console.log('--- PREDICTIONS_FINAL TABLE ---');
        const predictionsCheck = await pool.query(`
            SELECT 
                COUNT(*) as total_count,
                COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_count,
                MAX(created_at) as latest_created
            FROM predictions_final
        `);
        console.log(`Total predictions: ${predictionsCheck.rows[0].total_count}`);
        console.log(`Created today: ${predictionsCheck.rows[0].today_count}`);
        console.log(`Latest created_at: ${predictionsCheck.rows[0].latest_created}\n`);

        // Check fixture_weekly_publication_log if it exists
        const pubLogExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'fixture_weekly_publication_log'
            )
        `);
        
        if (pubLogExists.rows[0].exists) {
            console.log('--- FIXTURE WEEKLY PUBLICATION LOG ---');
            const pubLogCheck = await pool.query(`
                SELECT 
                    COUNT(*) as total_count,
                    COUNT(CASE WHEN DATE(published_at) = CURRENT_DATE THEN 1 END) as today_count,
                    MAX(published_at) as latest_published
                FROM fixture_weekly_publication_log
            `);
            console.log(`Total publications: ${pubLogCheck.rows[0].total_count}`);
            console.log(`Published today: ${pubLogCheck.rows[0].today_count}`);
            console.log(`Latest published_at: ${pubLogCheck.rows[0].latest_published}\n`);
        }

        // Check by sport in fixtures
        console.log('--- FIXTURES BY SPORT (LATEST) ---');
        const sportCheck = await pool.query(`
            SELECT 
                sport,
                COUNT(*) as count,
                MAX(created_at) as latest_created
            FROM fixtures
            GROUP BY sport
            ORDER BY sport
        `);
        for (const row of sportCheck.rows) {
            const isToday = row.latest_created && new Date(row.latest_created).toISOString().split('T')[0] === today;
            const marker = isToday ? '✅ TODAY' : '❌ OLD';
            console.log(`${marker} ${row.sport}: ${row.count} fixtures, latest: ${row.latest_created}`);
        }
        console.log('');

        // Check canonical_events if it exists
        const canonicalExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'canonical_events'
            )
        `);
        
        if (canonicalExists.rows[0].exists) {
            console.log('--- CANONICAL_EVENTS TABLE ---');
            const canonicalCheck = await pool.query(`
                SELECT 
                    COUNT(*) as total_count,
                    COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_count,
                    MAX(created_at) as latest_created
                FROM canonical_events
            `);
            console.log(`Total canonical events: ${canonicalCheck.rows[0].total_count}`);
            console.log(`Created today: ${canonicalCheck.rows[0].today_count}`);
            console.log(`Latest created_at: ${canonicalCheck.rows[0].latest_created}\n`);
        }

        // Summary
        console.log('=== SUMMARY ===');
        const todayFixtures = fixturesCheck.rows[0].today_count > 0;
        const todayPredictions = predictionsCheck.rows[0].today_count > 0;
        
        if (todayFixtures || todayPredictions) {
            console.log('✅ Data was populated today');
        } else {
            console.log('❌ No data was populated today');
        }

    } catch (error) {
        console.error('Error checking timestamps:', error);
    } finally {
        await pool.end();
    }
}

checkSyncTimestamps();
