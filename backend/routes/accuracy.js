'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

function startOfWeekUtc(now = new Date()) {
    const current = new Date(now);
    const day = current.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    current.setUTCDate(current.getUTCDate() + diffToMonday);
    current.setUTCHours(0, 0, 0, 0);
    return current;
}

function endOfWeekUtc(now = new Date()) {
    const start = startOfWeekUtc(now);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return end;
}

function formatWeekKey(date) {
    const year = date.getUTCFullYear();
    const week = getWeekNumber(date);
    return `${year}-W${String(week).padStart(2, '0')}`;
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// GET /api/accuracy
// Main accuracy endpoint - returns comprehensive accuracy data for selected window
router.get('/', async (req, res) => {
    try {
        const { date, sport, run_id } = req.query;
        const filterDate = date || new Date().toISOString().slice(0, 10);
        const filterSport = sport || 'football';
        const filterRunId = run_id || null;

        console.log(`[accuracy] Fetching accuracy for date=${filterDate}, sport=${filterSport}, run_id=${filterRunId || 'latest'}`);

        // Build query for predictions_final with grading data
        let queryStr = `
            SELECT 
                pf.id,
                pf.tier,
                pf.type,
                pf.matches,
                pf.total_confidence,
                pf.risk_level,
                pf.publish_run_id,
                pf.created_at,
                pr.trigger_source,
                pr.status as run_status,
                pr.metadata as run_metadata
            FROM predictions_final pf
            LEFT JOIN prediction_publish_runs pr ON pr.id = pf.publish_run_id
            WHERE DATE(pf.created_at) = $1
              AND pf.tier IS NOT NULL
        `;
        const queryParams = [filterDate];
        let paramCount = 1;

        if (filterRunId) {
            paramCount++;
            queryStr += ` AND pf.publish_run_id = $${paramCount}`;
            queryParams.push(filterRunId);
        }

        queryStr += ` ORDER BY pf.created_at DESC`;

        const dbRes = await query(queryStr, queryParams);
        const predictions = dbRes.rows || [];

        // Calculate accuracy metrics
        const overall = {
            winRate: 0,
            wins: 0,
            losses: 0,
            total: predictions.length,
            graded: 0,
            pending: 0,
            void: 0,
            unsupported: 0
        };

        // Group by tier
        const byTier = new Map();
        // Group by type
        const byType = new Map();
        // Group by tier x type
        const tierTypeBreakdown = new Map();

        for (const pred of predictions) {
            const tier = String(pred.tier || 'normal').toLowerCase();
            const type = String(pred.type || 'unknown').toLowerCase();
            const tierClass = tier === 'deep' || tier === 'elite' ? 'elite' : 'core';
            const typeClass = type === 'same_match' || type === 'acca' || type === 'acca_6match' || type === 'mega_acca_12' 
                ? type 
                : 'standard';

            // Update tier stats
            if (!byTier.has(tierClass)) {
                byTier.set(tierClass, { tier: tierClass, wins: 0, losses: 0, total: 0, winRate: 0 });
            }
            const tierStats = byTier.get(tierClass);
            tierStats.total++;

            // Update type stats
            if (!byType.has(typeClass)) {
                byType.set(typeClass, { type: typeClass, wins: 0, losses: 0, total: 0, winRate: 0 });
            }
            const typeStats = byType.get(typeClass);
            typeStats.total++;

            // Update tier-type breakdown
            const tierTypeKey = `${tierClass}:${typeClass}`;
            if (!tierTypeBreakdown.has(tierTypeKey)) {
                tierTypeBreakdown.set(tierTypeKey, { 
                    tier: tierClass, 
                    type: typeClass, 
                    wins: 0, 
                    losses: 0, 
                    pending: 0, 
                    total: 0, 
                    winRate: 0 
                });
            }
            const tierTypeStats = tierTypeBreakdown.get(tierTypeKey);
            tierTypeStats.total++;

            // For now, mark as pending (would need outcome grading logic)
            overall.pending++;
            tierStats.pending = (tierStats.pending || 0) + 1;
            typeStats.pending = (typeStats.pending || 0) + 1;
            tierTypeStats.pending++;
        }

        // Get availability data
        const availableDatesRes = await query(`
            SELECT DISTINCT DATE(created_at) as date
            FROM predictions_final
            WHERE created_at >= NOW() - INTERVAL '30 days'
            ORDER BY date DESC
        `);
        const availableDates = availableDatesRes.rows.map(r => r.date);

        const availableSportsRes = await query(`
            SELECT DISTINCT 
                CASE 
                    WHEN matches IS NOT NULL AND jsonb_array_length(matches) > 0 
                    THEN LOWER(TRIM(matches->0->>'sport'))
                    ELSE 'unknown'
                END as sport
            FROM predictions_final
            WHERE created_at >= NOW() - INTERVAL '30 days'
        `);
        const availableSports = [...new Set(availableSportsRes.rows.map(r => r.sport).filter(Boolean))];

        const availableRunsRes = await query(`
            SELECT id as "runId", trigger_source as "triggerSource", 
                   started_at as "startedAt", completed_at as "completedAt"
            FROM prediction_publish_runs
            WHERE DATE(started_at) = $1
            ORDER BY started_at DESC
        `, [filterDate]);

        // Calculate publish summary
        const publishSummary = {
            products: predictions.length,
            legs: predictions.reduce((sum, p) => {
                const matches = Array.isArray(p.matches) ? p.matches.length : 0;
                return sum + matches;
            }, 0)
        };

        res.json({
            overall,
            byTier: Array.from(byTier.values()),
            byType: Array.from(byType.values()),
            tierTypeBreakdown: Array.from(tierTypeBreakdown.values()),
            weekly: [],
            losses: [],
            availability: {
                availableSports,
                availableDates,
                availableRuns: availableRunsRes.rows
            },
            window: {
                date: filterDate,
                sport: filterSport,
                runId: filterRunId,
                publishSummary,
                reasonCapabilities: {
                    verified: [],
                    unavailable: []
                },
                contextCoverage: {}
            }
        });
    } catch (error) {
        console.error('[accuracy] Error fetching accuracy data:', error);
        console.error('[accuracy] Stack trace:', error.stack);
        res.status(500).json({ 
            error: 'Failed to fetch accuracy data', 
            details: error.message 
        });
    }
});

// GET /api/accuracy/overall
// Simplified overall accuracy stats
router.get('/overall', async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN tier = 'normal' THEN 1 END) as normal_total,
                COUNT(CASE WHEN tier = 'deep' THEN 1 END) as deep_total
            FROM predictions_final
            WHERE created_at >= NOW() - INTERVAL '30 days'
        `);

        const stats = result.rows[0];

        res.json({
            overall_accuracy: 0, // Would need outcome tracking
            normal_system: 0,
            deep_system: 0,
            total_predictions: parseInt(stats.total),
            total_wins: 0,
            normal_predictions: parseInt(stats.normal_total),
            deep_predictions: parseInt(stats.deep_total)
        });
    } catch (error) {
        console.error('[accuracy] Error fetching overall accuracy:', error);
        res.status(500).json({ error: 'Failed to fetch overall accuracy' });
    }
});

// GET /api/accuracy/by-sport
router.get('/by-sport', async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                LOWER(TRIM(matches->0->>'sport')) as sport,
                COUNT(*) as total
            FROM predictions_final
            WHERE matches IS NOT NULL 
              AND jsonb_array_length(matches) > 0
              AND created_at >= NOW() - INTERVAL '30 days'
            GROUP BY LOWER(TRIM(matches->0->>'sport'))
        `);

        const bySport = {};
        for (const row of result.rows) {
            bySport[row.sport] = {
                accuracy: 0,
                wins: 0,
                total: parseInt(row.total)
            };
        }

        res.json(bySport);
    } catch (error) {
        console.error('[accuracy] Error fetching by-sport accuracy:', error);
        res.status(500).json({ error: 'Failed to fetch by-sport accuracy' });
    }
});

