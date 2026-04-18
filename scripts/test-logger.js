'use strict';

require('dotenv').config();

// Test the jobLogger directly without running full cron
const { jobLogger } = require('../backend/utils/jobLogger');

async function test() {
    console.log('\n=== TESTING JOB LOGGER ===\n');
    
    // Test start
    const logId = await jobLogger.start('test_job', { test: true });
    console.log('Started job, logId:', logId);
    
    // Test success
    await jobLogger.success('test_job', logId, {
        durationMs: 1500,
        fixturesImported: 100,
        predictionsGenerated: 50
    });
    
    // Check database
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const r = await pool.query('SELECT * FROM scheduling_logs ORDER BY id DESC LIMIT 3');
    console.log('\nScheduling logs:', JSON.stringify(r.rows, null, 2));
    await pool.end();
    
    process.exit(0);
}

test().catch(e => { console.error(e.message); process.exit(1); });