'use strict';

const https = require('https');

function makeRequest(hostname, path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: hostname,
            port: 443,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, data: data });
            });
        });
        
        req.on('error', (e) => resolve({ error: e.message }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ error: 'Timeout' });
        });
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function main() {
    console.log('═'.repeat(60));
    console.log('   PIPELINE EXECUTION');
    console.log('═'.repeat(60) + '\n');
    
    // Check Vercel first
    console.log('1. Checking Vercel...');
    const vercelResult = await makeRequest('skcs-ai.vercel.app', '/api/pipeline/status');
    
    if (vercelResult.error) {
        console.log('   ❌ Vercel not responding:', vercelResult.error);
        console.log('\n   Trying Render (may be sleeping)...');
        
        const renderResult = await makeRequest('skcsai.onrender.com', '/api/pipeline/status');
        
        if (renderResult.error) {
            console.log('   ❌ Render not responding:', renderResult.error);
            console.log('\n⚠️  Both services are not responding.');
            console.log('\n   Options:');
            console.log('   1. Wait 30 seconds and try again');
            console.log('   2. Check Vercel dashboard for deployment status');
            console.log('   3. Check Render dashboard for deployment status');
            return;
        } else {
            console.log('   ✅ Render responded! Status:', renderResult.status);
        }
    } else {
        console.log('   ✅ Vercel responded! Status:', vercelResult.status);
    }
    
    // Trigger pipeline
    console.log('\n2. Triggering pipeline sync...');
    console.log('   POST /api/pipeline/sync\n');
    
    const syncResult = await makeRequest('skcsai.onrender.com', '/api/pipeline/sync', 'POST', { wait: true });
    
    if (syncResult.error) {
        console.log('   ❌ Error:', syncResult.error);
    } else {
        console.log('   Status:', syncResult.status);
        try {
            const json = JSON.parse(syncResult.data);
            console.log('\n   Response:');
            console.log('   ', JSON.stringify(json, null, 2).substring(0, 800));
        } catch (e) {
            console.log('   Response:', syncResult.data.substring(0, 500));
        }
    }
    
    console.log('\n' + '═'.repeat(60));
}

main();
