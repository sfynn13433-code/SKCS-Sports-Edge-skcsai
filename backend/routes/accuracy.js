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

function normalizeTierKey(value) {
    const key = String(value || '').trim().toLowerCase();
    return key === 'deep' || key === 'elite' ? 'elite' : 'core';
}

function normalizeTypeKey(value) {
    const key = String(value || '').trim().toLowerCase();
    if (key === 'same_match') return 'same_match';
    if (key === 'secondary') return 'secondary';
    if (key === 'multi') return 'multi';
    if (key === 'mega_acca_12' || key === 'acca_6match' || key === 'acca') return 'acca';
    return 'direct';
}

function humanizeTypeKey(key) {
    const labels = {
        direct: 'Direct Markets (1X2)',
        secondary: 'Analytical Insights',
        multi: 'Double Chance & Specials',
        same_match: 'Same Match',
        acca: 'ACCA'
    };
    return labels[key] || String(key || 'Unknown');
}

function buildEmptyStats() {
    return { wins: 0, losses: 0, graded: 0, pending: 0, void: 0, unsupported: 0, winRate: 0 };
}

function finalizeStats(stats) {
    const graded = Number(stats.graded) || 0;
    const wins = Number(stats.wins) || 0;
    return {
        ...stats,
        winRate: graded > 0 ? Math.round((wins / graded) * 100) : 0
    };
}

