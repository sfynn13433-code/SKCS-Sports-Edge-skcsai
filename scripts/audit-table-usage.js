require('dotenv').config();
const { pool } = require('../backend/database');
(async () => {
  // Check row counts
  console.log('=== ROW COUNTS ===\n');
  const tables = [
    'predictions_final', 'predictions_filtered', 'predictions_raw',
    'predictions_stage_1', 'predictions_stage_2', 'predictions_stage_3',
    'normalized_fixtures', 'events', 'matches', 'leagues', 'sports',
    'profiles', 'subscription_plans', 'context_intelligence_cache',
    'event_weather_snapshots', 'event_injury_snapshots', 'event_news_snapshots',
    'canonical_entities', 'canonical_events', 'odds_snapshots', 'bookmakers',
    'rapidapi_cache', 'api_raw', 'prediction_publish_runs', 'debug_published',
    'fixture_context_cache', 'scheduling_logs', 'predictions_accuracy',
    'acca_rules', 'tier_rules'
  ];
  
  for (const table of tables) {
    try {
      const r = await pool.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
      console.log(`${table}: ${r.rows[0].cnt} rows`);
    } catch (e) {
      console.log(`${table}: ERROR - ${e.message}`);
    }
  }
  
  // Check profiles table
  console.log('\n\n=== PROFILES TABLE SAMPLE ===\n');
  const profiles = await pool.query("SELECT * FROM profiles LIMIT 5");
  console.log(JSON.stringify(profiles.rows, null, 2));
  
  // Check tier_rules
  console.log('\n\n=== TIER RULES ===\n');
  const tierRules = await pool.query("SELECT * FROM tier_rules");
  console.log(JSON.stringify(tierRules.rows, null, 2));
  
  // Check subscription_plans
  console.log('\n\n=== SUBSCRIPTION PLANS ===\n');
  const plans = await pool.query("SELECT plan_id, name, tier, duration_days, price FROM subscription_plans");
  console.log(JSON.stringify(plans.rows, null, 2));
  
  // Check acca_rules
  console.log('\n\n=== ACCA RULES ===\n');
  const acca = await pool.query("SELECT * FROM acca_rules");
  console.log(JSON.stringify(acca.rows, null, 2));
  
  await pool.end();
})();
