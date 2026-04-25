/**
 * Check recent predictions to see if any use AI insights
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

async function checkRecentPredictions() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log('Missing Supabase credentials');
        return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    console.log('========================================');
    console.log('RECENT PREDICTIONS ANALYSIS');
    console.log('========================================\n');
    
    // Get recent predictions
    const { data: predictions, error } = await supabase
        .from('direct1x2_prediction_final')
        .select('id, home_team, away_team, edgemind_report, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.log('Database error:', error.message);
        return;
    }
    
    console.log(`Found ${predictions.length} recent predictions:\n`);
    
    let aiCount = 0;
    let templateCount = 0;
    
    predictions.forEach((p, i) => {
        const report = p.edgemind_report || '';
        
        // Check if it's a template
        const isTemplate = 
            report.includes('Stage 2 Context: League matchup profile indicates') ||
            report.includes('Stage 3 Reality Check: validate late team news') ||
            report.includes('moderate volatility') ||
            report.includes('elevated volatility');
        
        // Check if it looks like AI (unique phrasing)
        const isAI = 
            report.includes('On paper,') && 
            !isTemplate &&
            report.length > 200;
        
        const source = isAI ? '🤖 AI' : isTemplate ? '📝 TEMPLATE' : '❓ UNKNOWN';
        
        if (isAI) aiCount++;
        if (isTemplate) templateCount++;
        
        console.log(`${i+1}. ${p.home_team} vs ${p.away_team}`);
        console.log(`   Created: ${p.created_at}`);
        console.log(`   Source: ${source}`);
        console.log(`   Report: ${report.substring(0, 120)}...\n`);
    });
    
    console.log('========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log(`AI insights: ${aiCount}`);
    console.log(`Template insights: ${templateCount}`);
    console.log(`Total checked: ${predictions.length}`);
    
    if (aiCount === 0) {
        console.log('\n⚠️  NO AI INSIGHTS FOUND - All are templates');
        console.log('Possible causes:');
        console.log('1. GROQ_API_KEY value is incorrect/corrupted');
        console.log('2. Code deployment is still pending');
        console.log('3. isGroqAvailable() check is failing');
        console.log('4. generateInsight() is throwing errors');
    }
}

checkRecentPredictions().catch(console.error);
