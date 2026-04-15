require('dotenv').config();
const { pool } = require('../backend/database');
(async () => {
  const r = await pool.query("SELECT tier, type, sport, market_type, recommendation, total_confidence FROM predictions_final ORDER BY created_at DESC LIMIT 10");
  console.log('Latest predictions:');
  console.log(JSON.stringify(r.rows, null, 2));
  await pool.end();
})();
