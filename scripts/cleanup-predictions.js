require('dotenv').config();
const { pool } = require('../backend/database');
(async () => {
  await pool.query("DELETE FROM direct1x2_prediction_final WHERE created_at > NOW() - INTERVAL '1 hour'");
  console.log('Deleted recent predictions');
  await pool.end();
})();
