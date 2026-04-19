'use strict';

/**
 * purgeStaleData.js
 * One-off script to delete all stale rows (kickoff > 15 minutes in the past)
 * from direct1x2_prediction_final, predictions_raw, and predictions_filtered (cascades).
 *
 * Usage: node backend/utils/purgeStaleData.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
// Also attempt the backend/.env if present
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), override: false });

const { pool } = require('../database');

const GRACE_MINUTES = 15;

async function purgeStaleData() {
    if (!pool) {
        console.error('❌ No database pool available. Ensure DATABASE_URL is set in your .env file.');
        process.exit(1);
    }

    const client = await pool.connect();
    try {
        console.log(`\n🧹 Starting stale data purge — grace period: ${GRACE_MINUTES} minutes\n`);
        console.log(`⏰ Server UTC now: ${new Date().toISOString()}`);
        console.log(`⏰ Grace cutoff  : ${new Date(Date.now() - GRACE_MINUTES * 60 * 1000).toISOString()}\n`);

        await client.query('BEGIN');

        // ── 1. direct1x2_prediction_final ──────────────────────────────────────────────
        // Delete rows where every leg's kickoff is older than the grace cutoff.
        // Kickoff is stored inside the JSONB matches array under each element's
        // metadata.match_time / metadata.kickoff / metadata.kickoff_time field,
        // plus top-level match_date / commence_time fallbacks.
        const finalResult = await client.query(`
            DELETE FROM direct1x2_prediction_final
            WHERE id IN (
                SELECT pf.id
                FROM direct1x2_prediction_final pf
                WHERE jsonb_array_length(pf.matches) > 0
                  AND (
                    SELECT BOOL_AND(
                        COALESCE(
                            NULLIF(TRIM(leg->'metadata'->>'match_time'), '')::timestamptz,
                            NULLIF(TRIM(leg->'metadata'->>'kickoff'), '')::timestamptz,
                            NULLIF(TRIM(leg->'metadata'->>'kickoff_time'), '')::timestamptz,
                            NULLIF(TRIM(leg->>'match_date'), '')::timestamptz,
                            NULLIF(TRIM(leg->>'commence_time'), '')::timestamptz,
                            -- If none of the above resolve, treat as stale
                            '1970-01-01T00:00:00Z'::timestamptz
                        ) < NOW() - ($1 || ' minutes')::interval
                    )
                    FROM jsonb_array_elements(pf.matches) AS leg
                  ) = true
            )
        `, [GRACE_MINUTES]);

        const finalDeleted = finalResult.rowCount ?? 0;
        console.log(`✅ direct1x2_prediction_final  — deleted ${finalDeleted} stale row(s)`);

        // ── 2. predictions_raw (cascades to predictions_filtered) ─────────────
        // Kickoff is stored in metadata->>'match_time', ->>'kickoff', ->>'kickoff_time'
        const rawResult = await client.query(`
            DELETE FROM predictions_raw
            WHERE COALESCE(
                CASE
                    WHEN COALESCE(metadata->>'match_time', '') ~ '^\\d{4}-\\d{2}-\\d{2}'
                        THEN (metadata->>'match_time')::timestamptz
                    ELSE NULL
                END,
                CASE
                    WHEN COALESCE(metadata->>'kickoff', '') ~ '^\\d{4}-\\d{2}-\\d{2}'
                        THEN (metadata->>'kickoff')::timestamptz
                    ELSE NULL
                END,
                CASE
                    WHEN COALESCE(metadata->>'kickoff_time', '') ~ '^\\d{4}-\\d{2}-\\d{2}'
                        THEN (metadata->>'kickoff_time')::timestamptz
                    ELSE NULL
                END,
                -- No parseable kickoff: treat as stale (safe to purge)
                '1970-01-01T00:00:00Z'::timestamptz
            ) < NOW() - ($1 || ' minutes')::interval
        `, [GRACE_MINUTES]);

        const rawDeleted = rawResult.rowCount ?? 0;
        console.log(`✅ predictions_raw    — deleted ${rawDeleted} stale row(s)  (predictions_filtered rows cascade-deleted automatically)`);

        await client.query('COMMIT');

        console.log(`\n📊 Purge summary:`);
        console.log(`   direct1x2_prediction_final   : ${finalDeleted} row(s) deleted`);
        console.log(`   predictions_raw     : ${rawDeleted} row(s) deleted`);
        console.log(`   predictions_filtered: cascade-deleted with predictions_raw\n`);
        console.log('✅ Purge complete.\n');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('❌ Purge failed — transaction rolled back:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

purgeStaleData();
