require('dotenv').config();
const { pool } = require('../backend/database');
(async () => {
  const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'predictions_final' ORDER BY ordinal_position");
  console.log(JSON.stringify(r.rows, null, 2));
  await pool.end();
})();
