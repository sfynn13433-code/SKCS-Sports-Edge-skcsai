require('dotenv').config();
const { pool } = require('../backend/database');
(async () => {
  const r = await pool.query("SELECT id, tier, type, sport, matches->0->>'home_team' as home_team, matches->0->>'away_team' as away_team FROM predictions_final ORDER BY id DESC LIMIT 5");
  console.log('Sample predictions with team names:');
  console.log(JSON.stringify(r.rows, null, 2));
  await pool.end();
})();
