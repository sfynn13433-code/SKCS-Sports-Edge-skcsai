/**
 * Check why production is using templates despite GROQ_KEY being set
 */

const axios = require('axios');

const RENDER_SERVICE_URL = 'https://skcsai.onrender.com'; // Your production URL

async function checkProduction() {
    console.log('Checking production environment...\n');
    
    // Check if health endpoint shows AI availability
    try {
        const health = await axios.get(`${RENDER_SERVICE_URL}/api/health`, { timeout: 10000 });
        console.log('Health check:', health.data);
    } catch (err) {
        console.log('Health check failed:', err.message);
    }
    
    console.log('\n--- Checking if GROQ is actually being used ---\n');
    
    // The issue might be:
    // 1. Code hasn't been redeployed yet
    // 2. isGroqAvailable() is returning false for some reason
    // 3. generateInsight is failing silently
    
    console.log('Possible issues:');
    console.log('1. Deployment may still be in progress');
    console.log('2. Check Render Logs tab for errors');
    console.log('3. Verify GROQ_API_KEY value is correct (not corrupted)');
}

checkProduction().catch(console.error);
