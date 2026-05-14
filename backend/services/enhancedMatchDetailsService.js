/**
 * Enhanced Match Details Service
 * 
 * Provides rich match details when TheSportsDB doesn't have the match
 * Uses ESPN, Free Livescore, and other sources for fallback enrichment
 * Generates better AI predictions with available data
 */

const { getScoreboard: getEspnScoreboard } = require('./espnHiddenApiService');
const { apiQueue } = require('../utils/apiQueue');
const db = require('../db');
const config = require('../config');

/**
 * Get enhanced match details for a specific match
 * Falls back to multiple sources when TheSportsDB doesn't have the data
 */
async function getEnhancedMatchDetails(matchId, homeTeam, awayTeam, league, matchDate) {
  console.log(`[EnhancedMatch] Getting details for ${homeTeam} vs ${awayTeam}...`);
  
  try {
    // Try ESPN first for comprehensive match data
    const espnData = await tryESPNData(homeTeam, awayTeam, league, matchDate);
    
    if (espnData) {
      console.log(`[EnhancedMatch] Found data from ESPN`);
      return await enrichWithAI(matchId, espnData, 'espn');
    }
    
    // Try Free Livescore as second option
    const livescoreData = await tryLivescoreData(homeTeam, awayTeam);
    
    if (livescoreData) {
      console.log(`[EnhancedMatch] Found data from Free Livescore`);
      return await enrichWithAI(matchId, livescoreData, 'livescore');
    }
    
    // Generate enhanced template data as last resort
    console.log(`[EnhancedMatch] Using enhanced template fallback`);
    return await generateEnhancedTemplate(matchId, homeTeam, awayTeam, league, matchDate);
    
  } catch (error) {
    console.error(`[EnhancedMatch] Error getting match details:`, error.message);
    return null;
  }
}

/**
 * Try to get match data from ESPN
 */
