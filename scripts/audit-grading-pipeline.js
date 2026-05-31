'use strict';

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
    try {
        console.log('\n=== GRADING PIPELINE AUDIT ===\n');

        const pa = await pool.query('SELECT COUNT(*)::bigint AS n FROM predictions_accuracy');
        console.log('predictions_accuracy rows:', pa.rows[0].n);

        const finishedAll = await pool.query(`
            SELECT COUNT(*)::bigint AS n FROM events e
            WHERE ${FINISHED_STATUS_SQL}
              AND e.home_score IS NOT NULL AND e.away_score IS NOT NULL
        `);
        console.log('finished events (all sports, broad status):', finishedAll.rows[0].n);

        const finishedFootballExact = await pool.query(`
            SELECT COUNT(*)::bigint AS n FROM events e
            WHERE ${FINISHED_STATUS_SQL}
              AND e.home_score IS NOT NULL AND e.away_score IS NOT NULL
              AND e.sport_key = 'football'
        `);
        console.log('finished events sport_key=football:', finishedFootballExact.rows[0].n);

        const finishedFootballBroad = await pool.query(`
            SELECT COUNT(*)::bigint AS n FROM events e
            WHERE ${FINISHED_STATUS_SQL}
              AND e.home_score IS NOT NULL AND e.away_score IS NOT NULL
              AND ${FOOTBALL_SPORT_KEY_SQL}
        `);
        console.log('finished events football-like sport_key:', finishedFootballBroad.rows[0].n);

        const statusOnlyFt = await pool.query(`
            SELECT COUNT(*)::bigint AS n FROM events e
            WHERE lower(trim(coalesce(e.status, ''))) = 'ft'
              AND e.home_score IS NOT NULL AND e.away_score IS NOT NULL
              AND ${FOOTBALL_SPORT_KEY_SQL}
        `);
        console.log('football-like status=ft only:', statusOnlyFt.rows[0].n);

        const preds = await pool.query(`SELECT COUNT(*)::bigint AS n FROM direct1x2_prediction_final`);
        console.log('direct1x2_prediction_final rows:', preds.rows[0].n);

        const rawValid = await pool.query(`
            SELECT COUNT(DISTINCT pr.id)::bigint AS n
            FROM predictions_raw pr
            INNER JOIN predictions_filtered pf ON pf.raw_id = pr.id AND pf.is_valid = true
        `);
        console.log('valid predictions_raw rows:', rawValid.rows[0].n);

        const rawBridgeable = await pool.query(`
            SELECT COUNT(DISTINCT pr.id)::bigint AS n
            FROM predictions_raw pr
            INNER JOIN predictions_filtered pf ON pf.raw_id = pr.id AND pf.is_valid = true
            INNER JOIN events e ON (
                lower(trim(coalesce(pr.metadata->>'home_team', ''))) = lower(trim(e.home_team))
                AND lower(trim(coalesce(pr.metadata->>'away_team', ''))) = lower(trim(e.away_team))
            )
            WHERE ${FINISHED_STATUS_SQL}
              AND e.home_score IS NOT NULL AND e.away_score IS NOT NULL
              AND ${FOOTBALL_SPORT_KEY_SQL}
        `);
        console.log('raw predictions bridgeable to finished events:', rawBridgeable.rows[0].n);

        const overlap = await pool.query(`
            SELECT COUNT(DISTINCT pf.id)::bigint AS n
            FROM direct1x2_prediction_final pf
            INNER JOIN events e ON (
                pf.fixture_id::text = e.id::text
                OR (
                    lower(trim(pf.home_team)) = lower(trim(e.home_team))
                    AND lower(trim(pf.away_team)) = lower(trim(e.away_team))
                )
            )
            WHERE ${FINISHED_STATUS_SQL.replace(/e\./g, 'e.')}
              AND e.home_score IS NOT NULL AND e.away_score IS NOT NULL
              AND ${FOOTBALL_SPORT_KEY_SQL}
        `);
        console.log('predictions joinable to finished football events:', overlap.rows[0].n);

        const byStatus = await pool.query(`
            SELECT lower(trim(coalesce(e.status, ''))) AS status, COUNT(*)::bigint AS n
            FROM events e
            WHERE e.home_score IS NOT NULL AND e.away_score IS NOT NULL
              AND ${FOOTBALL_SPORT_KEY_SQL}
            GROUP BY 1
            ORDER BY n DESC
            LIMIT 15
        `);
        console.log('\nFootball-like scored events by status:');
        for (const row of byStatus.rows) {
            console.log(`  ${row.status || '(empty)'}: ${row.n}`);
        }

        const dates = await pool.query(`
            SELECT DATE(commence_time AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg')::text AS d,
                   COUNT(*)::bigint AS n
            FROM events e
            WHERE ${FINISHED_STATUS_SQL}
              AND e.home_score IS NOT NULL AND e.away_score IS NOT NULL
              AND ${FOOTBALL_SPORT_KEY_SQL}
            GROUP BY 1
            ORDER BY d DESC
            LIMIT 10
        `);
        console.log('\nRecent finished football dates (top 10):');
        for (const row of dates.rows) {
            console.log(`  ${row.d}: ${row.n} events`);
        }

        console.log('\nDone.\n');
    } catch (err) {
        console.error('[audit-grading-pipeline] failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
