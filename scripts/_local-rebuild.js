require('dotenv').config();
const { rebuildFinalOutputs } = require('../backend/services/aiPipeline');

async function main() {
    console.log('Running local rebuild against production DB...\n');
    try {
        const result = await rebuildFinalOutputs({ triggerSource: 'local_debug' });
        console.log('\n=== REBUILD RESULT ===');
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Rebuild failed:', err.message);
        console.error(err.stack);
    }
    process.exit(0);
}

main();
