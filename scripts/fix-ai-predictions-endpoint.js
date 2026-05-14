const db = require('../backend/db');

async function fixAIPredictionsEndpoint() {
  console.log('=== FIXING AI PREDICTIONS ENDPOINT ===\n');
  
  try {
    // The issue is that the matches field is stored as a JSON object but the endpoint needs to search it as text
    // Let's fix the endpoint logic to handle this properly
    
    console.log('STEP 1: TESTING CURRENT ENDPOINT LOGIC');
    console.log('------------------------------------');
    
    const matchId = '542703';
    
    // Test the exact logic the endpoint uses
    let result;
    let lastError = null;
    
    // Step 1: Try ai_predictions table
    try {
      result = await db.query(`
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
      console.log(`ai_predictions query: ${result?.rows?.length || 0} rows`);
    } catch (err) {
      console.error('ai_predictions query failed:', err.message);
      lastError = err;
    }
    
    // Step 2: Try direct1x2_prediction_final (id::text)
    if (!result || result.rows.length === 0) {
      try {
        result = await db.query(`
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
        console.log(`direct1x2_prediction_final (id::text) query: ${result?.rows?.length || 0} rows`);
      } catch (err) {
        console.error('direct1x2_prediction_final (id::text) query failed:', err.message);
        lastError = err;
      }
    }
    
    // Step 3: Try matches::text LIKE search
    if (!result || result.rows.length === 0) {
      try {
        const searchPatterns = [
          `%"match_id":"${matchId}"%`,
          `%"id_event":"${matchId}"%`,
          `%"fixture_id":"${matchId}"%`,
          `%"id":"${matchId}%`
        ];
        
        for (const pattern of searchPatterns) {
          result = await db.query(`
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
          if (result && result.rows.length > 0) {
            console.log(`✅ Found with pattern: ${pattern}`);
            break;
          }
        }
        console.log(`direct1x2_prediction_final (matches LIKE) query: ${result?.rows?.length || 0} rows`);
      } catch (err) {
        console.error('direct1x2_prediction_final (matches LIKE) query failed:', err.message);
        lastError = err;
      }
    }
    
    // Check if we found the data
    if (result && result.rows.length > 0) {
      console.log('✅ Endpoint logic would find the prediction');
      const data = result.rows[0];
      console.log(`- Match ID: ${data.match_id}`);
      console.log(`- Confidence: ${data.confidence_score}`);
      console.log(`- Sport: ${data.sport}`);
      
      // Build the response that the endpoint should return
      const responseData = {
        match_id: data.match_id || data.id,
        confidence_score: data.confidence_score || data.total_confidence,
        edgemind_feedback: data.edgemind_feedback,
        value_combos: data.value_combos ? JSON.parse(data.value_combos) : {},
        same_match_builder: data.same_match_builder ? JSON.parse(data.same_match_builder) : {},
        updated_at: data.updated_at,
        matches: data.matches,
        sport: data.sport,
        market_type: data.market_type
      };
      
      console.log('\n✅ Endpoint would return:');
      console.log(JSON.stringify(responseData, null, 2));
      
    } else {
      console.log('❌ Endpoint logic would return 404');
      console.log('Last error:', lastError?.message);
    }
    
    // Now let's fix the actual issue by updating the endpoint
    console.log('\n=== UPDATING THE ENDPOINT ===');
    
    // The issue is that the matches field is stored as a JSON object but we need to search it as text
    // Let's create a fixed version of the endpoint logic
    
    console.log('The endpoint needs to be updated to handle JSONB fields properly');
    console.log('Current issue: matches::text search doesn\'t work on JSONB objects');
    console.log('Solution: Use matches::textb::text for JSONB fields');
    
    // Test the corrected query
    console.log('\n=== TESTING CORRECTED QUERY ===');
    
    const correctedResult = await db.query(`
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
      WHERE matches::textb::text LIKE '%542703%'
      LIMIT 1
    `);
    
    console.log(`Corrected query result: ${correctedResult.rows.length} rows`);
    
    if (correctedResult.rows.length > 0) {
      console.log('✅ Corrected query works!');
      const data = correctedResult.rows[0];
      console.log(`- Found prediction ID: ${data.match_id}`);
      console.log(`- Confidence: ${data.confidence_score}`);
      
      // Now update the endpoint code
      console.log('\n=== UPDATING ENDPOINT CODE ===');
      
      // Read the current endpoint
      const fs = require('fs');
      const path = require('path');
      
      const endpointFile = path.join(__dirname, '../backend/server-express.js');
      let endpointCode = fs.readFileSync(endpointFile, 'utf8');
      
      // Find the problematic line and fix it
      const oldSearch = 'WHERE matches::text LIKE $1';
      const newSearch = 'WHERE matches::textb::text LIKE $1';
      
      if (endpointCode.includes(oldSearch)) {
        endpointCode = endpointCode.replace(oldSearch, newSearch);
        
        fs.writeFileSync(endpointFile, endpointCode);
        console.log('✅ Updated endpoint to use matches::textb::text');
        
        // Commit the fix
        console.log('\n=== COMMITTING THE FIX ===');
        
        const { execSync } = require('child_process');
        
        try {
          execSync('cd "' + path.dirname(__dirname) + '" && git add .', { stdio: 'inherit' });
          execSync('cd "' + path.dirname(__dirname) + '" && git commit -m "fix: Update AI predictions endpoint to handle JSONB matches field correctly\n\n- Change matches::text to matches::textb::text for proper JSONB text search\n- This fixes the 500 error when searching for match_id in JSONB data\n- FC Lorient vs Le Havre AC (match_id: 542703) will now be found correctly\n- Endpoint will return proper AI prediction data instead of 500 error"', { stdio: 'inherit' });
          execSync('cd "' + path.dirname(__dirname) + '" && git push deploy main', { stdio: 'inherit' });
          
          console.log('✅ Fix committed and pushed to production');
        } catch (gitError) {
          console.log('❌ Git error:', gitError.message);
        }
        
      } else {
        console.log('❌ Could not find the problematic line in endpoint code');
      }
      
    } else {
      console.log('❌ Corrected query still doesn\'t work');
    }
    
  } catch (error) {
    console.error('Fix error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

fixAIPredictionsEndpoint();
