const db = require('../backend/db');

async function publishPrediction76412() {
  console.log('=== PUBLISHING PREDICTION 76412 ===\n');
  
  try {
    // Get the prediction data
    const predictionResult = await db.query(`
      SELECT pr.*, pf.tier
      FROM predictions_raw pr
      JOIN predictions_filtered pf ON pr.id = pf.raw_id
      WHERE pr.id = 76412 AND pf.is_valid = true
    `);
    
    if (predictionResult.rows.length === 0) {
      console.log('❌ Prediction 76412 not found or not valid');
      return;
    }
    
    const prediction = predictionResult.rows[0];
    console.log('✅ Found prediction 76412 to publish');
    console.log(`- Teams: ${prediction.metadata?.home_team} vs ${prediction.metadata?.away_team}`);
    console.log(`- Confidence: ${prediction.confidence}`);
    console.log(`- Tier: ${prediction.tier}`);
    
    // Create a complete publication entry with all required fields
    const insertResult = await db.query(`
      INSERT INTO direct1x2_prediction_final (
        id, 
        tier, 
        type, 
        matches, 
        total_confidence, 
        risk_level, 
        created_at, 
        plan_visibility, 
        sport, 
        market_type, 
        secondary_insights,
        home_team,
        away_team,
        prediction,
        confidence,
        match_date
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) ON CONFLICT (id) DO UPDATE SET
        total_confidence = EXCLUDED.total_confidence,
        matches = EXCLUDED.matches,
        created_at = EXCLUDED.created_at,
        tier = EXCLUDED.tier,
        type = EXCLUDED.type,
        risk_level = EXCLUDED.risk_level
      RETURNING id, created_at, total_confidence
    `, [
      prediction.id,                                    // id
      prediction.tier || 'normal',                      // tier
      'direct',                                         // type
      JSON.stringify([{                                 // matches
        match_id: prediction.match_id,
        metadata: prediction.metadata,
        away_team: prediction.metadata?.away_team || 'Away Team',
        home_team: prediction.metadata?.home_team || 'Home Team',
        confidence: prediction.confidence,
        prediction: prediction.prediction,
        market: prediction.market
      }]),
      prediction.confidence,                           // total_confidence
      'medium',                                         // risk_level
      new Date().toISOString(),                         // created_at
      JSON.stringify({                                  // plan_visibility
        core: true,
        elite: true,
        vip: true
      }),
      prediction.sport,                                 // sport
      prediction.market,                                // market_type
      JSON.stringify([]),                               // secondary_insights
      prediction.metadata?.home_team || 'Home Team',    // home_team
      prediction.metadata?.away_team || 'Away Team',    // away_team
      prediction.prediction,                            // prediction
      prediction.confidence,                            // confidence
      prediction.metadata?.match_time || new Date().toISOString() // match_date
    ]);
    
    console.log('✅ Prediction 76412 published successfully!');
    console.log(`- Final ID: ${insertResult.rows[0].id}`);
    console.log(`- Created: ${insertResult.rows[0].created_at}`);
    console.log(`- Total Confidence: ${insertResult.rows[0].total_confidence}`);
    
    // Verify it's there
    const verifyResult = await db.query(`
      SELECT id, total_confidence, matches, created_at, home_team, away_team, prediction, confidence
      FROM direct1x2_prediction_final
      WHERE id = $1
    `, [prediction.id]);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Verification successful - prediction is in final table');
      const final = verifyResult.rows[0];
      console.log(`- Home Team: ${final.home_team}`);
      console.log(`- Away Team: ${final.away_team}`);
      console.log(`- Prediction: ${final.prediction}`);
      console.log(`- Confidence: ${final.confidence}%`);
      
      if (final.matches) {
        const matches = JSON.parse(final.matches);
        console.log(`- Matches Array: ${matches.length} match(es)`);
        matches.forEach((match, i) => {
          console.log(`  ${i + 1}. ${match.home_team} vs ${match.away_team} (${match.confidence}% confidence, ${match.prediction})`);
        });
      }
    } else {
      console.log('❌ Verification failed - prediction not found in final table');
    }
    
    // Check total predictions now available
    const totalResult = await db.query(`
      SELECT COUNT(*) as count
      FROM direct1x2_prediction_final
      WHERE sport = 'football'
    `);
    
    console.log(`\nTotal football predictions now available: ${totalResult.rows[0].count}`);
    
    // Test the frontend data source
    console.log('\n=== FRONTEND DATA FLOW TEST ===');
    
    // Simulate what the frontend VIP endpoint would return
    const vipResult = await db.query(`
      SELECT id, home_team, away_team, prediction, confidence, total_confidence, created_at
      FROM direct1x2_prediction_final
      WHERE sport = 'football'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('Frontend would receive these predictions:');
    vipResult.rows.forEach((pred, i) => {
      console.log(`${i + 1}. ID: ${pred.id} - ${pred.home_team} vs ${pred.away_team} (${pred.confidence}% confidence)`);
    });
    
    if (vipResult.rows.some(pred => pred.id == 76412)) {
      console.log('🎯 FC Lorient vs Le Havre AC is now available to frontend!');
    } else {
      console.log('❌ FC Lorient vs Le Havre AC not found in frontend results');
    }
    
  } catch (error) {
    console.error('Publication error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

publishPrediction76412();
