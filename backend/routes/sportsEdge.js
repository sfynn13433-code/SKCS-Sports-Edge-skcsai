/**
 * SKCS AI Sports Edge - Integration Routes & Caching Layer
 * Proxies requests with rate limiting and caching to protect 10 RPM limit
 * Directive: Do not break the system or update existing code.
 */

const express = require('express');
const axios = require('axios');
const Bottleneck = require('bottleneck');
const NodeCache = require('node-cache');

const router = express.Router();

// Import hybrid sports data service
const { getFeaturedGames, getLiveScores, healthCheck } = require('../services/hybridSportsDataService');
const { getEnhancedMatchDetails } = require('../services/enhancedMatchDetailsService');

// API Governor: 6500ms to stay strictly under 10 RPM
const apiGovernor = new Bottleneck({
  minTime: 6500, 
  maxConcurrent: 1,
  reservoir: 10, // Maximum 10 requests
  reservoirRefreshAmount: 10,
  reservoirRefreshInterval: 60 * 1000 // Reset every minute
});

// Cache config: Featured games for 1 hour, Trends for 1 hour, other data varies
const dataCache = new NodeCache({ 
  stdTTL: 3600, // Default 1 hour
  checkperiod: 600 // Check for expired keys every 10 minutes
});

// Cache statistics tracking
let cacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  totalRequests: 0
};

// API Configuration
const API_KEY = process.env.RAPIDAPI_KEY || process.env.SPORTSAPI_PRO_FOOTBALL_RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY || '';
const API_HOST = process.env.RAPIDAPI_HOST_SPORTS_EDGE || 'sportsapi-pro-football-data.p.rapidapi.com';

// Generic Fetcher wrapped in Governor with caching
const fetchFromRapidAPI = apiGovernor.wrap(async (endpoint, params, cacheKey, ttl = 3600) => {
  cacheStats.totalRequests++;
  
  // Check cache first
  const cachedData = dataCache.get(cacheKey);
  if (cachedData) {
    cacheStats.hits++;
    console.log(`[SportsEdge] Cache hit for: ${cacheKey}`);
    return cachedData;
  }
  
  cacheStats.misses++;
  console.log(`[SportsEdge] API call: ${endpoint} (cache key: ${cacheKey})`);
  
  try {
    const options = {
      method: 'GET',
      url: `https://${API_HOST}${endpoint}`,
      params: params,
      headers: {
        'X-RapidAPI-Key': API_KEY,
        'X-RapidAPI-Host': API_HOST,
        'Accept-Encoding': 'gzip, deflate'
      },
      timeout: 10000 // 10 second timeout
    };
    
    const response = await axios.request(options);
    
    // Cache the successful response
    dataCache.set(cacheKey, response.data, ttl);
    
    console.log(`[SportsEdge] API success: ${endpoint} (${JSON.stringify(response.data).length} bytes)`);
    return response.data;
    
  } catch (error) {
    cacheStats.errors++;
    console.error(`[SportsEdge] API error for ${endpoint}:`, error.message);
    
    // Return cached data if available on error
    const staleData = dataCache.get(cacheKey, true);
    if (staleData) {
      console.log(`[SportsEdge] Using stale cache for: ${cacheKey}`);
      return staleData;
    }
    
    throw error;
  }
});

/**
 * FEATURED GAMES: Hero Carousel
 * Hybrid approach: ESPN → TheSportsDB → Free Livescore → Pro Football
 * Cache: 5 minutes for live data, 1 hour for fixtures
 */
