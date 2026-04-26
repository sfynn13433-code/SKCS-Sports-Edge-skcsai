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
        const includeExpired = String(req.query.include_expired || '').trim() === '1';
        const statusFilter = String(req.query.status || '').trim().toLowerCase();
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

        if (!includeExpired) {
            query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[cricket-insights] query failed:', error.message);
            return res.status(500).json({ error: 'Failed to load cricket insights', details: error.message });
        }

        let filtered = data || [];
        
        if (statusFilter === 'active') {
            filtered = filtered.filter(r => {
                const s = String(r.status || '').toLowerCase();
                return s.includes('stumps') || s.includes('toss') || s.includes('in progress') || s.includes('live');
            });
        } else if (statusFilter === 'upcoming') {
            filtered = filtered.filter(r => {
                const s = String(r.status || '').toLowerCase();
                return !s.includes('complete') && !s.includes('result') && !s.includes('stumps');
            });
        } else if (statusFilter === 'complete') {
            filtered = filtered.filter(r => {
                const s = String(r.status || '').toLowerCase();
                return s.includes('complete') || s.includes('result');
            });
        } else if (statusFilter === 'all_active') {
            filtered = filtered.filter(r => {
                const s = String(r.status || '').toLowerCase();
                return !s.includes('complete') && !s.includes('result');
            });
        }

        const grouped = {};
        const directCount = 0;
        for (const row of filtered) {
            const group = row.market_group || 'unknown';
            if (!grouped[group]) grouped[group] = [];
            grouped[group].push(row);
            if (group === 'direct') {
                directCount++;
            }
        }

        return res.json({
            ok: true,
            count: filtered.length,
            direct_count: directCount,
            total_count: data?.length || 0,
            grouped_counts: Object.fromEntries(
                Object.entries(grouped).map(([key, rows]) => [key, rows.length])
            ),
            insights: filtered
        });
    } catch (err) {
        console.error('[cricket-insights] failed:', err);
        return res.status(500).json({ error: 'Failed to load cricket insights', details: err.message });
    }
});

module.exports = router;