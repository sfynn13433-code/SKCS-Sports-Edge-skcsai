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
    console.log('Checking service endpoints...\n');
    
    const endpoints = [
        '/api/pipeline/status',
        '/api/pipeline/sync',
        '/api/health',
        '/api/'
    ];
    
    const services = [
        { name: 'Vercel', host: 'skcs-ai.vercel.app' },
        { name: 'Render', host: 'skcsai.onrender.com' }
    ];
    
    for (const svc of services) {
        console.log(`${svc.name} (${svc.host}):`);
        for (const endpoint of endpoints) {
            const result = await makeRequest(svc.host, endpoint);
            if (result.error) {
                console.log(`  ${endpoint}: ❌ ${result.error}`);
            } else {
                console.log(`  ${endpoint}: ${result.status}`);
            }
        }
        console.log('');
    }
    
    console.log('═'.repeat(60));
    console.log('\nNotes:');
    console.log('- 404 = Route not found (check if API is deployed)');
    console.log('- Timeout = Service may be sleeping (Render free tier)');
    console.log('- 200 = Route exists and responded');
}

main();
