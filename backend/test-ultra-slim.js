const axios = require('axios');

// Configuration from .env
const DOLPHIN_URL = process.env.DOLPHIN_URL || 'http://127.0.0.1:8080';
const DOLPHIN_TIMEOUT = 30000; // 30 seconds

// Ultra-slim prompts
const SYSTEM_PROMPT = "You are a quant engine. Response format: [Score 0-100] | [1-sentence analysis]. NO prose. NO pleasantries.";
const USER_PROMPT = "Event: Manchester City vs Liverpool. Odds Vel: 0.05. Inj: 2. Mom: SURGE. Predict?";

async function testUltraSlimInference() {
    console.log('=== Ultra-Slim Inference Test ===');
    console.log(`Dolphin URL: ${DOLPHIN_URL}`);
    console.log(`System Prompt: ${SYSTEM_PROMPT}`);
    console.log(`User Prompt: ${USER_PROMPT}`);
    console.log('');

    const fullPrompt = `${SYSTEM_PROMPT}\n${USER_PROMPT}`;
    
    const payload = {
        prompt: fullPrompt,
        n_predict: 40,
        temperature: 0.2,
        top_p: 0.9,
        stop: ["\n", "User:"]
    };

    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('');
    console.log('Sending request...');

    const startTime = Date.now();

    try {
        const response = await axios.post(`${DOLPHIN_URL}/completion`, payload, {
            timeout: DOLPHIN_TIMEOUT,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const endTime = Date.now();
        const inferenceTimeSeconds = (endTime - startTime) / 1000;

        console.log('');
        console.log('=== Response ===');
        console.log(`Status: ${response.status}`);
        console.log(`Inference Time: ${inferenceTimeSeconds.toFixed(2)}s`);
        
        const content = response.data?.content || '';
        const tokensPredicted = response.data?.tokens_predicted || 0;
        const timingMs = response.data?.timings?.predicted_ms || 0;

        console.log(`Tokens Predicted: ${tokensPredicted}`);
        console.log(`Timing (ms): ${timingMs}`);
        console.log('');
        console.log(`Raw Response: ${content}`);
        console.log('');

        if (inferenceTimeSeconds < 15) {
            console.log('✅ SUCCESS: Inference completed under 15 seconds!');
        } else if (inferenceTimeSeconds < 30) {
            console.log('⚠️  WARNING: Inference over 15s but under 30s');
        } else {
            console.log('❌ FAILURE: Inference exceeded 30 seconds');
        }

    } catch (error) {
        const endTime = Date.now();
        const inferenceTimeSeconds = (endTime - startTime) / 1000;
        
        console.error('');
        console.error('=== ERROR ===');
        console.error(`Inference Time: ${inferenceTimeSeconds.toFixed(2)}s`);
        console.error(`Error: ${error.message}`);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data:`, error.response.data);
        }
    }
}

// Run the test
testUltraSlimInference().catch(console.error);
