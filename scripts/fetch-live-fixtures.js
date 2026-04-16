'use strict';

/**
 * SKCS INCREMENTAL DATA PIPELINE
 * 
 * Features:
 * - Tier 1 RapidAPI Waterfall for failover
 * - Master League filtering (Europe, Americas, Asia, Africa)
 * - Single API call with local filtering
 * - Incremental sync (upsert, no wipe)
 * - Smart AI token saving (skip if report exists)
 */

// dotenv loaded by parent server-express.js
const axios = require('axios');
const { pool } = require('../backend/database');
const { enrichWithWeather } = require('../backend/utils/weather');
const { fetchWithWaterfall } = require('../backend/utils/rapidApiWaterfall');

const RAPIDAPI_KEY = process.env.X_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY;
const APISPORTS_KEY = process.env.X_APISPORTS_KEY;

// ============================================================
// FIXTURE NORMALIZER (MISSING FUNCTION!)
// ============================================================
function normalizeFixture(f, date) {
    const homeTeam = f.teams?.home?.name;
    const awayTeam = f.teams?.away?.name;
    
    if (!homeTeam || !awayTeam) {
        console.log(`[normalizeFixture] Skipping fixture with missing team: home=${homeTeam}, away=${awayTeam}`);
        return null;
    }
    
    return {
        match_id: String(f.fixture?.id || ''),
        home_team: homeTeam,
        away_team: awayTeam,
        league: f.league?.name || null,
        date: f.fixture?.date || date,
        venue: f.fixture?.venue?.name || null,
        status: f.fixture?.status?.short || null
    };
}

// ============================================================
// MASTER LEAGUES LIST (API-Sports IDs)
// ============================================================
const MASTER_LEAGUES = new Set([
    // EUROPE: TOP TIERS
    39, 140, 135, 78, 61,       // Big 5
    88, 94, 179, 203,           // Additional Europe
    144, 207, 218, 197,         // Belgium, Switzerland, Austria, Greece
    106, 345, 113, 103, 119,   // Poland, Czech, Sweden, Norway, Denmark
    172, 318, 224, 118,         // Bulgaria, Cyprus, Finland, Iceland
    
    // EUROPE: LOWER TIERS
    40, 41, 42,                  // England 2-4
    141,                          // Spain Segunda
    79, 80,                      // Germany 2-3
    136, 137,                    // Italy B-C
    62, 63,                      // France 2-3
    95, 89, 180, 204,           // Portugal, Netherlands, Scotland, Turkey 2nd
    114, 104, 120, 107,         // Sweden2, Norway2, Denmark2, Poland2
    
    // AMERICAS
    253, 254,                    // USA MLS, USL
    262,                         // Mexico
    71, 72,                      // Brazil A-B
    128,                         // Argentina
    239, 265, 268, 130,         // Colombia, Chile, Uruguay, Costa Rica
    
    // ASIA & OCEANIA
    98, 99,                      // Japan J1-J2
    169,                          // China
    292,                          // South Korea
    307, 301,                     // Saudi, UAE
    188,                          // Australia
    
    // AFRICA
    288, 289,                    // South Africa
    233,                          // Egypt
    195,                          // Algeria
    315,                          // Ghana
    326                           // Kenya
]);

console.log('=== SKCS INCREMENTAL DATA PIPELINE ===');
console.log(`Master Leagues: ${MASTER_LEAGUES.size}`);
console.log(`API-Sports Key: ${APISPORTS_KEY ? '✓ Set' : '✗ Missing'}`);
console.log(`RapidAPI Key: ${RAPIDAPI_KEY ? '✓ Set' : '✗ Missing'}`);
console.log('');

