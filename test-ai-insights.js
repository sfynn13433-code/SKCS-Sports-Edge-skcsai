/**
 * Diagnostic script to test AI insight generation
 * Checks: Groq availability, Dolphin availability, AI generation, recent predictions
 */

require('dotenv').config();
const { generateInsight, isGroqAvailable, isDolphinAvailable } = require('./backend/services/aiProvider');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

async function testAIProviders() {
    console.log('========================================');
    console.log('AI INSIGHT DIAGNOSTIC');
    console.log('========================================\n');

    // 1. Check Groq
    console.log('1. Checking Groq API...');
    const groqKey = process.env.GROQ_API_KEY || process.env.GROQ_KEY;
    console.log(`   GROQ_KEY present: ${groqKey ? 'YES' : 'NO'}`);
    if (groqKey) {
        const groqReady = await isGroqAvailable();
        console.log(`   Groq API reachable: ${groqReady ? 'YES ✓' : 'NO ✗'}`);
    }
    console.log();

    // 2. Check Dolphin
    console.log('2. Checking Dolphin server...');
    const dolphinUrl = process.env.DOLPHIN_URL || 'http://localhost:8080';
    console.log(`   DOLPHIN_URL: ${dolphinUrl}`);
    const dolphinReady = await isDolphinAvailable();
    console.log(`   Dolphin reachable: ${dolphinReady ? 'YES ✓' : 'NO ✗'}`);
    console.log();

    // 3. Test AI generation
    console.log('3. Testing AI insight generation...');
    const testParams = {
        home: 'Manchester City',
        away: 'Liverpool',
        league: 'Premier League',
        kickoff: '2024-04-20',
        market: 'Home Win',
        confidence: 75,
        formData: 'League: 38 matches, Home win rate: 65.0%',
        h2h: null,
        weather: 'Clear',
        absences: 'No major injuries'
    };

    try {
        const insight = await generateInsight(testParams);
        console.log(`   ✓ AI generation SUCCESS`);
        console.log(`   Source: ${insight?.source || (groqKey ? 'Groq' : dolphinReady ? 'Dolphin' : 'Unknown')}`);
        console.log(`   Market: ${insight?.market_name}`);
        console.log(`   Confidence: ${insight?.confidence}%`);
        console.log(`   Report length: ${insight?.edgemind_report?.length || 0} chars`);
        console.log(`   Report preview: ${insight?.edgemind_report?.substring(0, 100)}...`);
    } catch (err) {
        console.log(`   ✗ AI generation FAILED: ${err.message}`);
    }
    console.log();

    // 4. Check recent predictions
    if (SUPABASE_URL && SUPABASE_KEY) {
        console.log('4. Checking recent predictions in database...');
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        
        const { data: predictions, error } = await supabase
            .from('direct1x2_prediction_final')
            .select('id, home_team, away_team, edgemind_report, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            console.log(`   Database error: ${error.message}`);
        } else if (!predictions || predictions.length === 0) {
            console.log('   No predictions found');
        } else {
            console.log(`   Found ${predictions.length} recent predictions:\n`);
            predictions.forEach((p, i) => {
                const hasAI = p.edgemind_report && !p.edgemind_report.includes('Stage 1 Baseline');
                const isTemplate = p.edgemind_report?.includes('Stage 1 Baseline') || p.edgemind_report?.includes('On paper,') === false;
                const source = hasAI ? '🤖 AI' : isTemplate ? '📝 Template' : '❓ Unknown';
                console.log(`   ${i+1}. ${p.home_team} vs ${p.away_team}`);
                console.log(`      Source: ${source}`);
                console.log(`      Report: ${p.edgemind_report?.substring(0, 80) || 'N/A'}...\n`);
            });
        }
    } else {
        console.log('4. Skipping database check (missing Supabase credentials)');
    }

    console.log('========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log(`Groq: ${groqKey ? (await isGroqAvailable() ? '✓ Ready' : '✗ Unreachable') : '✗ No API key'}`);
    console.log(`Dolphin: ${dolphinReady ? '✓ Ready' : '✗ Unreachable'}`);
    console.log(`AI Available: ${groqKey || dolphinReady ? '✓ YES' : '✗ NO (using templates)'}`);
    console.log('========================================');
}

testAIProviders().catch(console.error);
