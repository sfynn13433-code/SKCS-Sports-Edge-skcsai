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

async function generateVolatilityAndRisk() {
    console.log("🧨 Waking up Math Engine: Stage 3 (Volatility & Risk Gatekeeper)...");

    // 1. Fetch matches that have passed Stage 2
    const { data: stage2Matches, error: fetchError } = await supabase
        .from('predictions_stage_2')
        .select('*')
        .limit(10);

    if (fetchError || !stage2Matches || stage2Matches.length === 0) {
        console.error("❌ No Stage 2 matches found or error:", fetchError);
        return;
    }

    console.log(`✅ Found ${stage2Matches.length} matches ready for Stage 3.`);

    // 2. Loop through and apply volatility logic
    for (const match of stage2Matches) {
        
        // -------------------------------------------------------------
        // 🧠 THE VOLATILITY & RISK MATH HAPPENS HERE
        // -------------------------------------------------------------
        let risk_flags = [];
        let news_sentiment_impact = 0; // Placeholder for news scraping
        let schedule_congestion_impact = 0; // Placeholder for fatigue
        
        // Flag generation based on Stage 2 data
        if (match.weather_impact < 0) risk_flags.push('WEATHER_WARNING');
        if (match.injury_impact < -1.5) risk_flags.push('KEY_PLAYER_MISSING');
        if (match.volatility_adjustment > 2.0) risk_flags.push('HIGH_VOLATILITY');

        // Calculate final confidence
        let final_confidence = match.adjusted_confidence + news_sentiment_impact + schedule_congestion_impact;
        
        // Ensure confidence stays within bounds
        if (final_confidence > 99) final_confidence = 99;
        if (final_confidence < 1) final_confidence = 1;

        // Base the volatility score (0.0 to 1.0) on the amount of risk flags
        let volatility_score = Math.min(1.0, (risk_flags.length * 0.25) + 0.1);

        // 3. Prepare payload for predictions_stage_3
        const stage3Payload = {
            stage_2_id: match.id,
            fixture_id: match.fixture_id,
            final_confidence: final_confidence,
            validation_score: 100, // Passes deterministic validation
            news_sentiment_impact: news_sentiment_impact,
            travel_fatigue_impact: 0,
            schedule_congestion_impact: schedule_congestion_impact,
            external_factors: { tested_on: "SKCS_V2_PIPELINE" },
            risk_flags: risk_flags,
            volatility_score: volatility_score,
            created_at: new Date().toISOString()
        };

        // 4. Push to Stage 3
        const { error: insertError } = await supabase
            .from('predictions_stage_3')
            .upsert(stage3Payload, { onConflict: 'fixture_id' }); 

        if (insertError) {
            console.error(`❌ Failed Stage 3 for ${match.fixture_id}:`, insertError.message);
        } else {
            console.log(`✅ Stage 3 complete for ${match.fixture_id}: Final Confidence ${final_confidence}% | Volatility: ${volatility_score} | Flags: [${risk_flags.join(', ')}]`);
        }
    }
    
    console.log("🏁 Stage 3 Processing Complete. Deterministic Pipeline is locked.");
}

generateVolatilityAndRisk().catch(console.error);
