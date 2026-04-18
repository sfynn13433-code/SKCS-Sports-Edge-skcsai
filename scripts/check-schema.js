const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkSchema() {
    try {
        console.log('Checking predictions_final table schema...');
        
        const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'predictions_final' ORDER BY ordinal_position");
        console.log('Columns:', JSON.stringify(cols.rows, null, 2));
        
        console.log('\nChecking cron jobs in server...');
        
        const jobsResult = await pool.query("SELECT schemaname, tablename, column_name FROM information_schema.table_constraints WHERE table_name = 'predictions_final'");
        console.log('Constraints:', JSON.stringify(jobsResult.rows, null, 2));
        
        await pool.end();
        process.exit(0);
    } catch(e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

checkSchema();