'use strict';

const { query } = require('../db');
const {
    ACCURACY_ROW_QUALITY_SQL,
    PUBLISHED_ROW_QUALITY_SQL,
    aggregateAccuracyRows
} = require('./gradingAccuracyCore');

const SCHEMA_VERSION = 'skcs_grading_snapshot_v1';
const ENGINE_SOURCES = ['v1_predictions'];

function normalizeSportKey(sport) {
    const raw = String(sport || 'football').trim().toLowerCase();
    if (raw === 'soccer') return 'football';
    return raw || 'football';
}

function sportDbFilter(sportKey) {
    const map = {
        football: 'Football',
        basketball: 'Basketball',
        baseball: 'Baseball',
        hockey: 'Hockey',
        rugby: 'Rugby',
        cricket: 'Cricket',
        volleyball: 'Volleyball',
        mma: 'MMA',
        formula1: 'Formula 1',
        afl: 'AFL',
        handball: 'Handball',
        nfl: 'NFL',
        american_football: 'American Football'
    };
    return map[sportKey] || sportKey;
}

function parseIsoDate(value, fallback) {
    const candidate = String(value || fallback || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return fallback;
    return candidate;
}

function shiftIsoDate(dateString, dayOffset) {
    const date = new Date(`${dateString}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return dateString;
    date.setUTCDate(date.getUTCDate() + dayOffset);
    return date.toISOString().slice(0, 10);
}

function resolveWindow(params = {}) {
    const today = new Date().toISOString().slice(0, 10);
    const singleDate = params.date ? parseIsoDate(params.date, null) : null;
    const to = parseIsoDate(params.to, singleDate || today);
    const from = parseIsoDate(params.from, singleDate || shiftIsoDate(to, -6));
    const orderedFrom = from <= to ? from : to;
    const orderedTo = from <= to ? to : from;
    return { from: orderedFrom, to: orderedTo, anchorDate: singleDate || orderedTo };
}

function tierAccuracyFromAggregates(byTier = [], byType = []) {
    const out = {
        core: { wins: 0, losses: 0, accuracy: 0, graded: 0, pending: 0, void: 0 },
        elite: { wins: 0, losses: 0, accuracy: 0, graded: 0, pending: 0, void: 0 },
        same_match: { wins: 0, losses: 0, accuracy: 0, graded: 0, pending: 0, void: 0 },
        acca: { wins: 0, losses: 0, accuracy: 0, graded: 0, pending: 0, void: 0 }
    };
    for (const tier of byTier) {
        const key = tier.tier === 'elite' ? 'elite' : 'core';
        out[key] = {
            wins: tier.wins || 0,
            losses: tier.losses || 0,
            accuracy: tier.winRate || 0,
            graded: tier.graded || 0,
            pending: tier.pending || 0,
            void: tier.void || 0
        };
    }
    for (const type of byType) {
        if (type.typeKey === 'same_match' || type.typeKey === 'acca') {
            out[type.typeKey] = {
                wins: type.wins || 0,
                losses: type.losses || 0,
                accuracy: type.winRate || 0,
                graded: type.graded || 0,
                pending: type.pending || 0,
                void: type.void || 0
            };
        }
    }
    return out;
}

function productMatrixFromBreakdown(tierTypeBreakdown = []) {
    const typeKeys = ['direct', 'secondary', 'multi'];
    return tierTypeBreakdown.map((tierRow) => {
        const typeMap = new Map((tierRow.types || []).map((t) => [t.typeKey, t]));
        const row = { tier: tierRow.tier };
        for (const key of typeKeys) {
            row[key] = typeMap.get(key)?.winRate || 0;
        }
        row.same_match = typeMap.get('same_match')?.winRate || 0;
        row.acca = typeMap.get('acca')?.winRate || 0;
        return row;
    });
}

function weeklyPerformanceFromWeekly(weekly = []) {
    return weekly.map((row) => ({
        week: row.week || row.weekStart,
        weekStart: row.weekStart,
        wins: row.wins || 0,
        losses: row.losses || 0,
        accuracy: row.accuracy || 0,
        lossDrivers: row.reasons || []
    }));
}

function lossDriversFromLosses(losses = []) {
    return losses.slice(0, 50).map((item) => {
        const factors = Array.isArray(item.factors) ? item.factors : [];
        const evidence = factors
            .map((f) => (typeof f === 'string' ? f : f?.key || f?.label || f?.type))
            .filter(Boolean);
        return {
            fixture: item.match,
            tier: item.tier,
            product: item.predictionTypeKey || item.predictionType,
            reason: item.reasonSummary || item.actualResult || 'graded_loss',
            evidence: evidence.length ? evidence : ['no_structured_evidence']
        };
    });
}

async function fetchAccuracyRows({ sportDb, from, to, publishRunId }) {
    let sql = `
        SELECT pa.*
        FROM predictions_accuracy pa
        WHERE pa.fixture_date >= $1::date
          AND pa.fixture_date <= $2::date
          AND LOWER(pa.sport) = LOWER($3)
          AND ${ACCURACY_ROW_QUALITY_SQL}
    `;
    const params = [from, to, sportDb];
    if (publishRunId) {
        sql += ' AND pa.publish_run_id = $4';
        params.push(publishRunId);
    }
    sql += ' ORDER BY pa.fixture_date DESC, pa.evaluated_at DESC, pa.prediction_final_id DESC, pa.prediction_match_index ASC';
    const res = await query(sql, params);
    return res.rows || [];
}

async function resolvePublishRunId({ sportDb, from, to, publishRun }) {
    const raw = String(publishRun || '').trim();
    if (!raw || raw === 'latest') return null;
    if (/^\d+$/.test(raw)) return raw;
    return null;
}

async function fetchLatestGradedDate(sportDb, beforeDate) {
    const res = await query(`
        SELECT fixture_date::text AS date
        FROM predictions_accuracy pa
        WHERE pa.fixture_date IS NOT NULL
          AND pa.fixture_date <= $2::date
          AND LOWER(pa.sport) = LOWER($1)
          AND ${ACCURACY_ROW_QUALITY_SQL}
        GROUP BY fixture_date
        ORDER BY fixture_date DESC
        LIMIT 1
    `, [sportDb, beforeDate]);
    return res.rows?.[0]?.date?.slice(0, 10) || null;
}

async function fetchAvailability({ sportDb, from, to, anchorDate }) {
    const availableDatesRes = await query(`
        SELECT DISTINCT date::text AS date
        FROM (
            SELECT fixture_date::date AS date
            FROM predictions_accuracy pa
            WHERE pa.fixture_date IS NOT NULL
              AND pa.fixture_date >= $2::date
              AND pa.fixture_date <= $3::date
              AND LOWER(pa.sport) = LOWER($1)
              AND ${ACCURACY_ROW_QUALITY_SQL}
            UNION
            SELECT DATE(COALESCE(match_date, created_at) AT TIME ZONE 'Africa/Johannesburg') AS date
            FROM direct1x2_prediction_final pf
            WHERE COALESCE(pf.sport, 'Football') = $1
              AND DATE(COALESCE(pf.match_date, pf.created_at) AT TIME ZONE 'Africa/Johannesburg') >= $2::date
              AND DATE(COALESCE(pf.match_date, pf.created_at) AT TIME ZONE 'Africa/Johannesburg') <= $3::date
              AND ${PUBLISHED_ROW_QUALITY_SQL}
        ) d
        WHERE date IS NOT NULL
        ORDER BY date DESC
    `, [sportDb, from, to]);

    const availableSportsRes = await query(`
        SELECT DISTINCT LOWER(pa.sport) as sport
        FROM predictions_accuracy pa
        WHERE pa.evaluated_at >= NOW() - INTERVAL '90 days'
          AND ${ACCURACY_ROW_QUALITY_SQL}
        ORDER BY sport ASC
    `);

    const availableRunsRes = await query(`
        SELECT DISTINCT publish_run_id as "runId"
        FROM predictions_accuracy pa
        WHERE pa.fixture_date >= $1::date
          AND pa.fixture_date <= $2::date
          AND LOWER(pa.sport) = LOWER($3)
          AND pa.publish_run_id IS NOT NULL
          AND ${ACCURACY_ROW_QUALITY_SQL}
        ORDER BY "runId" DESC
    `, [from, to, sportDb]);

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

    return {
        availableDates: availableDatesRes.rows.map((row) => row.date).filter(Boolean),
        availableSports: availableSportsRes.rows.map((row) => row.sport).filter(Boolean),
        availableRuns: availableRunsRes.rows.map((row) => runMetaMap.get(String(row.runId)) || row)
    };
}

async function fetchPublishedSummary({ sportDb, anchorDate, publishRunId }) {
    const res = await query(`
        SELECT
            COUNT(*)::int AS products,
            COALESCE(SUM(
                CASE
                    WHEN jsonb_typeof(matches) = 'array' THEN jsonb_array_length(matches)
                    ELSE 1
                END
            ), 0)::int AS legs
        FROM direct1x2_prediction_final pf
        WHERE COALESCE(pf.sport, 'Football') = $1
          AND DATE(COALESCE(pf.match_date, pf.created_at) AT TIME ZONE 'Africa/Johannesburg') = $2::date
          AND ($3::bigint IS NULL OR pf.publish_run_id = $3::bigint)
          AND ${PUBLISHED_ROW_QUALITY_SQL}
    `, [sportDb, anchorDate, publishRunId || null]);
    return res.rows?.[0] || { products: 0, legs: 0 };
}

async function fetchContextCoverage(eventIds) {
    if (!eventIds.length) {
        return { injuryRows: 0, weatherRows: 0, newsRows: 0 };
    }
    const res = await query(`
        SELECT
            (SELECT COUNT(*) FROM event_injury_snapshots WHERE event_id = ANY($1::text[])) as "injuryRows",
            (SELECT COUNT(*) FROM event_weather_snapshots WHERE event_id = ANY($1::text[])) as "weatherRows",
            (SELECT COUNT(*) FROM event_news_snapshots WHERE event_id = ANY($1::text[])) as "newsRows"
    `, [eventIds]);
    return res.rows[0] || { injuryRows: 0, weatherRows: 0, newsRows: 0 };
}


function toLegacyAccuracyPayload(snapshot) {
    const anchor = snapshot.window?.anchorDate || snapshot.window?.to;
    return {
        overall: snapshot.meta?.overall || {
            winRate: 0,
            wins: 0,
            losses: 0,
            total: 0,
            graded: 0,
            pending: 0,
            void: 0,
            unsupported: 0,
            missingEvent: 0
        },
        byTier: snapshot.meta?.byTier || [],
        byType: snapshot.meta?.byType || [],
        tierTypeBreakdown: snapshot.meta?.tierTypeBreakdown || [],
        bySport: snapshot.meta?.bySport || [],
        weekly: (snapshot.weekly_performance || []).map((w) => ({
            weekStart: w.weekStart || w.week,
            week: w.week,
            wins: w.wins,
            losses: w.losses,
            accuracy: w.accuracy,
            reasons: w.lossDrivers || []
        })),
        losses: snapshot.meta?.losses || [],
        availability: snapshot.availability || { availableSports: [], availableDates: [], availableRuns: [] },
        window: {
            requestedDate: snapshot.window?.requestedDate || anchor,
            date: anchor,
            sport: snapshot.sport,
            runId: snapshot.window?.publish_run_id || null,
            fallbackApplied: snapshot.window?.fallbackApplied || false,
            publishSummary: snapshot.window?.publishSummary || { products: 0, legs: 0 },
            reasonCapabilities: snapshot.window?.reasonCapabilities || { verified: [], unavailable: [] },
            contextCoverage: snapshot.window?.contextCoverage || {},
            missingEvent: snapshot.meta?.overall?.missingEvent || 0,
            from: snapshot.window?.from,
            to: snapshot.window?.to
        },
        schema_version: snapshot.schema_version
    };
}

async function buildGradingSnapshot(params = {}) {
    const sportKey = normalizeSportKey(params.sport);
    const sportDb = sportDbFilter(sportKey);
    const window = resolveWindow(params);
    let { from, to, anchorDate } = window;
    const requestedDate = params.date ? parseIsoDate(params.date, anchorDate) : anchorDate;
    let fallbackApplied = false;

    const publishRunRaw = params.publish_run || params.run_id || 'latest';
    let publishRunId = await resolvePublishRunId({
        sportDb,
        from,
        to,
        publishRun: publishRunRaw
    });

    let accuracyRows = await fetchAccuracyRows({ sportDb, from, to, publishRunId });

    if (accuracyRows.length === 0 && !publishRunId && from === to) {
        const latestDate = await fetchLatestGradedDate(sportDb, to);
        if (latestDate && latestDate !== to) {
            from = latestDate;
            to = latestDate;
            anchorDate = latestDate;
            fallbackApplied = true;
            accuracyRows = await fetchAccuracyRows({ sportDb, from, to, publishRunId });
        }
    }

    const aggregated = aggregateAccuracyRows(accuracyRows);
    const tierTypeBreakdown = aggregated.tierTypeBreakdown;
    const byTier = aggregated.byTier;

    const tier_accuracy = tierAccuracyFromAggregates(byTier, aggregated.byType);
    const product_matrix = productMatrixFromBreakdown(tierTypeBreakdown);
    const weekly_performance = weeklyPerformanceFromWeekly(aggregated.weekly);
    const loss_drivers = lossDriversFromLosses(aggregated.losses);

    const availability = await fetchAvailability({ sportDb, from, to, anchorDate });
    const publishedSummary = await fetchPublishedSummary({
        sportDb,
        anchorDate,
        publishRunId
    });

    const eventIds = Array.from(new Set(accuracyRows.map((row) => row.event_id).filter(Boolean)));
    const contextCoverage = await fetchContextCoverage(eventIds);
    const verified = ['scoreline'];
    if (Number(contextCoverage.injuryRows) > 0) verified.push('injuries');
    if (Number(contextCoverage.weatherRows) > 0) verified.push('weather');
    if (Number(contextCoverage.newsRows) > 0) verified.push('news');
    const unavailable = ['injuries', 'weather', 'news'].filter((key) => !verified.includes(key));

    const effectivePublishRun = publishRunId
        ? String(publishRunId)
        : (accuracyRows.find((r) => r.publish_run_id)?.publish_run_id
            ? String(accuracyRows.find((r) => r.publish_run_id).publish_run_id)
            : 'latest');

    return {
        schema_version: SCHEMA_VERSION,
        sport: sportKey,
        engine_sources: ENGINE_SOURCES,
        window: {
            from,
            to,
            anchorDate,
            requestedDate,
            publish_run: effectivePublishRun,
            publish_run_id: publishRunId,
            fallbackApplied,
            publishSummary: {
                products: Number(publishedSummary.products || 0),
                legs: Number(publishedSummary.legs || 0)
            },
            reasonCapabilities: { verified, unavailable },
            contextCoverage
        },
        tier_accuracy,
        product_matrix,
        weekly_performance,
        loss_drivers,
        availability,
        meta: {
            graded_legs: aggregated.overall.graded,
            total_legs: aggregated.overall.total,
            prediction_sources: ['v1'],
            overall: aggregated.overall,
            byTier: aggregated.byTier,
            byType: aggregated.byType,
            tierTypeBreakdown: aggregated.tierTypeBreakdown,
            bySport: aggregated.bySport,
            losses: aggregated.losses
        }
    };
}

module.exports = {
    SCHEMA_VERSION,
    buildGradingSnapshot,
    toLegacyAccuracyPayload,
    normalizeSportKey,
    sportDbFilter,
    resolveWindow
};
