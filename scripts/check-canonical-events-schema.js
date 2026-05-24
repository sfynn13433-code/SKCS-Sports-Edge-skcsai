const { query } = require('../backend/db');

async function checkSchema() {
  const { rows } = await query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'canonical_events' AND table_schema = 'public' ORDER BY ordinal_position"
  );
  console.log('canonical_events columns:');
  console.log(JSON.stringify(rows, null, 2));

  // Check indexes
  const { rows: indexes } = await query(
    "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'canonical_events' AND schemaname = 'public'"
  );
  console.log('\ncanonical_events indexes:');
  console.log(JSON.stringify(indexes, null, 2));

  process.exit(0);
}

checkSchema().catch(e => { console.error(e.message); process.exit(1); });
