'use strict';

const express = require('express');
const { query } = require('../db');
const pipelineLogger = require('../utils/pipelineLogger');
const { getPlanCapabilities, filterPredictionsForPlan } = require('../config/subscriptionMatrix');

const router = express.Router();

const SPORT_FILTER_MAP = {
    football: [
        'football',
        'soccer_epl',
        'soccer_england_efl_cup',
        'soccer_uefa_champs_league',
        'soccer_spain_la_liga',
        'soccer_germany_bundesliga',
        'soccer_italy_serie_a',
        'soccer_france_ligue_one',
        'soccer_uefa_europa_league'
    ],
    basketball: ['basketball', 'nba', 'basketball_nba', 'basketball_euroleague'],
    nfl: ['nfl', 'american_football', 'americanfootball_nfl'],
    rugby: ['rugby', 'rugbyunion_international', 'rugbyunion_six_nations'],
    hockey: ['hockey', 'icehockey_nhl'],
    baseball: ['baseball', 'baseball_mlb'],
    afl: ['afl', 'aussierules_afl'],
    mma: ['mma', 'mma_mixed_martial_arts'],
    formula1: ['formula1'],
    handball: ['handball'],
    volleyball: ['volleyball'],
    cricket: ['cricket']
};

function normalizeSportKey(value) {
    const key = String(value || '').trim().toLowerCase();
    if (!key) return 'unknown';
    if (key.startsWith('soccer_')) return 'football';
    if (key.startsWith('icehockey_')) return 'hockey';
    if (key.startsWith('basketball_')) return 'basketball';
    if (key.startsWith('americanfootball_')) return 'nfl';
    if (key.startsWith('baseball_')) return 'baseball';
    if (key.startsWith('rugbyunion_')) return 'rugby';
    if (key.startsWith('aussierules_')) return 'afl';
    if (key.startsWith('mma_')) return 'mma';
    return key;
}

function getSportFilterValues(sport) {
    const key = normalizeSportKey(sport);
    if (!key || key === 'unknown') return [];
    return SPORT_FILTER_MAP[key] || [key];
}

function parseMatchKickoff(match) {
    const metadata = match?.metadata || {};
    const value =
        match?.commence_time
        || match?.match_date
        || metadata.match_time
        || metadata.kickoff
        || metadata.kickoff_time
        || null;
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function predictionMatchesSport(prediction, sportFilterValues) {
    if (!Array.isArray(sportFilterValues) || sportFilterValues.length === 0) return true;
    const allowed = new Set(sportFilterValues.map(normalizeSportKey));
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    if (matches.length === 0) return false;
    return matches.some((match) => allowed.has(normalizeSportKey(match?.sport || match?.metadata?.sport || 'unknown')));
}

function predictionMatchesWindow(prediction, windowStart, windowEnd) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    if (!matches.length) return false;
    const kickoffs = matches.map((match) => parseMatchKickoff(match)).filter(Boolean);
    if (!kickoffs.length) {
        const fallback = new Date(prediction?.created_at || 0);
        if (Number.isNaN(fallback.getTime())) return false;
        return fallback >= windowStart && fallback <= windowEnd;
    }
    return kickoffs.some((kickoff) => kickoff >= windowStart && kickoff <= windowEnd);
}

function normalizeHistoryDays(value, fallback = 1) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(14, Math.floor(n)));
}

function normalizeFutureDays(value, fallback = 7) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.min(14, Math.floor(n)));
}

router.get('/routes', (req, res) => {
    // Note: Express does not provide a stable public API for route listing.
    // We use the internal stack for admin debugging only.
    const app = req.app;
    const routes = [];

    const stack = app?._router?.stack || [];
    for (const layer of stack) {
        if (layer.route && layer.route.path) {
            const methods = Object.keys(layer.route.methods || {}).filter(m => layer.route.methods[m]);
            routes.push({ path: layer.route.path, methods });
        } else if (layer.name === 'router' && layer.handle?.stack) {
            for (const sub of layer.handle.stack) {
                if (sub.route && sub.route.path) {
                    const methods = Object.keys(sub.route.methods || {}).filter(m => sub.route.methods[m]);
                    routes.push({ path: sub.route.path, methods });
                }
            }
        }
    }

    res.status(200).json({ count: routes.length, routes });
});

