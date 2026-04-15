'use strict';

const axios = require('axios');

const DOLPHIN_URL = process.env.DOLPHIN_URL || 'http://localhost:8080';
const DOLPHIN_TIMEOUT = Number(process.env.DOLPHIN_TIMEOUT) || 120000; // 2 minutes for slower local models
const DOLPHIN_MAX_TOKENS = Number(process.env.DOLPHIN_MAX_TOKENS) || 512;
const DOLPHIN_TEMPERATURE = Number(process.env.DOLPHIN_TEMPERATURE) || 0.3;

function extractAndParseJSON(rawResponse) {
    try {
        // 1. Strip markdown code blocks if the AI included them
        let cleanedString = String(rawResponse || '').replace(/```json/gi, '').replace(/```/g, '').trim();

        // 2. Find the first '{' and the last '}' to isolate the object
        const startIndex = cleanedString.indexOf('{');
        const endIndex = cleanedString.lastIndexOf('}');

        if (startIndex === -1 || endIndex === -1) {
            throw new Error('No JSON object found in response');
        }

        const jsonString = cleanedString.substring(startIndex, endIndex + 1);

        // 3. Parse and return
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('[aiProvider] JSON Parsing Error:', error.message);
        console.error('[aiProvider] Raw String Failed:', rawResponse);
        return null; // Return null so the pipeline handles it gracefully instead of crashing
    }
}

/**
 * Build the analysis prompt for Dolphin to evaluate a football match.
 * Uses the Dolphin 3.0 / Jamba chat template format.
 */
function buildMatchAnalysisPrompt(match) {
    const {
        home_team,
        away_team,
        league,
        date,
        home_form,
        away_form,
        h2h,
        home_injuries,
        away_injuries,
        home_stats,
        away_stats,
        weather,
        odds
    } = match;

    const strictSystemCommand = 'SYSTEM COMMAND: You are a strict data processing API. You must evaluate the match data and return ONLY a valid JSON object. Do NOT include any introductory text, conversational filler, markdown formatting, or explanations outside the JSON. Your output must strictly match this exact format and nothing else: { "prediction": "home", "confidence": 85, "reasoning": "short text" }';

    const userContent = `${strictSystemCommand}

You are an expert football match analyst. Analyze the following match and predict the outcome (home_win, draw, or away_win) with a confidence percentage (50-95).

Consider ALL available data:
1. Recent form (last 5 matches)
2. Head-to-head history
3. Injuries and suspensions
4. Team statistics (goals scored/conceded, possession, etc.)
5. Weather conditions (if available)
6. Market odds (if available)

Match: ${home_team} vs ${away_team}
Competition: ${league || 'Unknown'}
Date: ${date || 'Unknown'}

${home_form ? `HOME TEAM RECENT FORM (last 5):
${home_form}` : ''}

${away_form ? `AWAY TEAM RECENT FORM (last 5):
${away_form}` : ''}

${h2h ? `HEAD-TO-HEAD (last 5 meetings):
${h2h}` : ''}

${home_injuries ? `HOME TEAM INJURIES:
${home_injuries}` : ''}

${away_injuries ? `AWAY TEAM INJURIES:
${away_injuries}` : ''}

${home_stats ? `HOME TEAM SEASON STATS:
${home_stats}` : ''}

${away_stats ? `AWAY TEAM SEASON STATS:
${away_stats}` : ''}

${weather ? `WEATHER:
${weather}` : ''}

${odds ? `MARKET ODDS:
${odds}` : ''}

Analyze step by step. Then provide your final prediction in this EXACT JSON format at the end of your response:
{"prediction":"home_win","confidence":72,"reasoning":"brief explanation"}

Only output one of: home_win, draw, away_win.`;

    // Build raw prompt using the Dolphin 3.0 chat template format
    return `<|im_start|>user
${userContent}<|im_end|>
<|im_start|>assistant
`;
}

/**
 * Parse the Dolphin response to extract the JSON prediction.
 */
function parsePredictionResponse(text) {
    const parsed = extractAndParseJSON(text);
    if (!parsed || typeof parsed !== 'object') return null;

    const predMap = {
        'home': 'home_win',
        'home win': 'home_win',
        'home_win': 'home_win',
        'draw': 'draw',
        'away': 'away_win',
        'away win': 'away_win',
        'away_win': 'away_win'
    };

    const prediction = predMap[String(parsed.prediction || '').toLowerCase().trim()] || null;
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : null;

    if (!prediction || !confidence) return null;

    return {
        prediction,
        confidence: Math.max(50, Math.min(95, confidence)),
        reasoning: parsed.reasoning || ''
    };
}

/**
 * Call Dolphin (local Llama) to analyze a match and return prediction.
 */
