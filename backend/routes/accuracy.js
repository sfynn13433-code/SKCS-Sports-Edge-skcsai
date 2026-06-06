'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();
const {
    ACCURACY_ROW_QUALITY_SQL,
    PUBLISHED_ROW_QUALITY_SQL,
    aggregateAccuracyRows,
    formatWeekKey
} = require('../services/gradingAccuracyCore');

// GET /api/accuracy
// Main accuracy endpoint - returns comprehensive accuracy data for selected window
router.get('/', async (req, res) => {
    try {
        const { date, sport, run_id } = req.query;
        const requestedDate = date || new Date().toISOString().slice(0, 10);
        const filterSport = sport || 'Football';
        const filterRunId = run_id || null;

        console.log(`[accuracy] Fetching accuracy for requested_date=${requestedDate}, sport=${filterSport}, run_id=${filterRunId || 'latest'}`);

        let effectiveDate = requestedDate;
        let fallbackApplied = false;

        const fetchAccuracyRows = async (targetDate) => {
            let accuracyQuery = `
            SELECT pa.*
            FROM predictions_accuracy pa
            WHERE pa.fixture_date = $1::date
              AND LOWER(pa.sport) = LOWER($2)
              AND ${ACCURACY_ROW_QUALITY_SQL}
        `;
            const accuracyParams = [targetDate, filterSport];
            if (filterRunId) {
                accuracyQuery += ' AND pa.publish_run_id = $3';
                accuracyParams.push(filterRunId);
            }
            accuracyQuery += ' ORDER BY pa.evaluated_at DESC, pa.prediction_final_id DESC, pa.prediction_match_index ASC';
            const accuracyRes = await query(accuracyQuery, accuracyParams);
            return accuracyRes.rows || [];
        };

        let accuracyRows = await fetchAccuracyRows(requestedDate);
        if (accuracyRows.length === 0 && !filterRunId) {
            const latestDateRes = await query(`
                SELECT fixture_date::text AS date
                FROM predictions_accuracy pa
                WHERE pa.fixture_date IS NOT NULL
                  AND LOWER(pa.sport) = LOWER($1)
                  AND ${ACCURACY_ROW_QUALITY_SQL}
                GROUP BY fixture_date
                ORDER BY fixture_date DESC
                LIMIT 1
            `, [filterSport]);

            const latestDate = latestDateRes.rows?.[0]?.date?.slice(0, 10) || null;
            if (latestDate && latestDate !== requestedDate) {
                effectiveDate = latestDate;
                fallbackApplied = true;
                accuracyRows = await fetchAccuracyRows(effectiveDate);
                console.log(`[accuracy] Requested date ${requestedDate} had no graded rows; fallback to latest graded date ${effectiveDate}`);
            }
        }

        const aggregated = aggregateAccuracyRows(accuracyRows);
        const {
            overall,
            byTier,
            byType,
            tierTypeBreakdown,
            bySport,
            weekly,
            losses
        } = aggregated;

        const availableDatesRes = await query(`
            SELECT DISTINCT date::text AS date
            FROM (
                SELECT fixture_date::date AS date
                FROM predictions_accuracy pa
                WHERE pa.fixture_date IS NOT NULL
                  AND LOWER(pa.sport) = LOWER($1)
                  AND ${ACCURACY_ROW_QUALITY_SQL}
                UNION
                SELECT DATE(COALESCE(match_date, created_at) AT TIME ZONE 'Africa/Johannesburg') AS date
                FROM direct1x2_prediction_final pf
                WHERE COALESCE(pf.sport, 'Football') = $1
                  AND ${PUBLISHED_ROW_QUALITY_SQL}
            ) d
            WHERE date IS NOT NULL
            ORDER BY date DESC
        `, [filterSport]);
        const availableDates = availableDatesRes.rows.map((row) => row.date).filter(Boolean);

        const availableSportsRes = await query(`
            SELECT DISTINCT LOWER(pa.sport) as sport
            FROM predictions_accuracy pa
            WHERE pa.evaluated_at >= NOW() - INTERVAL '30 days'
              AND ${ACCURACY_ROW_QUALITY_SQL}
            ORDER BY sport ASC
        `);
        const availableSports = availableSportsRes.rows.map((row) => row.sport).filter(Boolean);

        const availableRunsRes = await query(`
            SELECT DISTINCT publish_run_id as "runId"
            FROM predictions_accuracy pa
            WHERE pa.fixture_date = $1::date
              AND LOWER(pa.sport) = LOWER($2)
              AND pa.publish_run_id IS NOT NULL
              AND ${ACCURACY_ROW_QUALITY_SQL}
            ORDER BY "runId" DESC
        `, [effectiveDate, filterSport]);

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

        const publishedSummaryRes = await query(`
            WITH ranked_products AS (
                SELECT
                    pf.id,
                    CASE
                        WHEN jsonb_typeof(pf.matches) = 'array' THEN jsonb_array_length(pf.matches)
                        ELSE 1
                    END AS leg_count,
                    ROW_NUMBER() OVER (
                        PARTITION BY
                            COALESCE(
                                NULLIF(TRIM(pf.fixture_id::text), ''),
                                LOWER(TRIM(pf.home_team)) || '|' || LOWER(TRIM(pf.away_team))
                            ),
                            LOWER(COALESCE(pf.tier, 'normal')),
                            LOWER(COALESCE(pf.type, 'direct'))
                        ORDER BY pf.created_at DESC, pf.id DESC
                    ) AS rn
                FROM direct1x2_prediction_final pf
                WHERE COALESCE(pf.sport, 'Football') = $1
                  AND DATE(COALESCE(pf.match_date, pf.created_at) AT TIME ZONE 'Africa/Johannesburg') = $2::date
                  AND ($3::bigint IS NULL OR pf.publish_run_id = $3::bigint)
                  AND ${PUBLISHED_ROW_QUALITY_SQL}
            )
            SELECT
                COUNT(*)::int AS products,
                COALESCE(SUM(leg_count), 0)::int AS legs
            FROM ranked_products
            WHERE rn = 1
        `, [filterSport, effectiveDate, filterRunId || null]);
        const publishedSummary = publishedSummaryRes.rows?.[0] || { products: 0, legs: 0 };

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
            byTier,
            byType,
            tierTypeBreakdown,
            bySport,
            weekly,
            losses,
            availability: {
                availableSports,
                availableDates,
                availableRuns
            },
            window: {
                requestedDate,
                date: effectiveDate,
                sport: filterSport,
                runId: filterRunId,
                fallbackApplied,
                publishSummary: {
                    products: Number(publishedSummary.products || 0),
                    legs: Number(publishedSummary.legs || 0)
                },
                reasonCapabilities: {
                    verified,
                    unavailable
                },
                contextCoverage,
                missingEvent: overall.missingEvent,
                uniqueFixtures: overall.uniqueFixtures || 0,
                rawRowCount: overall.rawRowCount || 0,
                duplicatesRemoved: overall.duplicatesRemoved || 0
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
            FROM direct1x2_prediction_final
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
            FROM direct1x2_prediction_final
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
            FROM direct1x2_prediction_final
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
        const result = await query(`
            SELECT evaluation_notes as reason, COUNT(*) as count
            FROM predictions_accuracy
            WHERE resolution_status = 'lost'
              AND evaluation_notes IS NOT NULL
              AND evaluated_at >= NOW() - INTERVAL '30 days'
            GROUP BY evaluation_notes
            ORDER BY count DESC
            LIMIT 10
        `);
        const reasons = result.rows.map(r => ({ reason: r.reason, count: parseInt(r.count) }));
        res.json({
            total_losses: reasons.reduce((sum, r) => sum + r.count, 0),
            reasons
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
            FROM direct1x2_prediction_final
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
