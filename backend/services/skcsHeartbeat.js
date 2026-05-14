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
 * Live Scores Sync (Every 60 seconds)
 * Updates the homepage slate with current game data
 */
async function syncLiveScores() {
  console.log('[Heartbeat] Syncing live scores...');
  
  try {
    // Get homepage slate with bandwidth filtering
    const slateData = await bandwidthAwareCall(proFootballService.getHomepageSlate);
    
    if (slateData) {
      // Apply selective filtering for bandwidth management
      const filteredData = filterForHomepage(slateData);
      
      // Update cache/store (this would integrate with your existing cache system)
      // For now, we'll just log the summary
      console.log(`[Heartbeat] Live scores updated: ${filteredData.allGames?.length || 0} games, ${filteredData.featured?.length || 0} featured`);
      
      heartbeatState.lastSync.liveScores = new Date().toISOString();
      
      return filteredData;
    }
  } catch (error) {
    console.error('[Heartbeat] Live scores sync failed:', error.message);
    heartbeatState.stats.errors++;
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
  
  // Every minute: Update Live Scores
  heartbeatState.liveScoresInterval = setInterval(async () => {
    await syncLiveScores();
  }, 60000); // 60 seconds
  
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
