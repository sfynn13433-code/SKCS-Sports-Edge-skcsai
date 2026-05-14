/**
 * Sports Data Services Rate Limits Analysis
 * 
 * This file analyzes the rate limits and capabilities of all available sports data services
 * to inform the optimal hybrid strategy.
 */

const RATE_LIMITS = {
  // TheSportsDB - Free tier
  thesportsdb: {
    name: 'TheSportsDB',
    rateLimit: '25 calls/minute',
    monthlyLimit: 'Unlimited (rate limited)',
    cost: 'Free',
    dataQuality: 'High',
    coverage: 'Football/Soccer focused',
    implementation: '✅ Complete with ApiQueue',
    strengths: ['Rich match data', 'Lineups', 'Stats', 'Timeline', 'H2H', 'Standings'],
    weaknesses: ['Rate limited', 'Football only', 'API queue required'],
    optimalUse: 'Primary for detailed football data'
  },

  // ESPN Hidden API - No API key required
  espn: {
    name: 'ESPN Hidden API',
    rateLimit: 'No official limit',
    monthlyLimit: 'Unlimited',
    cost: 'Free',
    dataQuality: 'High',
    coverage: 'Multi-sport (Football, Basketball, Baseball, etc.)',
    implementation: '✅ Complete',
    strengths: ['No API key', 'Multi-sport', 'Live scores', 'News', 'Official data'],
    weaknesses: ['Undocumented', 'May change without notice', 'Complex data structure'],
    optimalUse: 'Primary for live scores and multi-sport coverage'
  },

  // Free Livescore API - RapidAPI free tier
  freelivescore: {
    name: 'Free Livescore API',
    rateLimit: 'Unknown (RapidAPI free tier)',
    monthlyLimit: 'Unknown (RapidAPI free tier)',
    cost: 'Free',
    dataQuality: 'Medium',
    coverage: 'Multi-sport',
    implementation: '✅ Complete with rate limit tracking',
    strengths: ['Rate limit headers', 'Multi-sport', 'Live scores'],
    weaknesses: ['Unknown limits', 'Requires API key', 'RapidAPI dependency'],
    optimalUse: 'Secondary for additional live score coverage'
  },

  // Pro Football Data API - Current subscription
  profootball: {
    name: 'Pro Football Data API',
    rateLimit: '10 requests/minute',
    monthlyLimit: '0 requests/month (Basic plan)',
    cost: '$0/month (Basic)',
    dataQuality: 'Low',
    coverage: 'Competitions only',
    implementation: '✅ Complete',
    strengths: ['Working endpoints', '/health check', 'Competitions data'],
    weaknesses: ['0 requests/month', 'No game details', 'Competitions only'],
    optimalUse: 'Last resort for competition info only'
  },

  // Odds API - For betting data
  oddsapi: {
    name: 'The Odds API',
    rateLimit: '500 requests/minute',
    monthlyLimit: 'Free tier available',
    cost: 'Free tier available',
    dataQuality: 'High',
    coverage: 'Betting odds',
    implementation: '✅ Complete with rate limiting',
    strengths: ['High rate limit', 'Betting data', 'Multiple bookmakers'],
    weaknesses: ['Betting focused only', 'Requires API key'],
    optimalUse: 'Betting odds and value predictions'
  }
};

/**
 * Calculate optimal usage strategy based on rate limits
 */
