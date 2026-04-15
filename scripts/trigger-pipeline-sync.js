const https = require('https');

const host = 'skcsai.onrender.com';
const path = '/api/pipeline/sync';
const apiKey = process.env.SKCS_PIPELINE_KEY || process.env.SKCS_REFRESH_KEY;

console.log('Triggering pipeline sync on Render...');
console.log(`Host: ${host}`);
console.log(`Path: ${path}`);

const options = {
    hostname: host,
    port: 443,
    path: path,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 120000
};

if (apiKey) {
    options.headers['x-api-key'] = apiKey;
}

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log(`\nStatus: ${res.statusCode}`);
        try {
            const json = JSON.parse(data);
            console.log('Response:', JSON.stringify(json, null, 2));
        } catch (e) {
            console.log('Response:', data);
        }
    });
});

req.on('error', (e) => {
    console.error('Error:', e.message);
});

req.on('timeout', () => {
    console.log('Timeout - service may be sleeping. Try visiting https://skcsai.onrender.com first to wake it up.');
    req.destroy();
});

req.end();
