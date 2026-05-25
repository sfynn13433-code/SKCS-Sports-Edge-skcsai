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

const stage2Table = `${targetSport}_stage_2_context`;
const stage3Table = `${targetSport}_stage_3_gatekeeper`;

async function generateVolatilityAndRisk() {
    console.log(`🧨 Waking up Math Engine [${targetSport.toUpperCase()}]: Stage 3...`);

    const { data: stage2Matches, error: fetchError } = await supabase.from(stage2Table).select('*').limit(10);
    if (fetchError || !stage2Matches || stage2Matches.length === 0) return;

    for (const match of stage2Matches) {
        let risk_flags = [];
        if (match.weather_impact < 0) risk_flags.push('WEATHER_WARNING');
        if (match.injury_impact < -1.5) risk_flags.push('KEY_PLAYER_MISSING');
        if (match.volatility_adjustment > 2.0) risk_flags.push('HIGH_VOLATILITY');

        let final_confidence = Math.min(99, Math.max(1, match.adjusted_confidence));
        let volatility_score = Math.min(1.0, (risk_flags.length * 0.25) + 0.1);

        const stage3Payload = {
            stage_2_id: match.id,
            fixture_id: match.fixture_id,
            final_confidence: final_confidence,
            risk_flags: risk_flags,
            volatility_score: volatility_score,
            created_at: new Date().toISOString()
        };

        await supabase.from(stage3Table).upsert(stage3Payload, { onConflict: 'fixture_id' });
        console.log(`✅ Stage 3 complete for ${match.fixture_id}: Volatility: ${volatility_score}`);
    }
}
generateVolatilityAndRisk().catch(console.error);
