const db = require('../backend/database');

(async () => {
    const client = await db.pool.connect();
    try {
        const { rows } = await client.query(`
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE table_name LIKE 'predictions_stage%' 
            ORDER BY table_name, ordinal_position
        `);
        const tables = {};
        rows.forEach(r => {
            if (!tables[r.table_name]) tables[r.table_name] = [];
            tables[r.table_name].push(r.column_name);
        });
        console.log(JSON.stringify(tables, null, 2));
    } finally {
        client.release();
    }
})();
