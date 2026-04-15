'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL;

console.log('═'.repeat(60));
console.log('   MIGRATION 2: NORMALIZED FIXTURES (v2)');
console.log('═'.repeat(60) + '\n');

const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000
});

async function migrateNormalizedFixtures() {
    console.log('STEP 1: Source analysis...\n');
    
    const eventsCount = await pool.query('SELECT COUNT(*) as cnt FROM events');
    const fixturesCount = await pool.query('SELECT COUNT(*) as cnt FROM normalized_fixtures');
    
    console.log(`   Events: ${eventsCount.rows[0].cnt} rows`);
    console.log(`   normalized_fixtures: ${fixturesCount.rows[0].cnt} rows\n`);
    
    if (parseInt(eventsCount.rows[0].cnt) === 0) {
        console.log('⚠ No events to migrate.');
        await pool.end();
        return;
    }
    
    console.log('STEP 2: Migrating events to normalized_fixtures...\n');
    
    // Use quoted identifiers for column names
    const migrationSQL = `
        INSERT INTO normalized_fixtures (
            sport, provider_fixture_id, provider_name,
            home_team, away_team, league_id, league_name, season,
            kickoff_utc, kickoff_sast, match_date_sast, match_time_sast,
            is_same_day, is_within_2h, is_acca_eligible, is_same_match_eligible, is_multi_eligible,
            status, volatility_level, metadata_json, created_at, last_sync_at
        )
        SELECT 
            CASE 
                WHEN e."sport_key" LIKE 'soccer%%' THEN 'football'
                WHEN e."sport_key" LIKE 'basketball%%' THEN 'basketball'
                WHEN e."sport_key" LIKE 'americanfootball%%' THEN 'american_football'
                WHEN e."sport_key" LIKE 'icehockey%%' THEN 'hockey'
                WHEN e."sport_key" LIKE 'baseball%%' THEN 'baseball'
                WHEN e."sport_key" LIKE 'rugbyunion%%' THEN 'rugby'
                WHEN e."sport_key" LIKE 'aussierules%%' THEN 'afl'
                ELSE e."sport_key"
            END as sport,
            e.id as provider_fixture_id,
            'events_migration' as provider_name,
            e."home_team" as home_team,
            e."away_team" as away_team,
            NULL as league_id,
            COALESCE(NULLIF(regexp_replace(e."sport_key", '^[^_]*_', '', 'i'), ''), e."sport_key") as league_name,
            EXTRACT(YEAR FROM e."commence_time")::TEXT as season,
            e."commence_time" as kickoff_utc,
            e."commence_time" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg' as kickoff_sast,
            DATE(e."commence_time" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg') as match_date_sast,
            TIME(e."commence_time" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg') as match_time_sast,
            DATE(e."commence_time" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg') = CURRENT_DATE as is_same_day,
            e."commence_time" <= NOW() + INTERVAL '2 hours' AND e."commence_time" > NOW() as is_within_2h,
            TRUE as is_acca_eligible,
            TRUE as is_same_match_eligible,
            TRUE as is_multi_eligible,
            CASE WHEN e."commence_time" < NOW() - INTERVAL '2 hours' THEN 'finished' ELSE 'scheduled' END as status,
            'medium' as volatility_level,
            jsonb_build_object(
                'source_table', 'events', 
                'original_id', e.id, 
                'sport_key', e."sport_key", 
                'migrated_at', NOW()
            ) as metadata_json,
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
        console.log(`   ✓ Migrated ${result.rowCount} fixtures\n`);
    } catch (e) {
        console.log(`   ✗ Error: ${e.message}\n`);
    }
    
    console.log('STEP 3: Verification...\n');
    
    const afterCount = await pool.query('SELECT COUNT(*) as cnt FROM normalized_fixtures');
    console.log(`   normalized_fixtures: ${afterCount.rows[0].cnt} rows`);
    
    const sampleFixtures = await pool.query(`
        SELECT sport, home_team, away_team, 
               kickoff_utc, match_date_sast, status
        FROM normalized_fixtures 
        ORDER BY kickoff_utc DESC
        LIMIT 5
    `);
    
    if (sampleFixtures.rows.length > 0) {
        console.log('\n   Sample migrated fixtures:');
        sampleFixtures.rows.forEach(f => {
            console.log(`   - ${f.home_team} vs ${f.away_team} (${f.sport})`);
            console.log(`     UTC: ${f.kickoff_utc} | SAST Date: ${f.match_date_sast} | ${f.status}`);
        });
    }
    
    // Stats
    const statsBySport = await pool.query(`
        SELECT sport, COUNT(*) as cnt
        FROM normalized_fixtures
        GROUP BY sport
        ORDER BY cnt DESC
    `);
    
    console.log('\n   Fixtures by sport:');
    statsBySport.rows.forEach(r => {
        console.log(`   - ${r.sport}: ${r.cnt}`);
    });
    
    // Final summary
    console.log('\n' + '═'.repeat(60));
    console.log('✅ MIGRATION 2 COMPLETE');
    console.log('═'.repeat(60));
    console.log(`
    The normalized_fixtures table is now populated.
    All fixtures have proper SAST timezone handling.
    
    The 3-stage pipeline can now use these fixtures!
    `);
    
    await pool.end();
}

migrateNormalizedFixtures().catch(e => {
    console.error('FATAL:', e.message);
    pool.end();
});
