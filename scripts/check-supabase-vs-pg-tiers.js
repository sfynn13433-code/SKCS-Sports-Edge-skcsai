const { createClient } = require('@supabase/supabase-js');
const db = require('../backend/db');

async function checkSupabaseVsPgTiers() {
  console.log('=== CHECKING SUPABASE VS POSTGRESQL TIER RULES ===\n');
  
  try {
    // Step 1: Check PostgreSQL tier rules
    console.log('STEP 1: POSTGRESQL TIER RULES');
    console.log('-----------------------------------------');
    
    const pgResult = await db.query(`
      SELECT tier, min_confidence, allowed_markets, max_acca_size, allowed_volatility
      FROM tier_rules
      ORDER BY tier
    `);
    
    console.log('PostgreSQL tier rules:');
    pgResult.rows.forEach(rule => {
      console.log(`\nTier: ${rule.tier}`);
      console.log(`- Min Confidence: ${rule.min_confidence}`);
      console.log(`- Allowed Volatility: ${JSON.stringify(rule.allowed_volatility)}`);
      console.log(`- Allowed Markets: ${JSON.stringify(rule.allowed_markets)}`);
    });
    
    // Step 2: Check Supabase tier rules
    console.log('\nSTEP 2: SUPABASE TIER RULES');
    console.log('-----------------------------------------');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('Supabase credentials not found');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    
    const { data: supabaseRules, error: supabaseError } = await supabase
      .from('tier_rules')
      .select('*')
      .order('tier');
    
    if (supabaseError) {
      console.log('Supabase error:', supabaseError.message);
      return;
    }
    
    console.log('Supabase tier rules:');
    supabaseRules.forEach(rule => {
      console.log(`\nTier: ${rule.tier}`);
      console.log(`- Min Confidence: ${rule.min_confidence}`);
      console.log(`- Allowed Volatility: ${JSON.stringify(rule.allowed_volatility)}`);
      console.log(`- Allowed Markets: ${JSON.stringify(rule.allowed_markets)}`);
    });
    
    // Step 3: Compare the two
    console.log('\nSTEP 3: COMPARISON');
    console.log('-----------------------------------------');
    
    const pgDeep = pgResult.rows.find(r => r.tier === 'deep');
    const supabaseDeep = supabaseRules.find(r => r.tier === 'deep');
    
    if (pgDeep && supabaseDeep) {
      console.log('Deep tier comparison:');
      console.log(`- PG allowed_volatility: ${JSON.stringify(pgDeep.allowed_volatility)}`);
      console.log(`- Supabase allowed_volatility: ${JSON.stringify(supabaseDeep.allowed_volatility)}`);
      console.log(`- Match: ${JSON.stringify(pgDeep.allowed_volatility) === JSON.stringify(supabaseDeep.allowed_volatility)}`);
      
      const pgVolatility = pgDeep.allowed_volatility;
      const supabaseVolatility = supabaseDeep.allowed_volatility;
      
      console.log(`- PG includes "high": ${pgVolatility.includes('high')}`);
      console.log(`- Supabase includes "high": ${supabaseVolatility.includes('high')}`);
    }
    
    // Step 4: Test the actual filtering logic
    console.log('\nSTEP 4: ACTUAL FILTERING TEST');
    console.log('-----------------------------------------');
    
    // Simulate what the filterEngine does
    const testVolatility = 'high';
    const testTier = 'deep';
    
    console.log(`Testing volatility="${testVolatility}" against tier="${testTier}"`);
    
    // Test with Supabase rules
    if (supabaseDeep) {
      const supabaseAllowed = supabaseDeep.allowed_volatility.includes(testVolatility);
      console.log(`- Supabase rules: ${supabaseAllowed ? 'ALLOWED' : 'REJECTED'}`);
    }
    
    // Test with PostgreSQL rules
    if (pgDeep) {
      const pgAllowed = pgDeep.allowed_volatility.includes(testVolatility);
      console.log(`- PostgreSQL rules: ${pgAllowed ? 'ALLOWED' : 'REJECTED'}`);
    }
    
    // Step 5: Fix the discrepancy if found
    console.log('\nSTEP 5: FIX DISCREPANCY');
    console.log('-----------------------------------------');
    
    if (supabaseDeep && pgDeep) {
      const supabaseVolatility = supabaseDeep.allowed_volatility;
      const pgVolatility = pgDeep.allowed_volatility;
      
      if (JSON.stringify(supabaseVolatility) !== JSON.stringify(pgVolatility)) {
        console.log('DISCREPANCY FOUND!');
        console.log('Updating Supabase to match PostgreSQL...');
        
        const { error: updateError } = await supabase
          .from('tier_rules')
          .update({ allowed_volatility: pgVolatility })
          .eq('tier', 'deep');
        
        if (updateError) {
          console.log('Update error:', updateError.message);
        } else {
          console.log('✅ Supabase updated successfully');
        }
      } else {
        console.log('✅ No discrepancy found');
      }
    }
    
  } catch (error) {
    console.error('Check error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkSupabaseVsPgTiers();
