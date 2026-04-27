require('dotenv').config({ path: 'backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const TABLES = [
  'tier_rules',
  'acca_rules',
  'subscription_tiers',
  'plans',
  'prediction_publish_runs',
  'direct1x2_prediction_final',
  'predictions_final',
  'fixtures',
  'matches'
];

async function readTable(table) {
  const { data, error } = await supabase.from(table).select('*').limit(50);
  if (error) return { table, exists: false, error: error.message };
  return { table, exists: true, rows: data };
}

async function cricketFinalRows() {
  const { data, error } = await supabase
    .from('direct1x2_prediction_final')
    .select('*')
    .eq('sport', 'cricket')
    .limit(20);

  if (error) return { table: 'direct1x2_prediction_final', error: error.message };
  return { table: 'direct1x2_prediction_final', cricket_rows: data };
}

(async () => {
  console.log('=== CRICKET RULES AUDIT START ===');

  for (const table of TABLES) {
    console.log(JSON.stringify(await readTable(table), null, 2));
  }

  console.log('=== CRICKET FINAL ROW SAMPLE ===');
  console.log(JSON.stringify(await cricketFinalRows(), null, 2));

  console.log('=== CRICKET RULES AUDIT END ===');
})();