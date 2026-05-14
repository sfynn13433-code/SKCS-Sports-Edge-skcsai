// Migration plan for Supabase table consolidation
// Based on the visual analysis results

function createMigrationPlan() {
  console.log('=== SUPABASE TABLE CONSOLIDATION MIGRATION PLAN ===\n');
  
  const migrationPlan = {
    phases: [
      {
        phase: 1,
        priority: 'URGENT',
        title: 'Merge cricket_fixtures and fixtures',
        description: 'Eliminate exact structural duplication by consolidating fixtures across all sports',
        tables: ['cricket_fixtures', 'fixtures'],
        estimatedTime: '2-4 hours',
        riskLevel: 'Medium',
        steps: [
          {
            step: 1,
            action: 'Create backup of both tables',
            command: 'CREATE TABLE cricket_fixtures_backup AS SELECT * FROM cricket_fixtures; CREATE TABLE fixtures_backup AS SELECT * FROM fixtures;',
            verification: 'SELECT COUNT(*) FROM cricket_fixtures_backup; SELECT COUNT(*) FROM fixtures_backup;'
          },
          {
            step: 2,
            action: 'Add sport column to fixtures table',
            command: 'ALTER TABLE fixtures ADD COLUMN sport VARCHAR(20) DEFAULT \'football\';',
            verification: 'DESCRIBE fixtures;'
          },
          {
            step: 3,
            action: 'Migrate cricket fixtures data',
            command: 'INSERT INTO fixtures (match_id, home_team, away_team, venue, match_date, match_time, league, status, sport, created_at) SELECT match_id, home_team, away_team, venue, match_date, match_time, league, status, \'cricket\', created_at FROM cricket_fixtures;',
            verification: 'SELECT COUNT(*) FROM fixtures WHERE sport = \'cricket\';'
          },
          {
            step: 4,
            action: 'Add index on sport column for performance',
            command: 'CREATE INDEX idx_fixtures_sport ON fixtures(sport); CREATE INDEX idx_fixtures_sport_match_date ON fixtures(sport, match_date);',
            verification: '\\d fixtures'
          },
          {
            step: 5,
            action: 'Update application queries to filter by sport',
            filesToUpdate: [
              'backend/services/thesportsdbPipeline.js',
              'backend/routes/sportsEdge.js',
              'backend/services/enhancedMatchDetailsService.js'
            ],
            exampleChange: 'SELECT * FROM fixtures WHERE sport = \'cricket\' AND match_date >= NOW()'
          },
          {
            step: 6,
            action: 'Test all cricket-related functionality',
            testCases: [
              'Cricket fixture retrieval',
              'Cricket predictions generation',
              'Cricket insights display'
            ]
          },
          {
            step: 7,
            action: 'Drop cricket_fixtures table (after verification)',
            command: 'DROP TABLE cricket_fixtures;',
            verification: '\\dt (cricket_fixtures should not appear)'
          }
        ],
        rollbackPlan: [
          'Restore from fixtures_backup',
          'Recreate cricket_fixtures from backup',
          'Remove sport column from fixtures'
        ]
      },
      {
        phase: 2,
        priority: 'HIGH',
        title: 'Unify rule tables (tier_rules and cricket_market_rules)',
        description: 'Consolidate rule definitions to prevent conflicts and ensure consistency',
        tables: ['tier_rules', 'cricket_market_rules'],
        estimatedTime: '4-6 hours',
        riskLevel: 'High',
        steps: [
          {
            step: 1,
            action: 'Create backup of both rule tables',
            command: 'CREATE TABLE tier_rules_backup AS SELECT * FROM tier_rules; CREATE TABLE cricket_market_rules_backup AS SELECT * FROM cricket_market_rules;',
            verification: 'SELECT COUNT(*) FROM tier_rules_backup; SELECT COUNT(*) FROM cricket_market_rules_backup;'
          },
          {
            step: 2,
            action: 'Create unified market_rules table',
            command: `CREATE TABLE market_rules (
              id SERIAL PRIMARY KEY,
              tier VARCHAR(50) NOT NULL,
              sport VARCHAR(20) DEFAULT 'all',
              allowed_volatility JSONB,
              allowed_markets JSONB,
              min_confidence DECIMAL(5,2),
              max_confidence DECIMAL(5,2),
              max_predictions INTEGER,
              features JSONB,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            );`,
            verification: '\\d market_rules'
          },
          {
            step: 3,
            action: 'Migrate tier_rules data',
            command: `INSERT INTO market_rules (tier, sport, allowed_volatility, min_confidence, max_confidence, max_predictions, features, created_at) 
                      SELECT tier, 'all', allowed_volatility, min_confidence, max_confidence, max_predictions, features, created_at 
                      FROM tier_rules;`,
            verification: 'SELECT COUNT(*) FROM market_rules WHERE sport = \'all\';'
          },
          {
            step: 4,
            action: 'Migrate cricket_market_rules data',
            command: `INSERT INTO market_rules (tier, sport, allowed_markets, min_confidence, max_confidence, created_at) 
                      SELECT tier, 'cricket', allowed_markets, min_confidence, max_confidence, created_at 
                      FROM cricket_market_rules;`,
            verification: 'SELECT COUNT(*) FROM market_rules WHERE sport = \'cricket\';'
          },
          {
            step: 5,
            action: 'Create indexes for performance',
            command: 'CREATE INDEX idx_market_rules_tier ON market_rules(tier); CREATE INDEX idx_market_rules_sport ON market_rules(sport); CREATE INDEX idx_market_rules_tier_sport ON market_rules(tier, sport);',
            verification: '\\d market_rules'
          },
          {
            step: 6,
            action: 'Update application code to use market_rules',
            filesToUpdate: [
              'backend/services/filterEngine.js',
              'backend/config/subscriptionMatrix.js',
              'backend/services/subscriptionTiming.js'
            ],
            exampleChange: 'SELECT * FROM market_rules WHERE tier = $1 AND (sport = $2 OR sport = \'all\')'
          },
          {
            step: 7,
            action: 'Test rule enforcement across all sports',
            testCases: [
              'Football tier rules validation',
              'Cricket tier rules validation',
              'Cross-sport rule consistency'
            ]
          },
          {
            step: 8,
            action: 'Drop old rule tables',
            command: 'DROP TABLE tier_rules; DROP TABLE cricket_market_rules;',
            verification: '\\dt (old tables should not appear)'
          }
        ],
        rollbackPlan: [
          'Restore from tier_rules_backup and cricket_market_rules_backup',
          'Drop market_rules table',
          'Update application code to use old table names'
        ]
      },
      {
        phase: 3,
        priority: 'MEDIUM',
        title: 'Consolidate prediction tables',
        description: 'Merge prediction pipeline tables into single table with status tracking',
        tables: ['predictions_raw', 'predictions_filtered', 'ai_predictions'],
        estimatedTime: '6-8 hours',
        riskLevel: 'Medium',
        steps: [
          {
            step: 1,
            action: 'Create backup of all prediction tables',
            command: 'CREATE TABLE predictions_raw_backup AS SELECT * FROM predictions_raw; CREATE TABLE predictions_filtered_backup AS SELECT * FROM predictions_filtered; CREATE TABLE ai_predictions_backup AS SELECT * FROM ai_predictions;',
            verification: 'SELECT COUNT(*) FROM each_backup_table;'
          },
          {
            step: 2,
            action: 'Create unified predictions table',
            command: `CREATE TABLE predictions_unified (
              id SERIAL PRIMARY KEY,
              match_id VARCHAR(50) NOT NULL,
              home_team VARCHAR(100) NOT NULL,
              away_team VARCHAR(100) NOT NULL,
              prediction VARCHAR(50) NOT NULL,
              confidence DECIMAL(5,2) NOT NULL,
              status VARCHAR(20) DEFAULT 'raw',
              filter_reason TEXT,
              metadata JSONB,
              ai_model VARCHAR(50),
              sport VARCHAR(20) DEFAULT 'football',
              market_type VARCHAR(50) DEFAULT '1x2',
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            );`,
            verification: '\\d predictions_unified'
          },
          {
            step: 3,
            action: 'Migrate predictions_raw data',
            command: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, metadata, sport, created_at) 
                      SELECT match_id, home_team, away_team, prediction, confidence, 'raw', metadata, 'football', created_at 
                      FROM predictions_raw;`,
            verification: 'SELECT COUNT(*) FROM predictions_unified WHERE status = \'raw\';'
          },
          {
            step: 4,
            action: 'Migrate predictions_filtered data',
            command: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, filter_reason, sport, created_at) 
                      SELECT match_id, home_team, away_team, prediction, confidence, 'filtered', filter_reason, 'football', created_at 
                      FROM predictions_filtered;`,
            verification: 'SELECT COUNT(*) FROM predictions_unified WHERE status = \'filtered\';'
          },
          {
            step: 5,
            action: 'Migrate ai_predictions data',
            command: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, ai_model, sport, created_at) 
                      SELECT match_id, home_team, away_team, prediction, confidence, 'ai_generated', ai_model, 'football', created_at 
                      FROM ai_predictions;`,
            verification: 'SELECT COUNT(*) FROM predictions_unified WHERE status = \'ai_generated\';'
          },
          {
            step: 6,
            action: 'Create comprehensive indexes',
            command: `CREATE INDEX idx_predictions_unified_match_id ON predictions_unified(match_id); 
                      CREATE INDEX idx_predictions_unified_status ON predictions_unified(status); 
                      CREATE INDEX idx_predictions_unified_sport ON predictions_unified(sport); 
                      CREATE INDEX idx_predictions_unified_status_sport ON predictions_unified(status, sport);`,
            verification: '\\d predictions_unified'
          },
          {
            step: 7,
            action: 'Update application code to use unified table',
            filesToUpdate: [
              'backend/services/aiPipeline.js',
              'backend/services/filterEngine.js',
              'backend/routes/predictions.js',
              'backend/services/accaBuilder.js'
            ],
            exampleChange: 'SELECT * FROM predictions_unified WHERE status = \'raw\' AND sport = $1'
          },
          {
            step: 8,
            action: 'Update prediction pipeline logic',
            description: 'Modify pipeline to update status instead of moving between tables'
          },
          {
            step: 9,
            action: 'Test complete prediction pipeline',
            testCases: [
              'Raw prediction creation',
              'Prediction filtering',
              'AI prediction generation',
              'Final prediction retrieval'
            ]
          },
          {
            step: 10,
            action: 'Drop old prediction tables',
            command: 'DROP TABLE predictions_raw; DROP TABLE predictions_filtered; DROP TABLE ai_predictions;',
            verification: '\\dt (old tables should not appear)'
          }
        ],
        rollbackPlan: [
          'Restore from all backup tables',
          'Drop predictions_unified table',
          'Update application code to use old table names',
          'Restore original pipeline logic'
        ]
      },
      {
        phase: 4,
        priority: 'LOW',
        title: 'Standardize column naming conventions',
        description: 'Ensure consistent naming across all tables',
        tables: ['all_tables'],
        estimatedTime: '2-3 hours',
        riskLevel: 'Low',
        steps: [
          {
            step: 1,
            action: 'Review all table column names',
            description: 'Document inconsistencies and create naming standards'
          },
          {
            step: 2,
            action: 'Standardize timestamp columns',
            description: 'Ensure all tables use created_at and updated_at consistently'
          },
          {
            step: 3,
            action: 'Standardize ID columns',
            description: 'Ensure consistent naming for primary and foreign keys'
          },
          {
            step: 4,
            action: 'Update application code for new column names',
            description: 'Update all references to use standardized names'
          }
        ],
        rollbackPlan: [
          'Revert column name changes',
          'Update application code back to original names'
        ]
      }
    ],
    preMigrationChecklist: [
      'Full database backup completed',
      'All application code identified for updates',
      'Test environment prepared',
      'Rollback procedures documented',
      'Stakeholder communication plan prepared',
      'Performance baseline measurements recorded'
    ],
    postMigrationValidation: [
      'Data integrity verification',
      'Application functionality testing',
      'Performance benchmarking',
      'User acceptance testing',
      'Monitoring and alerting setup'
    ]
  };
  
  // Output the detailed migration plan
  console.log('📋 DETAILED MIGRATION PLAN:\n');
  
  migrationPlan.phases.forEach((phase, i) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`PHASE ${phase.phase}: ${phase.title}`);
    console.log(`Priority: ${phase.priority}`);
    console.log(`Risk Level: ${phase.riskLevel}`);
    console.log(`Estimated Time: ${phase.estimatedTime}`);
    console.log(`Tables: ${phase.tables.join(', ')}`);
    console.log(`Description: ${phase.description}`);
    console.log(`${'='.repeat(80)}`);
    
    phase.steps.forEach((step, j) => {
      console.log(`\n${phase.phase}.${j + 1}. ${step.action}`);
      if (step.command) console.log(`   SQL: ${step.command}`);
      if (step.verification) console.log(`   Verify: ${step.verification}`);
      if (step.filesToUpdate) console.log(`   Files: ${step.filesToUpdate.join(', ')}`);
      if (step.exampleChange) console.log(`   Example: ${step.exampleChange}`);
      if (step.description) console.log(`   Details: ${step.description}`);
      if (step.testCases) console.log(`   Tests: ${step.testCases.join(', ')}`);
    });
    
    console.log(`\n🔄 ROLLBACK PLAN:`);
    phase.rollbackPlan.forEach((item, k) => {
      console.log(`   ${k + 1}. ${item}`);
    });
  });
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('PRE-MIGRATION CHECKLIST:');
  console.log(`${'='.repeat(80)}`);
  migrationPlan.preMigrationChecklist.forEach((item, i) => {
    console.log(`${i + 1}. ${item}`);
  });
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('POST-MIGRATION VALIDATION:');
  console.log(`${'='.repeat(80)}`);
  migrationPlan.postMigrationValidation.forEach((item, i) => {
    console.log(`${i + 1}. ${item}`);
  });
  
  // Save the migration plan
  const fs = require('fs');
  const planPath = './supabase-migration-plan.json';
  fs.writeFileSync(planPath, JSON.stringify(migrationPlan, null, 2));
  
  console.log(`\n📄 Detailed migration plan saved to: ${planPath}`);
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('EXECUTION TIMELINE:');
  console.log(`${'='.repeat(80)}`);
  console.log('Week 1: Phase 1 (Fixtures merge) - URGENT');
  console.log('Week 2: Phase 2 (Rules unification) - HIGH');
  console.log('Week 3: Phase 3 (Predictions consolidation) - MEDIUM');
  console.log('Week 4: Phase 4 (Naming standardization) - LOW');
  
  return migrationPlan;
}

createMigrationPlan();
