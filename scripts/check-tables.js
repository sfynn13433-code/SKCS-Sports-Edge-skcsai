const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const tables = [
    'predictions_final',
    'predictions_raw',
    'predictions_filtered',
    'predictions_stage_1',
    'predictions_stage_2',
    'predictions_stage_3',
    'profiles',
    'subscription_plans',
    'tier_rules',
    'acca_rules',
    'events',
    'leagues',
    'sports',
    'context_intelligence_cache',
    'fixture_context_cache',
    'event_weather_snapshots',
    'event_injury_snapshots',
    'event_news_snapshots',
    'odds_snapshots',
    'canonical_entities',
    'canonical_events',
    'prediction_publish_runs',
    'predictions_accuracy',
    'debug_published',
    'api_raw',
    'bookmakers',
    'rapidapi_cache',
    'scheduling_logs',
    'normalized_fixtures',
    'active_predictions_by_sport'
];

async function checkAllTables() {
    console.log('Checking all tables...\n');
    
    for (const table of tables) {
        try {
            const result = await pool.query(`SELECT COUNT(*) as cnt FROM ${table}`);
            console.log(`${table}: ${result.rows[0].cnt} rows`);
        } catch (err) {
            console.log(`${table}: ERROR - ${err.message}`);
        }
    }
    
    await pool.end();
    process.exit(0);
}

checkAllTables();