async function tryESPNData(homeTeam, awayTeam, league, matchDate) {
  try {
    // Try football/soccer first
    const data = await getEspnScoreboard('football', 'soccer', matchDate);
    
    if (data && data.events) {
      // Find matching event
      const matchingEvent = data.events.find(event => {
        const eventHome = event.competitions?.[0]?.competitors?.[0]?.team?.displayName || '';
        const eventAway = event.competitions?.[0]?.competitors?.[1]?.team?.displayName || '';
        
        return (
          (eventHome.toLowerCase().includes(homeTeam.toLowerCase()) || 
           homeTeam.toLowerCase().includes(eventHome.toLowerCase())) &&
          (eventAway.toLowerCase().includes(awayTeam.toLowerCase()) || 
           awayTeam.toLowerCase().includes(eventAway.toLowerCase()))
        );
      });
      
      if (matchingEvent) {
        return {
          source: 'espn',
          eventData: matchingEvent,
          league: matchingEvent.league?.name || league,
          startTime: matchingEvent.date,
          status: matchingEvent.status?.type?.state || 'NS',
          homeScore: matchingEvent.competitions?.[0]?.competitors?.[0]?.score,
          awayScore: matchingEvent.competitions?.[0]?.competitors?.[1]?.score,
          homeTeam: matchingEvent.competitions?.[0]?.competitors?.[0]?.team?.displayName,
          awayTeam: matchingEvent.competitions?.[0]?.competitors?.[1]?.team?.displayName,
          venue: matchingEvent.competitions?.[0]?.venue?.fullName,
          weather: matchingEvent.weather?.displayText || 'Unavailable',
          odds: matchingEvent.competitions?.[0]?.odds || null
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error(`[EnhancedMatch] ESPN data error:`, error.message);
    return null;
  }
}

/**
 * Try to get match data from Free Livescore
 */
async function tryLivescoreData(homeTeam, awayTeam) {
  try {
    // This would need to be implemented based on the freeLivescoreService
    // For now, return null as placeholder
    console.log(`[EnhancedMatch] Free Livescore not yet implemented`);
    return null;
  } catch (error) {
    console.error(`[EnhancedMatch] Free Livescore data error:`, error.message);
    return null;
  }
}

/**
 * Enrich match data with AI predictions
 */
async function enrichWithAI(matchId, matchData, source) {
  try {
    console.log(`[EnhancedMatch] Enriching ${source} data with AI...`);
    
    // Build context for AI
    const context = {
      homeTeam: matchData.homeTeam,
      awayTeam: matchData.awayTeam,
      league: matchData.league,
      venue: matchData.venue || 'Unknown',
      weather: matchData.weather || 'Unavailable',
      currentScore: matchData.homeScore && matchData.awayScore ? 
        `${matchData.homeScore}-${matchData.awayScore}` : 'Not Started',
      source: source
    };
    
    // Generate AI prediction using available context
    const aiPrediction = await generateAIInsight(matchId, context);
    
    return {
      ...matchData,
      aiPrediction: aiPrediction,
      enriched: true,
      enrichmentSource: source
    };
    
  } catch (error) {
    console.error(`[EnhancedMatch] AI enrichment error:`, error.message);
    return matchData;
  }
}

/**
 * Generate AI insight based on available context
 */
async function generateAIInsight(matchId, context) {
  try {
    // Use local AI (Dolphin) for prediction generation
    const dolphinUrl = config.dolphin.url;
    
    if (!dolphinUrl) {
      console.log(`[EnhancedMatch] No Dolphin URL configured, using template AI`);
      return generateTemplateAI(context);
    }
    
    // Build AI prompt
    const prompt = `As a sports betting analyst, analyze this match and provide predictions:

Match: ${context.homeTeam} vs ${context.awayTeam}
League: ${context.league}
Venue: ${context.venue}
Weather: ${context.weather}
Current Score: ${context.currentScore}

Provide:
1. Primary prediction (1X2) with confidence percentage
2. Risk assessment (Low/Medium/High)
3. 2-3 secondary insights with confidence
4. Brief analysis reasoning

Respond in JSON format:
{
  "primary": {"prediction": "1", "confidence": 65},
  "risk": "Medium",
  "secondary": [
    {"market": "Double Chance 1X", "confidence": 75},
    {"market": "Under 2.5 Goals", "confidence": 60}
  ],
  "analysis": "Brief reasoning here"
}`;

    const response = await fetch(`${dolphin.url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'dolphin-2.8',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      throw new Error(`Dolphin API error: ${response.status}`);
    }
    
    const result = await response.json();
    const aiContent = result.choices?.[0]?.message?.content;
    
    if (aiContent) {
      try {
        const aiData = JSON.parse(aiContent);
        return aiData;
      } catch (parseError) {
        console.log(`[EnhancedMatch] AI response not JSON, using template`);
        return generateTemplateAI(context);
      }
    }
    
    return generateTemplateAI(context);
    
  } catch (error) {
    console.error(`[EnhancedMatch] AI generation error:`, error.message);
    return generateTemplateAI(context);
  }
}

/**
 * Generate template-based AI prediction
 */
function generateTemplateAI(context) {
  // Generate reasonable predictions based on team names and context
  const homeTeam = context.homeTeam.toLowerCase();
  const awayTeam = context.awayTeam.toLowerCase();
  
  // Simple heuristic-based predictions
  let primaryPrediction = 'X'; // Draw by default
  let confidence = 50;
  let risk = 'Medium';
  let secondary = [];
  let analysis = '';
  
  // Check for common patterns
  if (homeTeam.includes('paris') || homeTeam.includes('marseille') || homeTeam.includes('lyon')) {
    primaryPrediction = '1';
    confidence = 65;
    analysis = `Home team ${context.homeTeam} has strong home advantage in ${context.league}.`;
  } else if (awayTeam.includes('paris') || awayTeam.includes('marseille') || awayTeam.includes('lyon')) {
    primaryPrediction = '2';
    confidence = 55;
    analysis = `Away team ${context.awayTeam} shows strong form in ${context.league}.`;
  } else {
    primaryPrediction = 'X';
    confidence = 45;
    analysis = `Evenly matched contest in ${context.league}. Expected tight game.`;
  }
  
  // Generate secondary insights
  secondary = [
    { market: 'Double Chance 1X', confidence: Math.max(confidence + 10, 70) },
    { market: 'Under 2.5 Goals', confidence: 60 },
    { market: 'Both Teams to Score - No', confidence: 55 }
  ];
  
  // Risk assessment based on confidence
  if (confidence >= 70) {
    risk = 'Low';
  } else if (confidence >= 55) {
    risk = 'Medium';
  } else {
    risk = 'High';
  }
  
  return {
    primary: { prediction: primaryPrediction, confidence: confidence },
    risk: risk,
    secondary: secondary.slice(0, 3),
    analysis: analysis
  };
}

/**
 * Generate enhanced template when no data sources available
 */
async function generateEnhancedTemplate(matchId, homeTeam, awayTeam, league, matchDate) {
  console.log(`[EnhancedMatch] Generating enhanced template for ${homeTeam} vs ${awayTeam}`);
  
  const context = {
    homeTeam: homeTeam,
    awayTeam: awayTeam,
    league: league,
    venue: 'Stadium',
    weather: 'Unavailable',
    currentScore: 'Not Started',
    source: 'template'
  };
  
  const aiPrediction = generateTemplateAI(context);
  
  return {
    source: 'enhanced_template',
    homeTeam: homeTeam,
    awayTeam: awayTeam,
    league: league,
    startTime: matchDate,
    status: 'NS',
    venue: 'Stadium',
    weather: '🌤️ Unavailable',
    aiPrediction: aiPrediction,
    enriched: true,
    enrichmentSource: 'enhanced_template'
  };
}

module.exports = {
  getEnhancedMatchDetails,
  generateEnhancedTemplate
};
