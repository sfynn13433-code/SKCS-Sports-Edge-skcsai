'use strict';

const express = require('express');
const { publishCricbuzzCricket } = require('../../scripts/publish-cricbuzz-cricket');

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

module.exports = router;
