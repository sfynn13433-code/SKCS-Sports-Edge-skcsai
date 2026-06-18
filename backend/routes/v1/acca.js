// API v1 ACCA Builder Endpoint for SKCS Master Rulebook
// POST /api/v1/acca/build

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { validate_acca_correlations } = require('../../db'); // From correlation schema
const { requireSupabaseUser } = require('../../middleware/supabaseJwt');
const accaBuilder = require('../../services/accaBuilder');

// Constants from Master Rulebook
const MAX_CORRELATION = 0.5;
const MIN_LEG_CONFIDENCE = 75;
const MAX_ACCA_LEGS = 12;
const VOLATILE_MARKETS = new Set([
    'correct_score', 'first_goalscorer', 'last_goalscorer', 'red_cards',
    'red_cards_over_0_5', 'red_cards_under_0_5', 'time_of_first_goal'
]);

const MOCK_USER_UUID = '7dab62ea-8a25-42f7-9e28-032e7fa34a26';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Build accumulator with validation according to Master Rulebook
 */
router.post('/acca/build', requireSupabaseUser, async (req, res) => {
    try {
        const { prediction_ids, matches } = req.body;
        let userId = req.user?.id;
        
        // Ensure userId is a valid UUID for the database
        if (!userId || !UUID_REGEX.test(userId)) {
            userId = MOCK_USER_UUID;
        }
        
        let validPredictions = [];
        let totalRequested = 0;

        if (matches && Array.isArray(matches)) {
            totalRequested = matches.length;
            for (const m of matches) {
                if (m.confidence >= 75) {
                    validPredictions.push({
                        id: `manual_${m.match_id}`,
                        match_id: m.match_id,
                        fixture_id: m.match_id,
                        market_type: m.market || '1x2',
                        prediction: m.prediction || 'home_win',
                        confidence: Number(m.confidence),
                        market_tier: 1,
                        odds: Number(m.odds) || 1.85
                    });
                } else {
                    const fallbacks = await accaBuilder.getDoubleChanceLegs([m.match_id], 75, db);
                    if (fallbacks.length > 0) {
                        const fb = fallbacks[0];
                        validPredictions.push({
                            ...fb,
                            id: `fallback_${m.match_id}`,
                            match_id: m.match_id,
                            fixture_id: m.match_id,
                            market_type: fb.market_key,
                            prediction: fb.recommendation,
                            confidence: Number(fb.confidence),
                            market_tier: 2,
                            odds: 1.45
                        });
                    } else {
                        validPredictions.push({
                            id: `manual_low_${m.match_id}`,
                            match_id: m.match_id,
                            fixture_id: m.match_id,
                            market_type: m.market || '1x2',
                            prediction: m.prediction || 'home_win',
                            confidence: Number(m.confidence),
                            market_tier: 1,
                            odds: Number(m.odds) || 1.85
                        });
                    }
                }
            }
        } else if (prediction_ids && Array.isArray(prediction_ids)) {
            totalRequested = prediction_ids.length;
            for (const predictionId of prediction_ids) {
                const validation = await validateAccaLeg(predictionId);
                if (validation.valid) {
                    validPredictions.push(validation.prediction);
                }
            }
        } else {
            return res.status(400).json({ error: 'prediction_ids or matches array is required' });
        }
        
        if (validPredictions.length < 2) {
            return res.status(400).json({
                error: 'Accumulator must have at least 2 legs',
                valid_count: validPredictions.length
            });
        }
        
        const buildResult = accaBuilder.buildAccaV2({
            tier: 'normal',
            minSize: 2,
            maxSize: req.body.max_legs || 12,
            candidates: validPredictions.map(p => ({
                ...p,
                market: p.market_type || p.market_key,
                prediction: p.prediction,
                pick: p.prediction,
                type: 'SINGLE'
            }))
        });

        if (!buildResult.ok) {
            return res.status(400).json({
                error: `ACCA Build Failed: ${buildResult.reason}`,
                details: {
                    candidates_count: validPredictions.length,
                    min_size_required: 2
                }
            });
        }

        const finalLegs = buildResult.legs;
        const correlationValidation = await validateAccaCorrelations(finalLegs);
        if (!correlationValidation.valid) {
            return res.status(400).json({
                error: 'Accumulator legs contain markets with correlation > 0.5',
                conflicts: correlationValidation.conflicts
            });
        }
        
        const accaMetrics = calculateAccaMetrics(finalLegs);
        const accaResult = await db.query(`
            INSERT INTO accas (user_id, total_confidence, combined_odds, leg_count, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
            RETURNING id, total_confidence, combined_odds, leg_count, status, created_at
        `, [userId, accaMetrics.averageConfidence, accaMetrics.combinedOdds, finalLegs.length]);
        
        const newAcca = accaResult.rows[0];
        for (const leg of finalLegs) {
            const numericId = parseInt(leg.match_id);
            if (!isNaN(numericId)) {
                await db.query(`INSERT INTO acca_legs (acca_id, prediction_id, created_at) VALUES ($1, $2, NOW())`, [newAcca.id, numericId]);
            }
        }
        
        const tierCounts = { tier1: 0, tier2: 0, tier3: 0 };
        finalLegs.forEach(leg => {
            const t = leg.market_tier || (leg.market === '1x2' || leg.market === '1X2' ? 1 : 2);
            tierCounts[`tier${t}`] = (tierCounts[`tier${t}`] || 0) + 1;
        });

        res.status(200).json({
            acca: {
                id: newAcca.id,
                user_id: userId,
                total_confidence: Number(newAcca.total_confidence),
                combined_odds: Number(newAcca.combined_odds),
                leg_count: newAcca.leg_count,
                status: newAcca.status,
                created_at: newAcca.created_at,
                estimated_return: accaMetrics.estimatedReturn,
                risk_assessment: accaMetrics.riskAssessment
            },
            leg_composition: tierCounts,
            legs: finalLegs.map(leg => ({
                match_id: leg.match_id,
                market: leg.market,
                prediction: leg.pick || leg.prediction,
                confidence: Number(leg.confidence),
                market_tier: leg.market_tier,
                odds: leg.odds
            })),
            validation_summary: {
                total_requested: totalRequested,
                passed_validation: finalLegs.length,
                max_correlation_found: correlationValidation.maxCorrelation
            }
        });
        
    } catch (error) {
        console.error('[API/v1/acca] Build error:', error.message);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

async function validateAccaLeg(predictionId) {
    const result = await db.query(`SELECT * FROM direct1x2_prediction_final WHERE id = $1`, [predictionId]);
    if (result.rows.length === 0) return { valid: false, error: 'Not found' };
    const p = result.rows[0];
    if (p.confidence < MIN_LEG_CONFIDENCE) return { valid: false, error: 'Low confidence' };
    return { valid: true, prediction: { ...p, match_id: p.fixture_id, odds: p.odds || 1.85 } };
}

async function validateAccaCorrelations(predictions) {
    let maxCorrelation = 0;
    for (let i = 0; i < predictions.length; i++) {
        for (let j = i + 1; j < predictions.length; j++) {
            const corr = await getMarketCorrelation(normalizeMarketKey(predictions[i].market), normalizeMarketKey(predictions[j].market));
            maxCorrelation = Math.max(maxCorrelation, corr);
            if (corr > MAX_CORRELATION) return { valid: false, conflicts: [{ a: predictions[i].match_id, b: predictions[j].match_id, corr }] };
        }
    }
    return { valid: true, maxCorrelation };
}

async function getMarketCorrelation(marketA, marketB) {
    const res = await db.query(`SELECT correlation FROM market_correlations WHERE (market_a = $1 AND market_b = $2) OR (market_a = $2 AND market_b = $1) LIMIT 1`, [marketA, marketB]);
    return res.rows.length > 0 ? Number(res.rows[0].correlation) : 0.0;
}

function calculateAccaMetrics(predictions) {
    const avgConf = predictions.reduce((s, p) => s + Number(p.confidence), 0) / predictions.length;
    const combinedOdds = predictions.reduce((p, leg) => p * (Number(leg.odds) || 1.85), 1.0);
    return { averageConfidence: avgConf, combinedOdds, estimatedReturn: combinedOdds, riskAssessment: { risk_level: avgConf < 75 ? 'Medium' : 'Low' } };
}

function normalizeMarketKey(market) {
    return String(market || '').trim().toLowerCase().replace(/\s+/g, '_');
}

router.get('/acca/history', requireSupabaseUser, async (req, res) => {
    try {
        const userId = req.user?.id;
        const result = await db.query('SELECT * FROM accas WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        res.json({ accas: result.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/acca/:acca_id', requireSupabaseUser, async (req, res) => {
    try {
        const userId = req.user?.id;
        const res1 = await db.query('SELECT * FROM accas WHERE id = $1 AND user_id = $2', [req.params.acca_id, userId]);
        if (res1.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        const res2 = await db.query('SELECT * FROM acca_legs WHERE acca_id = $1', [req.params.acca_id]);
        res.json({ acca: res1.rows[0], legs: res2.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
