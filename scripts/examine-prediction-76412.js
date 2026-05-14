const db = require('../backend/db');

async function examinePrediction76412() {
  console.log('=== EXAMINING PREDICTION ID 76412 ===\n');
  
  try {
    // Get the full prediction data
    const result = await db.query(`
      SELECT * FROM predictions_raw
      WHERE id = 76412
    `);
    
    if (result.rows.length === 0) {
      console.log('Prediction 76412 not found');
      return;
    }
    
    const prediction = result.rows[0];
    console.log('PREDICTION RAW DATA:');
    console.log('-------------------');
    console.log(`ID: ${prediction.id}`);
    console.log(`Sport: ${prediction.sport}`);
    console.log(`Market: ${prediction.market}`);
    console.log(`Prediction: ${prediction.prediction}`);
    console.log(`Confidence: ${prediction.confidence}`);
    console.log(`Volatility: ${prediction.volatility}`);
    console.log(`Odds: ${prediction.odds}`);
    console.log(`Created: ${prediction.created_at}`);
    
    // Check if there's JSON data in any field
    console.log('\nRAW JSON FIELDS:');
    console.log('-------------------');
    Object.keys(prediction).forEach(key => {
      const value = prediction[key];
      if (typeof value === 'object' && value !== null) {
        console.log(`${key}: ${JSON.stringify(value, null, 2)}`);
      }
    });
    
    // Check related data in predictions_filtered
    console.log('\nRELATED FILTERED DATA:');
    console.log('-------------------');
    
    try {
      const filteredResult = await db.query(`
        SELECT * FROM predictions_filtered
        WHERE raw_id = 76412
        LIMIT 1
      `);
      
      if (filteredResult.rows.length > 0) {
        const filtered = filteredResult.rows[0];
        console.log(`Filtered ID: ${filtered.id}`);
        console.log(`Raw ID: ${filtered.raw_id}`);
        console.log(`Tier: ${filtered.tier}`);
        console.log(`Is Valid: ${filtered.is_valid}`);
        console.log(`Reject Reason: ${filtered.reject_reason}`);
      } else {
        console.log('No filtered data found for raw_id 76412');
      }
    } catch (err) {
      console.log(`Filtered data error: ${err.message}`);
    }
    
    // Check if this prediction made it to final table
    console.log('\nFINAL PREDICTION STATUS:');
    console.log('-------------------');
    
    try {
      const finalResult = await db.query(`
        SELECT * FROM direct1x2_prediction_final
        WHERE 
          matches::text ILIKE '%76412%' OR
          id::text = '76412'
        LIMIT 1
      `);
      
      if (finalResult.rows.length > 0) {
        const final = finalResult.rows[0];
        console.log(`Final ID: ${final.id}`);
        console.log(`Publish Run ID: ${final.publish_run_id}`);
        console.log(`Type: ${final.type}`);
        console.log(`Tier: ${final.tier}`);
        console.log(`Total Confidence: ${final.total_confidence}`);
        console.log(`Created: ${final.created_at}`);
        
        if (final.matches) {
          console.log('\nMATCHES ARRAY:');
          console.log(JSON.stringify(final.matches, null, 2));
        }
      } else {
        console.log('No final prediction found for ID 76412');
      }
    } catch (err) {
      console.log(`Final data error: ${err.message}`);
    }
    
  } catch (error) {
    console.error('Examination error:', error.message);
  } finally {
    process.exit(0);
  }
}

examinePrediction76412();
