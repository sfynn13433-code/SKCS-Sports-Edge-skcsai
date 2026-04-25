/**
 * Force refresh AI insights for existing predictions
 * Run this to upgrade all template insights to AI-generated insights
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { generateInsight, isGroqAvailable } = require('./backend/services/aiProvider');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

async function refreshAIInsights() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log('❌ Missing Supabase credentials');
        return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    console.log('========================================');
    console.log('REFRESHING AI INSIGHTS');
    console.log('========================================\n');

    // Check if Groq is available
    const groqReady = await isGroqAvailable();
    console.log(`Groq API: ${groqReady ? '✓ Ready' : '✗ Not available'}`);
    if (!groqReady) {
        console.log('⚠️  Groq not available - insights will use templates');
    }
    console.log();

    // Get predictions with template insights
    const { data: predictions, error } = await supabase
        .from('direct1x2_prediction_final')
        .select('id, fixture_id, home_team, away_team, league, match_date, prediction, confidence, edgemind_report')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.log('❌ Database error:', error.message);
        return;
    }

    console.log(`Found ${predictions.length} predictions to check\n`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const p of predictions) {
        const report = p.edgemind_report || '';
        
        // Check if it's a template
        const isTemplate = 
            report.includes('Stage 2 Context: League matchup profile indicates') ||
            report.includes('validate late team news and market movement') ||
            !report ||
            report.length < 100;

        if (!isTemplate) {
            console.log(`⏭️  Skipping ${p.home_team} vs ${p.away_team} - already has AI insight`);
            skipped++;
            continue;
        }

        console.log(`🔄 Refreshing ${p.home_team} vs ${p.away_team}...`);

        try {
            // Generate new AI insight
            const aiInsight = await generateInsight({
                home: p.home_team,
                away: p.away_team,
                league: p.league,
                kickoff: p.match_date,
                market: p.prediction === 'home_win' ? 'Home Win' : p.prediction === 'draw' ? 'Draw' : 'Away Win',
                confidence: p.confidence,
                formData: `Confidence: ${p.confidence}%`,
                h2h: null,
                weather: null,
                absences: null
            });

            if (aiInsight && aiInsight.edgemind_report && !aiInsight.edgemind_report.includes('Stage 2 Context: League matchup profile')) {
                // Update in database
                const { error: updateError } = await supabase
                    .from('direct1x2_prediction_final')
                    .update({ 
                        edgemind_report: aiInsight.edgemind_report,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', p.id);

                if (updateError) {
                    console.log(`   ❌ Update failed: ${updateError.message}`);
                    failed++;
                } else {
                    console.log(`   ✓ Updated with AI insight (${aiInsight.edgemind_report.length} chars)`);
                    updated++;
                }
            } else {
                console.log(`   ⚠️  AI generation returned template/fallback`);
                failed++;
            }
        } catch (err) {
            console.log(`   ❌ Error: ${err.message}`);
            failed++;
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 100));
    }

    console.log('\n========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log(`Updated with AI insights: ${updated}`);
    console.log(`Skipped (already AI): ${skipped}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total processed: ${predictions.length}`);
    console.log('========================================');
}

refreshAIInsights().catch(console.error);
