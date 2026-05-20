const https = require('https');

const host = 'skcs-sports-edge-skcsai.onrender.com';
const apiKey = 'SUMMER_SKCSAI_738913';

function post(path, body = {}) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = https.request({
            hostname: host,
            port: 443,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'Content-Length': Buffer.byteLength(data)
            },
            timeout: 600000 // 10 min
        }, (res) => {
            let chunks = '';
            res.on('data', c => chunks += c);
            res.on('end', () => {
                console.log(`[${res.statusCode}] ${path}`);
                try { console.log(JSON.stringify(JSON.parse(chunks), null, 2)); } 
                catch { console.log(chunks.slice(0, 3000)); }
                resolve(chunks);
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { console.log('Request timed out'); req.destroy(); resolve('timeout'); });
        req.write(data);
        req.end();
    });
}

async function main() {
    console.log('Triggering sync with wait=true...');
    console.log('This will take several minutes. Please wait...\n');
    await post('/api/pipeline/sync', { wait: true });

    // Check status after
    console.log('\nChecking final status...');
    const https2 = require('https');
    const statusReq = https2.get(`https://${host}/api/pipeline/status`, { headers: { 'x-api-key': apiKey } }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => console.log('Status:', d));
    });
}

main().catch(e => { console.error(e.message); process.exit(1); });
