'use strict';

const https = require('https');

function checkUrl(url, path) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: path,
            method: 'GET',
            timeout: 15000
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, data: data.substring(0, 500) });
            });
        });
        
        req.on('error', (e) => resolve({ error: e.message }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ error: 'Timeout' });
        });
        
        req.end();
    });
}

async function main() {
    console.log('Checking deployment status...\n');
    
    // Check Render
    console.log('1. Checking Render (skcsai.onrender.com)...');
    const renderResult = await checkUrl('https://skcsai.onrender.com', '/');
    if (renderResult.error) {
        console.log('   ❌ Not responding:', renderResult.error);
    } else {
        console.log('   ✅ Status:', renderResult.status);
    }
    
    // Check pipeline status
    console.log('\n2. Checking pipeline status...');
    const pipelineResult = await checkUrl('https://skcsai.onrender.com', '/api/pipeline/status');
    if (pipelineResult.error) {
        console.log('   ❌ Not responding:', pipelineResult.error);
    } else {
        console.log('   ✅ Status:', pipelineResult.status);
        console.log('   Response:', pipelineResult.data);
    }
    
    console.log('\nNote: Render free tier spins down after 15 min of inactivity.');
    console.log('It may take 30-60 seconds to wake up.');
}

main();
