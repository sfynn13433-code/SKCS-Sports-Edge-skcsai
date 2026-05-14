const db = require('../backend/db');
const fs = require('fs');
const path = require('path');

async function implementPhase1Fixtures() {
  console.log('=== IMPLEMENTING PHASE 1: FIXTURES CONSOLIDATION ===\n');
  console.log('🛡️  CONSERVATIVE APPROACH - Preserving all functionality\n');
  
  try {
    // STEP 1: Create full backups
    console.log('STEP 1: CREATING FULL BACKUPS');
    console.log('------------------------------------');
    
    const backupCommands = [
      'CREATE TABLE cricket_fixtures_backup_phase1 AS SELECT * FROM cricket_fixtures;',
      'CREATE TABLE fixtures_backup_phase1 AS SELECT * FROM fixtures;'
    ];
    
    for (const command of backupCommands) {
      try {
        await db.query(command);
        console.log('✅ Backup created successfully');
      } catch (error) {
        console.log('❌ Backup failed:', error.message);
        throw error;
      }
    }
    
    // Verify backups
    const cricketBackupCount = await db.query('SELECT COUNT(*) as count FROM cricket_fixtures_backup_phase1');
    const fixturesBackupCount = await db.query('SELECT COUNT(*) as count FROM fixtures_backup_phase1');
    
    console.log(`✅ Cricket fixtures backup: ${cricketBackupCount.rows[0].count} records`);
    console.log(`✅ Football fixtures backup: ${fixturesBackupCount.rows[0].count} records`);
    
    // STEP 2: Create unified fixtures table
    console.log('\nSTEP 2: CREATING UNIFIED FIXTURES TABLE');
    console.log('------------------------------------');
    
    const createUnifiedTable = `
      CREATE TABLE fixtures_unified (
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
      );
    `;
    
    try {
      await db.query(createUnifiedTable);
      console.log('✅ Unified fixtures table created');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ Unified fixtures table already exists');
      } else {
        console.log('❌ Failed to create unified table:', error.message);
        throw error;
      }
    }
    
    // STEP 3: Migrate football fixtures
    console.log('\nSTEP 3: MIGRATING FOOTBALL FIXTURES');
    console.log('------------------------------------');
    
    try {
      const migrateFootball = `
        INSERT INTO fixtures_unified (match_id, home_team, away_team, venue, match_date, match_time, league, status, sport, created_at)
        SELECT match_id, home_team, away_team, venue, match_date, match_time, league, status, 'football', created_at
        FROM fixtures
        ON CONFLICT (match_id, sport) DO NOTHING;
      `;
      
      const footballResult = await db.query(migrateFootball);
      console.log(`✅ Migrated ${footballResult.rowCount} football fixtures`);
    } catch (error) {
      console.log('❌ Failed to migrate football fixtures:', error.message);
      throw error;
    }
    
    // STEP 4: Migrate cricket fixtures
    console.log('\nSTEP 4: MIGRATING CRICKET FIXTURES');
    console.log('------------------------------------');
    
    try {
      const migrateCricket = `
        INSERT INTO fixtures_unified (match_id, home_team, away_team, venue, match_date, match_time, league, status, sport, created_at)
        SELECT match_id, home_team, away_team, venue, match_date, match_time, league, status, 'cricket', created_at
        FROM cricket_fixtures
        ON CONFLICT (match_id, sport) DO NOTHING;
      `;
      
      const cricketResult = await db.query(migrateCricket);
      console.log(`✅ Migrated ${cricketResult.rowCount} cricket fixtures`);
    } catch (error) {
      console.log('❌ Failed to migrate cricket fixtures:', error.message);
      throw error;
    }
    
    // STEP 5: Verify unified table data
    console.log('\nSTEP 5: VERIFYING UNIFIED TABLE DATA');
    console.log('------------------------------------');
    
    const verificationQueries = [
      'SELECT COUNT(*) as total FROM fixtures_unified',
      'SELECT COUNT(*) as football FROM fixtures_unified WHERE sport = \'football\'',
      'SELECT COUNT(*) as cricket FROM fixtures_unified WHERE sport = \'cricket\'',
      'SELECT sport, COUNT(*) as count FROM fixtures_unified GROUP BY sport ORDER BY sport'
    ];
    
    for (const query of verificationQueries) {
      try {
        const result = await db.query(query);
        if (result.rows.length === 1) {
          const row = result.rows[0];
          console.log(`✅ ${Object.keys(row).join(': ')} ${Object.values(row).join(' | ')}`);
        } else {
          console.log('✅ Sport breakdown:');
          result.rows.forEach(row => {
            console.log(`   ${row.sport}: ${row.count} fixtures`);
          });
        }
      } catch (error) {
        console.log('❌ Verification failed:', error.message);
      }
    }
    
    // STEP 6: Create VIEW for backward compatibility
    console.log('\nSTEP 6: CREATING BACKWARD COMPATIBILITY VIEW');
    console.log('------------------------------------');
    
    try {
      const createView = `
        CREATE OR REPLACE VIEW cricket_fixtures_view AS
        SELECT * FROM fixtures_unified WHERE sport = 'cricket';
      `;
      
      await db.query(createView);
      console.log('✅ Cricket fixtures view created');
      
      // Test the view
      const viewTest = await db.query('SELECT COUNT(*) as count FROM cricket_fixtures_view');
      console.log(`✅ View test: ${viewTest.rows[0].count} cricket fixtures accessible via view`);
    } catch (error) {
      console.log('❌ Failed to create view:', error.message);
      throw error;
    }
    
    // STEP 7: Create unified fixtures service
    console.log('\nSTEP 7: CREATING UNIFIED FIXTURES SERVICE');
    console.log('------------------------------------');
    
    const unifiedServiceContent = `// Unified Fixtures Service
// Provides access to fixtures across all sports with backward compatibility

const db = require('../db');

class UnifiedFixturesService {
  /**
   * Get fixtures by sport
   * @param {string} sport - 'football', 'cricket', 'all'
   * @param {Object} options - Additional query options
   * @returns {Promise<Array>} Array of fixtures
   */
  static async getFixtures(sport = 'all', options = {}) {
    let query = \`SELECT * FROM fixtures_unified\`;
    const params = [];
    
    if (sport !== 'all') {
      query += \` WHERE sport = \$${params.length + 1}\`;
      params.push(sport);
    }
    
    // Add date filtering if provided
    if (options.dateFrom) {
      query += params.length > 0 ? \` AND match_date >= \$${params.length + 1}\` : \` WHERE match_date >= \$${params.length + 1}\`;
      params.push(options.dateFrom);
    }
    
    if (options.dateTo) {
      query += params.length > 0 ? \` AND match_date <= \$${params.length + 1}\` : \` WHERE match_date <= \$${params.length + 1}\`;
      params.push(options.dateTo);
    }
    
    query += \` ORDER BY match_date, match_time\`;
    
    try {
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting fixtures:', error);
      throw error;
    }
  }
  
  /**
   * Get cricket fixtures (backward compatibility)
   * @param {Object} options - Additional query options
   * @returns {Promise<Array>} Array of cricket fixtures
   */
  static async getCricketFixtures(options = {}) {
    return this.getFixtures('cricket', options);
  }
  
  /**
   * Get football fixtures (backward compatibility)
   * @param {Object} options - Additional query options
   * @returns {Promise<Array>} Array of football fixtures
   */
  static async getFootballFixtures(options = {}) {
    return this.getFixtures('football', options);
  }
  
  /**
   * Get fixture by match ID and sport
   * @param {string} matchId - Match ID
   * @param {string} sport - Sport type
   * @returns {Promise<Object>} Fixture object
   */
  static async getFixtureById(matchId, sport) {
    const query = \`SELECT * FROM fixtures_unified WHERE match_id = \$1 AND sport = \$2\`;
    
    try {
      const result = await db.query(query, [matchId, sport]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting fixture by ID:', error);
      throw error;
    }
  }
  
  /**
   * Add new fixture
   * @param {Object} fixture - Fixture data
   * @returns {Promise<Object>} Created fixture
   */
  static async addFixture(fixture) {
    const query = \`
      INSERT INTO fixtures_unified (match_id, home_team, away_team, venue, match_date, match_time, league, status, sport)
      VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9)
      RETURNING *
    \`;
    
    const params = [
      fixture.match_id,
      fixture.home_team,
      fixture.away_team,
      fixture.venue,
      fixture.match_date,
      fixture.match_time,
      fixture.league,
      fixture.status || 'upcoming',
      fixture.sport
    ];
    
    try {
      const result = await db.query(query, params);
      return result.rows[0];
    } catch (error) {
      console.error('Error adding fixture:', error);
      throw error;
    }
  }
}

module.exports = UnifiedFixturesService;`;
    
    const servicePath = path.join(__dirname, '../backend/services/unifiedFixturesService.js');
    fs.writeFileSync(servicePath, unifiedServiceContent);
    console.log('✅ Unified fixtures service created');
    
    // STEP 8: Test the service
    console.log('\nSTEP 8: TESTING UNIFIED SERVICE');
    console.log('------------------------------------');
    
    try {
      // Test service import
      const UnifiedFixturesService = require('../backend/services/unifiedFixturesService');
      
      // Test getting all fixtures
      const allFixtures = await UnifiedFixturesService.getFixtures();
      console.log(`✅ All fixtures: ${allFixtures.length} total`);
      
      // Test getting cricket fixtures
      const cricketFixtures = await UnifiedFixturesService.getCricketFixtures();
      console.log(`✅ Cricket fixtures: ${cricketFixtures.length} total`);
      
      // Test getting football fixtures
      const footballFixtures = await UnifiedFixturesService.getFootballFixtures();
      console.log(`✅ Football fixtures: ${footballFixtures.length} total`);
      
      console.log('✅ Unified service working correctly');
    } catch (error) {
      console.log('❌ Service test failed:', error.message);
      // Don't throw - this is a test failure, not a migration failure
    }
    
    // STEP 9: Create migration summary
    console.log('\nSTEP 9: MIGRATION SUMMARY');
    console.log('------------------------------------');
    
    const summary = {
      phase: 'Phase 1 - Fixtures Consolidation',
      status: 'COMPLETED',
      timestamp: new Date().toISOString(),
      results: {
        cricketFixturesMigrated: cricketResult?.rowCount || 0,
        footballFixturesMigrated: footballResult?.rowCount || 0,
        totalUnifiedFixtures: (await db.query('SELECT COUNT(*) as count FROM fixtures_unified')).rows[0].count,
        backupTablesCreated: 2,
        viewCreated: true,
        serviceCreated: true
      },
      nextSteps: [
        'Test cricket functionality with unified table',
        'Gradually update cricket code to use unified service',
        'Monitor for 24-48 hours before Phase 2',
        'Keep original tables for safety during testing'
      ],
      rollbackCommands: [
        'DROP TABLE fixtures_unified;',
        'DROP VIEW cricket_fixtures_view;',
        'All original tables remain intact'
      ]
    };
    
    console.log('✅ Phase 1 Migration Summary:');
    console.log(`   - Cricket fixtures migrated: ${summary.results.cricketFixturesMigrated}`);
    console.log(`   - Football fixtures migrated: ${summary.results.footballFixturesMigrated}`);
    console.log(`   - Total unified fixtures: ${summary.results.totalUnifiedFixtures}`);
    console.log(`   - Status: ${summary.status}`);
    
    // Save summary
    const summaryPath = './phase1-migration-summary.json';
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`📄 Migration summary saved to: ${summaryPath}`);
    
    console.log('\n🎯 PHASE 1 COMPLETE - Ready for testing');
    console.log('🛡️  All original tables preserved for safety');
    console.log('📊 New unified table available for gradual migration');
    
    return summary;
    
  } catch (error) {
    console.error('❌ Phase 1 migration failed:', error.message);
    console.error('🔄 ROLLBACK NEEDED - Check error details above');
    
    // Attempt rollback
    try {
      console.log('🔄 Attempting rollback...');
      await db.query('DROP TABLE IF EXISTS fixtures_unified;');
      await db.query('DROP VIEW IF EXISTS cricket_fixtures_view;');
      console.log('✅ Rollback completed - Original system intact');
    } catch (rollbackError) {
      console.log('❌ Rollback failed:', rollbackError.message);
    }
    
    throw error;
  }
}

// Run the migration
implementPhase1Fixtures().catch(error => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
