'use strict';

const express = require('express');
const { readCache } = require('../services/cricApiCacheService');

const router = express.Router();

router.get('/', async (_req, res) => {
    try {
        const cache = await readCache();
        if (!cache) {
            return res.status(404).json({
                ok: false,
                error: 'Cricket cache not found. Run /api/cron/cricket/cricapi/daily first.'
            });
        }

        return res.json({
            ok: true,
            cache
        });
    } catch (err) {
        console.error('[cricket-cache] read failed:', err);
        return res.status(500).json({
            ok: false,
            error: 'Failed to read cricket cache',
            details: err.message
        });
    }
});

module.exports = router;

