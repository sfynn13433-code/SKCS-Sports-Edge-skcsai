/**
 * SKCS Engine V2 — Phase 0 foundation audits (read-only)
 * Audit 1: Finished football matches with scores
 * Audit 2: Team identity mappability across sources
 */
require('dotenv').config();
const { pool } = require('../backend/database');

async function tableExists(name) {
  const r = await pool.query(
    `SELECT to_regclass($1)::text AS rel`,
    [`public.${name}`]
  );
  return Boolean(r.rows[0]?.rel);
}

async function safeQuery(label, sql, params = []) {
  try {
    const r = await pool.query(sql, params);
    return { ok: true, rows: r.rows, rowCount: r.rowCount };
  } catch (err) {
    return { ok: false, error: err.message, label };
  }
}

async function auditEventsTable() {
  console.log('\n=== AUDIT 1a: events (finished matches with scores) ===\n');
  if (!(await tableExists('events'))) {
    console.log('Table public.events does not exist.');
    return;
  }

  const total = await safeQuery('events total', `SELECT COUNT(*)::bigint AS n FROM events`);
  console.log('Total events rows:', total.ok ? total.rows[0].n : total.error);

  const bySport = await safeQuery(
    'events by sport_key',
    `
    SELECT COALESCE(sport_key, '(null)') AS sport_key, COUNT(*)::bigint AS total
    FROM events
    GROUP BY 1
    ORDER BY total DESC
    `
  );
  if (bySport.ok) {
    console.log('\nBy sport_key:');
    for (const row of bySport.rows) console.log(`  ${row.sport_key}: ${row.total}`);
  }

  const footballFt = await safeQuery(
    'events football FT scored',
    `
    SELECT COUNT(*)::bigint AS finished_with_scores
    FROM events e
    WHERE e.status = 'FT'
      AND e.home_score IS NOT NULL
      AND e.away_score IS NOT NULL
      AND (
        LOWER(COALESCE(e.sport_key, '')) IN ('soccer', 'football', 'soccer_epl', 'soccer_uefa')
        OR LOWER(COALESCE(e.sport_key, '')) LIKE '%soccer%'
        OR LOWER(COALESCE(e.sport_key, '')) LIKE '%football%'
      )
    `
  );
  console.log(
    '\nFootball-like FT with scores:',
    footballFt.ok ? footballFt.rows[0].finished_with_scores : footballFt.error
  );

  const allFt = await safeQuery(
    'events all FT scored',
    `
    SELECT COUNT(*)::bigint AS n
    FROM events e
    WHERE e.status = 'FT'
      AND e.home_score IS NOT NULL
      AND e.away_score IS NOT NULL
    `
  );
  console.log('All sports FT with scores:', allFt.ok ? allFt.rows[0].n : allFt.error);

  const byLeagueProxy = await safeQuery(
    'events FT by sport_key (proxy for league)',
    `
    SELECT COALESCE(sport_key, '(null)') AS league_proxy, COUNT(*)::bigint AS matches
    FROM events
    WHERE status = 'FT'
      AND home_score IS NOT NULL
      AND away_score IS NOT NULL
    GROUP BY 1
    ORDER BY matches DESC
    LIMIT 30
    `
  );
  if (byLeagueProxy.ok) {
    console.log('\nFT+scored by sport_key (top 30):');
    for (const row of byLeagueProxy.rows) {
      console.log(`  ${row.league_proxy}: ${row.matches}`);
    }
  }
}

