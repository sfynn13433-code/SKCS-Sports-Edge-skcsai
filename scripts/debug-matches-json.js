const db = require('../backend/db');

async function debugMatchesJson() {
  console.log('=== DEBUGGING MATCHES JSON FOR PREDICTION 76412 ===\n');
  
  try {
    // Get the specific prediction
    const result = await db.query(`
      SELECT id, matches, created_at
      FROM direct1x2_prediction_final
      WHERE id = 76412
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Prediction 76412 not found');
      return;
    }
    
    const prediction = result.rows[0];
    console.log('Prediction found:');
    console.log(`- ID: ${prediction.id}`);
    console.log(`- Created: ${prediction.created_at}`);
    console.log(`- Matches (raw): ${prediction.matches}`);
    console.log(`- Matches type: ${typeof prediction.matches}`);
    
    // Try to parse the JSON
    if (prediction.matches) {
      console.log('\nAttempting to parse JSON...');
      
      try {
        const matches = JSON.parse(prediction.matches);
        console.log('✅ JSON parsed successfully');
        console.log(`Matches type: ${typeof matches}`);
        console.log(`Matches length: ${Array.isArray(matches) ? matches.length : 'not an array'}`);
        
        if (Array.isArray(matches)) {
          matches.forEach((match, i) => {
            console.log(`\nMatch ${i + 1}:`);
            console.log(`- Type: ${typeof match}`);
            console.log(`- Keys: ${Object.keys(match)}`);
            console.log(`- match_id: ${match.match_id}`);
            console.log(`- home_team: ${match.home_team}`);
            console.log(`- away_team: ${match.away_team}`);
            console.log(`- confidence: ${match.confidence}`);
            console.log(`- prediction: ${match.prediction}`);
            
            // Check if this contains 542703
            if (match.match_id === '542703') {
              console.log('🎯 FOUND! This match contains match_id 542703');
            }
          });
        } else {
          console.log('❌ Matches is not an array');
          console.log('Matches content:', matches);
        }
        
      } catch (parseError) {
        console.log('❌ JSON parse error:', parseError.message);
        
        // Try to see what's actually in there
        console.log('\nDebugging JSON content...');
        console.log('First 100 chars:', prediction.matches.substring(0, 100));
        console.log('Last 100 chars:', prediction.matches.substring(prediction.matches.length - 100));
        
        // Check if it's double-encoded
        try {
          const decoded = JSON.parse(prediction.matches);
          console.log('Decoded once:', typeof decoded);
          if (typeof decoded === 'string') {
            const decodedAgain = JSON.parse(decoded);
            console.log('Decoded twice:', typeof decodedAgain);
            console.log('Decoded twice content:', decodedAgain);
          }
        } catch (e) {
          console.log('Not double-encoded');
        }
      }
    }
    
    // Test the search pattern that the endpoint uses
    console.log('\n=== TESTING ENDPOINT SEARCH PATTERNS ===');
    
    const searchPatterns = [
      `%"match_id":"542703"%`,
      `%"id_event":"542703"%`,
      `%"fixture_id":"542703"%`,
      `%"id":"542703"%`
    ];
    
    for (const pattern of searchPatterns) {
      const searchResult = await db.query(`
        SELECT id
        FROM direct1x2_prediction_final
        WHERE matches::text LIKE $1
        LIMIT 1
      `, [pattern]);
      
      console.log(`Pattern "${pattern}": ${searchResult.rows.length > 0 ? '✅ FOUND' : '❌ NOT FOUND'}`);
      if (searchResult.rows.length > 0) {
        console.log(`  Found prediction ID: ${searchResult.rows[0].id}`);
      }
    }
    
  } catch (error) {
    console.error('Debug error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

debugMatchesJson();
