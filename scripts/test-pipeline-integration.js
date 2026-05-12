const { query } = require('../backend/database');
const axios = require('axios');

class PipelineIntegrationTest {
  constructor() {
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:10000';
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  async runFullTest() {
    console.log('=== SKCS AI Pipeline Integration Test ===');
    
    try {
      // Test 1: Database connectivity
      await this.testDatabaseConnectivity();
      
      // Test 2: Sport sync configuration
      await this.testSportSyncConfiguration();
      
      // Test 3: Football adapter
      await this.testFootballAdapter();
      
      // Test 4: Context enrichment
      await this.testContextEnrichment();
      
      // Test 5: AI pipeline orchestration
      await this.testAIPipelineOrchestration();
      
      // Test 6: End-to-end flow
      await this.testEndToEndFlow();
      
      console.log('\n=== All Tests Completed Successfully ===');
      
    } catch (error) {
      console.error('\n=== Pipeline Test Failed ===');
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
      process.exit(1);
    }
  }

  async testDatabaseConnectivity() {
    console.log('\n1. Testing Database Connectivity...');
    
    try {
      const { rows } = await query('SELECT NOW() as current_time');
      console.log('✅ Database connected:', rows[0].current_time);
      
      // Test sport_sync table exists
      const { rows: sportTables } = await query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'sport_sync'
      `);
      
      if (sportTables.length > 0) {
        console.log('✅ sport_sync table exists');
      } else {
        throw new Error('sport_sync table not found');
      }
      
    } catch (error) {
      throw new Error(`Database connectivity test failed: ${error.message}`);
    }
  }

  async testSportSyncConfiguration() {
    console.log('\n2. Testing Sport Sync Configuration...');
    
    try {
      const { rows: sports } = await query(`
        SELECT sport, adapter_name, enabled, sync_interval_minutes 
        FROM sport_sync 
        WHERE enabled = true 
        ORDER BY sport
        LIMIT 5
      `);
      
      console.log(`✅ Found ${sports.length} enabled sports:`);
      sports.forEach(sport => {
        console.log(`   - ${sport.sport}: ${sport.adapter_name} (${sport.sync_interval_minutes}min)`);
      });
      
      if (sports.length === 0) {
        throw new Error('No enabled sports found in sport_sync table');
      }
      
    } catch (error) {
      throw new Error(`Sport sync configuration test failed: ${error.message}`);
    }
  }

  async testFootballAdapter() {
    console.log('\n3. Testing Football Adapter...');
    
    try {
      // Test adapter loading
      const { loadAdapter } = require('../backend/adapters/index');
      const footballAdapter = loadAdapter('footballAdapter');
      
      if (!footballAdapter) {
        throw new Error('Failed to load football adapter');
      }
      
      console.log('✅ Football adapter loaded successfully');
      
      // Test fixture fetching (small date range)
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000); // 1 day
      
      const fixtures = await footballAdapter.fetchFixtures(startDate, endDate);
      
      if (!Array.isArray(fixtures)) {
        throw new Error('Adapter did not return an array');
      }
      
      console.log(`✅ Football adapter returned ${fixtures.length} fixtures`);
      
      if (fixtures.length > 0) {
        const sampleFixture = fixtures[0];
        const requiredFields = ['id_event', 'sport', 'league_id', 'home_team_id', 'away_team_id', 'start_time'];
        
        for (const field of requiredFields) {
          if (!sampleFixture[field]) {
            throw new Error(`Missing required field: ${field}`);
          }
        }
        
        console.log('✅ Fixture structure validation passed');
        console.log(`   Sample: ${sampleFixture.id_event} - ${sampleFixture.home_team_id} vs ${sampleFixture.away_team_id}`);
      }
      
    } catch (error) {
      throw new Error(`Football adapter test failed: ${error.message}`);
    }
  }

  async testContextEnrichment() {
    console.log('\n4. Testing Context Enrichment...');
    
    try {
      // Check if context_enrichment_queue table exists
      const { rows: queueTables } = await query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'context_enrichment_queue'
      `);
      
      if (queueTables.length === 0) {
        throw new Error('context_enrichment_queue table not found');
      }
      
      console.log('✅ Context enrichment queue table exists');
      
      // Test context enrichment service
      const contextEnrichmentService = require('../backend/services/contextEnrichmentService');
      
      // Create a test fixture in raw_fixtures
      const testFixture = {
        id_event: 'TEST_FOOTBALL_2026-05-12_TEST',
        sport: 'football',
        league_id: 'LEAGUE_TEST',
        home_team_id: 'TEAM_HOME_TEST',
        away_team_id: 'TEAM_AWAY_TEST',
        start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        raw_json: { test: true }
      };
      
      const { rows: upsertResult } = await query(`
        SELECT * FROM upsert_raw_fixture(
          $1, $2, $3, $4, $5, $6, $7
        )
      `, [
        testFixture.id_event,
        testFixture.sport,
        testFixture.league_id,
        testFixture.home_team_id,
        testFixture.away_team_id,
        testFixture.start_time,
        testFixture.raw_json
      ]);
      
      console.log('✅ Test fixture created:', upsertResult[0]);
      
      // Add to enrichment queue
      await query(`
        INSERT INTO context_enrichment_queue (id_event, sport, action, status, priority)
        VALUES ($1, $2, 'enrich', 'pending', 1)
        ON CONFLICT (id_event) DO UPDATE SET
          action = EXCLUDED.action,
          status = 'pending',
          priority = EXCLUDED.priority
      `, [testFixture.id_event, testFixture.sport]);
      
      console.log('✅ Test fixture added to enrichment queue');
      
    } catch (error) {
      throw new Error(`Context enrichment test failed: ${error.message}`);
    }
  }

