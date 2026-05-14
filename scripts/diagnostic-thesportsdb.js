#!/usr/bin/env node

/**
 * TheSportsDB API Diagnostic Script
 * 
 * This script tests TheSportsDB API connectivity and identifies specific issues:
 * 1. API key validity
 * 2. Endpoint availability
 * 3. Rate limiting
 * 4. Response format validation
 */

const fetch = require('node-fetch');
require('dotenv').config({ path: require('path').resolve(__dirname, '..') });

const config = require('../backend/config');
const THESPORTSDB_BASE_URL = `https://www.thesportsdb.com/api/v1/json/${config.theSportsDbKey || '3'}`;

// Test endpoints that are failing in production
const TEST_ENDPOINTS = [
  { name: 'searchlastteam.php (team 135685)', endpoint: 'searchlastteam.php?id=135685' },
  { name: 'searchlastteam.php (team 135690)', endpoint: 'searchlastteam.php?id=135690' },
  { name: 'lookuptable.php (league 4456, season 2026)', endpoint: 'lookuptable.php?l=4456&s=2026' },
  { name: 'lookupeventstats.php (event 2400580)', endpoint: 'lookupeventstats.php?id=2400580' },
  { name: 'lookuptimeline.php (event 2400580)', endpoint: 'lookuptimeline.php?id=2400580' },
  { name: 'eventsday.php (today)', endpoint: `eventsday.php?d=${new Date().toISOString().split('T')[0]}` },
  { name: 'lookupevent.php (event 2400580)', endpoint: 'lookupevent.php?id=2400580' },
  { name: 'eventslast.php (team 135685)', endpoint: 'eventslast.php?id=135685' }
];

async function testEndpoint(endpoint) {
  const url = `${THESPORTSDB_BASE_URL}/${endpoint.endpoint}`;
  console.log(`\n🔍 Testing: ${endpoint.name}`);
  console.log(`   URL: ${url}`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(url);
    const responseTime = Date.now() - startTime;
    const rawText = await response.text();
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response Time: ${responseTime}ms`);
    console.log(`   Content-Length: ${rawText.length} chars`);
    
    if (!response.ok) {
      console.log(`   ❌ HTTP Error: ${response.status}`);
      
      // Check if it's the 404 HTML error we saw in logs
      if (rawText.includes('<!DOCTYPE html') && rawText.includes('404 - File or directory not found')) {
        console.log(`   🚨 This is the 404 HTML error from your logs`);
        console.log(`   📝 The endpoint may not exist or requires different parameters`);
      }
      
      // Show first 200 chars of error response
      console.log(`   Error Preview: ${rawText.substring(0, 200)}...`);
      return { success: false, status: response.status, error: rawText };
    }
    
    if (!rawText || rawText.trim() === '') {
      console.log(`   ❌ Empty Response`);
      return { success: false, error: 'Empty response' };
    }
    
    try {
      const data = JSON.parse(rawText);
      console.log(`   ✅ Valid JSON`);
      
      // Check for empty results
      const hasData = Object.keys(data).some(key => {
        const value = data[key];
        return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined;
      });
      
      if (hasData) {
        console.log(`   ✅ Contains data`);
        // Show data structure
        Object.keys(data).forEach(key => {
          const value = data[key];
          if (Array.isArray(value)) {
            console.log(`   📊 ${key}: ${value.length} items`);
          } else if (value && typeof value === 'object') {
            console.log(`   📊 ${key}: Object with ${Object.keys(value).length} fields`);
          } else {
            console.log(`   📊 ${key}: ${typeof value}`);
          }
        });
      } else {
        console.log(`   ⚠️ Valid JSON but no data`);
      }
      
      return { success: true, data, responseTime };
      
    } catch (parseError) {
      console.log(`   ❌ Invalid JSON: ${parseError.message}`);
      console.log(`   Raw Response: ${rawText.substring(0, 200)}...`);
      return { success: false, error: 'Invalid JSON', rawText };
    }
    
  } catch (fetchError) {
    console.log(`   ❌ Fetch Error: ${fetchError.message}`);
    return { success: false, error: fetchError.message };
  }
}

async function testApiKeyValidity() {
  console.log(`\n🔑 Testing API Key Validity`);
  console.log(`   Using key: ${config.theSportsDbKey || '3'}`);
  
  // Test with a simple endpoint that should always work
  const testUrl = `${THESPORTSDB_BASE_URL}/search_all_leagues.php?s=Soccer`;
  
  try {
    const response = await fetch(testUrl);
    const text = await response.text();
    
    if (response.ok) {
      try {
        const data = JSON.parse(text);
        console.log(`   ✅ API key appears valid`);
        console.log(`   📊 Found ${data.countrys ? data.countrys.length : 0} soccer leagues`);
        return true;
      } catch (e) {
        console.log(`   ❌ API key response not valid JSON`);
        return false;
      }
    } else {
      console.log(`   ❌ API key invalid or expired (Status: ${response.status})`);
      if (text.includes('API key')) {
        console.log(`   📝 Response mentions API key issues`);
      }
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Network error testing API key: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 TheSportsDB API Diagnostic');
  console.log('=====================================');
  
  // Test API key first
  const apiKeyValid = await testApiKeyValidity();
  
  if (!apiKeyValid) {
    console.log('\n❌ API key issues detected. Check your THESPORTSDB_KEY environment variable.');
    process.exit(1);
  }
  
  // Test each problematic endpoint
  const results = [];
  for (const endpoint of TEST_ENDPOINTS) {
    const result = await testEndpoint(endpoint);
    results.push({ ...endpoint, ...result });
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n📊 Summary');
  console.log('=============');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  
  if (failed.length > 0) {
    console.log('\n❌ Failed Endpoints:');
    failed.forEach(f => {
      console.log(`   - ${f.name}: ${f.error || 'Unknown error'}`);
    });
    
    console.log('\n🔧 Recommendations:');
    
    // Check for specific patterns
    const htmlErrors = failed.filter(f => f.error && f.error.includes('<!DOCTYPE html'));
    if (htmlErrors.length > 0) {
      console.log('   - Some endpoints return 404 HTML errors');
      console.log('   - These endpoints may not exist or need different parameters');
      console.log('   - Check TheSportsDB API documentation for correct endpoint names');
    }
    
    const emptyResponses = failed.filter(f => f.error === 'Empty response');
    if (emptyResponses.length > 0) {
      console.log('   - Some endpoints return empty responses');
      console.log('   - This may indicate no data available for the requested IDs');
      console.log('   - Verify the team/event/league IDs are valid');
    }
    
    console.log('   - Consider adding better error handling for these endpoints');
    console.log('   - Implement fallback behavior when endpoints fail');
  }
  
  console.log('\n🏁 Diagnostic complete');
}

if (require.main === module) {
  main().catch(console.error);
}
