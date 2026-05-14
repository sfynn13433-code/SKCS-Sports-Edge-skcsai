const db = require('../backend/db');

async function checkFixturesStructure() {
  console.log('=== CHECKING ACTUAL FIXTURES TABLE STRUCTURES ===\n');
  
  try {
    // Check cricket_fixtures structure
    console.log('CRICKET_FIXTURES STRUCTURE:');
    console.log('------------------------------------');
    
    const cricketColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'cricket_fixtures'
      ORDER BY ordinal_position
    `);
    
    cricketColumns.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });
    
    // Check sample data from cricket_fixtures
    console.log('\nCRICKET_FIXTURES SAMPLE DATA:');
    console.log('------------------------------------');
    
    const cricketSample = await db.query(`
      SELECT * FROM cricket_fixtures LIMIT 3
    `);
    
    cricketSample.rows.forEach((row, i) => {
      console.log(`Row ${i + 1}:`);
      Object.keys(row).forEach(key => {
        console.log(`  ${key}: ${row[key]}`);
      });
      console.log('');
    });
    
    // Check fixtures structure
    console.log('FIXTURES STRUCTURE:');
    console.log('------------------------------------');
    
    const fixturesColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'fixtures'
      ORDER BY ordinal_position
    `);
    
    fixturesColumns.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });
    
    // Check sample data from fixtures
    console.log('\nFIXTURES SAMPLE DATA:');
    console.log('------------------------------------');
    
    const fixturesSample = await db.query(`
      SELECT * FROM fixtures LIMIT 3
    `);
    
    fixturesSample.rows.forEach((row, i) => {
      console.log(`Row ${i + 1}:`);
      Object.keys(row).forEach(key => {
        console.log(`  ${key}: ${row[key]}`);
      });
      console.log('');
    });
    
    // Compare structures
    console.log('STRUCTURE COMPARISON:');
    console.log('------------------------------------');
    
    const cricketCols = cricketColumns.rows.map(r => r.column_name);
    const fixturesCols = fixturesColumns.rows.map(r => r.column_name);
    
    console.log('Cricket fixtures columns:', cricketCols.join(', '));
    console.log('Football fixtures columns:', fixturesCols.join(', '));
    
    const commonCols = cricketCols.filter(col => fixturesCols.includes(col));
    const cricketOnly = cricketCols.filter(col => !fixturesCols.includes(col));
    const fixturesOnly = fixturesCols.filter(col => !cricketCols.includes(col));
    
    console.log('\nCommon columns:', commonCols.join(', ') || 'None');
    console.log('Cricket only:', cricketOnly.join(', ') || 'None');
    console.log('Football only:', fixturesOnly.join(', ') || 'None');
    
    // Determine the actual primary key/identifier column
    console.log('\nIDENTIFIER COLUMN ANALYSIS:');
    console.log('------------------------------------');
    
    // Check for common identifier columns
    const possibleIds = ['id', 'match_id', 'fixture_id', 'game_id', 'id_event'];
    
    possibleIds.forEach(idCol => {
      const cricketHasId = cricketCols.includes(idCol);
      const fixturesHasId = fixturesCols.includes(idCol);
      
      if (cricketHasId || fixturesHasId) {
        console.log(`${idCol}: Cricket=${cricketHasId}, Football=${fixturesHasId}`);
      }
    });
    
    return {
      cricketColumns: cricketCols,
      fixturesColumns: fixturesCols,
      commonColumns: commonCols,
      cricketOnly: cricketOnly,
      fixturesOnly: fixturesOnly
    };
    
  } catch (error) {
    console.error('Error checking fixtures structure:', error.message);
    throw error;
  } finally {
    process.exit(0);
  }
}

checkFixturesStructure();
