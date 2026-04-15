const db = require('../backend/database');

(async () => {
    const client = await db.pool.connect();
    try {
        const { rows } = await client.query(`
            SELECT conname, pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'predictions_final'::regclass
              AND contype = 'c'
        `);
        console.log('Check constraints on predictions_final:');
        rows.forEach(r => console.log(`  ${r.conname}: ${r.definition}`));
    } finally {
        client.release();
    }
})();
