'use strict';

require('dotenv').config();
const { Pool } = require('pg');

async function safeQuery(pool, label, sql, params = []) {
    try {
        const res = await pool.query(sql, params);
        console.log(`\n=== ${label} ===`);
        console.log(JSON.stringify(res.rows, null, 2));
        return res.rows;
    } catch (err) {
        console.log(`\n=== ${label}: ERROR ===`);
        console.log(err.message);
        return [];
    }
}

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
    });

    await safeQuery(pool, 'API-Sports quota usage (last 30 days)', `
        SELECT provider_name, window_type, window_start::date AS day,
               MAX(usage_count)::int AS max_usage,
               COUNT(*)::int AS row_samples
        FROM rapidapi_quota_usage
        WHERE provider_name LIKE 'api_sports%'
          AND window_start >= NOW() - INTERVAL '30 days'
        GROUP BY provider_name, window_type, window_start::date
        ORDER BY day DESC, provider_name, window_type
        LIMIT 200
    `);

    await safeQuery(pool, 'API-Sports daily peak by provider (last 30 days)', `
        SELECT provider_name,
               MAX(CASE WHEN window_type = 'day' THEN usage_count END)::int AS peak_daily_usage,
               COUNT(*) FILTER (WHERE window_type = 'day')::int AS day_rows
        FROM rapidapi_quota_usage
        WHERE provider_name LIKE 'api_sports%'
          AND window_start >= NOW() - INTERVAL '30 days'
        GROUP BY provider_name
        ORDER BY peak_daily_usage DESC NULLS LAST
    `);

    await safeQuery(pool, 'Blocked API-Sports attempts (last 30 days)', `
        SELECT DATE(created_at) AS day, provider, reason, source,
               COUNT(*)::int AS blocked_count
        FROM blocked_api_calls_log
        WHERE provider LIKE 'api_sports%'
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at), provider, reason, source
        ORDER BY day DESC, blocked_count DESC
        LIMIT 100
    `);

    await safeQuery(pool, 'Total blocked vs allowed signal (football api_sports)', `
        SELECT
          COUNT(*) FILTER (WHERE provider = 'api_sports_football' AND reason = 'provider_quota_exceeded')::int AS football_blocked_quota,
          COUNT(*) FILTER (WHERE provider = 'api_sports_football')::int AS football_blocked_total
        FROM blocked_api_calls_log
        WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    await pool.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
