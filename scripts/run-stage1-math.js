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

async function generateBaseProbabilities() {
    console.log("🧮 Waking up Math Engine: Stage 1...");

    // 1. THE FIX: Catch ALL variations of "Upcoming" from different providers
    const upcomingStatuses = ['Not Started', 'NS', 'SCHEDULED', 'TIMED'];

    const { data: fixtures, error: fetchError } = await supabase
        .from('canonical_events')
        .select('provider_event_id, sport, competition_name, start_time_utc, status')
        .in('status', upcomingStatuses)
        .not('provider_event_id', 'is', null)
        .limit(10); // Process 10 at a time for safety

    if (fetchError) {
        console.error("❌ Error fetching canonical events:", fetchError);
        return;
    }

    if (!fixtures || fixtures.length === 0) {
        console.log("⏸️ No new upcoming fixtures to process for Stage 1.");
        return;
    }

    console.log(`✅ Found ${fixtures.length} upcoming matches. Processing math...`);

    // 2. Loop through and calculate the base math
    for (const match of fixtures) {
        
        // -------------------------------------------------------------
        // 🧠 BASE MATHEMATICAL PROBABILITY
        // (Hardcoded baseline for this test. Later, this queries Team Strength)
        // -------------------------------------------------------------
        const baseHomeProb = 45.0; 
        const baseDrawProb = 25.0;
        const baseAwayProb = 30.0;
        
        // Pick the highest probability as the baseline recommendation
        const confidence = Math.max(baseHomeProb, baseDrawProb, baseAwayProb);
        let recommendation = 'DRAW';
        if (confidence === baseHomeProb) recommendation = 'HOME_WIN';
        if (confidence === baseAwayProb) recommendation = 'AWAY_WIN';

        // 3. Prepare the payload for predictions_stage_1
        const stage1Payload = {
            fixture_id: match.provider_event_id, // This is now safely TEXT!
            sport: match.sport,
            market_type: '1X2',
            recommendation: recommendation,
            confidence: confidence, 
            baseline_probability: confidence,
            implied_odds: parseFloat((100 / confidence).toFixed(2)), 
            risk_level: 'medium',
            created_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
            .from('predictions_stage_1')
            .upsert(stage1Payload, { onConflict: 'fixture_id' }); // Prevent duplicates

        if (insertError) {
            console.error(`❌ Failed Stage 1 for ${match.provider_event_id}:`, insertError.message);
        } else {
            console.log(`✅ Stage 1 Math complete for ${match.provider_event_id} (${match.status}) -> ${recommendation} @ ${confidence}%`);
        }
    }
    
    console.log("🏁 Stage 1 Processing Complete.");
}

generateBaseProbabilities();