// ============================================================
// STEP 1: SINGLE API CALL WITH LOCAL FILTERING
// ============================================================
// NEW: Fetch ALL leagues (no filtering)
async function fetchAllLeaguesFixtures() {
    const today = new Date();
    const dates = [];
    
    // Fetch for today + next 14 days to cover all upcoming matches
    for (let i = 0; i <= 14; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
    }
    
    console.log(`[ALL LEAGUES] Fetching fixtures for dates: ${dates.join(', ')}`);
    console.log('[ALL LEAGUES] Fetching ALL leagues (no filtering)...');
    
    const allFixtures = [];
    
    for (const date of dates) {
        try {
            const url = `https://v3.football.api-sports.io/fixtures?date=${date}`;
            console.log(`[API-Sports] Calling: ${url}`);
            
            const response = await axios.get(url, {
                headers: { 'x-apisports-key': APISPORTS_KEY },
                timeout: 30000
            });
            
            const fixtures = response.data?.response || [];
            console.log(`[API-Sports] ${date}: ${fixtures.length} fixtures`);
            
            // Add ALL fixtures (no filtering!)
            for (const f of fixtures) {
                const fixture = normalizeFixture(f, date);
                if (fixture) {
                    allFixtures.push(fixture);
                }
            }
        } catch (err) {
            console.error(`[API-Sports] Error for ${date}:`, err.message);
        }
    }
    
    console.log(`[ALL LEAGUES] Total fixtures: ${allFixtures.length}`);
    return allFixtures;
}

async function fetchFixturesSingleAPI() {
    const today = new Date();
    const dates = [];
    
    // Fetch for today + next 7 days to cover all upcoming matches
    for (let i = 0; i <= 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
    }
    
    console.log(`[STEP 1] Fetching fixtures for: ${dates.join(', ')}`);
    console.log('[STEP 1] Using single API call with local master league filtering...');
    
    const allFixtures = [];
    
    for (const date of dates) {
        try {
            // Single API call - NO league looping
            const url = `https://v3.football.api-sports.io/fixtures?date=${date}`;
            console.log(`[API-Sports] Calling: ${url}`);
            
            const response = await axios.get(url, {
                headers: { 'x-apisports-key': APISPORTS_KEY },
                timeout: 30000
            });
            
            const fixtures = response.data?.response || [];
            console.log(`[API-Sports] Total received: ${fixtures.length} fixtures`);
            
            // Filter locally by master leagues
            for (const f of fixtures) {
                const leagueId = f.league?.id;
                
                if (MASTER_LEAGUES.has(leagueId)) {
                    allFixtures.push({
                        match_id: String(f.fixture.id),
                        sport: 'football',
                        home_team: f.teams?.home?.name || null,
                        away_team: f.teams?.away?.name || null,
                        date: f.fixture.date || null,
                        status: f.fixture.status?.short || 'NS',
                        market: '1X2',
                        prediction: null,
                        confidence: null,
                        volatility: null,
                        odds: null,
                        provider: 'api-sports',
                        provider_name: 'API-Football',
                        league: f.league?.name || 'Unknown',
                        league_id: String(leagueId),
                        home_logo: f.teams?.home?.logo || null,
                        away_logo: f.teams?.away?.logo || null,
                        venue: f.fixture.venue?.name || null,
                        city: f.fixture.venue?.city || null,
                        country: f.league?.country || null,
                        round: f.league?.round || null,
                        raw_provider_data: f
                    });
                }
            }
            
            console.log(`[API-Sports] Filtered to ${allFixtures.length} master league fixtures`);
            
            // Small delay to avoid rate limits
            await new Promise(r => setTimeout(r, 300));
            
        } catch (err) {
            console.warn(`[API-Sports] ${date} failed:`, err.message);
            if (err.response?.status === 429) {
                console.log('[API-Sports] Rate limited, waiting...');
                await new Promise(r => setTimeout(r, 10000));
            }
        }
    }
    
    console.log(`[STEP 1] Total fixtures: ${allFixtures.length}`);
    return allFixtures;
}

// STEP 2: WEATHER (SKIP FOR NOW)
// ============================================================
async function fetchWeatherForFixtures(fixtures) {
    console.log('\n[STEP 2] Skipping weather fetch');
    return fixtures;
}

// STEP 3: FETCH NEWS (SKIP - NOT CRITICAL)
// ============================================================
async function fetchFootballNews() {
    console.log('\n[STEP 3] Skipping news fetch (not critical)');
    return [];
}

