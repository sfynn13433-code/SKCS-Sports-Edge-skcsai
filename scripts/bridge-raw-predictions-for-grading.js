'use strict';

/**
 * Materialize direct1x2_prediction_final rows from valid predictions_raw
 * so the V1 grading pipeline can write predictions_accuracy.
 */

require('dotenv').config();

const { Pool } = require('pg');

const FINISHED_STATUS_SQL = `
    lower(trim(coalesce(e.status, ''))) IN (
        'ft', 'finished', 'match finished', 'full time', 'complete', 'completed', 'final'
    )
`;

const FOOTBALL_SPORT_KEY_SQL = `
    (
        lower(coalesce(e.sport_key, '')) IN ('football', 'soccer')
        OR lower(coalesce(e.sport_key, '')) LIKE '%soccer%'
        OR lower(coalesce(e.sport_key, '')) LIKE '%football%'
    )
`;

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL is required');
        process.exit(1);
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    try {
        await client.query('SET statement_timeout = 600000');

        const beforeRes = await client.query('SELECT COUNT(*)::bigint AS n FROM direct1x2_prediction_final');
        const before = Number(beforeRes.rows[0]?.n || 0);

        const latestRunRes = await client.query(`
            SELECT id FROM prediction_publish_runs
            WHERE status = 'completed'
            ORDER BY completed_at DESC NULLS LAST, id DESC
            LIMIT 1
        `);
        const publishRunId = latestRunRes.rows?.[0]?.id || null;

        const insertRes = await client.query(`
            WITH finished_events AS (
                SELECT
                    e.id,
                    e.home_team,
                    e.away_team,
                    e.home_score,
                    e.away_score,
                    e.status,
                    e.commence_time
                FROM events e
                WHERE ${FINISHED_STATUS_SQL}
                  AND e.home_score IS NOT NULL
                  AND e.away_score IS NOT NULL
                  AND ${FOOTBALL_SPORT_KEY_SQL}
            ),
            raw_candidates AS (
                SELECT
                    pr.id AS raw_id,
                    pr.sport,
                    pr.market,
                    pr.prediction,
                    pr.confidence,
                    pr.metadata,
                    pf.tier,
                    fe.id AS event_id,
                    fe.home_team AS event_home,
                    fe.away_team AS event_away,
                    fe.home_score,
                    fe.away_score,
                    fe.status AS event_status,
                    fe.commence_time
                FROM finished_events fe
                INNER JOIN predictions_raw pr ON (
                    lower(trim(coalesce(pr.metadata->>'home_team', ''))) = lower(trim(fe.home_team))
                    AND lower(trim(coalesce(pr.metadata->>'away_team', ''))) = lower(trim(fe.away_team))
                )
                INNER JOIN predictions_filtered pf
                    ON pf.raw_id = pr.id AND pf.is_valid = true
                WHERE lower(COALESCE(pr.sport, 'football')) IN ('football', 'soccer')
            )
            INSERT INTO direct1x2_prediction_final (
                publish_run_id,
                tier,
                type,
                matches,
                total_confidence,
                risk_level,
                sport,
                market_type,
                recommendation,
                fixture_id,
                home_team,
                away_team,
                prediction,
                confidence,
                match_date
            )
            SELECT
                $1::bigint,
                rc.tier,
                'direct',
                jsonb_build_array(
                    jsonb_build_object(
                        'fixture_id', rc.event_id::text,
                        'home_team', COALESCE(rc.metadata->>'home_team', rc.event_home),
                        'away_team', COALESCE(rc.metadata->>'away_team', rc.event_away),
                        'sport', COALESCE(rc.sport, 'Football'),
                        'market', COALESCE(rc.market, '1X2'),
                        'prediction', rc.prediction,
                        'confidence', rc.confidence,
                        'match_date', rc.commence_time,
                        'raw_id', rc.raw_id
                    )
                ),
                rc.confidence,
                CASE WHEN rc.confidence >= 75 THEN 'safe' ELSE 'medium' END,
                COALESCE(rc.sport, 'Football'),
                COALESCE(rc.market, '1X2'),
                rc.prediction,
                rc.event_id::text,
                COALESCE(rc.metadata->>'home_team', rc.event_home),
                COALESCE(rc.metadata->>'away_team', rc.event_away),
                rc.prediction,
                rc.confidence,
                rc.commence_time
            FROM raw_candidates rc
            WHERE NOT EXISTS (
                SELECT 1
                FROM direct1x2_prediction_final existing
                WHERE existing.fixture_id::text = rc.event_id::text
                  AND existing.tier = rc.tier
                  AND lower(COALESCE(existing.recommendation, '')) = lower(COALESCE(rc.prediction, ''))
            )
        `, [publishRunId]);

        const afterRes = await client.query('SELECT COUNT(*)::bigint AS n FROM direct1x2_prediction_final');
        const after = Number(afterRes.rows[0]?.n || 0);

        console.log(JSON.stringify({
            ok: true,
            inserted: Number(insertRes.rowCount || 0),
            finalBefore: before,
            finalAfter: after,
            publishRunId
        }, null, 2));
    } catch (err) {
        console.error('[bridge-raw-predictions] failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
