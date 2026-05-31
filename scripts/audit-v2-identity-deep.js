/**
 * SKCS Engine V2 — Deep identity audit (read-only)
 * Answers: is 2.6% match real, or a query/aggregation artifact?
 *
 * Usage: node scripts/audit-v2-identity-deep.js
 */
require('dotenv').config();
const { pool } = require('../backend/database');

const FINISHED_STATUSES = new Set([
  'ft', 'finished', 'match finished', 'full time', 'complete', 'completed', 'final'
]);

function normalizeTeamName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s&.-]/g, '')
    .replace(/\bfc\b/g, '')
    .replace(/\bcf\b/g, '')
    .replace(/\bsc\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return row[b.length];
}

function fuzzyRatio(a, b) {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

async function main() {
  if (!pool) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }

  console.log('SKCS Engine V2 — Deep Identity Audit');
  console.log('Time:', new Date().toISOString());
  console.log('');

  // --- How many distinct strings vs distinct normalized names? ---
  const nameStats = await pool.query(`
    WITH home AS (
      SELECT TRIM(home_team) AS raw_name FROM events WHERE sport_key = 'football' AND home_team IS NOT NULL
    ),
    away AS (
      SELECT TRIM(away_team) AS raw_name FROM events WHERE sport_key = 'football' AND away_team IS NOT NULL
    ),
    all_names AS (
      SELECT raw_name FROM home UNION ALL SELECT raw_name FROM away
    )
    SELECT
      COUNT(*)::bigint AS total_name_slots,
      COUNT(DISTINCT raw_name)::bigint AS distinct_raw_strings,
      COUNT(DISTINCT lower(trim(raw_name)))::bigint AS distinct_lower_trim
    FROM all_names
  `);
  console.log('=== Name cardinality (football events) ===');
  console.log(nameStats.rows[0]);
  console.log(
    'Note: total_name_slots = home rows + away rows (~2x event count if names are stable per team).'
  );

  // Top 30 frequent raw names
  const topRaw = await pool.query(`
    WITH all_names AS (
      SELECT TRIM(home_team) AS raw_name FROM events WHERE sport_key = 'football'
      UNION ALL
      SELECT TRIM(away_team) FROM events WHERE sport_key = 'football'
    )
    SELECT raw_name, COUNT(*)::int AS frequency
    FROM all_names
    WHERE raw_name IS NOT NULL AND raw_name <> ''
    GROUP BY raw_name
    ORDER BY frequency DESC
    LIMIT 30
  `);
  console.log('\n=== Top 30 raw team name strings (by slot frequency) ===');
  for (const row of topRaw.rows) {
    console.log(`  ${String(row.frequency).padStart(5)}  ${row.raw_name}`);
  }

  // Top 30 normalized (JS-style) — sample via SQL lower+trim only for speed
  const topNormSql = await pool.query(`
    WITH all_names AS (
      SELECT lower(trim(home_team)) AS norm FROM events WHERE sport_key = 'football'
      UNION ALL
      SELECT lower(trim(away_team)) FROM events WHERE sport_key = 'football'
    )
    SELECT norm, COUNT(*)::int AS frequency
    FROM all_names
    WHERE norm IS NOT NULL AND norm <> ''
    GROUP BY norm
    ORDER BY frequency DESC
    LIMIT 30
  `);
  console.log('\n=== Top 30 SQL-normalized names (lower + trim only) ===');
  for (const row of topNormSql.rows) {
    console.log(`  ${String(row.frequency).padStart(5)}  ${row.norm}`);
  }

  // Entity match rates on DISTINCT names (not slot union inflated)
  const distinctMatch = await pool.query(`
    WITH event_names AS (
      SELECT DISTINCT lower(trim(home_team)) AS norm FROM events
      WHERE sport_key = 'football' AND home_team IS NOT NULL
      UNION
      SELECT DISTINCT lower(trim(away_team)) FROM events
      WHERE sport_key = 'football' AND away_team IS NOT NULL
    ),
    entities AS (
      SELECT DISTINCT lower(trim(name)) AS norm
      FROM canonical_entities
      WHERE lower(sport) IN ('football', 'soccer')
    )
    SELECT
      (SELECT COUNT(*)::int FROM event_names) AS distinct_event_team_names,
      (SELECT COUNT(*)::int FROM entities) AS distinct_entity_names,
      (SELECT COUNT(*)::int FROM event_names en
        INNER JOIN entities e ON en.norm = e.norm) AS exact_match_distinct_names
  `);
  const dm = distinctMatch.rows[0];
  const exactPctDistinct =
    dm.distinct_event_team_names > 0
      ? ((100 * dm.exact_match_distinct_names) / dm.distinct_event_team_names).toFixed(1)
      : '0';
  console.log('\n=== Match rate on DISTINCT team names (not UNION slots) ===');
  console.log(dm);
  console.log(`Exact match (distinct): ${exactPctDistinct}%`);

  // Old audit method (UNION ALL slots) for comparison
  const slotMatch = await pool.query(`
    WITH event_teams AS (
      SELECT TRIM(home_team) AS team_name FROM events WHERE sport_key = 'football' AND home_team IS NOT NULL
      UNION ALL
      SELECT TRIM(away_team) FROM events WHERE sport_key = 'football' AND away_team IS NOT NULL
    ),
    entities AS (
      SELECT DISTINCT lower(trim(name)) AS name_lower FROM canonical_entities
      WHERE lower(sport) IN ('football', 'soccer')
    )
    SELECT
      COUNT(*)::bigint AS total_slots,
      COUNT(DISTINCT lower(trim(team_name)))::bigint AS distinct_in_slots,
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM entities e WHERE e.name_lower = lower(trim(event_teams.team_name))
        )
      )::bigint AS matched_slots
    FROM event_teams
  `);
  const sm = slotMatch.rows[0];
  const slotPct =
    sm.total_slots > 0 ? ((100 * sm.matched_slots) / sm.total_slots).toFixed(1) : '0';
  console.log('\n=== Previous audit method (UNION ALL home+away slots) ===');
  console.log(sm);
  console.log(`Slot-level match: ${slotPct}% (inflated denominator if many unique strings per slot)`);

  // Finished events: how many distinct teams appear
  const finishedTeams = await pool.query(`
    WITH finished AS (
      SELECT * FROM events
      WHERE sport_key = 'football'
        AND home_score IS NOT NULL AND away_score IS NOT NULL
        AND lower(trim(coalesce(status, ''))) IN (
          'ft', 'finished', 'match finished', 'full time', 'complete', 'completed', 'final'
        )
    ),
    names AS (
      SELECT DISTINCT lower(trim(home_team)) AS norm FROM finished
      UNION
      SELECT DISTINCT lower(trim(away_team)) FROM finished
    )
    SELECT
      (SELECT COUNT(*)::int FROM finished) AS finished_events,
      (SELECT COUNT(*)::int FROM names) AS distinct_teams_in_finished
  `);
  console.log('\n=== Finished football events ===');
  console.log(finishedTeams.rows[0]);

  // Sample unmatched distinct names (top by frequency among finished)
  const unmatched = await pool.query(`
    WITH freq AS (
      SELECT lower(trim(n)) AS norm, COUNT(*)::int AS c
      FROM (
        SELECT home_team AS n FROM events WHERE sport_key = 'football'
        UNION ALL
        SELECT away_team FROM events WHERE sport_key = 'football'
      ) x
      WHERE n IS NOT NULL
      GROUP BY 1
    ),
    entities AS (
      SELECT lower(trim(name)) AS norm FROM canonical_entities
      WHERE lower(sport) IN ('football', 'soccer')
    )
    SELECT f.norm, f.c
    FROM freq f
    LEFT JOIN entities e ON f.norm = e.norm
    WHERE e.norm IS NULL
    ORDER BY f.c DESC
    LIMIT 25
  `);
  console.log('\n=== Top 25 frequent names NOT in canonical_entities (lower+trim) ===');
  for (const row of unmatched.rows) {
    console.log(`  ${String(row.c).padStart(5)}  ${row.norm}`);
  }

  // Fuzzy sample: top 100 event distinct names vs entities (in-memory)
  const eventNamesRes = await pool.query(`
    SELECT DISTINCT lower(trim(home_team)) AS norm FROM events WHERE sport_key = 'football'
    UNION
    SELECT DISTINCT lower(trim(away_team)) FROM events WHERE sport_key = 'football'
  `);
  const entityNamesRes = await pool.query(`
    SELECT DISTINCT name FROM canonical_entities WHERE lower(sport) IN ('football', 'soccer')
  `);
  const entityNames = entityNamesRes.rows.map((r) => r.name);

  let fuzzyHit = 0;
  const fuzzyThreshold = 0.92;
  for (const row of eventNamesRes.rows) {
    const norm = row.norm;
    let best = 0;
    for (const en of entityNames) {
      const score = fuzzyRatio(norm, en);
      if (score > best) best = score;
      if (best >= fuzzyThreshold) break;
    }
    if (best >= fuzzyThreshold) fuzzyHit++;
  }
  const totalDistinct = eventNamesRes.rows.length;
  const fuzzyPct = totalDistinct > 0 ? ((100 * fuzzyHit) / totalDistinct).toFixed(1) : '0';
  console.log('\n=== Fuzzy match (in-memory, distinct event names) ===');
  console.log(`Threshold: ${fuzzyThreshold}`);
  console.log(`Distinct event names tested: ${totalDistinct}`);
  console.log(`Fuzzy matched: ${fuzzyHit} (${fuzzyPct}%)`);

  // League attribution probe
  const leagueProbe = await pool.query(`
    SELECT
      COUNT(*)::int AS finished_events,
      COUNT(*) FILTER (WHERE sport_key IS NOT NULL AND sport_key <> '')::int AS has_sport_key
    FROM events
    WHERE sport_key = 'football'
      AND home_score IS NOT NULL AND away_score IS NOT NULL
      AND lower(trim(coalesce(status, ''))) IN ('ft', 'finished', 'match finished', 'full time')
  `);
  console.log('\n=== League attribution probe (events table) ===');
  console.log(leagueProbe.rows[0]);
  console.log('events.sport_key is NOT league — league must come from football_canonical_events or API backfill.');

  if (await pool.query(`SELECT to_regclass('public.football_canonical_events')::text`).then((r) => r.rows[0].rel)) {
    const fce = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE competition_name IS NOT NULL AND competition_name <> '')::int AS has_competition
      FROM football_canonical_events
    `);
    console.log('football_canonical_events competition_name coverage:', fce.rows[0]);
  }

  await pool.end();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
