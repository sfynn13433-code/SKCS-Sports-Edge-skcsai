const getWeatherSignal = require('./weatherSignal');
const getAvailabilitySignal = require('./availabilitySignal');
const getDisciplineSignal = require('./disciplineSignal');
const getStabilitySignal = require('./stabilitySignal');

function toRisk(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n > 1 && n <= 100) return Math.max(0, Math.min(1, n / 100));
  return Math.max(0, Math.min(1, n));
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const key = value.trim().toLowerCase();
    if (key === 'true' || key === 'yes' || key === '1' || key === 'confirmed') return true;
    if (key === 'false' || key === 'no' || key === '0' || key === 'unconfirmed') return false;
  }
  return fallback;
}

function ensureMatchContextShape(fixture) {
  if (fixture && fixture.match_info && fixture.sharp_odds && fixture.contextual_intelligence) {
    return fixture;
  }

  const home = fixture?.home_team || fixture?.homeTeam || null;
  const away = fixture?.away_team || fixture?.awayTeam || null;
  const kickoff = fixture?.kickoffTime || fixture?.kickoff || fixture?.date || fixture?.match_time || new Date().toISOString();

  return {
    match_info: {
      match_id: fixture?.match_id || fixture?.id || null,
      league: fixture?.competition || fixture?.league || null,
      country: fixture?.country || null,
      season: fixture?.season || null,
      kickoff,
      venue: fixture?.venue || fixture?.location || null,
      home_team: home,
      away_team: away,
      home_team_id: fixture?.home_team_id || null,
      away_team_id: fixture?.away_team_id || null,
      referee: fixture?.referee || null,
      timezone: fixture?.timezone || null
    },
    sharp_odds: fixture?.sharp_odds && typeof fixture.sharp_odds === 'object' ? fixture.sharp_odds : {},
    contextual_intelligence: {
      weather: fixture?.weather || null,
      injuries: toArray(fixture?.teamData?.injuries),
      suspensions: toArray(fixture?.teamData?.suspensions),
      expected_lineups: toArray(fixture?.teamData?.expectedLineups),
      confirmed_lineups: toArray(fixture?.teamData?.confirmedLineups),
      lineup_confirmed: false,
      morale: fixture?.teamContext?.morale || null,
      coach_conflict: Boolean(fixture?.teamContext?.coachConflict),
      boardroom_instability: Boolean(fixture?.teamContext?.execInstability),
      discipline_risk: null,
      travel_fatigue: null,
      motivation_factor: null,
      fixture_congestion: null,
      derby_risk: null,
      rotation_risk: null,
      public_incidents: toArray(fixture?.teamContext?.playerLegalIssues),
      market_movement: null
    }
  };
}

function buildExtendedSignals(context) {
  const movement = context?.market_movement;
  const movementRisk = typeof movement === 'object'
    ? (movement?.contradicts_model ? 0.4 : 0)
    : typeof movement === 'string' && movement.toLowerCase().includes('contradict')
      ? 0.4
      : 0;

  return {
    travel_fatigue_risk: toRisk(context?.travel_fatigue, 0),
    fixture_congestion_risk: toRisk(context?.fixture_congestion, 0),
    derby_risk: toRisk(context?.derby_risk, 0),
    rotation_risk: toRisk(context?.rotation_risk, 0),
    market_movement_risk: toRisk(movementRisk, 0),
    lineup_uncertainty_risk: context?.lineup_confirmed ? 0 : 0.55
  };
}

async function enrichFixtureWithContext(fixture) {
  const matchContext = ensureMatchContextShape(fixture);
  const matchInfo = matchContext.match_info || {};
  const context = matchContext.contextual_intelligence || {};

  const weather = await getWeatherSignal(
    context.weather,
    matchInfo.venue || fixture?.location,
    matchInfo.kickoff || fixture?.kickoffTime || new Date().toISOString()
  );
  const availability = getAvailabilitySignal(
    context.injuries,
    context.suspensions,
    context.expected_lineups,
    context.confirmed_lineups,
    toBoolean(context.lineup_confirmed, false)
  );
  const discipline = getDisciplineSignal(context.suspensions, context.discipline_risk);
  const stability = getStabilitySignal(
    context.morale,
    context.coach_conflict,
    context.boardroom_instability,
    context.public_incidents
  );
  const extendedSignals = buildExtendedSignals(context);

  return {
    ...matchContext,
    contextSignals: { ...weather, ...availability, ...discipline, ...stability, ...extendedSignals },
    context_status: 'enriched'
  };
}
module.exports = enrichFixtureWithContext;
