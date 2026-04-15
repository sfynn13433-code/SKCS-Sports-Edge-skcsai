'use strict';

/**
 * SKCS LIVE DATA PIPELINE
 * 
 * Fetches REAL data from:
 * - API-Sports (fixtures, odds)
 * - RapidAPI (news, additional sports)
 * - Weather API (match conditions)
 * 
 * Then processes through aiPipeline and saves to Supabase
 */

require('dotenv').config();
const axios = require('axios');
const { pool } = require('../backend/database');
const { buildLiveData, getPredictionInputs } = require('../backend/services/dataProvider');
const { rebuildFinalOutputs } = require('../backend/services/aiPipeline');
const { runPipelineForMatches } = require('../backend/services/aiPipeline');
const { enrichWithWeather, getWeather } = require('../backend/utils/weather');

const RAPIDAPI_KEY = process.env.X_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const APISPORTS_KEY = process.env.X_APISPORTS_KEY;

const TARGET_DATE = new Date().toISOString().slice(0, 10);

console.log('=== SKCS LIVE DATA PIPELINE ===');
console.log(`Target Date: ${TARGET_DATE}`);
console.log(`API-Sports Key: ${APISPORTS_KEY ? '✓ Set' : '✗ Missing'}`);
console.log(`RapidAPI Key: ${RAPIDAPI_KEY ? '✓ Set' : '✗ Missing'}`);
console.log(`Weather API Key: ${WEATHER_API_KEY ? '✓ Set' : '✗ Missing'}`);
console.log(`Odds API Key: ${ODDS_API_KEY ? '✓ Set' : '✗ Missing'}`);
console.log('');

// ============================================================
// STEP 1: FETCH LIVE FIXTURES FROM API-SPORTS
// Uses date parameter (NOT next=10 - that doesn't work on free tier)
// Pulls ALL leagues for today and tomorrow
// ============================================================
async function fetchFixturesFromAPISportsV2() {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    // Fetch for multiple days to maximize fixtures
    const dates = [];
    for (let i = 0; i <= 3; i++) {
        const d = new Date(Date.now() + i * 86400000);
        dates.push(d.toISOString().split('T')[0]);
    }
    
    console.log(`[STEP 1] Fetching GLOBAL fixtures from API-Sports...`);
    console.log(`[STEP 1] Dates: ${dates.join(', ')}`);
    
    const allFixtures = [];
    
    for (const date of dates) {
        console.log(`[API-Sports] Fetching date: ${date}...`);
        
        try {
            const url = `https://v3.football.api-sports.io/fixtures?date=${date}`;
            const response = await axios.get(url, {
                headers: { 'x-apisports-key': APISPORTS_KEY },
                timeout: 30000
            });
            
            const fixtures = response.data?.response || [];
            console.log(`[API-Sports] ${date}: ${fixtures.length} fixtures`);
            
            for (const f of fixtures) {
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
                    league: f.league?.name || 'Unknown League',
                    league_id: String(f.league?.id || ''),
                    home_logo: f.teams?.home?.logo || null,
                    away_logo: f.teams?.away?.logo || null,
                    venue: f.fixture.venue?.name || null,
                    city: f.fixture.venue?.city || null,
                    country: f.league?.country || null,
                    round: f.league?.round || null,
                    raw_provider_data: f
                });
            }
            
            await new Promise(r => setTimeout(r, 500));
            
        } catch (err) {
            console.warn(`[API-Sports] ${date} failed:`, err.message);
            if (err.response?.status === 429) {
                console.log('[API-Sports] Rate limited, waiting 10 seconds...');
                await new Promise(r => setTimeout(r, 10000));
            }
        }
    }
    
    // Deduplicate by match_id
    const uniqueFixtures = [];
    const seen = new Set();
    for (const f of allFixtures) {
        if (!seen.has(f.match_id)) {
            seen.add(f.match_id);
            uniqueFixtures.push(f);
        }
    }
    
    console.log(`[STEP 1] Total fixtures from API-Sports: ${uniqueFixtures.length} (${allFixtures.length - uniqueFixtures.length} duplicates removed)`);
    return uniqueFixtures;
}

// ============================================================
// STEP 1b: FETCH FROM THE SPORTS DB (SUPPLEMENTARY)
// ============================================================
async function fetchFixturesFromTheSportsDB() {
    console.log('[STEP 1b] Fetching comprehensive fixtures from TheSportsDB...');
    
    try {
        const THESPORTSDB_BASE_URL = 'https://www.thesportsdb.com/api/v1/json';
        const SPORTS_DB_KEY = '123';
        
        // Comprehensive league list with TheSportsDB IDs
        const TARGET_LEAGUES = [
            // ==========================================
            // EUROPE: TOP & 2ND TIERS
            // ==========================================
            { id: '4328', name: 'England Premier League' },
            { id: '4396', name: 'Scotland Premiership' },
            { id: '4397', name: 'Scotland Championship' },
            { id: '4334', name: 'France Ligue 1' },
            { id: '4401', name: 'France Ligue 2' },
            { id: '4332', name: 'Italy Serie A' },
            { id: '4387', name: 'Italy Serie B' },
            { id: '4335', name: 'Spain La Liga' },
            { id: '4388', name: 'Spain Segunda Division' },
            { id: '4331', name: 'Germany Bundesliga' },
            { id: '4390', name: 'Germany 2. Bundesliga' },
            { id: '4377', name: 'Portugal Primeira Liga' },
            { id: '4384', name: 'Netherlands Eredivisie' },
            { id: '4394', name: 'Poland Ekstraklasa' },
            { id: '4408', name: 'Turkey Super Lig' },
            { id: '4402', name: 'Belgium Pro League' },
            { id: '4380', name: 'Greece Super League' },
            { id: '4422', name: 'Austria Bundesliga' },
            { id: '4418', name: 'Switzerland Super League' },
            { id: '4436', name: 'Denmark Superliga' },
            { id: '4447', name: 'Sweden Allsvenskan' },
            { id: '4449', name: 'Norway Eliteserien' },
            { id: '4455', name: 'Finland Veikkausliiga' },
            { id: '4430', name: 'Czech Republic First League' },
            { id: '4428', name: 'Croatia HNL' },
            { id: '4414', name: 'Romania Liga I' },
            { id: '4459', name: 'Hungary NB I' },
            { id: '4438', name: 'Ukraine Premier League' },
            { id: '4451', name: 'Israel Premier League' },
            
            // ==========================================
            // AFRICA
            // ==========================================
            { id: '4507', name: 'South Africa Premiership' },
            { id: '4493', name: 'Egypt Premier League' },
            { id: '4511', name: 'Morocco Botola' },
            { id: '4499', name: 'Nigeria Premier League' },
            { id: '4495', name: 'Kenya Premier League' },
            { id: '4489', name: 'Ghana Premier League' },
            { id: '4501', name: 'Algeria Ligue 1' },
            { id: '4505', name: 'Tunisia Ligue 1' },
            { id: '4509', name: 'Ethiopia Premier League' },
            { id: '4491', name: 'DR Congo Premier League' },
            
            // ==========================================
            // AMERICAS
            // ==========================================
            { id: '4358', name: 'USA MLS' },
            { id: '4361', name: 'Mexico Liga MX' },
            { id: '4705', name: 'Argentina Liga Professional' },
            { id: '4569', name: 'Brazil Serie A' },
            { id: '4572', name: 'Brazil Serie B' },
            { id: '4565', name: 'Chile Primera Division' },
            { id: '4575', name: 'Colombia Primera A' },
            { id: '4567', name: 'Peru Primera Division' },
            { id: '4545', name: 'Uruguay Primera Division' },
            
            // ==========================================
            // ASIA & OCEANIA
            // ==========================================
            { id: '4563', name: 'Japan J1 League' },
            { id: '4560', name: 'Japan J2 League' },
            { id: '4597', name: 'Australia A-League' },
            { id: '4590', name: 'South Korea K League 1' },
            { id: '4593', name: 'China Super League' },
            { id: '4589', name: 'India Super League' },
            { id: '4603', name: 'Thailand Premier League' },
            { id: '4579', name: 'Indonesia Liga 1' },
            { id: '4607', name: 'Malaysia Super League' },
            { id: '4614', name: 'Saudi Pro League' },
            { id: '4610', name: 'UAE Arabian Gulf League' },
            { id: '4613', name: 'Qatar Stars League' }
        ];
        
        const allFixtures = [];
        
        for (const league of TARGET_LEAGUES) {
            try {
                const response = await axios.get(`${THESPORTSDB_BASE_URL}/${SPORTS_DB_KEY}/eventsnextleague.php`, {
                    params: { id: league.id },
                    timeout: 10000
                });
                
                const events = response.data?.events || [];
                
                if (events.length > 0) {
                    console.log(`[TheSportsDB] ${league.name}: ${events.length} fixtures`);
                }
                
                for (const event of events) {
                    if (!event.strHomeTeam || !event.strAwayTeam) continue;
                    
                    const startTime = event.strTimestamp 
                        ? new Date(event.strTimestamp).toISOString()
                        : event.dateEvent && event.strTime 
                            ? new Date(`${event.dateEvent}T${event.strTime}`).toISOString()
                            : null;
                    
                    allFixtures.push({
                        match_id: String(event.idEvent || `tsdb-${Date.now()}-${Math.random()}`),
                        sport: 'football',
                        home_team: event.strHomeTeam,
                        away_team: event.strAwayTeam,
                        date: startTime,
                        status: 'NS',
                        market: '1X2',
                        prediction: null,
                        confidence: null,
                        volatility: null,
                        odds: null,
                        provider: 'the-sports-db',
                        provider_name: 'TheSportsDB',
                        league: league.name,
                        league_id: league.id,
                        home_logo: event.strHomeTeamBadge || null,
                        away_logo: event.strAwayTeamBadge || null,
                        venue: event.strVenue || null,
                        city: null,
                        country: event.strCountry || null,
                        round: event.strRound || null,
                        raw_provider_data: event
                    });
                }
                
                await new Promise(r => setTimeout(r, 300));
                
            } catch (err) {
                // Silent fail for rate limiting, just skip this league
            }
        }
        
        console.log(`[STEP 1b] Total from TheSportsDB: ${allFixtures.length}`);
        return allFixtures;
        
    } catch (err) {
        console.error('[STEP 1b] Failed:', err.message);
        return [];
    }
}

