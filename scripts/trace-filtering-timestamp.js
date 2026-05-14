const db = require('../backend/db');

async function traceFilteringTimestamp() {
  console.log('=== TRACING FILTERING TIMELINE FOR PREDICTION 76412 ===\n');
  
  try {
    // Step 1: Get the exact filtering record with timestamps
    console.log('STEP 1: FILTERING RECORD TIMESTAMPS');
    console.log('-----------------------------------------');
    
    const filteredResult = await db.query(`
      SELECT * FROM predictions_filtered
      WHERE raw_id = 76412
    `);
    
    if (filteredResult.rows.length === 0) {
      console.log('No filtered record found for raw_id 76412');
      return;
    }
    
    const filtered = filteredResult.rows[0];
    console.log('Filtered record:');
    console.log(`- Raw ID: ${filtered.raw_id}`);
    console.log(`- Tier: ${filtered.tier}`);
    console.log(`- Is Valid: ${filtered.is_valid}`);
    console.log(`- Reject Reason: ${filtered.reject_reason}`);
    console.log(`- Created: ${filtered.created_at}`);
    console.log(`- Updated: ${filtered.updated_at}`);
    
    // Step 2: Check the raw prediction creation time
    console.log('\nSTEP 2: RAW PREDICTION TIMESTAMPS');
    console.log('-----------------------------------------');
    
    const rawResult = await db.query(`
      SELECT id, created_at, metadata
      FROM predictions_raw
      WHERE id = 76412
    `);
    
    if (rawResult.rows.length > 0) {
      const raw = rawResult.rows[0];
      console.log('Raw prediction:');
      console.log(`- ID: ${raw.id}`);
      console.log(`- Created: ${raw.created_at}`);
            
      if (raw.metadata) {
        const meta = raw.metadata;
        console.log(`- Teams: ${meta.home_team} vs ${meta.away_team}`);
        console.log(`- League: ${meta.league}`);
        console.log(`- AI Source: ${meta.ai_source}`);
      }
    }
    
    // Step 3: Check what tier rules were in effect at that time
    console.log('\nSTEP 3: TIER RULES HISTORY');
    console.log('-----------------------------------------');
    
    // Look for any recent changes to tier rules
    const tierRulesHistory = await db.query(`
      SELECT * FROM tier_rules
      ORDER BY tier
    `);
    
    console.log('Current tier rules:');
    tierRulesHistory.rows.forEach((rule, i) => {
      console.log(`${i + 1}. Tier: ${rule.tier}`);
      console.log(`   Allowed Volatility: ${JSON.stringify(rule.allowed_volatility)}`);
    });
    
    // Step 4: Check if there are any other filtering logs
    console.log('\nSTEP 4: FILTERING LOGS');
    console.log('-----------------------------------------');
    
    // Check for any logs around the filtering time
    const logsResult = await db.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_name LIKE '%log%' OR table_name LIKE '%audit%'
      ORDER BY table_name
    `);
    
    if (logsResult.rows.length > 0) {
      console.log('Log tables found:');
      logsResult.rows.forEach(log => {
        console.log(`- ${log.table_name}.${log.column_name}: ${log.data_type}`);
      });
    } else {
      console.log('No log tables found');
    }
    
    // Step 5: Check if the filtering logic might be cached
    console.log('\nSTEP 5: CACHING INVESTIGATION');
    console.log('-----------------------------------------');
    
    // Check if there's any caching in the filtering process
    const timeDiff = new Date(filtered.created_at).getTime() - new Date(rawResult.rows[0].created_at).getTime();
    console.log(`Time between raw creation and filtering: ${timeDiff}ms`);
    
    if (timeDiff < 1000) {
      console.log('Filtering happened immediately (likely no caching issue)');
    } else {
      console.log('Filtering was delayed (possible caching or batch processing)');
    }
    
    // Step 6: Check the exact filtering logic that was applied
    console.log('\nSTEP 6: EXACT FILTERING LOGIC');
    console.log('-----------------------------------------');
    
    // Manually apply the same logic the filterEngine would use
    const raw = rawResult.rows[0];
    const tierRule = tierRulesHistory.rows.find(r => r.tier === filtered.tier);
    
    if (tierRule) {
      console.log('Manual filtering test:');
      console.log(`- Raw volatility: "${raw.volatility}"`);
      console.log(`- Tier: "${filtered.tier}"`);
      console.log(`- Allowed volatility: ${JSON.stringify(tierRule.allowed_volatility)}`);
      console.log(`- Is volatility allowed: ${tierRule.allowed_volatility.includes(raw.volatility)}`);
      
      // Check other filtering criteria
      console.log(`- Raw confidence: ${raw.confidence}`);
      console.log(`- Min confidence: ${tierRule.min_confidence}`);
      console.log(`- Confidence check: ${raw.confidence >= tierRule.min_confidence}`);
      
      console.log(`- Raw market: "${raw.market}"`);
      console.log(`- Allowed markets: ${JSON.stringify(tierRule.allowed_markets)}`);
      console.log(`- Market check: ${tierRule.allowed_markets.includes('ALL') || tierRule.allowed_markets.includes(raw.market)}`);
      
      // Overall result
      const volatilityAllowed = tierRule.allowed_volatility.includes(raw.volatility);
      const confidenceAllowed = raw.confidence >= tierRule.min_confidence;
      const marketAllowed = tierRule.allowed_markets.includes('ALL') || tierRule.allowed_markets.includes(raw.market);
      
      console.log(`\nOverall manual result: ${volatilityAllowed && confidenceAllowed && marketAllowed ? 'ALLOWED' : 'REJECTED'}`);
      console.log(`Actual filtered result: ${filtered.is_valid ? 'ALLOWED' : 'REJECTED'}`);
      
      if ((volatilityAllowed && confidenceAllowed && marketAllowed) !== filtered.is_valid) {
        console.log('\n❌ DISCREPANCY DETECTED!');
        console.log('The manual filtering logic does not match the actual filtered result.');
        
        // This suggests there might be additional filtering logic or a bug
        console.log('\nPossible causes:');
        console.log('1. Additional filtering logic not visible in tier rules');
        console.log('2. Cached tier rules from before the update');
        console.log('3. Bug in the filtering engine');
        console.log('4. Different filtering logic applied at different times');
      } else {
        console.log('\n✅ Manual filtering matches actual result');
      }
    }
    
  } catch (error) {
    console.error('Tracing error:', error.message);
  } finally {
    process.exit(0);
  }
}

traceFilteringTimestamp();
