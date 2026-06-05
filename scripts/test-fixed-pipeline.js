#!/usr/bin/env node

/**
 * Test the fixed TheSportsDB pipeline with actual event data
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..') });

const thesportsdbPipeline = require('../backend/services/thesportsdbPipeline');
const { executeOperation } = require('../backend/core/executionPipeline');

async function testPipeline() {
  console.log('🚀 Testing Fixed TheSportsDB Pipeline');
  console.log('=====================================');
  
  // Test with one of the events that was failing in the logs
  const testEventId = '2400580';
  
  console.log(`\n📊 Testing enrichment for event ${testEventId}`);
  
  try {
    const success = await executeOperation({
      operation: 'script.test-fixed.enrich',
      caller: 'scripts/test-fixed-pipeline.js',
      payload: { testEventId },
      execute: async () => thesportsdbPipeline.enrichMatchContext(testEventId)
    });
    
    if (success?.result) {
      console.log('✅ Enrichment completed successfully');
      
      // Test insight generation
      console.log('\n🧠 Testing insight generation...');
      const insightSuccess = await executeOperation({
        operation: 'script.test-fixed.insight',
        caller: 'scripts/test-fixed-pipeline.js',
        payload: { testEventId },
        execute: async () => thesportsdbPipeline.generateEdgeMindInsight(testEventId)
      });
      
      if (insightSuccess?.result) {
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
