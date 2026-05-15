#!/usr/bin/env node

/**
 * Test specific TheSportsDB endpoints to identify correct names
 */

const fetch = require('node-fetch');
require('dotenv').config({ path: require('path').resolve(__dirname, '..') });

const config = require('../backend/config');
const THESPORTSDB_BASE_URL = `https://www.thesportsdb.com/api/v1/json/${config.theSportsDbKey || '3'}`;

async function testEndpoint(endpoint) {
  const url = `${THESPORTSDB_BASE_URL}/${endpoint}`;
  console.log(`\n🔍 Testing: ${endpoint}`);
  console.log(`   URL: ${url}`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(url);
    const responseTime = Date.now() - startTime;
    const rawText = await response.text();
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Length: ${rawText.length} chars`);
    
    if (!response.ok) {
      console.log(`   ❌ HTTP Error: ${response.status}`);
      if (rawText.includes('<!DOCTYPE html') && rawText.includes('404')) {
        console.log(`   🚨 404 HTML Error - Endpoint may not exist`);
      }
      console.log(`   Error Preview: ${rawText.substring(0, 200)}...`);
      return false;
    }
    
    if (!rawText || rawText.trim() === '') {
      console.log(`   ❌ Empty Response`);
      return false;
    }
    
    try {
      const data = JSON.parse(rawText);
      console.log(`   ✅ Valid JSON`);
      
      const hasData = Object.keys(data).some(key => {
        const value = data[key];
        return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined;
      });
      
      if (hasData) {
        console.log(`   ✅ Contains data`);
        Object.keys(data).forEach(key => {
          const value = data[key];
          if (Array.isArray(value)) {
            console.log(`   📊 ${key}: ${value.length} items`);
            if (value.length > 0 && value[0]) {
              console.log(`   📝 Sample item keys: ${Object.keys(value[0]).join(', ')}`);
            }
          } else if (value && typeof value === 'object') {
            console.log(`   📊 ${key}: Object with ${Object.keys(value).length} fields`);
            console.log(`   📝 Keys: ${Object.keys(value).join(', ')}`);
          } else {
            console.log(`   📊 ${key}: ${typeof value}`);
          }
        });
      } else {
        console.log(`   ⚠️ Valid JSON but no data`);
      }
      
      return true;
      
    } catch (parseError) {
      console.log(`   ❌ Invalid JSON: ${parseError.message}`);
      console.log(`   Raw Response: ${rawText.substring(0, 200)}...`);
      return false;
    }
    
  } catch (fetchError) {
    console.log(`   ❌ Fetch Error: ${fetchError.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 TheSportsDB Endpoint Discovery');
  console.log('==================================');
  
  // Test different lineup endpoint variations
  const lineupEndpoints = [
    'lookupeventlineup.php?id=2400580',  // Current failing endpoint
    'lookupeventlineups.php?id=2400580', // Plural version
    'eventlineup.php?id=2400580',        // Shorter version
    'lineups.php?id=2400580',            // Just lineups
    'lookuplineup.php?id=2400580',       // Alternative
  ];
  
  // Test different team endpoint variations
  const teamEndpoints = [
    'searchlastteam.php?id=135685',      // Current failing endpoint
    'searchlastteams.php?id=135685',     // Plural version
    'eventslast.php?id=135685',          // This one works
    'lastteam.php?id=135685',            // Shorter version
    'teamlast.php?id=135685',            // Alternative
  ];
  
  console.log('\n👥 Testing Lineup Endpoints:');
  for (const endpoint of lineupEndpoints) {
    await testEndpoint(endpoint);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n🏆 Testing Team Endpoints:');
  for (const endpoint of teamEndpoints) {
    await testEndpoint(endpoint);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n🏁 Endpoint discovery complete');
}

if (require.main === module) {
  main().catch(console.error);
}
