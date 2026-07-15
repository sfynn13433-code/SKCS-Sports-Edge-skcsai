const express = require('express');
const aiPipelineOrchestrator = require('../services/aiPipelineOrchestrator');
const contextEnrichmentService = require('../services/contextEnrichmentService');
const { requireSupabaseUser } = require('../middleware/supabaseJwt');
const { requireSchedulerSecret } = require('../utils/auth');
const { runPipelineForMatches } = require('../services/aiPipeline');
const { buildLiveData } = require('../services/dataProvider');
const { upsertCanonicalEvents } = require('../services/canonicalEvents');
const { resolveActiveDeploymentSports } = require('../config/activeSports');
const { executeOperation } = require('../core/executionPipeline');

const router = express.Router();

// Trigger fixture sync (for external scheduler)
router.post('/trigger-fixture-sync', requireSchedulerSecret, async (req, res) => {
  try {
    console.log('Fixture sync triggered via API');
    const result = await executeOperation({
      operation: 'scheduler.fixture-sync',
      caller: 'backend/routes/scheduler.js',
      payload: { source: 'api' },
      execute: async () => fetch(`${process.env.SUPABASE_URL}/functions/v1/scheduledFixtureSync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        }
      })
    });

    if (result?.success === false) {
      return res.status(503).json({
        success: false,
        error: result.reason || result.error || 'fixture_sync_blocked',
        traceId: result.traceId || result.trace_id || null
      });
    }

    const data = await result.result.json();

    res.json({
      success: true,
      message: 'Fixture sync triggered',
      data
    });
    
  } catch (error) {
    console.error('Fixture sync trigger error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Trigger context enrichment processing
router.post('/trigger-context-enrichment', requireSchedulerSecret, async (req, res) => {
  try {
    console.log('Context enrichment triggered via API');
    const result = await executeOperation({
      operation: 'scheduler.context-enrichment',
      caller: 'backend/routes/scheduler.js',
      payload: { source: 'api' },
      execute: async () => contextEnrichmentService.processEnrichmentQueue()
    });
    if (result?.success === false) {
      return res.status(503).json({
        success: false,
        error: result.reason || result.error || 'context_enrichment_blocked',
        traceId: result.traceId || result.trace_id || null
      });
    }
    
    res.json({
      success: true,
      message: 'Context enrichment processing triggered'
    });
    
  } catch (error) {
    console.error('Context enrichment trigger error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Trigger SportSRC health & capability discovery
router.post('/trigger-sportsrc-health', requireSchedulerSecret, async (req, res) => {
  try {
    console.log('SportSRC health check triggered via API');
    const sportsrcHealthService = require('../services/sportsrcHealthService');
    
    // Run both jobs concurrently
    const [health, sports] = await Promise.all([
        sportsrcHealthService.checkAccountHealth(),
        sportsrcHealthService.discoverCapabilities()
    ]);

    res.json({
      success: true,
      message: 'SportSRC health and capability discovery completed',
      data: {
          health,
          capabilities: sports
      }
    });
    
  } catch (error) {
    console.error('SportSRC health trigger error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

async function runSchedulerAiPipeline(sport = null) {
    const sportsToProcess = sport ? [sport] : await getActiveSports();
    const results = [];

    for (const currentSport of sportsToProcess) {
      try {
        console.log(`[scheduler] Processing sport: ${currentSport}`);

        const rawMatches = await executeOperation({
          operation: 'scheduler.ai-pipeline.fetch',
          caller: 'backend/routes/scheduler.js',
          payload: { sport: currentSport },
          execute: async () => buildLiveData({
            sport: currentSport,
            windowDays: 7
          })
        });
        if (rawMatches?.success === false) {
          results.push({ sport: currentSport, status: 'blocked', error: rawMatches.reason || rawMatches.error || 'fetch_blocked' });
          continue;
        }

        if (!rawMatches.result || rawMatches.result.length === 0) {
          console.log(`[scheduler] No fixtures found for ${currentSport}`);
          results.push({ sport: currentSport, status: 'no_fixtures', matchesProcessed: 0 });
          continue;
        }

        await executeOperation({
          operation: 'scheduler.ai-pipeline.upsert',
          caller: 'backend/routes/scheduler.js',
          payload: { sport: currentSport, matches: rawMatches.result.length },
          execute: async () => upsertCanonicalEvents(rawMatches.result)
        });

        console.log(`[scheduler] Found ${rawMatches.result.length} matches for ${currentSport}. Running AI Analysis...`);

        const pipelineResult = await executeOperation({
          operation: 'scheduler.ai-pipeline.run',
          caller: 'backend/routes/scheduler.js',
          payload: {
            sport: currentSport,
            matches: rawMatches.result.length
          },
          execute: async () => runPipelineForMatches({
            matches: rawMatches.result,
            telemetry: {
              run_id: Date.now(),
              sport: currentSport,
              trigger_source: 'scheduler_api'
            }
          })
        });
        if (pipelineResult?.success === false) {
          results.push({ sport: currentSport, status: 'blocked', error: pipelineResult.reason || pipelineResult.error || 'pipeline_blocked' });
          continue;
        }

        results.push({
          sport: currentSport,
          status: 'success',
          matchesProcessed: rawMatches.result.length,
          pipelineResult: pipelineResult.result
        });

      } catch (sportError) {
        console.error(`[scheduler] Failed to process ${currentSport}:`, sportError.message);
        results.push({
          sport: currentSport,
          status: 'error',
          error: sportError.message
        });
      }
    }

    return results;
}

// Trigger full AI pipeline (using same function as syncService)
router.post('/trigger-ai-pipeline', requireSchedulerSecret, (req, res) => {
  const { sport } = req.body || {};

  console.log(`AI pipeline triggered via scheduler${sport ? ` for sport: ${sport}` : ' for all sports'}`);

  res.status(202).json({
    success: true,
    message: 'AI pipeline started in background',
    sport: sport || 'all'
  });

  setImmediate(() => {
    runSchedulerAiPipeline(sport)
      .then((results) => {
        console.log('[scheduler] AI pipeline background run complete:', JSON.stringify(results));
      })
      .catch((error) => {
        console.error('[scheduler] AI pipeline background run failed:', error.message);
      });
  });
});

// Helper function to get active sports (use configured sports instead of database query)
function getActiveSports() {
  return Array.from(resolveActiveDeploymentSports());
}

// Get scheduler status
router.get('/status', async (req, res) => {
  try {
    const { query } = require('../database');
    
    // Get recent runs
    const { rows: recentRuns } = await query(`
      SELECT 
        id,
        trigger_source,
        run_scope,
        status,
        started_at,
        completed_at,
        error_message,
        metadata
      FROM prediction_publish_runs
      ORDER BY started_at DESC
      LIMIT 10
    `);
    
    // Get sport sync status
    const { rows: sportSyncStatus } = await query(`
      SELECT 
        sport,
        enabled,
        last_sync_at,
        sync_interval_minutes
      FROM sport_sync
      ORDER BY sport
    `);
    
    // Get context enrichment queue status
    const { rows: queueStatus } = await query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM context_enrichment_queue
      GROUP BY status
      ORDER BY status
    `);
    
    // Get sportsrc account health telemetry
    const { rows: sportsrcHealth } = await query(`
      SELECT 
        checked_at,
        plan,
        daily_limit,
        remaining,
        reset_time,
        status
      FROM sportsrc_account_health
      ORDER BY checked_at DESC
      LIMIT 1
    `);

    res.json({
      success: true,
      data: {
        recent_runs: recentRuns,
        sport_sync_status: sportSyncStatus,
        context_queue_status: queueStatus,
        sportsrc_health: sportsrcHealth[0] || null,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Scheduler status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check for scheduler
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'SKCS AI Scheduler'
  });
});

module.exports = router;
