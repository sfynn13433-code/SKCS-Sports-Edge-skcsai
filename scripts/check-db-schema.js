const db = require('../backend/db');

async function checkSchema() {
  try {
    // Check raw_fixtures table structure
    const fixturesResult = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'raw_fixtures'
      ORDER BY ordinal_position
    `);
    
    console.log('Raw fixtures columns:');
    fixturesResult.rows.forEach(col => console.log(`- ${col.column_name}: ${col.data_type}`));
    
    // Check for any fixtures data
    const dataResult = await db.query(`
      SELECT * FROM raw_fixtures 
      LIMIT 3
    `);
    
    console.log('\nSample fixtures data:');
    dataResult.rows.forEach(row => {
      console.log(`- ID: ${row.id_event}, Teams: ${row.str_home_team || 'N/A'} vs ${row.str_away_team || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkSchema();
