/**
 * Debug Groq API to find the 400 error
 */

require('dotenv').config();
const axios = require('axios');

const GROQ_KEY = process.env.GROQ_API_KEY || process.env.GROQ_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function testGroq() {
    console.log('Testing Groq API...\n');
    console.log(`API Key: ${GROQ_KEY ? GROQ_KEY.substring(0, 10) + '...' : 'NOT SET'} (${GROQ_KEY ? GROQ_KEY.length : 0} chars)`);
    
    // First, list available models
    console.log('\n1. Listing available models...');
    try {
        const modelsRes = await axios.get('https://api.groq.com/openai/v1/models', {
            headers: { 'Authorization': `Bearer ${GROQ_KEY}` }
        });
        const models = modelsRes.data?.data || [];
        console.log(`   Found ${models.length} models:`);
        models.slice(0, 5).forEach(m => console.log(`   - ${m.id}`));
    } catch (err) {
        console.log(`   Error listing models: ${err.response?.status} ${err.response?.statusText}`);
        console.log(`   Error data:`, err.response?.data);
    }

    // Test with different models
    const testModels = [
        'llama-3.2-3b-preview',
        'llama-3.2-1b-preview', 
        'llama3-8b-8192',
        'mixtral-8x7b-32768',
        'gemma-7b-it'
    ];

    console.log('\n2. Testing chat completions with different models...');
    
    for (const model of testModels) {
        try {
            console.log(`\n   Testing model: ${model}`);
            const response = await axios.post(GROQ_URL, {
                model: model,
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: 'Say "hello" in JSON format: {"message": "hello"}' }
                ],
                temperature: 0.7,
                max_tokens: 100,
                response_format: { type: 'json_object' }
            }, {
                headers: {
                    'Authorization': `Bearer ${GROQ_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            
            console.log(`   ✓ SUCCESS - Model ${model} works!`);
            console.log(`   Response: ${response.data?.choices?.[0]?.message?.content}`);
            break; // Stop on first success
        } catch (err) {
            console.log(`   ✗ FAILED: ${err.response?.status} ${err.response?.statusText}`);
            if (err.response?.data?.error) {
                console.log(`   Error: ${err.response.data.error.message || err.response.data.error}`);
            }
        }
    }
}

testGroq().catch(console.error);