// GET /api/accuracy/weekly-performance
router.get('/weekly-performance', async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                created_at,
                tier,
                type
            FROM predictions_final
            WHERE created_at >= NOW() - INTERVAL '4 weeks'
            ORDER BY created_at DESC
        `);

        const weeks = {};
        for (const row of result.rows) {
            const weekKey = formatWeekKey(new Date(row.created_at));
            if (!weeks[weekKey]) {
                weeks[weekKey] = { total: 0, wins: 0 };
            }
            weeks[weekKey].total++;
        }

        res.json(weeks);
    } catch (error) {
        console.error('[accuracy] Error fetching weekly performance:', error);
        res.status(500).json({ error: 'Failed to fetch weekly performance' });
    }
});

// GET /api/accuracy/missed-reasons
router.get('/missed-reasons', async (req, res) => {
    try {
        // Would need outcome tracking - return empty for now
        res.json({
            total_losses: 0,
            reasons: []
        });
    } catch (error) {
        console.error('[accuracy] Error fetching missed reasons:', error);
        res.status(500).json({ error: 'Failed to fetch missed reasons' });
    }
});

// GET /api/accuracy/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN tier = 'normal' THEN 1 END) as normal_total,
                COUNT(CASE WHEN tier = 'deep' THEN 1 END) as deep_total,
                COUNT(CASE WHEN type = 'same_match' THEN 1 END) as same_match_total,
                COUNT(CASE WHEN type LIKE '%acca%' THEN 1 END) as acca_total
            FROM predictions_final
            WHERE created_at >= NOW() - INTERVAL '30 days'
        `);

        const stats = result.rows[0];

        res.json({
            overall_accuracy: 0,
            normal_system: 0,
            deep_system: 0,
            by_sport: {},
            missed_reasons: [],
            total_predictions: parseInt(stats.total),
            total_wins: 0,
            same_match_predictions: parseInt(stats.same_match_total),
            acca_predictions: parseInt(stats.acca_total)
        });
    } catch (error) {
        console.error('[accuracy] Error fetching dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard' });
    }
});

module.exports = router;
