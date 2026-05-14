const db = require('../backend/db');

async function checkRawJson() {
  try {
    console.log('Checking raw JSON structure...\n');
    
    // Check the May 17 match that should be FC Lorient vs Le Havre AC
    const result = await db.query(`
      SELECT id_event, raw_json, start_time 
      FROM raw_fixtures 
      WHERE start_time >= '2026-05-17' AND start_time < '2026-05-18'
      ORDER BY start_time ASC
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('No May 17 matches found');
      return;
    }
    
    const row = result.rows[0];
    console.log(`Match ID: ${row.id_event}`);
    console.log(`Start time: ${row.start_time}`);
    console.log(`Raw JSON type: ${typeof row.raw_json}`);
    console.log(`Raw JSON value:`, row.raw_json);
    
    // If it's already an object, no need to parse
    if (typeof row.raw_json === 'object') {
      console.log('\nRaw JSON is already an object:');
      console.log(`- Home Team: ${row.raw_json.strHomeTeam || 'N/A'}`);
      console.log(`- Away Team: ${row.raw_json.strAwayTeam || 'N/A'}`);
      console.log(`- League: ${row.raw_json.strLeague || 'N/A'}`);
      
      // Check if this is the Lorient vs Havre match
      const homeTeam = (row.raw_json.strHomeTeam || '').toLowerCase();
      const awayTeam = (row.raw_json.strAwayTeam || '').toLowerCase();
      
      if (homeTeam.includes('lorient') || awayTeam.includes('lorient')) {
        console.log('✅ Found Lorient in this match!');
      }
      if (homeTeam.includes('havre') || awayTeam.includes('havre')) {
        console.log('✅ Found Havre in this match!');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkRawJson();
