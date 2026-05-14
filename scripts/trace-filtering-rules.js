const db = require('../backend/db');

async function traceFilteringRules() {
  console.log('=== TRACING FILTERING RULES FOR PREDICTION 76412 ===\n');
  
  try {
    // Step 1: Check the filtering rules and tier configuration
    console.log('STEP 1: TIER RULES ANALYSIS');
    console.log('-----------------------------------------');
    
    // Get the rejected prediction details
    const rejectedResult = await db.query(`
      SELECT * FROM predictions_filtered
      WHERE raw_id = 76412
    `);
    
    if (rejectedResult.rows.length === 0) {
      console.log('No filtered data found for raw_id 76412');
      return;
    }
    
    const rejected = rejectedResult.rows[0];
    console.log('REJECTED PREDICTION:');
    console.log(`- Raw ID: ${rejected.raw_id}`);
    console.log(`- Tier: ${rejected.tier}`);
    console.log(`- Is Valid: ${rejected.is_valid}`);
    console.log(`- Reject Reason: ${rejected.reject_reason}`);
    console.log(`- Created: ${rejected.created_at}`);
    
    // Step 2: Check what tier rules exist
    console.log('\nSTEP 2: TIER RULES INVESTIGATION');
    console.log('-----------------------------------------');
    
    // Look for tier rules configuration
    try {
      const tierRulesResult = await db.query(`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_name LIKE '%tier%' OR table_name LIKE '%rule%'
        ORDER BY table_name, ordinal_position
      `);
      
      console.log('Tier/rule related tables:');
      tierRulesResult.rows.forEach(row => {
        console.log(`- ${row.table_name}.${row.column_name}: ${row.data_type}`);
      });
    } catch (err) {
      console.log(`Tier rules investigation error: ${err.message}`);
    }
    
    // Step 3: Check what predictions actually made it to final
    console.log('\nSTEP 3: FINAL PREDICTIONS ANALYSIS');
    console.log('-----------------------------------------');
    
    try {
      const finalResult = await db.query(`
        SELECT id, type, tier, total_confidence, created_at, matches
        FROM direct1x2_prediction_final
        ORDER BY created_at DESC
        LIMIT 5
      `);
      
      console.log('Recent final predictions:');
      if (finalResult.rows.length === 0) {
        console.log('No final predictions found');
      } else {
        finalResult.rows.forEach((final, i) => {
          console.log(`\n${i + 1}. Final Prediction:`);
          console.log(`   ID: ${final.id}`);
          console.log(`   Type: ${final.type}`);
          console.log(`   Tier: ${final.tier}`);
          console.log(`   Confidence: ${final.total_confidence}%`);
          console.log(`   Created: ${final.created_at}`);
          
          if (final.matches) {
            const matches = Array.isArray(final.matches) ? final.matches : [final.matches];
            matches.forEach((match, j) => {
              console.log(`   Match ${j + 1}:`);
              console.log(`     Home: ${match.home_team || 'N/A'}`);
              console.log(`     Away: ${match.away_team || 'N/A'}`);
              console.log(`     Confidence: ${match.confidence || 'N/A'}%`);
              console.log(`     Market: ${match.market || 'N/A'}`);
              console.log(`     Prediction: ${match.prediction || 'N/A'}`);
            });
          }
        });
      }
    } catch (err) {
      console.log(`Final predictions error: ${err.message}`);
    }
    
    // Step 4: Check the filtering process
    console.log('\nSTEP 4: FILTERING PROCESS ANALYSIS');
    console.log('-----------------------------------------');
    
    // Check how many predictions get filtered vs approved
    try {
      const statsResult = await db.query(`
        SELECT 
          COUNT(*) as total_raw,
          COUNT(CASE WHEN is_valid = true THEN 1 END) as valid_count,
          COUNT(CASE WHEN is_valid = false THEN 1 END) as invalid_count
        FROM predictions_filtered
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `);
      
      const stats = statsResult.rows[0];
      console.log('Last 24 hours filtering stats:');
      console.log(`- Total raw: ${stats.total_raw}`);
      console.log(`- Valid: ${stats.valid_count}`);
      console.log(`- Invalid: ${stats.invalid_count}`);
      console.log(`- Success rate: ${stats.total_raw > 0 ? ((stats.valid_count / stats.total_raw) * 100).toFixed(1) : 0}%`);
    } catch (err) {
      console.log(`Filtering stats error: ${err.message}`);
    }
    
    // Step 5: Check if there's a way to bypass filtering for this specific case
    console.log('\nSTEP 5: BYPASS FILTERING INVESTIGATION');
    console.log('-----------------------------------------');
    
    // Check if we can find the prediction in the frontend data source
    try {
      // The frontend is getting data from somewhere - let's find where
      const allPredictions = await db.query(`
        SELECT id, sport, market, prediction, confidence, metadata
        FROM predictions_raw
        WHERE metadata::text ILIKE '%Lorient%' AND metadata::text ILIKE '%Havre%'
        ORDER BY created_at DESC
        LIMIT 3
      `);
      
      console.log('All Lorient vs Havre predictions in raw data:');
      allPredictions.rows.forEach((pred, i) => {
        console.log(`\n${i + 1}. Raw Prediction ${pred.id}:`);
        console.log(`   Sport: ${pred.sport}`);
        console.log(`   Market: ${pred.market}`);
        console.log(`   Prediction: ${pred.prediction}`);
        console.log(`   Confidence: ${pred.confidence}%`);
        
        if (pred.metadata) {
          const meta = pred.metadata;
          console.log(`   Teams: ${meta.home_team} vs ${meta.away_team}`);
          console.log(`   League: ${meta.league}`);
          console.log(`   Match Time: ${meta.match_time}`);
          console.log(`   AI Source: ${meta.ai_source}`);
        }
      });
    } catch (err) {
      console.log(`Bypass investigation error: ${err.message}`);
    }
    
  } catch (error) {
    console.error('Tracing error:', error.message);
  } finally {
    process.exit(0);
  }
}

traceFilteringRules();
