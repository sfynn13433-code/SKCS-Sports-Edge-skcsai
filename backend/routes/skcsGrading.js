'use strict';

const express = require('express');
const {
    buildGradingSnapshot,
    toLegacyAccuracyPayload
} = require('../services/gradingSnapshotService');

const router = express.Router();

// GET /api/skcs/grading-snapshot
// Unified grading contract for Accuracy Center (V1 data first; V2 adds prediction_source later).
router.get('/grading-snapshot', async (req, res) => {
    try {
        const snapshot = await buildGradingSnapshot({
            sport: req.query.sport,
            from: req.query.from,
            to: req.query.to,
            date: req.query.date,
            publish_run: req.query.publish_run,
            run_id: req.query.run_id
        });

        const format = String(req.query.format || '').toLowerCase();
        if (format === 'legacy') {
            return res.json(toLegacyAccuracyPayload(snapshot));
        }

        res.json(snapshot);
    } catch (error) {
        console.error('[skcs/grading-snapshot] Error:', error);
        res.status(500).json({
            error: 'Failed to build grading snapshot',
            details: error.message,
            schema_version: 'skcs_grading_snapshot_v1'
        });
    }
});

module.exports = router;
