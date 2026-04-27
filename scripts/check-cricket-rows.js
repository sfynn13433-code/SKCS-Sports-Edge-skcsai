require('dotenv').config({ path: 'backend/.env' });
const { query } = require('../backend/db');

(async () => {
  const r = await query(
    "SELECT id, sport, home_team, away_team, prediction, confidence, tier, type, market_type FROM direct1x2_prediction_final WHERE sport = 'cricket' LIMIT 5"
  );
  console.log('=== CURRENT CRICKET ROWS IN direct1x2_prediction_final ===');
  console.log(JSON.stringify(r.rows, null, 2));
})();