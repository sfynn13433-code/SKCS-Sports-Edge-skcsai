'use strict';

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Job Logger - wraps scheduled tasks with logging to database
const jobLogger = {
    // Start a job - returns log ID for updating later
    async start(jobName, metadata = {}) {
        try {
            const now = new Date().toISOString();
            const result = await pool.query(`
                INSERT INTO scheduling_logs (
                    schedule_type, status, started_at, window_start, window_end, metadata
                ) VALUES ($1, 'running', NOW(), NOW(), NOW(), $2)
                RETURNING id
            `, [jobName, JSON.stringify({ started_at: now, ...metadata })]);
            
            console.log(`CRON: Started ${jobName}`);
            return result.rows[0].id;
            
        } catch (err) {
            console.error(`[LOGGER ERROR] Failed to start job ${jobName}:`, err.message);
            return null;
        }
    },
    
    // Complete a job successfully
    async success(jobName, logId, stats = {}) {
        try {
            const durationMs = stats.durationMs || 0;
            const finalLogId = logId || null;
            if (!finalLogId) return;
            
            await pool.query(`
                UPDATE scheduling_logs SET
                    status = 'completed',
                    completed_at = NOW(),
                    duration_ms = $1,
                    fixtures_imported = $2,
                    predictions_generated = $3,
                    predictions_filtered = $4,
                    metadata = $5
                WHERE id = $6
            `, [
                durationMs,
                stats.fixturesImported || 0,
                stats.predictionsGenerated || 0,
                stats.predictionsFiltered || 0,
                JSON.stringify({ ...stats, finished_at: new Date().toISOString(), status: 'completed' }),
                finalLogId
            ]);
            
            console.log(`CRON: Finished ${jobName} - Status: completed (${durationMs}ms)`);
            
        } catch (err) {
            console.error(`[LOGGER ERROR] Failed to log success for ${jobName}:`, err.message);
        }
    },
    
    // Mark a job as failed
    async fail(jobName, logId, errorMessage, stats = {}) {
        try {
            const durationMs = stats.durationMs || 0;
            const finalLogId = logId || null;
            if (!finalLogId) return;
            
            await pool.query(`
                UPDATE scheduling_logs SET
                    status = 'failed',
                    completed_at = NOW(),
                    duration_ms = $1,
                    error_message = $2,
                    fixtures_imported = $3,
                    predictions_generated = $4,
                    metadata = $5
                WHERE id = $6
            `, [
                durationMs,
                errorMessage,
                stats.fixturesImported || 0,
                stats.predictionsGenerated || 0,
                JSON.stringify({ ...stats, finished_at: new Date().toISOString(), status: 'failed' }),
                finalLogId
            ]);
            
            console.log(`CRON: Finished ${jobName} - Status: failed - ${errorMessage}`);
            
        } catch (err) {
            console.error(`[LOGGER ERROR] Failed to log failure for ${jobName}:`, err.message);
        }
    },
    
    // Quick wrapper for a job function
    async wrap(jobName, jobFn) {
        const startTime = Date.now();
        const logId = await this.start(jobName, {});
        
        try {
            const result = await jobFn();
            const durationMs = Date.now() - startTime;
            
            await this.success(jobName, logId, {
                durationMs,
                ...result
            });
            
            return result;
            
        } catch (err) {
            const durationMs = Date.now() - startTime;
            await this.fail(jobName, logId, err.message, { durationMs });
            throw err;
        }
    }
};

module.exports = { jobLogger };
