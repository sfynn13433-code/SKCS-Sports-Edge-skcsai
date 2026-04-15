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
    connectionTimeoutMillis: 60000,
    idleTimeoutMillis: 60000,
    max: 1
});

async function migrateNormalizedFixtures() {
    try {
        // Test connection first
        await pool.query('SELECT 1');
        console.log('✓ Connected to database\n');
    } catch (e) {
        console.log(`Connection test failed: ${e.message}`);
        await pool.end();
        return;
    }
    
    console.log('STEP 1: Analyzing source data...\n');
    
    const eventsCount = await pool.query('SELECT COUNT(*) as cnt FROM events');
    const fixturesCount = await pool.query('SELECT COUNT(*) as cnt FROM normalized_fixtures');
    
    console.log(`   Events table: ${eventsCount.rows[0].cnt} rows`);
    console.log(`   normalized_fixtures: ${fixturesCount.rows[0].cnt} rows\n`);
    
    if (parseInt(eventsCount.rows[0].cnt) === 0) {
        console.log('⚠ No events to migrate. Run pipeline first.');
        await pool.end();
        return;
    }
    
    // Sample events
    const sampleEvents = await pool.query(`
        SELECT id, sport_key, home_team, away_team, commence_time
        FROM events LIMIT 3
    `);
    
    console.log('   Sample events:');
    sampleEvents.rows.forEach(e => {
        console.log(`   - ${e.home_team} vs ${e.away_team} (${e.sport_key})`);
    });
    
    console.log('\nSTEP 2: Migrating events...\n');
    
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
                WHEN sport_key LIKE 'soccer_%' THEN 'football'
                WHEN sport_key LIKE 'basketball_%' THEN 'basketball'
                WHEN sport_key LIKE 'americanfootball_%' THEN 'american_football'
                WHEN sport_key LIKE 'icehockey_%' THEN 'hockey'
                WHEN sport_key LIKE 'baseball_%' THEN 'baseball'
                WHEN sport_key LIKE 'rugbyunion_%' THEN 'rugby'
                WHEN sport_key LIKE 'aussierules_%' THEN 'afl'
                ELSE sport_key
            END,
            id, 'events_migration',
            home_team, away_team,
            NULL,
            COALESCE(NULLIF(regexp_replace(sport_key, '^[^_]*_', '', 'i'), ''), sport_key),
            EXTRACT(YEAR FROM commence_time)::TEXT,
            commence_time,
            commence_time AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg',
            DATE(commence_time AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg'),
            TIME(commence_time AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg'),
            DATE(commence_time AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg') = CURRENT_DATE,
            commence_time <= NOW() + INTERVAL '2 hours' AND commence_time > NOW(),
            TRUE, TRUE, TRUE,
            CASE WHEN commence_time < NOW() - INTERVAL '2 hours' THEN 'finished' ELSE 'scheduled' END,
            'medium',
            jsonb_build_object('source_table', 'events', 'original_id', id, 'sport_key', sport_key, 'migrated_at', NOW()),
            NOW(), NOW()
        FROM events e
        WHERE NOT EXISTS (
            SELECT 1 FROM normalized_fixtures nf 
            WHERE nf.provider_fixture_id = e.id AND nf.provider_name = 'events_migration'
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
        SELECT sport, home_team, away_team, kickoff_utc, match_date_sast, status
        FROM normalized_fixtures ORDER BY kickoff_utc DESC LIMIT 5
    `);
    
    if (sampleFixtures.rows.length > 0) {
        console.log('\n   Sample fixtures:');
        sampleFixtures.rows.forEach(f => {
            console.log(`   - ${f.home_team} vs ${f.away_team} (${f.sport})`);
            console.log(`     UTC: ${f.kickoff_utc} | SAST: ${f.match_date_sast} | Status: ${f.status}`);
        });
    }
    
    const finalCount = await pool.query('SELECT COUNT(*) as cnt FROM predictions_final');
    console.log(`\n   predictions_final: ${finalCount.rows[0].cnt} rows`);
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ MIGRATION 2 COMPLETE');
    console.log('═'.repeat(60));
    console.log('\n   The database is now ready for pipeline execution.\n');
    
    await pool.end();
}

migrateNormalizedFixtures();