async function auditCanonicalEvents() {
  console.log('\n=== AUDIT 1b: canonical_events (finished + scores in payload) ===\n');
  if (!(await tableExists('canonical_events'))) {
    console.log('Table public.canonical_events does not exist.');
    return;
  }

  const total = await safeQuery(
    'canonical_events total',
    `SELECT COUNT(*)::bigint AS n FROM canonical_events WHERE LOWER(sport) IN ('football', 'soccer')`
  );
  console.log('Football canonical_events:', total.ok ? total.rows[0].n : total.error);

  const withEntities = await safeQuery(
    'canonical_events with entity FKs',
    `
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE home_entity_id IS NOT NULL AND away_entity_id IS NOT NULL)::bigint AS both_entities
    FROM canonical_events
    WHERE LOWER(sport) IN ('football', 'soccer')
    `
  );
  if (withEntities.ok) {
    const r = withEntities.rows[0];
    const pct = r.total > 0 ? ((100 * r.both_entities) / r.total).toFixed(1) : '0';
    console.log(`With home_entity_id + away_entity_id: ${r.both_entities} / ${r.total} (${pct}%)`);
  }

  const finishedJson = await safeQuery(
    'canonical_events finished from JSON',
    `
    SELECT COUNT(*)::bigint AS n
    FROM canonical_events ce
    WHERE LOWER(ce.sport) IN ('football', 'soccer')
      AND (
        UPPER(COALESCE(ce.status, '')) IN ('FT', 'MATCH FINISHED', 'FINISHED', 'FULL TIME')
        OR UPPER(COALESCE(ce.raw_provider_data->'fixture'->'status'->>'short', '')) = 'FT'
        OR UPPER(COALESCE(ce.raw_provider_data->'fixture'->'status'->>'long', '')) LIKE '%FINISH%'
      )
      AND NULLIF(ce.raw_provider_data->'goals'->>'home', '') IS NOT NULL
      AND NULLIF(ce.raw_provider_data->'goals'->>'away', '') IS NOT NULL
    `
  );
  console.log(
    'Finished (status/JSON) with goals.home/away in payload:',
    finishedJson.ok ? finishedJson.rows[0].n : finishedJson.error
  );

  const byComp = await safeQuery(
    'canonical_events FT by competition',
    `
    SELECT competition_name, COUNT(*)::bigint AS matches
    FROM canonical_events ce
    WHERE LOWER(ce.sport) IN ('football', 'soccer')
      AND (
        UPPER(COALESCE(ce.status, '')) IN ('FT', 'MATCH FINISHED', 'FINISHED', 'FULL TIME')
        OR UPPER(COALESCE(ce.raw_provider_data->'fixture'->'status'->>'short', '')) = 'FT'
      )
      AND NULLIF(ce.raw_provider_data->'goals'->>'home', '') IS NOT NULL
      AND NULLIF(ce.raw_provider_data->'goals'->>'away', '') IS NOT NULL
    GROUP BY competition_name
    ORDER BY matches DESC
    LIMIT 25
    `
  );
  if (byComp.ok && byComp.rows.length) {
    console.log('\nFinished+scored by competition_name (top 25):');
    for (const row of byComp.rows) console.log(`  ${row.competition_name}: ${row.matches}`);
  }
}

