require('dotenv').config();
const { pool } = require('../backend/database');
(async () => {
  const r = await pool.query("SELECT id, tier, type, total_confidence, matches FROM predictions_final ORDER BY id DESC LIMIT 3");
  for (const row of r.rows) {
    console.log('ID:', row.id, 'Tier:', row.tier, 'Type:', row.type, 'Confidence:', row.total_confidence);
    console.log('Matches:', JSON.stringify(row.matches, null, 2));
    console.log('---');
  }
  await pool.end();
})();
