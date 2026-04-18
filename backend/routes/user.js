'use strict';

const express = require('express');
const { getPredictionsByTier, getProfileById } = require('../database');
const { query } = require('../db');
const { requireSupabaseUser, requireActiveSubscription } = require('../middleware/supabaseJwt');
const config = require('../config');
const { getTierKeyForPlan } = require('../config/subscriptionPlans');
const { filterPredictionsForSubscriptionAccess } = require('../services/subscriptionTiming');

const router = express.Router();

const FORMAT_ALIASES = {
    direct: 'Direct',
    analytical: 'Analytical',
    multi: 'Multi',
    same_match: 'Same Match',
    acca: 'ACCA',
    mega_acca: 'Mega ACCA'
};

const QUOTA_ALIASES = {
    direct: 'direct',
    analytical: 'analytical',
    multi: 'multi',
    same_match: 'same_match',
    edgemind: 'edgemind'
};

router.get('/subscription-summary', requireSupabaseUser, async (req, res) => {
    try {
        const profile = await getProfileById(req.user?.id);
        const planId = req.user?.plan_id || profile?.plan_id || null;
        const planTier = req.user?.plan_tier || profile?.plan_tier || null;
        const planExpiresAt = req.user?.plan_expires_at || profile?.plan_expires_at || null;
        const firstName =
            req.user?.first_name
            || profile?.first_name
            || (typeof req.user?.email === 'string' ? req.user.email.split('@')[0] : null);

        res.status(200).json({
            first_name: firstName,
            email: req.user?.email || null,
            plan_id: planId,
            plan_tier: planTier,
            plan_expires_at: planExpiresAt,
            subscription_status: req.user?.subscription_status || profile?.subscription_status || 'inactive'
        });
    } catch (error) {
        console.error('SUBSCRIPTION SUMMARY ERROR:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/predictions', requireSupabaseUser, requireActiveSubscription, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Access token required' });
            return;
        }

        // Strict plan enforcement: no plan_id -> no predictions
        if (!req.user.plan_id) {
            res.status(403).json({ error: 'No active subscription' });
            return;
        }

        // Enforce expiry (prevents revenue leak after subscription end)
        const now = new Date();
        if (!req.user.plan_expires_at || new Date(req.user.plan_expires_at) < now) {
            res.status(403).json({ error: 'Subscription expired' });
            return;
        }

        console.log('PLAN DEBUG:', {
            user: req.user.id,
            plan_id: req.user.plan_id,
            tier: req.user.plan_tier,
            expires: req.user.plan_expires_at
        });

        const date = req.query.date || new Date().toISOString().split('T')[0];

        const tierKey = getTierKeyForPlan(req.user.plan_id);
        if (!tierKey || !config.tiers?.[tierKey]) {
            res.status(403).json({ error: 'Invalid or unsupported subscription plan' });
            return;
        }

        const dbPredictions = await getPredictionsByTier(tierKey, date);
        const predictions = filterPredictionsForSubscriptionAccess(
            Array.isArray(dbPredictions) ? dbPredictions : [],
            req.user
        );

        res.status(200).json({
            tier: tierKey,
            date,
            subscription_status: req.user.subscription_status,
            official_start_time: req.user.official_start_time,
            count: predictions.length,
            predictions
        });
    } catch (error) {
        console.error('PREDICTIONS ERROR:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/market-counts', requireSupabaseUser, async (req, res) => {
    try {
        const rawFormat = String(req.query.format || 'direct').trim().toLowerCase();
        const format = FORMAT_ALIASES[rawFormat];
        if (!format) {
            return res.status(400).json({ error: 'Invalid format. Use direct|analytical|multi|same_match|acca|mega_acca' });
        }

        const result = await query(
            `SELECT sport, available_count
             FROM get_available_market_counts($1, $2::skcs_insight_format)`,
            [req.user.id, format]
        );

        const counts = {};
        for (const row of result.rows || []) {
            const key = String(row.sport || '').trim();
            if (!key) continue;
            counts[key] = Number(row.available_count || 0);
        }

        return res.status(200).json({
            format,
            user_id: req.user.id,
            counts
        });
    } catch (error) {
        console.error('MARKET COUNTS ERROR:', error);
        return res.status(500).json({ error: 'Failed to fetch market counts' });
    }
});

router.post('/consume-insight', requireSupabaseUser, async (req, res) => {
    try {
        const rawCategory = String(req.body?.category || '').trim().toLowerCase();
        const category = QUOTA_ALIASES[rawCategory];
        if (!category) {
            return res.status(400).json({ error: 'Invalid category. Use direct|analytical|multi|same_match|edgemind' });
        }

        const result = await query(
            'SELECT consume_wallet_quota($1, $2) AS success',
            [req.user.id, category]
        );
        const success = Boolean(result.rows?.[0]?.success);

        if (!success) {
            return res.status(429).json({ error: `Daily limit reached for ${category}` });
        }

        return res.status(200).json({ success: true, category });
    } catch (error) {
        console.error('CONSUME INSIGHT ERROR:', error);
        return res.status(500).json({ error: 'Failed to consume insight quota' });
    }
});

module.exports = router;
