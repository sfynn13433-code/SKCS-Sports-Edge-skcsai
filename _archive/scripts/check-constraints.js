require('dotenv').config();
const { pool } = require('../backend/database');
(async () => {
  const r = await pool.query("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'predictions_final'::regclass");
  console.log(JSON.stringify(r.rows, null, 2));
  await pool.end();
})();
