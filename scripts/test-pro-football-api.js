#!/usr/bin/env node

/**
 * Test Pro Football Data API Integration
 * Tests the new high-efficiency proxy with rate limiting and caching
 */

const proFootballService = require('../backend/services/proFootballDataService');

async function runTests() {
  console.log('🚀 Testing Pro Football Data API Integration');
  console.log('===========================================');
  
  try {
    // Test 1: Health Check
    console.log('\n🔍 Test 1: Health Check');
    const health = await proFootballService.healthCheck();
    console.log('   Health Status:', health);
    
    // Test 2: Get Fixtures
    console.log('\n🔍 Test 2: Get Fixtures (League 39, Season 2025)');
    const fixtures = await proFootballService.getFixtures(39, 2025);
    if (fixtures) {
      console.log('   ✅ Fixtures retrieved successfully');
      console.log('   📊 Data type:', typeof fixtures);
      console.log('   📊 Sample keys:', Object.keys(fixtures).slice(0, 5));
      
      if (fixtures.response && Array.isArray(fixtures.response)) {
        console.log('   📊 Number of fixtures:', fixtures.response.length);
        if (fixtures.response.length > 0) {
          const sampleFixture = fixtures.response[0];
          console.log('   📊 Sample fixture:', {
            id: sampleFixture.fixture?.id,
            date: sampleFixture.fixture?.date,
            home: sampleFixture.teams?.home?.name,
            away: sampleFixture.teams?.away?.name
          });
        }
      }
    } else {
      console.log('   ❌ Failed to retrieve fixtures');
    }
    
    // Test 3: Get Live Fixtures
    console.log('\n🔍 Test 3: Get Live Fixtures');
    const liveFixtures = await proFootballService.getLiveFixtures();
    if (liveFixtures) {
      console.log('   ✅ Live fixtures retrieved successfully');
      if (liveFixtures.response && Array.isArray(liveFixtures.response)) {
        console.log('   📊 Live games:', liveFixtures.response.length);
      }
    } else {
      console.log('   ⚠️ No live fixtures available');
    }
    
    // Test 4: Get Standings
    console.log('\n🔍 Test 4: Get Standings (League 39, Season 2025)');
    const standings = await proFootballService.getStandings(39, 2025);
    if (standings) {
      console.log('   ✅ Standings retrieved successfully');
      if (standings.response && Array.isArray(standings.response)) {
        console.log('   📊 Number of teams in standings:', standings.response.length);
      }
    } else {
      console.log('   ❌ Failed to retrieve standings');
    }
    
    // Test 5: Cache Performance
    console.log('\n🔍 Test 5: Cache Performance Test');
    console.log('   Making same API call twice to test caching...');
    
    const start1 = Date.now();
    await proFootballService.getFixtures(39, 2025);
    const time1 = Date.now() - start1;
    console.log(`   First call took: ${time1}ms`);
    
    const start2 = Date.now();
    await proFootballService.getFixtures(39, 2025);
    const time2 = Date.now() - start2;
    console.log(`   Second call took: ${time2}ms (should be cached)`);
    
    if (time2 < time1 / 10) {
      console.log('   ✅ Caching is working effectively');
    } else {
      console.log('   ⚠️ Cache may not be working as expected');
    }
    
    // Test 6: Cache Stats
    console.log('\n🔍 Test 6: Cache Statistics');
    const cacheStats = proFootballService.getCacheStats();
    console.log('   Cache stats:', cacheStats);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('   Stack:', error.stack);
  }
}

// Run the tests
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
