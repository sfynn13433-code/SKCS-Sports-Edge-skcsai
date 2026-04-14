'use strict';

const https = require('https');

function makeRequest(hostname, path, method = 'GET', body = null, auth = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: hostname,
            port: 443,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 60000 // Longer timeout for pipeline
        };
        
        if (auth) {
            options.headers['Authorization'] = `Bearer ${auth}`;
        }
        
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
            resolve({ error: 'Timeout - service may be sleeping' });
        });
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function main() {
    console.log('═'.repeat(60));
    console.log('   RENDER PIPELINE TRIGGER');
    console.log('═'.repeat(60) + '\n');
    
    console.log('Checking Render service (skcsai.onrender.com)...\n');
    
    // First try to wake it up with a simple request
    console.log('1. Wake-up ping...');
    await makeRequest('skcsai.onrender.com', '/');
    console.log('   ✓ Ping sent\n');
    
    // Wait a moment
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('2. Checking pipeline status...');
    const statusResult = await makeRequest('skcsai.onrender.com', '/api/pipeline/status');
    
    if (statusResult.error) {
        console.log('   ❌', statusResult.error);
        console.log('\n⚠️  Render service is not responding.');
        console.log('\n   Render free tier sleeps after 15 minutes of inactivity.');
        console.log('   Options:');
        console.log('   1. Visit https://skcsai.onrender.com in your browser to wake it');
        console.log('   2. Check https://render.com/dashboard for deployment status');
        console.log('   3. Manually trigger: curl -X POST https://skcsai.onrender.com/api/pipeline/sync');
        return;
    }
    
    console.log('   ✅ Status:', statusResult.status);
    if (statusResult.data) {
        try {
            const json = JSON.parse(statusResult.data);
            console.log('   ', JSON.stringify(json, null, 2).substring(0, 500));
        } catch (e) {}
    }
    
    console.log('\n3. Triggering pipeline sync (wait=true)...');
    console.log('   This may take 30-60 seconds...\n');
    
    const syncResult = await makeRequest(
        'skcsai.onrender.com', 
        '/api/pipeline/sync', 
        'POST', 
        { wait: true }
    );
    
    if (syncResult.error) {
        console.log('   ❌ Error:', syncResult.error);
    } else {
        console.log('   ✅ Status:', syncResult.status);
        try {
            const json = JSON.parse(syncResult.data);
            console.log('\n   Pipeline Result:');
            console.log('   ', JSON.stringify(json, null, 2).substring(0, 1500));
        } catch (e) {
            console.log('   Response:', syncResult.data.substring(0, 500));
        }
    }
    
    console.log('\n' + '═'.repeat(60));
}

main();
