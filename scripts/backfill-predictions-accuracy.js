require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function backfillPredictionsAccuracy() {
    const client = await pool.connect();
    const stats = {
        publishRunBackfilled: 0,
        identityBackfilled: 0,
        fixtureDateBackfilled: 0,
        resolutionBackfilled: 0
    };

    try {
        await client.query('BEGIN');

        const latestRunRes = await client.query(`
            SELECT id
            FROM prediction_publish_runs
            WHERE status = 'completed'
            ORDER BY completed_at DESC NULLS LAST, id DESC
            LIMIT 1
        `);
        const latestRunId = latestRunRes.rows?.[0]?.id || null;

        const publishRunRes = await client.query(`
            UPDATE predictions_accuracy pa
            SET publish_run_id = COALESCE(
                pa.publish_run_id,
                pf.publish_run_id,
                $1::bigint
            )
            FROM direct1x2_prediction_final pf
            WHERE pa.prediction_final_id = pf.id
              AND pa.publish_run_id IS NULL
        `, [latestRunId]);
        const publishRunFallbackRes = await client.query(`
            UPDATE predictions_accuracy
            SET publish_run_id = $1::bigint
            WHERE publish_run_id IS NULL
              AND $1::bigint IS NOT NULL
        `, [latestRunId]);
        stats.publishRunBackfilled = Number(publishRunRes.rowCount || 0) + Number(publishRunFallbackRes.rowCount || 0);

        const identityRes = await client.query(`
            UPDATE predictions_accuracy pa
            SET
                sport = COALESCE(
                    NULLIF(BTRIM(pa.sport), ''),
                    NULLIF(BTRIM(pf.sport), ''),
                    NULLIF(BTRIM(pf.matches->0->>'sport'), ''),
                    NULLIF(BTRIM(pf.matches->0->'metadata'->>'sport'), ''),
                    'football'
                ),
                prediction_tier = COALESCE(pa.prediction_tier, pf.tier, 'normal'),
                prediction_type = COALESCE(pa.prediction_type, pf.type, 'direct'),
                market = COALESCE(
                    NULLIF(BTRIM(pa.market), ''),
                    NULLIF(BTRIM(pf.market_type), ''),
                    NULLIF(BTRIM(pf.matches->0->>'market'), ''),
                    '1X2'
                ),
                predicted_outcome = COALESCE(
                    NULLIF(BTRIM(pa.predicted_outcome), ''),
                    NULLIF(BTRIM(pf.prediction), ''),
                    NULLIF(BTRIM(pf.recommendation), ''),
                    NULLIF(BTRIM(pf.matches->0->>'prediction'), '')
                ),
                event_id = COALESCE(
                    NULLIF(BTRIM(pa.event_id), ''),
                    NULLIF(BTRIM(pf.fixture_id), ''),
                    NULLIF(BTRIM(pf.matches->0->>'fixture_id'), '')
                ),
                home_team = COALESCE(
                    NULLIF(BTRIM(pa.home_team), ''),
                    NULLIF(BTRIM(pf.home_team), ''),
                    NULLIF(BTRIM(pf.matches->0->>'home_team'), ''),
                    NULLIF(BTRIM(pf.matches->0->'metadata'->>'home_team'), '')
                ),
                away_team = COALESCE(
                    NULLIF(BTRIM(pa.away_team), ''),
                    NULLIF(BTRIM(pf.away_team), ''),
                    NULLIF(BTRIM(pf.matches->0->>'away_team'), ''),
                    NULLIF(BTRIM(pf.matches->0->'metadata'->>'away_team'), '')
                ),
                confidence = COALESCE(pa.confidence, pf.confidence, pf.total_confidence),
                evaluated_at = COALESCE(pa.evaluated_at, NOW())
            FROM direct1x2_prediction_final pf
            WHERE pa.prediction_final_id = pf.id
              AND (
                    pa.event_id IS NULL
                    OR pa.home_team IS NULL
                    OR pa.away_team IS NULL
                    OR pa.sport IS NULL
                    OR pa.market IS NULL
                    OR pa.predicted_outcome IS NULL
                    OR pa.prediction_tier IS NULL
                    OR pa.prediction_type IS NULL
                    OR pa.confidence IS NULL
                    OR pa.evaluated_at IS NULL
              )
        `);
        stats.identityBackfilled = Number(identityRes.rowCount || 0);

        const dateRes = await client.query(`
            UPDATE predictions_accuracy pa
            SET fixture_date = COALESCE(
                pa.fixture_date,
                (
                    COALESCE(
                        pf.match_date,
                        NULLIF(BTRIM(pf.matches->0->>'match_date'), '')::timestamptz,
                        NULLIF(BTRIM(pf.matches->0->>'commence_time'), '')::timestamptz,
                        NULLIF(BTRIM(pf.matches->0->>'date'), '')::timestamptz,
                        (
                            SELECT ev.commence_time
                            FROM events ev
                            WHERE ev.id::text = COALESCE(
                                NULLIF(BTRIM(pa.event_id), ''),
                                NULLIF(BTRIM(pf.fixture_id), ''),
                                NULLIF(BTRIM(pf.matches->0->>'fixture_id'), '')
                            )
                            LIMIT 1
                        ),
                        pa.evaluated_at,
                        NOW()
                    ) AT TIME ZONE 'Africa/Johannesburg'
                )::date
            )
            FROM direct1x2_prediction_final pf
            WHERE pa.prediction_final_id = pf.id
              AND pa.fixture_date IS NULL
        `);
        const dateFallbackRes = await client.query(`
            UPDATE predictions_accuracy
            SET fixture_date = (COALESCE(evaluated_at, NOW()) AT TIME ZONE 'Africa/Johannesburg')::date
            WHERE fixture_date IS NULL
        `);
        stats.fixtureDateBackfilled = Number(dateRes.rowCount || 0) + Number(dateFallbackRes.rowCount || 0);

        const resolutionRes = await client.query(`
            UPDATE predictions_accuracy pa
            SET
                resolution_status = COALESCE(
                    pa.resolution_status,
                    CASE
                        WHEN pa.is_correct = TRUE THEN 'won'
                        WHEN pa.is_correct = FALSE THEN 'lost'
                        WHEN pa.actual_result IS NOT NULL AND pa.actual_result <> '' THEN 'void'
                        ELSE 'pending'
                    END
                ),
                evaluated_at = COALESCE(pa.evaluated_at, NOW())
            WHERE pa.resolution_status IS NULL
               OR pa.evaluated_at IS NULL
        `);
        stats.resolutionBackfilled = Number(resolutionRes.rowCount || 0);

        await client.query('COMMIT');
        return stats;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

(async () => {
    try {
        const stats = await backfillPredictionsAccuracy();
        console.log('[backfill-predictions-accuracy] complete:', JSON.stringify(stats));
        process.exit(0);
    } catch (error) {
        console.error('[backfill-predictions-accuracy] failed:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
})();
