'use strict';

const { runPipelineForMatches } = require('../backend/services/aiPipeline');
const adjustProbability = require('../backend/src/services/contextIntelligence/adjustProbability');

function readArg(name, fallback) {
  const key = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(key));
  return arg ? arg.slice(key.length) : fallback;
}

async function run() {
  const venue = readArg('venue', 'Yellowknife');
  const requestedMarket = readArg('market', 'over_2_5');
  const kickoff = new Date().toISOString();
  const match = {
    sport: 'football',
    market: requestedMarket,
    prediction: 'over',
    confidence: 90,
    odds: 1.95,
    volatility: 'medium',
    match_info: {
      match_id: `wx-live-test-${Date.now()}`,
      league: 'Friendly',
      country: 'CA',
      season: '2025/26',
      kickoff,
      venue,
      home_team: 'Arctic FC',
      away_team: 'Polar United',
      timezone: 'UTC'
    },
    sharp_odds: {
      home_win: 0.42,
      draw: 0.27,
      away_win: 0.31,
      over_2_5: 0.74,
      under_2_5: 0.26
    },
    contextual_intelligence: {
      weather: {},
      injuries: [],
      suspensions: [],
      expected_lineups: [],
      confirmed_lineups: [],
      lineup_confirmed: false,
      morale: 'stable',
      coach_conflict: false,
      boardroom_instability: false,
      public_incidents: []
    }
  };

  const result = await runPipelineForMatches({
    matches: [match],
    telemetry: { run_id: 'wx-live-test-cli', sport: 'football' }
  });

  const row = result.inserted[0];
  const ci = row?.metadata?.context_intelligence || {};
  const signals = ci.signals || {};
  const selectedMarket = row?.market || 'unknown';
  const selectedAfter = adjustProbability.applyMarketAdjustment(ci.p_adj, selectedMarket, signals.market_adjustments);
  const overAfter = adjustProbability.applyMarketAdjustment(ci.p_adj, 'over_2_5', signals.market_adjustments);
  const underAfter = adjustProbability.applyMarketAdjustment(ci.p_adj, 'under_2_5', signals.market_adjustments);

  console.log('PIPELINE_RESULT', JSON.stringify({
    inserted: result.inserted.length,
    filtered_valid: result.filtered_valid,
    filtered_invalid: result.filtered_invalid,
    selected_market: selectedMarket,
    selected_confidence: row?.confidence
  }, null, 2));

  console.log('WEATHER_FIRE', JSON.stringify({
    weather_risk: signals.weather_risk,
    condition: signals.condition,
    market_adjustments: signals.market_adjustments,
    p_base: ci.p_base,
    p_adj: ci.p_adj,
    selected_after_adjustment: selectedAfter,
    simulated_over_2_5_after: overAfter,
    simulated_under_2_5_after: underAfter
  }, null, 2));
}

run().catch((error) => {
  console.error('TEST_ERROR', error.message);
  process.exitCode = 1;
});
