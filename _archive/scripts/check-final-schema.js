const db = require('../backend/database');

(async () => {
    const client = await db.pool.connect();
    try {
        const { rows } = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'predictions_final' 
            ORDER BY ordinal_position
        `);
        console.log(JSON.stringify(rows.map(r => r.column_name), null, 2));
    } finally {
        client.release();
    }
})();
