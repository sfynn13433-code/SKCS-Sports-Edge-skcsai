'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL;

console.log('═'.repeat(60));
console.log('   MIGRATION 2: NORMALIZED FIXTURES (v3 - Simple)');
console.log('═'.repeat(60) + '\n');

const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000
});

async function migrateNormalizedFixtures() {
    console.log('Fetching events...\n');
    
    const events = await pool.query('SELECT * FROM events ORDER BY commence_time');
    console.log(`Found ${events.rows.length} events to migrate\n`);
    
    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;
    
    console.log('Migrating fixtures...\n');
    
    for (const event of events.rows) {
        // Check if already migrated
        const existing = await pool.query(`
            SELECT id FROM normalized_fixtures 
            WHERE provider_fixture_id = $1 AND provider_name = 'events_migration'
        `, [event.id]);
        
        if (existing.rows.length > 0) {
            skipCount++;
            continue;
        }
        
        // Normalize sport
        let sport = event.sport_key;
        if (sport.startsWith('soccer_')) sport = 'football';
        else if (sport.startsWith('basketball_')) sport = 'basketball';
        else if (sport.startsWith('americanfootball_')) sport = 'american_football';
        else if (sport.startsWith('icehockey_')) sport = 'hockey';
        else if (sport.startsWith('baseball_')) sport = 'baseball';
        else if (sport.startsWith('rugbyunion_')) sport = 'rugby';
        else if (sport.startsWith('aussierules_')) sport = 'afl';
        
        // Extract league name
        const parts = event.sport_key.split('_');
        const leagueName = parts.length > 1 ? parts.slice(1).join('_') : event.sport_key;
        
        // Calculate SAST date/time
        const kickoffUtc = new Date(event.commence_time);
        const kickoffSast = new Date(kickoffUtc.getTime() + 2 * 60 * 60 * 1000);
        const matchDateSast = kickoffSast.toISOString().split('T')[0];
        const matchTimeSast = kickoffSast.toTimeString().split(' ')[0];
        
        // Status
        const now = new Date();
        const status = kickoffUtc < new Date(now.getTime() - 2 * 60 * 60 * 1000) ? 'finished' : 'scheduled';
        
        // Same day check
        const todaySast = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString().split('T')[0];
        const isSameDay = matchDateSast === todaySast;
        
        // Within 2 hours
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const isWithin2h = kickoffUtc <= twoHoursFromNow && kickoffUtc > now;
        
        // Metadata
        const metadata = JSON.stringify({
            source_table: 'events',
            original_id: event.id,
            sport_key: event.sport_key,
            migrated_at: new Date().toISOString()
        });
        
        try {
            await pool.query(`
                INSERT INTO normalized_fixtures (
                    sport, provider_fixture_id, provider_name,
                    home_team, away_team, league_id, league_name, season,
                    kickoff_utc, kickoff_sast, match_date_sast, match_time_sast,
                    is_same_day, is_within_2h, is_acca_eligible, is_same_match_eligible, is_multi_eligible,
                    status, volatility_level, metadata_json, created_at, last_sync_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
            `, [
                sport, event.id, 'events_migration',
                event.home_team, event.away_team, null, leagueName, kickoffUtc.getUTCFullYear().toString(),
                event.commence_time, kickoffSast.toISOString(), matchDateSast, matchTimeSast,
                isSameDay, isWithin2h, true, true, true,
                status, 'medium', metadata,
                new Date().toISOString(), new Date().toISOString()
            ]);
            
            successCount++;
            if (successCount <= 5) {
                console.log(`   ✓ ${event.home_team} vs ${event.away_team} (${sport})`);
            } else if (successCount === 6) {
                console.log(`   ... and ${events.rows.length - 5} more`);
            }
        } catch (e) {
            errorCount++;
            if (errorCount <= 3) {
                console.log(`   ✗ Error: ${e.message}`);
            }
        }
    }
    
    console.log('\n' + '─'.repeat(60));
    console.log(`Migration complete: ${successCount} success, ${errorCount} errors, ${skipCount} skipped`);
    
    // Verify
    const count = await pool.query('SELECT COUNT(*) as cnt FROM normalized_fixtures');
    console.log(`normalized_fixtures now has: ${count.rows[0].cnt} rows\n`);
    
    // Sample
    const sample = await pool.query(`
        SELECT sport, home_team, away_team, match_date_sast, status
        FROM normalized_fixtures ORDER BY kickoff_utc DESC LIMIT 5
    `);
    
    if (sample.rows.length > 0) {
        console.log('Sample fixtures:');
        sample.rows.forEach(f => {
            console.log(`   ${f.home_team} vs ${f.away_team} (${f.sport}) - ${f.match_date_sast} [${f.status}]`);
        });
    }
    
    // By sport
    const bySport = await pool.query(`
        SELECT sport, COUNT(*) as cnt FROM normalized_fixtures GROUP BY sport ORDER BY cnt DESC
    `);
    console.log('\nBy sport:');
    bySport.rows.forEach(r => console.log(`   ${r.sport}: ${r.cnt}`));
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ MIGRATION 2 COMPLETE');
    console.log('═'.repeat(60) + '\n');
    
    await pool.end();
}

migrateNormalizedFixtures().catch(e => {
    console.error('FATAL:', e.message);
    pool.end();
});
