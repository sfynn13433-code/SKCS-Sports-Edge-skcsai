require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://ghzjntdvaptuxfpvhybb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error('ERROR: SUPABASE_SERVICE_KEY not set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Total count
  const { count, error } = await supabase
    .from('canonical_events')
    .select('*', { count: 'exact', head: true });
  
  if (error) { console.error('Count error:', error); return; }
  console.log('Total canonical_events:', count);

  // Get all events with dates
  const { data, error: fetchErr } = await supabase
    .from('canonical_events')
    .select('id, sport, competition_name, start_time_utc, status')
    .order('start_time_utc', { ascending: true })
    .limit(50);
  
  if (fetchErr) { console.error('Fetch error:', fetchErr); return; }
  
  console.log('\nFirst 50 events (oldest first):');
  data.forEach(e => {
    const date = e.start_time_utc ? new Date(e.start_time_utc).toISOString().slice(0, 10) : 'NULL';
    console.log('  ID=' + e.id + ' | Sport=' + e.sport + ' | Comp=' + e.competition_name + ' | Date=' + date + ' | Status=' + e.status);
  });

  // Count by sport
  const { data: bySport, error: sportErr } = await supabase
    .from('canonical_events')
    .select('sport');
  
  if (!sportErr && bySport) {
    const sportCounts = {};
    bySport.forEach(e => { sportCounts[e.sport] = (sportCounts[e.sport] || 0) + 1; });
    console.log('\nEvents by sport:', sportCounts);
  }

  // Count future events (after today 2026-04-10)
  const now = new Date().toISOString();
  const { count: futureCount, error: futureErr } = await supabase
    .from('canonical_events')
    .select('*', { count: 'exact', head: true })
    .gt('start_time_utc', now);
  
  if (!futureErr) {
    console.log('\nFuture events (after now):', futureCount);
  }

  // Show future events
  const { data: futureEvents, error: futureFetchErr } = await supabase
    .from('canonical_events')
    .select('id, sport, competition_name, start_time_utc')
    .gt('start_time_utc', now)
    .order('start_time_utc', { ascending: true })
    .limit(30);
  
  if (!futureFetchErr && futureEvents) {
    console.log('\nFuture events (next 30):');
    futureEvents.forEach(e => {
      const date = new Date(e.start_time_utc).toISOString().slice(0, 16).replace('T', ' ');
      console.log('  ID=' + e.id + ' | Sport=' + e.sport + ' | Comp=' + e.competition_name + ' | Date=' + date);
    });
  }
}

check();
