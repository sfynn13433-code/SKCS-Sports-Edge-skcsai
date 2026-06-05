/**
 * Cron Jobs Service
 * 
 * Schedules automated pipeline tasks:
 * 1. Daily Discovery (00:01 UTC) - Syncs daily pre-match fixtures from TheSportsDB
 * 2. Pulse Check (every 30 minutes) - Disabled in pre-match-only mode
 */

const cron = require('node-cron');
const { syncDailyFixtures, enrichMatchContext, generateEdgeMindInsight } = require('./thesportsdbPipeline');
const { apiQueue } = require('../utils/apiQueue');
const db = require('../db');
const { getExecutionConstraints } = require('../semantic-layer/governanceGatekeeper');
const { refreshPipelineHealthState } = require('./pipelineMetricsService');
const { executeOperation } = require('../core/executionPipeline');
const PRE_MATCH_ONLY_MODE = String(process.env.SKCS_PRE_MATCH_ONLY || 'true').trim() !== 'false';

/**
 * Initialize all cron jobs
 * Call this function when the server boots to start the schedules
 */
function initCronJobs() {
    console.log('[CRON] Initializing cron jobs...');

    // ── Schedule 1: Daily Discovery (00:01 UTC every day) ────────────────────────
    cron.schedule('1 0 * * *', async () => {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        console.log(`[CRON] Running Daily Discovery for ${today}`);
        const constraints = getExecutionConstraints();
        if (!constraints.proceed) {
            console.warn(`[CRON] Daily Discovery skipped due to control plane state: ${constraints.state}`);
            return;
        }
        
        try {
            const count = await executeOperation({
                operation: 'cron.dailyDiscovery',
                caller: 'backend/services/cronJobs.js',
                payload: { today },
                execute: async () => syncDailyFixtures(today)
            });
            console.log(`[CRON] Daily Discovery completed: ${count.result || 0} fixtures synced`);
        } catch (err) {
            console.error(`[CRON] Daily Discovery failed:`, err.message);
        }
    }, {
        timezone: 'UTC'
    });
    console.log('[CRON] Daily Discovery scheduled: 00:01 UTC daily');

    // ── Schedule 2: Pulse Check (every 30 minutes) ────────────────────────────────
    if (!PRE_MATCH_ONLY_MODE) {
    cron.schedule('*/30 * * * *', async () => {
        console.log(`[CRON] Running Pulse Check at ${new Date().toISOString()}`);
        const constraints = getExecutionConstraints();
        if (!constraints.proceed) {
            console.warn(`[CRON] Pulse Check skipped due to control plane state: ${constraints.state}`);
            return;
        }
        
        try {
            // Query raw_fixtures for matches within the next 72 hours
            const query = `
                SELECT id_event, start_time, home_team_id, away_team_id
                FROM raw_fixtures
                WHERE start_time >= NOW()
                  AND start_time <= NOW() + INTERVAL '72 hours'
                  AND (
                    LOWER(COALESCE(sport, '')) IN ('soccer', 'football')
                    OR LOWER(COALESCE(sport, '')) LIKE '%soccer%'
                  )
                ORDER BY start_time ASC
            `;
            
            const result = await db.query(query);
            const upcomingMatches = result.rows;
            
            console.log(`[CRON] Pulse Check: Found ${upcomingMatches.length} matches within 72 hours`);

            if (constraints.mode === 'fallback') {
                console.warn('[CRON] Pulse Check running in fallback mode; skipping deep enrichment and AI insight generation.');
                return;
            }
            
            // Safety: Check ApiQueue saturation and batch gracefully
            const queueLength = apiQueue.getQueueLength();
            const QUEUE_THRESHOLD = 20;
            const BATCH_SIZE = 5;
            
            if (queueLength > QUEUE_THRESHOLD) {
                console.warn(`[CRON] Pulse Check: ApiQueue saturated (${queueLength} items). Processing in small batches with delay.`);
            }
            
            // Process matches in batches to avoid overwhelming the queue
            let enrichedCount = 0;
            let insightCount = 0;
            
            for (let batchStart = 0; batchStart < upcomingMatches.length; batchStart += BATCH_SIZE) {
                const batch = upcomingMatches.slice(batchStart, batchStart + BATCH_SIZE);
                
                for (const match of batch) {
                    const { id_event, start_time } = match;
                    
                    try {
                        const enriched = await executeOperation({
                            operation: 'cron.pulse.enrich',
                            caller: 'backend/services/cronJobs.js',
                            payload: { id_event },
                            execute: async () => enrichMatchContext(id_event)
                        });
                        if (enriched?.result) enrichedCount++;
                        
                        const insight = await executeOperation({
                            operation: 'cron.pulse.insight',
                            caller: 'backend/services/cronJobs.js',
                            payload: { id_event },
                            execute: async () => generateEdgeMindInsight(id_event)
                        });
                        if (insight?.result) insightCount++;
                        
                        console.log(`[CRON] Pulse Check: Processed ${id_event} (starts ${start_time})`);
                    } catch (err) {
                        console.error(`[CRON] Pulse Check: Failed to process ${id_event}:`, err.message);
                    }
                }
                
                // Graceful delay between batches if queue is saturated
                if (queueLength > QUEUE_THRESHOLD && batchStart + BATCH_SIZE < upcomingMatches.length) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
            
            console.log(`[CRON] Pulse Check completed: ${enrichedCount} enriched, ${insightCount} insights generated`);
        } catch (err) {
            console.error(`[CRON] Pulse Check failed:`, err.message);
        }
    }, {
        timezone: 'UTC'
    });
    console.log('[CRON] Pulse Check scheduled: every 30 minutes');
    } else {
        console.log('[CRON] Pulse Check disabled in pre-match-only mode');
    }

    // ── Schedule 3: Pipeline Health Feed Pulse (every 30 minutes) ────────────────
    if (!PRE_MATCH_ONLY_MODE) {
    cron.schedule('5,35 * * * *', async () => {
        console.log(`[CRON] Refreshing pipeline health feed at ${new Date().toISOString()}`);
        try {
            const result = await executeOperation({
                operation: 'cron.pipelineHealth',
                caller: 'backend/services/cronJobs.js',
                payload: { source: 'cron' },
                execute: async () => refreshPipelineHealthState({ source: 'cron' })
            });
            console.log(`[CRON] Pipeline health feed refreshed for ${result.result.summary.pipeline_count} pipelines`);
        } catch (err) {
            console.error('[CRON] Pipeline health feed refresh failed:', err.message);
        }
    }, {
        timezone: 'UTC'
    });
    console.log('[CRON] Pipeline health feed pulse scheduled: minutes 5 and 35 every hour');
    } else {
        console.log('[CRON] Pipeline health feed pulse disabled in pre-match-only mode');
    }

    // ── Schedule 4: Stale Prediction Cleanup (every 30 minutes) ──────────────────
    // Removes predictions for matches that have kicked off (>15 min grace period)
    // This guarantees the UI never shows live/completed matches
    cron.schedule('*/30 * * * *', async () => {
        console.log('[CRON] Running Stale Prediction Cleanup...');
        const constraints = getExecutionConstraints();
        if (!constraints.proceed) {
            console.warn(`[CRON] Stale Prediction Cleanup skipped due to control plane state: ${constraints.state}`);
            return;
        }
        
        try {
            const graceMinutes = 15;

            // Clean direct1x2_prediction_final — matches past kickoff + grace
            const finalResult = await executeOperation({
                operation: 'cron.staleCleanup',
                caller: 'backend/services/cronJobs.js',
                payload: { graceMinutes },
                execute: async () => db.query(`
                    DELETE FROM direct1x2_prediction_final pf
                    WHERE pf.match_date IS NOT NULL
                      AND pf.match_date < NOW() - ($1 || ' minutes')::interval
                      AND NOT EXISTS (
                          SELECT 1
                          FROM predictions_accuracy pa
                          WHERE pa.prediction_final_id = pf.id
                      )
                `, [String(graceMinutes)])
            });

            // Clean predictions_raw — stale rows
            // TEMPORARY BYPASS: predictions_raw table missing updated_at column
            // const rawResult = await db.query(`
            //     DELETE FROM predictions_raw
            //     WHERE updated_at < NOW() - INTERVAL '24 hours'
            // `);

            const finalDeleted = Number(finalResult.result?.rowCount || 0);
            // const rawDeleted = Number(rawResult.rowCount || 0);
            const rawDeleted = 0;

            if (finalDeleted > 0 || rawDeleted > 0) {
                console.log(`[CRON] Cleanup: removed ${finalDeleted} stale predictions (final) + ${rawDeleted} raw rows`);
            }
        } catch (err) {
            console.error(`[CRON] Stale Prediction Cleanup failed:`, err.message);
        }
    }, {
        timezone: 'UTC'
    });
    console.log('[CRON] Stale Prediction Cleanup scheduled: every 30 minutes');
    
    console.log('[CRON] All cron jobs initialized successfully');
}

module.exports = { initCronJobs };
