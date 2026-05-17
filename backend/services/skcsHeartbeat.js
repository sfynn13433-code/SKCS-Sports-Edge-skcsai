/**
 * SKCS AI Sports Edge - Heartbeat Service
 * Manages background syncing to respect 10 RPM and bandwidth constraints
 * Directive: Do not break the system or update existing code.
 */

const proFootballService = require('./proFootballDataService');

// Heartbeat state management
let heartbeatState = {
  isRunning: false,
  liveScoresInterval: null,
  trendsInterval: null,
  lastSync: {
    liveScores: null,
    trends: null,
    news: null,
    metadata: null
  },
  stats: {
    totalApiCalls: 0,
    cacheHits: 0,
    errors: 0,
    bandwidthSaved: 0
  }
};

// Compression and bandwidth management
const COMPRESSION_ENABLED = true;
const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB max per response

/**
 * Selective data filtering to reduce bandwidth
 * Removes heavy arrays like full competitors/members for homepage
 */
function filterForHomepage(data) {
  if (!data) return data;
  
  // Create a lightweight version for homepage consumption
  if (data.games && Array.isArray(data.games)) {
    data.games = data.games.map(game => ({
      id: game.id,
      homeTeam: game.homeTeam?.name || game.homeTeam,
      awayTeam: game.awayTeam?.name || game.awayTeam,
      score: game.score,
      status: game.status,
      startTime: game.startTime,
      // Exclude heavy arrays: competitors, members, full statistics
      isLive: game.status === 'LIVE',
      importance: game.importance || 1
    }));
  }
  
  if (data.featured && Array.isArray(data.featured)) {
    data.featured = data.featured.map(game => ({
      id: game.id,
      homeTeam: game.homeTeam?.name || game.homeTeam,
      awayTeam: game.awayTeam?.name || game.awayTeam,
      score: game.score,
      status: game.status,
      startTime: game.startTime,
      importance: game.importance || 5 // Higher importance for featured
    }));
  }
  
  return data;
}

/**
 * Bandwidth-aware API call wrapper
 */
async function bandwidthAwareCall(apiFunction, ...args) {
  const startTime = Date.now();
  
  try {
    const result = await apiFunction(...args);
    
    // Calculate payload size
    const payloadSize = JSON.stringify(result).length;
    heartbeatState.stats.totalApiCalls++;
    
    // Log bandwidth usage
    if (payloadSize > MAX_PAYLOAD_SIZE) {
      console.warn(`[Heartbeat] Large payload detected: ${(payloadSize / 1024 / 1024).toFixed(2)}MB`);
    }
    
    console.log(`[Heartbeat] API call completed in ${Date.now() - startTime}ms, payload: ${(payloadSize / 1024).toFixed(1)}KB`);
    
    return result;
  } catch (error) {
    heartbeatState.stats.errors++;
    console.error(`[Heartbeat] API call failed:`, error.message);
    return null;
  }
}

/**
 * Live Scores Sync (Every 30 minutes - optimized for Basic plan)
 * Updates the homepage slate with current game data
 * Hybrid approach: ESPN → TheSportsDB → Free Livescore → Pro Football
 * Note: Reduced frequency to stay within rate limits
 */