function determineProductStatus(rows) {
    if (rows.some((row) => row.resolution_status === 'lost')) return 'lost';
    if (rows.length > 0 && rows.every((row) => row.resolution_status === 'won')) return 'won';
    if (rows.some((row) => row.resolution_status === 'void')) return 'void';
    if (rows.some((row) => row.resolution_status === 'unsupported')) return 'unsupported';
    return 'pending';
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

        let accuracyQuery = `
            SELECT *
            FROM predictions_accuracy
            WHERE LEFT(COALESCE(fixture_date::text, ''), 10) = $1
              AND LOWER(sport) = LOWER($2)
        `;
        const accuracyParams = [filterDate, filterSport];
        if (filterRunId) {
            accuracyQuery += ' AND publish_run_id = $3';
            accuracyParams.push(filterRunId);
        }
        accuracyQuery += ' ORDER BY evaluated_at DESC, prediction_final_id DESC, prediction_match_index ASC';

        const accuracyRes = await query(accuracyQuery, accuracyParams);
        const accuracyRows = accuracyRes.rows || [];

        const overall = {
            winRate: 0,
            wins: 0,
            losses: 0,
            total: accuracyRows.length,
            graded: 0,
            pending: 0,
            void: 0,
            unsupported: 0,
            missingEvent: 0
        };

        for (const row of accuracyRows) {
            if (row.resolution_status === 'won') {
                overall.wins += 1;
                overall.graded += 1;
            } else if (row.resolution_status === 'lost') {
                overall.losses += 1;
                overall.graded += 1;
            } else if (row.resolution_status === 'void') {
                overall.void += 1;
            } else if (row.resolution_status === 'unsupported') {
                overall.unsupported += 1;
            } else {
                overall.pending += 1;
            }

            if (!row.result_source || String(row.event_status || '').toLowerCase() === 'missing') {
                overall.missingEvent += 1;
            }
        }
        overall.winRate = overall.graded > 0 ? Math.round((overall.wins / overall.graded) * 100) : 0;

        const products = new Map();
        for (const row of accuracyRows) {
            if (!products.has(row.prediction_final_id)) {
                products.set(row.prediction_final_id, []);
            }
            products.get(row.prediction_final_id).push(row);
        }

        const byTierMap = new Map();
        const byTypeMap = new Map();
        const tierTypeMap = new Map();
        const bySportMap = new Map();

        for (const rows of products.values()) {
            const sample = rows[0];
            const tierKey = normalizeTierKey(sample.prediction_tier);
            const typeKey = normalizeTypeKey(sample.prediction_type);
            const productStatus = determineProductStatus(rows);

            if (!byTierMap.has(tierKey)) {
                byTierMap.set(tierKey, { tier: tierKey, ...buildEmptyStats() });
            }
            if (!byTypeMap.has(typeKey)) {
                byTypeMap.set(typeKey, { type: humanizeTypeKey(typeKey), typeKey, ...buildEmptyStats() });
            }
            const tierTypeKey = `${tierKey}:${typeKey}`;
            if (!tierTypeMap.has(tierTypeKey)) {
                tierTypeMap.set(tierTypeKey, { tier: tierKey, typeKey, type: humanizeTypeKey(typeKey), ...buildEmptyStats() });
            }

            const statTargets = [byTierMap.get(tierKey), byTypeMap.get(typeKey), tierTypeMap.get(tierTypeKey)];
            for (const stats of statTargets) {
                if (productStatus === 'won') {
                    stats.wins += 1;
                    stats.graded += 1;
                } else if (productStatus === 'lost') {
                    stats.losses += 1;
                    stats.graded += 1;
                } else if (productStatus === 'void') {
                    stats.void += 1;
                } else if (productStatus === 'unsupported') {
                    stats.unsupported += 1;
                } else {
                    stats.pending += 1;
                }
            }
        }

        for (const row of accuracyRows) {
            const sportKey = String(row.sport || '').toLowerCase() || 'unknown';
            if (!bySportMap.has(sportKey)) {
                bySportMap.set(sportKey, { sport: sportKey, ...buildEmptyStats() });
            }
            const stats = bySportMap.get(sportKey);
            if (row.resolution_status === 'won') {
                stats.wins += 1;
                stats.graded += 1;
            } else if (row.resolution_status === 'lost') {
                stats.losses += 1;
                stats.graded += 1;
            } else if (row.resolution_status === 'void') {
                stats.void += 1;
            } else if (row.resolution_status === 'unsupported') {
                stats.unsupported += 1;
            } else {
                stats.pending += 1;
            }
        }

        const tierTypeBreakdown = Array.from(byTierMap.keys()).map((tierKey) => ({
            tier: tierKey,
            wins: byTierMap.get(tierKey)?.wins || 0,
            losses: byTierMap.get(tierKey)?.losses || 0,
            pending: byTierMap.get(tierKey)?.pending || 0,
            types: ['direct', 'secondary', 'multi', 'same_match', 'acca'].map((typeKey) => ({
                ...(tierTypeMap.get(`${tierKey}:${typeKey}`) || { typeKey, type: humanizeTypeKey(typeKey), ...buildEmptyStats() }),
                typeKey
            }))
        }));

        const losses = accuracyRows
            .filter((row) => row.resolution_status === 'lost')
            .map((row) => ({
                match: `${row.home_team || 'Unknown'} vs ${row.away_team || 'Unknown'}`,
                sport: row.sport,
                tier: normalizeTierKey(row.prediction_tier),
                predictionType: humanizeTypeKey(normalizeTypeKey(row.prediction_type)),
                predictionTypeKey: normalizeTypeKey(row.prediction_type),
                market: row.market,
                confidence: row.confidence,
                predictedOutcome: row.predicted_outcome,
                actualResult: row.actual_result,
                eventStatus: row.event_status,
                scoreline: Number.isFinite(Number(row.actual_home_score)) && Number.isFinite(Number(row.actual_away_score))
                    ? `${row.actual_home_score}-${row.actual_away_score}`
                    : null,
                halftimeScoreline: Number.isFinite(Number(row.actual_home_score_ht)) && Number.isFinite(Number(row.actual_away_score_ht))
                    ? `${row.actual_home_score_ht}-${row.actual_away_score_ht}`
                    : null,
                reasonSummary: row.loss_reason_summary,
                factors: Array.isArray(row.loss_factors) ? row.loss_factors : [],
                evaluatedAt: row.evaluated_at
            }));

        const weeklyMap = new Map();
        for (const row of accuracyRows) {
            const fixtureDate = row.fixture_date ? new Date(row.fixture_date) : null;
            if (!fixtureDate || Number.isNaN(fixtureDate.getTime())) continue;
            const weekStart = startOfWeekUtc(fixtureDate).toISOString().slice(0, 10);
            if (!weeklyMap.has(weekStart)) {
                weeklyMap.set(weekStart, { weekStart, wins: 0, losses: 0, accuracy: 0, reasons: [] });
            }
            const entry = weeklyMap.get(weekStart);
            if (row.resolution_status === 'won') {
                entry.wins += 1;
            } else if (row.resolution_status === 'lost') {
                entry.losses += 1;
                if (row.loss_reason_summary) {
                    entry.reasons.push(row.loss_reason_summary);
                }
            }
        }
        const weekly = Array.from(weeklyMap.values())
            .map((entry) => ({
                ...entry,
                accuracy: entry.wins + entry.losses > 0 ? Math.round((entry.wins / (entry.wins + entry.losses)) * 100) : 0,
                reasons: Array.from(new Set(entry.reasons)).slice(0, 3)
            }))
            .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

        const availableDatesRes = await query(`
            SELECT DISTINCT LEFT(COALESCE(fixture_date::text, ''), 10) as date
            FROM predictions_accuracy
            WHERE evaluated_at >= NOW() - INTERVAL '30 days'
            ORDER BY date DESC
        `);
        const availableDates = availableDatesRes.rows.map((row) => row.date).filter(Boolean);

        const availableSportsRes = await query(`
            SELECT DISTINCT LOWER(sport) as sport
            FROM predictions_accuracy
            WHERE evaluated_at >= NOW() - INTERVAL '30 days'
            ORDER BY sport ASC
        `);
        const availableSports = availableSportsRes.rows.map((row) => row.sport).filter(Boolean);

        const availableRunsRes = await query(`
            SELECT DISTINCT publish_run_id as "runId"
            FROM predictions_accuracy
            WHERE LEFT(COALESCE(fixture_date::text, ''), 10) = $1
              AND LOWER(sport) = LOWER($2)
              AND publish_run_id IS NOT NULL
            ORDER BY "runId" DESC
        `, [filterDate, filterSport]);

        const runIds = availableRunsRes.rows.map((row) => row.runId).filter(Boolean);
        const runMetaMap = new Map();
        if (runIds.length > 0) {
            const runMetaRes = await query(`
                SELECT id as "runId", trigger_source as "triggerSource", started_at as "startedAt", completed_at as "completedAt"
                FROM prediction_publish_runs
                WHERE id = ANY($1::bigint[])
                ORDER BY started_at DESC
            `, [runIds]);
            for (const row of runMetaRes.rows) {
                runMetaMap.set(String(row.runId), row);
            }
        }
        const availableRuns = availableRunsRes.rows.map((row) => runMetaMap.get(String(row.runId)) || row);

        const eventIds = Array.from(new Set(accuracyRows.map((row) => row.event_id).filter(Boolean)));
        let contextCoverage = { injuryRows: 0, weatherRows: 0, newsRows: 0 };
        if (eventIds.length > 0) {
            const coverageRes = await query(`
                SELECT
                    (SELECT COUNT(*) FROM event_injury_snapshots WHERE event_id = ANY($1::text[])) as "injuryRows",
                    (SELECT COUNT(*) FROM event_weather_snapshots WHERE event_id = ANY($1::text[])) as "weatherRows",
                    (SELECT COUNT(*) FROM event_news_snapshots WHERE event_id = ANY($1::text[])) as "newsRows"
            `, [eventIds]);
            contextCoverage = coverageRes.rows[0] || contextCoverage;
        }

        const verified = ['scoreline'];
        if (Number(contextCoverage.injuryRows) > 0) verified.push('injuries');
        if (Number(contextCoverage.weatherRows) > 0) verified.push('weather');
        if (Number(contextCoverage.newsRows) > 0) verified.push('news');
        const unavailable = ['injuries', 'weather', 'news'].filter((key) => !verified.includes(key));

        res.json({
            overall,
            byTier: Array.from(byTierMap.values()).map(finalizeStats),
            byType: Array.from(byTypeMap.values()).map(finalizeStats),
            tierTypeBreakdown: tierTypeBreakdown.map((entry) => ({
                ...entry,
                types: entry.types.map(finalizeStats)
            })),
            bySport: Array.from(bySportMap.values()).map(finalizeStats),
            weekly,
            losses,
            availability: {
                availableSports,
                availableDates,
                availableRuns
            },
            window: {
                date: filterDate,
                sport: filterSport,
                runId: filterRunId,
                publishSummary: {
                    products: products.size,
                    legs: accuracyRows.length
                },
                reasonCapabilities: {
                    verified,
                    unavailable
                },
                contextCoverage,
                missingEvent: overall.missingEvent
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
