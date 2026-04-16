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

require('dotenv').config();
const axios = require('axios');
const { pool } = require('../backend/database');
const { enrichWithWeather } = require('../backend/utils/weather');
const { fetchWithWaterfall } = require('../backend/utils/rapidApiWaterfall');

const RAPIDAPI_KEY = process.env.X_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY;
const APISPORTS_KEY = process.env.X_APISPORTS_KEY;

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

// ============================================================
// STEP 2: FETCH WEATHER (USING AXIOS)
// ============================================================
async function fetchWeatherForFixtures(fixtures) {
    console.log('\n[STEP 2] Fetching weather data...');
    
    const enrichedFixtures = [];
    
    for (const fixture of fixtures) {
        try {
            const city = fixture.city || fixture.venue?.split(',').pop()?.trim() || null;
            
            if (city) {
                // Use Open-Meteo directly with axios
                const geoResponse = await axios.get(
                    `https://geocoding-api.open-meteo.com/v1/search`,
                    { params: { name: city, count: 1, language: 'en', format: 'json' }, timeout: 5000 }
                );
                
                const geoData = geoResponse.data?.results?.[0];
                
                if (geoData && geoData.latitude && geoData.longitude) {
                    const dateStr = fixture.date ? fixture.date.split('T')[0] : new Date().toISOString().split('T')[0];
                    
                    const weatherResponse = await axios.get(
                        `https://api.open-meteo.com/v1/forecast`,
                        {
                            params: {
                                latitude: geoData.latitude,
                                longitude: geoData.longitude,
                                hourly: 'temperature_2m,weather_code,wind_speed_10m',
                                timezone: 'auto',
                                start_date: dateStr,
                                end_date: dateStr
                            },
                            timeout: 5000
                        }
                    );
                    
                    if (weatherResponse.data?.hourly) {
                        const hourIndex = fixture.date ? new Date(fixture.date).getHours() : 12;
                        const temp = weatherResponse.data.hourly.temperature_2m?.[hourIndex];
                        const wind = weatherResponse.data.hourly.wind_speed_10m?.[hourIndex];
                        const code = weatherResponse.data.hourly.weather_code?.[hourIndex];
                        
                        const descriptions = { 0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
                            45: 'Fog', 51: 'Light Drizzle', 61: 'Light Rain', 63: 'Moderate Rain' };
                        
                        fixture.weather = {
                            description: descriptions[code] || 'Unknown',
                            temp: temp ? Math.round(temp) : null,
                            wind: wind ? Math.round(wind) : null,
                            emoji: code >= 61 ? '🌧️' : code >= 3 ? '⛅' : '☀️'
                        };
                    }
                }
            }
            
            if (!fixture.weather) {
                fixture.weather = { description: 'Unknown', temp: null, wind: null, emoji: '?' };
            }
        } catch (err) {
            fixture.weather = { description: 'Unavailable', temp: null, wind: null, emoji: '?' };
        }
        
        enrichedFixtures.push(fixture);
    }
    
    console.log(`[STEP 2] Weather fetched for ${enrichedFixtures.length} fixtures`);
    return enrichedFixtures;
}

// ============================================================
// STEP 3: FETCH NEWS (RAPIDAPI WATERFALL)
// ============================================================
async function fetchFootballNews() {
    console.log('\n[STEP 3] Fetching news via RapidAPI Waterfall...');
    
    try {
        const result = await fetchWithWaterfall('/v1/news', { query: 'football' }, 'TIER_3', 10000);
        if (result && result.data) {
            console.log(`[STEP 3] Fetched news via ${result.host}`);
            return result.data;
        }
    } catch (err) {
        console.warn(`[STEP 3] News fetch failed:`, err.message);
    }
    
    return [];
}

