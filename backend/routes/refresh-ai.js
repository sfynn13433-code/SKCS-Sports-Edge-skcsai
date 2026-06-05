/**
 * Admin endpoint to refresh AI insights for existing predictions
 * POST /api/admin/refresh-ai-insights
 */

const express = require('express');
const router = express.Router();
const { requireRole } = require('../utils/auth');
const { executeOperation } = require('../core/executionPipeline');

// Create admin middleware
const requireAdmin = requireRole('admin');
const { generateInsight, isGroqAvailable } = require('../services/aiProvider');
const { pool } = require('../database');

// POST /api/admin/refresh-ai-insights
router.post('/refresh-ai-insights', requireAdmin, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50); // Max 50 at a time
        
        console.log('[Admin] Starting AI insight refresh...');

        // Check Groq availability
        const groqReady = await isGroqAvailable();
        console.log(`[Admin] Groq available: ${groqReady}`);

        const refresh = await executeOperation({
            operation: 'admin.refresh-ai-insights',
            caller: 'backend/routes/refresh-ai.js',
            payload: { limit, groqReady },
            execute: async () => {
                const result = await pool.query(`
                    SELECT id, fixture_id, home_team, away_team, match_date, prediction, confidence, edgemind_report, created_at
                    FROM direct1x2_prediction_final
                    ORDER BY created_at DESC
                    LIMIT $1
                `, [limit]);

                const predictions = result.rows;
                let updated = 0;
                let skipped = 0;
                let failed = 0;
                const results = [];

                for (const p of predictions) {
                    const report = p.edgemind_report || '';
                    const isTemplate = report.includes('Stage 2 Context: League matchup profile indicates')
                        || report.includes('validate late team news and market movement')
                        || !report
                        || report.length < 100;

                    if (!isTemplate) {
                        skipped++;
                        continue;
                    }

                    try {
                        const marketName = p.prediction === 'home_win' ? 'Home Win'
                            : p.prediction === 'draw' ? 'Draw' : 'Away Win';

                        const aiInsight = await generateInsight({
                            home: p.home_team,
                            away: p.away_team,
                            league: null,
                            kickoff: p.match_date,
                            market: marketName,
                            confidence: p.confidence,
                            formData: `Current confidence: ${p.confidence}%`,
                            h2h: null,
                            weather: null,
                            absences: null,
                            telemetry: {
                                pipeline_name: 'refresh-ai',
                                task_name: 'refreshInsight',
                                budget_class: 'Important',
                                knowledge_context: 'static',
                                monthly_risk: 'Medium',
                                fixture_id: p.fixture_id || p.id || null
                            }
                        });

                        const isAI = aiInsight?.edgemind_report
                            && !aiInsight.edgemind_report.includes('Stage 2 Context: League matchup profile')
                            && aiInsight.edgemind_report.length > 150;

                        if (isAI) {
                            await pool.query(`
                                UPDATE direct1x2_prediction_final 
                                SET edgemind_report = $1, updated_at = NOW()
                                WHERE id = $2
                            `, [aiInsight.edgemind_report, p.id]);
                            updated++;
                            results.push({
                                id: p.id,
                                status: 'updated',
                                teams: `${p.home_team} vs ${p.away_team}`,
                                preview: aiInsight.edgemind_report.substring(0, 80)
                            });
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

                    await new Promise((r) => setTimeout(r, 200));
                }

                console.log(`[Admin] Refresh complete: ${updated} updated, ${skipped} skipped, ${failed} failed`);
                return {
                    summary: {
                        total: predictions.length,
                        updated,
                        skipped,
                        failed,
                        groqAvailable: groqReady
                    },
                    results
                };
            }
        });

        if (refresh?.success === false) {
            return res.status(503).json({
                success: false,
                error: refresh.reason || refresh.error || 'refresh_blocked',
                traceId: refresh.traceId || refresh.trace_id || null
            });
        }
        
        res.json({
            success: true,
            summary: refresh.result.summary,
            results: refresh.result.results
        });

    } catch (err) {
        console.error('[Admin] Unexpected error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

module.exports = router;
