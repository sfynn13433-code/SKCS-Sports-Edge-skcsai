const express = require('express');
const aiPipelineOrchestrator = require('../services/aiPipelineOrchestrator');
const contextEnrichmentService = require('../services/contextEnrichmentService');

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

// Trigger full AI pipeline
router.post('/trigger-ai-pipeline', async (req, res) => {
  try {
    const { requestedSports, runScope } = req.body;
    
    console.log(`AI pipeline triggered for sports: ${requestedSports || 'ALL'}, scope: ${runScope || 'UPCOMING_7_DAYS'}`);
    
    const result = await aiPipelineOrchestrator.runFullPipeline(requestedSports, runScope);
    
    res.json({
      success: true,
      message: 'AI pipeline triggered',
      result
    });
    
  } catch (error) {
    console.error('AI pipeline trigger error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

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