  async testAIPipelineOrchestration() {
    console.log('\n5. Testing AI Pipeline Orchestration...');
    
    try {
      const aiPipelineOrchestrator = require('../backend/services/aiPipelineOrchestrator');
      
      // Test with a single sport to avoid long execution
      const result = await aiPipelineOrchestrator.runFullPipeline(['football'], 'TEST_1_DAY');
      
      if (!result.success) {
        throw new Error('AI pipeline orchestration returned failure');
      }
      
      console.log('✅ AI pipeline orchestration test passed');
      console.log(`   Publish run ID: ${result.publishRunId}`);
      
      if (result.sportResults) {
        result.sportResults.forEach(sportResult => {
          if (sportResult.success) {
            console.log(`   ✅ ${sportResult.sport}: ${sportResult.result?.successful_predictions || 0} predictions`);
          } else {
            console.log(`   ❌ ${sportResult.sport}: ${sportResult.error}`);
          }
        });
      }
      
    } catch (error) {
      throw new Error(`AI pipeline orchestration test failed: ${error.message}`);
    }
  }

  async testEndToEndFlow() {
    console.log('\n6. Testing End-to-End Flow...');
    
    try {
      // Trigger scheduler endpoints
      const schedulerEndpoints = [
        '/api/scheduler/trigger-fixture-sync',
        '/api/scheduler/trigger-context-enrichment',
        '/api/scheduler/trigger-ai-pipeline'
      ];
      
      for (const endpoint of schedulerEndpoints) {
        try {
          const response = await axios.post(`${this.backendUrl}${endpoint}`, {
            timeout: 30000
          });
          
          if (response.data.success) {
            console.log(`✅ ${endpoint} triggered successfully`);
          } else {
            console.log(`⚠️  ${endpoint} returned:`, response.data);
          }
          
        } catch (error) {
          console.log(`❌ ${endpoint} failed:`, error.message);
        }
      }
      
      // Check scheduler status
      const statusResponse = await axios.get(`${this.backendUrl}/api/scheduler/status`, {
        timeout: 10000
      });
      
      if (statusResponse.data.success) {
        console.log('✅ Scheduler status endpoint working');
        console.log(`   Recent runs: ${statusResponse.data.data.recent_runs?.length || 0}`);
        console.log(`   Active sports: ${statusResponse.data.data.sport_sync_status?.length || 0}`);
      }
      
    } catch (error) {
      throw new Error(`End-to-end flow test failed: ${error.message}`);
    }
  }

  async cleanupTestData() {
    console.log('\nCleaning up test data...');
    
    try {
      await query('DELETE FROM context_enrichment_queue WHERE id_event LIKE \'TEST_%\'');
      await query('DELETE FROM raw_fixtures WHERE id_event LIKE \'TEST_%\'');
      await query('DELETE FROM match_context_data WHERE id_event LIKE \'TEST_%\'');
      
      console.log('✅ Test data cleaned up');
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new PipelineIntegrationTest();
  
  tester.runFullTest()
    .then(() => {
      console.log('\n=== Pipeline Integration Test Completed ===');
      return tester.cleanupTestData();
    })
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n=== Pipeline Integration Test Failed ===');
      console.error(error);
      process.exit(1);
    });
}

module.exports = PipelineIntegrationTest;
