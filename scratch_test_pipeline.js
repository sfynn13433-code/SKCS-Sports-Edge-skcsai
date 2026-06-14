const { runPipelineFromConfiguredDataMode } = require('./backend/services/aiPipeline');

async function test() {
    try {
        console.log('[TEST] Running pipeline locally for Football...');
        const result = await runPipelineFromConfiguredDataMode({ specificSport: 'Football' });
        console.log('[TEST] Pipeline result:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('[TEST] Error:', err);
    } finally {
        process.exit(0);
    }
}
test();
