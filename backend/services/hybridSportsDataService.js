/**
 * Hybrid Sports Data Service
 * 
 * Primary Sources (Free):
 * 1. TheSportsDB - Rich football data, rate limited (25 calls/min)
 * 2. ESPN Hidden API - No API key, direct ESPN endpoints
 * 3. Free Livescore API - RapidAPI free tier
 * 
 * Fallback: Pro Football Data API (competitions data only)
 * 
 * Strategy:
 * 1. Try TheSportsDB first for detailed match data
 * 2. Try ESPN Hidden API for live scores and schedules
 * 3. Try Free Livescore API for additional coverage
 * 4. Fall back to Pro Football for competition/league info
 * 5. Merge data sources for comprehensive coverage
 */

const { syncDailyFixtures, enrichMatchContext, generateEdgeMindInsight } = require('./thesportsdbPipeline');
const { apiQueue } = require('../utils/apiQueue');
const db = require('../db');
const fetch = require('node-fetch');
const config = require('../config');

// Import additional services
const { getScoreboard: getEspnScoreboard } = require('./espnHiddenApiService');
const freeLivescoreService = require('./freeLivescoreApiService');

// Pro Football API config (fallback)
const PRO_FOOTBALL_HOST = String(process.env.SPORTSAPI_PRO_FOOTBALL_RAPIDAPI_HOST || 'sportsapi-pro-football-data.p.rapidapi.com').trim() || 'sportsapi-pro-football-data.p.rapidapi.com';
const PRO_FOOTBALL_KEY = String(process.env.SPORTSAPI_PRO_FOOTBALL_RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY || '').trim();
const ENABLE_PRO_FOOTBALL = String(process.env.ENABLE_SPORTSAPI_PRO_FOOTBALL || '').trim() === 'true';
const DISABLE_PRO_FOOTBALL = String(process.env.DISABLE_SPORTSAPI_PRO_FOOTBALL || '').trim() === 'true';
const ALLOW_PRO_FOOTBALL = ENABLE_PRO_FOOTBALL && !DISABLE_PRO_FOOTBALL;
const PRO_FOOTBALL_BASE_URL = `https://${PRO_FOOTBALL_HOST}`;
const PRO_FOOTBALL_HEADERS = {
  'Content-Type': 'application/json',
  'x-rapidapi-host': PRO_FOOTBALL_HOST,
  'x-rapidapi-key': PRO_FOOTBALL_KEY
};

/**
 * Get Featured Games - Optimal rate limit-based hybrid approach
 * Priority: ESPN (no limits) → TheSportsDB (rate limited) → Free Livescore → Pro Football
 */
async function getFeaturedGames() {
  console.log('[Hybrid] Getting featured games with optimal rate limit strategy...');
  
  // Optimal source order based on rate limits and data quality
  const sources = [
    { name: 'ESPN', fn: () => getEspnFeaturedGames(), priority: 1, rateLimit: 'unlimited' },
    { name: 'TheSportsDB', fn: () => getTheSportsDbFixtures(new Date().toISOString().split('T')[0]), priority: 2, rateLimit: '25/min' },
    { name: 'Free Livescore', fn: () => getFreeLivescoreFeaturedGames(), priority: 3, rateLimit: 'unknown' }
  ];
  if (ALLOW_PRO_FOOTBALL) {
    sources.push({ name: 'Pro Football', fn: () => getProFootballCompetitions(), priority: 4, rateLimit: '10/min' });
  }
  
  for (const source of sources) {
    try {
      console.log(`[Hybrid] Trying ${source.name} (${source.rateLimit})...`);
      const data = await source.fn();
      
      if (data && data.length > 0) {
        console.log(`[Hybrid] ${source.name} returned ${data.length} games`);
        return {
          source: source.name.toLowerCase().replace(' ', ''),
          data: data,
          fallback: sources.indexOf(source) > 0,
          totalSources: sources.length,
          rateLimit: source.rateLimit,
          priority: source.priority
        };
      }
    } catch (error) {
      console.log(`[Hybrid] ${source.name} failed:`, error.message);
      continue;
    }
  }
  
  console.log('[Hybrid] All sources failed');
  return {
    source: 'none',
    data: [],
    fallback: false,
    error: 'All data sources failed',
    totalSources: sources.length
  };
}

/**
 * Get TheSportsDB fixtures for a specific date
 */
