const db = require('../backend/db');

async function examineTierRules() {
  console.log('=== EXAMINING TIER RULES FOR VOLATILITY ISSUE ===\n');
  
  try {
    // Step 1: Get all tier rules
    console.log('STEP 1: CURRENT TIER RULES');
    console.log('-----------------------------------------');
    
    const tierRulesResult = await db.query(`
      SELECT tier, min_confidence, allowed_markets, max_acca_size, allowed_volatility
      FROM tier_rules
      ORDER BY tier
    `);
    
    console.log('Current tier rules:');
    tierRulesResult.rows.forEach(rule => {
      console.log(`\nTier: ${rule.tier}`);
      console.log(`- Min Confidence: ${rule.min_confidence}`);
      console.log(`- Max ACCA Size: ${rule.max_acca_size}`);
      console.log(`- Allowed Markets: ${JSON.stringify(rule.allowed_markets)}`);
      console.log(`- Allowed Volatility: ${JSON.stringify(rule.allowed_volatility)}`);
    });
    
    // Step 2: Check what volatility levels exist
    console.log('\nSTEP 2: VOLATILITY LEVELS IN USE');
    console.log('-----------------------------------------');
    
    const volatilityResult = await db.query(`
      SELECT volatility, COUNT(*) as count
      FROM predictions_raw
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY volatility
      ORDER BY count DESC
    `);
    
    console.log('Volatility levels in last 24 hours:');
    volatilityResult.rows.forEach(vol => {
      console.log(`- ${vol.volatility}: ${vol.count} predictions`);
    });
    
    // Step 3: Check the specific filtering logic
    console.log('\nSTEP 3: FILTERING LOGIC ANALYSIS');
    console.log('-----------------------------------------');
    
    // Get the rejected prediction details
    const rejectedResult = await db.query(`
      SELECT pr.*, pf.is_valid, pf.reject_reason, pf.tier
      FROM predictions_raw pr
      JOIN predictions_filtered pf ON pr.id = pf.raw_id
      WHERE pr.id = 76412
    `);
    
    if (rejectedResult.rows.length > 0) {
      const rejected = rejectedResult.rows[0];
      console.log('Rejected prediction details:');
      console.log(`- ID: ${rejected.id}`);
      console.log(`- Tier: ${rejected.tier}`);
      console.log(`- Volatility: ${rejected.volatility}`);
      console.log(`- Confidence: ${rejected.confidence}`);
      console.log(`- Market: ${rejected.market}`);
      console.log(`- Reject Reason: ${rejected.reject_reason}`);
      
      // Check what tier rule applies
      const tierRule = tierRulesResult.rows.find(rule => rule.tier === rejected.tier);
      if (tierRule) {
        console.log('\nApplicable tier rule:');
        console.log(`- Allowed Volatility: ${JSON.stringify(tierRule.allowed_volatility)}`);
        console.log(`- Is "${rejected.volatility}" allowed? ${tierRule.allowed_volatility.includes(rejected.volatility)}`);
      }
    }
    
    // Step 4: Check successful predictions to understand the pattern
    console.log('\nSTEP 4: SUCCESSFUL PREDICTIONS ANALYSIS');
    console.log('-----------------------------------------');
    
    const successfulResult = await db.query(`
      SELECT pr.volatility, pr.confidence, pr.market, pf.tier
      FROM predictions_raw pr
      JOIN predictions_filtered pf ON pr.id = pf.raw_id
      WHERE pf.is_valid = true
      AND pr.created_at >= NOW() - INTERVAL '24 hours'
      LIMIT 10
    `);
    
    console.log('Successful predictions (last 24 hours):');
    successfulResult.rows.forEach((pred, i) => {
      console.log(`${i + 1}. Volatility: ${pred.volatility}, Confidence: ${pred.confidence}, Market: ${pred.market}, Tier: ${pred.tier}`);
    });
    
    // Step 5: Find the root cause - why is this prediction being assigned to "deep" tier?
    console.log('\nSTEP 5: TIER ASSIGNMENT INVESTIGATION');
    console.log('-----------------------------------------');
    
    // Check how tier is assigned
    const tierAssignmentResult = await db.query(`
      SELECT tier, COUNT(*) as count
      FROM predictions_filtered
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY tier
      ORDER BY count DESC
    `);
    
    console.log('Tier assignments (last 24 hours):');
    tierAssignmentResult.rows.forEach(tier => {
      console.log(`- ${tier.tier}: ${tier.count} predictions`);
    });
    
    // Step 6: Check if there's a way to fix this specific case
    console.log('\nSTEP 6: SOLUTION INVESTIGATION');
    console.log('-----------------------------------------');
    
    // Check what happens if we change the tier to "normal"
    const normalTierRule = tierRulesResult.rows.find(rule => rule.tier === 'normal');
    if (normalTierRule) {
      console.log('Normal tier rule:');
      console.log(`- Allowed Volatility: ${JSON.stringify(normalTierRule.allowed_volatility)}`);
      console.log(`- Would "high" be allowed? ${normalTierRule.allowed_volatility.includes('high')}`);
      
      // Check if this prediction meets normal tier requirements
      const rejected = rejectedResult.rows[0];
      const meetsNormalTier = 
        rejected.confidence >= normalTierRule.min_confidence &&
        normalTierRule.allowed_volatility.includes(rejected.volatility);
      
      console.log(`\nWould prediction 76412 pass normal tier? ${meetsNormalTier}`);
      if (!meetsNormalTier) {
        console.log('Reasons:');
        if (rejected.confidence < normalTierRule.min_confidence) {
          console.log(`- Confidence ${rejected.confidence} < min ${normalTierRule.min_confidence}`);
        }
        if (!normalTierRule.allowed_volatility.includes(rejected.volatility)) {
          console.log(`- Volatility "${rejected.volatility}" not in allowed list`);
        }
      }
    }
    
  } catch (error) {
    console.error('Examination error:', error.message);
  } finally {
    process.exit(0);
  }
}

examineTierRules();
