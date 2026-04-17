'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SCOPE_WHERE = `
    LOWER(COALESCE(tier, '')) = 'normal'
    AND LOWER(COALESCE(type, '')) = 'direct'
    AND publish_run_id IS NULL
`;

const KICKOFF_EXPR = `
    COALESCE(
        NULLIF(BTRIM(matches->0->>'commence_time'), ''),
        NULLIF(BTRIM(matches->0->>'match_date'), ''),
        NULLIF(BTRIM(matches->0->'metadata'->>'match_time'), ''),
        NULLIF(BTRIM(matches->0->'metadata'->>'kickoff'), ''),
        NULLIF(BTRIM(matches->0->'metadata'->>'kickoff_time'), '')
    )
`;

const FIXTURE_ID_EXPR = `NULLIF(BTRIM(matches->0->>'fixture_id'), '')`;

const UNIQUE_INDEX_SQL = `
    CREATE UNIQUE INDEX IF NOT EXISTS uq_predictions_final_live_direct_fixture_market
    ON predictions_final (
        LOWER(COALESCE(sport, '')),
        LOWER(COALESCE(market_type, '')),
        (CASE
            WHEN jsonb_typeof(matches) = 'array'
            THEN NULLIF(BTRIM(matches->0->>'fixture_id'), '')
            ELSE NULL
        END)
    )
    WHERE LOWER(COALESCE(tier, '')) = 'normal'
      AND LOWER(COALESCE(type, '')) = 'direct'
      AND publish_run_id IS NULL
      AND (CASE
            WHEN jsonb_typeof(matches) = 'array'
            THEN NULLIF(BTRIM(matches->0->>'fixture_id'), '')
            ELSE NULL
        END) IS NOT NULL
`;

async function getStats(client) {
    const [countsRes, dupesRes] = await Promise.all([
        client.query(`
            SELECT
                COUNT(*)::int AS total_rows,
                COUNT(*) FILTER (WHERE ${SCOPE_WHERE})::int AS scoped_rows,
                COUNT(*) FILTER (WHERE ${SCOPE_WHERE} AND ${FIXTURE_ID_EXPR} IS NULL)::int AS missing_fixture_rows,
                COUNT(*) FILTER (WHERE ${SCOPE_WHERE} AND ${KICKOFF_EXPR} IS NULL)::int AS missing_kickoff_rows
            FROM predictions_final
        `),
        client.query(`
            SELECT COALESCE(SUM(bucket.ct - 1), 0)::int AS duplicate_rows
            FROM (
                SELECT ${FIXTURE_ID_EXPR} AS fixture_id, COUNT(*)::int AS ct
                FROM predictions_final
                WHERE ${SCOPE_WHERE}
                  AND ${FIXTURE_ID_EXPR} IS NOT NULL
                GROUP BY ${FIXTURE_ID_EXPR}
                HAVING COUNT(*) > 1
            ) AS bucket
        `)
    ]);

    return {
        totalRows: Number(countsRes.rows[0].total_rows || 0),
        scopedRows: Number(countsRes.rows[0].scoped_rows || 0),
        missingFixtureRows: Number(countsRes.rows[0].missing_fixture_rows || 0),
        missingKickoffRows: Number(countsRes.rows[0].missing_kickoff_rows || 0),
        duplicateRows: Number(dupesRes.rows[0].duplicate_rows || 0)
    };
}

async function cleanup() {
    const client = await pool.connect();

    try {
        const before = await getStats(client);
        console.log('[cleanup] Before:', JSON.stringify(before));

        await client.query('BEGIN');
        const deleteRes = await client.query(`
            WITH scoped AS (
                SELECT
                    id,
                    ${FIXTURE_ID_EXPR} AS fixture_id,
                    ${KICKOFF_EXPR} AS kickoff_raw,
                    created_at
                FROM predictions_final
                WHERE ${SCOPE_WHERE}
            ),
            ranked AS (
                SELECT
                    id,
                    fixture_id,
                    kickoff_raw,
                    ROW_NUMBER() OVER (
                        PARTITION BY fixture_id
                        ORDER BY created_at DESC, id DESC
                    ) AS rn
                FROM scoped
            ),
            to_delete AS (
                SELECT id
                FROM ranked
                WHERE fixture_id IS NULL
                   OR kickoff_raw IS NULL
                   OR rn > 1
            )
            DELETE FROM predictions_final pf
            USING to_delete td
            WHERE pf.id = td.id
        `);
        await client.query('COMMIT');

        console.log(`[cleanup] Deleted rows: ${Number(deleteRes.rowCount || 0)}`);

        await client.query(UNIQUE_INDEX_SQL);

        const indexRes = await client.query(`
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'predictions_final'
              AND indexname = 'uq_predictions_final_live_direct_fixture_market'
            LIMIT 1
        `);

        const after = await getStats(client);
        console.log('[cleanup] After:', JSON.stringify(after));
        console.log(`[cleanup] Unique index present: ${indexRes.rows.length > 0}`);
    } finally {
        client.release();
        await pool.end();
    }
}

cleanup().catch((err) => {
    console.error('[cleanup] FAILED:', err.message);
    process.exit(1);
});
