/**
 * aiProvider_odds_update.js - EdgeMind Prompt Update for Odds Integration
 * 
 * This file contains the updated buildInsightPrompt function that includes
 * match_context_data.odds JSONB data in the EdgeMind analysis.
 * 
 * INSTRUCTIONS: Replace the buildInsightPrompt function in aiProvider.js
 * with this updated version to enable odds-aware AI analysis.
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
        absences,
        odds  // NEW: Add odds parameter
    } = params;

    const systemPrompt = `You are SKCS EdgeMind Bot. You MUST generate a prediction AND an edgemind_report.

EDGEMIND REPORT RULES (CRITICAL):
1. Stage 1 (Baseline): State the initial probability "On paper"
2. Stage 2 (Deep Context): Explain adjustments based on team/player intelligence  
3. Stage 3 (Reality Check): Explain adjustments based on weather/news/form
4. Stage 4 (Decision Engine): State the final confidence percentage

IMPORTANT Direct 1X2 risk rules:
- 80-100%: High Confidence / Safe.
- 70-79%: Moderate Risk.
- 59-69%: High Risk. Advise user to pivot to Secondary Insights.
- 0-58%: Extreme Risk. Explicitly tell user NOT to bet direct 1X2 and use Secondary Insights instead. You MUST enforce payload with exactly 4 top Secondary Insights if confidence is 0-58%.

ODDS ANALYSIS INSTRUCTIONS:
When BOOKMAKER ODDS data is provided, analyze what Vegas/Sharp bookmakers are predicting:
- Compare their implied probabilities with your baseline analysis
- Note any significant discrepancies between your analysis and market odds
- Use odds data to validate or challenge your initial assumptions
- Mention if odds suggest value opportunities or warn about market inefficiency

Output ONLY valid JSON with this exact structure:
{
  "market_name": "Home Win",
  "confidence": 72,
  "edgemind_report": "On paper, [Team] has a 60% baseline probability... [Continue narrative following 4 stages above, incorporating odds analysis]",
  "secondary_insights": [
    {"market": "OVER 1.5 GOALS", "confidence": 85},
    {"market": "DOUBLE CHANCE - 1X", "confidence": 82},
    {"market": "UNDER 3.5 GOALS", "confidence": 78},
    {"market": "BTTS - YES", "confidence": 77}
  ]
}`;

    const userPrompt = `Generate prediction for:
Home: ${home || 'TBD'}
Away: ${away || 'TBD'}
League: ${league || 'Unknown'}
Kickoff: ${kickoff || 'TBD'}
Market: ${market || '1X2'}
Baseline probability: ${confidence || 70}%

Context Data:
${formData || 'No recent form data'}
${h2h ? 'Head-to-head: ' + h2h : ''}
${weather ? 'Weather: ' + weather : ''}
${absences ? 'Absences/Injuries: ' + absences : ''}
${odds ? 'BOOKMAKER ODDS (Vegas/Sharp predictions): ' + JSON.stringify(odds, null, 2) : ''}

Follow EDGEMIND REPORT RULES from your system prompt. Max 3 sentences for edgemind_report.`;

    return `<|im_start|>system
${systemPrompt}<|im_end|>
<|im_start|>user
${userPrompt}<|im_end|>
<|im_start|>assistant
`;
}

// Also need to update the Groq version of the function
function generateInsightWithGroq(params) {
    if (!GROQ_API_KEY) {
        throw new Error('Groq API key not configured');
    }
    
    const { odds } = params; // NEW: Extract odds parameter

    const systemPrompt = `You are SKCS EdgeMind Bot. Generate a football match prediction insight.

EDGEMIND REPORT RULES (CRITICAL):
1. Stage 1 (Baseline): State the initial probability "On paper"
2. Stage 2 (Deep Context): Explain adjustments based on team/player intelligence  
3. Stage 3 (Reality Check): Explain adjustments based on weather/news/form
4. Stage 4 (Decision Engine): State the final confidence percentage

IMPORTANT Direct 1X2 risk rules:
- 80-100%: High Confidence / Safe.
- 70-79%: Moderate Risk.
- 59-69%: High Risk. Advise user to pivot to Secondary Insights.
- 0-58%: Extreme Risk. Explicitly tell user NOT to bet direct 1X2 and use Secondary Insights instead. You MUST enforce payload with exactly 4 top Secondary Insights if confidence is 0-58%.

ODDS ANALYSIS INSTRUCTIONS:
When BOOKMAKER ODDS data is provided, analyze what Vegas/Sharp bookmakers are predicting:
- Compare their implied probabilities with your baseline analysis
- Note any significant discrepancies between your analysis and market odds
- Use odds data to validate or challenge your initial assumptions
- Mention if odds suggest value opportunities or warn about market inefficiency

Output ONLY valid JSON with this exact structure:
{
  "market_name": "Home Win",
  "confidence": 72,
  "edgemind_report": "On paper, [Team] has a 60% baseline probability... [Continue narrative following 4 stages above, incorporating odds analysis]",
  "secondary_insights": [
    {"market": "OVER 1.5 GOALS", "confidence": 85},
    {"market": "DOUBLE CHANCE - 1X", "confidence": 82},
    {"market": "UNDER 3.5 GOALS", "confidence": 78},
    {"market": "BTTS - YES", "confidence": 77}
  ]
}`;

    const userPrompt = `Generate prediction for:
Home: ${params.home || 'TBD'}
Away: ${params.away || 'TBD'}
League: ${params.league || 'Unknown'}
Kickoff: ${params.kickoff || 'TBD'}
Market: ${params.market || '1X2'}
Baseline probability: ${params.confidence || 70}%

Context Data:
${params.formData || 'No recent form data'}
${params.h2h ? 'Head-to-head: ' + params.h2h : ''}
${params.weather ? 'Weather: ' + params.weather : ''}
${params.absences ? 'Absences/Injuries: ' + params.absences : ''}
${odds ? 'BOOKMAKER ODDS (Vegas/Sharp predictions): ' + JSON.stringify(odds, null, 2) : ''}

Follow EDGEMIND REPORT RULES from your system prompt. Max 3 sentences for edgemind_report.`;

    // ... rest of the function remains the same
    // This is just the updated prompt portion
}

module.exports = {
    buildInsightPrompt: buildInsightPrompt,
    generateInsightWithGroq: generateInsightWithGroq
};
