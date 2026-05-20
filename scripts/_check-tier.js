require('dotenv').config();
const db = require('../backend/db');

async function main() {
    console.log('Checking tier values...\n');
    try {
        const res = await db.query(`
            SELECT sport, tier, type
            FROM direct1x2_prediction_final
            LIMIT 10
        `);
        console.log(`Total rows: ${res.rows.length}`);
        console.log('\nTiers:');
        res.rows.forEach(row => {
            console.log(`  sport=${row.sport} tier=${row.tier} type=${row.type}`);
        });
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
}

main();
