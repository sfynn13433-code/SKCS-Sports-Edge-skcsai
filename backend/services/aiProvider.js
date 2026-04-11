'use strict';

const axios = require('axios');

const DOLPHIN_URL = process.env.DOLPHIN_URL || 'http://localhost:8080';
const DOLPHIN_TIMEOUT = Number(process.env.DOLPHIN_TIMEOUT) || 120000; // 2 minutes for slower local models
const DOLPHIN_MAX_TOKENS = Number(process.env.DOLPHIN_MAX_TOKENS) || 512;
const DOLPHIN_TEMPERATURE = Number(process.env.DOLPHIN_TEMPERATURE) || 0.3;

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

    const userContent = `You are an expert football match analyst. Analyze the following match and predict the outcome (home_win, draw, or away_win) with a confidence percentage (50-95).

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
    try {
        // Try to find JSON in the response
        const jsonMatch = text.match(/\{[\s\S]*"prediction"[\s\S]*\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]);
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
    } catch (e) {
        console.error('[aiProvider] Failed to parse Dolphin response:', e.message);
        return null;
    }
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
    buildMatchAnalysisPrompt
};
