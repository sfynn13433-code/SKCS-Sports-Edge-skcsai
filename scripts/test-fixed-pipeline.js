#!/usr/bin/env node

/**
 * Test the fixed TheSportsDB pipeline with actual event data
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..') });

const thesportsdbPipeline = require('../backend/services/thesportsdbPipeline');

async function testPipeline() {
  console.log('🚀 Testing Fixed TheSportsDB Pipeline');
  console.log('=====================================');
  
  // Test with one of the events that was failing in the logs
  const testEventId = '2400580';
  
  console.log(`\n📊 Testing enrichment for event ${testEventId}`);
  
  try {
    const success = await thesportsdbPipeline.enrichMatchContext(testEventId);
    
    if (success) {
      console.log('✅ Enrichment completed successfully');
      
      // Test insight generation
      console.log('\n🧠 Testing insight generation...');
      const insightSuccess = await thesportsdbPipeline.generateEdgeMindInsight(testEventId);
      
      if (insightSuccess) {
        console.log('✅ Insight generation completed successfully');
      } else {
        console.log('❌ Insight generation failed');
      }
    } else {
      console.log('❌ Enrichment failed');
    }
  } catch (error) {
    console.error('❌ Pipeline test failed:', error.message);
  }
  
  console.log('\n🏁 Pipeline test complete');
}

if (require.main === module) {
  testPipeline().catch(console.error);
}
