const db = require('../backend/db');

async function checkFinalTableColumns() {
  console.log('=== CHECKING FINAL TABLE COLUMN NAMES ===\n');
  
  try {
    // Get the actual column names
    const schemaResult = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'direct1x2_prediction_final'
      ORDER BY ordinal_position
    `);
    
    console.log('direct1x2_prediction_final columns:');
    schemaResult.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    });
    
    // Check if there's an 'id' column or if it's called something else
    const hasIdColumn = schemaResult.rows.some(col => col.column_name === 'id');
    console.log(`\nHas 'id' column: ${hasIdColumn}`);
    
    // Look for similar column names
    const idLikeColumns = schemaResult.rows.filter(col => 
      col.column_name.toLowerCase().includes('id')
    );
    console.log('ID-like columns:');
    idLikeColumns.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    });
    
    // Test the search with the correct column name
    console.log('\n=== TESTING SEARCH WITH CORRECT COLUMN ===');
    
    const matchId = '542703';
    
    // Try with the first ID-like column
    if (idLikeColumns.length > 0) {
      const idColumn = idLikeColumns[0].column_name;
      console.log(`Testing with column: ${idColumn}`);
      
      const testResult = await db.query(`
        SELECT ${idColumn} as match_id,
               total_confidence as confidence_score,
               matches,
               sport,
               created_at
        FROM direct1x2_prediction_final
        WHERE ${idColumn}::text = $1
        LIMIT 1
      `, [matchId]);
      
      console.log(`Direct query result: ${testResult.rows.length} rows`);
      
      if (testResult.rows.length > 0) {
        console.log('✅ Found prediction with direct query');
        const data = testResult.rows[0];
        console.log(`- ${idColumn}: ${data.match_id}`);
        console.log(`- Confidence: ${data.confidence_score}`);
        console.log(`- Sport: ${data.sport}`);
      }
    }
    
    // Test the text search on matches
    console.log('\n=== TESTING MATCHES TEXT SEARCH ===');
    
    const textSearchResult = await db.query(`
      SELECT id as match_id,
             total_confidence as confidence_score,
             matches,
             sport,
             created_at
      FROM direct1x2_prediction_final
      WHERE matches::text LIKE '%542703%'
      LIMIT 1
    `);
    
    console.log(`Text search result: ${textSearchResult.rows.length} rows`);
    
    if (textSearchResult.rows.length > 0) {
      console.log('✅ Found prediction with text search');
      const data = textSearchResult.rows[0];
      console.log(`- ID: ${data.match_id}`);
      console.log(`- Confidence: ${data.confidence_score}`);
      console.log(`- Sport: ${data.sport}`);
      
      // Check the matches content
      if (data.matches) {
        console.log(`- Matches type: ${typeof data.matches}`);
        console.log(`- Matches contains 542703: ${data.matches.includes('542703')}`);
      }
    }
    
  } catch (error) {
    console.error('Check error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

checkFinalTableColumns();
