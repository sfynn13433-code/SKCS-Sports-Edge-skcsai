require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function backfillDirectFinalFields() {
    const client = await pool.connect();
    const stats = {
        fieldsBackfilled: 0,
        publishRunBackfilled: 0
    };

    try {
        await client.query('BEGIN');

        const fieldsRes = await client.query(`
            UPDATE direct1x2_prediction_final
            SET
                fixture_id = COALESCE(
                    NULLIF(BTRIM(fixture_id), ''),
                    NULLIF(BTRIM(matches->0->>'fixture_id'), ''),
                    NULLIF(BTRIM(matches->0->>'match_id'), '')
                ),
                home_team = COALESCE(
                    NULLIF(BTRIM(home_team), ''),
                    NULLIF(BTRIM(matches->0->>'home_team'), ''),
                    NULLIF(BTRIM(matches->0->'metadata'->>'home_team'), ''),
                    NULLIF(BTRIM(matches->0->>'home_team_name'), '')
                ),
                away_team = COALESCE(
                    NULLIF(BTRIM(away_team), ''),
                    NULLIF(BTRIM(matches->0->>'away_team'), ''),
                    NULLIF(BTRIM(matches->0->'metadata'->>'away_team'), ''),
                    NULLIF(BTRIM(matches->0->>'away_team_name'), '')
                ),
                prediction = COALESCE(
                    NULLIF(BTRIM(prediction), ''),
                    NULLIF(BTRIM(matches->0->>'prediction'), ''),
                    NULLIF(BTRIM(recommendation), '')
                ),
                confidence = COALESCE(confidence, total_confidence),
                match_date = COALESCE(
                    match_date,
                    NULLIF(BTRIM(matches->0->>'match_date'), '')::timestamptz,
                    NULLIF(BTRIM(matches->0->>'commence_time'), '')::timestamptz,
                    NULLIF(BTRIM(matches->0->>'date'), '')::timestamptz,
                    created_at
                )
            WHERE
                fixture_id IS NULL
                OR home_team IS NULL
                OR away_team IS NULL
                OR prediction IS NULL
                OR confidence IS NULL
                OR match_date IS NULL
        `);
        stats.fieldsBackfilled = Number(fieldsRes.rowCount || 0);

        const latestRunRes = await client.query(`
            SELECT id
            FROM prediction_publish_runs
            WHERE status = 'completed'
            ORDER BY completed_at DESC NULLS LAST, id DESC
            LIMIT 1
        `);
        const latestRunId = latestRunRes.rows?.[0]?.id || null;

        if (latestRunId) {
            const publishRunRes = await client.query(`
                UPDATE direct1x2_prediction_final
                SET publish_run_id = $1
                WHERE publish_run_id IS NULL
            `, [latestRunId]);
            stats.publishRunBackfilled = Number(publishRunRes.rowCount || 0);
        }

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
        const stats = await backfillDirectFinalFields();
        console.log('[backfill-direct1x2-final-fields] complete:', JSON.stringify(stats));
        process.exit(0);
    } catch (error) {
        console.error('[backfill-direct1x2-final-fields] failed:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
})();

