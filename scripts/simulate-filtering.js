const db = require('../backend/db');

async function simulateFiltering() {
  console.log('=== SIMULATING EXACT FILTERING PROCESS ===\n');
  
  try {
    // Step 1: Get the raw prediction exactly as the filterEngine does
    console.log('STEP 1: GET RAW PREDICTION');
    console.log('------------------------------------');
    
    const rawId = 76412;
    const rawRes = await db.query('select * from predictions_raw where id = $1 limit 1;', [rawId]);
    
    if (!rawRes.rows.length) {
      console.log('Raw prediction not found');
      return;
    }
    
    const raw = rawRes.rows[0];
    console.log('Raw prediction retrieved:');
    console.log(`- ID: ${raw.id}`);
    console.log(`- volatility: "${raw.volatility}" (${typeof raw.volatility})`);
    console.log(`- confidence: ${raw.confidence} (${typeof raw.confidence})`);
    console.log(`- market: "${raw.market}" (${typeof raw.market})`);
    
    // Step 2: Get tier rules exactly as the filterEngine does
    console.log('\nSTEP 2: GET TIER RULES');
    console.log('------------------------------------');
    
    const tierRulesResult = await db.query(`
      SELECT tier, min_confidence, allowed_markets, max_acca_size, allowed_volatility
      FROM tier_rules
      WHERE tier = 'deep'
      LIMIT 1
    `);
    
    if (!tierRulesResult.rows.length) {
      console.log('Tier rules not found');
      return;
    }
    
    const tierRule = tierRulesResult.rows[0];
    console.log('Tier rules retrieved:');
    console.log(`- Tier: ${tierRule.tier}`);
    console.log(`- Min Confidence: ${tierRule.min_confidence}`);
    console.log(`- Allowed Volatility: ${JSON.stringify(tierRule.allowed_volatility)}`);
    console.log(`- Allowed Markets: ${JSON.stringify(tierRule.allowed_markets)}`);
    
    // Step 3: Apply the exact filtering logic
    console.log('\nSTEP 3: APPLY FILTERING LOGIC');
    console.log('------------------------------------');
    
    // Check confidence
    console.log(`Checking confidence: ${raw.confidence} (type: ${typeof raw.confidence})`);
    const confidenceCheck = typeof raw.confidence === 'number' && !Number.isNaN(raw.confidence);
    console.log(`Confidence is valid number: ${confidenceCheck}`);
    
    // Check market
    console.log(`Checking market: "${raw.market}" (type: ${typeof raw.market})`);
    const marketAllowed = tierRule.allowed_markets.includes('ALL') || tierRule.allowed_markets.includes(raw.market);
    console.log(`Market allowed: ${marketAllowed}`);
    
    // Check volatility
    console.log(`Checking volatility: "${raw.volatility}" (type: ${typeof raw.volatility})`);
    const volatilityAllowed = tierRule.allowed_volatility.includes(raw.volatility);
    console.log(`Volatility allowed: ${volatilityAllowed}`);
    
    // Overall result
    const overallResult = confidenceCheck && marketAllowed && volatilityAllowed;
    console.log(`\nOverall filtering result: ${overallResult ? 'ALLOWED' : 'REJECTED'}`);
    
    // Step 4: Compare with actual filtered result
    console.log('\nSTEP 4: COMPARE WITH ACTUAL RESULT');
    console.log('------------------------------------');
    
    const filteredResult = await db.query(`
      SELECT is_valid, reject_reason
      FROM predictions_filtered
      WHERE raw_id = $1 AND tier = 'deep'
    `, [rawId]);
    
    if (filteredResult.rows.length > 0) {
      const filtered = filteredResult.rows[0];
      console.log(`Actual filtered result: ${filtered.is_valid ? 'ALLOWED' : 'REJECTED'}`);
      console.log(`Actual reject reason: ${filtered.reject_reason}`);
      
      if (overallResult !== filtered.is_valid) {
        console.log('\n❌ DISCREPANCY DETECTED!');
        console.log('The simulation does not match the actual filtered result.');
        
        // Let's debug further by checking the exact values
        console.log('\nDEBUGGING EXACT VALUES:');
        console.log(`raw.volatility === "high": ${raw.volatility === "high"}`);
        console.log(`raw.volatility == "high": ${raw.volatility == "high"}`);
        console.log(`String(raw.volatility): "${String(raw.volatility)}"`);
        console.log(`tierRule.allowed_volatility.includes(raw.volatility): ${tierRule.allowed_volatility.includes(raw.volatility)}`);
        
        // Check if there are any hidden characters or encoding issues
        console.log(`raw.volatility length: ${raw.volatility ? raw.volatility.length : 'null'}`);
        console.log(`raw.volatility char codes: ${raw.volatility ? raw.volatility.split('').map(c => c.charCodeAt(0)).join(',') : 'null'}`);
        
        // Check the allowed volatility array
        console.log(`allowed_volatility[0]: "${tierRule.allowed_volatility[0]}"`);
        console.log(`allowed_volatility[1]: "${tierRule.allowed_volatility[1]}"`);
        console.log(`allowed_volatility[2]: "${tierRule.allowed_volatility[2]}"`);
        
        // Check each comparison
        tierRule.allowed_volatility.forEach((allowed, i) => {
          console.log(`allowed_volatility[${i}] === raw.volatility: ${allowed === raw.volatility}`);
          console.log(`allowed_volatility[${i}] == raw.volatility: ${allowed == raw.volatility}`);
          console.log(`allowed_volatility[${i}] length: ${allowed.length}`);
          console.log(`allowed_volatility[${i}] char codes: ${allowed.split('').map(c => c.charCodeAt(0)).join(',')}`);
        });
      } else {
        console.log('\n✅ Simulation matches actual result');
      }
    } else {
      console.log('No filtered result found');
    }
    
    // Step 5: Check if there's a timing issue or race condition
    console.log('\nSTEP 5: TIMING ANALYSIS');
    console.log('------------------------------------');
    
    console.log('Checking if there are multiple filtering records...');
    const multipleFilterResult = await db.query(`
      SELECT tier, is_valid, reject_reason, created_at
      FROM predictions_filtered
      WHERE raw_id = $1
      ORDER BY created_at
    `, [rawId]);
    
    console.log('All filtering records:');
    multipleFilterResult.rows.forEach((record, i) => {
      console.log(`${i + 1}. Tier: ${record.tier}, Valid: ${record.is_valid}, Reason: ${record.reject_reason}, Created: ${record.created_at}`);
    });
    
  } catch (error) {
    console.error('Simulation error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

simulateFiltering();
