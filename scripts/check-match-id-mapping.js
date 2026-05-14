const db = require('../backend/db');

async function checkMatchIdMapping() {
  console.log('=== CHECKING MATCH ID MAPPING FOR 542703 ===\n');
  
  try {
    // Step 1: Check what's in the final table
    console.log('STEP 1: CHECKING FINAL TABLE');
    console.log('------------------------------------');
    
    const finalResult = await db.query(`
      SELECT id, matches, created_at
      FROM direct1x2_prediction_final
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('Recent predictions in final table:');
    finalResult.rows.forEach((row, i) => {
      console.log(`${i + 1}. ID: ${row.id}, Created: ${row.created_at}`);
      if (row.matches) {
        try {
          const matches = JSON.parse(row.matches);
          matches.forEach((match, j) => {
            console.log(`   Match ${j + 1}: match_id=${match.match_id}, home=${match.home_team}, away=${match.away_team}`);
          });
        } catch (e) {
          console.log(`   Matches: ${row.matches}`);
        }
      }
    });
    
    // Step 2: Search for match ID 542703 specifically
    console.log('\nSTEP 2: SEARCHING FOR MATCH ID 542703');
    console.log('------------------------------------');
    
    // Check if 542703 appears anywhere in the matches JSON
    const searchResult = await db.query(`
      SELECT id, matches, created_at
      FROM direct1x2_prediction_final
      WHERE matches::text LIKE '%542703%'
      LIMIT 1
    `);
    
    if (searchResult.rows.length > 0) {
      console.log('✅ Found match ID 542703 in final table:');
      const match = searchResult.rows[0];
      console.log(`- Prediction ID: ${match.id}`);
      console.log(`- Created: ${match.created_at}`);
      
      if (match.matches) {
        try {
          const matches = JSON.parse(match.matches);
          matches.forEach((m, i) => {
            console.log(`- Match ${i + 1}: ${JSON.stringify(m)}`);
          });
        } catch (e) {
          console.log(`- Matches JSON: ${match.matches}`);
        }
      }
    } else {
      console.log('❌ Match ID 542703 not found in final table');
    }
    
    // Step 3: Check the raw prediction mapping
    console.log('\nSTEP 3: CHECKING RAW PREDICTION MAPPING');
    console.log('------------------------------------');
    
    const rawResult = await db.query(`
      SELECT id, match_id, metadata
      FROM predictions_raw
      WHERE id = 76412 OR match_id = '542703'
      LIMIT 5
    `);
    
    console.log('Raw prediction mapping:');
    rawResult.rows.forEach((row, i) => {
      console.log(`${i + 1}. Raw ID: ${row.id}, Match ID: ${row.match_id}`);
      if (row.metadata) {
        console.log(`   Teams: ${row.metadata.home_team} vs ${row.metadata.away_team}`);
      }
    });
    
    // Step 4: Check what the frontend should be requesting
    console.log('\nSTEP 4: FRONTEND REQUEST ANALYSIS');
    console.log('------------------------------------');
    
    console.log('Frontend is requesting: /api/ai-predictions/542703');
    console.log('But the actual prediction ID is: 76412');
    console.log('The match_id in raw data is: 542703');
    
    // Step 5: Fix the mapping issue
    console.log('\nSTEP 5: FIXING THE MAPPING');
    console.log('------------------------------------');
    
    // The endpoint needs to search for match_id in the matches array
    console.log('The endpoint should find the prediction by searching matches::text');
    console.log('Let me check if the search patterns include match_id...');
    
    const searchPatterns = [
      `%"match_id":"542703"%`,
      `%"id_event":"542703"%`,
      `%"fixture_id":"542703"%`,
      `%"id":"542703"%`
    ];
    
    for (const pattern of searchPatterns) {
      const patternResult = await db.query(`
        SELECT id, matches
        FROM direct1x2_prediction_final
        WHERE matches::text LIKE $1
        LIMIT 1
      `, [pattern]);
      
      if (patternResult.rows.length > 0) {
        console.log(`✅ Found with pattern: ${pattern}`);
        console.log(`- Prediction ID: ${patternResult.rows[0].id}`);
        
        // Check the matches structure
        if (patternResult.rows[0].matches) {
          try {
            const matches = JSON.parse(patternResult.rows[0].matches);
            console.log('- Matches structure:');
            matches.forEach((m, i) => {
              console.log(`  ${i + 1}: ${JSON.stringify(m, null, 2)}`);
            });
          } catch (e) {
            console.log(`- Matches JSON: ${patternResult.rows[0].matches}`);
          }
        }
        break;
      }
    }
    
  } catch (error) {
    console.error('Check error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

checkMatchIdMapping();
