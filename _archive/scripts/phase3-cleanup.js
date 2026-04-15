'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL;

console.log('=== PHASE 3: SAFE CLEANUP ===\n');
console.log('This will ONLY delete tables that are:');
console.log('  1. Completely empty (0 rows)');
console.log('  2. Have NO code references');
console.log('\nTables with data will NOT be touched.\n');
console.log('─'.repeat(50) + '\n');

const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
});

async function executePhase3() {
    // Tables to DELETE (empty, no code references)
    const TABLES_TO_DELETE = [
        { name: 'test', reason: 'Debug artifact' },
        { name: 'apisports_raw', reason: 'Never populated' },
        { name: 'cricket_raw', reason: 'Never populated' },
        { name: 'debug_published', reason: 'Never populated' },
        { name: 'injuries', reason: 'Never populated' },
        { name: 'injury_reports', reason: 'Never populated (FKs cleaned)' },
        { name: 'news_mentions', reason: 'Never populated' },
        { name: 'odds_raw', reason: 'Never populated' },
        { name: 'players', reason: 'Never populated (FKs cleaned)' },
        { name: 'prediction_results', reason: 'Never populated' },
        { name: 'predictions', reason: 'Never populated' },
        { name: 'predictions_accuracy', reason: 'Never populated' },
        { name: 'rapidapi_raw', reason: 'Never populated' },
        { name: 'sports_fixtures', reason: 'Never populated' },
        { name: 'team_stats', reason: 'Never populated' },
        { name: 'teams', reason: 'Never populated' },
        { name: 'users', reason: 'Supabase Auth handles auth' },
        { name: 'context_intelligence_cache', reason: 'Code references but never populated' },
        { name: 'fixture_context_cache', reason: 'Code references but never populated' }
    ];

    // Tables to KEEP (have data or referenced by code)
    const TABLES_TO_KEEP = [
        { name: 'acca_rules', reason: 'Configuration data (4 rows)' },
        { name: 'api_raw', reason: 'Has data (78 rows)' },
        { name: 'bookmakers', reason: 'Reference data (22 rows)' },
        { name: 'canonical_entities', reason: 'Entity data (1716 rows)' },
        { name: 'canonical_events', reason: 'Event data (137 rows)' },
        { name: 'event_injury_snapshots', reason: 'Injury data (346 rows)' },
        { name: 'event_news_snapshots', reason: 'News data (108 rows)' },
        { name: 'event_weather_snapshots', reason: 'Weather data (48 rows)' },
        { name: 'events', reason: 'Source events (260 rows)' },
        { name: 'leagues', reason: 'Reference data (26 rows)' },
        { name: 'matches', reason: 'Legacy but has 5 rows' },
        { name: 'odds_snapshots', reason: 'Odds data (60 rows)' },
        { name: 'prediction_publish_runs', reason: 'Pipeline tracking (73 rows)' },
        { name: 'predictions_filtered', reason: 'Working data (2244 rows)' },
        { name: 'predictions_final', reason: 'Working data (48 rows)' },
        { name: 'predictions_raw', reason: 'Working data (1122 rows)' },
        { name: 'profiles', reason: 'Auth profiles (1 row)' },
        { name: 'rapidapi_cache', reason: 'Working cache (1 row)' },
        { name: 'sports', reason: 'Reference data (92 rows)' },
        { name: 'tier_rules', reason: 'Configuration data (2 rows)' },
        { name: 'normalized_fixtures', reason: 'NEW schema table' },
        { name: 'predictions_stage_1', reason: 'NEW schema table' },
        { name: 'predictions_stage_2', reason: 'NEW schema table' },
        { name: 'predictions_stage_3', reason: 'NEW schema table' },
        { name: 'subscription_plans', reason: 'NEW schema table (8 rows)' },
        { name: 'scheduling_logs', reason: 'NEW schema table' }
    ];

    // Tables that need special handling (FK dependencies)
    const tablesWithDeps = ['injury_reports', 'players', 'prediction_results', 'predictions', 'predictions_accuracy'];
    
    console.log('TABLES TO DELETE (19 tables):');
    console.log('─'.repeat(50));
    for (const t of TABLES_TO_DELETE) {
        console.log(`   ${t.name.padEnd(30)} - ${t.reason}`);
    }

    console.log('\n\nTABLES TO KEEP (26 tables):');
    console.log('─'.repeat(50));
    for (const t of TABLES_TO_KEEP) {
        console.log(`   ${t.name.padEnd(30)} - ${t.reason}`);
    }

    console.log('\n' + '═'.repeat(50));
    console.log('READY TO DELETE 19 EMPTY TABLES');
    console.log('═'.repeat(50));
    console.log('\nWaiting 3 seconds...');
    await new Promise(r => setTimeout(r, 3000));

    console.log('\nExecuting deletions...\n');
    
    const results = [];
    
    // Delete in order to handle FKs properly
    const deleteOrder = [
        'context_intelligence_cache',  // No deps
        'fixture_context_cache',       // No deps
        'injuries',                    // No deps
        'prediction_results',          // FK to matches (already dropping matches)
        'predictions',                 // No deps
        'predictions_accuracy',        // FKs to predictions_final, prediction_publish_runs
        'injury_reports',              // FKs cleaned in Phase 1
        'players',                     // FK cleaned in Phase 1
        'matches',                     // FK to prediction_results
        'news_mentions',               // No deps
        'odds_raw',                    // No deps
        'rapidapi_raw',                // No deps
        'apisports_raw',               // No deps
        'cricket_raw',                 // No deps
        'debug_published',             // No deps
        'sports_fixtures',             // No deps
        'team_stats',                  // No deps
        'teams',                       // No deps
        'users',                       // No deps (Supabase Auth)
        'test'                         // No deps
    ];
    
    for (const tableName of deleteOrder) {
        try {
            // Check if table exists and has rows
            const count = await pool.query(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
            const rowCount = parseInt(count.rows[0].cnt);
            
            if (rowCount > 0) {
                console.log(`   ⏭ ${tableName}: SKIPPED (has ${rowCount} rows)`);
                continue;
            }
            
            // Drop the table
            await pool.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
            console.log(`   ✓ ${tableName}: DELETED`);
            results.push({ table: tableName, status: 'deleted' });
        } catch (e) {
            if (e.message.includes('does not exist')) {
                console.log(`   ℹ ${tableName}: Already deleted or never existed`);
            } else {
                console.log(`   ✗ ${tableName}: ERROR - ${e.message.split('\n')[0]}`);
                results.push({ table: tableName, status: 'error', message: e.message });
            }
        }
    }

    // Final verification
    console.log('\n' + '═'.repeat(50));
    console.log('PHASE 3 COMPLETE - VERIFICATION');
    console.log('═'.repeat(50));
    
    const remaining = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
    `);
    
    console.log(`\nTotal tables remaining: ${remaining.rows.length}`);
    console.log('\nRemaining tables:');
    remaining.rows.forEach(t => console.log(`   - ${t.table_name}`));

    const deleted = results.filter(r => r.status === 'deleted').length;
    const errors = results.filter(r => r.status === 'error').length;
    
    console.log('\n' + '═'.repeat(50));
    console.log('SUMMARY:');
    console.log(`   ✓ Deleted: ${deleted}`);
    console.log(`   ✗ Errors: ${errors}`);
    console.log(`   Total tables now: ${remaining.rows.length}`);
    console.log('═'.repeat(50));

    if (errors === 0) {
        console.log('\n✅ Database cleanup complete!');
        console.log('   Your database is now lean and ready.');
    } else {
        console.log('\n⚠ Cleanup complete with some errors.');
        console.log('   Review errors above.');
    }

    await pool.end();
}

executePhase3().catch(e => {
    console.error('FATAL:', e.message);
    pool.end();
});
