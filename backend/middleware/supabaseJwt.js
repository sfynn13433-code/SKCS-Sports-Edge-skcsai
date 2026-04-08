'use strict';

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const { getProfileById, getLatestSubscriptionByUserId, upsertProfile } = require('../database');
const { ACTIVE_SUBSCRIPTION_STATUSES, buildSubscriptionContext } = require('../services/subscriptionTiming');

const hasSupabaseConfig =
    typeof config?.supabase?.url === 'string' && config.supabase.url.trim().length > 0 &&
    typeof config?.supabase?.anonKey === 'string' && config.supabase.anonKey.trim().length > 0;

const supabase = hasSupabaseConfig
    ? createClient(config.supabase.url, config.supabase.anonKey)
    : null;

async function requireSupabaseUser(req, res, next) {
    if (!supabase) {
        res.status(500).json({ error: 'Supabase Auth is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)' });
        return;
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ error: 'Access token required' });
        return;
    }

    try {
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data?.user) {
            res.status(401).json({ error: 'Invalid or expired token' });
            return;
        }

        const supaUser = data.user;

        let profile = await getProfileById(supaUser.id);
        if (!profile) {
            profile = await upsertProfile({
                id: supaUser.id,
                email: supaUser.email,
                subscription_status: 'inactive',
                is_test_user: false
            });
        }

        const latestSubscription = await getLatestSubscriptionByUserId(supaUser.id);
        const subscriptionContext = buildSubscriptionContext({
            profile,
            subscription: latestSubscription,
            now: new Date()
        });

        req.user = {
            id: supaUser.id,
            email: supaUser.email,
            ...subscriptionContext
        };

        next();
    } catch (err) {
        console.error('[supabaseJwt] error:', err);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function requireActiveSubscription(req, res, next) {
    const user = req.user;

    if (!user) {
        res.status(401).json({ error: 'Access token required' });
        return;
    }

    if (!ACTIVE_SUBSCRIPTION_STATUSES.has(user.subscription_status) && user.is_test_user !== true) {
        res.status(403).json({ error: 'Subscription required' });
        return;
    }

    next();
}

module.exports = {
    requireSupabaseUser,
    requireActiveSubscription
};
