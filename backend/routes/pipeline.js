'use strict';

const express = require('express');
const { 
    runPipelineForMatches, 
    runPipelineFromConfiguredDataMode, 
    rebuildFinalOutputs 
} = require('../services/aiPipeline');
const { syncAllSports, syncSports } = require('../services/syncService');
const config = require('../config');
const { requireRole } = require('../utils/auth');

const router = express.Router();

async function handleSyncRequest(res, options = {}) {
    const requestedSport = options.requestedSport ? String(options.requestedSport).toLowerCase() : null;
    const waitForCompletion = options.waitForCompletion === true;
    const triggerLabel = options.triggerLabel || 'manual sync';

    console.log(`[pipeline] Starting ${triggerLabel}${requestedSport ? ` for ${requestedSport}` : ''}...`);

    const execute = () => (
        requestedSport
            ? syncSports({ sports: requestedSport })
            : syncAllSports()
    );

    if (waitForCompletion) {
        try {
            const result = await execute();

            res.status(200).json({
                ok: true,
                message: 'Sync completed successfully',
                sync: result ? 'ok' : 'no result',
                requestedSport,
                publishRun: result?.publishRun || null,
                totalMatchesProcessed: result?.totalMatchesProcessed || 0,
                perSport: result?.perSport || [],
                errors: result?.errors || [],
                rebuiltFinalOutputs: result?.rebuiltFinalOutputs || false
            });
        } catch (err) {
            console.error(`[pipeline] ${triggerLabel} failed:`, err.message);
            res.status(500).json({
                ok: false,
                error: 'Sync failed',
                details: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            });
        }
        return;
    }

    res.status(202).json({
        ok: true,
        message: 'Sync started in background. Check /api/pipeline/status for results.',
        requestedSport,
        note: 'Use wait=true to wait for completion'
    });

    try {
        const result = await execute();
        console.log('[pipeline] Background sync complete:', JSON.stringify({
            trigger: triggerLabel,
            sync: result ? 'ok' : 'no result',
            requestedSport,
            publishRun: result?.publishRun || null,
            totalMatchesProcessed: result?.totalMatchesProcessed || 0,
            errors: result?.errors || []
        }));
    } catch (err) {
        console.error(`[pipeline] Background ${triggerLabel} failed:`, err.message);
        console.error('[pipeline] Stack trace:', err.stack);
    }
}

/**
 * TRIGGER REAL DATA SYNC
 * URL: POST https://skcsai.onrender.com/api/pipeline/sync
 * This is the main button to pull real matches from APIs into Supabase.
 */
router.post('/sync', requireRole('admin'), async (req, res) => {
    const requestedSport = req.body?.sport ? String(req.body.sport).toLowerCase() : null;
    const waitForCompletion = req.body?.wait === true;

    await handleSyncRequest(res, {
        requestedSport,
        waitForCompletion,
        triggerLabel: 'manual sync of REAL sports data'
    });
});

// Run the full multi-sport weekly scrape pipeline.
// URL: POST|GET /api/pipeline/run-full
const runFullHandler = async (req, res) => {
    const waitFromBody = req.body?.wait === true;
    const waitFromQuery = String(req.query?.wait || '').toLowerCase() === 'true';

    await handleSyncRequest(res, {
        waitForCompletion: waitFromBody || waitFromQuery,
        triggerLabel: 'run-full global sync'
    });
};

router.post('/run-full', requireRole('admin'), runFullHandler);
router.get('/run-full', requireRole('admin'), runFullHandler);

/**
 * SYNC WITH DETAILED PROGRESS
 * URL: POST /api/pipeline/sync-detailed
 * Returns step-by-step progress for debugging
 */
