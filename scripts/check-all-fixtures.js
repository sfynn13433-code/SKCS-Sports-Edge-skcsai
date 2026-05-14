const db = require('../backend/db');

async function checkAllFixtures() {
  try {
    console.log('Checking all fixtures in database...\n');
    
    const result = await db.query(`
      SELECT id_event, raw_json, start_time 
      FROM raw_fixtures 
      ORDER BY start_time DESC
      LIMIT 10
    `);
    
    console.log(`Found ${result.rows.length} fixtures:`);
    
    result.rows.forEach(row => {
      try {
        const matchData = JSON.parse(row.raw_json);
        console.log(`- ID: ${row.id_event}`);
        console.log(`  Match: ${matchData.strHomeTeam || 'Unknown'} vs ${matchData.strAwayTeam || 'Unknown'}`);
        console.log(`  Date: ${row.start_time}`);
        console.log(`  League: ${matchData.strLeague || 'Unknown'}`);
        console.log('');
      } catch (err) {
        console.log(`- ID: ${row.id_event} (JSON parse error)`);
        console.log(`  Date: ${row.start_time}`);
        console.log('');
      }
    });
    
    // Also check for any Lorient or Havre matches with different search
    const lorientResult = await db.query(`
      SELECT id_event, raw_json, start_time 
      FROM raw_fixtures 
      WHERE raw_json::text ILIKE '%lorient%'
      ORDER BY start_time DESC
    `);
    
    console.log(`\nFound ${lorientResult.rows.length} Lorient matches:`);
    lorientResult.rows.forEach(row => {
      try {
        const matchData = JSON.parse(row.raw_json);
        console.log(`- ID: ${row.id_event}`);
        console.log(`  Match: ${matchData.strHomeTeam || 'Unknown'} vs ${matchData.strAwayTeam || 'Unknown'}`);
        console.log(`  Date: ${row.start_time}`);
        console.log('');
      } catch (err) {
        console.log(`- ID: ${row.id_event} (JSON parse error)`);
        console.log(`  Date: ${row.start_time}`);
        console.log('');
      }
    });
    
    const havreResult = await db.query(`
      SELECT id_event, raw_json, start_time 
      FROM raw_fixtures 
      WHERE raw_json::text ILIKE '%havre%'
      ORDER BY start_time DESC
    `);
    
    console.log(`\nFound ${havreResult.rows.length} Havre matches:`);
    havreResult.rows.forEach(row => {
      try {
        const matchData = JSON.parse(row.raw_json);
        console.log(`- ID: ${row.id_event}`);
        console.log(`  Match: ${matchData.strHomeTeam || 'Unknown'} vs ${matchData.strAwayTeam || 'Unknown'}`);
        console.log(`  Date: ${row.start_time}`);
        console.log('');
      } catch (err) {
        console.log(`- ID: ${row.id_event} (JSON parse error)`);
        console.log(`  Date: ${row.start_time}`);
        console.log('');
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkAllFixtures();
