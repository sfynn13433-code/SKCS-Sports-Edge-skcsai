'use strict';

const { createClient } = require('@supabase/supabase-js');
const config = require('../backend/config');

// Initialize Supabase using project config
const supabaseUrl = config.supabase?.url || process.env.SUPABASE_URL || '';
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || config.supabase?.anonKey || '').trim();
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in your environment.');
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
});

const args = process.argv.slice(2);
const sportArgIndex = args.indexOf('--sport');
const targetSport = sportArgIndex !== -1 ? args[sportArgIndex + 1].toLowerCase() : 'football';

const stage3Table = `${targetSport}_stage_3_gatekeeper`;
const canonicalTable = `${targetSport}_canonical_events`;

// Note: If you have a real AI provider configured (like Groq/OpenAI), import it here.
// For this test, we will simulate the AI's response to ensure database plumbing works perfectly.

// Map final_confidence to risk_tier enum values (matching Master Rulebook v2 thresholds)
function resolveRiskTier(confidence) {
    if (confidence >= 75) return 'HIGH_CONFIDENCE';
    if (confidence >= 55) return 'MODERATE_RISK';
    if (confidence >= 30) return 'HIGH_RISK';
    return 'EXTREME_RISK';
}

async function runEdgeMindJudge() {
    console.log(`🧠 Waking up EdgeMind (The Judge) [${targetSport.toUpperCase()}]...`);

    // 1. Fetch matches sitting in Stage 3 that need AI analysis
    const { data: stage3Matches, error: fetchError } = await supabase
        .from(stage3Table)
        .select('*')
        .limit(5); // Process in small batches

    if (fetchError || !stage3Matches || stage3Matches.length === 0) {
        console.error("❌ No Stage 3 matches found for EdgeMind.");
        return;
    }

    for (const match of stage3Matches) {
        // 2. Fetch the actual Team Names and Kickoff Time from canonical_events
        const { data: eventData } = await supabase
            .from(canonicalTable)
            .select('competition_name, raw_provider_data, start_time_utc')
            .eq('provider_event_id', match.fixture_id)
            .limit(1)
            .single();

        if (!eventData) {
            console.log(`⚠️ Could not find canonical event for ${match.fixture_id}. Skipping.`);
            continue;
        }

        // Parse team names from your raw JSON payload (adjust based on your API's structure)
        // Example assumes API-Football structure. Adjust if using Sportmonks/Cricbuzz.
        const raw = eventData.raw_provider_data || {};
        const homeTeam = raw?.teams?.home?.name
            || raw?.home_team || raw?.strHomeTeam
            || raw?.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home')?.team?.displayName
            || 'Home Team';
        const awayTeam = raw?.teams?.away?.name
            || raw?.away_team || raw?.strAwayTeam
            || raw?.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away')?.team?.displayName
            || 'Away Team';

        // risk_flags comes back as JSONB array from Supabase
        const riskFlags = Array.isArray(match.risk_flags) ? match.risk_flags : [];

        // -------------------------------------------------------------
        // 🗣️ THE AI PROMPT
        // This is what you actually send to Groq/OpenAI via API
        // -------------------------------------------------------------
        const aiPrompt = `
            You are SKCS EdgeMind, an elite sports intelligence analyst.
            Match: ${homeTeam} vs ${awayTeam}
            System Probability: ${match.final_confidence}% for a HOME_WIN.
            Risk Flags: ${riskFlags.join(', ')}.
            Volatility Score: ${match.volatility_score}.
            
            Write a strict, 2-sentence pre-match insight explaining this probability and highlighting the risk factors. 
            Do not guess numbers. Use the data provided.
        `;

        const riskTier = resolveRiskTier(match.final_confidence);

        console.log(`\n🤖 Sending prompt to EdgeMind for ${homeTeam} vs ${awayTeam}...`);
        let edgemind_report = "";

        // =====================================================================
        // 🧠 THE 4-TIER EDGEMIND WATERFALL MATRIX
        // Priority 1: Gemini Pro | Priority 2: Groq | Priority 3: Local | Priority 4: Template
        // =====================================================================

        const systemPrompt = `You are SKCS EdgeMind, an elite sports intelligence analyst. The system has officially classified this match as ${riskTier}. You cannot alter this classification. Write a strict, 2-sentence pre-match insight explaining this probability and highlighting the risk factors. Do not guess numbers.`;
        const userPrompt = `Match: ${homeTeam} vs ${awayTeam} | Probability: ${match.final_confidence}% for ${match.recommendation} | Risk Flags: ${riskFlags.join(', ')} | Volatility: ${match.volatility_score}`;

        try {
            // 🥇 PRIORITY 1: GOOGLE GEMINI (gemini-pro)
            console.log("   Attempting Priority 1: Google Gemini...");
            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }]
                })
            });
            if (!geminiRes.ok) throw new Error("Gemini API Error");
            const geminiData = await geminiRes.json();
            edgemind_report = geminiData.candidates[0].content.parts[0].text.replace(/\n/g, ' ').trim();
            console.log("   ✅ Success: Gemini generated the insight.");

        } catch (geminiError) {
            console.warn("   ⚠️ Gemini Failed. Falling back to Priority 2...");

            try {
                // 🥈 PRIORITY 2: GROQ (llama-3.1-8b-instant)
                console.log("   Attempting Priority 2: Groq...");
                const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({
                        model: "llama-3.1-8b-instant",
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userPrompt }
                        ],
                        max_tokens: 150
                    })
                });
                if (!groqRes.ok) throw new Error("Groq API Error");
                const groqData = await groqRes.json();
                edgemind_report = groqData.choices[0].message.content.replace(/\n/g, ' ').trim();
                console.log("   ✅ Success: Groq generated the insight.");

            } catch (groqError) {
                console.warn("   ⚠️ Groq Failed. Falling back to Priority 3...");

                try {
                    // 🥉 PRIORITY 3: LOCAL DOLPHIN/LLAMA
                    console.log("   Attempting Priority 3: Local Dolphin...");
                    const localRes = await fetch("http://localhost:11434/api/generate", {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: "dolphin-llama3",
                            prompt: `${systemPrompt}\n\n${userPrompt}`,
                            stream: false
                        })
                    });
                    if (!localRes.ok) throw new Error("Local LLM Offline or Error");
                    const localData = await localRes.json();
                    edgemind_report = localData.response.replace(/\n/g, ' ').trim();
                    console.log("   ✅ Success: Local Dolphin generated the insight.");

                } catch (localError) {
                    console.warn("   🚨 All AI APIs Offline. Falling back to Priority 4...");

                    // 🏁 PRIORITY 4: TEMPLATE ENGINE (Final Fallback)
                    console.log("   Engaging Template Engine...");
                    const flagsText = riskFlags.length > 0 ? `driven heavily by ${riskFlags.join(' and ')}` : "based on standard metrics";
                    edgemind_report = `SKCS models indicate a ${match.final_confidence}% probability for ${match.recommendation.replace('_', ' ')}. However, bettors should exercise caution due to a volatility score of ${match.volatility_score}, ${flagsText}.`;
                    console.log("   ✅ Success: Template Engine deployed.");
                }
            }
        }

        // -------------------------------------------------------------
        // 🚀 PUBLISH TO LIVE FRONTEND TABLE
        // -------------------------------------------------------------
        const finalPayload = {
            fixture_id: match.fixture_id,
            sport: eventData.sport || 'Football',
            tier: 'normal',
            type: 'direct',
            market_type: '1X2',
            home_team: homeTeam,
            away_team: awayTeam,
            match_date: eventData.start_time_utc,
            prediction: 'HOME_WIN',
            recommendation: 'HOME_WIN',
            confidence: match.final_confidence,
            total_confidence: match.final_confidence,
            risk_level: match.volatility_score > 0.5 ? 'medium' : 'safe', // Gatekeeper logic
            risk_tier: riskTier,
            edgemind_report: edgemind_report,
            matches: [{ home_team: homeTeam, away_team: awayTeam, fixture_id: match.fixture_id, match_date: eventData.start_time_utc, prediction: 'HOME_WIN', recommendation: 'HOME_WIN', confidence: match.final_confidence, market: '1X2' }],
            plan_visibility: ["free", "premium", "pro"],
            secondary_insights: [],
            secondary_markets: [],
            created_at: new Date().toISOString()
        };

        const { error: publishError } = await supabase
            .from('direct1x2_prediction_final')
            .insert(finalPayload);

        if (publishError) {
            console.error(`❌ Failed to publish ${match.fixture_id}:`, publishError.message);
        } else {
            console.log(`✅ PUBLISHED: ${homeTeam} vs ${awayTeam} is now LIVE on SKCS Sports Edge!`);
        }
    }
    
    console.log("\n🏁 EdgeMind Handover Complete.");
}

runEdgeMindJudge().catch(console.error);
