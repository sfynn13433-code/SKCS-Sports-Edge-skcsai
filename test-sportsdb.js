/**
 * Standalone test script to query TheSportsDB API
 * 
 * This script manually queries TheSportsDB for fixtures on "2026-05-11"
 * and logs the exact request URL, HTTP status code, and raw response body
 * for debugging purposes.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

// TheSportsDB API configuration
const THESPORTSDB_BASE_URL = 'https://www.thesportsdb.com/api/v1/json';
const TEST_DATE = '2026-05-11';

// Get API key from environment (same logic as config.js)
const apiKey = process.env.THESPORTSDB_KEY || process.env.SPORTS_DB_KEY;

if (!apiKey) {
  console.error('ERROR: TheSportsDB key is missing');
  console.error('Set THESPORTSDB_KEY or SPORTS_DB_KEY in your .env file');
  process.exit(1);
}

// Construct the request URL
const requestUrl = `${THESPORTSDB_BASE_URL}/${apiKey}/eventsday.php?d=${TEST_DATE}`;

console.log('='.repeat(80));
console.log('TheSportsDB API Test');
console.log('='.repeat(80));
console.log(`Test Date: ${TEST_DATE}`);
console.log(`API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
console.log(`Request URL: ${requestUrl}`);
console.log('='.repeat(80));

// Make the HTTP request
async function testTheSportsDB() {
  try {
    console.log('\n[INFO] Sending HTTP request...');
    const response = await fetch(requestUrl);
    
    const statusCode = response.status;
    const statusText = response.statusText;
    const rawText = await response.text();
    
    console.log(`\n[STATUS] HTTP Status Code: ${statusCode} ${statusText}`);
    console.log(`\n[RAW RESPONSE BODY]`);
    console.log('-'.repeat(80));
    console.log(rawText);
    console.log('-'.repeat(80));
    
    // Attempt to parse as JSON for additional insight
    try {
      const jsonData = JSON.parse(rawText);
      console.log(`\n[PARSED JSON]`);
      console.log(JSON.stringify(jsonData, null, 2));
      
      // Safely extract events using the plural 'events' key first
      const events = jsonData.events || jsonData.event || [];
      console.log(`\n[INFO] Found ${events.length} events in response`);
      
      if (events.length > 0) {
        console.log(`\n[SAMPLE EVENT] First event structure:`);
        console.log(JSON.stringify(events[0], null, 2));
      } else {
        console.log(`\n[WARNING] No events found in response`);
        console.log(`[DEBUG] Available keys: ${Object.keys(jsonData).join(', ')}`);
      }
    } catch (parseError) {
      console.log(`\n[ERROR] Response is not valid JSON: ${parseError.message}`);
    }
    
  } catch (error) {
    console.error(`\n[ERROR] Request failed: ${error.message}`);
    console.error(error.stack);
  }
}

testTheSportsDB();
