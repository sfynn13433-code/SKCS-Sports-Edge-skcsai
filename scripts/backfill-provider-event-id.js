'use strict';

const { query } = require('../backend/db');

async function backfill() {
    // Step 1: Backfill provider_event_id from raw_provider_data for non-conflicting rows
    // Use a CTE to compute the desired value and only update rows that won't conflict
    const sql = `
        WITH candidates AS (
            SELECT 
                ce.id,
                COALESCE(
                    ce.raw_provider_data->'fixture'->>'id',
                    ce.raw_provider_data->>'match_id',
                    ce.raw_provider_data->'game'->>'id',
                    ce.raw_provider_data->'fight'->>'id',
                    ce.raw_provider_data->'race'->>'id',
                    ce.raw_provider_data->>'id',
                    ce.id::text
                ) AS derived_event_id,
                ce.provider_name,
                ce.sport
            FROM canonical_events ce
            WHERE ce.provider_event_id IS NULL
        ),
        -- Keep only the first (by id) among duplicates
        ranked AS (
            SELECT *,
                ROW_NUMBER() OVER (
                    PARTITION BY provider_name, sport, derived_event_id
                    ORDER BY id
                ) AS rn
            FROM candidates
        ),
        safe AS (
            SELECT id, derived_event_id
            FROM ranked
            WHERE rn = 1
              AND NOT EXISTS (
                  SELECT 1 FROM canonical_events existing
                  WHERE existing.provider_name = ranked.provider_name
                    AND existing.sport = ranked.sport
                    AND existing.provider_event_id = ranked.derived_event_id
              )
        )
        UPDATE canonical_events ce
        SET provider_event_id = safe.derived_event_id
        FROM safe
        WHERE ce.id = safe.id
    `;

    const result = await query(sql);
    console.log(`Backfilled ${result.rowCount} rows with provider_event_id`);

    // Step 2: Check how many are still null
    const { rows } = await query(
        "SELECT COUNT(*) as still_null FROM canonical_events WHERE provider_event_id IS NULL"
    );
    console.log(`Still null: ${rows[0].still_null}`);

    process.exit(0);
}

backfill().catch(e => { console.error(e.message); process.exit(1); });
