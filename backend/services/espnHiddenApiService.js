/**
 * ESPN Hidden API Service
 * 
 * Replaces broken RapidAPI ESPN integration with direct ESPN hidden API calls
 * Uses site.api.espn.com endpoints that work without API keys
 */

const fetch = require('node-fetch');

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';

/**
 * Get scoreboard for a specific sport/league
 * @param {string} sport - Sport (football, basketball, soccer)
 * @param {string} league - League (nfl, nba, eng.1, etc.)
 * @param {string} date - Optional date filter (YYYYMMDD format)
 * @returns {Promise<Object>} Scoreboard data
 */
async function getScoreboard(sport, league, date = null) {
  let url = `${ESPN_BASE_URL}/${sport}/${league}/scoreboard`;
  if (date) {
    url += `?dates=${date}`;
  }

  console.log(`[espnHiddenApi] Fetching ESPN URL: ${url} (sport=${sport}, league=${league}, date=${date})`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[espnHiddenApi] Error fetching ${sport}/${league} scoreboard:`, error.message);
    return null;
  }
}

/**
 * Get news for a specific sport/league
 * @param {string} sport - Sport (football, basketball, etc.)
 * @param {string} league - League (nfl, nba, etc.)
 * @param {string} athleteId - Optional athlete ID filter
 * @returns {Promise<Object>} News data
 */
async function getNews(sport, league, athleteId = null) {
  let url = `${ESPN_BASE_URL}/${sport}/${league}/news`;
  if (athleteId) {
    url += `?athlete=${athleteId}`;
  }
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[espnHiddenApi] Error fetching ${sport}/${league} news:`, error.message);
    return null;
  }
}

/**
 * Get teams for a specific league
 * @param {string} sport - Sport (football, basketball, etc.)
 * @param {string} league - League (nfl, nba, etc.)
 * @returns {Promise<Object>} Teams data
 */
async function getTeams(sport, league) {
  const url = `${ESPN_BASE_URL}/${sport}/${league}/teams`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[espnHiddenApi] Error fetching ${sport}/${league} teams:`, error.message);
    return null;
  }
}

/**
 * Get current live games for monitoring
 * @returns {Promise<Array>} Array of live games with IDs
 */
async function getLiveGames() {
  const sports = [
    { sport: 'football', league: 'nfl' },
    { sport: 'basketball', league: 'nba' },
    { sport: 'soccer', league: 'eng.1' }
  ];
  
  const liveGames = [];
  
  for (const { sport, league } of sports) {
    try {
      const data = await getScoreboard(sport, league);
      
      if (data && data.events) {
        const inProgressGames = data.events.filter(event => 
          event.status && 
          event.status.type && 
          event.status.type.state === 'in'
        );
        
        inProgressGames.forEach(game => {
          liveGames.push({
            gameId: game.id,
            sport: sport,
            league: league,
            name: game.name || game.shortName,
            status: game.status.type.description,
            competitors: game.competitions?.[0]?.competitors || []
          });
        });
      }
    } catch (error) {
      console.warn(`[espnHiddenApi] Error checking live games for ${sport}/${league}:`, error.message);
    }
  }
  
  return liveGames;
}

/**
 * Get game details for live odds monitoring
 * @param {string} gameId - ESPN game ID
 * @param {string} sport - Sport (football, basketball, etc.)
 * @returns {Promise<Object>} Game details
 */
async function getGameDetails(gameId, sport) {
  try {
    // First try to get from scoreboard (more reliable)
    const leagues = {
      'football': 'nfl',
      'basketball': 'nba',
      'soccer': 'eng.1'
    };
    
    const league = leagues[sport];
    if (!league) {
      throw new Error(`Unsupported sport: ${sport}`);
    }
    
    const data = await getScoreboard(sport, league);
    if (!data || !data.events) {
      throw new Error(`No events found for ${sport}/${league}`);
    }
    
    const game = data.events.find(event => event.id === gameId);
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }
    
    return game;
  } catch (error) {
    console.error(`[espnHiddenApi] Error fetching game details for ${gameId}:`, error.message);
    return null;
  }
}

/**
 * Simulate odds monitoring for a game
 * @param {string} gameId - ESPN game ID
 * @param {string} sport - Sport
 * @returns {Promise<Object>} Monitoring data
 */
async function monitorGameOdds(gameId, sport) {
  const game = await getGameDetails(gameId, sport);
  
  if (!game) {
    return null;
  }
  
  const isLive = game.status && game.status.type && game.status.type.state === 'in';
  
  const monitoringData = {
    gameId: gameId,
    sport: sport,
    name: game.name || game.shortName,
    isLive: isLive,
    status: game.status.type.description,
    timestamp: new Date().toISOString(),
    competitors: [],
    odds: null,
    winProbability: null
  };
  
  // Extract competitor data
  if (game.competitions && game.competitions[0] && game.competitions[0].competitors) {
    const competitors = game.competitions[0].competitors;
    
    monitoringData.competitors = competitors.map(comp => ({
      team: comp.team.displayName,
      score: comp.score || 0,
      homeAway: comp.homeAway,
      winProbability: comp.winProbability || null
    }));
    
    // Calculate simple win probability based on score (for live games)
    if (isLive && competitors.length === 2) {
      const [away, home] = competitors;
      const homeScore = home.score || 0;
      const awayScore = away.score || 0;
      
      if (homeScore !== awayScore) {
        // Simple probability based on current score difference
        const scoreDiff = Math.abs(homeScore - awayScore);
        const baseProb = 0.5 + (scoreDiff * 0.1); // 10% per point difference
        monitoringData.winProbability = homeScore > awayScore ? 
          Math.min(baseProb, 0.9) : Math.max(1 - baseProb, 0.1);
      } else {
        monitoringData.winProbability = 0.5; // Tie game
      }
    }
  }
  
  return monitoringData;
}

module.exports = {
  getScoreboard,
  getNews,
  getTeams,
  getLiveGames,
  getGameDetails,
  monitorGameOdds
};
