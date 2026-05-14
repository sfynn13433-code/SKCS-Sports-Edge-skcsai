const db = require('../backend/db');

async function testAIPredictionsEndpoint() {
  console.log('=== TESTING AI PREDICTIONS ENDPOINT WITH CRICKET MATCH ID ===\n');
  
  try {
    const cricketMatchId = '3f683268-d9da-4faa-a4f7-3fb81b5679e4';
    console.log(`Testing match ID: ${cricketMatchId}`);
    
    // Simulate the exact endpoint logic
    let result;
    let lastError = null;
    
    console.log('\n1. Testing ai_predictions table search...');
    try {
        result = await db.query(`
            SELECT id as match_id,
                   confidence_score,
                   edgemind_feedback,
                   value_combos,
                   same_match_builder,
                   updated_at,
                   matches,
                   sport,
                   market_type
            FROM ai_predictions
            WHERE match_id = $1
        `, [cricketMatchId]);
        console.log(`ai_predictions query result: ${result?.rows?.length || 0} rows`);
    } catch (err) {
        console.error('ai_predictions query failed:', err.message);
        lastError = err;
    }

    // If not found in ai_predictions, try direct1x2_prediction_final (legacy predictions)
    if (!result || result.rows.length === 0) {
        console.log('\n2. Testing direct1x2_prediction_final (id::text) search...');
        try {
            result = await db.query(`
                SELECT id as match_id,
                       total_confidence as confidence_score,
                       edgemind_report as edgemind_feedback,
                       secondary_insights as value_combos,
                       secondary_markets as same_match_builder,
                       created_at,
                       matches,
                       sport,
                       market_type,
                       updated_at
                FROM direct1x2_prediction_final
                WHERE id::text = $1
            `, [cricketMatchId]);
            console.log(`direct1x2_prediction_final (id::text) query result: ${result?.rows?.length || 0} rows`);
        } catch (err) {
            console.error('direct1x2_prediction_final (id::text) query failed:', err.message);
            lastError = err;
        }
    }

    // If still not found, try searching in matches array for the match_id (multiple formats)
    if (!result || result.rows.length === 0) {
        console.log('\n3. Testing direct1x2_prediction_final (matches LIKE) search...');
        try {
            const searchPatterns = [
                `%"match_id":"${cricketMatchId}"%`,
                `%"id_event":"${cricketMatchId}"%`,
                `%"fixture_id":"${cricketMatchId}"%`,
                `%"id":"${cricketMatchId}%`
            ];

            for (const pattern of searchPatterns) {
                result = await db.query(`
                    SELECT id as match_id,
                           total_confidence as confidence_score,
                           edgemind_report as edgemind_feedback,
                           secondary_insights as value_combos,
                           secondary_markets as same_match_builder,
                           updated_at,
                           matches,
                           sport,
                           market_type
                    FROM direct1x2_prediction_final
                    WHERE matches::jsonb::text LIKE $1
                    LIMIT 1
                `, [pattern]);
                if (result && result.rows.length > 0) {
                    console.log(`direct1x2_prediction_final (matches LIKE) found with pattern: ${pattern}`);
                    break;
                }
            }
            console.log(`direct1x2_prediction_final (matches LIKE) query result: ${result?.rows?.length || 0} rows`);
        } catch (err) {
            console.error('direct1x2_prediction_final (matches LIKE) query failed:', err.message);
            lastError = err;
        }
    }

    if (!result || result.rows.length === 0) {
        console.log('\n✅ No prediction found - should return 404');
        console.log('Expected response: { data: null, message: "AI prediction not yet available", status: "pending" }');
        return { status: '404_expected', lastError };
    }

    // If we found something, test the response building
    console.log('\n4. Testing response data building...');
    const predictionData = result.rows[0];
    console.log('Found prediction data:', {
        match_id: predictionData.match_id,
        confidence_score: predictionData.confidence_score,
        has_matches: !!predictionData.matches,
        sport: predictionData.sport
    });

    const responseData = {
        match_id: predictionData.match_id || predictionData.id,
        confidence_score: predictionData.confidence_score || predictionData.total_confidence,
        edgemind_feedback: predictionData.edgemind_feedback,
        value_combos: predictionData.value_combos,
        same_match_builder: predictionData.same_match_builder,
        updated_at: predictionData.updated_at,
        matches: predictionData.matches,
        sport: predictionData.sport,
        market_type: predictionData.market_type
    };

    console.log('✅ Response data built successfully');
    console.log('Expected response: { data: responseData, status: "ready" }');
    return { status: '200_expected', data: responseData };

  } catch (err) {
    console.error('❌ Test failed with error:', err.message);
    console.error('Stack:', err.stack);
    return { status: '500_error', error: err.message };
  }
}

// Run the test
testAIPredictionsEndpoint().then(result => {
  console.log('\n=== TEST RESULT ===');
  console.log(`Status: ${result.status}`);
  if (result.error) {
    console.log(`Error: ${result.error}`);
  }
  if (result.data) {
    console.log(`Data keys: ${Object.keys(result.data).join(', ')}`);
  }
  process.exit(0);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
