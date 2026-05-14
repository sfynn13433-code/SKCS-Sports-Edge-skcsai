#!/usr/bin/env node

/**
 * Test Optimized Pro Football Data API Endpoints
 * Tests the strategic caching and high-value data implementations
 */

const proFootballService = require('../backend/services/proFootballDataService');

async function runOptimizedTests() {
  console.log('🚀 Testing Optimized Pro Football Data API Endpoints');
  console.log('================================================');
  
  try {
    // Test A: Metadata Dictionary (24h cache)
    console.log('\n🔍 Test A: Metadata Dictionary (24h cache)');
    console.log('   Strategy: Call once per day to map IDs like 11 to LaLiga');
    
    const startA = Date.now();
    const metadata = await proFootballService.getMetadata();
    const timeA = Date.now() - startA;
    
    if (metadata) {
      console.log('   ✅ Metadata retrieved successfully');
      console.log('   📊 Response time:', timeA, 'ms');
      console.log('   📊 Data type:', typeof metadata);
      console.log('   📊 Sample keys:', Object.keys(metadata).slice(0, 3));
    } else {
      console.log('   ❌ Failed to retrieve metadata');
    }
    
    // Test A-2: Cache performance for metadata
    console.log('\n🔍 Test A-2: Metadata Cache Performance');
    const startA2 = Date.now();
    await proFootballService.getMetadata();
    const timeA2 = Date.now() - startA2;
    console.log('   Second call time:', timeA2, 'ms (should be cached)');
    console.log('   Cache working:', timeA2 < timeA / 10 ? '✅' : '⚠️');
    
    // Test B: AI Betting Trends (1h cache)
    console.log('\n🔍 Test B: AI Betting Trends (1h cache)');
    console.log('   Strategy: Highest-value data, filter for top trends');
    
    const startB = Date.now();
    const trends = await proFootballService.getAITrends(1);
    const timeB = Date.now() - startB;
    
    if (trends && Array.isArray(trends)) {
      console.log('   ✅ AI Trends retrieved successfully');
      console.log('   📊 Response time:', timeB, 'ms');
      console.log('   📊 Number of trends:', trends.length);
      console.log('   📊 Sample trend:', trends[0] ? {
        isTop: trends[0].isTop,
        percentage: trends[0].percentage
      } : 'No trends available');
    } else {
      console.log('   ⚠️ No AI trends available (API may be down)');
    }
    
    // Test C: Daily Hot Games Slate (5m cache)
    console.log('\n🔍 Test C: Daily Hot Games Slate (5m cache)');
    console.log('   Strategy: Suggested games for homepage hero carousel');
    
    const startC = Date.now();
    const slate = await proFootballService.getHomepageSlate();
    const timeC = Date.now() - startC;
    
    if (slate) {
      console.log('   ✅ Homepage slate retrieved successfully');
      console.log('   📊 Response time:', timeC, 'ms');
      console.log('   📊 Featured games:', slate.featureed?.length || 0);
      console.log('   📊 All games:', slate.allGames?.length || 0);
    } else {
      console.log('   ❌ Failed to retrieve homepage slate');
    }
    
    // Test D: Single Match Deep-Dive (30m cache)
    console.log('\n🔍 Test D: Single Match Deep-Dive (30m cache)');
    console.log('   Strategy: Fetch only when user requests specific game');
    
    // Try a common fixture ID
    const testGameId = 123456;
    const startD = Date.now();
    const deepDive = await proFootballService.getMatchDeepDive(testGameId);
    const timeD = Date.now() - startD;
    
    if (deepDive) {
      console.log('   ✅ Match deep-dive retrieved successfully');
      console.log('   📊 Response time:', timeD, 'ms');
      console.log('   📊 Data includes:', {
        lineups: deepDive.lineups?.length || 0,
        events: deepDive.events?.length || 0,
        predictions: deepDive.predictions?.length || 0,
        highlights: deepDive.highlights ? 'Yes' : 'No'
      });
    } else {
      console.log('   ⚠️ No deep-dive data available (invalid game ID or API issue)');
    }
    
    // Test E: Global News Feed (1h cache)
    console.log('\n🔍 Test E: Global News Feed (1h cache)');
    console.log('   Strategy: Sports=1 for football headlines');
    
    const startE = Date.now();
    const news = await proFootballService.getSportsNews(1);
    const timeE = Date.now() - startE;
    
    if (news) {
      console.log('   ✅ Sports news retrieved successfully');
      console.log('   📊 Response time:', timeE, 'ms');
      console.log('   📊 Data type:', typeof news);
      console.log('   📊 Sample keys:', Object.keys(news).slice(0, 3));
    } else {
      console.log('   ❌ Failed to retrieve sports news');
    }
    
    // Test F: Additional optimized functions
    console.log('\n🔍 Test F: League Information Cache (24h cache)');
    const leagueInfo = await proFootballService.getLeagueInfo(39);
    if (leagueInfo) {
      console.log('   ✅ League info retrieved');
    } else {
      console.log('   ⚠️ No league info available');
    }
    
    console.log('\n🔍 Test G: Team Information Cache (24h cache)');
    const teamInfo = await proFootballService.getTeamInfo(541);
    if (teamInfo) {
      console.log('   ✅ Team info retrieved');
    } else {
      console.log('   ⚠️ No team info available');
    }
    
    // Final Cache Stats
    console.log('\n🔍 Final Cache Statistics');
    const finalStats = proFootballService.getCacheStats();
    console.log('   📊 Cache hits:', finalStats.hits);
    console.log('   📊 Cache misses:', finalStats.misses);
    console.log('   📊 Cache keys:', finalStats.keys);
    console.log('   📊 Hit ratio:', finalStats.hits > 0 ? 
      `${((finalStats.hits / (finalStats.hits + finalStats.misses)) * 100).toFixed(1)}%` : '0%');
    
    console.log('\n✅ All optimized endpoint tests completed!');
    console.log('\n📋 Summary of Strategic Caching:');
    console.log('   • Metadata: 24h cache - maps IDs to names');
    console.log('   • AI Trends: 1h cache - highest-value betting data');
    console.log('   • Homepage: 5m cache - hot games slate');
    console.log('   • Deep-Dive: 30m cache - match-specific analytics');
    console.log('   • News Feed: 1h cache - standardized sports headlines');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('   Stack:', error.stack);
  }
}

// Run the tests
if (require.main === module) {
  runOptimizedTests();
}

module.exports = { runOptimizedTests };