async function auditIdentity() {
  console.log('\n=== AUDIT 2: Team identity mappability ===\n');

  const hasEntities = await tableExists('canonical_entities');
  const hasEvents = await tableExists('events');
  const hasCe = await tableExists('canonical_events');

  if (!hasEntities) {
    console.log('canonical_entities missing — identity audit limited.');
  } else {
    const ent = await safeQuery(
      'canonical_entities football',
      `
      SELECT COUNT(*)::bigint AS n,
             COUNT(DISTINCT LOWER(TRIM(name)))::bigint AS distinct_names
      FROM canonical_entities
      WHERE LOWER(sport) IN ('football', 'soccer')
      `
    );
    if (ent.ok) {
      console.log(
        `canonical_entities (football): ${ent.rows[0].n} rows, ${ent.rows[0].distinct_names} distinct normalized names`
      );
    }

    const dupNames = await safeQuery(
      'duplicate names different provider_id',
      `
      SELECT LOWER(TRIM(name)) AS name, COUNT(DISTINCT provider_id)::int AS provider_ids, COUNT(*)::int AS rows
      FROM canonical_entities
      WHERE LOWER(sport) IN ('football', 'soccer')
      GROUP BY 1
      HAVING COUNT(DISTINCT provider_id) > 1
      ORDER BY provider_ids DESC
      LIMIT 15
      `
    );
    if (dupNames.ok) {
      console.log(
        `\nNames mapped to multiple provider_ids (sample, top 15): ${dupNames.rows.length} name groups`
      );
      for (const row of dupNames.rows) {
        console.log(`  "${row.name}": ${row.provider_ids} provider_ids, ${row.rows} rows`);
      }
    }
  }

  if (hasEvents && hasEntities) {
    const matchByName = await safeQuery(
      'events teams match canonical_entities by exact name',
      `
      WITH event_teams AS (
        SELECT DISTINCT TRIM(home_team) AS team_name FROM events WHERE home_team IS NOT NULL
        UNION
        SELECT DISTINCT TRIM(away_team) FROM events WHERE away_team IS NOT NULL
      ),
      entities AS (
        SELECT DISTINCT LOWER(TRIM(name)) AS name_lower, id
        FROM canonical_entities
        WHERE LOWER(sport) IN ('football', 'soccer')
      )
      SELECT
        (SELECT COUNT(*)::bigint FROM event_teams) AS distinct_event_team_names,
        (SELECT COUNT(*)::bigint FROM event_teams et
          INNER JOIN entities e ON LOWER(TRIM(et.team_name)) = e.name_lower) AS matched_to_entity,
        (SELECT COUNT(*)::bigint FROM event_teams et
          LEFT JOIN entities e ON LOWER(TRIM(et.team_name)) = e.name_lower
          WHERE e.id IS NULL) AS unmatched_event_names
      `
    );
    if (matchByName.ok) {
      const r = matchByName.rows[0];
      const pct =
        r.distinct_event_team_names > 0
          ? ((100 * r.matched_to_entity) / r.distinct_event_team_names).toFixed(1)
          : '0';
      console.log('\n--- events team names vs canonical_entities (exact name match) ---');
      console.log(`Distinct team names in events: ${r.distinct_event_team_names}`);
      console.log(`Matched to canonical_entities: ${r.matched_to_entity} (${pct}%)`);
      console.log(`Unmatched: ${r.unmatched_event_names}`);
    }
  }

  if (hasCe) {
    const providers = await safeQuery(
      'canonical_events by provider_name',
      `
      SELECT COALESCE(provider_name, '(null)') AS provider_name, COUNT(*)::bigint AS n
      FROM canonical_events
      WHERE LOWER(sport) IN ('football', 'soccer')
      GROUP BY 1
      ORDER BY n DESC
      `
    );
    if (providers.ok) {
      console.log('\n--- canonical_events ingest by provider_name ---');
      for (const row of providers.rows) console.log(`  ${row.provider_name}: ${row.n}`);
    }
  }

  const hasTeamStrength = await tableExists('team_strength_params');
  console.log(`\nteam_strength_params exists: ${hasTeamStrength}`);
  if (hasTeamStrength) {
    const tsp = await safeQuery('tsp count', `SELECT COUNT(*)::bigint AS n FROM team_strength_params`);
    console.log('team_strength_params rows:', tsp.ok ? tsp.rows[0].n : tsp.error);
  }

  const hasIdentityMap = await tableExists('team_identity_map');
  console.log(`team_identity_map exists: ${hasIdentityMap}`);
}

async function auditFootballCanonicalEvents() {
  console.log('\n=== AUDIT 1d: football_canonical_events ===\n');
  if (!(await tableExists('football_canonical_events'))) {
    console.log('Table public.football_canonical_events does not exist.');
    return;
  }

  const cols = await safeQuery(
    'columns',
    `
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'football_canonical_events'
    ORDER BY ordinal_position
    `
  );
  if (cols.ok) {
    console.log('Columns:', cols.rows.map((r) => r.column_name).join(', '));
  }

  const summary = await safeQuery(
    'summary',
    `
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) IN ('ft', 'finished', 'match finished', 'full time'))::bigint AS finished_status,
      COUNT(*) FILTER (WHERE home_entity_id IS NOT NULL AND away_entity_id IS NOT NULL)::bigint AS both_entities,
      COUNT(*) FILTER (
        WHERE NULLIF(raw_provider_data->'goals'->>'home', '') IS NOT NULL
          AND NULLIF(raw_provider_data->'goals'->>'away', '') IS NOT NULL
      )::bigint AS json_goals
    FROM football_canonical_events
    `
  );
  if (summary.ok) console.log('Summary:', summary.rows[0]);

  const finishedScored = await safeQuery(
    'finished scored by competition',
    `
    SELECT competition_name, COUNT(*)::bigint AS matches
    FROM football_canonical_events
    WHERE LOWER(COALESCE(status, '')) IN ('ft', 'finished', 'match finished', 'full time')
      AND NULLIF(raw_provider_data->'goals'->>'home', '') IS NOT NULL
      AND NULLIF(raw_provider_data->'goals'->>'away', '') IS NOT NULL
    GROUP BY competition_name
    ORDER BY matches DESC
    LIMIT 20
    `
  );
  if (finishedScored.ok && finishedScored.rows.length) {
    console.log('\nFinished + goals in JSON by competition (top 20):');
    for (const row of finishedScored.rows) {
      console.log(`  ${row.competition_name}: ${row.matches}`);
    }
  }

  const eventsFinished = await safeQuery(
    'events finished status with scores',
    `
    SELECT COUNT(*)::bigint AS n
    FROM events
    WHERE sport_key = 'football'
      AND LOWER(COALESCE(status, '')) IN ('finished', 'ft')
      AND home_score IS NOT NULL
      AND away_score IS NOT NULL
    `
  );
  console.log(
    '\nevents football (status finished OR ft) with scores:',
    eventsFinished.ok ? eventsFinished.rows[0].n : eventsFinished.error
  );
}

