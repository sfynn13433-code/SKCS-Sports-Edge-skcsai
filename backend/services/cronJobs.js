/**
 * Cron Jobs Service
 * 
 * Schedules automated pipeline tasks:
 * 1. Daily Discovery (00:01 UTC) - Syncs daily fixtures from TheSportsDB
 * 2. Pulse Check (every 30 minutes) - Enriches and generates AI predictions for upcoming matches
 */

const cron = require('node-cron');
const { syncDailyFixtures, enrichMatchContext, generateEdgeMindInsight } = require('./thesportsdbPipeline');
const { apiQueue } = require('../utils/apiQueue');
const db = require('../db');

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
        
        try {
            const count = await syncDailyFixtures(today);
            console.log(`[CRON] Daily Discovery completed: ${count} fixtures synced`);
        } catch (err) {
            console.error(`[CRON] Daily Discovery failed:`, err.message);
        }
    }, {
        timezone: 'UTC'
    });
    console.log('[CRON] Daily Discovery scheduled: 00:01 UTC daily');

    // ── Schedule 2: Pulse Check (every 30 minutes) ────────────────────────────────
    cron.schedule('*/30 * * * *', async () => {
        console.log(`[CRON] Running Pulse Check at ${new Date().toISOString()}`);
        
        try {
            // Query raw_fixtures for matches within the next 72 hours
            const query = `
                SELECT id_event, start_time, home_team_id, away_team_id
                FROM raw_fixtures
                WHERE start_time >= NOW()
                  AND start_time <= NOW() + INTERVAL '72 hours'
                ORDER BY start_time ASC
            `;
            
            const result = await db.query(query);
            const upcomingMatches = result.rows;
            
            console.log(`[CRON] Pulse Check: Found ${upcomingMatches.length} matches within 72 hours`);
            
            // Safety: Check if ApiQueue is saturated before processing
            const queueLength = apiQueue.getQueueLength();
            const QUEUE_THRESHOLD = 20; // Don't add more than 20 pending items
            
            if (queueLength > QUEUE_THRESHOLD) {
                console.warn(`[CRON] Pulse Check: ApiQueue saturated (${queueLength} items). Skipping enrichment.`);
                return;
            }
            
            // Process each match
            let enrichedCount = 0;
            let insightCount = 0;
            
            for (const match of upcomingMatches) {
                const { id_event, start_time } = match;
                
                try {
                    // Enrich match context
                    const enriched = await enrichMatchContext(id_event);
                    if (enriched) enrichedCount++;
                    
                    // Immediately generate AI insight
                    const insight = await generateEdgeMindInsight(id_event);
                    if (insight) insightCount++;
                    
                    console.log(`[CRON] Pulse Check: Processed ${id_event} (starts ${start_time})`);
                } catch (err) {
                    console.error(`[CRON] Pulse Check: Failed to process ${id_event}:`, err.message);
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
    
    console.log('[CRON] All cron jobs initialized successfully');
}

module.exports = { initCronJobs };
