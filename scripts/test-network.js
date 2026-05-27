const path = require('path');
const dns = require('dns');

if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function runNetworkTest() {
    console.log('🚀 Testing outbound network connection...');
    const url = 'https://v3.football.api-sports.io/fixtures?id=158169';
    const key = process.env.X_APISPORTS_KEY;

    try {
        const response = await fetch(url, { headers: { 'x-apisports-key': key } });
        const data = await response.json();

        console.log('\n📦 --- ALL RETURNED HEADERS ---');
        for (const [header, value] of response.headers.entries()) {
            console.log(`${header}: ${value}`);
        }
        console.log('--------------------------------\n');

        if (data.response && data.response.length > 0) {
            console.log(`✅ Success! Received valid match data for ID: ${data.response[0].fixture.id}`);
        } else {
            console.log('⚠️ Connected, but no match data was returned in the payload.');
        }
    } catch (error) {
        console.error('🛑 CRITICAL NETWORK ERROR:', error.message);
    }
}

runNetworkTest();