async function auditFollowUp() {
  console.log('\n=== AUDIT 1c: Follow-up (status distribution, tables) ===\n');

  const statusDist = await safeQuery(
    'football status',
    `
    SELECT COALESCE(status, '(null)') AS status, COUNT(*)::bigint AS n
    FROM events WHERE sport_key = 'football'
    GROUP BY 1 ORDER BY n DESC LIMIT 20
    `
  );
  if (statusDist.ok) {
    console.log('Football events by status:');
    for (const row of statusDist.rows) console.log(`  ${row.status}: ${row.n}`);
  }

  const scoreAny = await safeQuery(
    'football scores any status',
    `
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE home_score IS NOT NULL AND away_score IS NOT NULL)::bigint AS with_scores,
      COUNT(*) FILTER (WHERE status = 'FT')::bigint AS status_ft
    FROM events WHERE sport_key = 'football'
    `
  );
  if (scoreAny.ok) console.log('\nFootball score coverage:', scoreAny.rows[0]);

  const canonicalTables = await safeQuery(
    'canonical tables',
    `
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE '%canonical%'
    ORDER BY table_name
    `
  );
  if (canonicalTables.ok) {
    console.log('\nTables matching %canonical%:', canonicalTables.rows.map((r) => r.table_name).join(', ') || '(none)');
  }

  for (const t of ['football_canonical_events', 'normalized_fixtures', 'raw_fixtures']) {
    const exists = await tableExists(t);
    if (exists) {
      const c = await safeQuery(t, `SELECT COUNT(*)::bigint AS n FROM ${t}`);
      console.log(`${t} rows:`, c.ok ? c.rows[0].n : c.error);
    }
  }

  const nameLen = await safeQuery(
    'events team name length stats',
    `
    SELECT
      MAX(LENGTH(home_team))::int AS max_home_len,
      COUNT(*) FILTER (WHERE LENGTH(home_team) > 80)::bigint AS long_home_names,
      COUNT(DISTINCT LEFT(TRIM(home_team), 40))::bigint AS distinct_home_prefix40
    FROM events WHERE sport_key = 'football'
    `
  );
  if (nameLen.ok) console.log('\nFootball home_team string quality:', nameLen.rows[0]);

  const samples = await safeQuery(
    'sample home_team values',
    `SELECT home_team, COUNT(*)::int c FROM events
     WHERE sport_key='football' GROUP BY 1 ORDER BY c DESC LIMIT 5`
  );
  if (samples.ok) {
    console.log('\nTop 5 most frequent football home_team values in events:');
    for (const row of samples.rows) {
      console.log(`  [${row.c}x] ${String(row.home_team).slice(0, 60)}`);
    }
  }

  if (await tableExists('predictions_accuracy')) {
    const pa = await safeQuery('pa', `SELECT COUNT(*)::bigint AS n FROM predictions_accuracy`);
    const paScored = await safeQuery(
      'pa scored',
      `SELECT COUNT(*)::bigint AS n FROM predictions_accuracy
       WHERE actual_home_score IS NOT NULL AND actual_away_score IS NOT NULL`
    );
    console.log('\npredictions_accuracy rows:', pa.ok ? pa.rows[0].n : pa.error);
    console.log('predictions_accuracy with actual scores:', paScored.ok ? paScored.rows[0].n : paScored.error);
  }
}

async function main() {
  if (!pool) {
    console.error('No DATABASE_URL / pool — cannot run live audit.');
    process.exit(1);
  }
  console.log('SKCS Engine V2 — Foundation audits (live DB)');
  console.log('Time:', new Date().toISOString());

  await auditEventsTable();
  await auditCanonicalEvents();
  await auditIdentity();
  await auditFootballCanonicalEvents();
  await auditFollowUp();

  await pool.end();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