async function syncLiveScores() {
  console.log('[Heartbeat] Syncing live scores using hybrid approach (30min interval)...');
  
  try {
    // Import hybrid service to avoid circular dependency
    const { getLiveScores } = require('./hybridSportsDataService');
    
    // Use hybrid sports data service with optimal rate limit strategy
    const hybridResult = await getLiveScores();
    
    if (hybridResult && hybridResult.data) {
      const syncData = {
        allGames: hybridResult.data.allGames || hybridResult.data,
        featured: hybridResult.data.featured || hybridResult.data.slice?.(0, 5) || [],
        totalLiveGames: hybridResult.data.totalLiveGames || (hybridResult.data.length || 0),
        timestamp: new Date().toISOString(),
        source: hybridResult.source,
        fallback: hybridResult.fallback,
        apiNote: `Hybrid approach - Using ${hybridResult.source} (${hybridResult.fallback ? 'fallback' : 'primary'})`
      };
      
      console.log(`[Heartbeat] Live scores updated: ${syncData.totalLiveGames} live games from ${syncData.source}`);
      heartbeatState.lastSync.liveScores = new Date().toISOString();
      
      return syncData;
    } else {
      console.warn('[Heartbeat] Hybrid service returned no data');
      heartbeatState.stats.errors++;
    }
  } catch (error) {
    console.error('[Heartbeat] Hybrid live scores sync failed:', error.message);
    heartbeatState.stats.errors++;
    
    // Fallback to Pro Football competitions if hybrid fails
    try {
      console.log('[Heartbeat] Falling back to Pro Football competitions...');
      const host = String(process.env.SPORTSAPI_PRO_FOOTBALL_RAPIDAPI_HOST || 'sportsapi-pro-football-data.p.rapidapi.com').trim() || 'sportsapi-pro-football-data.p.rapidapi.com';
      const key = String(process.env.SPORTSAPI_PRO_FOOTBALL_RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY || '').trim();
      const response = await fetch(`https://${host}/competitions?sport=1`, {
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': host,
          'x-rapidapi-key': key
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const liveCompetitions = (data.competitions || [])
          .filter(comp => comp.sportId === 1 && comp.liveGames > 0)
          .slice(0, 10);
        
        const fallbackData = {
          allGames: liveCompetitions,
          featured: liveCompetitions.slice(0, 5),
          totalLiveGames: liveCompetitions.reduce((sum, comp) => sum + comp.liveGames, 0),
          timestamp: new Date().toISOString(),
          source: 'profootball',
          fallback: true,
          apiNote: 'Fallback to Pro Football competitions'
        };
        
        console.log(`[Heartbeat] Fallback successful: ${fallbackData.totalLiveGames} live games`);
        heartbeatState.lastSync.liveScores = new Date().toISOString();
        
        return fallbackData;
      }
    } catch (fallbackError) {
      console.error('[Heartbeat] Even fallback failed:', fallbackError.message);
    }
  }
  
  return null;
}

/**
 * Trends and News Sync (Every 60 minutes)
 * Updates high-value AI betting trends and news
 */
async function syncTrendsAndNews() {
  console.log('[Heartbeat] Syncing trends and news...');
  
  try {
    // Sync AI Trends
    const trendsData = await bandwidthAwareCall(proFootballService.getAITrends, 1);
    if (trendsData) {
      console.log(`[Heartbeat] AI trends updated: ${trendsData.length} trends`);
      heartbeatState.lastSync.trends = new Date().toISOString();
    }
    
    // Sync Sports News
    const newsData = await bandwidthAwareCall(proFootballService.getSportsNews, 1);
    if (newsData) {
      console.log(`[Heartbeat] Sports news updated`);
      heartbeatState.lastSync.news = new Date().toISOString();
    }
    
    return { trends: trendsData, news: newsData };
  } catch (error) {
    console.error('[Heartbeat] Trends/News sync failed:', error.message);
    heartbeatState.stats.errors++;
  }
  
  return null;
}

/**
 * Metadata Sync (Once per day at startup)
 * Caches league/team mappings to avoid repeated API calls
 */
async function syncMetadata() {
  console.log('[Heartbeat] Syncing metadata...');
  
  try {
    const metadata = await bandwidthAwareCall(proFootballService.getMetadata);
    if (metadata) {
      console.log('[Heartbeat] Metadata cached for 24 hours');
      heartbeatState.lastSync.metadata = new Date().toISOString();
      return metadata;
    }
  } catch (error) {
    console.error('[Heartbeat] Metadata sync failed:', error.message);
    heartbeatState.stats.errors++;
  }
  
  return null;
}

/**
 * Start the SKCS Heartbeat service
 */
async function startSKCSHeartbeat() {
  if (heartbeatState.isRunning) {
    console.log('[Heartbeat] Already running');
    return;
  }
  
  console.log('🚀 SKCS AI Sports Edge Heartbeat Started...');
  console.log('📊 Bandwidth Management: Enabled');
  console.log('⏱️  Live Scores: Every 60 seconds');
  console.log('📈 Trends/News: Every 60 minutes');
  
  heartbeatState.isRunning = true;
  
  // Initial sync
  await syncMetadata(); // One-time metadata sync
  await syncLiveScores(); // Initial live scores
  await syncTrendsAndNews(); // Initial trends/news
  
  // Set up intervals
  
  // Every 30 minutes: Update Live Scores (Basic Plan optimization)
  heartbeatState.liveScoresInterval = setInterval(async () => {
    await syncLiveScores();
  }, 1800000); // 30 minutes (1,800,000 ms)
  
  // Every hour: Update Trends and News
  heartbeatState.trendsInterval = setInterval(async () => {
    await syncTrendsAndNews();
  }, 3600000); // 60 minutes
  
  console.log('✅ Heartbeat intervals established');
  
  // Log status every 5 minutes
  setInterval(() => {
    logHeartbeatStatus();
  }, 300000); // 5 minutes
}

/**
 * Stop the SKCS Heartbeat service
 */
function stopSKCSHeartbeat() {
  console.log('🛑 Stopping SKCS Heartbeat...');
  
  if (heartbeatState.liveScoresInterval) {
    clearInterval(heartbeatState.liveScoresInterval);
    heartbeatState.liveScoresInterval = null;
  }
  
  if (heartbeatState.trendsInterval) {
    clearInterval(heartbeatState.trendsInterval);
    heartbeatState.trendsInterval = null;
  }
  
  heartbeatState.isRunning = false;
  console.log('✅ Heartbeat stopped');
}

/**
 * Get heartbeat status and statistics
 */
function getHeartbeatStatus() {
  return {
    isRunning: heartbeatState.isRunning,
    lastSync: heartbeatState.lastSync,
    stats: heartbeatState.stats,
    uptime: heartbeatState.isRunning ? Date.now() - (heartbeatState.startTime || Date.now()) : 0
  };
}

/**
 * Log heartbeat status for monitoring
 */
function logHeartbeatStatus() {
  const status = getHeartbeatStatus();
  const uptimeMinutes = Math.floor(status.uptime / 60000);
  
  console.log(`[Heartbeat] Status: ${status.isRunning ? '🟢 Running' : '🔴 Stopped'} | Uptime: ${uptimeMinutes}m | API Calls: ${status.stats.totalApiCalls} | Errors: ${status.stats.errors}`);
  
  // Log last sync times
  if (status.lastSync.liveScores) {
    const minutesSince = Math.floor((Date.now() - new Date(status.lastSync.liveScores)) / 60000);
    console.log(`[Heartbeat] Last live sync: ${minutesSince}m ago`);
  }
}

/**
 * Manual trigger functions for testing/admin
 */
async function triggerLiveSync() {
  console.log('[Heartbeat] Manual live sync triggered');
  return await syncLiveScores();
}

async function triggerTrendsSync() {
  console.log('[Heartbeat] Manual trends sync triggered');
  return await syncTrendsAndNews();
}

async function triggerMetadataSync() {
  console.log('[Heartbeat] Manual metadata sync triggered');
  return await syncMetadata();
}

// Initialize heartbeat state
heartbeatState.startTime = Date.now();

module.exports = {
  startSKCSHeartbeat,
  stopSKCSHeartbeat,
  getHeartbeatStatus,
  triggerLiveSync,
  triggerTrendsSync,
  triggerMetadataSync,
  filterForHomepage,
  // Expose for testing
  _internal: {
    syncLiveScores,
    syncTrendsAndNews,
    syncMetadata,
    bandwidthAwareCall
  }
};
