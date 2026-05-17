'use strict';

require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    console.error('[verify-db] DATABASE_URL is not set. Aborting.');
    process.exit(2);
  }
  const client = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();

    console.log('--- Risk tier distribution (grouped by risk_tier) ---');
    const byTier = await client.query(
      `SELECT risk_tier, COUNT(*) AS count
       FROM public.direct1x2_prediction_final
       GROUP BY risk_tier
       ORDER BY risk_tier`
    );
    console.table(byTier.rows);

    console.log('\n--- Confidence band counts (computed 75/55/30) ---');
    const byBands = await client.query(
      `SELECT
         SUM(CASE WHEN confidence >= 75 THEN 1 ELSE 0 END) AS ge_75,
         SUM(CASE WHEN confidence BETWEEN 55 AND 74 THEN 1 ELSE 0 END) AS b55_74,
         SUM(CASE WHEN confidence BETWEEN 30 AND 54 THEN 1 ELSE 0 END) AS b30_54,
         SUM(CASE WHEN confidence < 30 THEN 1 ELSE 0 END) AS lt_30
       FROM public.direct1x2_prediction_final`
    );
    console.table(byBands.rows);

    console.log('\n--- DB function definition: trg_enforce_secondary_market_governance() ---');
    const fn = await client.query(
      `SELECT pg_get_functiondef('public.trg_enforce_secondary_market_governance()'::regprocedure) AS def`
    );
    const def = fn.rows?.[0]?.def || '';
    const hasMin75 = def.includes('v_min_secondary_conf CONSTANT NUMERIC := 75');
    const hasHighBand = def.includes('v_row_conf BETWEEN 30 AND 54');
    const hasExtremeBand = def.includes('v_row_conf BETWEEN 0 AND 29');
    if (hasMin75) {
      console.log('OK: Secondary min confidence is set to 75 in DB trigger.');
    } else {
      console.log('WARN: Could not confirm 75 threshold in trigger body.');
    }
    if (hasHighBand && hasExtremeBand) {
      console.log('OK: Direct 1X2 pivot bands updated to 30–54 (high risk) and 0–29 (extreme).');
    } else {
      console.log('WARN: Could not confirm pivot bands (30–54 and 0–29) in trigger body.');
    }
    console.log(def);

  } catch (err) {
    console.error('[verify-db] Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main();
}
