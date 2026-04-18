require('dotenv').config();

const { runLiveSync } = require('../scripts/fetch-live-fixtures');

async function test() {
    console.log('=== RUNNING LIVE SYNC ===');
    try {
        const result = await runLiveSync();
        console.log('\n=== RESULT ===');
        console.log(JSON.stringify(result, null, 2));
    } catch(e) {
        console.error('Error:', e.message, e.stack);
    }
    process.exit(0);
}

test();