async function getTheSportsDbFixtures(date) {
  try {
    // Use the existing syncDailyFixtures but return the data instead of storing
    const THESPORTSDB_BASE_URL = `https://www.thesportsdb.com/api/v1/json/${config.theSportsDbKey || '3'}`;
    const url = `${THESPORTSDB_BASE_URL}/eventsday.php?d=${date}`;
    
    const response = await apiQueue.add(async () => {
      const res = await fetch(url);
      const rawText = await res.text();
      
      if (!res.ok) {
        console.error(`[Hybrid] TheSportsDB API error: ${res.status}`, rawText);
        return null;
      }
      
      if (!rawText || rawText.trim() === '') {
        console.error(`[Hybrid] TheSportsDB returned empty response`);
        return null;
      }
      
      try {
        return JSON.parse(rawText);
      } catch (err) {
        console.error(`[Hybrid] TheSportsDB returned invalid JSON:`, rawText);
        return null;
      }
    });
    
    if (!response) {
      return null;
    }
    
    const events = response.events || response.event || [];
    
    // Transform to match expected format
    return events.slice(0, 10).map(event => ({
      gameId: event.idEvent,
      homeTeamName: event.strHomeTeam || 'TBD',
      awayTeamName: event.strAwayTeam || 'TBD',
      tournamentName: event.strLeague || 'Unknown',
      tournamentColor: '#121417',
      startTime: event.dateEvent ? new Date(`${event.dateEvent} ${event.strTime || '00:00'}Z`).toISOString() : new Date().toISOString(),
      status: event.strStatus || 'NS',
      importance: 1,
      isLive: event.strStatus === 'Match In Progress',
      homeScore: event.intHomeScore,
      awayScore: event.intAwayScore,
      source: 'thesportsdb'
    }));
    
  } catch (error) {
    console.error('[Hybrid] TheSportsDB fixtures error:', error.message);
    return null;
  }
}

/**
 * Get ESPN featured games
 */
async function getEspnFeaturedGames() {
  try {
    // Try football/soccer first
    const data = await getEspnScoreboard('football', 'soccer');
    if (data && data.events && data.events.length > 0) {
      return data.events.slice(0, 10).map(event => ({
        gameId: event.id || `espn-${event.shortName}`,
        homeTeamName: event.competitions?.[0]?.competitors?.[0]?.team?.displayName || 'TBD',
        awayTeamName: event.competitions?.[0]?.competitors?.[1]?.team?.displayName || 'TBD',
        tournamentName: event.league?.name || event.season?.displayName || 'ESPN',
        tournamentColor: '#121417',
        startTime: event.date ? new Date(event.date).toISOString() : new Date().toISOString(),
        status: event.status?.type?.state || 'NS',
        importance: 1,
        isLive: event.status?.type?.state === 'in',
        homeScore: event.competitions?.[0]?.competitors?.[0]?.score,
        awayScore: event.competitions?.[0]?.competitors?.[1]?.score,
        source: 'espn'
      }));
    }
    return null;
  } catch (error) {
    console.error('[Hybrid] ESPN featured games error:', error.message);
    return null;
  }
}

/**
 * Get Free Livescore featured games
 */
async function getFreeLivescoreFeaturedGames() {
  try {
    // This would need to be implemented based on the freeLivescoreService
    // For now, return null as placeholder
    console.log('[Hybrid] Free Livescore not yet implemented');
    return null;
  } catch (error) {
    console.error('[Hybrid] Free Livescore featured games error:', error.message);
    return null;
  }
}

/**
 * Get Pro Football competitions data (fallback)
 */