function calculateOptimalStrategy() {
  const strategy = {
    primary: [],
    secondary: [],
    fallback: [],
    recommendations: []
  };

  // Primary sources (high quality, reasonable limits)
  strategy.primary.push({
    service: 'espn',
    reason: 'No rate limits, multi-sport, official data',
    usage: 'Live scores, schedules, multi-sport coverage'
  });

  strategy.primary.push({
    service: 'thesportsdb',
    reason: 'Rich football data, detailed match info',
    usage: 'Detailed football analysis, lineups, stats'
  });

  // Secondary sources (supplemental data)
  strategy.secondary.push({
    service: 'freelivescore',
    reason: 'Additional live score coverage',
    usage: 'Backup live scores when ESPN fails'
  });

  strategy.secondary.push({
    service: 'oddsapi',
    reason: 'Betting odds and value predictions',
    usage: 'Betting insights and value predictions'
  });

  // Fallback sources (limited use)
  strategy.fallback.push({
    service: 'profootball',
    reason: 'Competition info only',
    usage: 'Last resort for competition data'
  });

  // Recommendations
  strategy.recommendations = [
    'Use ESPN as primary for live scores and multi-sport data',
    'Use TheSportsDB for detailed football analysis',
    'Cache ESPN data aggressively to minimize API calls',
    'Use TheSportsDB queue for rate-limited enrichment',
    'Reserve Pro Football for competition metadata only',
    'Implement smart fallback chain: ESPN → TheSportsDB → Free Livescore → Pro Football'
  ];

  return strategy;
}

/**
 * Calculate daily API call budget
 */
function calculateDailyBudget() {
  const budget = {
    thesportsdb: 25 * 60 * 24, // 25/min * 60 min * 24 hours = 36,000 calls/day
    espn: 'unlimited', // No official limit
    freelivescore: 'unknown', // RapidAPI free tier
    profootball: 10 * 60 * 24, // 10/min * 60 min * 24 hours = 14,400 calls/day (but 0/month limit)
    oddsapi: 500 * 60 * 24 // 500/min * 60 min * 24 hours = 720,000 calls/day
  };

  return budget;
}

/**
 * Get service priority for different data types
 */
function getServicePriority(dataType) {
  const priorities = {
    'live_scores': ['espn', 'freelivescore', 'thesportsdb', 'profootball'],
    'fixtures': ['thesportsdb', 'espn', 'freelivescore', 'profootball'],
    'detailed_match': ['thesportsdb', 'espn', 'freelivescore', 'profootball'],
    'competitions': ['profootball', 'espn', 'thesportsdb', 'freelivescore'],
    'multi_sport': ['espn', 'freelivescore', 'thesportsdb', 'profootball'],
    'betting_odds': ['oddsapi', 'espn', 'thesportsdb', 'profootball']
  };

  return priorities[dataType] || ['espn', 'thesportsdb', 'freelivescore', 'profootball'];
}

/**
 * Generate hybrid strategy recommendations
 */
function generateHybridStrategy() {
  const strategy = calculateOptimalStrategy();
  const budget = calculateDailyBudget();

  return {
    summary: {
      totalServices: Object.keys(RATE_LIMITS).length,
      primaryServices: strategy.primary.length,
      recommendedApproach: 'Multi-source hybrid with smart fallbacks'
    },
    rateLimits: RATE_LIMITS,
    dailyBudget: budget,
    strategy: strategy,
    implementation: {
      heartbeat: {
        frequency: '30 minutes',
        primarySource: 'espn',
        fallbackChain: ['espn', 'thesportsdb', 'freelivescore', 'profootball']
      },
      featuredGames: {
        primarySource: 'espn',
        fallbackChain: ['espn', 'thesportsdb', 'freelivescore', 'profootball'],
        cacheDuration: '5 minutes for live, 1 hour for fixtures'
      },
      detailedAnalysis: {
        primarySource: 'thesportsdb',
        fallbackChain: ['thesportsdb', 'espn'],
        rateLimiting: 'Use ApiQueue for TheSportsDB calls'
      },
      bettingOdds: {
        primarySource: 'oddsapi',
        fallbackChain: ['oddsapi'],
        integration: 'Use for value predictions and insights'
      }
    },
    monitoring: {
      trackMetrics: [
        'API call counts per service',
        'Response times and error rates',
        'Cache hit rates',
        'Fallback usage frequency'
      ],
      alerts: [
        'Rate limit approaching',
        'High error rates on primary sources',
        'Cache miss rates too high',
        'Fallback chain activation frequency'
      ]
    }
  };
}

module.exports = {
  RATE_LIMITS,
  calculateOptimalStrategy,
  calculateDailyBudget,
  getServicePriority,
  generateHybridStrategy
};
