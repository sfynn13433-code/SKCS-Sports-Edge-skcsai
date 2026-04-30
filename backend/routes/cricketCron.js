'use strict';

const express = require('express');
const { publishCricbuzzCricket } = require('../../scripts/publish-cricbuzz-cricket');
const {
    refreshDailyCache,
    refreshLiveScores
} = require('../services/cricApiCacheService');

const router = express.Router();

// Verify cron secret
function verifyCronSecret(req) {
    const providedSecret = req.headers["x-cron-secret"] || req.query.secret;
    
    if (!process.env.CRON_SECRET || providedSecret !== process.env.CRON_SECRET) {
        return false;
    }
    
    return true;
}

router.get('/cricket/cricbuzz', async (req, res) => {
    try {
        // Verify cron secret
        if (!verifyCronSecret(req)) {
            return res.status(401).json({
                ok: false,
                error: "Unauthorized cron request"
            });
        }

        console.log('[cron/cricket/cricbuzz] Starting daily Cricbuzz cricket publish...');
        const startedAt = new Date().toISOString();

        const result = await publishCricbuzzCricket({
            trigger: 'cron_cricket_cricbuzz'
        });

        const finishedAt = new Date().toISOString();

        return res.json({
            ok: true,
            job: "cricbuzz-cricket-daily-publish",
            started_at: startedAt,
            finished_at: finishedAt,
            result: {
                fixturesFetched: result.normalized || 0,
                fixturesInserted: result.fixtureUpserts || 0,
                insightsPublished: result.insightUpserts || 0,
                skipped: result.skipped || 0,
                errors: result.errors?.length || 0
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

router.get('/cricket/cricapi/daily', async (req, res) => {
    try {
        if (!verifyCronSecret(req)) {
            return res.status(401).json({
                ok: false,
                error: 'Unauthorized cron request'
            });
        }

        console.log('[cron/cricket/cricapi/daily] Building daily CricAPI cache...');
        const result = await refreshDailyCache({
            featuredLimit: req.query.featured_limit,
            seriesLimit: req.query.series_limit
        });

        return res.json({
            ok: true,
            job: 'cricapi-daily-cache',
            result
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

router.get('/cricket/cricapi/live', async (req, res) => {
    try {
        if (!verifyCronSecret(req)) {
            return res.status(401).json({
                ok: false,
                error: 'Unauthorized cron request'
            });
        }

        console.log('[cron/cricket/cricapi/live] Refreshing live CricAPI cache...');
        const result = await refreshLiveScores({
            liveLimit: req.query.live_limit
        });

        return res.json({
            ok: true,
            job: 'cricapi-live-refresh',
            result
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
