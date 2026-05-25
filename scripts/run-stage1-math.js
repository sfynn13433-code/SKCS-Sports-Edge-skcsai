const { createClient } = require('@supabase/supabase-js');
const config = require('../backend/config');

const supabaseUrl = config.supabase?.url || process.env.SUPABASE_URL || '';
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || config.supabase?.anonKey || '').trim();
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

// 1. Get the target sport from the command line (Default to football)
const args = process.argv.slice(2);
const sportArgIndex = args.indexOf('--sport');
const targetSport = sportArgIndex !== -1 ? args[sportArgIndex + 1].toLowerCase() : 'football';

const sportRules = require('../backend/config/sportRules')[targetSport];
if (!sportRules) {
    console.error(`❌ Rules for sport '${targetSport}' not defined in sportRules.js. Exiting.`);
    process.exit(1);
}

// 2. Dynamically set the table names based on the sport
const canonicalTable = `${targetSport}_canonical_events`;
const stage1Table = `${targetSport}_stage_1_base`;

async function generateBaseProbabilities() {
    console.log(`🧮 Waking up Math Engine [${targetSport.toUpperCase()}]: Stage 1...`);

    const upcomingStatuses = ['Not Started', 'NS', 'SCHEDULED', 'TIMED'];

    // Fetch from the isolated Canonical table
    const { data: fixtures, error: fetchError } = await supabase
        .from(canonicalTable)
        .select('provider_event_id, sport, competition_name, start_time_utc, status')
        .in('status', upcomingStatuses) 
        .limit(10);

    if (fetchError || !fixtures || fixtures.length === 0) {
        console.log(`⏸️ No new upcoming fixtures to process for ${targetSport}.`);
        return;
    }

    console.log(`✅ Found ${fixtures.length} upcoming ${targetSport} matches. Processing math...`);

    for (const match of fixtures) {
        // Base Math Simulation (Will integrate real stats later)
        const baseHomeProb = 45.0 + sportRules.baseHomeAdvantage; 
        const baseDrawProb = sportRules.hasDraw ? 25.0 : 0;
        const baseAwayProb = sportRules.hasDraw ? 30.0 : 55.0; // Distribute probability if no draw
        
        const confidence = Math.max(baseHomeProb, baseDrawProb, baseAwayProb);
        let recommendation = 'AWAY_WIN';
        if (confidence === baseHomeProb) recommendation = 'HOME_WIN';
        if (confidence === baseDrawProb && sportRules.hasDraw) recommendation = 'DRAW';

        const stage1Payload = {
            fixture_id: match.provider_event_id,
            sport: match.sport,
            market_type: sportRules.hasDraw ? '1X2' : 'MONEYLINE',
            recommendation: recommendation,
            confidence: confidence, 
            baseline_probability: confidence,
            implied_odds: parseFloat((100 / confidence).toFixed(2)), 
            risk_level: 'medium',
            created_at: new Date().toISOString()
        };

        // Push to the isolated Stage 1 table
        const { error: insertError } = await supabase
            .from(stage1Table)
            .upsert(stage1Payload, { onConflict: 'fixture_id' }); 

        if (insertError) {
            console.error(`❌ Failed Stage 1 for ${match.provider_event_id}:`, insertError.message);
        } else {
            console.log(`✅ Stage 1 complete for ${match.provider_event_id} -> ${recommendation} @ ${confidence}%`);
        }
    }
}

generateBaseProbabilities().catch(console.error);