router.get('/api/featured-games', async (req, res) => {
  const cacheKey = 'featured_games';
  try {
    // Check cache first
    const cachedData = dataCache.get(cacheKey);
    if (cachedData) {
      cacheStats.hits++;
      return res.json({
        success: true,
        data: cachedData,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }
    
    cacheStats.misses++;
    
    // Use hybrid sports data service with optimal rate limit strategy
    const hybridResult = await getFeaturedGames();
    
    if (hybridResult && hybridResult.data && hybridResult.data.length > 0) {
      // Cache the successful result
      const cacheData = {
        suggestedGames: hybridResult.data,
        source: hybridResult.source,
        fallback: hybridResult.fallback,
        totalSources: hybridResult.totalSources,
        rateLimit: hybridResult.rateLimit,
        priority: hybridResult.priority,
        apiNote: `Using ${hybridResult.source} (${hybridResult.rateLimit})`
      };
      
      // Cache for 5 minutes if live data, 1 hour if fixtures
      const cacheTTL = hybridResult.data.some(game => game.isLive) ? 300 : 3600;
      dataCache.set(cacheKey, cacheData, cacheTTL);
      
      res.json({
        success: true,
        data: cacheData,
        cached: false,
        timestamp: new Date().toISOString()
      });
    } else {
      // Fallback to empty response with error info
      const fallbackData = {
        suggestedGames: [],
        source: hybridResult?.source || 'none',
        fallback: true,
        error: hybridResult?.error || 'No data available'
      };
      
      dataCache.set(cacheKey, fallbackData, 300); // Cache empty result for 5 minutes
      
      res.json({
        success: false,
        data: fallbackData,
        cached: false,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    cacheStats.errors++;
    console.error('[Hybrid] Error fetching featured games:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve featured games',
      cached: false
    });
  }
});

/**
 * AI TRENDS: Betting Edge Dashboard
 * Endpoint: /trends?sports=1
 * Cache: 1 hour for trends data
 */
router.get('/api/trends', async (req, res) => {
  const cacheKey = 'ai_trends';
  try {
    const data = await fetchFromRapidAPI('/trends', { sports: '1' }, cacheKey, 3600); // 1 hour cache
    
    // Filter and format trends for frontend
    const filteredTrends = (data.trends || []).slice(0, 10).map(trend => ({
      id: trend.id,
      description: trend.description || trend.title,
      hitRate: trend.hitRate || trend.percentage || 0,
      steaming: trend.steaming || trend.lineMoving || false,
      oldRate: trend.oldRate || trend.previousOdds,
      rate: trend.rate || trend.currentOdds,
      aiProbability: trend.aiProbability || trend.aiConfidence || 0,
      publicVote: trend.publicVote || trend.publicPercentage || 0,
      isTop: trend.isTop || false,
      sport: trend.sport || 'football',
      confidence: trend.confidence || 0
    }));
    
    res.json({
      success: true,
      data: {
        trends: filteredTrends,
        total: filteredTrends.length,
        lastUpdated: new Date().toISOString()
      },
      cached: dataCache.has(cacheKey),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching trends:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve betting trends',
      cached: false
    });
  }
});

/**
 * LIVE SCORES: Real-time game updates
 * Endpoint: /fixtures/live
 * Cache: 1 minute for live data
 */
router.get('/api/live-scores', async (req, res) => {
  const cacheKey = 'live_scores';
  try {
    // Prefer hybrid approach to avoid provider endpoint mismatch
    const hybrid = await getLiveScores();
    const rows = Array.isArray(hybrid?.data) ? hybrid.data : [];

    const liveGames = rows.slice(0, 20).map((game) => ({
      id: game?.fixture?.id || game?.id || game?.gameId || game?.eventId || null,
      homeTeam: game?.teams?.home?.name || game?.homeTeam || game?.homeTeamName || null,
      awayTeam: game?.teams?.away?.name || game?.awayTeam || game?.awayTeamName || null,
      homeScore: game?.goals?.home ?? game?.score?.home ?? game?.homeScore ?? null,
      awayScore: game?.goals?.away ?? game?.score?.away ?? game?.awayScore ?? null,
      status: game?.fixture?.status?.short || game?.status || (game?.isLive ? 'LIVE' : 'NS'),
      minute: game?.fixture?.status?.elapsed || game?.minute || null,
      competition: game?.league?.name || game?.tournamentName || game?.competition || null,
      source: hybrid?.source || null
    }));

    // Cache for 1 minute when live
    dataCache.set(cacheKey, { games: liveGames, source: hybrid?.source || 'hybrid' }, 60);

    res.json({
      success: true,
      data: {
        games: liveGames,
        total: liveGames.length,
        lastUpdated: new Date().toISOString(),
        source: hybrid?.source || 'hybrid',
        fallback: Boolean(hybrid?.fallback)
      },
      cached: false
    });
  } catch (error) {
    console.error('Error fetching live scores:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve live scores'
    });
  }
});

/**
 * GAME DETAILS: Match deep-dive analytics with enhanced fallback
 * Endpoint: /web/games/details?gameId={id}
 * Cache: 30 minutes for game details
 * Uses enhanced service when Pro Football API doesn't have the match
 */
router.get('/api/game-details/:gameId', async (req, res) => {
  const { gameId } = req.params;
  const cacheKey = `game_details_${gameId}`;
  
  if (!gameId) {
    return res.status(400).json({
      success: false,
      error: 'Game ID is required'
    });
  }
  
  try {
    // Check cache first
    const cachedData = dataCache.get(cacheKey);
    if (cachedData) {
      return res.json({
        success: true,
        data: cachedData,
        cached: true
      });
    }
    
    // Try Pro Football API first (original implementation)
    try {
      const data = await fetchFromRapidAPI('/web/games/details', { gameId }, cacheKey, 1800); // 30 min cache
      
      // Extract key information for bandwidth efficiency
      const gameDetails = {
        id: data.game?.id,
        homeTeam: data.game?.homeCompetitor?.name,
        awayTeam: data.game?.awayCompetitor?.name,
        homeScore: data.game?.homeCompetitor?.score,
        awayScore: data.game?.awayCompetitor?.score,
        status: data.game?.status,
        startTime: data.game?.startTime,
        venue: data.game?.venue,
        lineups: data.game?.homeCompetitor?.lineups?.slice(0, 11) || [], // Starting 11 only
        events: (data.game?.events || []).slice(0, 20), // Recent events only
        predictions: data.game?.promotedPredictions || [],
        highlights: data.game?.video || null,
        source: 'profootball'
      };
      
      // Cache successful result
      dataCache.set(cacheKey, gameDetails, 1800);
      
      return res.json({
        success: true,
        data: gameDetails,
        cached: false
      });
      
    } catch (proFootballError) {
      console.log(`[GameDetails] Pro Football API failed for ${gameId}:`, proFootballError.message);
      
      // Fallback to enhanced match details service
      console.log(`[GameDetails] Using enhanced service for ${gameId}`);
      
      // Extract team names from gameId if possible (assuming format like "lorient-vs-havre")
      const teamNames = extractTeamNamesFromGameId(gameId);
      const enhancedData = await getEnhancedMatchDetails(
        gameId, 
        teamNames.homeTeam, 
        teamNames.awayTeam, 
        'Ligue 1', // Default league, can be enhanced
        new Date().toISOString()
      );
      
      if (enhancedData) {
        // Format enhanced data to match expected structure
        const gameDetails = {
          id: gameId,
          homeTeam: enhancedData.homeTeam,
          awayTeam: enhancedData.awayTeam,
          homeScore: enhancedData.homeScore,
          awayScore: enhancedData.awayScore,
          status: enhancedData.status,
          startTime: enhancedData.startTime,
          venue: enhancedData.venue,
          lineups: [], // Enhanced service doesn't provide lineups yet
          events: [], // Enhanced service doesn't provide events yet
          predictions: enhancedData.aiPrediction ? [enhancedData.aiPrediction] : [],
          highlights: null,
          source: enhancedData.source || 'enhanced_template',
          enriched: enhancedData.enriched || false,
          weather: enhancedData.weather || '🌤️ Unavailable',
          aiAnalysis: enhancedData.aiPrediction?.analysis || 'Enhanced AI analysis unavailable'
        };
        
        // Cache enhanced result for shorter time (15 minutes)
        dataCache.set(cacheKey, gameDetails, 900);
        
        return res.json({
          success: true,
          data: gameDetails,
          cached: false,
          fallback: true
        });
      }
      
      // Last resort: return basic template
      const basicGameDetails = {
        id: gameId,
        homeTeam: teamNames.homeTeam || 'Home Team',
        awayTeam: teamNames.awayTeam || 'Away Team',
        homeScore: null,
        awayScore: null,
        status: 'NS',
        startTime: new Date().toISOString(),
        venue: 'Stadium',
        lineups: [],
        events: [],
        predictions: [],
        highlights: null,
        source: 'basic_template',
        weather: '🌤️ Unavailable',
        aiAnalysis: 'Basic template data - enhanced service unavailable'
      };
      
      // Cache basic result for 5 minutes
      dataCache.set(cacheKey, basicGameDetails, 300);
      
      return res.json({
        success: false,
        data: basicGameDetails,
        cached: false,
        fallback: true,
        error: 'Enhanced service unavailable'
      });
    }
    
  } catch (error) {
    console.error(`Error fetching game details for ${gameId}:`, error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve game details'
    });
  }
});

/**
 * Helper function to extract team names from gameId
 */
function extractTeamNamesFromGameId(gameId) {
  // Try to parse team names from gameId (e.g., "lorient-vs-havre" or "fc-lorient-le-havre-ac")
  const parts = gameId.split('-vs-');
  if (parts.length === 2) {
    return {
      homeTeam: parts[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      awayTeam: parts[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    };
  }
  
  // Removed hardcoded FC Lorient fallback - was causing stale data
  
  // Default fallback
  return {
    homeTeam: 'Home Team',
    awayTeam: 'Away Team'
  };
}

/**
 * AI PREDICTIONS: Get AI prediction data for specific match
 * Endpoint: /api/ai-predictions/:matchId
 * Cache: 15 minutes for AI predictions
 */
router.get('/api/ai-predictions/:matchId', async (req, res) => {
  const { matchId } = req.params;
  const cacheKey = `ai_prediction_${matchId}`;
  const bypassCache = req.query.nocache === '1' || req.query.refresh === '1';
  
  // Prevent browser and edge caching
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  if (!matchId) {
    return res.status(400).json({
      success: false,
      error: 'Match ID is required'
    });
  }
  
  try {
    // Check cache first (unless bypass requested)
    if (!bypassCache) {
      const cachedData = dataCache.get(cacheKey);
      if (cachedData) {
        return res.json({
          success: true,
          data: cachedData,
          cached: true
        });
      }
    } else {
      console.log(`[AI-Predictions] Cache bypass requested for ${matchId}`);
      // Clear existing cache for this key
      dataCache.del(cacheKey);
    }
    
    // Try to get prediction from database first
    const db = require('../db');
    const predictionResult = await db.query(`
      SELECT 
        id,
        total_confidence as confidence,
        edgemind_report as edgemind_feedback,
        secondary_insights as value_combos,
        secondary_markets as same_match_builder,
        created_at,
        matches,
        sport,
        market_type
      FROM direct1x2_prediction_final 
      WHERE id::text = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [matchId]);
    
    if (predictionResult.rows.length > 0) {
      const prediction = predictionResult.rows[0];
      const aiData = {
        id: prediction.id,
        match_id: prediction.id,
        confidence_score: prediction.confidence,
        edgemind_feedback: prediction.edgemind_feedback,
        value_combos: prediction.value_combos,
        same_match_builder: prediction.same_match_builder,
        created_at: prediction.created_at,
        matches: prediction.matches,
        sport: prediction.sport,
        market_type: prediction.market_type,
        primary_prediction: {
          market: "1X2",
          prediction: prediction.matches?.[0]?.prediction || 'unknown',
          confidence: prediction.confidence
        },
        source: 'database'
      };
      
      // Cache for 15 minutes (unless bypass requested)
      if (!bypassCache) {
        dataCache.set(cacheKey, aiData, 900);
      }
      
      return res.json({
        success: true,
        data: aiData,
        cached: false,
        bypassed: bypassCache || false
      });
    }
    
    // Fallback to enhanced match details service
    console.log(`[AI-Predictions] No database data for ${matchId}, using enhanced service`);
    
    try {
      // Extract team names from matchId
      const teamNames = extractTeamNamesFromGameId(matchId);
      const enhancedData = await getEnhancedMatchDetails(
        matchId, 
        teamNames.homeTeam, 
        teamNames.awayTeam, 
        'Ligue 1',
        new Date().toISOString()
      );
      
      if (enhancedData && enhancedData.aiPrediction) {
        const aiData = {
          id: matchId,
          match_id: matchId,
          home_team: enhancedData.homeTeam,
          away_team: enhancedData.awayTeam,
          primary_prediction: enhancedData.aiPrediction.primary || {
            market: "1X2",
            prediction: "X",
            confidence: 50
          },
          edgemind_feedback: enhancedData.aiPrediction.analysis || 'Enhanced AI analysis generated',
          value_combos: enhancedData.aiPrediction.valueCombos || {},
          same_match_builder: enhancedData.aiPrediction.sameMatchBuilder || {},
          created_at: new Date().toISOString(),
          source: enhancedData.source || 'enhanced_template'
        };
        
        // Cache enhanced result for 10 minutes
        dataCache.set(cacheKey, aiData, 600);
        
        return res.json({
          success: true,
          data: aiData,
          cached: false,
          fallback: true
        });
      }
    } catch (enhancedError) {
      console.error(`[AI-Predictions] Enhanced service failed for ${matchId}:`, enhancedError.message);
    }
    
    // Last resort: return basic template
    const basicAiData = {
      id: matchId,
      match_id: matchId,
      home_team: teamNames.homeTeam || 'Home Team',
      away_team: teamNames.awayTeam || 'Away Team',
      primary_prediction: {
        market: "1X2",
        prediction: "X",
        confidence: 50
      },
      edgemind_feedback: 'Basic AI prediction - no enhanced data available',
      value_combos: {},
      same_match_builder: {},
      created_at: new Date().toISOString(),
      source: 'basic_template'
    };
    
    // Cache basic result for 5 minutes
    dataCache.set(cacheKey, basicAiData, 300);
    
    return res.json({
      success: false,
      data: basicAiData,
      cached: false,
      fallback: true,
      error: 'No AI prediction data available'
    });
    
  } catch (error) {
    console.error(`Error fetching AI prediction for ${matchId}:`, error);
    console.error(`Stack trace:`, error.stack);
    
    // Check for specific error types
    let errorMessage = 'Failed to retrieve AI prediction';
    if (error.message.includes('database') || error.message.includes('connection')) {
      errorMessage = 'Database connection error';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Service timeout error';
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      errorMessage = 'Network connectivity error';
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage,
      details: error.message,
      matchId: matchId
    });
  }
});

/**
 * SPORTS NEWS: News feed
 * Endpoint: /news?sports=1
 * Cache: 1 hour for news
 */
router.get('/api/sports-news', async (req, res) => {
  const cacheKey = 'sports_news';
  try {
    const data = await fetchFromRapidAPI('/news', { sports: '1' }, cacheKey, 3600); // 1 hour cache
    
    // Filter news for bandwidth
    const newsItems = (data.articles || data.news || []).slice(0, 15).map(article => ({
      id: article.id,
      title: article.title,
      description: article.description?.substring(0, 200) + '...', // Truncate descriptions
      source: article.source,
      publishedAt: article.publishedAt || article.date,
      imageUrl: article.image || article.imageUrl,
      url: article.url || article.link
    }));
    
    res.json({
      success: true,
      data: {
        articles: newsItems,
        total: newsItems.length,
        lastUpdated: new Date().toISOString()
      },
      cached: dataCache.has(cacheKey)
    });
    
  } catch (error) {
    console.error('Error fetching sports news:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve sports news'
    });
  }
});

/**
 * CACHE STATUS: Admin endpoint for monitoring
 */
router.get('/api/cache-status', (req, res) => {
  const stats = dataCache.getStats();
  const governorStats = apiGovernor.currentReservoir;
  
  res.json({
    success: true,
    data: {
      cache: {
        ...stats,
        hitRate: stats.hits > 0 ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1) + '%' : '0%'
      },
      governor: {
        currentReservoir: governorStats,
        requestsThisMinute: 10 - governorStats
      },
      requests: cacheStats
    }
  });
});

/**
 * CLEAR CACHE: Admin endpoint for cache management
 */
router.post('/api/clear-cache', (req, res) => {
  const { key } = req.body;
  
  if (key) {
    // Clear specific cache key
    const deleted = dataCache.del(key);
    res.json({
      success: true,
      message: `Cleared cache key: ${key}`,
      deleted: deleted > 0
    });
  } else {
    // Clear all cache
    dataCache.flushAll();
    cacheStats = { hits: 0, misses: 0, errors: 0, totalRequests: 0 };
    res.json({
      success: true,
      message: 'All cache cleared'
    });
  }
});

module.exports = router;
