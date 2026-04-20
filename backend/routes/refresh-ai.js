/**
 * Admin endpoint to refresh AI insights for existing predictions
 * POST /api/admin/refresh-ai-insights
 */

const express = require('express');
const router = express.Router();
const { requireRole } = require('../utils/auth');

// Create admin middleware
const requireAdmin = requireRole('admin');
const { createClient } = require('@supabase/supabase-js');
const { generateInsight, isGroqAvailable } = require('../services/aiProvider');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

// POST /api/admin/refresh-ai-insights
router.post('/refresh-ai-insights', requireAdmin, async (req, res) => {
    try {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            return res.status(500).json({ error: 'Missing Supabase credentials' });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        const limit = Math.min(parseInt(req.query.limit) || 20, 50); // Max 50 at a time
        
        console.log('[Admin] Starting AI insight refresh...');

        // Check Groq availability
        const groqReady = await isGroqAvailable();
        console.log(`[Admin] Groq available: ${groqReady}`);

        // Get predictions with template insights
        const { data: predictions, error } = await supabase
            .from('direct1x2_prediction_final')
            .select('id, fixture_id, home_team, away_team, league, match_date, prediction, confidence, edgemind_report, created_at')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[Admin] Database error:', error);
            return res.status(500).json({ error: 'Database error', details: error.message });
        }

        let updated = 0;
        let skipped = 0;
        let failed = 0;
        const results = [];

        for (const p of predictions) {
            const report = p.edgemind_report || '';
            
            // Check if it's a template (needs refresh)
            const isTemplate = 
                report.includes('Stage 2 Context: League matchup profile indicates') ||
                report.includes('validate late team news and market movement') ||
                !report ||
                report.length < 100;

            if (!isTemplate) {
                skipped++;
                continue;
            }

            try {
                // Generate new AI insight
                const marketName = p.prediction === 'home_win' ? 'Home Win' : 
                                  p.prediction === 'draw' ? 'Draw' : 'Away Win';
                
                const aiInsight = await generateInsight({
                    home: p.home_team,
                    away: p.away_team,
                    league: p.league,
                    kickoff: p.match_date,
                    market: marketName,
                    confidence: p.confidence,
                    formData: `Current confidence: ${p.confidence}%`,
                    h2h: null,
                    weather: null,
                    absences: null
                });

                // Check if we got a real AI insight (not template)
                const isAI = aiInsight?.edgemind_report && 
                            !aiInsight.edgemind_report.includes('Stage 2 Context: League matchup profile') &&
                            aiInsight.edgemind_report.length > 150;

                if (isAI) {
                    // Update in database
                    const { error: updateError } = await supabase
                        .from('direct1x2_prediction_final')
                        .update({ 
                            edgemind_report: aiInsight.edgemind_report,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', p.id);

                    if (updateError) {
                        console.error(`[Admin] Update failed for ${p.id}:`, updateError);
                        failed++;
                        results.push({ id: p.id, status: 'error', error: updateError.message });
                    } else {
                        updated++;
                        results.push({ 
                            id: p.id, 
                            status: 'updated', 
                            teams: `${p.home_team} vs ${p.away_team}`,
                            preview: aiInsight.edgemind_report.substring(0, 80)
                        });
                    }
                } else {
                    failed++;
                    results.push({ 
                        id: p.id, 
                        status: 'fallback', 
                        teams: `${p.home_team} vs ${p.away_team}`,
                        reason: 'AI returned template or empty'
                    });
                }
            } catch (err) {
                console.error(`[Admin] Error processing ${p.id}:`, err);
                failed++;
                results.push({ id: p.id, status: 'error', error: err.message });
            }

            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 200));
        }

        console.log(`[Admin] Refresh complete: ${updated} updated, ${skipped} skipped, ${failed} failed`);

        res.json({
            success: true,
            summary: {
                total: predictions.length,
                updated,
                skipped,
                failed,
                groqAvailable: groqReady
            },
            results
        });

    } catch (err) {
        console.error('[Admin] Unexpected error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

module.exports = router;
