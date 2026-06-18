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

/**
 * Build accumulator with validation according to Master Rulebook
 */
router.post('/acca/build', requireSupabaseUser, async (req, res) => {
    try {
        const { prediction_ids, matches } = req.body;
        // Use a valid UUID for the admin user if needed, or null
        let userId = req.user?.id;
        if (userId === 'admin-key-user') {
            userId = '7dab62ea-8a25-42f7-9e28-032e7fa34a26'; // Mock valid UUID
        }
        
        let validPredictions = [];
        let totalRequested = 0;

        if (matches && Array.isArray(matches)) {
            totalRequested = matches.length;
            // Handle manual match selection with fallback logic
            for (const m of matches) {
                if (m.confidence >= 75) {
                    validPredictions.push({
                        id: `manual_${m.match_id}`,
                        match_id: m.match_id,
                        fixture_id: m.match_id,
                        market_type: m.market || '1x2',
                        prediction: m.prediction || 'home_win',
                        confidence: m.confidence,
                        market_tier: 1,
                        odds: m.odds || 1.85
                    });
                } else {
                    // Fallback to Tier 2 (Double Chance)
                    const fallbacks = await accaBuilder.getDoubleChanceLegs([m.match_id], 75, db);
                    if (fallbacks.length > 0) {
                        validPredictions.push({
                            ...fallbacks[0],
                            id: `fallback_${m.match_id}`,
                            fixture_id: m.match_id,
                            market_tier: 2,
                            odds: 1.45 // Standard DC odds fallback
                        });
                    } else {
                        // If no fallback, still include original but it might fail validation later
                        validPredictions.push({
                            id: `manual_low_${m.match_id}`,
                            match_id: m.match_id,
                            fixture_id: m.match_id,
                            market_type: m.market || '1x2',
                            prediction: m.prediction || 'home_win',
                            confidence: m.confidence,
                            market_tier: 1,
                            odds: m.odds || 1.85
                        });
                    }
                }
            }
        } else if (prediction_ids && Array.isArray(prediction_ids)) {
            totalRequested = prediction_ids.length;
            // Original logic for prediction_ids
            for (const predictionId of prediction_ids) {
                const validation = await validateAccaLeg(predictionId);
                if (validation.valid) {
                    validPredictions.push(validation.prediction);
                }
            }
        } else {
            return res.status(400).json({
                error: 'prediction_ids or matches array is required',
                status: 'error'
            });
        }
        
        if (validPredictions.length < 2) {
            return res.status(400).json({
                error: 'Accumulator must have at least 2 legs after validation',
                status: 'error',
                valid_count: validPredictions.length
            });
        }
        
        // Use buildAccaV2 to enforce tier diversity and duplicates
        const buildResult = accaBuilder.buildAccaV2({
            tier: 'normal',
            minSize: 2, // Allow 2-leg manual builders
            maxSize: req.body.max_legs || 12,
            candidates: validPredictions.map(p => ({
                ...p,
                market: p.market_type || p.market,
                prediction: p.prediction,
                pick: p.prediction,
                type: 'SINGLE'
            }))
        });

        if (!buildResult.ok) {
            return res.status(400).json({
                error: `ACCA Build Failed: ${buildResult.reason}`,
                status: 'error'
            });
        }

        const finalLegs = buildResult.legs;
        
        // Validate correlations between final legs
        const correlationValidation = await validateAccaCorrelations(finalLegs);
        if (!correlationValidation.valid) {
            return res.status(400).json({
                error: 'Accumulator legs contain markets with correlation > 0.5',
                status: 'correlation_conflict',
                conflicts: correlationValidation.conflicts
            });
        }
        
        // Calculate combined odds and confidence
        const accaMetrics = calculateAccaMetrics(finalLegs);
        
        // Create ACCA record
        const accaQuery = `
            INSERT INTO accas (user_id, total_confidence, combined_odds, leg_count, 
                             status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
            RETURNING id, total_confidence, combined_odds, leg_count, status, created_at
        `;
        
        const accaResult = await db.query(accaQuery, [
            userId,
            accaMetrics.averageConfidence,
            accaMetrics.combinedOdds,
            finalLegs.length
        ]);
        
        const newAcca = accaResult.rows[0];
        
        // Add legs to ACCA
        for (const leg of finalLegs) {
            const numericId = parseInt(leg.match_id);
            if (!isNaN(numericId)) {
                const legQuery = `
                    INSERT INTO acca_legs (acca_id, prediction_id, created_at)
                    VALUES ($1, $2, NOW())
                `;
                await db.query(legQuery, [newAcca.id, numericId]);
            }
        }
        
        const tierCounts = { tier1: 0, tier2: 0, tier3: 0 };
        finalLegs.forEach(leg => {
            const t = leg.market_tier || (leg.market === '1x2' || leg.market === '1X2' ? 1 : 2);
            tierCounts[`tier${t}`] = (tierCounts[`tier${t}`] || 0) + 1;
        });

        // Return complete ACCA details
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
        res.status(500).json({
            error: 'Internal server error',
            status: 'error',
            message: error.message
        });
    }
});

