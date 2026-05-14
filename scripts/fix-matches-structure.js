const db = require('../backend/db');

async function fixMatchesStructure() {
  console.log('=== FIXING MATCHES STRUCTURE FOR PREDICTION 76412 ===\n');
  
  try {
    // Get the prediction and examine the matches structure
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
    console.log('Current matches structure:');
    console.log(`- Type: ${typeof prediction.matches}`);
    console.log(`- Value: ${JSON.stringify(prediction.matches, null, 2)}`);
    
    // The matches field is already an object, not a string
    // This means the endpoint search won't work because it's searching in matches::text
    // Let's fix this by converting it to a proper JSON string
    if (typeof prediction.matches === 'object') {
      console.log('\n✅ Matches is an object - need to convert to JSON string for text search');
      
      // Update the matches field to be a proper JSON string
      const matchesJson = JSON.stringify(prediction.matches);
      console.log(`JSON string: ${matchesJson}`);
      
      // Check if it contains the match_id we're looking for
      if (matchesJson.includes('542703')) {
        console.log('✅ JSON string contains match_id 542703');
        
        // Update the database to store it as JSON string
        const updateResult = await db.query(`
          UPDATE direct1x2_prediction_final
          SET matches = $1
          WHERE id = $2
          RETURNING id, matches
        `, [matchesJson, prediction.id]);
        
        console.log('✅ Updated matches field to JSON string');
        console.log(`- Updated ID: ${updateResult.rows[0].id}`);
        console.log(`- New matches type: ${typeof updateResult.rows[0].matches}`);
        
        // Test the search patterns again
        console.log('\n=== TESTING SEARCH PATTERNS AFTER FIX ===');
        
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
        
        // Now test the complete AI predictions endpoint logic
        console.log('\n=== TESTING COMPLETE ENDPOINT LOGIC ===');
        
        const matchId = '542703';
        console.log(`Testing with matchId: ${matchId}`);
        
        // Step 1: Try ai_predictions table
        const aiResult = await db.query(`
          SELECT 
            id,
            match_id,
            home_team,
            away_team,
            prediction,
            confidence,
            edgemind_feedback,
            value_combos,
            same_match_builder,
            created_at,
            updated_at
          FROM ai_predictions 
          WHERE match_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `, [matchId]);
        
        console.log(`ai_predictions query: ${aiResult.rows.length} rows`);
        
        // Step 2: Try direct1x2_prediction_final (id::text)
        let finalResult = aiResult;
        if (!finalResult || finalResult.rows.length === 0) {
          const directResult = await db.query(`
            SELECT id as match_id,
                   total_confidence as confidence_score,
                   edgemind_feedback,
                   value_combos,
                   same_match_builder,
                   updated_at,
                   matches,
                   sport,
                   market_type
            FROM direct1x2_prediction_final
            WHERE id::text = $1
          `, [matchId]);
          
          console.log(`direct1x2_prediction_final (id::text) query: ${directResult.rows.length} rows`);
          finalResult = directResult;
        }
        
        // Step 3: Try matches::text LIKE search
        if (!finalResult || finalResult.rows.length === 0) {
          const searchPatterns = [
            `%"match_id":"${matchId}"%`,
            `%"id_event":"${matchId}"%`,
            `%"fixture_id":"${matchId}"%`,
            `%"id":"${matchId}%`
          ];
          
          for (const pattern of searchPatterns) {
            const likeResult = await db.query(`
              SELECT id as match_id,
                     total_confidence as confidence_score,
                     edgemind_feedback,
                     value_combos,
                     same_match_builder,
                     updated_at,
                     matches,
                     sport,
                     market_type
              FROM direct1x2_prediction_final
              WHERE matches::text LIKE $1
              LIMIT 1
            `, [pattern]);
            
            if (likeResult && likeResult.rows.length > 0) {
              console.log(`✅ Found with pattern: ${pattern}`);
              finalResult = likeResult;
              break;
            }
          }
        }
        
        if (finalResult && finalResult.rows.length > 0) {
          console.log('✅ Endpoint would return data successfully');
          const data = finalResult.rows[0];
          console.log(`- Match ID: ${data.match_id}`);
          console.log(`- Confidence: ${data.confidence_score}`);
          console.log(`- Sport: ${data.sport}`);
        } else {
          console.log('❌ Endpoint would still return 404');
        }
        
      } else {
        console.log('❌ JSON string does not contain match_id 542703');
      }
    } else {
      console.log('❌ Matches is not an object');
    }
    
  } catch (error) {
    console.error('Fix error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

fixMatchesStructure();
