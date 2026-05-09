'use strict';

const express = require('express');
const { saveProvisioningPayload } = require('../services/tier1BootstrapService');
const { requireRole } = require('../utils/auth');

const router = express.Router();

const requireAdmin = requireRole('admin');

const SPORTMONKS_SIDELINED_HINT = Object.freeze({
    soccer: 'https://api.sportmonks.com/v3/football/fixtures/{fixture_id}?include=sidelined',
    rugby: 'https://api.sportmonks.com/v3/rugby/fixtures/{fixture_id}?include=sidelined'
});

router.get('/provisioning/hooks', (_req, res) => {
    res.json({
        status: 'ok',
        tier: 1,
        sports: ['Football', 'Basketball', 'Rugby', 'MMA'],
        hooks: {
            mma: {
                fields: ['reach', 'stance', 'weight_cut_history'],
                route: '/api/tier1/ingestion/mma-variables'
            },
            basketball: {
                fields: ['availability', 'load_management', 'pace_of_play'],
                route: '/api/tier1/ingestion/basketball-variables'
            },
            teamAvailability: {
                fields: ['sidelined'],
                routes: [
                    '/api/tier1/ingestion/soccer-sidelined',
                    '/api/tier1/ingestion/rugby-sidelined'
                ],
                sportmonks_include: SPORTMONKS_SIDELINED_HINT
            }
        }
    });
});

async function handleProvisioningSave(req, res, namespace) {
    try {
        const key = String(req.body?.key || req.query?.key || '').trim();
        if (!key) {
            return res.status(400).json({ status: 'error', message: 'missing key' });
        }
        const payload = req.body?.payload && typeof req.body.payload === 'object'
            ? req.body.payload
            : (req.body && typeof req.body === 'object' ? req.body : {});
        const result = await saveProvisioningPayload(namespace, key, payload);
        return res.json({ status: 'ok', namespace, key, ...result });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

router.post('/ingestion/mma-variables', requireAdmin, async (req, res) => {
    await handleProvisioningSave(req, res, 'mma');
});

router.post('/ingestion/basketball-variables', requireAdmin, async (req, res) => {
    await handleProvisioningSave(req, res, 'basketball');
});

router.post('/ingestion/soccer-sidelined', requireAdmin, async (req, res) => {
    await handleProvisioningSave(req, res, 'soccer_sidelined');
});

router.post('/ingestion/rugby-sidelined', requireAdmin, async (req, res) => {
    await handleProvisioningSave(req, res, 'rugby_sidelined');
});

module.exports = router;
