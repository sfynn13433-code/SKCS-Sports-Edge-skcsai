require('dotenv').config({ path: 'backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const TABLES = [
  'direct1x2_prediction_final',
  'predictions_final',
  'fixtures',
  'matches',
  'insights',
  'match_context_data',
  'events',
  'raw_fixtures',
  'sports_events'
];

async function safeQuery(table) {
  try {
    const { count, error: countError } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return { table, exists: false, error: countError.message };
    }

    const { count: cricketCount, error: cricketError } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'cricket');

    const { data, error: sampleError } = await supabase
      .from(table)
      .select('*')
      .or('sport.eq.cricket,provider.eq.cricbuzz,source.eq.cricbuzz,source.eq.cricbuzz_fixture_bridge')
      .limit(5);

    return {
      table,
      exists: true,
      count,
      cricketCount: cricketError ? `ERR: ${cricketError.message}` : cricketCount,
      sampleError: sampleError ? sampleError.message : null,
      sample: data || []
    };
  } catch (err) {
    return { table, exists: false, error: err.message };
  }
}

(async () => {
  console.log('=== CRICKET STORAGE AUDIT ===');
  for (const table of TABLES) {
    console.log(JSON.stringify(await safeQuery(table), null, 2));
  }
  console.log('=== END CRICKET STORAGE AUDIT ===');
})();