/**
 * SKCS Engine V2 — Provider-ID coverage probe (read-only)
 * Run BEFORE applying Phase 0 migrations to size JSON extract feasibility.
 */
require('dotenv').config();
const { pool } = require('../backend/database');

async function main() {
  if (!pool) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }

  const exists = await pool.query(
    `SELECT to_regclass('public.football_canonical_events')::text AS rel`
  );
  if (!exists.rows[0]?.rel) {
    console.log('football_canonical_events not found');
    await pool.end();
    return;
  }

  console.log('SKCS V2 — Provider coverage probe');
  console.log('Time:', new Date().toISOString());

  const summary = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE raw_provider_data #>> '{teams,home,id}' IS NOT NULL
          AND raw_provider_data #>> '{teams,away,id}' IS NOT NULL
      )::int AS has_both_team_ids,
      COUNT(*) FILTER (
        WHERE raw_provider_data #>> '{goals,home}' IS NOT NULL
          AND raw_provider_data #>> '{goals,away}' IS NOT NULL
      )::int AS has_goals_in_json,
      COUNT(*) FILTER (
        WHERE lower(coalesce(
          raw_provider_data #>> '{fixture,status,short}',
          status, ''
        )) IN ('ft', 'finished', 'aet', 'pen')
      )::int AS finished_short_status,
      COUNT(*) FILTER (
        WHERE raw_provider_data #>> '{league,id}' IS NOT NULL
          OR competition_name IS NOT NULL
      )::int AS has_league_hint
    FROM football_canonical_events
  `);
  console.log('\nfootball_canonical_events:', summary.rows[0]);

  const entities = await pool.query(`
    SELECT COUNT(*)::int AS n FROM canonical_entities
    WHERE lower(sport) IN ('football', 'soccer')
  `);
  console.log('canonical_entities (football):', entities.rows[0].n);

  const byProvider = await pool.query(`
    SELECT COALESCE(provider_name, '(null)') AS provider_name, COUNT(*)::int AS n
    FROM football_canonical_events GROUP BY 1 ORDER BY n DESC
  `);
  console.log('\nBy provider_name:', byProvider.rows);

  const topKeys = await pool.query(`
    SELECT k, COUNT(*)::int AS c
    FROM football_canonical_events fce,
    LATERAL jsonb_object_keys(COALESCE(fce.raw_provider_data, '{}'::jsonb)) AS k
    GROUP BY k ORDER BY c DESC LIMIT 15
  `);
  console.log('\nTop-level JSON keys in raw_provider_data:', topKeys.rows);

  const shape = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE raw_provider_data ? 'strHomeTeam')::int AS thesportsdb_shape,
      COUNT(*) FILTER (WHERE raw_provider_data ? 'fixture')::int AS apisports_shape,
      COUNT(*) FILTER (WHERE raw_provider_data ? 'match_info')::int AS normalized_shape,
      COUNT(*) FILTER (WHERE raw_provider_data ? 'teams')::int AS has_teams_key
    FROM football_canonical_events
  `);
  console.log('\nPayload shape counts:', shape.rows[0]);

  const samples = await pool.query(`
    SELECT provider_name, left(raw_provider_data::text, 180) AS snippet
    FROM football_canonical_events
    WHERE raw_provider_data IS NOT NULL
    ORDER BY random() LIMIT 2
  `);
  console.log('\nRandom payload snippets:');
  for (const row of samples.rows) console.log(`  [${row.provider_name}] ${row.snippet}`);

  const canonicalEventsExists = await pool.query(
    `SELECT to_regclass('public.canonical_events')::text AS rel`
  );
  console.log('\ncanonical_events table exists:', Boolean(canonicalEventsExists.rows[0]?.rel));

  await pool.end();
  console.log('\nDone. Apply migrations then run ingest_match_results_from_football_canonical().');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
