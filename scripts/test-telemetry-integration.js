const { query } = require('../backend/database');
const axios = require('axios');

class TelemetryIntegrationTest {
  constructor() {
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:10000';
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  async runFullTest() {
    console.log('=== SKCS AI Telemetry Integration Test ===');
    
    try {
      // Test 1: Database connectivity and table existence
      await this.testTelemetryTables();
      
      // Test 2: RPC function functionality
      await this.testRPCFunction();
      
      // Test 3: Admin views functionality
      await this.testAdminViews();
      
      // Test 4: Odds snapshots functionality
      await this.testOddsSnapshots();
      
      // Test 5: End-to-end telemetry flow
      await this.testEndToEndTelemetry();
      
      console.log('\n=== All Telemetry Tests Completed Successfully ===');
      
    } catch (error) {
      console.error('\n=== Telemetry Test Failed ===');
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
      process.exit(1);
    }
  }

  async testTelemetryTables() {
    console.log('\n1. Testing Telemetry Tables...');
    
    try {
      // Test fixture_processing_log table
      const { rows: fplTables } = await query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'fixture_processing_log'
      `);
      
      if (fplTables.length === 0) {
        throw new Error('fixture_processing_log table not found');
      }
      console.log('✅ fixture_processing_log table exists');

      // Test event_odds_snapshots table
      const { rows: eosTables } = await query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'event_odds_snapshots'
      `);
      
      if (eosTables.length === 0) {
        throw new Error('event_odds_snapshots table not found');
      }
      console.log('✅ event_odds_snapshots table exists');

      // Check unique constraint
      const { rows: constraints } = await query(`
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'fixture_processing_log' 
          AND constraint_type = 'UNIQUE'
      `);
      
      const uniqueConstraint = constraints.find(c => c.constraint_name === 'uq_fpl_event_run');
      if (!uniqueConstraint) {
        throw new Error('uq_fpl_event_run unique constraint not found');
      }
      console.log('✅ Unique constraint exists');

    } catch (error) {
      throw new Error(`Telemetry tables test failed: ${error.message}`);
    }
  }

  async testRPCFunction() {
    console.log('\n2. Testing RPC Function...');
    
    try {
      // Test RPC function exists
      const { rows: functions } = await query(`
        SELECT routine_name FROM information_schema.routines
        WHERE routine_name = 'update_fixture_processing_log'
          AND routine_schema = 'public'
      `);
      
      if (functions.length === 0) {
        throw new Error('update_fixture_processing_log RPC function not found');
      }
      console.log('✅ RPC function exists');

      // Test RPC function with a test event
      const testEventId = 'TEST_TELEMETRY_' + Date.now();
      const testRunId = 999999; // Use a high number for testing
      
      // Test ingestion_started phase
      await query(`
        SELECT update_fixture_processing_log(
          $1, $2, 'ingestion_started', NULL, NULL, 'football'
        )
      `, [testEventId, testRunId]);

      // Verify row was created
      const { rows: logs } = await query(`
        SELECT * FROM fixture_processing_log 
        WHERE id_event = $1 AND publish_run_id = $2
      `, [testEventId, testRunId]);

      if (logs.length === 0) {
        throw new Error('RPC function did not create log entry');
      }

      const log = logs[0];
      if (!log.ingestion_started_at) {
        throw new Error('ingestion_started_at not set');
      }

      console.log('✅ RPC function creates entries correctly');

      // Test completion phase
      await query(`
        SELECT update_fixture_processing_log(
          $1, $2, 'ingestion_completed', NULL, NULL, NULL
        )
      `, [testEventId, testRunId]);

      // Verify completion
      const { rows: updatedLogs } = await query(`
        SELECT ingestion_completed_at FROM fixture_processing_log 
        WHERE id_event = $1 AND publish_run_id = $2
      `, [testEventId, testRunId]);

      if (!updatedLogs[0].ingestion_completed_at) {
        throw new Error('ingestion_completed_at not set');
      }

      console.log('✅ RPC function updates entries correctly');

      // Cleanup test data
      await query(`
        DELETE FROM fixture_processing_log 
        WHERE id_event = $1 AND publish_run_id = $2
      `, [testEventId, testRunId]);

    } catch (error) {
      throw new Error(`RPC function test failed: ${error.message}`);
    }
  }

