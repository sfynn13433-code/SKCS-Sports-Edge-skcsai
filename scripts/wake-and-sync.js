const https = require('https');

function wakeService(host) {
    return new Promise((resolve) => {
        console.log(`Waking up ${host}...`);
        const req = https.get(`https://${host}/`, (res) => {
            console.log(`Wake response: ${res.statusCode}`);
            resolve(true);
        });
        req.on('error', (e) => {
            console.log(`Wake error: ${e.message}`);
            resolve(false);
        });
        req.setTimeout(30000, () => {
            console.log('Wake timeout - service starting...');
            resolve(true);
        });
    });
}

async function triggerPipeline() {
    const host = 'skcsai.onrender.com';
    const path = '/api/pipeline/sync';
    const apiKey = process.env.SKCS_PIPELINE_KEY || process.env.SKCS_REFRESH_KEY;
    
    await wakeService(host);
    
    console.log('\nWaiting 5 seconds for service to fully wake...');
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('\nTriggering pipeline sync...');
    
    const options = {
        hostname: host,
        port: 443,
        path: path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        timeout: 180000
    };

    if (apiKey) {
        options.headers['x-api-key'] = apiKey;
    }

    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log(`\nStatus: ${res.statusCode}`);
                try {
                    const json = JSON.parse(data);
                    console.log('Response:', JSON.stringify(json, null, 2));
                } catch (e) {
                    console.log('Response:', data.substring(0, 2000));
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            console.error('Error:', e.message);
            resolve();
        });

        req.on('timeout', () => {
            console.log('Pipeline request timed out - running in background');
            req.destroy();
            resolve();
        });

        req.end();
    });
}

triggerPipeline();
