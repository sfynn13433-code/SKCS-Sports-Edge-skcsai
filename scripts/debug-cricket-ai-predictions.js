const db = require('../backend/db');

async function debugCricketAIPredictions() {
  console.log('=== DEBUGGING CRICKET AI PREDICTIONS ISSUE ===\n');
  
  try {
    const cricketMatchId = '3f683268-d9da-4faa-a4f7-3fb81b5679e4';
    console.log(`Investigating cricket match ID: ${cricketMatchId}`);
    
    // STEP 1: Check if this match exists in any prediction table
    console.log('\nSTEP 1: CHECKING MATCH EXISTENCE IN ALL TABLES');
    console.log('------------------------------------');
    
    const tables = [
      'predictions_unified',
      'direct1x2_prediction_final',
      'predictions_raw_backup_phase3',
      'predictions_filtered_backup_phase3',
      'ai_predictions_backup_phase3'
    ];
    
    for (const tableName of tables) {
      try {
        const result = await db.query(`
          SELECT COUNT(*) as count, 
                  CASE WHEN COUNT(*) > 0 THEN 'FOUND' ELSE 'NOT FOUND' END as status
          FROM ${tableName} 
          WHERE matches::jsonb::text LIKE '%${cricketMatchId}%'
          OR id::text = '${cricketMatchId}'
          OR match_id = '${cricketMatchId}'
        `);
        
        console.log(`${tableName}: ${result.rows[0].status} (${result.rows[0].count} records)`);
        
        if (result.rows[0].count > 0) {
          // Get the actual record
          const recordResult = await db.query(`
            SELECT * FROM ${tableName} 
            WHERE matches::jsonb::text LIKE '%${cricketMatchId}%'
            OR id::text = '${cricketMatchId}'
            OR match_id = '${cricketMatchId}'
            LIMIT 1
          `);
          
          const record = recordResult.rows[0];
          console.log(`  Found record with ID: ${record.id}`);
          console.log(`  Match ID in record: ${record.match_id || 'N/A'}`);
          console.log(`  Home team: ${record.home_team || 'N/A'}`);
          console.log(`  Away team: ${record.away_team || 'N/A'}`);
          console.log(`  Prediction: ${record.prediction || 'N/A'}`);
          
          // Check the matches JSON structure
          if (record.matches) {
            console.log(`  Matches type: ${typeof record.matches}`);
            if (typeof record.matches === 'string') {
              try {
                const parsed = JSON.parse(record.matches);
                console.log(`  Parsed matches: ${parsed.length} items`);
                const matchInArray = parsed.find(m => m.match_id === cricketMatchId);
                if (matchInArray) {
                  console.log(`  ✅ Found match in array: ${matchInArray.home_team} vs ${matchInArray.away_team}`);
                }
              } catch (e) {
                console.log(`  Failed to parse matches JSON: ${e.message}`);
              }
            } else if (Array.isArray(record.matches)) {
              console.log(`  Matches is array with ${record.matches.length} items`);
              const matchInArray = record.matches.find(m => m.match_id === cricketMatchId);
              if (matchInArray) {
                console.log(`  ✅ Found match in array: ${matchInArray.home_team} vs ${matchInArray.away_team}`);
              }
            }
          }
        }
        
      } catch (error) {
        console.log(`❌ Error checking ${tableName}: ${error.message}`);
      }
    }
    
    // STEP 2: Test the AI predictions endpoint search patterns
    console.log('\nSTEP 2: TESTING AI PREDICTIONS ENDPOINT SEARCH PATTERNS');
    console.log('------------------------------------');
    
    const searchPatterns = [
      `SELECT * FROM direct1x2_prediction_final WHERE matches::jsonb::text LIKE '%${cricketMatchId}%'`,
      `SELECT * FROM direct1x2_prediction_final WHERE id::text = '${cricketMatchId}'`,
      `SELECT * FROM direct1x2_prediction_final WHERE match_id = '${cricketMatchId}'`,
      `SELECT * FROM predictions_unified WHERE matches::jsonb::text LIKE '%${cricketMatchId}%'`,
      `SELECT * FROM predictions_unified WHERE match_id = '${cricketMatchId}'`
    ];
    
    for (let i = 0; i < searchPatterns.length; i++) {
      try {
        const result = await db.query(searchPatterns[i]);
        console.log(`Pattern ${i + 1}: ${result.rows.length} records found`);
        
        if (result.rows.length > 0) {
          const record = result.rows[0];
          console.log(`  ✅ Found with pattern ${i + 1}: ${record.home_team || 'N/A'} vs ${record.away_team || 'N/A'}`);
        }
      } catch (error) {
        console.log(`Pattern ${i + 1}: Error - ${error.message}`);
      }
    }
    
    // STEP 3: Check the actual AI predictions endpoint logic
    console.log('\nSTEP 3: CHECKING AI PREDICTIONS ENDPOINT LOGIC');
    console.log('------------------------------------');
    
    // Simulate the endpoint logic
    let result;
    let lastError = null;
    
    console.log('Testing endpoint search sequence...');
    
    // Try the first search (matches::jsonb::text)
    try {
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
        WHERE matches::jsonb::text LIKE $1
        LIMIT 1
      `, [`%${cricketMatchId}%`]);
      
      console.log(`First search (matches::jsonb::text): ${result.rows.length} results`);
      
      if (result.rows.length === 0) {
        // Try fallback search
        try {
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
            FROM predictions_unified
            WHERE match_id = $1
            LIMIT 1
          `, [cricketMatchId]);
          
          console.log(`Fallback search (predictions_unified): ${result.rows.length} results`);
        } catch (fallbackError) {
          console.log(`Fallback search error: ${fallbackError.message}`);
          lastError = fallbackError;
        }
      }
      
      if (result.rows.length > 0) {
        console.log('✅ Endpoint would find the prediction');
        const data = result.rows[0];
        console.log(`  Match ID: ${data.match_id}`);
        console.log(`  Home Team: ${data.home_team}`);
        console.log(`  Away Team: ${data.away_team}`);
        console.log(`  Prediction: ${data.prediction}`);
        console.log(`  Confidence: ${data.confidence_score || data.confidence}`);
      } else {
        console.log('❌ Endpoint would return 404 - prediction not found');
      }
      
    } catch (error) {
      console.log(`❌ Endpoint search failed: ${error.message}`);
      lastError = error;
    }
    
    // STEP 4: Check if there's a different match ID format issue
    console.log('\nSTEP 4: CHECKING MATCH ID FORMAT ISSUES');
    console.log('------------------------------------');
    
    // Look for similar match IDs
    try {
      const similarIdsResult = await db.query(`
        SELECT DISTINCT 
          CASE 
            WHEN matches::jsonb::text LIKE '%3f68%' THEN SUBSTRING(matches::jsonb::text, POSITION('3f68' IN matches::jsonb::text), 36)
            ELSE 'N/A'
          END as extracted_id
        FROM direct1x2_prediction_final 
        WHERE matches::jsonb::text LIKE '%3f68%'
        LIMIT 5
      `);
      
      console.log('Similar match IDs found:');
      similarIdsResult.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.extracted_id}`);
      });
      
    } catch (error) {
      console.log(`Error checking similar IDs: ${error.message}`);
    }
    
    // STEP 5: Create fix recommendation
    console.log('\nSTEP 5: FIX RECOMMENDATION');
    console.log('------------------------------------');
    
    if (lastError) {
      console.log('❌ ISSUE IDENTIFIED:');
      console.log(`   Error: ${lastError.message}`);
      console.log('   The AI predictions endpoint is failing due to SQL query issues');
      
      console.log('\n🔧 RECOMMENDED FIX:');
      console.log('1. Update the AI predictions endpoint to handle cricket match IDs');
      console.log('2. Add better error handling for missing predictions');
      console.log('3. Implement fallback search strategies');
      console.log('4. Add logging for debugging match ID searches');
      
      // Create the fix
      const fs = require('fs');
      const path = require('path');
      
      const endpointFix = `
