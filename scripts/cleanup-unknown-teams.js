require('dotenv').config();
const { pool } = require('../backend/database');
(async () => {
  const r = await pool.query("DELETE FROM predictions_final WHERE matches->0->>'home_team' = 'Unknown Home' OR matches->0->>'away_team' = 'Unknown Away' RETURNING id");
  console.log(`Deleted ${r.rowCount} predictions with Unknown teams`);
  await pool.end();
})();
