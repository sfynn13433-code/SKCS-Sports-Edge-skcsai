/**
 * oddsApiPipeline.js - The Odds API Integration Service
 * 
 * Fetches odds from The Odds API for upcoming fixtures,
 * maps bookmakers to canonical_bookmakers table,
 * and stores structured odds data in match_context_data.odds JSONB
 * 
 * Handles rate limiting gracefully for API quota management
 */

const { Pool } = require('pg');
const axios = require('axios');
const config = require('../config');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Rate limiting configuration
const RATE_LIMIT = {
    requestsPerMinute: 10,      // Conservative: 10 requests per minute
    requestsPerHour: 500,       // Conservative: 500 requests per hour
    requestsPerDay: 1000,        // Conservative: 1000 requests per day
    currentMinuteRequests: 0,
    currentHourRequests: 0,
    currentDayRequests: 0,
    lastMinuteReset: Date.now(),
    lastHourReset: Date.now(),
    lastDayReset: Date.now()
};

// Cache for canonical bookmakers
let bookmakerCache = null;
let bookmakerCacheTimestamp = 0;
const BOOKMAKER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Rate limiting check before making API calls
 */
async function checkRateLimit() {
    const now = Date.now();
    
    // Reset counters based on time windows
    if (now - RATE_LIMIT.lastMinuteReset >= 60 * 1000) {
        RATE_LIMIT.currentMinuteRequests = 0;
        RATE_LIMIT.lastMinuteReset = now;
    }
    
    if (now - RATE_LIMIT.lastHourReset >= 60 * 60 * 1000) {
        RATE_LIMIT.currentHourRequests = 0;
        RATE_LIMIT.lastHourReset = now;
    }
    
    if (now - RATE_LIMIT.lastDayReset >= 24 * 60 * 60 * 1000) {
        RATE_LIMIT.currentDayRequests = 0;
        RATE_LIMIT.lastDayReset = now;
    }
    
    // Check limits and wait if necessary
    if (RATE_LIMIT.currentMinuteRequests >= RATE_LIMIT.requestsPerMinute) {
        const waitTime = 60 * 1000 - (now - RATE_LIMIT.lastMinuteReset);
        console.log(`[OddsAPI] Rate limit reached (minute). Waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return checkRateLimit(); // Recursive check after wait
    }
    
    if (RATE_LIMIT.currentHourRequests >= RATE_LIMIT.requestsPerHour) {
        const waitTime = 60 * 60 * 1000 - (now - RATE_LIMIT.lastHourReset);
        console.log(`[OddsAPI] Rate limit reached (hour). Waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return checkRateLimit(); // Recursive check after wait
    }
    
    if (RATE_LIMIT.currentDayRequests >= RATE_LIMIT.requestsPerDay) {
        const waitTime = 24 * 60 * 60 * 1000 - (now - RATE_LIMIT.lastDayReset);
        console.log(`[OddsAPI] Rate limit reached (day). Waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return checkRateLimit(); // Recursive check after wait
    }
    
    // Increment counters
    RATE_LIMIT.currentMinuteRequests++;
    RATE_LIMIT.currentHourRequests++;
    RATE_LIMIT.currentDayRequests++;
    
    return true;
}

/**
 * Get canonical bookmakers from database with caching
 */
async function getCanonicalBookmakers() {
    const now = Date.now();
    
    if (bookmakerCache && (now - bookmakerCacheTimestamp) < BOOKMAKER_CACHE_TTL) {
        return bookmakerCache;
    }
    
    try {
        const result = await pool.query(`
            SELECT bookmaker_key, title, is_active, priority_order 
            FROM canonical_bookmakers 
            WHERE is_active = true 
            ORDER BY priority_order ASC
        `);
        
        bookmakerCache = result.rows;
        bookmakerCacheTimestamp = now;
        
        console.log(`[OddsAPI] Loaded ${bookmakerCache.length} canonical bookmakers`);
        return bookmakerCache;
    } catch (error) {
        console.error('[OddsAPI] Error loading canonical bookmakers:', error);
        return [];
    }
}

/**
 * Map The Odds API bookmaker names to our canonical keys
 */
function mapBookmakerToCanonical(apiBookmaker, canonicalBookmakers) {
    const mapping = {
        'betmgm': 'betmgm',
        'draftkings': 'draftkings', 
        'fanduel': 'fanduel',
        'bet365': 'bet365',
        'williamhill': 'william_hill',
        'paddypower': 'paddy_power',
        'betfair': 'betfair',
        'skybet': 'skybet',
        'betway': 'betway',
        '888sport': '888sport',
        'ladbrokes': 'ladbrokes',
        'coral': 'coral',
        'unibet': 'unibet',
        'betvictor': 'betvictor',
        'pinnacle': 'pinnacle',
        'betfred': 'betfred',
        'marathonbet': 'marathonbet',
        '10bet': '10bet',
        'betonline': 'betonline'
    };
    
    const canonicalKey = mapping[apiBookmaker.toLowerCase()];
    if (canonicalKey) {
        return canonicalBookmakers.find(b => b.bookmaker_key === canonicalKey);
    }
    
    return null;
}

/**
 * Fetch odds for a specific sport from The Odds API
 */
async function fetchOddsForSport(sport) {
    await checkRateLimit();
    
    try {
        const apiKey = config.ODDS_API_KEY;
        if (!apiKey) {
            console.error('[OddsAPI] ODDS_API_KEY not configured');
            return null;
        }
        
        const sportKey = mapSportToOddsApi(sport);
        if (!sportKey) {
            console.log(`[OddsAPI] Sport ${sport} not supported by The Odds API`);
            return null;
        }
        
        const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds`;
        const params = {
            apiKey: apiKey,
            regions: 'us,eu,uk',  // Multiple regions for better coverage
            markets: 'h2h,ou,totals,spreads',  // Head-to-head, Over/Under, Totals, Spreads
            oddsFormat: 'decimal',
            dateFormat: 'iso'
        };
        
        console.log(`[OddsAPI] Fetching odds for ${sport} (${sportKey})`);
        
        const response = await axios.get(url, { params, timeout: 15000 });
        
        RATE_LIMIT.currentMinuteRequests++;
        console.log(`[OddsAPI] Successfully fetched ${response.data.length} odds entries for ${sport}`);
        
        return response.data;
    } catch (error) {
        console.error(`[OddsAPI] Error fetching odds for ${sport}:`, error.response?.data || error.message);
        return null;
    }
}

/**
 * Map SKCS sport names to The Odds API sport keys
 */
function mapSportToOddsApi(sport) {
    const mapping = {
        'soccer': 'soccer',
        'football': 'soccer',
        'basketball': 'basketball',
        'tennis': 'tennis',
        'cricket': 'cricket',
        'baseball': 'baseball',
        'hockey': 'ice_hockey',
        'american_football': 'american_football',
        'mma': 'mma_mixed_martial_arts',
        'boxing': 'boxing'
    };
    
    return mapping[sport.toLowerCase()];
}

/**
 * Process and structure odds data for database storage
 */
function processOddsData(oddsData, canonicalBookmakers) {
    const processedOdds = {};
    
    for (const event of oddsData) {
        const eventId = event.id;
        processedOdds[eventId] = {
            sport: event.sport_key,
            home_team: event.home_team,
            away_team: event.away_team,
            commence_time: event.commence_time,
            bookmakers: {}
        };
        
        for (const bookmaker of event.bookmakers) {
            const canonicalBookmaker = mapBookmakerToCanonical(bookmaker.key, canonicalBookmakers);
            if (!canonicalBookmaker) {
                continue; // Skip bookmakers not in our canonical list
            }
            
            const bookmakerOdds = {};
            
            // Process different market types
            for (const market of bookmaker.markets) {
                switch (market.key) {
                    case 'h2h':
                        bookmakerOdds['1x2'] = {
                            home: market.outcomes[0]?.price || null,
                            draw: market.outcomes[1]?.price || null,
                            away: market.outcomes[2]?.price || null
                        };
                        break;
                    
                    case 'ou':
                    case 'totals':
                        const overUnder = market.key === 'ou' ? 'over_under' : 'totals';
                        bookmakerOdds[overUnder] = {};
                        for (const outcome of market.outcomes) {
                            const line = outcome.point || outcome.name?.match(/\d+\.?\d*/)?.[0];
                            if (line) {
                                bookmakerOdds[overUnder][line] = {
                                    over: outcome.name.toLowerCase().includes('over') ? outcome.price : null,
                                    under: outcome.name.toLowerCase().includes('under') ? outcome.price : null
                                };
                            }
                        }
                        break;
                    
                    case 'spreads':
                        bookmakerOdds['spreads'] = {};
                        for (const outcome of market.outcomes) {
                            const spread = outcome.point || 0;
                            bookmakerOdds['spreads'][spread] = {
                                home: outcome.name.toLowerCase().includes('home') ? outcome.price : null,
                                away: outcome.name.toLowerCase().includes('away') ? outcome.price : null
                            };
                        }
                        break;
                }
            }
            
            processedOdds[eventId].bookmakers[canonicalBookmaker.bookmaker_key] = bookmakerOdds;
        }
    }
    
    return processedOdds;
}

/**
 * Store odds data in match_context_data table
 */
async function storeOddsInDatabase(processedOdds) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        let updateCount = 0;
        
        for (const [eventId, oddsData] of Object.entries(processedOdds)) {
            // Find corresponding fixture in raw_fixtures table
            const fixtureResult = await client.query(`
                SELECT id_event FROM raw_fixtures 
                WHERE id_event = $1 OR raw_json->>'id' = $1
                LIMIT 1
            `, [eventId]);
            
            if (fixtureResult.rows.length === 0) {
                continue; // No matching fixture found
            }
            
            const idEvent = fixtureResult.rows[0].id_event;
            
            // Update match_context_data with odds
            await client.query(`
                INSERT INTO match_context_data (id_event, odds, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (id_event) 
                DO UPDATE SET 
                    odds = EXCLUDED.odds,
                    updated_at = NOW()
            `, [idEvent, JSON.stringify(oddsData)]);
            
            updateCount++;
        }
        
        await client.query('COMMIT');
        console.log(`[OddsAPI] Successfully stored odds for ${updateCount} fixtures`);
        
        return updateCount;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[OddsAPI] Error storing odds in database:', error);
        return 0;
    } finally {
        client.release();
    }
}