router.get('/db', async (_req, res) => {
    try {
        const result = await query('select now() as now;');
        res.status(200).json({ ok: true, now: result.rows[0]?.now || null });
    } catch (err) {
        console.error('[debug/db] error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/pipeline-status', async (req, res) => {
    const sport = normalizeSportKey(req.query.sport || 'football');
    const planId = String(req.query.plan_id || 'elite_30day_deep_vip').trim();
    const historyDays = normalizeHistoryDays(req.query.history_days, 1);
    const windowDays = normalizeFutureDays(req.query.window_days, 7);
    const now = new Date();
    const windowStart = new Date(now.getTime() - historyDays * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);
    const sportFilterValues = getSportFilterValues(sport);

    try {
        const publishRes = await query(`
            SELECT id, publish_run_id, tier, type, matches, total_confidence, risk_level, created_at
            FROM predictions_final
            ORDER BY created_at DESC
            LIMIT 500;
        `);
        const publishedRows = Array.isArray(publishRes.rows) ? publishRes.rows : [];
        const sportPublishedRows = publishedRows.filter((row) => predictionMatchesSport(row, sportFilterValues));
        const latestPublished = sportPublishedRows.slice(0, 10);

        const rejectedRes = await query(`
            SELECT
                f.id AS filtered_id,
                f.raw_id,
                f.tier,
                f.reject_reason,
                f.created_at,
                r.match_id,
                r.sport,
                r.market,
                r.prediction,
                r.confidence
            FROM predictions_filtered f
            JOIN predictions_raw r ON r.id = f.raw_id
            WHERE f.is_valid = false
            ORDER BY f.created_at DESC
            LIMIT 500;
        `);
        const rejectedRows = (Array.isArray(rejectedRes.rows) ? rejectedRes.rows : [])
            .filter((row) => {
                const rowSport = normalizeSportKey(row?.sport || 'unknown');
                const allowed = new Set(sportFilterValues.map(normalizeSportKey));
                return allowed.size === 0 || allowed.has(rowSport);
            })
            .slice(0, 10)
            .map((row) => ({
                filtered_id: row.filtered_id,
                raw_id: row.raw_id,
                tier: row.tier,
                reject_reason: row.reject_reason || 'unspecified',
                created_at: row.created_at,
                match_id: row.match_id,
                sport: normalizeSportKey(row.sport),
                market: row.market,
                prediction: row.prediction,
                confidence: Number(row.confidence)
            }));

        const planCapabilities = getPlanCapabilities(planId);
        const sportFilteredRows = sportPublishedRows;
        const dateFilteredRows = sportFilteredRows.filter((row) => predictionMatchesWindow(row, windowStart, windowEnd));
        const planFilteredRows = planCapabilities
            ? filterPredictionsForPlan(dateFilteredRows, planId, now, {
                enforceUniqueAssetWindow: false,
                subscriptionStart: null
            })
            : [];
        const uiQueryCount = planFilteredRows.length;

        const sportMismatchCount = Math.max(0, publishedRows.length - sportFilteredRows.length);
        const dateExcludedCount = Math.max(0, sportFilteredRows.length - dateFilteredRows.length);
        const planMismatchCount = Math.max(0, dateFilteredRows.length - planFilteredRows.length);
        const uiFilterExcluded = sportMismatchCount + dateExcludedCount + planMismatchCount;

        pipelineLogger.stageSet({
            sport,
            stage: 'ui_query_count',
            count: uiQueryCount
        });
        if (sportMismatchCount > 0) {
            pipelineLogger.rejectionAdd({
                sport,
                bucket: 'sport_key_mismatch',
                count: sportMismatchCount,
                metadata: { source: 'debug_pipeline_status' }
            });
        }
        if (dateExcludedCount > 0) {
            pipelineLogger.rejectionAdd({
                sport,
                bucket: 'date_window_exclude',
                count: dateExcludedCount,
                metadata: { source: 'debug_pipeline_status' }
            });
        }
        if (planMismatchCount > 0) {
            pipelineLogger.rejectionAdd({
                sport,
                bucket: 'plan_id_mismatch',
                count: planMismatchCount,
                metadata: { source: 'debug_pipeline_status', plan_id: planId }
            });
        }
        if (uiFilterExcluded > 0) {
            pipelineLogger.rejectionAdd({
                sport,
                bucket: 'ui_filter_exclude',
                count: uiFilterExcluded,
                metadata: { source: 'debug_pipeline_status' }
            });
        }

        const telemetrySnapshot = pipelineLogger.getSportSnapshot({ sport });
        const latestTelemetryRejections = pipelineLogger.getLatestRejections({ sport, limit: 10 });

        res.status(200).json({
            sport_key: sport,
            plan_id: planId,
            effective_date_window: {
                start_utc: windowStart.toISOString(),
                end_utc: windowEnd.toISOString(),
                history_days: historyDays,
                window_days: windowDays
            },
            pipeline_stages: telemetrySnapshot.stages,
            rejection_buckets: telemetrySnapshot.rejections,
            fallback_metrics: telemetrySnapshot.fallback_metrics,
            sport_normalization_map: telemetrySnapshot.sport_normalization_map,
            latest_published_rows: latestPublished,
            latest_rejected_rows: rejectedRows,
            latest_telemetry_rejections: latestTelemetryRejections,
            effective_ui_query_result_count: uiQueryCount
        });
    } catch (err) {
        console.error('[debug/pipeline-status] error:', err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

module.exports = router;
