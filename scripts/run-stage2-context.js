const { createClient } = require('@supabase/supabase-js');
const config = require('../backend/config');

const supabase = createClient(
    config.supabase?.url || process.env.SUPABASE_URL || '',
    (process.env.SUPABASE_SERVICE_ROLE_KEY || config.supabase?.anonKey || '').trim(),
    { auth: { persistSession: false } }
);

const args = process.argv.slice(2);
const sportArgIndex = args.indexOf('--sport');
const targetSport = sportArgIndex !== -1 ? args[sportArgIndex + 1].toLowerCase() : 'football';

const sportRules = require('../backend/config/sportRules')[targetSport];
if (!sportRules) {
    console.error(`❌ Rules for sport '${targetSport}' not defined. Exiting.`);
    process.exit(1);
}

const stage1Table = `${targetSport}_stage_1_base`;
const stage2Table = `${targetSport}_stage_2_context`;

async function generateContextualAdjustments() {
    console.log(`🌧️ Waking up Math Engine [${targetSport.toUpperCase()}]: Stage 2...`);

    const { data: stage1Matches, error: fetchError } = await supabase
        .from(stage1Table)
        .select('*')
        .limit(10);

    if (fetchError || !stage1Matches || stage1Matches.length === 0) return;

    for (const match of stage1Matches) {
        // 🧠 Dynamic Context Math
        let weather_impact = 0;
        let injury_impact = 0;
        let home_advantage_impact = sportRules.baseHomeAdvantage;

        // Only apply weather if the sport is played outdoors
        if (sportRules.weatherImpactsGame && match.recommendation === 'HOME_WIN') {
            weather_impact = -1.5;
            injury_impact = -2.0;
        }

        let confidence_adjustment = weather_impact + injury_impact + home_advantage_impact;
        let adjusted_confidence = Math.min(99, Math.max(1, match.baseline_probability + confidence_adjustment));

        const stage2Payload = {
            stage_1_id: match.id,
            fixture_id: match.fixture_id,
            adjusted_confidence: adjusted_confidence,
            confidence_adjustment: confidence_adjustment,
            weather_impact: weather_impact,
            injury_impact: injury_impact,
            home_advantage_impact: home_advantage_impact,
            volatility_adjustment: Math.abs(confidence_adjustment),
            created_at: new Date().toISOString()
        };

        await supabase.from(stage2Table).upsert(stage2Payload, { onConflict: 'fixture_id' });
        console.log(`✅ Stage 2 complete for ${match.fixture_id} -> Adjusted ${adjusted_confidence}%`);
    }
}
generateContextualAdjustments().catch(console.error);
