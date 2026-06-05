require('dotenv').config();
const { rebuildFinalOutputs } = require('../backend/services/aiPipeline');
const { executeOperation } = require('../backend/core/executionPipeline');

async function main() {
    console.log('Running local rebuild against production DB...\n');
    try {
        const result = await executeOperation({
            operation: 'script.local-rebuild',
            caller: 'scripts/_local-rebuild.js',
            payload: { triggerSource: 'local_debug' },
            execute: async () => rebuildFinalOutputs({ triggerSource: 'local_debug' })
        });
        console.log('\n=== REBUILD RESULT ===');
        console.log(JSON.stringify(result?.result || result, null, 2));
    } catch (err) {
        console.error('Rebuild failed:', err.message);
        console.error(err.stack);
    }
    process.exit(0);
}

main();