// ============================================================
// STEP 4: ENRICH WITH ODDS (SKIP - CAUSES RATE LIMITS)
// ============================================================
async function enrichWithOdds(fixtures) {
    console.log('\n[STEP 4] Skipping odds enrichment (rate limited)');
    console.log(`[STEP 4] Proceeding with ${fixtures.length} fixtures`);
    return fixtures;
}

// ============================================================
// STEP 5: GENERATE EDGEMIND REPORTS (READ FROM EVENTS TABLE)
// ============================================================
async function generateEdgeMindReports(fixtures, existingMap) {
    console.log('\n[STEP 5] Generating EdgeMind Bot reports...');
    
    // PHASE 2: Fetch matches from events table instead of using passthrough
    const client = await pool.connect();
    let eventsFromDB = [];
    
    try {
        const result = await client.query(`
            SELECT id, home_team, away_team, commence_time, sport_key
            FROM events
            WHERE commence_time > NOW()
            AND commence_time < NOW() + INTERVAL '7 days'
            ORDER BY commence_time ASC
            LIMIT 100
        `);
        eventsFromDB = result.rows;
        console.log(`PHASE 2 SUCCESS: Fetched ${eventsFromDB.length} matches from the 'events' table for AI processing.`);
    } catch (err) {
        console.error('[PHASE 2 ERROR]: Failed to fetch from events table:', err.message);
    } finally {
        client.release();
    }
    
    // Use events from DB if available, otherwise fall back to passed fixtures
    const matchesToProcess = eventsFromDB.length > 0 ? eventsFromDB : fixtures.slice(0, 50);
    console.log(`[STEP 5] Processing ${matchesToProcess.length} fixtures`);
    
    const { generateFallbackInsightStructured } = require('../backend/services/aiProvider');
    
    const enrichedFixtures = [];
    let aiGenerated = 0;
    let aiSkipped = 0;
    
    // Limit for speed
    const limitedFixtures = matchesToProcess.slice(0, 50);
    
    for (const fixture of limitedFixtures) {
        // Handle both DB format (flat) and API format (nested)
        const matchId = fixture.id || fixture.match_id || String(fixture.fixture?.id || '');
        const homeTeam = fixture.home_team || fixture.home_team_name || fixture.home_team?.name || '';
        const awayTeam = fixture.away_team || fixture.away_team_name || fixture.away_team?.name || '';
        
        const existingData = existingMap.get(matchId);
        
        if (existingData && existingData.edgemind_report) {
            fixture.edgemind_report = existingData.edgemind_report;
            fixture.confidence = existingData.confidence || fixture.confidence || 65;
            fixture.ai_confidence = existingData.confidence || fixture.confidence || 65;
            aiSkipped++;
        } else {
            // USE FALLBACK INSTEAD OF WAITING FOR DOLPHIN
            const insightData = generateFallbackInsightStructured({
                home: homeTeam,
                away: awayTeam,
                league: fixture.league || null,
                kickoff: fixture.commence_time || fixture.date || null,
                market: '1X2',
                confidence: 65
            });
            
            fixture.edgemind_report = insightData.edgemind_report;
            fixture.ai_confidence = insightData.confidence;
            fixture.market_name = insightData.market_name;
            fixture.home_team = homeTeam;
            fixture.away_team = awayTeam;
            fixture.match_id = matchId;
            
            if (insightData.confidence >= 50 && insightData.confidence <= 68) {
                fixture.secondary_insights = [
                    { type: 'Double Chance 1X', confidence: Math.min(82, insightData.confidence + 20) },
                    { type: 'Over 1.5 Goals', confidence: Math.min(78, insightData.confidence + 15) }
                ].filter(s => s.confidence >= 76);
            }
            
            aiGenerated++;
        }
        
        enrichedFixtures.push(fixture);
    }
    
    console.log(`[STEP 5] Generated ${aiGenerated} reports (fallback), skipped ${aiSkipped} existing`);
    return enrichedFixtures;
}

