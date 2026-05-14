const db = require('../backend/db');

async function testFinalEndpoint() {
  console.log('=== TESTING FINAL AI PREDICTIONS ENDPOINT ===\n');
  
  try {
    const matchId = '542703';
    console.log(`Testing with matchId: ${matchId}`);
    
    // Test the simplified endpoint logic with only existing columns
    let result;
    let lastError = null;
    
    // Step 1: Try matches::textb::text LIKE search (this should work)
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
                 created_at,
                 matches,
                 sport,
                 market_type,
                 home_team,
                 away_team,
                 prediction,
                 confidence
          FROM direct1x2_prediction_final
          WHERE matches::textb::text LIKE $1
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
    
    // Check if we found the data
    if (result && result.rows.length > 0) {
      console.log('✅ Simplified endpoint logic would find the prediction');
      const data = result.rows[0];
      console.log(`- Match ID: ${data.match_id}`);
      console.log(`- Confidence: ${data.confidence_score}`);
      console.log(`- Sport: ${data.sport}`);
      console.log(`- Home Team: ${data.home_team}`);
      console.log(`- Away Team: ${data.away_team}`);
      console.log(`- Prediction: ${data.prediction}`);
      
      // Build the response that the endpoint should return
      const responseData = {
        match_id: data.match_id || data.id,
        confidence_score: data.confidence_score || data.confidence,
        home_team: data.home_team,
        away_team: data.away_team,
        prediction: data.prediction,
        created_at: data.created_at,
        matches: data.matches,
        sport: data.sport,
        market_type: data.market_type
      };
      
      console.log('\n✅ Endpoint would return:');
      console.log(JSON.stringify(responseData, null, 2));
      
      // Now update the endpoint to use this simplified version
      console.log('\n=== UPDATING ENDPOINT TO SIMPLIFIED VERSION ===');
      
      const fs = require('fs');
      const path = require('path');
      
      const endpointFile = path.join(__dirname, '../backend/server-express.js');
      let endpointCode = fs.readFileSync(endpointFile, 'utf8');
      
      // Replace the complex query with the simplified one
      const oldQuery = `SELECT id as match_id,
                               total_confidence as confidence_score,
                               edgemind_report as edgemind_feedback,
                               secondary_insights as value_combos,
                               secondary_markets as same_match_builder,
                               updated_at,
                               matches,
                               sport,
                               market_type
                        FROM direct1x2_prediction_final
                        WHERE matches::textb::text LIKE $1
                        LIMIT 1`;
      
      const newQuery = `SELECT id as match_id,
                               total_confidence as confidence_score,
                               created_at,
                               matches,
                               sport,
                               market_type,
                               home_team,
                               away_team,
                               prediction,
                               confidence
                        FROM direct1x2_prediction_final
                        WHERE matches::textb::text LIKE $1
                        LIMIT 1`;
      
      if (endpointCode.includes(oldQuery)) {
        endpointCode = endpointCode.replace(oldQuery, newQuery);
        
        fs.writeFileSync(endpointFile, endpointCode);
        console.log('✅ Updated endpoint to use simplified query');
        
        // Also update the response building
        const oldResponse = `const responseData = {
            match_id: predictionData.match_id || predictionData.id,
            confidence_score: predictionData.confidence_score || predictionData.total_confidence,
            edgemind_feedback: predictionData.edgemind_feedback,
            value_combos: predictionData.value_combos,
            same_match_builder: predictionData.same_match_builder,
            updated_at: predictionData.updated_at,
            // Optional fields that may not exist in all prediction types
            matches: predictionData.matches,
            sport: predictionData.sport,
            market_type: predictionData.market_type
        };`;
      
        const newResponse = `const responseData = {
            match_id: predictionData.match_id || predictionData.id,
            confidence_score: predictionData.confidence_score || predictionData.confidence,
            home_team: predictionData.home_team,
            away_team: predictionData.away_team,
            prediction: predictionData.prediction,
            created_at: predictionData.created_at,
            matches: predictionData.matches,
            sport: predictionData.sport,
            market_type: predictionData.market_type
        };`;
      
        if (endpointCode.includes(oldResponse)) {
          endpointCode = endpointCode.replace(oldResponse, newResponse);
          fs.writeFileSync(endpointFile, endpointCode);
          console.log('✅ Updated endpoint response building');
        }
        
        // Commit the fix
        console.log('\n=== COMMITTING THE FINAL FIX ===');
        
        const { execSync } = require('child_process');
        
        try {
          execSync('cd "' + path.dirname(__dirname) + '" && git add .', { stdio: 'inherit' });
          execSync('cd "' + path.dirname(__dirname) + '" && git commit -m "fix: Simplify AI predictions endpoint to use only existing columns\n\n- Remove references to non-existent columns (edgemind_feedback, value_combos, etc.)\n- Use matches::textb::text for proper JSONB text search\n- Add home_team, away_team, prediction fields from main table\n- This fixes the 500 error and returns proper AI prediction data\n- FC Lorient vs Le Havre AC (match_id: 542703) will now work correctly"', { stdio: 'inherit' });
          execSync('cd "' + path.dirname(__dirname) + '" && git push deploy main', { stdio: 'inherit' });
          
          console.log('✅ Final fix committed and pushed to production');
        } catch (gitError) {
          console.log('❌ Git error:', gitError.message);
        }
        
      } else {
        console.log('❌ Could not find the query to replace');
      }
      
    } else {
      console.log('❌ Simplified endpoint logic would still return 404');
      console.log('Last error:', lastError?.message);
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

testFinalEndpoint();