router.post('/sync-detailed', requireRole('admin'), async (req, res) => {
    const requestedSport = req.body?.sport ? String(req.body.sport).toLowerCase() : null;
    
    console.log(`[pipeline] Starting detailed sync for: ${requestedSport || 'all sports'}`);
    
    const progress = {
        startTime: new Date().toISOString(),
        steps: [],
        final: null,
        error: null
    };

    try {
        // Step 1: Check configuration
        progress.steps.push({
            step: 1,
            action: 'Checking configuration',
            timestamp: new Date().toISOString(),
            details: {
                dataMode: config.DATA_MODE,
                hasApiSportsKey: !!process.env.X_APISPORTS_KEY,
                hasOddsApiKey: !!process.env.ODDS_API_KEY,
                hasSupabaseUrl: !!process.env.SUPABASE_URL
            }
        });

        // Step 2: Run sync
        progress.steps.push({
            step: 2,
            action: 'Running sync',
            timestamp: new Date().toISOString()
        });

        const result = requestedSport
            ? await syncSports({ sports: requestedSport })
            : await syncAllSports();

        // Step 3: Report results
        progress.steps.push({
            step: 3,
            action: 'Sync completed',
            timestamp: new Date().toISOString(),
            details: {
                totalMatchesProcessed: result?.totalMatchesProcessed || 0,
                perSport: result?.perSport || [],
                errors: result?.errors || [],
                rebuiltFinalOutputs: result?.rebuiltFinalOutputs || false
            }
        });

        progress.final = result;

        res.status(200).json({
            ok: true,
            message: 'Sync completed with detailed progress',
            progress
        });
    } catch (err) {
        progress.error = {
            message: err.message,
            timestamp: new Date().toISOString()
        };
        
        console.error('[pipeline] Detailed sync failed:', err.message);
        res.status(500).json({
            ok: false,
            error: 'Sync failed',
            progress,
            details: err.message
        });
    }
});

// Check sync status / latest data
router.get('/status', requireRole('admin'), async (_req, res) => {
    try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
        );
        const { count: rawCount } = await supabase.from('predictions_raw').select('*', { count: 'exact', head: true });
        const { count: finalCount } = await supabase.from('direct1x2_prediction_final').select('*', { count: 'exact', head: true });
        res.json({
            ok: true,
            predictions_raw: rawCount,
            predictions_final: finalCount,
            direct1x2_prediction_final: finalCount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Accept manual match data and run the full pipeline
router.post('/run', requireRole('admin'), async (req, res) => {
    try {
        const matches = req.body?.matches;
        const pipeline = Array.isArray(matches) && matches.length > 0
            ? await runPipelineForMatches({ matches })
            : await runPipelineFromConfiguredDataMode();

        if (pipeline?.error) {
            res.status(409).json({ error: pipeline.error });
            return;
        }

        const final = await rebuildFinalOutputs();

        res.status(200).json({
            mode: pipeline.mode,
            raw_count: pipeline.inserted.length,
            filtered_valid: pipeline.filtered_valid,
            filtered_invalid: pipeline.filtered_invalid,
            singles_count: (final?.normal?.singles?.length || 0) + (final?.deep?.singles?.length || 0),
            acca_count: (final?.normal?.accas?.length || 0) + (final?.deep?.accas?.length || 0)
        });
    } catch (err) {
        console.error('Pipeline error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Switch between 'test' and 'live' mode
router.post('/mode', requireRole('admin'), async (req, res) => {
    try {
        const mode = req.body?.mode;
        if (mode !== 'test' && mode !== 'live') {
            res.status(400).json({ error: 'mode must be test or live' });
            return;
        }

        config.DATA_MODE = mode;
        console.log('[pipeline] DATA_MODE set to %s', mode);

        res.status(200).json({ ok: true, mode });
    } catch (err) {
        console.error('Pipeline error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Force a rebuild of the website outputs (direct1x2_prediction_final table)
router.post('/rebuild', requireRole('admin'), async (_req, res) => {
    try {
        console.log('[pipeline] Manual rebuild of final outputs requested...');
        const final = await rebuildFinalOutputs();
        res.status(200).json({ ok: true, message: "Final outputs rebuilt successfully", data: final });
    } catch (err) {
        console.error('Pipeline rebuild error:', err);
        res.status(500).json({ error: 'Rebuild failed', details: err.message });
    }
});

module.exports = router;