async function getProFootballCompetitions() {
  try {
    const response = await fetch(`${PRO_FOOTBALL_BASE_URL}/competitions?sport=1`, {
      headers: PRO_FOOTBALL_HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`Pro Football API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Transform competitions to match expected format
    const footballCompetitions = (data.competitions || [])
      .filter(comp => comp.sportId === 1 && comp.isActive && comp.totalGames > 0)
      .slice(0, 5)
      .map(comp => ({
        gameId: `comp-${comp.id}`,
        homeTeamName: 'TBD',
        awayTeamName: 'TBD',
        tournamentName: comp.name,
        tournamentColor: comp.color || '#121417',
        startTime: new Date().toISOString(),
        status: comp.liveGames > 0 ? 'LIVE' : 'NS',
        importance: 1,
        isLive: comp.liveGames > 0,
        totalGames: comp.totalGames,
        liveGames: comp.liveGames,
        source: 'profootball'
      }));
    
    return footballCompetitions;
    
  } catch (error) {
    console.error('[Hybrid] Pro Football competitions error:', error.message);
    throw error;
  }
}

/**
 * Get Live Scores - Hybrid approach
 */
async function getLiveScores() {
  console.log('[Hybrid] Getting live scores...');
  
  try {
    // Primary: Try TheSportsDB for live events
    const theSportsDbData = await getTheSportsDbLiveEvents();

    if (theSportsDbData && theSportsDbData.length > 0) {
      console.log(`[Hybrid] TheSportsDB returned ${theSportsDbData.length} live events`);
      return {
        source: 'thesportsdb',
        data: theSportsDbData,
        fallback: false
      };
    }

    // Fallback: Use Pro Football competitions with live games if allowed
    if (ALLOW_PRO_FOOTBALL) {
      console.log('[Hybrid] TheSportsDB live failed (no data returned), falling back to Pro Football API');
      const proFootballData = await getProFootballLiveCompetitions();
      return {
        source: 'profootball',
        data: proFootballData,
        fallback: true
      };
    }
    return {
      source: 'none',
      data: [],
      fallback: false
    };

  } catch (error) {
    console.error('[Hybrid] Live scores failed:', error.message, error.response?.data || error.stack);
    return {
      source: 'none',
      data: [],
      fallback: false,
      error: error.message
    };
  }
}

/**
 * Get TheSportsDB live events
 */
async function getTheSportsDbLiveEvents() {
  try {
    const THESPORTSDB_BASE_URL = `https://www.thesportsdb.com/api/v1/json/${config.theSportsDbKey || '3'}`;
    
    // Try to get live events for today
    const today = new Date().toISOString().split('T')[0];
    const url = `${THESPORTSDB_BASE_URL}/eventsday.php?d=${today}`;
    
    const response = await apiQueue.add(async () => {
      const res = await fetch(url);
      const rawText = await res.text();
      
      if (!res.ok) {
        console.error(`[Hybrid] TheSportsDB live API error: ${res.status}`, rawText);
        return null;
      }
      
      try {
        return JSON.parse(rawText);
      } catch (err) {
        console.error(`[Hybrid] TheSportsDB live invalid JSON:`, rawText);
        return null;
      }
    });
    
    if (!response) {
      return null;
    }
    
    const events = response.events || response.event || [];
    
    // Filter for live events only
    const liveEvents = events.filter(event => 
      event.strStatus === 'Match In Progress' || 
      event.strStatus === 'Live' ||
      event.strStatus === '1H' || 
      event.strStatus === '2H'
    );
    
    return liveEvents.map(event => ({
      gameId: event.idEvent,
      homeTeamName: event.strHomeTeam || 'TBD',
      awayTeamName: event.strAwayTeam || 'TBD',
      tournamentName: event.strLeague || 'Unknown',
      tournamentColor: '#121417',
      startTime: event.dateEvent ? new Date(`${event.dateEvent} ${event.strTime || '00:00'}Z`).toISOString() : new Date().toISOString(),
      status: event.strStatus || 'NS',
      importance: 1,
      isLive: true,
      homeScore: event.intHomeScore,
      awayScore: event.intAwayScore,
      minute: event.strProgress,
      source: 'thesportsdb'
    }));
    
  } catch (error) {
    console.error('[Hybrid] TheSportsDB live events error:', error.message);
    return null;
  }
}

/**
 * Get Pro Football live competitions (fallback)
 */
async function getProFootballLiveCompetitions() {
  try {
    const response = await fetch(`${PRO_FOOTBALL_BASE_URL}/competitions?sport=1`, {
      headers: PRO_FOOTBALL_HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`Pro Football API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Filter for competitions with live games
    const liveCompetitions = (data.competitions || [])
      .filter(comp => comp.sportId === 1 && comp.liveGames > 0)
      .slice(0, 10);
    
    const totalLiveGames = liveCompetitions.reduce((sum, comp) => sum + comp.liveGames, 0);
    
    return {
      allGames: liveCompetitions,
      featured: liveCompetitions.slice(0, 5),
      totalLiveGames: totalLiveGames,
      timestamp: new Date().toISOString(),
      source: 'profootball'
    };
    
  } catch (error) {
    console.error('[Hybrid] Pro Football live competitions error:', error.message);
    throw error;
  }
}

/**
 * Health check for both data sources
 */
async function healthCheck() {
  const results = {
    thesportsdb: { status: 'unknown', error: null },
    profootball: { status: 'unknown', error: null }
  };
  
  // Test TheSportsDB
  try {
    const THESPORTSDB_BASE_URL = `https://www.thesportsdb.com/api/v1/json/${config.theSportsDbKey || '3'}`;
    const response = await apiQueue.add(async () => {
      const res = await fetch(`${THESPORTSDB_BASE_URL}/search_all_leagues.php?s=Soccer`);
      return res.ok;
    });
    
    results.thesportsdb.status = response ? 'healthy' : 'unhealthy';
  } catch (error) {
    results.thesportsdb.status = 'error';
    results.thesportsdb.error = error.message;
  }
  
  // Test Pro Football
  try {
    const response = await fetch(`${PRO_FOOTBALL_BASE_URL}/health`, {
      headers: PRO_FOOTBALL_HEADERS
    });
    
    results.profootball.status = response.ok ? 'healthy' : 'unhealthy';
  } catch (error) {
    results.profootball.status = 'error';
    results.profootball.error = error.message;
  }
  
  return results;
}

module.exports = {
  getFeaturedGames,
  getLiveScores,
  healthCheck,
  // Expose TheSportsDB functions for advanced usage
  syncDailyFixtures,
  enrichMatchContext,
  generateEdgeMindInsight
};
