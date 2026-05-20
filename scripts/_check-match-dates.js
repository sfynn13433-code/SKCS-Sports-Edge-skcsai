require('dotenv').config();
const db = require('../backend/db');

async function main() {
    console.log('Checking match_date values...\n');
    try {
        const res = await db.query(`
            SELECT sport, match_date, created_at, NOW() as server_time
            FROM direct1x2_prediction_final
            ORDER BY created_at DESC
            LIMIT 10
        `);
        console.log(`Total rows: ${res.rows.length}`);
        console.log('\nPredictions:');
        res.rows.forEach(row => {
            console.log(`  sport=${row.sport} match_date=${row.match_date} created=${row.created_at} server_now=${row.server_time} future=${new Date(row.match_date) > new Date(row.server_time)}`);
        });
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
}

main();
