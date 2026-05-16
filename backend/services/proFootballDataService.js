/**
 * SKCS AI Sports Edge - Pro Football Data API Service
 * High-efficiency proxy with rate limiting and caching
 * Directive: Do not break the system or update existing code.
 */

const axios = require('axios');
const Bottleneck = require('bottleneck');
const NodeCache = require('node-cache');

// 1. Initialize Cache: Metadata lasts 24h, Trends 1h, Games 1m
const localCache = new NodeCache({ stdTTL: 600 });

// 2. Strict Rate Limiter: 10 RPM = 1 request every 6.5s to be safe
const limiter = new Bottleneck({
  minTime: 6500, 
  maxConcurrent: 1
});

const api = axios.create({
  baseURL: 'https://sportsapi-pro-football-data.p.rapidapi.com',
  headers: {
    'x-rapidapi-host': 'sportsapi-pro-football-data.p.rapidapi.com',
    'x-rapidapi-key': '61fb6ae19emshbc93fdce17fd87fp1ee5fajsnac7912504616'
  }
});

// Throttled Request Handler with Integrated Caching
async function callEdgeAPI(endpoint, params = {}, cacheKey, ttl = 600) {
  // Check cache first to save bandwidth and RPM
  const cachedData = localCache.get(cacheKey);
  if (cachedData) {
    console.log(`[ProFootballAPI] Cache hit for: ${cacheKey}`);
    return cachedData;
  }

  // If not in cache, wait in the 10 RPM queue
  return limiter.schedule(async () => {
    try {
      console.log(`[ProFootballAPI] API call: ${endpoint}`);
      const response = await api.get(endpoint, { params });
      localCache.set(cacheKey, response.data, ttl);
      return response.data;
    } catch (error) {
      console.error(`[ProFootballAPI] Error [${endpoint}]:`, error.message);
      return null;
    }
  });
}

// Specific API endpoints for API-Football v3
async function getFixtures(leagueId = 39, season = 2025) {
  const cacheKey = `fixtures_${leagueId}_${season}`;
  return await callEdgeAPI('/fixtures', { league: leagueId, season }, cacheKey, 300);
}

async function getLiveFixtures() {
  const cacheKey = 'live_fixtures';
  return await callEdgeAPI('/fixtures/live', {}, cacheKey, 60); // 1 minute cache for live data
}

async function getFixtureDetails(fixtureId) {
  const cacheKey = `fixture_${fixtureId}`;
  return await callEdgeAPI('/fixtures', { id: fixtureId }, cacheKey, 1800);
}

async function getStandings(leagueId = 39, season = 2025) {
  const cacheKey = `standings_${leagueId}_${season}`;
  return await callEdgeAPI('/standings', { league: leagueId, season }, cacheKey, 3600);
}

async function getTeamStatistics(teamId, leagueId = 39, season = 2025) {
  const cacheKey = `team_stats_${teamId}_${leagueId}_${season}`;
  return await callEdgeAPI('/statistics', { league: leagueId, season, team: teamId }, cacheKey, 1800);
}

async function getHeadToHead(homeTeamId, awayTeamId) {
  const cacheKey = `h2h_${homeTeamId}_${awayTeamId}`;
  return await callEdgeAPI('/fixtures/headtohead', { h2h: `${homeTeamId}-${awayTeamId}` }, cacheKey, 3600);
}

async function getTopScorers(leagueId = 39, season = 2025) {
  const cacheKey = `top_scorers_${leagueId}_${season}`;
  return await callEdgeAPI('/players/topscorers', { league: leagueId, season }, cacheKey, 1800);
}

// ===== OPTIMIZED ENDPOINT IMPLEMENTATIONS =====

// A. The Metadata Dictionary (The "Map")
// Strategy: Call this once per day. It maps IDs like 11 to LaLiga.
async function getMetadata() {
  const cacheKey = 'metadata_map';
  // Try the correct endpoint for ProFootballAPI
  try {
    return await callEdgeAPI('/leagues', {}, cacheKey, 86400); // Cache 24h
  } catch (err) {
    console.warn('[ProFootballAPI] /leagues endpoint not supported by this provider, skipping metadata fetch');
    return null;
  }
}

