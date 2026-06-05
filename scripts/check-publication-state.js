'use strict';

require('dotenv').config();
const { Pool } = require('pg');

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
    });

    const queries = [
        ['direct1x2_prediction_final total', 'SELECT COUNT(*)::int AS n FROM direct1x2_prediction_final'],
        ['direct1x2 future rows', "SELECT COUNT(*)::int AS n FROM direct1x2_prediction_final WHERE match_date > NOW()"],
        ['canonical_events', 'SELECT COUNT(*)::int AS n FROM canonical_events'],
        ['fixtures total', 'SELECT COUNT(*)::int AS n FROM fixtures'],
        ['fixtures future', "SELECT COUNT(*)::int AS n FROM fixtures WHERE match_date > NOW()"],
        ['predictions_raw total', 'SELECT COUNT(*)::int AS n FROM predictions_raw'],
        ['predictions_raw future', `SELECT COUNT(*)::int AS n FROM predictions_raw WHERE COALESCE(
            CASE WHEN COALESCE(metadata->>'match_time','') ~ '^\\d{4}-' THEN (metadata->>'match_time')::timestamptz END,
            CASE WHEN COALESCE(metadata->>'kickoff','') ~ '^\\d{4}-' THEN (metadata->>'kickoff')::timestamptz END,
            CASE WHEN COALESCE(metadata->>'kickoff_time','') ~ '^\\d{4}-' THEN (metadata->>'kickoff_time')::timestamptz END
        ) > NOW()`],
        ['publish runs by status', 'SELECT status, COUNT(*)::int AS n FROM prediction_publish_runs GROUP BY status ORDER BY status'],
        ['last 3 publish runs', `SELECT id, status, trigger_source, run_scope, total_matches_processed, created_at, completed_at, error_message
            FROM prediction_publish_runs ORDER BY created_at DESC LIMIT 3`],
        ['predictions_raw sports sample', `SELECT sport, COUNT(*)::int AS n FROM predictions_raw GROUP BY sport ORDER BY n DESC LIMIT 10`],
        ['fixtures sample', `SELECT id, sport, home_team, away_team, match_date FROM fixtures ORDER BY match_date DESC LIMIT 5`],
    ];

    for (const [label, sql] of queries) {
        try {
            const res = await pool.query(sql);
            console.log(`\n=== ${label} ===`);
            console.log(JSON.stringify(res.rows, null, 2));
        } catch (err) {
            console.log(`\n=== ${label}: ERROR ===`);
            console.log(err.message);
        }
    }

    await pool.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
