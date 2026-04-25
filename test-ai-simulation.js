/**
 * Simulate production AI insight generation
 */

const axios = require('axios');

const GROQ_KEY = process.env.GROQ_API_KEY || process.env.GROQ_KEY;

async function testProductionSimulation() {
    console.log('========================================');
    console.log('PRODUCTION AI SIMULATION');
    console.log('========================================\n');
    
    if (!GROQ_KEY) {
        console.log('❌ No GROQ key found in environment');
        return;
    }
    
    console.log('✓ GROQ key found');
    console.log(`  Key preview: ${GROQ_KEY.substring(0, 15)}... (${GROQ_KEY.length} chars)\n`);
    
    // Test the exact prompt used in production
    const systemPrompt = `You are the SKCS EdgeMind Bot. Generate a football match prediction insight.

EDGEMIND REPORT RULES (CRITICAL):
1. Stage 1 (Baseline): State the initial probability "On paper"
2. Stage 2 (Deep Context): Explain adjustments based on team/player intelligence  
3. Stage 3 (Reality Check): Explain adjustments based on weather/news/form
4. Stage 4 (Decision Engine): State the final confidence percentage

IMPORTANT Direct 1X2 risk rules:
- 80-100%: High Confidence / Safe.
- 70-79%: Moderate Risk.
- 59-69%: High Risk. Advise user to pivot to Secondary Insights.
- 0-58%: Extreme Risk. Explicitly tell user NOT to bet direct 1X2.

Output ONLY valid JSON with this exact structure:
{
  "market_name": "Home Win",
  "confidence": 72,
  "edgemind_report": "On paper, [Team] has a 60% baseline probability... [Continue narrative following the 4 stages above]"
}`;

    const userPrompt = `Generate prediction for:
Home: Manchester City
Away: Liverpool
League: Premier League
Kickoff: 2024-04-20
Market: Home Win
Baseline probability: 75%

Context Data:
League: 38 matches, Home win rate: 65.0%

Follow the EDGEMIND REPORT RULES from your system prompt. Max 3 sentences for edgemind_report.`;

    console.log('Testing Groq API with production-style prompt...\n');
    
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama-3.1-8b-instant',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 300,
            response_format: { type: 'json_object' }
        }, {
            headers: {
                'Authorization': `Bearer ${GROQ_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        
        const content = response.data?.choices?.[0]?.message?.content || '';
        console.log('✓ Groq API responded successfully\n');
        console.log('Raw response:');
        console.log(content);
        console.log('\n--- Parsed JSON ---');
        try {
            const parsed = JSON.parse(content);
            console.log(`market_name: ${parsed.market_name}`);
            console.log(`confidence: ${parsed.confidence}`);
            console.log(`edgemind_report: ${parsed.edgemind_report?.substring(0, 150)}...`);
            
            // Check if it looks like a template
            const isTemplate = 
                parsed.edgemind_report?.includes('League matchup profile') ||
                parsed.edgemind_report?.includes('validate late team news');
            
            console.log(`\nIs template? ${isTemplate ? 'YES ✗' : 'NO ✓ (Real AI insight!)'}`);
            
        } catch (e) {
            console.log('Failed to parse JSON:', e.message);
        }
        
    } catch (err) {
        console.log('❌ Groq API failed:');
        console.log(`Status: ${err.response?.status}`);
        console.log(`Error: ${err.response?.data?.error?.message || err.message}`);
    }
}

testProductionSimulation().catch(console.error);
