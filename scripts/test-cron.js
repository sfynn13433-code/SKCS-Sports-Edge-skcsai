require('dotenv').config();
const axios = require('axios');

const CRON_SECRET = process.env.CRON_SECRET || 'skcs_super_secret_cron_key_2026';
const BASE_URL = process.env.RENDER_EXTERNAL_URL || 'https://skcs-sports-edge-skcsai.onrender.com';

async function testCron() {
    console.log('\n=== TESTING CRON ENDPOINTS ===\n');
    console.log('Base URL:', BASE_URL);
    console.log('CRON Secret:', CRON_SECRET ? 'SET' : 'NOT SET');
    
    // Test sync-live
    console.log('\n--- Testing /api/cron/sync-live ---');
    try {
        const response = await axios.get(`${BASE_URL}/api/cron/sync-live`, {
            headers: { 'x-cron-secret': CRON_SECRET },
            timeout: 60000
        });
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.log('Error:', err.response?.status, err.message);
        if (err.response?.data) console.log('Details:', err.response.data);
    }
}

testCron().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });