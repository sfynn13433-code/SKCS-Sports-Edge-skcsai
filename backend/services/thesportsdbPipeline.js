/**
 * TheSportsDB Data Pipeline Service
 * 
 * This service handles the three-stage data lifecycle:
 * 1. syncDailyFixtures(date) - Discovery layer: populate raw_fixtures table
 * 2. enrichMatchContext(idEvent) - Deep insight layer: fetch lineups, stats, timeline
 * 3. generateEdgeMindInsight(idEvent) - AI prediction layer: generate insights
 * 
 * All API calls to TheSportsDB pass through the ApiQueue rate limiter (25 calls/min).
 */

const { apiQueue } = require('../utils/apiQueue');
const db = require('../db'); // PostgreSQL pool

// TheSportsDB API configuration
const THESPORTSDB_BASE_URL = 'https://www.thesportsdb.com/api/v1/json/3';

/**
 * syncDailyFixtures(date)
 * Uses the undocumented searchevents.php?d= endpoint to populate raw_fixtures.
 * 
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<number>} - Number of fixtures synced
 */
async function syncDailyFixtures(date) {
  const url = `${THESPORTSDB_BASE_URL}/eventsday.php?d=${date}`;

  const response = await apiQueue.add(async () => {
    const fetch = require('node-fetch');
    const res = await fetch(url);
    const rawText = await res.text();

    if (!res.ok) {
      console.error(`[syncDailyFixtures] TheSportsDB API error: ${res.status}`, rawText);
      return null;
    }

    if (!rawText || rawText.trim() === '') {
      console.error(`[syncDailyFixtures] TheSportsDB returned empty response`);
      return null;
    }

    try {
      return JSON.parse(rawText);
    } catch (err) {
      console.error(`[syncDailyFixtures] TheSportsDB returned invalid JSON:`, rawText);
      return null;
    }
  });

  if (!response) {
    console.error(`[syncDailyFixtures] Failed to fetch data for ${date}`);
    return 0;
  }

  const events = response.events || response.event || [];
  let syncedCount = 0;

  for (const event of events) {
    const idEvent = event.idEvent;
    if (!idEvent) continue;

    const query = `
      INSERT INTO raw_fixtures (id_event, sport, league_id, home_team_id, away_team_id, start_time, raw_json)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id_event) DO UPDATE SET
        raw_json = EXCLUDED.raw_json,
        updated_at = NOW()
    `;

    const values = [
      idEvent,
      event.strSport || 'Unknown',
      event.idLeague,
      event.idHomeTeam,
      event.idAwayTeam,
      event.dateEvent ? new Date(`${event.dateEvent} ${event.strTime || '00:00'}Z`) : null,
      JSON.stringify(event)
    ];

    try {
      await db.query(query, values);
      syncedCount++;
    } catch (err) {
      console.error(`[syncDailyFixtures] Failed to upsert event ${idEvent}:`, err.message);
    }
  }

  console.log(`[syncDailyFixtures] Synced ${syncedCount} fixtures for ${date}`);
  return syncedCount;
}

/**
 * enrichMatchContext(idEvent)
 * Checks if the match starts within 6 hours.
 * Calls lookupevent.php, lookupeventlineup.php, lookupeventstats.php, and lookuptimeline.php via apiQueue.
 * Upserts the combined data into match_context_data.
 * 
 * @param {string} idEvent - TheSportsDB event ID
 * @returns {Promise<boolean>} - True if enrichment successful
 */
async function enrichMatchContext(idEvent) {
  // First, check if match is within 6 hours
  const fixtureQuery = 'SELECT start_time FROM raw_fixtures WHERE id_event = $1';
  const fixtureResult = await db.query(fixtureQuery, [idEvent]);
  
  if (fixtureResult.rows.length === 0) {
    console.error(`[enrichMatchContext] Fixture ${idEvent} not found in raw_fixtures`);
    return false;
  }

  const startTime = new Date(fixtureResult.rows[0].start_time);
  const now = new Date();
  const hoursUntilMatch = (startTime - now) / (1000 * 60 * 60);

  // Only enrich if match is within 6 hours
  if (hoursUntilMatch > 6) {
    console.log(`[enrichMatchContext] Event ${idEvent} is ${hoursUntilMatch.toFixed(1)}h away. Skipping enrichment.`);
    return false;
  }

  console.log(`[enrichMatchContext] Enriching event ${idEvent} (${hoursUntilMatch.toFixed(1)}h until match)`);

  // Fetch all required data via API queue
  const [eventData, lineupData, statsData, timelineData] = await Promise.all([
    apiQueue.add(() => fetchTheSportsDB(`lookupevent.php?id=${idEvent}`)),
    apiQueue.add(() => fetchTheSportsDB(`lookupeventlineup.php?id=${idEvent}`)),
    apiQueue.add(() => fetchTheSportsDB(`lookupeventstats.php?id=${idEvent}`)),
    apiQueue.add(() => fetchTheSportsDB(`lookuptimeline.php?id=${idEvent}`))
  ]);

  // Extract home and away team IDs from event data
  const event = eventData.events?.[0] || {};
  const homeTeamId = event.idHomeTeam;
  const awayTeamId = event.idAwayTeam;

  // Fetch last 5 results for both teams
  const [homeLast5, awayLast5] = await Promise.all([
    apiQueue.add(() => fetchTheSportsDB(`searchlastteam.php?id=${homeTeamId}`)),
    apiQueue.add(() => fetchTheSportsDB(`searchlastteam.php?id=${awayTeamId}`))
  ]);

  const query = `
    INSERT INTO match_context_data (id_event, lineups, stats, timeline, home_last_5, away_last_5)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (id_event) DO UPDATE SET
      lineups = EXCLUDED.lineups,
      stats = EXCLUDED.stats,
      timeline = EXCLUDED.timeline,
      home_last_5 = EXCLUDED.home_last_5,
      away_last_5 = EXCLUDED.away_last_5,
      updated_at = NOW()
  `;

  const values = [
    idEvent,
    JSON.stringify(lineupData),
    JSON.stringify(statsData),
    JSON.stringify(timelineData),
    JSON.stringify(homeLast5),
    JSON.stringify(awayLast5)
  ];

  try {
    await db.query(query, values);
    console.log(`[enrichMatchContext] Successfully enriched event ${idEvent}`);
    return true;
  } catch (err) {
    console.error(`[enrichMatchContext] Failed to upsert context for ${idEvent}:`, err.message);
    return false;
  }
}

/**
 * generateEdgeMindInsight(idEvent)
 * Reads from match_context_data.
 * Logic: If stats.possession > 60% AND last_5_results are mostly losses, set edgemind_feedback.
 * Upserts final payload into ai_predictions.
 * 
 * @param {string} idEvent - TheSportsDB event ID
 * @returns {Promise<boolean>} - True if insight generated successfully
 */
