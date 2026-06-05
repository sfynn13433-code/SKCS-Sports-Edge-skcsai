'use strict';

const express = require('express');
const { fetchSemanticDriftSummary } = require('../services/semanticDriftSummaryService');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const since = req.query.since || req.query.since_ts || null;
        const pipeline = req.query.pipeline || null;
        const provider = req.query.provider || null;

        const payload = await fetchSemanticDriftSummary({
            since,
            pipeline,
            provider
        });

        res.set('X-System-State', String(payload.systemState || 'UNKNOWN'));
        res.set('X-Control-State', String(payload.controlDecision?.state || 'UNKNOWN'));
        res.set('Cache-Control', 'public, max-age=300');
        return res.json({
            ok: true,
            ...payload
        });
    } catch (error) {
        console.error('[semantic-drift-summary] Failed:', error.message);
        return res.status(500).json({
            ok: false,
            error: error.message || 'semantic_drift_summary_failed'
        });
    }
});

module.exports = router;
