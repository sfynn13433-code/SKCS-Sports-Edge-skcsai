require('dotenv').config({ path: 'backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const tables = [
  'cricket_fixtures',
  'cricket_insights_final',
  'cricket_market_rules'
];

async function checkTable(table) {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      return { table, exists: false, error: error.message, count: 0, sample: [] };
    }
    
    const { data, error: sampleError } = await supabase
      .from(table)
      .select('*')
      .limit(5);
    
    return { 
      table, 
      exists: true, 
      count: count || 0, 
      sample: sampleError ? [] : data.map(r => ({id: r.id, home: r.home_team, away:r.away_team, status: r.status}))
    };
  } catch (err) {
    return { table, exists: false, error: err.message, count: 0, sample: [] };
  }
}

(async () => {
  console.log('=== CRICKET TABLES AUDIT ===');
  for (const table of tables) {
    console.log(JSON.stringify(await checkTable(table), null, 2));
  }
  console.log('=== END CRICKET TABLES AUDIT ===');
})();