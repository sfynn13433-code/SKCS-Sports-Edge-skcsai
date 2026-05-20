require('dotenv').config();
const db = require('../backend/db');

async function main() {
    console.log('Checking team_week_locks table...\n');
    try {
        const res = await db.query(`
            SELECT *
            FROM team_week_locks
            LIMIT 50
        `);
        console.log(`Total locks: ${res.rows.length}`);
        console.log('\nRecent locks:');
        res.rows.forEach(row => {
            console.log(`  week=${row.week_key} team=${row.team_key} competition=${row.competition_key} created=${row.created_at}`);
        });
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
}

main();
