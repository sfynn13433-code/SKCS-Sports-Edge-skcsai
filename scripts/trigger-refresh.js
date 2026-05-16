// trigger-refresh.js — Hit the Render backend to trigger a full prediction refresh
// Usage: npm run refresh:trigger [-- --sport=football] [-- --wait]
'use strict';

const https = require('https');
const http = require('http');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const BACKEND_HOST = process.env.SKCS_TRIGGER_HOST || 'skcs-sports-edge-skcsai.onrender.com';
const BACKEND_URL = `https://${BACKEND_HOST}`;
const ADMIN_KEY = process.env.ADMIN_API_KEY || process.env.CRON_SECRET || '';

// Parse CLI args
const args = process.argv.slice(2);
const sportArg = args.find(a => a.startsWith('--sport='));
const sport = sportArg ? sportArg.split('=')[1] : null;
const wait = args.includes('--wait');

function httpRequest(url, options, postData) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const mod = parsed.protocol === 'https:' ? https : http;
        const req = mod.request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

(async () => {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   SKCS Prediction Refresh Trigger       ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log(`\n🎯 Target: ${BACKEND_URL}`);
    console.log(`🏟️  Sport:  ${sport || 'ALL'}`);
    console.log(`⏳ Wait:    ${wait ? 'yes' : 'no (fire-and-forget)'}\n`);

    if (!ADMIN_KEY) {
        console.error('❌ ADMIN_API_KEY or CRON_SECRET must be set in .env');
        console.error('   Create a .env file with: ADMIN_API_KEY=your_admin_key');
        process.exit(1);
    }

    try {
        // Step 1: Trigger sync to pull fresh fixture data
        console.log('📥 Step 1/2: Triggering data sync from external APIs...');
        
        const syncEndpoint = sport
            ? `/api/pipeline/sync`
            : `/api/pipeline/run-full`;
        
        const syncBody = sport
            ? JSON.stringify({ sport, wait: true })
            : JSON.stringify({ wait: true });

        const syncRes = await httpRequest(`${BACKEND_URL}${syncEndpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ADMIN_KEY
            }
        }, syncBody);

        if (syncRes.status === 202) {
            console.log('✅ Sync accepted (running in background)');
            console.log('   Check /api/pipeline/status for progress');
        } else if (syncRes.status === 200) {
            console.log('✅ Sync completed:', JSON.stringify(syncRes.data, null, 2));
        } else {
            console.error(`❌ Sync failed (HTTP ${syncRes.status}):`, syncRes.data);
            process.exit(1);
        }

        // Step 2: Trigger AI pipeline to generate predictions
        console.log('\n🤖 Step 2/2: Triggering AI prediction pipeline...');
        
        const aiRes = await httpRequest(`${BACKEND_URL}/api/scheduler/trigger-ai-pipeline`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-key': ADMIN_KEY
            }
        }, JSON.stringify({
            sport: sport || null
        }));

        if (aiRes.status === 200) {
            console.log('✅ AI pipeline triggered:', JSON.stringify(aiRes.data, null, 2));
        } else {
            console.error(`❌ AI pipeline failed (HTTP ${aiRes.status}):`, aiRes.data);
            process.exit(1);
        }

        console.log('\n🎉 Refresh triggered successfully!');
        console.log('   Predictions will appear in the hub within a few minutes.');
        console.log('   Hard refresh (Ctrl+Shift+R) to see new data.\n');
        process.exit(0);

    } catch (err) {
        console.error('\n❌ Connection error:', err.message);
        console.error('   Make sure the Render backend is running and accessible.');
        process.exit(1);
    }
})();
