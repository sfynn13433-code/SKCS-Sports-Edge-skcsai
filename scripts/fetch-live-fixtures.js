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
// STEP 1: FETCH REAL FIXTURES FROM API-SPORTS
// ============================================================
async function fetchFixturesFromAPISports() {
    console.log('[STEP 1] Fetching real fixtures from API-Sports...');
    
    try {
        const today = new Date().toISOString().slice(0, 10);
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        
        const leagues = [
            { id: '4328', name: 'Premier League' },
            { id: '4334', name: 'Ligue 1' },
            { id: '4332', name: 'Serie A' },
            { id: '4335', name: 'La Liga' },
            { id: '4331', name: 'Bundesliga' },
            { id: '4391', name: 'Champions League' }
        ];
        
        const allFixtures = [];
        
        for (const league of leagues) {
            try {
                const url = `https://v3.football.api-sports.io/fixtures`;
                const response = await axios.get(url, {
                    params: {
                        league: league.id,
                        season: '2025',
                        from: today,
                        to: tomorrow,
                        status: 'NS'
                    },
                    headers: {
                        'x-apisports-key': APISPORTS_KEY
                    },
                    timeout: 15000
                });
                
                const fixtures = response.data?.response || [];
                console.log(`[API-Sports] ${league.name}: ${fixtures.length} fixtures`);
                
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
                        odds: f.odds?.values?.[0] || null,
                        provider: 'api-sports',
                        provider_name: 'API-Football',
                        league: league.name,
                        league_id: league.id,
                        home_logo: f.teams?.home?.logo || null,
                        away_logo: f.teams?.away?.logo || null,
                        venue: f.fixture.venue?.name || null,
                        city: f.fixture.venue?.city || null,
                        country: f.league?.country || null,
                        round: f.league?.round || null,
                        raw_provider_data: f
                    });
                }
                
                await new Promise(r => setTimeout(r, 300));
            } catch (err) {
                console.error(`[API-Sports] ${league.name} failed:`, err.message);
            }
        }
        
        console.log(`[STEP 1] Total fixtures fetched: ${allFixtures.length}`);
        return allFixtures;
        
    } catch (err) {
        console.error('[STEP 1] Failed:', err.message);
        return [];
    }
}

// ============================================================
// STEP 2: FETCH WEATHER FOR EACH MATCH VENUE
// ============================================================
async function fetchWeatherForFixtures(fixtures) {
    console.log('\n[STEP 2] Fetching weather data for match venues...');
    
    const enrichedFixtures = [];
    let weatherFetched = 0;
    
    for (const fixture of fixtures) {
        try {
            // Try to get city/country for weather lookup
            const city = fixture.city || fixture.venue?.split(',').pop()?.trim() || null;
            const country = fixture.country || null;
            
            if (city && country) {
                // Use Open-Meteo geocoding + weather
                const geoResponse = await axios.get(
                    `https://geocoding-api.open-meteo.com/v1/search`,
                    { params: { name: city, count: 1 }, timeout: 5000 }
                );
                
                const geoData = geoResponse.data?.results?.[0];
                
                if (geoData) {
                    const weather = await getWeather(geoData.latitude, geoData.longitude, fixture.date);
                    fixture.weather = weather;
                    weatherFetched++;
                    
                    if (weatherFetched <= 3) {
                        console.log(`[Weather] ${fixture.home_team} vs ${fixture.away_team}: ${weather.description} ${weather.temp}°C`);
                    }
                }
            }
            
            if (!fixture.weather) {
                fixture.weather = { description: 'Unknown', temp: null, wind: null, rain: null, emoji: '?' };
            }
            
            enrichedFixtures.push(fixture);
            await new Promise(r => setTimeout(r, 100));
            
        } catch (err) {
            fixture.weather = { description: 'Unavailable', temp: null, wind: null, rain: null, emoji: '?' };
            enrichedFixtures.push(fixture);
        }
    }
    
    console.log(`[STEP 2] Weather fetched for ${weatherFetched}/${fixtures.length} fixtures`);
    return enrichedFixtures;
}

// ============================================================
// STEP 3: FETCH NEWS FROM RAPIDAPI
// ============================================================
async function fetchFootballNews() {
    console.log('\n[STEP 3] Fetching football news from RapidAPI...');
    
    const newsCache = new Map();
    
    try {
        const leagues = [
            { name: 'Premier League', id: '4328' },
            { name: 'La Liga', id: '4335' },
            { name: 'Serie A', id: '4332' },
            { name: 'Bundesliga', id: '4331' },
            { name: 'Ligue 1', id: '4334' }
        ];
        
        for (const league of leagues) {
            try {
                const response = await axios.get(
                    `https://${process.env.RAPIDAPI_HOST_NEWSNOW || 'newsnow.p.rapidapi.com'}/news`,
                    {
                        params: { query: `${league.name} football team`, language: 'en' },
                        headers: {
                            'x-rapidapi-key': RAPIDAPI_KEY,
                            'x-rapidapi-host': process.env.RAPIDAPI_HOST_NEWSNOW || 'newsnow.p.rapidapi.com'
                        },
                        timeout: 10000
                    }
                );
                
                const articles = response.data?.results || [];
                newsCache.set(league.name, articles.slice(0, 5));
                console.log(`[News] ${league.name}: ${articles.length} articles`);
                
                await new Promise(r => setTimeout(r, 200));
            } catch (err) {
                console.warn(`[News] ${league.name} failed:`, err.message);
            }
        }
        
    } catch (err) {
        console.error('[STEP 3] News fetch failed:', err.message);
    }
    
    return newsCache;
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
        // STEP 1: Fetch real fixtures
        let fixtures = await fetchFixturesFromAPISports();
        
        if (fixtures.length === 0) {
            console.log('[WARNING] No fixtures from API-Sports. Trying fallback sources...');
            fixtures = await buildLiveData({ sport: 'football' });
        }
        
        if (fixtures.length === 0) {
            console.log('[ERROR] No fixtures available from any source!');
            return;
        }
        
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
