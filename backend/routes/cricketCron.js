'use strict';

const express = require('express');
const { publishCricbuzzCricket } = require('../../scripts/publish-cricbuzz-cricket');
const {
    refreshDailyCache,
    refreshLiveScores
} = require('../services/cricApiCacheService');
const { getExecutionConstraints } = require('../semantic-layer/governanceGatekeeper');
const { executeOperation } = require('../core/executionPipeline');
const { requireSchedulerSecret } = require('../utils/auth');

const router = express.Router();
const { isSportIngestionEnabled } = require('../services/apiQuotaRouter');

function cricketIngestionDisabledResponse(res) {
    return res.json({
        ok: true,
        skipped: true,
        reason: 'cricket_ingestion_disabled'
    });
}

function cricketControlPlaneResponse(res, constraints) {
    return res.status(503).json({
        ok: false,
        skipped: true,
        reason: constraints.reason || 'control_plane_blocked_execution',
        control_state: constraints.state
    });
}

router.get('/cricket/cricbuzz', requireSchedulerSecret, async (req, res) => {
    try {
        const constraints = getExecutionConstraints();
        if (!constraints.proceed) {
            return cricketControlPlaneResponse(res, constraints);
        }

        if (!isSportIngestionEnabled('cricket')) {
            return cricketIngestionDisabledResponse(res);
        }

        console.log('[cron/cricket/cricbuzz] Starting daily Cricbuzz cricket publish...');
        if (constraints.mode === 'fallback') {
            console.warn('[cron/cricket/cricbuzz] Running in fallback mode; deep cricket enrichment will be skipped.');
        }
        const startedAt = new Date().toISOString();

        const result = await executeOperation({
            operation: 'cricket.cricbuzz.publish',
            caller: 'backend/routes/cricketCron.js',
            payload: { trigger: 'cron_cricket_cricbuzz' },
            execute: async () => publishCricbuzzCricket({
                trigger: 'cron_cricket_cricbuzz',
                skipEnrichment: constraints.mode === 'fallback'
            })
        });
        if (result?.success === false) {
            return cricketControlPlaneResponse(res, result);
        }

        const finishedAt = new Date().toISOString();

        return res.json({
            ok: true,
            job: "cricbuzz-cricket-daily-publish",
            started_at: startedAt,
            finished_at: finishedAt,
            result: {
                fixturesFetched: result.result?.normalized || 0,
                fixturesInserted: result.result?.fixtureUpserts || 0,
                insightsPublished: result.result?.insightUpserts || 0,
                skipped: result.result?.skipped || 0,
                errors: result.result?.errors?.length || 0
            }
        });

    } catch (err) {
        console.error('[cron/cricket/cricbuzz] Failed:', err);
        return res.status(500).json({
            ok: false,
            error: "Cricbuzz cricket publish failed",
            details: err.message
        });
    }
});

router.get('/cricket/cricapi/daily', requireSchedulerSecret, async (req, res) => {
    try {
        const constraints = getExecutionConstraints();
        if (!constraints.proceed) {
            return cricketControlPlaneResponse(res, constraints);
        }

        if (!isSportIngestionEnabled('cricket')) {
            return cricketIngestionDisabledResponse(res);
        }

        console.log('[cron/cricket/cricapi/daily] Building daily CricAPI cache...');
        const degraded = constraints.mode === 'fallback';
        const result = await executeOperation({
            operation: 'cricket.cricapi.daily',
            caller: 'backend/routes/cricketCron.js',
            payload: { mode: 'daily' },
            execute: async () => refreshDailyCache({
                featuredLimit: degraded ? 1 : req.query.featured_limit,
                seriesLimit: degraded ? 0 : req.query.series_limit,
                detailDelayMs: degraded ? 0 : undefined
            })
        });
        if (result?.success === false) {
            return cricketControlPlaneResponse(res, result);
        }

        return res.json({
            ok: true,
            job: 'cricapi-daily-cache',
            result: result.result
        });
    } catch (err) {
        console.error('[cron/cricket/cricapi/daily] Failed:', err);
        return res.status(500).json({
            ok: false,
            error: 'CricAPI daily cache build failed',
            details: err.message
        });
    }
});

router.get('/cricket/cricapi/live', requireSchedulerSecret, async (req, res) => {
    try {
        const constraints = getExecutionConstraints();
        if (!constraints.proceed) {
            return cricketControlPlaneResponse(res, constraints);
        }

        if (!isSportIngestionEnabled('cricket')) {
            return cricketIngestionDisabledResponse(res);
        }

        console.log('[cron/cricket/cricapi/live] Refreshing live CricAPI cache...');
        const degraded = constraints.mode === 'fallback';
        const result = await executeOperation({
            operation: 'cricket.cricapi.live',
            caller: 'backend/routes/cricketCron.js',
            payload: { mode: 'live' },
            execute: async () => refreshLiveScores({
                liveLimit: degraded ? 1 : req.query.live_limit,
                detailDelayMs: degraded ? 0 : undefined
            })
        });
        if (result?.success === false) {
            return cricketControlPlaneResponse(res, result);
        }

        return res.json({
            ok: true,
            job: 'cricapi-live-refresh',
            result: result.result
        });
    } catch (err) {
        console.error('[cron/cricket/cricapi/live] Failed:', err);
        return res.status(500).json({
            ok: false,
            error: 'CricAPI live refresh failed',
            details: err.message
        });
    }
});

module.exports = router;
