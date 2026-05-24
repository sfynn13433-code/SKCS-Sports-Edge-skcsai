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

async function generateContextualAdjustments() {
    console.log("🌧️ Waking up Math Engine: Stage 2 (Contextual Adjustments)...");

    // 1. Fetch matches that have passed Stage 1
    const { data: stage1Matches, error: fetchError } = await supabase
        .from('predictions_stage_1')
        .select('*')
        .limit(10); // Process in batches

    if (fetchError || !stage1Matches || stage1Matches.length === 0) {
        console.error("❌ No Stage 1 matches found or error:", fetchError);
        return;
    }

    console.log(`✅ Found ${stage1Matches.length} matches ready for Stage 2.`);

    // 2. Loop through and apply mathematical adjustments
    for (const match of stage1Matches) {
        
        // -------------------------------------------------------------
        // 🧠 THE CONTEXT MATH HAPPENS HERE
        // In production, this queries your event_weather_snapshots and event_injuries tables.
        // We simulate the variables here to test the pipeline logic.
        // -------------------------------------------------------------
        let weather_impact = 0;
        let injury_impact = 0;
        let home_advantage_impact = +2.5; // Base home advantage bump
        let confidence_adjustment = 0;

        // Simulate a heavy rain penalty if recommendation is Home Win
        if (match.recommendation === 'HOME_WIN') {
            weather_impact = -1.5; 
            injury_impact = -2.0;  // Simulate a missing key player
        }

        // Calculate total adjustment
        confidence_adjustment = weather_impact + injury_impact + home_advantage_impact;
        
        // Calculate new adjusted confidence
        let adjusted_confidence = match.baseline_probability + confidence_adjustment;
        
        // Ensure confidence stays within logical bounds (e.g., max 99%)
        if (adjusted_confidence > 99) adjusted_confidence = 99;
        if (adjusted_confidence < 1) adjusted_confidence = 1;

        // 3. Prepare payload for predictions_stage_2
        const stage2Payload = {
            stage_1_id: match.id,
            fixture_id: match.fixture_id,
            adjusted_confidence: adjusted_confidence,
            confidence_adjustment: confidence_adjustment,
            team_form_impact: 0, // Placeholder for form script
            injury_impact: injury_impact,
            suspension_impact: 0, 
            home_advantage_impact: home_advantage_impact,
            weather_impact: weather_impact,
            volatility_adjustment: Math.abs(confidence_adjustment), // High adjustments = higher volatility
            created_at: new Date().toISOString()
        };

        // 4. Push to Stage 2
        const { error: insertError } = await supabase
            .from('predictions_stage_2')
            .upsert(stage2Payload, { onConflict: 'fixture_id' }); 

        if (insertError) {
            console.error(`❌ Failed Stage 2 for ${match.fixture_id}:`, insertError.message);
        } else {
            console.log(`✅ Stage 2 complete for ${match.fixture_id}: Base ${match.baseline_probability}% -> Adjusted ${adjusted_confidence}% (Net: ${confidence_adjustment})`);
        }
    }
    
    console.log("🏁 Stage 2 Processing Complete.");
}

generateContextualAdjustments().catch(console.error);