async function analyzeWithDolphin(match) {
    const prompt = buildMatchAnalysisPrompt(match);

    try {
        console.log(`[aiProvider] Sending request to Dolphin for ${match.home_team} vs ${match.away_team}...`);
        const response = await axios.post(`${DOLPHIN_URL}/completion`, {
            prompt,
            n_predict: DOLPHIN_MAX_TOKENS,
            temperature: DOLPHIN_TEMPERATURE,
            top_p: 0.9,
            repeat_penalty: 1.1,
            stop: ['\n\n'],
            stream: false
        }, {
            timeout: DOLPHIN_TIMEOUT
        });

        const generatedText = response.data.content || '';
        const tokensPredicted = response.data.tokens_predicted || 0;
        const timingMs = response.data.timings?.predicted_ms || 0;
        const timingPerToken = tokensPredicted > 0 ? (timingMs / tokensPredicted).toFixed(1) : 'N/A';

        console.log(`[aiProvider] Dolphin generated ${tokensPredicted} tokens in ${timingMs}ms (${timingPerToken}ms/token) for ${match.home_team} vs ${match.away_team}`);

        // Debug: log raw response
        console.log(`[aiProvider] Raw Dolphin response (first 500 chars):`, generatedText.substring(0, 500));

        return parsePredictionResponse(generatedText);
    } catch (error) {
        console.error(`[aiProvider] Dolphin API error:`, error.message);
        if (error.response) {
            console.error(`[aiProvider] Response:`, error.response.status, error.response.data);
        }
        return null;
    }
}

/**
 * Build the SKCS AI Betting Analyst insight prompt.
 * Generates unique, specific insights for each match.
 */
function buildInsightPrompt(params) {
    const {
        home,
        away,
        league,
        kickoff,
        market,
        confidence,
        formData,
        h2h,
        weather,
        absences
    } = params;

    const systemPrompt = `You are SKCS AI Betting Analyst. Generate a UNIQUE, specific insight for this match ONLY. Never repeat generic phrases.`;

    const userPrompt = `Match: ${home || 'TBD'} vs ${away || 'TBD'}
League: ${league || 'Unknown'}
Date: ${kickoff || 'TBD'}
Market: ${market || '1X2'}
Baseline probability: ${confidence || 70}%

Context:
${formData || 'No recent form data available'}
${h2h ? 'Head-to-head: ' + h2h : ''}
${weather ? 'Weather: ' + weather : ''}
${absences ? 'Absences: ' + absences : ''}

Rules:
- Use different wording every time
- Reference specific stats (xG, recent form, referee, wind/rain)
- End with one actionable sentence
- Max 2 sentences
Output ONLY the insight text.`;

    return `<|im_start|>system
${systemPrompt}<|im_end|>
<|im_start|>user
${userPrompt}<|im_end|>
<|im_start|>assistant
`;
}

/**
 * Generate AI insight text for a prediction.
 */
async function generateInsight(params) {
    const prompt = buildInsightPrompt(params);
    
    try {
        const response = await axios.post(`${DOLPHIN_URL}/completion`, {
            prompt,
            max_tokens: 150,
            temperature: 0.7,
            stop: ['<|im_end|>', '\n\n']
        }, { timeout: DOLPHIN_TIMEOUT });

        let insightText = response.data?.response || response.data?.choices?.[0]?.text || '';
        insightText = insightText.replace(/<\|im_end\|>/g, '').trim();
        insightText = insightText.replace(/<\|im_start\|>.*?assistant\s*/gi, '').trim();
        
        if (!insightText || insightText.length < 10) {
            console.warn('[AI Insight] Generated text too short, using fallback');
            return generateFallbackInsight(params);
        }
        
        return insightText;
    } catch (err) {
        console.error('[AI Insight] Generation failed:', err.message);
        return generateFallbackInsight(params);
    }
}

function generateFallbackInsight(params) {
    const { home, away, market, confidence } = params;
    const marketLabel = market || '1X2';
    const conf = confidence || 70;
    
    if (conf >= 80) {
        return `${home} look strong at home with high confidence. The ${marketLabel} market is favored.`;
    } else if (conf >= 60) {
        return `${home} have a moderate edge over ${away}. Consider the ${marketLabel} market.`;
    } else {
        return `This is a tight matchup between ${home} and ${away}. Proceed with caution on the ${marketLabel} market.`;
    }
}

/**
 * Check if Dolphin server is available.
 */
async function isDolphinAvailable() {
    try {
        const response = await axios.get(`${DOLPHIN_URL}/health`, { timeout: 5000 });
        return response.data?.status === 'ok';
    } catch {
        return false;
    }
}

module.exports = {
    analyzeWithDolphin,
    isDolphinAvailable,
    buildMatchAnalysisPrompt,
    buildInsightPrompt,
    generateInsight,
    extractAndParseJSON
};
