// CONSERVATIVE MIGRATION PLAN - PRESERVING ALL FUNCTIONALITY
// Based on dependency analysis and architecture understanding

function createSafeMigrationPlan() {
  console.log('=== CONSERVATIVE MIGRATION PLAN - PRESERVING ALL FUNCTIONALITY ===\n');
  
  // CRITICAL INSIGHTS FROM ANALYSIS:
  // - High-risk tables have 27+ direct references
  // - Backend services heavily depend on current structure
  // - Cricket and football fixtures are identical but have separate code paths
  // - Prediction pipeline has 3 stages with complex filtering logic
  // - Rule systems are sport-specific and must be preserved
  
  const safeMigrationPlan = {
    philosophy: 'CONSERVATIVE APPROACH - Zero Risk of Data Loss',
    principles: [
      'NEVER delete original tables until new system is fully validated',
      'Create VIEW layers instead of immediate table consolidation',
      'Gradual migration with fallback to original tables',
      'Preserve all existing API endpoints and functionality',
      'Test each phase thoroughly before proceeding'
    ],
    phases: []
  };
  
  // PHASE 1: CRICKET_FIXTURES + FIXTURES (LOWEST RISK)
  safeMigrationPlan.phases.push({
    phase: 1,
    title: 'Create Unified Fixtures with VIEW Layer',
    riskLevel: 'LOW',
    estimatedTime: '3-4 hours',
    description: 'Create unified fixtures table while preserving original tables',
    steps: [
      {
        step: 1,
        action: 'Create unified fixtures table with sport discriminator',
        sql: `CREATE TABLE fixtures_unified (
          id SERIAL PRIMARY KEY,
          match_id VARCHAR(50) NOT NULL,
          home_team VARCHAR(100) NOT NULL,
          away_team VARCHAR(100) NOT NULL,
          venue VARCHAR(200),
          match_date DATE NOT NULL,
          match_time TIME,
          league VARCHAR(100),
          status VARCHAR(20) DEFAULT 'upcoming',
          sport VARCHAR(20) NOT NULL DEFAULT 'football',
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(match_id, sport)
        );`,
        verification: '\\d fixtures_unified'
      },
      {
        step: 2,
        action: 'Migrate football fixtures to unified table',
        sql: `INSERT INTO fixtures_unified (match_id, home_team, away_team, venue, match_date, match_time, league, status, sport, created_at)
               SELECT match_id, home_team, away_team, venue, match_date, match_time, league, status, 'football', created_at
               FROM fixtures;`,
        verification: 'SELECT COUNT(*) FROM fixtures_unified WHERE sport = \'football\';'
      },
      {
        step: 3,
        action: 'Migrate cricket fixtures to unified table',
        sql: `INSERT INTO fixtures_unified (match_id, home_team, away_team, venue, match_date, match_time, league, status, sport, created_at)
               SELECT match_id, home_team, away_team, venue, match_date, match_time, league, status, 'cricket', created_at
               FROM cricket_fixtures;`,
        verification: 'SELECT COUNT(*) FROM fixtures_unified WHERE sport = \'cricket\';'
      },
      {
        step: 4,
        action: 'Create VIEW for backward compatibility',
        sql: `CREATE VIEW cricket_fixtures_view AS
               SELECT * FROM fixtures_unified WHERE sport = 'cricket';`,
        verification: 'SELECT COUNT(*) FROM cricket_fixtures_view;'
      },
      {
        step: 5,
        action: 'Create service layer for unified access',
        codeFile: 'backend/services/unifiedFixturesService.js',
        description: 'Create service that can query by sport or all fixtures'
      },
      {
        step: 6,
        action: 'Test cricket functionality with unified table',
        testCases: [
          'Cricket fixture retrieval works',
          'Cricket predictions still generate',
          'Cricket insights display correctly'
        ]
      },
      {
        step: 7,
        action: 'Gradually update cricket code to use unified table',
        filesToUpdate: [
          'backend/services/cricketService.js',
          'scripts/publish-cricbuzz-cricket.js',
          'backend/services/thesportsdbPipeline.js'
        ],
        approach: 'Add sport parameter to queries, keep original as fallback'
      }
    ],
    rollbackPlan: [
      'Drop fixtures_unified table',
      'Drop cricket_fixtures_view',
      'All original functionality remains intact'
    ],
    validationCriteria: [
      'All cricket tests pass',
      'No performance degradation',
      'Original tables still accessible'
    ]
  });
  
  // PHASE 2: RULES UNIFICATION (MEDIUM RISK)
  safeMigrationPlan.phases.push({
    phase: 2,
    title: 'Unified Rules System with Sport Context',
    riskLevel: 'MEDIUM',
    estimatedTime: '4-5 hours',
    description: 'Create unified rules table while preserving sport-specific logic',
    steps: [
      {
        step: 1,
        action: 'Create unified market rules table',
        sql: `CREATE TABLE market_rules_unified (
          id SERIAL PRIMARY KEY,
          tier VARCHAR(50) NOT NULL,
          sport VARCHAR(20) DEFAULT 'all',
          rule_type VARCHAR(50) NOT NULL, -- 'volatility', 'markets', 'confidence'
          rule_config JSONB NOT NULL,
          min_confidence DECIMAL(5,2),
          max_confidence DECIMAL(5,2),
          max_predictions INTEGER,
          features JSONB,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );`,
        verification: '\\d market_rules_unified'
      },
      {
        step: 2,
        action: 'Migrate tier_rules to unified structure',
        sql: `INSERT INTO market_rules_unified (tier, sport, rule_type, rule_config, min_confidence, max_confidence, max_predictions, features, created_at)
               SELECT tier, 'all', 'volatility', 
                      jsonb_build_object('allowed_volatility', allowed_volatility),
                      min_confidence, max_confidence, max_predictions, features, created_at
               FROM tier_rules;`,
        verification: 'SELECT COUNT(*) FROM market_rules_unified WHERE sport = \'all\';'
      },
      {
        step: 3,
        action: 'Migrate cricket market rules',
        sql: `INSERT INTO market_rules_unified (tier, sport, rule_type, rule_config, min_confidence, max_confidence, created_at)
               SELECT tier, 'cricket', 'markets', 
                      jsonb_build_object('allowed_markets', allowed_markets),
                      min_confidence, max_confidence, created_at
               FROM cricket_market_rules;`,
        verification: 'SELECT COUNT(*) FROM market_rules_unified WHERE sport = \'cricket\';'
      },
      {
        step: 4,
        action: 'Create unified rules service',
        codeFile: 'backend/services/unifiedRulesService.js',
        description: 'Service that queries rules by tier and sport with fallback logic'
      },
      {
        step: 5,
        action: 'Create VIEW for backward compatibility',
        sql: `CREATE VIEW tier_rules_view AS
               SELECT tier, rule_config->>'allowed_volatility' as allowed_volatility,
                      min_confidence, max_confidence, max_predictions, features, created_at
               FROM market_rules_unified 
               WHERE sport = 'all' AND rule_type = 'volatility' AND is_active = true;`,
        verification: 'SELECT COUNT(*) FROM tier_rules_view;'
      },
      {
        step: 6,
        action: 'Test rule enforcement across sports',
        testCases: [
          'Football tier rules work correctly',
          'Cricket market rules work correctly',
          'No rule conflicts between sports'
        ]
      },
      {
        step: 7,
        action: 'Update filter engine to use unified rules',
        filesToUpdate: [
          'backend/services/filterEngine.js',
          'backend/config/subscriptionMatrix.js'
        ],
        approach: 'Add sport parameter, maintain backward compatibility'
      }
    ],
    rollbackPlan: [
      'Drop market_rules_unified table',
      'Drop tier_rules_view',
      'All original rule tables remain functional'
    ],
    validationCriteria: [
      'All tier-based filtering works',
      'Cricket-specific rules enforced',
      'No performance impact on filtering'
    ]
  });
  
  // PHASE 3: PREDICTION CONSOLIDATION (HIGH RISK)
  safeMigrationPlan.phases.push({
    phase: 3,
    title: 'Unified Prediction Pipeline with Status Tracking',
    riskLevel: 'HIGH',
    estimatedTime: '6-8 hours',
    description: 'Create unified predictions table while preserving pipeline stages',
    steps: [
      {
        step: 1,
        action: 'Create unified predictions table with status tracking',
        sql: `CREATE TABLE predictions_unified (
          id SERIAL PRIMARY KEY,
          match_id VARCHAR(50) NOT NULL,
          home_team VARCHAR(100) NOT NULL,
          away_team VARCHAR(100) NOT NULL,
          prediction VARCHAR(50) NOT NULL,
          confidence DECIMAL(5,2) NOT NULL,
          status VARCHAR(20) DEFAULT 'raw', -- raw, filtered, ai_generated, final
          filter_reason TEXT,
          metadata JSONB,
          ai_model VARCHAR(50),
          sport VARCHAR(20) DEFAULT 'football',
          market_type VARCHAR(50) DEFAULT '1x2',
          processing_stage VARCHAR(20) DEFAULT 'stage_1',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          INDEX(match_id),
          INDEX(status),
          INDEX(sport),
          INDEX(processing_stage)
        );`,
        verification: '\\d predictions_unified'
      },
      {
        step: 2,
        action: 'Migrate raw predictions',
        sql: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, metadata, sport, processing_stage, created_at)
               SELECT match_id, home_team, away_team, prediction, confidence, 'raw', metadata, 'football', 'stage_1', created_at
               FROM predictions_raw;`,
        verification: 'SELECT COUNT(*) FROM predictions_unified WHERE status = \'raw\';'
      },
      {
        step: 3,
        action: 'Migrate filtered predictions',
        sql: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, filter_reason, sport, processing_stage, created_at)
               SELECT match_id, home_team, away_team, prediction, confidence, 'filtered', filter_reason, 'football', 'stage_2', created_at
               FROM predictions_filtered;`,
        verification: 'SELECT COUNT(*) FROM predictions_unified WHERE status = \'filtered\';'
      },
      {
        step: 4,
        action: 'Migrate AI predictions',
        sql: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, ai_model, sport, processing_stage, created_at)
               SELECT match_id, home_team, away_team, prediction, confidence, 'ai_generated', ai_model, 'football', 'stage_3', created_at
               FROM ai_predictions;`,
        verification: 'SELECT COUNT(*) FROM predictions_unified WHERE status = \'ai_generated\';'
      },
      {
        step: 5,
        action: 'Create VIEWs for backward compatibility',
        sql: [
          'CREATE VIEW predictions_raw_view AS SELECT * FROM predictions_unified WHERE status = \'raw\';',
          'CREATE VIEW predictions_filtered_view AS SELECT * FROM predictions_unified WHERE status = \'filtered\';',
          'CREATE VIEW ai_predictions_view AS SELECT * FROM predictions_unified WHERE status = \'ai_generated\';'
        ],
        verification: 'SELECT COUNT(*) FROM each_view;'
      },
      {
        step: 6,
        action: 'Create unified prediction service',
        codeFile: 'backend/services/unifiedPredictionsService.js',
        description: 'Service that handles all prediction stages with status tracking'
      },
      {
        step: 7,
        action: 'Test complete prediction pipeline',
        testCases: [
          'Raw prediction creation works',
          'Filtering logic still functions',
          'AI prediction generation works',
          'Final predictions accessible'
        ]
      },
      {
        step: 8,
        action: 'Update pipeline services gradually',
        filesToUpdate: [
          'backend/services/aiPipeline.js',
          'backend/services/filterEngine.js',
          'backend/routes/predictions.js'
        ],
        approach: 'Add status parameter, keep original tables as fallback'
      }
    ],
    rollbackPlan: [
      'Drop predictions_unified table',
      'Drop all prediction VIEWs',
      'All original prediction tables remain functional'
    ],
    validationCriteria: [
      'Complete prediction pipeline works',
      'No data loss in any stage',
      'Performance maintained or improved'
    ]
  });
  
  // PHASE 4: CLEANUP (LOW RISK)
  safeMigrationPlan.phases.push({
    phase: 4,
    title: 'Gradual Cleanup and Optimization',
    riskLevel: 'LOW',
    estimatedTime: '2-3 hours',
    description: 'Remove old tables after thorough validation',
    steps: [
      {
        step: 1,
        action: 'Monitor system performance with unified tables',
        duration: '1 week',
        metrics: ['Query performance', 'Error rates', 'Data consistency']
      },
      {
        step: 2,
        action: 'Update all remaining references',
        filesToUpdate: 'All remaining files with old table names',
        approach: 'Systematic replacement with testing'
      },
      {
        step: 3,
        action: 'Remove original tables (OPTIONAL - can keep for safety)',
        sql: [
          'DROP TABLE IF EXISTS cricket_fixtures;',
          'DROP TABLE IF EXISTS tier_rules;',
          'DROP TABLE IF EXISTS cricket_market_rules;',
          'DROP TABLE IF EXISTS predictions_raw;',
          'DROP TABLE IF EXISTS predictions_filtered;',
          'DROP TABLE IF EXISTS ai_predictions;'
        ],
        verification: '\\dt (old tables should be gone)'
      }
    ],
    rollbackPlan: [
      'Restore from backups if needed',
      'Keep backup tables for 30 days'
    ],
    validationCriteria: [
      'System runs smoothly without old tables',
      'All functionality preserved',
      'Performance improved'
    ]
  });
  
  // SAFETY MEASURES
  safeMigrationPlan.safetyMeasures = {
    preMigration: [
      'Full database backup before each phase',
      'Export all table structures and data',
      'Document all current API endpoints',
      'Create comprehensive test suite'
    ],
    duringMigration: [
      'Keep original tables until new system fully validated',
      'Use VIEWs for backward compatibility',
      'Monitor application performance continuously',
      'Have rollback scripts ready for each phase'
    ],
    postMigration: [
      'Run full regression test suite',
      'Monitor for 24-48 hours before proceeding',
      'Keep backups for at least 30 days',
      'Document all changes for future reference'
    ]
  };
  
  // OUTPUT THE PLAN
  console.log('🛡️  CONSERVATIVE MIGRATION STRATEGY');
  console.log('Philosophy: ' + safeMigrationPlan.philosophy);
  console.log('\n📋 PRINCIPLES:');
  safeMigrationPlan.principles.forEach((principle, i) => {
    console.log(`${i + 1}. ${principle}`);
  });
  
  safeMigrationPlan.phases.forEach(phase => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`PHASE ${phase.phase}: ${phase.title}`);
    console.log(`Risk Level: ${phase.riskLevel}`);
    console.log(`Estimated Time: ${phase.estimatedTime}`);
    console.log(`Description: ${phase.description}`);
    console.log(`${'='.repeat(80)}`);
    
    phase.steps.forEach((step, i) => {
      console.log(`\n${phase.phase}.${i + 1}. ${step.action}`);
      if (step.sql) console.log(`   SQL: ${Array.isArray(step.sql) ? step.sql.join('; ') : step.sql}`);
      if (step.verification) console.log(`   Verify: ${step.verification}`);
      if (step.codeFile) console.log(`   Code: ${step.codeFile}`);
      if (step.description) console.log(`   Details: ${step.description}`);
      if (step.filesToUpdate) console.log(`   Files: ${Array.isArray(step.filesToUpdate) ? step.filesToUpdate.join(', ') : step.filesToUpdate}`);
      if (step.testCases) console.log(`   Tests: ${step.testCases.join(', ')}`);
      if (step.approach) console.log(`   Approach: ${step.approach}`);
    });
    
    console.log(`\n🔄 ROLLBACK PLAN:`);
    phase.rollbackPlan.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item}`);
    });
    
    console.log(`\n✅ VALIDATION CRITERIA:`);
    phase.validationCriteria.forEach((criteria, i) => {
      console.log(`   ${i + 1}. ${criteria}`);
    });
  });
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('🛡️  SAFETY MEASURES');
  console.log(`${'='.repeat(80)}`);
  
  console.log('\nPRE-MIGRATION:');
  safeMigrationPlan.safetyMeasures.preMigration.forEach((measure, i) => {
    console.log(`${i + 1}. ${measure}`);
  });
  
  console.log('\nDURING MIGRATION:');
  safeMigrationPlan.safetyMeasures.duringMigration.forEach((measure, i) => {
    console.log(`${i + 1}. ${measure}`);
  });
  
  console.log('\nPOST-MIGRATION:');
  safeMigrationPlan.safetyMeasures.postMigration.forEach((measure, i) => {
    console.log(`${i + 1}. ${measure}`);
  });
  
  // Save the plan
  const fs = require('fs');
  const planPath = './safe-migration-plan.json';
  fs.writeFileSync(planPath, JSON.stringify(safeMigrationPlan, null, 2));
  
  console.log(`\n📄 Safe migration plan saved to: ${planPath}`);
  
  console.log('\n🎯 EXECUTION RECOMMENDATION:');
  console.log('1. Start with Phase 1 (Fixtures) - Lowest risk, immediate benefit');
  console.log('2. Wait 24-48 hours before Phase 2 (Rules)');
  console.log('3. Test Phase 3 (Predictions) thoroughly - Highest risk');
  console.log('4. Phase 4 (Cleanup) is optional - can keep old tables for safety');
  
  return safeMigrationPlan;
}

createSafeMigrationPlan();
