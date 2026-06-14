require('dotenv').config({ path: require('path').resolve(__dirname, 'backend', '.env') });
const pool = require('./backend/database');

async function inspectDB() {
    try {
        console.log('--- DB Tables & Counts ---');
        
        // Find all relevant tables
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema='public' 
            AND table_name NOT LIKE 'pg_%'
            AND table_name NOT LIKE 'sql_%'
        `);
        
        for (let row of res.rows) {
            const t = row.table_name;
            try {
                const countRes = await pool.query(`SELECT COUNT(*) FROM ${t}`);
                console.log(`${t}: ${countRes.rows[0].count} rows`);
                
                // If it looks like a fixtures/predictions table, check recent records
                if (t.includes('prediction') || t.includes('fixture') || t.includes('match')) {
                    const sample = await pool.query(`SELECT * FROM ${t} LIMIT 1`);
                    if (sample.rows.length > 0) {
                        const cols = Object.keys(sample.rows[0]).join(', ');
                        console.log(`  -> Columns: ${cols}`);
                    }
                }
            } catch(e) {}
        }
        
    } catch (e) {
        console.error('Failed:', e);
    } finally {
        pool.end();
    }
}
inspectDB();
