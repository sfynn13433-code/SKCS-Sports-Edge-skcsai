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
const API_KEY = process.env.RAPIDAPI_KEY || '61fb6ae19emshbc93fdce17fd87fp1ee5fajsnac7912504616';
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
    const data = await fetchFromRapidAPI('/fixtures/live', {}, cacheKey, 60); // 1 min cache
    
    // Filter live games for bandwidth
    const liveGames = (data.response || data.games || []).slice(0, 20).map(game => ({
      id: game.fixture?.id || game.id,
      homeTeam: game.teams?.home?.name || game.homeTeam,
      awayTeam: game.teams?.away?.name || game.awayTeam,
      homeScore: game.goals?.home || game.score?.home,
      awayScore: game.goals?.away || game.score?.away,
      status: game.fixture?.status?.short || game.status,
      minute: game.fixture?.status?.elapsed || game.minute,
      competition: game.league?.name || game.competition
    }));
    
    res.json({
      success: true,
      data: {
        games: liveGames,
        total: liveGames.length,
        lastUpdated: new Date().toISOString()
      },
      cached: dataCache.has(cacheKey)
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
 * GAME DETAILS: Match deep-dive analytics
 * Endpoint: /web/games/details?gameId={id}
 * Cache: 30 minutes for game details
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
      highlights: data.game?.video || null
    };
    
    res.json({
      success: true,
      data: gameDetails,
      cached: dataCache.has(cacheKey)
    });
    
  } catch (error) {
    console.error(`Error fetching game details for ${gameId}:`, error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve game details'
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