async function generateEdgeMindInsight(idEvent) {
  // Fetch match context data
  const contextQuery = 'SELECT * FROM match_context_data WHERE id_event = $1';
  const contextResult = await db.query(contextQuery, [idEvent]);

  if (contextResult.rows.length === 0) {
    console.error(`[generateEdgeMindInsight] No context data for event ${idEvent}`);
    return false;
  }

  const context = contextResult.rows[0];
  const stats = context.stats || {};
  const homeLast5 = context.home_last_5 || {};
  const awayLast5 = context.away_last_5 || {};

  // Calculate possession from stats (TheSportsDB returns stats as array)
  const homePossession = extractPossession(stats, 'Home');
  const awayPossession = extractPossession(stats, 'Away');

  // Calculate recent form (wins/losses in last 5)
  const homeForm = calculateForm(homeLast5);
  const awayForm = calculateForm(awayLast5);

  // EdgeMind logic: Possession dominant but lacks finishing
  let edgemindFeedback = 'Standard match probability.';
  let confidenceScore = 50;

  if (homePossession > 60 && homeForm.losses >= 3) {
    edgemindFeedback = 'Home team possession dominant but lacks finishing. Potential Under/Draw value.';
    confidenceScore = 65;
  } else if (awayPossession > 60 && awayForm.losses >= 3) {
    edgemindFeedback = 'Away team possession dominant but lacks finishing. Potential Under/Draw value.';
    confidenceScore = 65;
  } else if (homePossession > 55 && homeForm.wins >= 3) {
    edgemindFeedback = 'Home team in strong form with possession control. Solid home win probability.';
    confidenceScore = 75;
  } else if (awayPossession > 55 && awayForm.wins >= 3) {
    edgemindFeedback = 'Away team in strong form with possession control. Solid away win probability.';
    confidenceScore = 70;
  }

  // Generate placeholder value combos and same match builder (can be enhanced later)
  const valueCombos = {
    under_over: confidenceScore > 65 ? 'Under 2.5 Goals' : null,
    double_chance: confidenceScore < 60 ? 'Double Chance (1X or X2)' : null
  };

  const sameMatchBuilder = {
    legs: [
      { market: 'Match Winner', prediction: confidenceScore > 60 ? 'Home' : 'Draw', confidence: confidenceScore },
      { market: 'Over/Under 2.5', prediction: confidenceScore > 65 ? 'Under' : 'Over', confidence: confidenceScore - 10 }
    ]
  };

  const query = `
    INSERT INTO ai_predictions (match_id, confidence_score, edgemind_feedback, value_combos, same_match_builder)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (match_id) DO UPDATE SET
      confidence_score = EXCLUDED.confidence_score,
      edgemind_feedback = EXCLUDED.edgemind_feedback,
      value_combos = EXCLUDED.value_combos,
      same_match_builder = EXCLUDED.same_match_builder,
      updated_at = NOW()
  `;

  const values = [
    idEvent,
    confidenceScore,
    edgemindFeedback,
    JSON.stringify(valueCombos),
    JSON.stringify(sameMatchBuilder)
  ];

  try {
    await db.query(query, values);
    console.log(`[generateEdgeMindInsight] Generated insight for event ${idEvent}: ${edgemindFeedback}`);
    return true;
  } catch (err) {
    console.error(`[generateEdgeMindInsight] Failed to upsert prediction for ${idEvent}:`, err.message);
    return false;
  }
}

/**
 * Helper: Fetch from TheSportsDB API
 */
async function fetchTheSportsDB(endpoint) {
  const fetch = require('node-fetch');
  const url = `${THESPORTSDB_BASE_URL}/${endpoint}`;
  const res = await fetch(url);
  const rawText = await res.text();

  if (!res.ok) {
    console.error(`[fetchTheSportsDB] TheSportsDB API error: ${res.status}`, rawText);
    return null;
  }

  if (!rawText || rawText.trim() === '') {
    console.error(`[fetchTheSportsDB] TheSportsDB returned empty response`);
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch (err) {
    console.error(`[fetchTheSportsDB] TheSportsDB returned invalid JSON:`, rawText);
    return null;
  }
}

/**
 * Helper: Extract possession percentage from stats array
 */
function extractPossession(stats, team) {
  if (!stats || !stats.stats) return 0;
  const possessionStat = stats.stats.find(s => s.strStat === 'Possession %' && s.strTeam === team);
  return possessionStat ? parseInt(possessionStat.strStat.split('%')[0]) || 0 : 0;
}

/**
 * Helper: Calculate form (wins/losses) from last 5 results
 */
function calculateForm(last5Data) {
  if (!last5Data || !last5Data.results) return { wins: 0, losses: 0, draws: 0 };
  
  const results = last5Data.results.slice(0, 5);
  let wins = 0, losses = 0, draws = 0;

  results.forEach(r => {
    if (r.intHomeScore !== null && r.intAwayScore !== null) {
      if (r.intHomeScore > r.intAwayScore) wins++;
      else if (r.intHomeScore < r.intAwayScore) losses++;
      else draws++;
    }
  });

  return { wins, losses, draws };
}

module.exports = {
  syncDailyFixtures,
  enrichMatchContext,
  generateEdgeMindInsight
};
