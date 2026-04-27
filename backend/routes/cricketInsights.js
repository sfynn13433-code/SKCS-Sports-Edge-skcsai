'use strict';

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { requireSupabaseUser } = require('../middleware/supabaseJwt');

const router = express.Router();

console.log('[cricketInsights] Router loaded successfully');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

// Status mapping for tolerant filtering
const STATUS_MAP = {
    completed: ['complete', 'completed', 'finished', 'ft', 'stumps', 'abandoned', 'cancelled', 'canceled'],
    active: ['active', 'live', 'in progress', 'in_progress', 'started'],
    upcoming: ['upcoming', 'scheduled', 'not started', 'not_started', 'pre-match', 'prematch']
};

function getStatusCategory(status) {
    const normalized = String(status || '').toLowerCase();
    
    for (const [category, values] of Object.entries(STATUS_MAP)) {
        if (values.some(value => normalized.includes(value))) {
            return category;
        }
    }
    
    return 'unknown';
}

function filterByStatus(data, statusFilter) {
    if (!data || !Array.isArray(data)) return [];
    
    return data.filter(row => {
        const statusCategory = getStatusCategory(row.status);
        
        switch (statusFilter) {
            case 'active':
                return statusCategory === 'active' || statusCategory === 'upcoming';
            case 'upcoming':
                return statusCategory === 'upcoming';
            case 'complete':
                return statusCategory === 'completed';
            case 'all':
                return true;
            default:
                return statusCategory === 'active' || statusCategory === 'upcoming';
        }
    });
}

function groupByFixtures(insights) {
    const grouped = {};
    
    insights.forEach(row => {
        const key = row.fixture_id || `${row.home_team}-${row.away_team}-${row.start_time}`;
        
        if (!grouped[key]) {
            grouped[key] = {
                fixture_id: row.fixture_id,
                home_team: row.home_team,
                away_team: row.away_team,
                league: row.league,
                start_time: row.start_time,
                status: row.status,
                insights: []
            };
        }
        
        grouped[key].insights.push(row);
    });
    
    return Object.values(grouped);
}

// Lightweight count endpoint - must be defined before the catch-all route
router.get('/count', requireSupabaseUser, async (req, res) => {
    console.log('[cricket-count] Route hit successfully');
    try {
        const status = String(req.query.status || 'active').trim().toLowerCase();

        let query = supabase
            .from('cricket_insights_final')
            .select('*')
            .eq('sport', 'cricket');

        const { data, error } = await query;

        if (error) {
            console.error('[cricket-count] query failed:', error.message);
            return res.status(500).json({ error: 'Failed to load cricket count', details: error.message });
        }

        const allData = data || [];
        const filtered = filterByStatus(allData, status);
        
        // Count direct market insights for cricket
        const directCount = filtered.filter(row => 
            String(row.market_group || '').toLowerCase() === 'direct'
        ).length;

        return res.json({
            ok: true,
            sport: 'cricket',
            status: status,
            direct_count: directCount,
            total_count: filtered.length
        });
    } catch (err) {
        console.error('[cricket-count] failed:', err);
        return res.status(500).json({ error: 'Failed to load cricket count', details: err.message });
    }
});

router.get('/', requireSupabaseUser, async (req, res) => {
    try {
        const status = String(req.query.status || 'active').trim().toLowerCase();
        const grouped = String(req.query.grouped || 'false').trim().toLowerCase() === 'true';
        const format = String(req.query.format || '').trim().toLowerCase();
        const marketGroup = String(req.query.market_group || '').trim().toLowerCase();
        const includeExpired = String(req.query.include_expired || '').trim() === '1';
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

        const allData = data || [];
        const filtered = filterByStatus(allData, status);
        
        // Count direct market insights for cricket
        const directCount = filtered.filter(row => 
            String(row.market_group || '').toLowerCase() === 'direct'
        ).length;

        const response = {
            ok: true,
            sport: 'cricket',
            status: status,
            direct_count: directCount,
            total_count: filtered.length,
            grouped: grouped
        };

        if (grouped) {
            response.fixtures = groupByFixtures(filtered);
        } else {
            response.insights = filtered;
        }

        return res.json(response);
    } catch (err) {
        console.error('[cricket-insights] failed:', err);
        return res.status(500).json({ error: 'Failed to load cricket insights', details: err.message });
    }
});

module.exports = router;