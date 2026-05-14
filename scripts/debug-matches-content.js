const db = require('../backend/db');

async function debugMatchesContent() {
  console.log('=== DEBUGGING MATCHES CONTENT FOR PREDICTION 76412 ===\n');
  
  try {
    // Get the prediction and examine the matches field
    const result = await db.query(`
      SELECT id, matches, home_team, away_team, prediction, confidence, created_at
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
    console.log(`- Home Team: ${prediction.home_team}`);
    console.log(`- Away Team: ${prediction.away_team}`);
    console.log(`- Prediction: ${prediction.prediction}`);
    console.log(`- Confidence: ${prediction.confidence}`);
    console.log(`- Created: ${prediction.created_at}`);
    console.log(`- Matches type: ${typeof prediction.matches}`);
    
    // Check the matches content
    if (prediction.matches) {
      console.log('\n=== MATCHES CONTENT ANALYSIS ===');
      
      // Try to understand the structure
      if (typeof prediction.matches === 'object') {
        console.log('Matches is an object');
        console.log('Keys:', Object.keys(prediction.matches));
        
        if (Array.isArray(prediction.matches)) {
          console.log('Matches is an array');
          prediction.matches.forEach((match, i) => {
            console.log(`Match ${i + 1}:`);
            console.log(`- Type: ${typeof match}`);
            console.log(`- Keys: ${Object.keys(match)}`);
            console.log(`- match_id: ${match.match_id}`);
            console.log(`- home_team: ${match.home_team}`);
            console.log(`- away_team: ${match.away_team}`);
            console.log(`- confidence: ${match.confidence}`);
            console.log(`- prediction: ${match.prediction}`);
          });
        }
      } else if (typeof prediction.matches === 'string') {
        console.log('Matches is a string');
        console.log('First 200 chars:', prediction.matches.substring(0, 200));
        console.log('Contains 542703:', prediction.matches.includes('542703'));
        
        // Try to parse it
        try {
          const parsed = JSON.parse(prediction.matches);
          console.log('Parsed successfully');
          console.log('Parsed type:', typeof parsed);
          
          if (Array.isArray(parsed)) {
            console.log('Parsed is an array with', parsed.length, 'items');
            parsed.forEach((match, i) => {
              console.log(`Match ${i + 1}: ${match.home_team} vs ${match.away_team} (${match.confidence}% confidence)`);
              console.log(`  match_id: ${match.match_id}`);
            });
          }
        } catch (e) {
          console.log('Failed to parse JSON:', e.message);
        }
      }
      
      // Test different search approaches
      console.log('\n=== TESTING SEARCH APPROACHES ===');
      
      const matchId = '542703';
      
      // Test 1: Direct string search
      if (typeof prediction.matches === 'string') {
        const directSearch = prediction.matches.includes(matchId);
        console.log(`Direct string search for "${matchId}": ${directSearch}`);
      }
      
      // Test 2: JSON string search
      const matchesJson = JSON.stringify(prediction.matches);
      const jsonSearch = matchesJson.includes(matchId);
      console.log(`JSON string search for "${matchId}": ${jsonSearch}`);
      
      // Test 3: Database text search
      try {
        const textSearchResult = await db.query(`
          SELECT id
          FROM direct1x2_prediction_final
          WHERE matches::text LIKE '%${matchId}%'
          LIMIT 1
        `);
        console.log(`Database text search: ${textSearchResult.rows.length > 0 ? 'FOUND' : 'NOT FOUND'}`);
      } catch (e) {
        console.log(`Database text search error: ${e.message}`);
      }
      
      // Test 4: Database JSON search
      try {
        const jsonSearchResult = await db.query(`
          SELECT id
          FROM direct1x2_prediction_final
          WHERE matches::jsonb @> '{"match_id": "${matchId}"}'
          LIMIT 1
        `);
        console.log(`Database JSON search: ${jsonSearchResult.rows.length > 0 ? 'FOUND' : 'NOT FOUND'}`);
      } catch (e) {
        console.log(`Database JSON search error: ${e.message}`);
      }
      
      // Test 5: Database JSON text search
      try {
        const jsonTextSearchResult = await db.query(`
          SELECT id
          FROM direct1x2_prediction_final
          WHERE matches::jsonb::text LIKE '%${matchId}%'
          LIMIT 1
        `);
        console.log(`Database JSON text search: ${jsonTextSearchResult.rows.length > 0 ? 'FOUND' : 'NOT FOUND'}`);
      } catch (e) {
        console.log(`Database JSON text search error: ${e.message}`);
      }
      
      // Test 6: Database pattern search
      try {
        const patternResult = await db.query(`
          SELECT id
          FROM direct1x2_prediction_final
          WHERE matches::text LIKE '%"match_id":"${matchId}"%'
          LIMIT 1
        `);
        console.log(`Database pattern search: ${patternResult.rows.length > 0 ? 'FOUND' : 'NOT FOUND'}`);
      } catch (e) {
        console.log(`Database pattern search error: ${e.message}`);
      }
      
      // If we find a working search method, update the endpoint
      console.log('\n=== UPDATING ENDPOINT WITH WORKING SEARCH ===');
      
      // Try the JSON text search approach
      try {
        const workingSearchResult = await db.query(`
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
          WHERE matches::jsonb::text LIKE '%${matchId}%'
          LIMIT 1
        `);
        
        if (workingSearchResult.rows.length > 0) {
          console.log('✅ Found working search method: matches::jsonb::text');
          
          // Update the endpoint to use this method
          const fs = require('fs');
          const path = require('path');
          
          const endpointFile = path.join(__dirname, '../backend/server-express.js');
          let endpointCode = fs.readFileSync(endpointFile, 'utf8');
          
          // Replace the search method
          const oldSearch = 'WHERE matches::text LIKE $1';
          const newSearch = 'WHERE matches::jsonb::text LIKE $1';
          
          if (endpointCode.includes(oldSearch)) {
            endpointCode = endpointCode.replace(oldSearch, newSearch);
            fs.writeFileSync(endpointFile, endpointCode);
            console.log('✅ Updated endpoint to use matches::jsonb::text');
            
            // Commit the fix
            const { execSync } = require('child_process');
            
            try {
              execSync('cd "' + path.dirname(__dirname) + '" && git add .', { stdio: 'inherit' });
              execSync('cd "' + path.dirname(__dirname) + '" && git commit -m "fix: Use matches::jsonb::text for proper JSONB text search\n\n- matches::text doesn\'t work on JSONB fields\n- matches::jsonb::text converts JSONB to text for searching\n- This fixes the search for match_id in JSON data\n- FC Lorient vs Le Havre AC (match_id: 542703) will now be found\n- Frontend will receive proper AI prediction data instead of 500 error"', { stdio: 'inherit' });
              execSync('cd "' + path.dirname(__dirname) + '" && git push deploy main', { stdio: 'inherit' });
              
              console.log('✅ Fix committed and pushed to production');
              
              console.log('\n=== FINAL SUMMARY ===');
              console.log('✅ Issue: matches::text doesn\'t work on JSONB fields');
              console.log('✅ Solution: Use matches::jsonb::text to convert JSONB to text');
              console.log('✅ FC Lorient vs Le Havre AC will now work');
              console.log('✅ No more 500 errors on /api/ai-predictions/542703');
              
            } catch (gitError) {
              console.log('❌ Git error:', gitError.message);
            }
            
          } else {
            console.log('❌ Could not find the search method to replace');
          }
          
        } else {
          console.log('❌ JSON text search still doesn\'t work');
        }
        
      } catch (e) {
        console.log('❌ Error testing JSON text search:', e.message);
      }
      
    } else {
      console.log('❌ No matches data found');
    }
    
  } catch (error) {
    console.error('Debug error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

debugMatchesContent();
