'use strict';

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { getRiskTier } = require('../services/direct1x2Builder');

const router = express.Router();

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_KEY
    || process.env.SUPABASE_ANON_KEY
    || ''
).trim();

const supabase = SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
    })
    : null;

function asNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function formatPredictionRow(row) {
    const firstMatch = Array.isArray(row?.matches) && row.matches.length ? row.matches[0] : {};
    const confidence = Math.max(
        0,
        Math.min(
            100,
            Math.round(asNumber(
                row?.confidence ?? row?.total_confidence ?? firstMatch?.confidence,
                0
            ))
        )
    );

    const prediction = String(
        row?.prediction
        || firstMatch?.prediction
        || row?.recommendation
        || 'home_win'
    ).trim();

    const secondaryMarkets = toArray(
        row?.secondary_markets && toArray(row.secondary_markets).length
            ? row.secondary_markets
            : row?.secondary_insights
    ).slice(0, 4);

    const riskTier = String(row?.risk_tier || '').trim() || getRiskTier(confidence);

    return {
        id: row?.id || null,
        fixture_id: String(row?.fixture_id || firstMatch?.fixture_id || ''),
        sport: row?.sport || firstMatch?.sport || 'football',
        home_team: row?.home_team || firstMatch?.home_team || '',
        away_team: row?.away_team || firstMatch?.away_team || '',
        match_date: row?.match_date || firstMatch?.match_date || firstMatch?.commence_time || null,
        prediction,
        confidence,
        risk_tier: riskTier,
        secondary_markets: secondaryMarkets,
        edgemind_report: row?.edgemind_report || '',
        caution_label: riskTier === 'EXTREME_RISK' ? 'EXTREME CAUTION ADVISED' : riskTier.replace(/_/g, ' ')
    };
}

// GET /api/direct-1x2?sport=football&risk_tier=EXTREME_RISK&limit=100
router.get('/', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ error: 'Supabase is not configured.' });
        }

        const sport = String(req.query?.sport || 'football').trim().toLowerCase();
        const riskTier = String(req.query?.risk_tier || '').trim().toUpperCase();
        const limit = Math.min(500, Math.max(1, Number.parseInt(String(req.query?.limit || '100'), 10) || 100));

        let query = supabase
            .from('direct1x2_prediction_final')
            .select('*')
            .eq('sport', sport)
            .in('type', ['direct', 'single'])
            .order('match_date', { ascending: true, nullsFirst: false })
            .limit(limit);

        if (riskTier) {
            query = query.eq('risk_tier', riskTier);
        }

        const { data, error } = await query;
        if (error) {
            throw error;
        }

        const predictions = (Array.isArray(data) ? data : []).map(formatPredictionRow);
        return res.json({ predictions });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
