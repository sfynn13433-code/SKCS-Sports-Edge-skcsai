'use strict';

require('dotenv').config();

const cron = require('node-cron');
const { jobLogger } = require('../backend/utils/jobLogger');
const { runLiveSync } = require('../scripts/fetch-live-fixtures');
const { buildAccumulators } = require('../scripts/build-acca');
const { resolveResults } = require('../scripts/resolve-results');
const { dbCleanup } = require('../scripts/db-cleanup');

console.log('\n=== SKCS AUTOMATED CRON SCHEDULER ===\n');

// Job 1: Fetch Live Fixtures - Every 10 minutes
cron.schedule('*/10 * * * *', async () => {
    console.log('\n[CRON] Triggered: fetch-live-fixtures');
    
    try {
        const result = await jobLogger.wrap('fetch_fixtures', async () => {
            return await runLiveSync();
        });
        
        console.log('[CRON] fetch-live-fixtures completed:', result);
        
    } catch (err) {
        console.error('[CRON] fetch-live-fixtures FAILED:', err.message);
    }
});

// Job 2: Build Accumulators - Every 30 minutes
cron.schedule('*/30 * * * *', async () => {
    console.log('\n[CRON] Triggered: acca-builder');
    
    try {
        const result = await jobLogger.wrap('acca_builder', async () => {
            return await buildAccumulators();
        });
        
        console.log('[CRON] acca-builder completed:', result);
        
    } catch (err) {
        console.error('[CRON] acca-builder FAILED:', err.message);
    }
});

// Job 3: Resolve Results - Every 15 minutes
cron.schedule('*/15 * * * *', async () => {
    console.log('\n[CRON] Triggered: resolve-results');
    
    try {
        const result = await jobLogger.wrap('resolve_results', async () => {
            return await resolveResults();
        });
        
        console.log('[CRON] resolve-results completed:', result);
        
    } catch (err) {
        console.error('[CRON] resolve-results FAILED:', err.message);
    }
});

// Job 4: Database Cleanup - Daily at 3 AM
cron.schedule('0 3 * * *', async () => {
    console.log('\n[CRON] Triggered: db-cleanup (daily)');
    
    try {
        const result = await jobLogger.wrap('db_cleanup', async () => {
            return await dbCleanup();
        });
        
        console.log('[CRON] db-cleanup completed:', result);
        
    } catch (err) {
        console.error('[CRON] db-cleanup FAILED:', err.message);
    }
});

console.log('CRON JOBS SCHEDULED:');
console.log('- fetch-live-fixtures: Every 10 minutes');
console.log('- resolve-results: Every 15 minutes');  
console.log('- acca-builder: Every 30 minutes');
console.log('- db-cleanup: Daily at 03:00');
console.log('\nScheduler running. Press Ctrl+C to stop.\n');

// Keep process alive
process.on('SIGINT', () => {
    console.log('\n[CRON] Shutting down scheduler...');
    process.exit(0);
});