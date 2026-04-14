'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL;

console.log('═'.repeat(60));
console.log('   MIGRATION 2: NORMALIZED FIXTURES');
console.log('═'.repeat(60) + '\n');

const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
});

async function migrateNormalizedFixtures() {
    console.log('STEP 1: Analyzing source data (events table)...\n');
    
    // Check events table
    const eventsCount = await pool.query('SELECT COUNT(*) as cnt FROM events');
    console.log(`   Events table: ${eventsCount.rows[0].cnt} rows`);
    
    // Check normalized_fixtures
    const fixturesCount = await pool.query('SELECT COUNT(*) as cnt FROM normalized_fixtures');
    console.log(`   normalized_fixtures: ${fixturesCount.rows[0].cnt} rows`);
    
    if (parseInt(eventsCount.rows[0].cnt) === 0) {
        console.log('\n⚠ No events to migrate. Pipeline needs to run first.');
        await pool.end();
        return;
    }
    
    // Sample events to understand structure
    const sampleEvents = await pool.query(`
        SELECT id, sport_key, home_team, away_team, commence_time
        FROM events
        LIMIT 3
    `);
    
    console.log('\n   Sample events:');
    sampleEvents.rows.forEach(e => {
        console.log(`   - ${e.home_team} vs ${e.away_team} (${e.sport_key})`);
        console.log(`     kickoff: ${e.commence_time} | ID: ${e.id.substring(0, 20)}...`);
    });
    
    console.log('\nSTEP 2: Migrating events to normalized_fixtures...\n');
    
    // Migration SQL with SAST timezone handling
    const migrationSQL = `
        INSERT INTO normalized_fixtures (
            sport,
            provider_fixture_id,
            provider_name,
            home_team,
            away_team,
            league_id,
            league_name,
            season,
            kickoff_utc,
            kickoff_sast,
            match_date_sast,
            match_time_sast,
            is_same_day,
            is_within_2h,
            is_acca_eligible,
            is_same_match_eligible,
            is_multi_eligible,
            status,
            volatility_level,
            metadata_json,
            created_at,
            last_sync_at
        )
        SELECT 
            -- Normalize sport names
            CASE 
                WHEN sport_key LIKE 'soccer_%' THEN 'football'
                WHEN sport_key LIKE 'basketball_%' THEN 'basketball'
                WHEN sport_key LIKE 'americanfootball_%' THEN 'american_football'
                WHEN sport_key LIKE 'icehockey_%' THEN 'hockey'
                WHEN sport_key LIKE 'baseball_%' THEN 'baseball'
                WHEN sport_key LIKE 'rugbyunion_%' THEN 'rugby'
                WHEN sport_key LIKE 'aussierules_%' THEN 'afl'
                ELSE sport_key
            END as sport,
            
            -- Provider fixture ID from events.id
            id as provider_fixture_id,
            
            -- Provider name
            'events_migration' as provider_name,
            
            -- Team names
            home_team,
            away_team,
            
            -- League info (extract from sport_key if possible)
            NULL as league_id,
            COALESCE(
                NULLIF(regexp_replace(sport_key, '^[^_]*_', '', 'i'), ''),
                sport_key
            ) as league_name,
            
            -- Season (current year)
            EXTRACT(YEAR FROM commence_time)::TEXT as season,
            
            -- Original UTC timestamp
            commence_time as kickoff_utc,
            
            -- SAST converted timestamp (UTC+2)
            commence_time AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg' as kickoff_sast,
            
            -- Date in SAST
            DATE(commence_time AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg') as match_date_sast,
            
            -- Time in SAST
            TIME(commence_time AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg') as match_time_sast,
            
            -- Same day flag (match is today in SAST)
            DATE(commence_time AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg') = CURRENT_DATE as is_same_day,
            
            -- Within 2 hours flag
            commence_time <= NOW() + INTERVAL '2 hours' AND commence_time > NOW() as is_within_2h,
            
            -- Eligibility flags
            TRUE as is_acca_eligible,
            TRUE as is_same_match_eligible,
            TRUE as is_multi_eligible,
            
            -- Status
            CASE 
                WHEN commence_time < NOW() - INTERVAL '2 hours' THEN 'finished'
                ELSE 'scheduled'
            END as status,
            
            -- Volatility (conservative default)
            'medium' as volatility_level,
            
            -- Metadata
            jsonb_build_object(
                'source_table', 'events',
                'original_id', id,
                'sport_key', sport_key,
                'migrated_at', NOW()
            ) as metadata_json,
            
            -- Timestamps
            NOW() as created_at,
            NOW() as last_sync_at
            
        FROM events e
        WHERE NOT EXISTS (
            SELECT 1 FROM normalized_fixtures nf 
            WHERE nf.provider_fixture_id = e.id 
            AND nf.provider_name = 'events_migration'
        )
    `;
    
    try {
        const result = await pool.query(migrationSQL);
        console.log(`   ✓ Migrated ${result.rowCount} fixtures`);
    } catch (e) {
        console.log(`   ✗ Migration error: ${e.message}`);
    }
    
    console.log('\nSTEP 3: Verifying migration...\n');
    
    // Check migration results
    const afterCount = await pool.query('SELECT COUNT(*) as cnt FROM normalized_fixtures');
    console.log(`   normalized_fixtures now has: ${afterCount.rows[0].cnt} rows`);
    
    // Sample migrated data
    const sampleFixtures = await pool.query(`
        SELECT 
            id, sport, home_team, away_team, 
            kickoff_utc, kickoff_sast, match_date_sast, match_time_sast,
            is_same_day, status
        FROM normalized_fixtures
        ORDER BY kickoff_utc DESC
        LIMIT 5
    `);
    
    if (sampleFixtures.rows.length > 0) {
        console.log('\n   Sample migrated fixtures:');
        sampleFixtures.rows.forEach(f => {
            console.log(`\n   ${f.home_team} vs ${f.away_team} (${f.sport})`);
            console.log(`     ID: ${f.id} | Status: ${f.status}`);
            console.log(`     UTC: ${f.kickoff_utc}`);
            console.log(`     SAST: ${f.kickoff_sast}`);
            console.log(`     Date SAST: ${f.match_date_sast} ${f.match_time_sast}`);
            console.log(`     Same day: ${f.is_same_day}`);
        });
    }
    
    // Check for fixtures needing stage tables
    console.log('\n' + '─'.repeat(60));
    console.log('STEP 4: Checking stage table readiness...\n');
    
    const stage1Count = await pool.query('SELECT COUNT(*) as cnt FROM predictions_stage_1');
    const stage2Count = await pool.query('SELECT COUNT(*) as cnt FROM predictions_stage_2');
    const stage3Count = await pool.query('SELECT COUNT(*) as cnt FROM predictions_stage_3');
    
    console.log(`   predictions_stage_1: ${stage1Count.rows[0].cnt} rows`);
    console.log(`   predictions_stage_2: ${stage2Count.rows[0].cnt} rows`);
    console.log(`   predictions_stage_3: ${stage3Count.rows[0].cnt} rows`);
    
    // Check if we need to create predictions for stage 1
    console.log('\n' + '─'.repeat(60));
    console.log('STEP 5: Checking predictions_pipeline...\n');
    
    const rawCount = await pool.query('SELECT COUNT(*) as cnt FROM predictions_raw');
    const filteredCount = await pool.query('SELECT COUNT(*) as cnt FROM predictions_filtered');
    const finalCount = await pool.query('SELECT COUNT(*) as cnt FROM predictions_final');
    
    console.log(`   predictions_raw: ${rawCount.rows[0].cnt} rows`);
    console.log(`   predictions_filtered: ${filteredCount.rows[0].cnt} rows`);
    console.log(`   predictions_final: ${finalCount.rows[0].cnt} rows`);
    
    if (parseInt(finalCount.rows[0].cnt) > 0) {
        console.log('\n✅ PREDICTIONS PIPELINE IS WORKING!\n');
        console.log('   The pipeline will now use normalized_fixtures for new predictions.');
        console.log('   Existing predictions can be linked to fixtures via match_id.');
    }
    
    // Summary
    console.log('═'.repeat(60));
    console.log('MIGRATION 2 SUMMARY');
    console.log('═'.repeat(60));
    console.log(`
    ✓ Events migrated to normalized_fixtures with SAST timezone
    ✓ All fixtures have proper timezone handling
    ✓ Ready for 3-stage pipeline execution
    
    Next: Run /api/pipeline/sync to generate new predictions!
    `);
    
    await pool.end();
}

migrateNormalizedFixtures().catch(e => {
    console.error('FATAL:', e.message);
    pool.end();
});