  async testAdminViews() {
    console.log('\n3. Testing Admin Views...');
    
    try {
      const views = [
        'admin_pipeline_health',
        'admin_stale_odds',
        'admin_sync_status',
        'admin_ai_suppression',
        'admin_processing_times',
        'admin_recent_failures',
        'admin_suppression_reasons',
        'admin_daily_volume'
      ];

      for (const viewName of views) {
        const { rows: viewCheck } = await query(`
          SELECT table_name FROM information_schema.views 
          WHERE table_name = $1 AND table_schema = 'public'
        `, [viewName]);

        if (viewCheck.length === 0) {
          throw new Error(`Admin view ${viewName} not found`);
        }

        // Test view query
        await query(`SELECT * FROM ${viewName} LIMIT 1`);
        console.log(`✅ ${viewName} view works`);
      }

    } catch (error) {
      throw new Error(`Admin views test failed: ${error.message}`);
    }
  }

  async testOddsSnapshots() {
    console.log('\n4. Testing Odds Snapshots...');
    
    try {
      // Test get_odds_volatility function
      const { rows: functions } = await query(`
        SELECT routine_name FROM information_schema.routines
        WHERE routine_name = 'get_odds_volatility'
          AND routine_schema = 'public'
      `);

      if (functions.length === 0) {
        throw new Error('get_odds_volatility function not found');
      }

      console.log('✅ get_odds_volatility function exists');

      // Test cleanup function
      const { rows: cleanupFunctions } = await query(`
        SELECT routine_name FROM information_schema.routines
        WHERE routine_name = 'cleanup_old_odds_snapshots'
          AND routine_schema = 'public'
      `);

      if (cleanupFunctions.length === 0) {
        throw new Error('cleanup_old_odds_snapshots function not found');
      }

      console.log('✅ cleanup_old_odds_snapshots function exists');

      // Test inserting a snapshot
      const testEventId = 'TEST_ODDS_' + Date.now();
      const testOdds = {
        bet365: { home_win: 2.1, draw: 3.2, away_win: 3.8 },
        betmgm: { home_win: 2.05, draw: 3.25, away_win: 3.9 }
      };

      await query(`
        INSERT INTO event_odds_snapshots (id_event, odds, source)
        VALUES ($1, $2, 'test')
      `, [testEventId, JSON.stringify(testOdds)]);

      // Verify snapshot
      const { rows: snapshots } = await query(`
        SELECT * FROM event_odds_snapshots WHERE id_event = $1
      `, [testEventId]);

      if (snapshots.length === 0) {
        throw new Error('Odds snapshot not inserted');
      }

      console.log('✅ Odds snapshots insertion works');

      // Test volatility function
      const { rows: volatility } = await query(`
        SELECT * FROM get_odds_volatility($1, 1)
      `, [testEventId]);

      if (volatility.length === 0) {
        throw new Error('get_odds_volatility returned no results');
      }

      console.log('✅ get_odds_volatility function works');

      // Cleanup test data
      await query(`
        DELETE FROM event_odds_snapshots WHERE id_event = $1
      `, [testEventId]);

    } catch (error) {
      throw new Error(`Odds snapshots test failed: ${error.message}`);
    }
  }