/**
 * Validate individual ACCA leg
 */
async function validateAccaLeg(predictionId) {
    const query = `
        SELECT dp.id, dp.fixture_id, dp.market_type, dp.prediction, dp.confidence, 
               dp.risk_tier, dp.is_published, dp.created_at,
               f.home_team, f.away_team, f.start_time_utc
        FROM direct1x2_prediction_final dp
        LEFT JOIN fixtures f ON f.id::text = dp.fixture_id::text
        WHERE dp.id = $1
    `;
    
    const result = await db.query(query, [predictionId]);
    
    if (result.rows.length === 0) {
        return {
            prediction_id: predictionId,
            valid: false,
            error: 'Prediction not found'
        };
    }
    
    const prediction = result.rows[0];
    prediction.match_id = prediction.fixture_id;
    
    if (prediction.confidence < MIN_LEG_CONFIDENCE) {
        return {
            prediction_id: predictionId,
            valid: false,
            error: `Confidence ${prediction.confidence}% is below minimum ${MIN_LEG_CONFIDENCE}%`
        };
    }
    
    return {
        prediction_id: predictionId,
        valid: true,
        prediction: {
            ...prediction,
            odds: prediction.odds || 1.85
        }
    };
}

/**
 * Validate correlations between ACCA legs
 */
async function validateAccaCorrelations(predictions) {
    const conflicts = [];
    const pairwiseChecks = [];
    let maxCorrelation = 0;
    
    for (let i = 0; i < predictions.length; i++) {
        for (let j = i + 1; j < predictions.length; j++) {
            const predA = predictions[i];
            const predB = predictions[j];
            
            const marketA = normalizeMarketKey(predA.market || predA.market_type);
            const marketB = normalizeMarketKey(predB.market || predB.market_type);
            
            const correlation = await getMarketCorrelation(marketA, marketB);
            maxCorrelation = Math.max(maxCorrelation, correlation);
            
            if (correlation > MAX_CORRELATION) {
                conflicts.push({
                    leg_a: predA.match_id,
                    market_a: marketA,
                    leg_b: predB.match_id,
                    market_b: marketB,
                    correlation
                });
            }
        }
    }
    
    return {
        valid: conflicts.length === 0,
        conflicts,
        maxCorrelation
    };
}

/**
 * Get correlation between two markets from database
 */
async function getMarketCorrelation(marketA, marketB) {
    try {
        const result = await db.query(`
            SELECT correlation 
            FROM market_correlations 
            WHERE (market_a = $1 AND market_b = $2) 
               OR (market_a = $2 AND market_b = $1)
            LIMIT 1
        `, [marketA, marketB]);
        
        return result.rows.length > 0 ? Number(result.rows[0].correlation) : 0.0;
    } catch (error) {
        return 0.0;
    }
}

/**
 * Calculate ACCA metrics
 */
function calculateAccaMetrics(predictions) {
    const averageConfidence = predictions.reduce((sum, pred) => sum + Number(pred.confidence), 0) / predictions.length;
    const combinedOdds = predictions.reduce((product, pred) => product * (Number(pred.odds) || 1.85), 1.0);
    
    return {
        averageConfidence,
        combinedOdds,
        estimatedReturn: combinedOdds,
        riskAssessment: assessAccaRisk(predictions)
    };
}

/**
 * Assess ACCA risk based on confidence distribution
 */
function assessAccaRisk(predictions) {
    const confidences = predictions.map(p => Number(p.confidence));
    const minConfidence = Math.min(...confidences);
    const maxConfidence = Math.max(...confidences);
    
    let riskLevel = 'Low';
    if (minConfidence < 75) riskLevel = 'Medium';
    if (predictions.length > 8) riskLevel = 'High';
    
    return {
        risk_level: riskLevel,
        min_confidence: minConfidence,
        max_confidence: maxConfidence
    };
}

/**
 * Normalize market key
 */
function normalizeMarketKey(market) {
    return String(market || '').trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * History and Details routes preserved
 */
router.get('/acca/history', requireSupabaseUser, async (req, res) => {
    try {
        const { limit = 10, offset = 0 } = req.query;
        const userId = req.user?.id;
        const result = await db.query(`
            SELECT id, total_confidence, combined_odds, leg_count, status, created_at
            FROM accas WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);
        res.json({ accas: result.rows });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/acca/:acca_id', requireSupabaseUser, async (req, res) => {
    try {
        const { acca_id } = req.params;
        const userId = req.user?.id;
        const accaResult = await db.query('SELECT * FROM accas WHERE id = $1 AND user_id = $2', [acca_id, userId]);
        if (accaResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        const legsResult = await db.query('SELECT * FROM acca_legs WHERE acca_id = $1', [acca_id]);
        res.json({ acca: accaResult.rows[0], legs: legsResult.rows });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;