/**
 * Main pipeline function to fetch and store odds for all sports
 */
async function runOddsPipeline(sports = ['soccer', 'basketball', 'tennis']) {
    console.log('[OddsAPI] Starting odds pipeline for sports:', sports);
    
    try {
        const canonicalBookmakers = await getCanonicalBookmakers();
        if (canonicalBookmakers.length === 0) {
            console.error('[OddsAPI] No canonical bookmakers found');
            return { success: false, error: 'No canonical bookmakers available' };
        }
        
        let totalProcessed = 0;
        const results = {};
        
        for (const sport of sports) {
            console.log(`[OddsAPI] Processing ${sport}...`);
            
            const oddsData = await fetchOddsForSport(sport);
            if (!oddsData) {
                results[sport] = { success: false, error: 'Failed to fetch odds' };
                continue;
            }
            
            const processedOdds = processOddsData(oddsData, canonicalBookmakers);
            const storedCount = await storeOddsInDatabase(processedOdds);
            
            results[sport] = { 
                success: true, 
                fetched: oddsData.length, 
                stored: storedCount 
            };
            totalProcessed += storedCount;
        }
        
        console.log(`[OddsAPI] Pipeline completed. Total fixtures processed: ${totalProcessed}`);
        
        return { 
            success: true, 
            totalProcessed, 
            results,
            rateLimitStatus: {
                minuteRequests: RATE_LIMIT.currentMinuteRequests,
                hourRequests: RATE_LIMIT.currentHourRequests,
                dayRequests: RATE_LIMIT.currentDayRequests
            }
        };
        
    } catch (error) {
        console.error('[OddsAPI] Pipeline error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get current rate limit status
 */
function getRateLimitStatus() {
    return {
        currentMinuteRequests: RATE_LIMIT.currentMinuteRequests,
        currentHourRequests: RATE_LIMIT.currentHourRequests,
        currentDayRequests: RATE_LIMIT.currentDayRequests,
        limits: {
            perMinute: RATE_LIMIT.requestsPerMinute,
            perHour: RATE_LIMIT.requestsPerHour,
            perDay: RATE_LIMIT.requestsPerDay
        }
    };
}

module.exports = {
    runOddsPipeline,
    fetchOddsForSport,
    getCanonicalBookmakers,
    getRateLimitStatus,
    checkRateLimit
};