  async testEndToEndTelemetry() {
    console.log('\n5. Testing End-to-End Telemetry Flow...');
    
    try {
      // Create a test publish run
      const { rows: [publishRun] } = await query(`
        INSERT INTO prediction_publish_runs (
          trigger_source, run_scope, requested_sports, status, metadata
        ) VALUES (
          'telemetry_test', 'TEST_1_DAY', '["football"]', 'running', $1
        ) RETURNING id
      `, [JSON.stringify({
        test: true,
        timestamp: new Date().toISOString()
      })]);

      const testRunId = publishRun.id;
      console.log(`Created test publish run: ${testRunId}`);

      // Create a test fixture
      const testEventId = 'TEST_TELEMETRY_E2E_' + Date.now();
      
      // Step 1: Ingestion started
      await query(`
        SELECT update_fixture_processing_log(
          $1, $2, 'ingestion_started', NULL, NULL, 'football'
        )
      `, [testEventId, testRunId]);

      // Step 2: Ingestion completed
      await query(`
        SELECT update_fixture_processing_log(
          $1, $2, 'ingestion_completed', NULL, NULL, NULL
        )
      `, [testEventId, testRunId]);

      // Step 3: Enrichment completed
      await query(`
        SELECT update_fixture_processing_log(
          $1, $2, 'enrichment_completed', NULL, NULL, NULL
        )
      `, [testEventId, testRunId]);

      // Step 4: AI completed
      await query(`
        SELECT update_fixture_processing_log(
          $1, $2, 'ai_completed', NULL, NULL, NULL
        )
      `, [testEventId, testRunId]);

      // Step 5: Publication completed
      await query(`
        SELECT update_fixture_processing_log(
          $1, $2, 'publication_completed', NULL, NULL, NULL
        )
      `, [testEventId, testRunId]);

      // Step 6: ACCA processed
      await query(`
        SELECT update_fixture_processing_log(
          $1, $2, 'acca_processed', NULL, NULL, NULL
        )
      `, [testEventId, testRunId]);

      // Verify all timestamps are set
      const { rows: [logEntry] } = await query(`
        SELECT 
          ingestion_started_at,
          ingestion_completed_at,
          enrichment_completed_at,
          ai_completed_at,
          publication_completed_at,
          acca_processed_at
        FROM fixture_processing_log 
        WHERE id_event = $1 AND publish_run_id = $2
      `, [testEventId, testRunId]);

      const requiredFields = [
        'ingestion_started_at',
        'ingestion_completed_at',
        'enrichment_completed_at',
        'ai_completed_at',
        'publication_completed_at',
        'acca_processed_at'
      ];

      for (const field of requiredFields) {
        if (!logEntry[field]) {
          throw new Error(`${field} not set in telemetry log`);
        }
      }

      console.log('✅ All telemetry phases logged correctly');

      // Test admin views with our test data
      const { rows: pipelineHealth } = await query(`
        SELECT * FROM admin_pipeline_health WHERE sport = 'football'
      `);

      if (pipelineHealth.length === 0) {
        throw new Error('admin_pipeline_health view not showing test data');
      }

      console.log('✅ Admin views reflect test data');

      // Test suppression scenario
      const suppressionEventId = 'TEST_SUPPRESSION_' + Date.now();
      
      await query(`
        SELECT update_fixture_processing_log(
          $1, $2, 'ingestion_started', NULL, NULL, 'football'
        )
      `, [suppressionEventId, testRunId]);

      await query(`
        SELECT update_fixture_processing_log(
          $1, $2, 'publication_completed', 'Low confidence', NULL, NULL
        )
      `, [suppressionEventId, testRunId]);

      const { rows: [suppressionLog] } = await query(`
        SELECT suppression_reason FROM fixture_processing_log 
        WHERE id_event = $1 AND publish_run_id = $2
      `, [suppressionEventId, testRunId]);

      if (!suppressionLog.suppression_reason) {
        throw new Error('Suppression reason not logged');
      }

      console.log('✅ Suppression logging works');

      // Cleanup test data
      await query(`
        DELETE FROM fixture_processing_log 
        WHERE id_event LIKE 'TEST_%' AND publish_run_id = $1
      `, [testRunId]);

      await query(`
        DELETE FROM prediction_publish_runs WHERE id = $1
      `, [testRunId]);

      console.log('✅ Test data cleaned up');

    } catch (error) {
      throw new Error(`End-to-end telemetry test failed: ${error.message}`);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new TelemetryIntegrationTest();
  
  tester.runFullTest()
    .then(() => {
      console.log('\n=== Telemetry Integration Test Completed ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n=== Telemetry Integration Test Failed ===');
      console.error(error);
      process.exit(1);
    });
}

module.exports = TelemetryIntegrationTest;