// ============================================================
// STEP 4: ENRICH WITH ODDS (RAPIDAPI WATERFALL)
// ============================================================
async function enrichWithOdds(fixtures) {
    console.log('\n[STEP 4] Enriching with odds via RapidAPI Waterfall...');
    
    for (const fixture of fixtures) {
        try {
            const result = await fetchWithWaterfall('/odds', {
                sport: 'soccer',
                region: 'eu',
                market: 'h2h'
            }, 'TIER_1', 8000);
            
            if (result && result.data) {
                // Find matching odds for this fixture
                const oddsData = Array.isArray(result.data) ? result.data : result.data.response || [];
                const matchOdds = oddsData.find(o => 
                    o.home_team === fixture.home_team || o.away_team === fixture.away_team
                );
                
                if (matchOdds) {
                    fixture.odds = matchOdds;
                }
            }
        } catch (err) {
            // Silent fail for odds
        }
    }
    
    console.log(`[STEP 4] Odds enrichment complete`);
    return fixtures;
}

// ============================================================
// STEP 5: GENERATE EDGEMIND REPORTS (SKIP IF EXISTS)
// ============================================================
async function generateEdgeMindReports(fixtures, existingMap) {
    console.log('\n[STEP 5] Generating EdgeMind Bot reports...');
    
    const { generateInsight } = require('../backend/services/aiProvider');
    const { generateEdgeMindReport } = require('./secondary-market-gatekeeper');
    
    const enrichedFixtures = [];
    let aiGenerated = 0;
    let aiSkipped = 0;
    
    for (const fixture of fixtures) {
        // Check if AI report already exists (token saving)
        const existingData = existingMap.get(fixture.match_id);
        
        if (existingData && existingData.edgemind_report) {
            // SKIP AI - Report already exists
            fixture.edgemind_report = existingData.edgemind_report;
            fixture.confidence = existingData.confidence || fixture.confidence || 65;
            fixture.ai_confidence = existingData.confidence || fixture.confidence || 65;
            aiSkipped++;
        } else {
            // FORCE AI Generation
            try {
                const insightData = await generateInsight({
                    home: fixture.home_team,
                    away: fixture.away_team,
                    league: fixture.league,
                    kickoff: fixture.date,
                    market: '1X2',
                    confidence: fixture.confidence || 65,
                    formData: null,
                    h2h: null,
                    weather: fixture.weather?.description || null,
                    absences: null
                });
                
                fixture.edgemind_report = insightData.edgemind_report;
                fixture.ai_confidence = insightData.confidence;
                fixture.market_name = insightData.market_name;
                
                // Generate secondary insights for 50-68% confidence
                if (insightData.confidence >= 50 && insightData.confidence <= 68) {
                    fixture.secondary_insights = [
                        { type: 'Double Chance 1X', confidence: Math.min(82, insightData.confidence + 20) },
                        { type: 'Over 1.5 Goals', confidence: Math.min(78, insightData.confidence + 15) }
                    ].filter(s => s.confidence >= 76);
                }
                
                aiGenerated++;
                
                // Rate limit AI calls
                await new Promise(r => setTimeout(r, 500));
                
            } catch (err) {
                console.warn(`[AI] ${fixture.home_team} vs ${fixture.away_team}:`, err.message);
                fixture.edgemind_report = generateEdgeMindReport(55, [], [], 65, { home: fixture.home_team, away: fixture.away_team });
                fixture.ai_confidence = 65;
            }
        }
        
        enrichedFixtures.push(fixture);
    }
    
    console.log(`[STEP 5] AI Generated: ${aiGenerated}, AI Skipped: ${aiSkipped} (token saved)`);
    return enrichedFixtures;
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
                
                // UPSERT (update if exists, insert if new)
                const sql = `
                    INSERT INTO predictions_final (
                        tier, type, matches, total_confidence, risk_level, sport, market_type, recommendation,
                        edgemind_report, secondary_insights, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                    ON CONFLICT DO UPDATE SET
                        matches = EXCLUDED.matches,
                        total_confidence = EXCLUDED.total_confidence,
                        edgemind_report = COALESCE(EXCLUDED.edgemind_report, predictions_final.edgemind_report),
                        secondary_insights = EXCLUDED.secondary_insights,
                        recommendation = EXCLUDED.recommendation
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
