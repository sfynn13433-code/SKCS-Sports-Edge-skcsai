'use strict';

/**
 * One-pass V1 grading backfill: finished events → predictions_accuracy.
 * Safe to re-run (UPSERT on prediction_final_id + prediction_match_index).
 */

require('dotenv').config();

const moment = require('moment-timezone');
const {
    pool,
    runGradingBatch,
    FINISHED_STATUS_SQL,
    FOOTBALL_SPORT_KEY_SQL
} = require('./track-prediction-accuracy');

const SAST_TZ = 'Africa/Johannesburg';

function parseArgs() {
    const args = process.argv.slice(2);
    const result = {
        sport: 'football',
        from: null,
        to: null,
        days: 90,
        discoverOnly: false
    };
    for (const arg of args) {
        if (arg.startsWith('--sport=')) result.sport = arg.replace('--sport=', '');
        else if (arg.startsWith('--from=')) result.from = arg.replace('--from=', '');
        else if (arg.startsWith('--to=')) result.to = arg.replace('--to=', '');
        else if (arg.startsWith('--days=')) result.days = Number(arg.replace('--days=', ''));
        else if (arg === '--discover-only') result.discoverOnly = true;
    }
    result.to = result.to || moment().tz(SAST_TZ).subtract(1, 'day').format('YYYY-MM-DD');
    if (!result.from) {
        result.from = moment(result.to, 'YYYY-MM-DD').subtract(Math.max(1, result.days) - 1, 'day').format('YYYY-MM-DD');
    }
    return result;
}

async function discoverFinishedDates(pool, sport, from, to) {
    const sportKey = String(sport || 'football').trim().toLowerCase();
    const sportFilter = sportKey === 'football'
        ? FOOTBALL_SPORT_KEY_SQL
        : `lower(coalesce(e.sport_key, '')) = $3`;

    const params = [from, to];
    if (sportKey !== 'football') params.push(sportKey);

    const res = await pool.query(`
        SELECT DATE(e.commence_time AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg')::text AS fixture_date,
               COUNT(*)::int AS events
        FROM events e
        WHERE ${FINISHED_STATUS_SQL}
          AND e.home_score IS NOT NULL
          AND e.away_score IS NOT NULL
          AND ${sportFilter}
          AND DATE(e.commence_time AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg') >= $1::date
          AND DATE(e.commence_time AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg') <= $2::date
        GROUP BY 1
        ORDER BY fixture_date ASC
    `, params);

    return res.rows.map((row) => row.fixture_date).filter(Boolean);
}

async function countAccuracyRows(pool) {
    const res = await pool.query('SELECT COUNT(*)::bigint AS n FROM predictions_accuracy');
    return Number(res.rows[0]?.n || 0);
}

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL is required');
        process.exit(1);
    }

    const args = parseArgs();

    try {
        const before = await countAccuracyRows(pool);
        console.log(`[backfill] predictions_accuracy before: ${before}`);

        const dates = await discoverFinishedDates(pool, args.sport, args.from, args.to);
        console.log(`[backfill] discovered ${dates.length} finished dates (${args.from} → ${args.to})`);

        if (args.discoverOnly) {
            console.log(JSON.stringify({ ok: true, dates, count: dates.length }, null, 2));
            return;
        }

        if (dates.length === 0) {
            console.log('[backfill] No finished dates in window — check events.status/scores/sport_key');
            process.exit(0);
        }

        const finalCountRes = await pool.query('SELECT COUNT(*)::bigint AS n FROM direct1x2_prediction_final');
        if (Number(finalCountRes.rows[0]?.n || 0) === 0) {
            console.log('[backfill] direct1x2_prediction_final is empty — running raw→final bridge');
            const { spawnSync } = require('child_process');
            const bridge = spawnSync(process.execPath, ['scripts/bridge-raw-predictions-for-grading.js'], {
                stdio: 'inherit',
                env: process.env
            });
            if (bridge.status !== 0) {
                throw new Error('bridge-raw-predictions-for-grading.js failed');
            }
        }

        const batch = await runGradingBatch(args.sport, dates);
        const after = await countAccuracyRows(pool);

        const summary = {
            ok: true,
            sport: args.sport,
            from: args.from,
            to: args.to,
            datesProcessed: dates.length,
            rowsBefore: before,
            rowsAfter: after,
            rowsInserted: after - before,
            totalGraded: batch.totalGraded,
            totalErrors: batch.totalErrors
        };

        console.log('\n[backfill] complete:', JSON.stringify(summary, null, 2));
    } catch (err) {
        console.error('[backfill] failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
