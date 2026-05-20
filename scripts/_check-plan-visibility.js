require('dotenv').config();
const db = require('../backend/db');

async function main() {
    console.log('Checking plan_visibility values...\n');
    try {
        const res = await db.query(`
            SELECT sport, plan_visibility
            FROM direct1x2_prediction_final
            LIMIT 10
        `);
        console.log(`Total rows: ${res.rows.length}`);
        console.log('\nPlan visibility:');
        res.rows.forEach(row => {
            console.log(`  sport=${row.sport} plan_visibility=${JSON.stringify(row.plan_visibility)}`);
        });
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
}

main();
