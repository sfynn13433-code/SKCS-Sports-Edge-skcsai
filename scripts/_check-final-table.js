require('dotenv').config();
const db = require('../backend/db');

async function main() {
    console.log('Checking direct1x2_prediction_final table...\n');
    try {
        const res = await db.query(`
            SELECT sport, type, match_date, home_team, away_team, confidence, created_at
            FROM direct1x2_prediction_final
            ORDER BY created_at DESC
            LIMIT 10
        `);
        console.log(`Total rows: ${res.rows.length}`);
        console.log('\nRecent predictions:');
        res.rows.forEach(row => {
            console.log(`  sport=${row.sport} type=${row.type} match_date=${row.match_date} home=${row.home_team} away=${row.away_team} conf=${row.confidence} created=${row.created_at}`);
        });
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
}

main();
