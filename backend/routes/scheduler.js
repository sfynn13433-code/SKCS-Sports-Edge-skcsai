const express = require('express');
const aiPipelineOrchestrator = require('../services/aiPipelineOrchestrator');
const contextEnrichmentService = require('../services/contextEnrichmentService');
const { requireSupabaseUser } = require('../middleware/supabaseJwt');
const { runPipelineForMatches } = require('../services/aiPipeline');
const { buildLiveData } = require('../services/dataProvider');
const { upsertCanonicalEvents } = require('../services/canonicalEvents');

const router = express.Router();

// Trigger fixture sync (for external scheduler)
router.post('/trigger-fixture-sync', async (req, res) => {
  try {
    console.log('Fixture sync triggered via API');
    
    // This would be called by external cron service
    const result = await fetch(`${process.env.SUPABASE_URL}/functions/v1/scheduledFixtureSync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await result.json();
    
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
router.post('/trigger-context-enrichment', async (req, res) => {
  try {
    console.log('Context enrichment triggered via API');
    
    await contextEnrichmentService.processEnrichmentQueue();
    
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

// Admin key validation middleware
const requireAdminKey = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  const validKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    return res.status(401).json({ error: 'Missing x-admin-key header' });
  }

  if (adminKey !== validKey) {
    return res.status(403).json({ error: 'Invalid admin key' });
  }

  next();
};

// Trigger full AI pipeline (using same function as syncService)
router.post('/trigger-ai-pipeline', requireAdminKey, async (req, res) => {
  try {
    const { sport } = req.body;

    console.log(`AI pipeline triggered via scheduler${sport ? ` for sport: ${sport}` : ' for all sports'}`);

    const sportsToProcess = sport ? [sport] : await getActiveSports();
    const results = [];

    for (const currentSport of sportsToProcess) {
      try {
        console.log(`[scheduler] Processing sport: ${currentSport}`);

        // Fetch fixtures (same as syncService)
        const rawMatches = await buildLiveData({
          sport: currentSport,
          windowDays: 7
        });

        if (!rawMatches || rawMatches.length === 0) {
          console.log(`[scheduler] No fixtures found for ${currentSport}`);
          results.push({ sport: currentSport, status: 'no_fixtures', matchesProcessed: 0 });
          continue;
        }

        // Upsert canonical events (same as syncService)
        await upsertCanonicalEvents(rawMatches);

        console.log(`[scheduler] Found ${rawMatches.length} matches for ${currentSport}. Running AI Analysis...`);

        // Run AI pipeline (same function syncService uses)
        const pipelineResult = await runPipelineForMatches({
          matches: rawMatches,
          telemetry: {
            run_id: Date.now(),
            sport: currentSport,
            trigger_source: 'scheduler_api'
          }
        });

        results.push({
          sport: currentSport,
          status: 'success',
          matchesProcessed: rawMatches.length,
          pipelineResult
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

    res.json({
      success: true,
      message: 'AI pipeline completed',
      sportsProcessed: results
    });

  } catch (error) {
    console.error('AI pipeline trigger error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to get active sports (copied from aiPipelineOrchestrator)
async function getActiveSports() {
  const { query } = require('../database');
  const { rows } = await query(`
    SELECT DISTINCT sport
    FROM raw_fixtures
    WHERE commence_time > NOW() - INTERVAL '1 day'
  `);
  return rows.map(r => r.sport);
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
    
    res.json({
      success: true,
      data: {
        recent_runs: recentRuns,
        sport_sync_status: sportSyncStatus,
        context_queue_status: queueStatus,
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
