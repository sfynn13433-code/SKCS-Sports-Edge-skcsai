'use strict';

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { requireSupabaseUser } = require('../middleware/supabaseJwt');

const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

router.get('/', requireSupabaseUser, async (req, res) => {
    try {
        const format = String(req.query.format || '').trim().toLowerCase();
        const marketGroup = String(req.query.market_group || '').trim().toLowerCase();
        const limit = Math.min(Number(req.query.limit || 100), 250);

        let query = supabase
            .from('cricket_insights_final')
            .select('*')
            .eq('sport', 'cricket')
            .order('start_time', { ascending: true })
            .limit(limit);

        if (format) {
            query = query.eq('match_format', format);
        }

        if (marketGroup) {
            query = query.eq('market_group', marketGroup);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[cricket-insights] query failed:', error.message);
            return res.status(500).json({ error: 'Failed to load cricket insights' });
        }

        return res.json({
            ok: true,
            count: data?.length || 0,
            insights: data || []
        });
    } catch (err) {
        console.error('[cricket-insights] failed:', err);
        return res.status(500).json({ error: 'Failed to load cricket insights', details: err.message });
    }
});

module.exports = router;