// B. The AI Betting Trends (The "Edge")
// Strategy: This is your highest-value data. We fetch this every hour.
async function getAITrends(sportId = 1) {
  const cacheKey = `trends_${sportId}`;
  const data = await callEdgeAPI('/trends', { sports: sportId }, cacheKey, 3600);
  
  // LOGIC: Filter for "isTop: true" or "percentage > 0.85"
  if (data && data.trends) {
    return data.trends.filter(trend => 
      trend.isTop === true || 
      (trend.percentage && parseFloat(trend.percentage) > 0.85)
    );
  }
  
  return [];
}

// C. The Daily "Hot Games" Slate (The "Hero")
// Strategy: Uses the suggestedGames logic to populate the homepage.
async function getHomepageSlate() {
  const cacheKey = 'daily_slate';
  const data = await callEdgeAPI('/web/games', { games: 1 }, cacheKey, 300); // Cache 5m
  
  return {
    featured: data?.suggestedGames || [], // Use for Hero Carousel
    allGames: data?.games || [] // Use for Main Feed
  };
}

// D. Single Match Deep-Dive (The "Analytics")
// Strategy: Fetch only when a user requests a specific game.
async function getMatchDeepDive(gameId) {
  const cacheKey = `game_detail_${gameId}`;
  const data = await callEdgeAPI('/web/games/details', { gameId }, cacheKey, 1800);
  
  if (!data || !data.game) {
    return null;
  }
  
  return {
    lineups: data.game.homeCompetitor?.lineups || [],
    events: data.game.events || [], // For the timeline
    predictions: data.game.promotedPredictions || [], // Public vs AI comparison
    highlights: data.game.video || null, // The YouTube embed logic
    homeCompetitor: data.game.homeCompetitor,
    awayCompetitor: data.game.awayCompetitor,
    gameInfo: {
      id: data.game.id,
      status: data.game.status,
      startTime: data.game.startTime,
      venue: data.game.venue
    }
  };
}

// E. Global News Feed (The "Content")
// Strategy: Standardizes the Key sports=1 for football headlines.
async function getSportsNews(sportId = 1) {
  const cacheKey = `news_${sportId}`;
  return await callEdgeAPI('/news', { sports: sportId }, cacheKey, 3600);
}

// Additional optimized functions for edge cases

// F. League Information Cache
async function getLeagueInfo(leagueId) {
  const cacheKey = `league_info_${leagueId}`;
  try {
    return await callEdgeAPI('/leagues', { id: leagueId }, cacheKey, 86400); // Cache 24h
  } catch (err) {
    console.warn('[ProFootballAPI] /leagues endpoint not supported by this provider, skipping league info fetch');
    return null;
  }
}

// G. Team Information Cache
async function getTeamInfo(teamId) {
  const cacheKey = `team_info_${teamId}`;
  return await callEdgeAPI('/teams', { id: teamId }, cacheKey, 86400); // Cache 24h
}

// H. Player Statistics Cache
async function getPlayerStats(playerId, leagueId = 39, season = 2025) {
  const cacheKey = `player_stats_${playerId}_${leagueId}_${season}`;
  return await callEdgeAPI('/players', { id: playerId, league: leagueId, season }, cacheKey, 3600);
}

// Utility functions for cache management
function clearCache() {
  localCache.flushAll();
  console.log('[ProFootballAPI] Cache cleared');
}

function getCacheStats() {
  const stats = localCache.getStats();
  console.log('[ProFootballAPI] Cache stats:', stats);
  return stats;
}

// Health check function
async function healthCheck() {
  try {
    const result = await callEdgeAPI('/status', {}, 'health_check', 60);
    return result ? { status: 'healthy', cached: false } : { status: 'unhealthy' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

module.exports = {
  // Core API function
  callEdgeAPI,
  
  // Standard Football-specific endpoints
  getFixtures,
  getLiveFixtures,
  getFixtureDetails,
  getStandings,
  getTeamStatistics,
  getHeadToHead,
  getTopScorers,
  
  // ===== OPTIMIZED ENDPOINT IMPLEMENTATIONS =====
  
  // A. The Metadata Dictionary (The "Map")
  getMetadata,
  
  // B. The AI Betting Trends (The "Edge")
  getAITrends,
  
  // C. The Daily "Hot Games" Slate (The "Hero")
  getHomepageSlate,
  
  // D. Single Match Deep-Dive (The "Analytics")
  getMatchDeepDive,
  
  // E. Global News Feed (The "Content")
  getSportsNews,
  
  // Additional optimized functions
  getLeagueInfo,
  getTeamInfo,
  getPlayerStats,
  
  // Utility functions
  clearCache,
  getCacheStats,
  healthCheck
};