// Enhanced AI predictions endpoint for cricket match support
router.get('/api/ai-predictions/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    console.log(\`[AI-PREDICTIONS] Request for match ID: \${matchId}\`);
    
    let result;
    let lastError = null;
    
    // Enhanced search patterns for cricket match IDs
    const searchPatterns = [
      {
        query: \`
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
          WHERE matches::jsonb::text LIKE $1
          LIMIT 1
        \`,
        params: [\`%\${matchId}%\`]
      },
      {
        query: \`
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
          WHERE id::text = $1
          LIMIT 1
        \`,
        params: [matchId]
      },
      {
        query: \`
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
          FROM predictions_unified
          WHERE match_id = $1
          LIMIT 1
        \`,
        params: [matchId]
      }
    ];
    
    // Try each search pattern
    for (const pattern of searchPatterns) {
      try {
        result = await db.query(pattern.query, pattern.params);
        if (result.rows.length > 0) {
          console.log(\`[AI-PREDICTIONS] Found prediction with pattern: \${pattern.query.substring(0, 50)}...\`);
          break;
        }
      } catch (searchError) {
        console.log(\`[AI-PREDICTIONS] Search pattern failed: \${searchError.message}\`);
        lastError = searchError;
      }
    }
    
    if (result && result.rows.length > 0) {
      const data = result.rows[0];
      
      // Build the response
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
      
      console.log(\`[AI-PREDICTIONS] Returning prediction: \${responseData.home_team} vs \${responseData.away_team}\`);
      res.json(responseData);
    } else {
      console.log(\`[AI-PREDICTIONS] No prediction found for match ID: \${matchId}\`);
      res.status(404).json({ 
        error: 'Prediction not found',
        matchId: matchId,
        message: 'No AI prediction available for this match'
      });
    }
    
  } catch (error) {
    console.error('[AI-PREDICTIONS] Endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});
`;
      
      console.log('\n📄 Enhanced endpoint code generated');
      
    } else {
      console.log('✅ No obvious SQL errors detected');
      console.log('The issue might be in the frontend-backend communication');
    }
    
  } catch (error) {
    console.error('Debug failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

debugCricketAIPredictions();
