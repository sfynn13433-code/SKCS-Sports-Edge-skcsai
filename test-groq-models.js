/**
 * Test which Groq models are actually available
 */

require('dotenv').config();
const axios = require('axios');

const GROQ_KEY = process.env.GROQ_API_KEY || process.env.GROQ_KEY;

async function testModels() {
    if (!GROQ_KEY) {
        console.log('GROQ_KEY not set!');
        return;
    }

    // Current known Groq models (as of April 2024)
    const modelsToTest = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'llama3-70b-8192',
        'llama3-8b-8192',
        'llama-3.2-11b-vision-preview',
        'llama-3.2-90b-vision-preview',
        'gemma2-9b-it',
        'deepseek-r1-distill-llama-70b',
        'qwen-2.5-32b',
        'qwen-2.5-coder-32b',
        'llama-3.1-70b-versatile',
        'llama-3.1-405b-reasoning',
    ];

    console.log('Testing Groq models...\n');
    
    for (const model of modelsToTest) {
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: model,
                messages: [
                    { role: 'user', content: 'Say "test" and nothing else.' }
                ],
                max_tokens: 10,
                temperature: 0
            }, {
                headers: {
                    'Authorization': `Bearer ${GROQ_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });
            
            console.log(`✓ ${model}: WORKING`);
        } catch (err) {
            const status = err.response?.status;
            const errorMsg = err.response?.data?.error?.message || err.message;
            if (status === 404 || errorMsg.includes('not found') || errorMsg.includes('decommissioned')) {
                console.log(`✗ ${model}: NOT AVAILABLE (${errorMsg.substring(0, 50)})`);
            } else if (status === 400) {
                console.log(`✗ ${model}: BAD REQUEST (${errorMsg.substring(0, 50)})`);
            } else {
                console.log(`? ${model}: ERROR ${status} (${errorMsg.substring(0, 50)})`);
            }
        }
    }
}

testModels().catch(console.error);
