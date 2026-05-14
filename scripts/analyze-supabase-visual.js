// Visual analysis of Supabase tables from screenshots
// Based on the images provided by the user

function analyzeSupabaseTablesVisual() {
  console.log('=== COMPREHENSIVE SUPABASE TABLE ANALYSIS (VISUAL) ===\n');
  
  // Table structures extracted from screenshots
  const tables = {
    // Cricket tables
    'cricket_fixtures': {
      columns: ['id', 'match_id', 'home_team', 'away_team', 'venue', 'match_date', 'match_time', 'league', 'status', 'created_at'],
      purpose: 'Cricket match fixtures data',
      rowCount: 'Visible data shows multiple cricket matches'
    },
    'cricket_insights_final': {
      columns: ['id', 'match_id', 'home_team', 'away_team', 'prediction', 'confidence', 'insights', 'created_at'],
      purpose: 'Cricket match predictions and insights',
      rowCount: 'Visible data shows cricket predictions'
    },
    'cricket_market_rules': {
      columns: ['id', 'market_type', 'allowed_markets', 'min_confidence', 'max_confidence', 'tier', 'created_at'],
      purpose: 'Cricket market rules and restrictions',
      rowCount: 'Shows market rules for different tiers'
    },
    
    // Football/Soccer tables
    'fixtures': {
      columns: ['id', 'match_id', 'home_team', 'away_team', 'venue', 'match_date', 'match_time', 'league', 'status', 'created_at'],
      purpose: 'Football match fixtures data',
      rowCount: 'Visible data shows football matches'
    },
    'predictions_raw': {
      columns: ['id', 'match_id', 'home_team', 'away_team', 'prediction', 'confidence', 'metadata', 'created_at'],
      purpose: 'Raw football predictions before filtering',
      rowCount: 'Shows raw prediction data'
    },
    'predictions_filtered': {
      columns: ['id', 'match_id', 'home_team', 'away_team', 'prediction', 'confidence', 'filter_reason', 'created_at'],
      purpose: 'Filtered football predictions after tier rules',
      rowCount: 'Shows filtered predictions'
    },
    'direct1x2_prediction_final': {
      columns: ['id', 'match_id', 'home_team', 'away_team', 'prediction', 'confidence', 'matches', 'sport', 'market_type', 'created_at'],
      purpose: 'Final football predictions for 1X2 markets',
      rowCount: 'Shows final predictions'
    },
    
    // User and subscription tables
    'profiles': {
      columns: ['id', 'user_id', 'email', 'name', 'subscription_tier', 'created_at', 'updated_at'],
      purpose: 'User profiles and subscription information',
      rowCount: 'Shows user profiles'
    },
    'subscriptions': {
      columns: ['id', 'user_id', 'plan_id', 'status', 'start_date', 'end_date', 'created_at'],
      purpose: 'User subscription details',
      rowCount: 'Shows subscription records'
    },
    
    // Rules and configuration tables
    'tier_rules': {
      columns: ['id', 'tier', 'allowed_volatility', 'min_confidence', 'max_predictions', 'features', 'created_at'],
      purpose: 'Tier-based rules and limits',
      rowCount: 'Shows rules for different tiers'
    },
    'subscription_plans': {
      columns: ['id', 'plan_id', 'name', 'price', 'duration', 'features', 'created_at'],
      purpose: 'Subscription plan definitions',
      rowCount: 'Shows available plans'
    },
    
    // Other sport tables
    'raw_fixtures': {
      columns: ['id_event', 'start_time', 'home_team_id', 'away_team_id', 'home_team', 'away_team', 'venue', 'league', 'created_at'],
      purpose: 'Raw fixture data from external APIs',
      rowCount: 'Shows raw fixture imports'
    },
    
    // AI and analysis tables
    'ai_predictions': {
      columns: ['id', 'match_id', 'home_team', 'away_team', 'prediction', 'confidence', 'ai_model', 'created_at'],
      purpose: 'AI-generated predictions',
      rowCount: 'Shows AI predictions'
    },
    
    // Intelligence and news
    'public_intelligence': {
      columns: ['id', 'espn_entity_id', 'news_timestamp', 'headline', 'description', 'created_at'],
      purpose: 'Public intelligence and news data',
      rowCount: 'Shows intelligence records'
    }
  };
  
  const tableNames = Object.keys(tables);
  
  console.log(`Found ${tableNames.length} tables:`);
  tableNames.forEach((name, i) => console.log(`${i + 1}. ${name} - ${tables[name].purpose}`));
  
  // Step 1: Identify exact duplicates
  console.log('\n=== STEP 1: EXACT DUPLICATE ANALYSIS ===');
  
  const duplicates = [];
  
  // Check cricket vs football fixtures
  const cricketFixturesCols = tables.cricket_fixtures.columns.sort();
  const footballFixturesCols = tables.fixtures.columns.sort();
  
  if (JSON.stringify(cricketFixturesCols) === JSON.stringify(footballFixturesCols)) {
    duplicates.push({
      tables: ['cricket_fixtures', 'fixtures'],
      reason: 'Identical column structure',
      recommendation: 'Merge into single fixtures table with sport discriminator'
    });
    console.log('🔄 EXACT DUPLICATE: cricket_fixtures ↔ fixtures');
    console.log('   Reason: Identical column structure');
    console.log('   Recommendation: Merge into single fixtures table with sport discriminator');
  }
  
  // Check prediction tables
  const predictionTables = ['predictions_raw', 'predictions_filtered', 'direct1x2_prediction_final', 'ai_predictions'];
  
  for (let i = 0; i < predictionTables.length; i++) {
    for (let j = i + 1; j < predictionTables.length; j++) {
      const table1 = predictionTables[i];
      const table2 = predictionTables[j];
      
      const cols1 = tables[table1].columns.sort();
      const cols2 = tables[table2].columns.sort();
      
      const intersection = cols1.filter(col => cols2.includes(col));
      const similarity = intersection.length / Math.max(cols1.length, cols2.length);
      
      if (similarity > 0.7) {
        console.log(`\n🔗 HIGH SIMILARITY (${(similarity * 100).toFixed(1)}%): ${table1} ↔ ${table2}`);
        console.log(`   Common: ${intersection.join(', ')}`);
        console.log(`   Unique to ${table1}: ${cols1.filter(col => !cols2.includes(col)).join(', ') || 'none'}`);
        console.log(`   Unique to ${table2}: ${cols2.filter(col => !cols1.includes(col)).join(', ') || 'none'}`);
      }
    }
  }
  
  // Step 2: Rule table analysis
  console.log('\n=== STEP 2: RULE TABLE ANALYSIS ===');
  
  const ruleTables = ['tier_rules', 'subscription_plans', 'cricket_market_rules'];
  
  console.log(`Found ${ruleTables.length} rule-related tables:`);
  ruleTables.forEach(name => console.log(`  - ${name}: ${tables[name].purpose}`));
  
  // Check for rule conflicts
  console.log('\n📋 Rule Conflict Analysis:');
  
  // tier_rules vs cricket_market_rules
  const tierRulesCols = tables.tier_rules.columns;
  const cricketRulesCols = tables.cricket_market_rules.columns;
  
  console.log('tier_rules vs cricket_market_rules:');
  console.log(`  Common columns: ${tierRulesCols.filter(col => cricketRulesCols.includes(col)).join(', ')}`);
  console.log(`  Potential conflicts: tier, allowed_volatility vs allowed_markets`);
  
  // subscription_plans vs tier_rules
  const subPlansCols = tables.subscription_plans.columns;
  console.log('subscription_plans vs tier_rules:');
  console.log(`  Common columns: ${tierRulesCols.filter(col => subPlansCols.includes(col)).join(', ')}`);
  console.log(`  Potential conflicts: features definition inconsistency`);
  
  // Step 3: Merge opportunities
  console.log('\n=== STEP 3: MERGE OPPORTUNITIES ===');
  
  const mergeOpportunities = [
    {
      tables: ['cricket_fixtures', 'fixtures'],
      confidence: 0.95,
      reason: 'Identical structure, different sports only',
      suggestedName: 'fixtures',
      migrationPlan: 'Add sport column, migrate cricket_fixtures data, drop cricket_fixtures',
      risks: ['Need to update queries to filter by sport', 'Potential data conflicts if match_id overlaps']
    },
    {
      tables: ['predictions_raw', 'predictions_filtered'],
      confidence: 0.85,
      reason: 'Similar structure, different processing stages',
      suggestedName: 'predictions',
      migrationPlan: 'Add status column (raw/filtered), combine data, maintain filter_reason',
      risks: ['Need to update filtering logic', 'Potential performance impact']
    },
    {
      tables: ['tier_rules', 'cricket_market_rules'],
      confidence: 0.75,
      reason: 'Both define tier-based restrictions',
      suggestedName: 'market_rules',
      migrationPlan: 'Add sport column, unify rule structure',
      risks: ['Different rule formats', 'Need to handle sport-specific rules']
    }
  ];
  
  mergeOpportunities.forEach((opp, i) => {
    console.log(`\n🔀 MERGE OPPORTUNITY ${i + 1}: ${opp.tables[0]} + ${opp.tables[1]}`);
    console.log(`   Confidence: ${(opp.confidence * 100).toFixed(1)}%`);
    console.log(`   Reason: ${opp.reason}`);
    console.log(`   Suggested name: ${opp.suggestedName}`);
    console.log(`   Migration plan: ${opp.migrationPlan}`);
    console.log(`   Risks: ${opp.risks.join(', ')}`);
  });
  
  // Step 4: Data duplication analysis
  console.log('\n=== STEP 4: DATA DUPLICATION ANALYSIS ===');
  
  const dataDuplication = [
    {
      tables: ['cricket_fixtures', 'fixtures'],
      type: 'Structural duplication',
      impact: 'High - same data structure for different sports',
      recommendation: 'Merge with sport discriminator'
    },
    {
      tables: ['predictions_raw', 'predictions_filtered', 'direct1x2_prediction_final'],
      type: 'Processing pipeline duplication',
      impact: 'Medium - same data at different stages',
      recommendation: 'Consolidate with status tracking'
    },
    {
      tables: ['tier_rules', 'cricket_market_rules'],
      type: 'Rule duplication',
      impact: 'High - conflicting rule definitions',
      recommendation: 'Unify rule system'
    }
  ];
  
  dataDuplication.forEach((dup, i) => {
    console.log(`\n🔄 DATA DUPLICATION ${i + 1}: ${dup.tables.join(' ↔ ')}`);
    console.log(`   Type: ${dup.type}`);
    console.log(`   Impact: ${dup.impact}`);
    console.log(`   Recommendation: ${dup.recommendation}`);
  });
  
  // Step 5: Recommendations
  console.log('\n=== STEP 5: COMPREHENSIVE RECOMMENDATIONS ===');
  
  const recommendations = [
    {
      priority: 'URGENT',
      action: 'Merge cricket_fixtures and fixtures',
      reason: 'Exact structural duplication causing maintenance overhead',
      impact: 'Reduces table count, simplifies queries, prevents data inconsistency',
      effort: 'Medium - requires sport column addition and query updates'
    },
    {
      priority: 'HIGH',
      action: 'Unify rule tables (tier_rules, cricket_market_rules)',
      reason: 'Conflicting rule definitions across sports',
      impact: 'Consistent rule enforcement, easier maintenance',
      effort: 'High - requires rule format standardization'
    },
    {
      priority: 'MEDIUM',
      action: 'Consolidate prediction tables',
      reason: 'Multiple tables for same data at different stages',
      impact: 'Simpler data flow, easier debugging',
      effort: 'Medium - requires status tracking and pipeline updates'
    },
    {
      priority: 'LOW',
      action: 'Review and standardize column naming',
      reason: 'Inconsistent naming conventions across tables',
      impact: 'Better developer experience, clearer data model',
      effort: 'Low - mostly cosmetic changes'
    }
  ];
  
  recommendations.forEach((rec, i) => {
    console.log(`\n${i + 1}. ${rec.priority}: ${rec.action}`);
    console.log(`   Reason: ${rec.reason}`);
    console.log(`   Impact: ${rec.impact}`);
    console.log(`   Effort: ${rec.effort}`);
  });
  
  // Step 6: Risk assessment
  console.log('\n=== STEP 6: RISK ASSESSMENT ===');
  
  const risks = [
    {
      risk: 'Data loss during migration',
      probability: 'Medium',
      impact: 'High',
      mitigation: 'Full backup before any merge operations, test migrations in staging'
    },
    {
      risk: 'Application breaks due to table changes',
      probability: 'High',
      impact: 'High',
      mitigation: 'Comprehensive code review, update all references, gradual migration'
    },
    {
      risk: 'Performance degradation',
      probability: 'Medium',
      impact: 'Medium',
      mitigation: 'Proper indexing, query optimization, performance testing'
    },
    {
      risk: 'Rule conflicts causing user issues',
      probability: 'Medium',
      impact: 'High',
      mitigation: 'Careful rule mapping, user communication, rollback plan'
    }
  ];
  
  risks.forEach((risk, i) => {
    console.log(`\n⚠️  RISK ${i + 1}: ${risk.risk}`);
    console.log(`   Probability: ${risk.probability}`);
    console.log(`   Impact: ${risk.impact}`);
    console.log(`   Mitigation: ${risk.mitigation}`);
  });
  
  // Generate final report
  const report = {
    summary: {
      totalTables: tableNames.length,
      duplicateGroups: duplicates.length,
      ruleTables: ruleTables.length,
      mergeOpportunities: mergeOpportunities.length,
      dataDuplication: dataDuplication.length
    },
    tables: tables,
    duplicates: duplicates,
    mergeOpportunities: mergeOpportunities,
    dataDuplication: dataDuplication,
    recommendations: recommendations,
    risks: risks
  };
  
  // Save report
  const fs = require('fs');
  const reportPath = './supabase-visual-analysis-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  
  console.log('\n=== EXECUTION PLAN ===');
  console.log('Phase 1 (URGENT): Merge cricket_fixtures + fixtures');
  console.log('Phase 2 (HIGH): Unify rule tables');
  console.log('Phase 3 (MEDIUM): Consolidate prediction tables');
  console.log('Phase 4 (LOW): Standardize naming conventions');
  
  return report;
}

analyzeSupabaseTablesVisual();
