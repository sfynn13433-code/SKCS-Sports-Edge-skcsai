'use strict';

const express = require('express');
const { getPredictionsByTier, getProfileById } = require('../database');
const { requireSupabaseUser, requireActiveSubscription } = require('../middleware/supabaseJwt');
const config = require('../config');
const { getTierKeyForPlan } = require('../config/subscriptionPlans');
const { filterPredictionsForSubscriptionAccess } = require('../services/subscriptionTiming');

const router = express.Router();

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

module.exports = router;
