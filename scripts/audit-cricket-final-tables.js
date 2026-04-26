const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const tables = [
  'direct1x2_prediction_final',
  'predictions_final',
  'fixtures',
  'matches',
  'insights',
  'match_context_data'
];

async function safeCount(table, sport) {
  const q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (sport) q.eq('sport', sport);
  const { count, error } = await q;
  if (error) return { table, sport: sport || 'ALL', error: error.message };
  return { table, sport: sport || 'ALL', count };
}

async function safeSample(table, sport) {
  let q = supabase.from(table).select('*').limit(5);
  if (sport) q = q.eq('sport', sport);
  const { data, error } = await q;
  if (error) return { table, sport: sport || 'ALL', error: error.message };
  return {
    table,
    sport: sport || 'ALL',
    sample: (data || []).map(r => ({
      id: r.id,
      sport: r.sport,
      home_team: r.home_team || r.homeTeam || r.team1,
      away_team: r.away_team || r.awayTeam || r.team2,
      league: r.league || r.competition || r.tournament,
      market: r.market || r.market_type || r.prediction_type || r.type,
      type: r.type || r.section_type,
      confidence: r.confidence || r.total_confidence,
      kickoff_time: r.kickoff_time || r.start_time || r.match_time,
      created_at: r.created_at
    }))
  };
}

(async () => {
  console.log('=== CRICKET FINAL TABLE AUDIT ===');

  for (const table of tables) {
    console.log(await safeCount(table));
    console.log(await safeCount(table, 'cricket'));
    console.log(JSON.stringify(await safeSample(table, 'cricket'), null, 2));
  }

  console.log('=== END CRICKET FINAL TABLE AUDIT ===');
})();