// ============================================================
// STEP 2: FETCH WEATHER FOR EACH MATCH VENUE (USING AXIOS DIRECTLY)
// ============================================================
async function fetchWeatherForFixtures(fixtures) {
    console.log('\n[STEP 2] Fetching weather data for match venues...');
    
    const enrichedFixtures = [];
    let weatherFetched = 0;
    
    for (const fixture of fixtures) {
        try {
            const city = fixture.city || fixture.venue?.split(',').pop()?.trim() || null;
            
            if (city) {
                // Use Open-Meteo geocoding API directly with axios
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
                                hourly: 'temperature_2m,precipitation,weather_code,wind_speed_10m',
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
                        
                        const weatherDescriptions = {
                            0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
                            45: 'Fog', 48: 'Rime Fog', 51: 'Light Drizzle', 53: 'Drizzle',
                            55: 'Heavy Drizzle', 61: 'Light Rain', 63: 'Moderate Rain',
                            65: 'Heavy Rain', 71: 'Light Snow', 73: 'Moderate Snow', 75: 'Heavy Snow'
                        };
                        
                        fixture.weather = {
                            description: weatherDescriptions[code] || 'Unknown',
                            temp: temp ? Math.round(temp) : null,
                            wind: wind ? Math.round(wind) : null,
                            emoji: code >= 61 ? '🌧️' : code >= 51 ? '🌦️' : code >= 3 ? '⛅' : '☀️'
                        };
                        weatherFetched++;
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
    
    console.log(`[STEP 2] Weather fetched for ${weatherFetched}/${fixtures.length} fixtures`);
    return enrichedFixtures;
}

// ============================================================
// STEP 3: FETCH NEWS (SKIPPED - RapidAPI endpoints returning 404)
// ============================================================
async function fetchFootballNews() {
    console.log('\n[STEP 3] News fetch skipped (RapidAPI endpoints unavailable)');
    return new Map();
}

// ============================================================
// STEP 4: FETCH ODDS FROM ODDS-API
// ============================================================
async function enrichWithOdds(fixtures) {
    console.log('\n[STEP 4] Fetching odds data...');
    
    if (!ODDS_API_KEY) {
        console.log('[STEP 4] Odds API key missing, skipping...');
        return fixtures;
    }
    
    const enrichedFixtures = [];
    let oddsEnriched = 0;
    
    for (const fixture of fixtures) {
        try {
            const response = await axios.get(
                `https://api.the-odds-api.com/v4/sports/soccer_epl/odds`,
                {
                    params: {
                        apiKey: ODDS_API_KEY,
                        regions: 'uk,eu',
                        markets: 'h2h',
                        oddsFormat: 'decimal'
                    },
                    timeout: 10000
                }
            );
            
            const oddsData = response.data || [];
            const matchOdds = oddsData.find(o => 
                o.home_team === fixture.home_team || 
                o.away_team === fixture.away_team
            );
            
            if (matchOdds) {
                const bookmaker = matchOdds.bookmakers?.[0];
                const h2h = bookmaker?.markets?.find(m => m.key === 'h2h');
                const outcomes = h2h?.outcomes || [];
                
                const homeOdds = outcomes.find(o => o.name === fixture.home_team)?.price;
                const drawOdds = outcomes.find(o => o.name === 'Draw')?.price;
                const awayOdds = outcomes.find(o => o.name === fixture.away_team)?.price;
                
                fixture.odds = {
                    home: homeOdds,
                    draw: drawOdds,
                    away: awayOdds,
                    bookmaker: bookmaker?.title || 'Unknown'
                };
                
                // Derive prediction from odds
                if (homeOdds && drawOdds && awayOdds) {
                    const impliedProbs = [1/homeOdds, 1/drawOdds, 1/awayOdds];
                    const total = impliedProbs.reduce((a,b) => a+b, 0);
                    const normalized = impliedProbs.map(p => p/total);
                    
                    const maxIdx = normalized.indexOf(Math.max(...normalized));
                    const predictions = ['home_win', 'draw', 'away_win'];
                    const oddsConfidence = Math.round(Math.max(...normalized) * 100);
                    
                    fixture.prediction = predictions[maxIdx];
                    fixture.confidence = Math.max(55, Math.min(88, oddsConfidence));
                    fixture.volatility = oddsConfidence >= 72 ? 'low' : oddsConfidence >= 64 ? 'medium' : 'high';
                    
                    oddsEnriched++;
                }
            }
            
            enrichedFixtures.push(fixture);
            await new Promise(r => setTimeout(r, 150));
            
        } catch (err) {
            enrichedFixtures.push(fixture);
        }
    }
    
    console.log(`[STEP 4] Odds enriched for ${oddsEnriched}/${fixtures.length} fixtures`);
    return enrichedFixtures;
}

// ============================================================
// STEP 5: GENERATE EDGEMIND REPORTS USING AI
// ============================================================
async function generateEdgeMindReports(fixtures) {
    console.log('\n[STEP 5] Generating EdgeMind Bot reports with AI...');
    
    const { generateInsight } = require('../backend/services/aiProvider');
    
    const enrichedFixtures = [];
    let aiGenerated = 0;
    
    for (const fixture of fixtures) {
        try {
            if (fixture.prediction && fixture.confidence) {
                const insightData = await generateInsight({
                    home: fixture.home_team,
                    away: fixture.away_team,
                    league: fixture.league,
                    kickoff: fixture.date,
                    market: '1X2',
                    confidence: fixture.confidence,
                    formData: null,
                    h2h: null,
                    weather: fixture.weather?.description || null,
                    absences: null
                });
                
                fixture.edgemind_report = insightData.edgemind_report;
                fixture.market_name = insightData.market_name;
                fixture.ai_confidence = insightData.confidence;
                
                // Generate secondary insights if confidence is 50-68%
                if (fixture.confidence >= 50 && fixture.confidence <= 68) {
                    fixture.secondary_insights = [
                        { type: 'Double Chance 1X', confidence: Math.min(82, fixture.confidence + 20) },
                        { type: 'Over 1.5 Goals', confidence: Math.min(78, fixture.confidence + 15) },
                        { type: 'BTTS YES', confidence: Math.min(75, fixture.confidence + 12) }
                    ].filter(s => s.confidence >= 76);
                }
                
                aiGenerated++;
                
                if (aiGenerated <= 3) {
                    console.log(`[AI] ${fixture.home_team} vs ${fixture.away_team}: ${insightData.market_name} @ ${insightData.confidence}%`);
                }
            } else {
                fixture.edgemind_report = `On paper analysis for ${fixture.home_team} vs ${fixture.away_team} in ${fixture.league}. Match conditions: ${fixture.weather?.description || 'Unknown weather'}.`;
            }
            
            enrichedFixtures.push(fixture);
            await new Promise(r => setTimeout(r, 300));
            
        } catch (err) {
            console.warn(`[AI] ${fixture.home_team} vs ${fixture.away_team} failed:`, err.message);
            fixture.edgemind_report = `Analysis pending for ${fixture.home_team} vs ${fixture.away_team}.`;
            enrichedFixtures.push(fixture);
        }
    }
    
    console.log(`[STEP 5] EdgeMind reports generated for ${aiGenerated}/${fixtures.length} fixtures`);
    return enrichedFixtures;
}

// ============================================================
// STEP 6: SAVE TO SUPABASE
// ============================================================
async function saveToSupabase(fixtures) {
    console.log('\n[STEP 6] Saving predictions to Supabase...');
    
    const client = await pool.connect();
    let saved = 0;
    
    try {
        await client.query('BEGIN');
        
        // Clear old predictions for today (optional - keeps data fresh)
        await client.query(`
            DELETE FROM predictions_final 
            WHERE DATE(created_at) = CURRENT_DATE 
            AND tier = 'normal'
        `);
        console.log('[DB] Cleared today\'s predictions');
        
        for (const fixture of fixtures) {
            if (!fixture.home_team || !fixture.away_team) continue;
            
            try {
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
                        home_team_name: fixture.home_team,
                        away_team_name: fixture.away_team,
                        venue: fixture.venue,
                        weather: fixture.weather,
                        odds: fixture.odds,
                        edgemind_report: fixture.edgemind_report,
                        secondary_insights: fixture.secondary_insights
                    }
                }];
                
                const sql = `
                    INSERT INTO predictions_final (
                        tier, type, matches, total_confidence, risk_level, sport, market_type, recommendation,
                        edgemind_report, secondary_insights, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                    ON CONFLICT DO NOTHING
                    RETURNING id
                `;
                
                const confidence = fixture.confidence || fixture.ai_confidence || 65;
                const riskLevel = confidence >= 72 ? 'safe' : confidence >= 60 ? 'medium' : 'high';
                const prediction = fixture.market_name || fixture.prediction || 'Home Win';
                
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
                    saved++;
                    console.log(`[DB] Saved: ${fixture.home_team} vs ${fixture.away_team} (${confidence}%)`);
                }
                
            } catch (err) {
                console.error(`[DB] Save failed for ${fixture.home_team} vs ${fixture.away_team}:`, err.message);
            }
        }
        
        await client.query('COMMIT');
        console.log(`[STEP 6] Saved ${saved}/${fixtures.length} predictions to Supabase`);
        return saved;
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[STEP 6] Transaction failed:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

// ============================================================
// MAIN EXECUTION
// ============================================================
async function main() {
    console.log('\n========================================');
    console.log('  SKCS AI SPORTS EDGE - LIVE DATA PIPELINE');
    console.log('========================================\n');
    
    try {
        // STEP 1: Fetch from API-Sports (demo mode with historical data)
        let apiSportsFixtures = await fetchFixturesFromAPISportsV2();
        
        // STEP 1b: Supplementary from TheSportsDB
        let sportsDbFixtures = await fetchFixturesFromTheSportsDB();
        
        // Combine and deduplicate
        const allFixturesMap = new Map();
        
        // Add API-Sports fixtures first (higher priority)
        for (const f of apiSportsFixtures) {
            const key = `${f.home_team}-${f.away_team}-${f.league}`;
            if (!allFixturesMap.has(key) && f.home_team && f.away_team) {
                allFixturesMap.set(key, f);
            }
        }
        
        // Add TheSportsDB fixtures (avoid duplicates)
        for (const f of sportsDbFixtures) {
            const key = `${f.home_team}-${f.away_team}-${f.league}`;
            if (!allFixturesMap.has(key) && f.home_team && f.away_team) {
                allFixturesMap.set(key, f);
            }
        }
        
        let fixtures = Array.from(allFixturesMap.values());
        
        if (fixtures.length === 0) {
            console.log('[WARNING] No fixtures from API sources. Trying fallback...');
            fixtures = await buildLiveData({ sport: 'football' });
        }
        
        if (fixtures.length === 0) {
            console.log('[ERROR] No fixtures available from any source!');
            return;
        }
        
        console.log(`\n[TOTAL] Combined fixtures: ${fixtures.length}`);
        
        // STEP 2: Fetch weather
        fixtures = await fetchWeatherForFixtures(fixtures);
        
        // STEP 3: Fetch news
        const news = await fetchFootballNews();
        
        // STEP 4: Enrich with odds
        fixtures = await enrichWithOdds(fixtures);
        
        // STEP 5: Generate AI reports
        fixtures = await generateEdgeMindReports(fixtures);
        
        // STEP 6: Save to Supabase
        const saved = await saveToSupabase(fixtures);
        
        console.log('\n========================================');
        console.log('  PIPELINE COMPLETE');
        console.log('========================================');
        console.log(`Fixtures processed: ${fixtures.length}`);
        console.log(`Predictions saved: ${saved}`);
        console.log(`Database: Supabase`);
        console.log('');
        console.log('Refresh your website to see LIVE predictions!');
        
    } catch (err) {
        console.error('\n[ERROR] Pipeline failed:', err.message);
        process.exit(1);
    }
    
    process.exit(0);
}

main();
