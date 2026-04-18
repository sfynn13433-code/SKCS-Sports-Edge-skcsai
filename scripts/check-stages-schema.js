const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'predictions_stage_1' ORDER BY ordinal_position");
    console.log('predictions_stage_1 columns:', JSON.stringify(r.rows, null, 2));
    
    const r2 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'predictions_stage_2' ORDER BY ordinal_position");
    console.log('predictions_stage_2 columns:', JSON.stringify(r2.rows, null, 2));
    
    await pool.end();
    process.exit(0);
})();