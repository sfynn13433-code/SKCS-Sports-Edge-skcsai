const db = require('../backend/db');

async function checkRawPredictionStructure() {
  console.log('=== CHECKING RAW PREDICTION 76412 STRUCTURE ===\n');
  
  try {
    // Get the complete raw prediction
    const result = await db.query(`
      SELECT * FROM predictions_raw
      WHERE id = 76412
    `);
    
    if (result.rows.length === 0) {
      console.log('Prediction 76412 not found');
      return;
    }
    
    const raw = result.rows[0];
    
    console.log('COMPLETE RAW PREDICTION STRUCTURE:');
    console.log('------------------------------------');
    
    Object.keys(raw).forEach(key => {
      const value = raw[key];
      const type = typeof value;
      console.log(`${key}: ${type} = ${JSON.stringify(value)}`);
    });
    
    console.log('\nKEY FIELDS ANALYSIS:');
    console.log('------------------------------------');
    
    // Check the critical fields that are causing the issue
    console.log(`volatility: "${raw.volatility}" (type: ${typeof raw.volatility})`);
    console.log(`confidence: ${raw.confidence} (type: ${typeof raw.confidence})`);
    console.log(`market: "${raw.market}" (type: ${typeof raw.market})`);
    
    // Check if these fields are actually in the database or if they're derived
    console.log('\nDERIVED FIELDS INVESTIGATION:');
    console.log('------------------------------------');
    
    // Check if the metadata has the actual values
    if (raw.metadata) {
      console.log('Metadata contains:');
      Object.keys(raw.metadata).forEach(key => {
        const value = raw.metadata[key];
        console.log(`  ${key}: ${JSON.stringify(value)}`);
      });
    }
    
    // Check if there's a pattern in how other predictions are structured
    console.log('\nCOMPARISON WITH SUCCESSFUL PREDICTIONS:');
    console.log('------------------------------------');
    
    const successfulResult = await db.query(`
      SELECT id, volatility, confidence, market, metadata
      FROM predictions_raw
      WHERE id IN (
        SELECT raw_id 
        FROM predictions_filtered 
        WHERE is_valid = true 
        AND created_at >= NOW() - INTERVAL '24 hours'
        LIMIT 3
      )
    `);
    
    console.log('Successful predictions structure:');
    successfulResult.rows.forEach((pred, i) => {
      console.log(`\n${i + 1}. Prediction ${pred.id}:`);
      console.log(`   volatility: "${pred.volatility}" (${typeof pred.volatility})`);
      console.log(`   confidence: ${pred.confidence} (${typeof pred.confidence})`);
      console.log(`   market: "${pred.market}" (${typeof pred.market})`);
      
      if (pred.metadata) {
        console.log(`   metadata volatility: "${pred.metadata.volatility}" (${typeof pred.metadata.volatility})`);
        console.log(`   metadata confidence: ${pred.metadata.confidence} (${typeof pred.metadata.confidence})`);
        console.log(`   metadata market: "${pred.metadata.market}" (${typeof pred.metadata.market})`);
      }
    });
    
    // Step 6: Find the root cause and fix
    console.log('\nROOT CAUSE ANALYSIS:');
    console.log('------------------------------------');
    
    if (raw.volatility === undefined || raw.volatility === null) {
      console.log('❌ ISSUE: volatility field is NULL/undefined');
      console.log('This causes the filtering to reject the prediction');
      
      // Check if metadata has the volatility
      if (raw.metadata && raw.metadata.volatility) {
        console.log('✅ SOLUTION: volatility exists in metadata');
        console.log('The filtering logic should extract volatility from metadata');
      }
    }
    
    if (raw.confidence === undefined || raw.confidence === null) {
      console.log('❌ ISSUE: confidence field is NULL/undefined');
      
      if (raw.metadata && raw.metadata.confidence) {
        console.log('✅ SOLUTION: confidence exists in metadata');
      }
    }
    
    if (raw.market === undefined || raw.market === null) {
      console.log('❌ ISSUE: market field is NULL/undefined');
      
      if (raw.metadata && raw.metadata.market) {
        console.log('✅ SOLUTION: market exists in metadata');
      }
    }
    
    console.log('\nNEXT STEPS:');
    console.log('------------------------------------');
    console.log('1. Check the filtering logic to see if it extracts values from metadata');
    console.log('2. If not, update the data insertion to populate these fields from metadata');
    console.log('3. Or update the filtering logic to use metadata as fallback');
    
  } catch (error) {
    console.error('Check error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkRawPredictionStructure();
