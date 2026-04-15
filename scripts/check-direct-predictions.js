require('dotenv').config();
const { pool } = require('../backend/database');
(async () => {
  const r = await pool.query("SELECT id, type, sport, matches->0->>'home_team' as home_team, matches->0->>'away_team' as away_team FROM predictions_final WHERE type = 'direct' ORDER BY id DESC LIMIT 10");
  console.log('Direct predictions with team names:');
  console.log(JSON.stringify(r.rows, null, 2));
  await pool.end();
})();
