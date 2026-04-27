require('dotenv').config({ path: 'backend/.env' });

const { createClient } = require('@supabase/supabase-js');
const { fetchCricbuzzMatches, normalizeCricbuzzData } = require('../backend/services/cricbuzzService');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const FOOTBALL_LEAGUES = [
  'bundesliga', 'premier league', 'ligue 1', 'serie a', 'la liga',
  'primera division', 'uefa champions', 'uefa europa'
];

const FOOTBALL_TEAMS = [
  'bayern', 'arsenal', 'psg', 'manchester united', 'manchester city', 'liverpool', 'chelsea',
  'barcelona', 'real madrid', 'juventus', 'ac milan', 'dortmund', 'atletico'
];

function isFootballMatch(league, team1, team2) {
  if (!league && !team1 && !team2) return false;
  const combined = `${league || ''} ${team1 || ''} ${team2 || ''}`.toLowerCase();
  return FOOTBALL_LEAGUES.some(l => combined.includes(l)) ||
         FOOTBALL_TEAMS.some(t => combined.includes(t));
}

async function publishCricbuzzFixtures() {
  console.log('Fetching Cricbuzz matches...');
  const raw = await fetchCricbuzzMatches();
  if (!raw) {
    console.log('❌ No Cricbuzz data');
    return;
  }

  const matches = normalizeCricbuzzData(raw);
  console.log(`Cricbuzz fetched: ${matches.length}`);

  let normalized = 0;
  let inserted = 0;
  let skipped = 0;
  const first5 = [];

  for (const m of matches) {
    if (isFootballMatch(m.league, m.team1, m.team2)) {
      console.log(`⚠️ Skipping football-like: ${m.team1} vs ${m.team2}`);
      skipped++;
      continue;
    }

    normalized++;

    const row = {
      sport: 'cricket',
      market_type: '1X2',
      tier: 'normal',
      type: 'direct',
      match_date: m.start_time,
      home_team: m.team1,
      away_team: m.team2,
      fixture_id: String(m.match_id),
      prediction: 'PENDING',
      confidence: 50,
      total_confidence: 50,
      risk_level: 'medium',
      matches: [{
        fixture_id: String(m.match_id),
        home_team: m.team1,
        away_team: m.team2,
        match_date: m.start_time,
        status: m.status
      }],
      secondary_markets: [],
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('direct1x2_prediction_final')
      .insert(row);

    if (error) {
      console.log(`❌ Insert error: ${error.message}`);
      skipped++;
    } else {
      inserted++;
      if (first5.length < 5) first5.push(`${m.team1} vs ${m.team2}`);
    }
  }

  console.log(`
=== CRICBUZZ PUBLISH SUMMARY ===
CRICBUZZ_FETCHED=${matches.length}
CRICBUZZ_NORMALIZED=${normalized}
CRICBUZZ_INSERTED=${inserted}
CRICBUZZ_SKIPPED=${skipped}
FIRST_5_INSERTED=${first5.join(', ')}
===`);
}

publishCricbuzzFixtures().catch(e => console.error('Error:', e.message));