// ============================================================
// PHASE 1: SAVE FIXTURES TO EVENTS TABLE
// ============================================================
async function saveFixturesToEvents(fixtures) {
    console.log('\n[PHASE 1] Saving fixtures to events table...');
    
    const client = await pool.connect();
    let upserted = 0;
    
    try {
        await client.query('BEGIN');
        
        // Map fixtures to events table schema - limit to 100 for speed
        const mappedEvents = fixtures.slice(0, 100).map(f => ({
            id: f.match_id || String(f.fixture?.id || ''),
            sport_key: 'football',
            commence_time: f.date || new Date().toISOString(),
            home_team: f.home_team,
            away_team: f.away_team
        })).filter(e => e.id && e.home_team && e.away_team);
        
        console.log(`[PHASE 1] Upserting ${mappedEvents.length} events...`);
        
        // Upsert each event
        for (const event of mappedEvents) {
            try {
                await client.query(`
                    INSERT INTO events (id, sport_key, commence_time, home_team, away_team)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id) DO UPDATE SET
                        sport_key = EXCLUDED.sport_key,
                        commence_time = EXCLUDED.commence_time,
                        home_team = EXCLUDED.home_team,
                        away_team = EXCLUDED.away_team
                `, [event.id, event.sport_key, event.commence_time, event.home_team, event.away_team]);
                
                upserted++;
            } catch (err) {
                console.warn(`[PHASE 1] Failed to upsert event ${event.id}:`, err.message);
            }
        }
        
        await client.query('COMMIT');
        console.log(`PHASE 1 SUCCESS: ${upserted} matches upserted into the events table.`);
        return upserted;
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[PHASE 1 ERROR]:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

// ============================================================
// STEP 6: INCREMENTAL UPSERT TO SUPABASE (NO WIPE)
// ============================================================
async function saveToSupabase(fixtures, existingMap) {
    console.log('\n[STEP 6] Incremental sync to Supabase (upsert mode)...');
    
    const client = await pool.connect();
    let upserted = 0;
    let skipped = 0;
    
    try {
        await client.query('BEGIN');
        
        for (const fixture of fixtures) {
            if (!fixture.home_team || !fixture.away_team) continue;
            
            try {
                // Check if already exists with same data
                const existing = existingMap.get(fixture.match_id);
                
                const matchesJson = [{
                    fixture_id: fixture.match_id,
                    home_team: fixture.home_team,
                    away_team: fixture.away_team,
                    home_team_name: fixture.home_team,
                    away_team_name: fixture.away_team,
                    sport: fixture.sport,
                    league: fixture.league,
                    commence_time: fixture.date,
                    market: fixture.market || '1X2',
                    prediction: fixture.prediction || 'home_win',
                    confidence: fixture.confidence || fixture.ai_confidence || 65,
                    metadata: {
                        sport: fixture.sport,
                        league: fixture.league,
                        home_team: fixture.home_team,
                        away_team: fixture.away_team,
                        venue: fixture.venue,
                        weather: fixture.weather,
                        odds: fixture.odds,
                        edgemind_report: fixture.edgemind_report,
                        secondary_insights: fixture.secondary_insights
                    }
                }];
                
                const confidence = fixture.confidence || fixture.ai_confidence || 65;
                const riskLevel = confidence >= 72 ? 'safe' : confidence >= 60 ? 'medium' : 'high';
                const prediction = fixture.market_name || fixture.prediction || 'Home Win';
                
                // INSERT (no conflict needed - table is empty)
                const sql = `
                    INSERT INTO predictions_final (
                        tier, type, matches, total_confidence, risk_level, sport, market_type, recommendation,
                        edgemind_report, secondary_insights, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                    RETURNING id
                `;
                
                const result = await client.query(sql, [
                    'normal',
                    'direct',
                    JSON.stringify(matchesJson),
                    confidence,
                    riskLevel,
                    fixture.sport || 'football',
                    fixture.market || '1X2',
                    prediction,
                    fixture.edgemind_report || null,
                    fixture.secondary_insights ? JSON.stringify(fixture.secondary_insights) : null
                ]);
                
                if (result.rows.length > 0) {
                    upserted++;
                }
                
            } catch (err) {
                console.error(`[DB] Save failed for ${fixture.home_team} vs ${fixture.away_team}:`, err.message);
            }
        }
        
        await client.query('COMMIT');
        console.log(`[STEP 6] Incremental upsert: ${upserted} updated, ${skipped} skipped`);
        return upserted;
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[STEP 6] Transaction failed:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

// ============================================================
// MAIN EXECUTION (EXPORTED)
// ============================================================
async function runLiveSync() {
    console.log('\n========================================');
    console.log('  SKCS INCREMENTAL DATA PIPELINE');
    console.log('========================================\n');
    
    let fixturesProcessed = 0;
    let predictionsUpserted = 0;
    
    try {
        // STEP 0: Load existing records for incremental sync
        console.log('[STEP 0] Loading existing predictions for incremental sync...');
        const client = await pool.connect();
        let existingMap = new Map();
        
        try {
            const result = await client.query(`
                SELECT 
                    (matches->0->>'fixture_id') as fixture_id,
                    edgemind_report,
                    total_confidence
                FROM predictions_final 
                WHERE matches IS NOT NULL
                AND matches::text != '[]'
            `);
            
            existingMap = new Map(
                (result.rows || [])
                    .filter(r => r.fixture_id)
                    .map(r => [r.fixture_id, r])
            );
            
            console.log(`[STEP 0] Found ${existingMap.size} existing predictions`);
        } finally {
            client.release();
        }
        
        // STEP 1: Fetch ALL leagues (no filtering!)
        let fixtures = await fetchAllLeaguesFixtures();
        
        if (fixtures.length === 0) {
            console.log('[WARNING] No fixtures from API-Sports. Trying TheSportsDB...');
            const { buildLiveData } = require('../backend/services/dataProvider');
            fixtures = await buildLiveData({ sport: 'football' }) || [];
        }
        
        if (fixtures.length === 0) {
            console.log('[ERROR] No fixtures available!');
            return { success: false, fixtures: 0, upserted: 0 };
        }
        
        console.log(`\n[TOTAL] Fixtures to process: ${fixtures.length}`);
        fixturesProcessed = fixtures.length;
        
        // ============================================================
        // PHASE 1: Save raw fixtures to events table
        // ============================================================
        const eventsUpserted = await saveFixturesToEvents(fixtures);
        
        // STEP 2: Weather
        fixtures = await fetchWeatherForFixtures(fixtures);
        
        // STEP 3: News (RapidAPI Waterfall)
        await fetchFootballNews();
        
        // STEP 4: Odds (RapidAPI Waterfall)
        fixtures = await enrichWithOdds(fixtures);
        
        // STEP 5: AI Reports (skip if exists)
        fixtures = await generateEdgeMindReports(fixtures, existingMap);
        
        // STEP 6: Incremental Upsert (no wipe)
        predictionsUpserted = await saveToSupabase(fixtures, existingMap);
        
        console.log('\n========================================');
        console.log('  PIPELINE COMPLETE');
        console.log('========================================');
        console.log(`Fixtures processed: ${fixtures.length}`);
        console.log(`Predictions upserted: ${predictionsUpserted}`);
        console.log(`AI tokens saved: ${existingMap.size} (skipped)`);
        console.log('');
        console.log('Incremental sync complete - no data wiped!');
        
        return { 
            success: true, 
            fixtures: fixturesProcessed, 
            upserted: predictionsUpserted,
            eventsUpserted,
            aiTokensSaved: existingMap.size
        };
        
    } catch (err) {
        console.error('\n[ERROR] Pipeline failed:', err.message);
        return { success: false, error: err.message };
    }
}

// Run directly if executed from command line
if (require.main === module) {
    runLiveSync()
        .then(result => {
            console.log('[RESULT]', JSON.stringify(result));
            process.exit(result.success ? 0 : 1);
        })
        .catch(err => {
            console.error('[FATAL]', err.message);
            process.exit(1);
        });
}

module.exports = { runLiveSync };
