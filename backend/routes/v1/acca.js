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
        const userId = req.user?.id;
        
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
                error: 'Accumulator must have at least 2 legs',
                status: 'error'
            });
        }
        
        // Use buildAccaV2 to enforce tier diversity and duplicates
        const buildResult = accaBuilder.buildAccaV2({
            tier: 'normal',
            candidates: validPredictions.map(p => ({
                ...p,
                market: p.market_type,
                prediction: p.prediction,
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
            const legQuery = `
                INSERT INTO acca_legs (acca_id, prediction_id, created_at)
                VALUES ($1, $2, NOW())
            `;
            // Note: prediction_id might be a string for manual/fallback legs, 
            // ensure your schema handles it or use a mapping.
            // For now we use a placeholder or the match_id.
            await db.query(legQuery, [newAcca.id, leg.match_id]);
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
                prediction: leg.pick,
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
            status: 'error'
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
        WHERE dp.id = $1 AND dp.is_published = true
    `;
    
    const result = await db.query(query, [predictionId]);
    
    if (result.rows.length === 0) {
        return {
            prediction_id: predictionId,
            valid: false,
            error: 'Prediction not found or not published'
        };
    }
    
    const prediction = result.rows[0];
    
    // Use fixture_id for response
    prediction.match_id = prediction.fixture_id;
    
    // Check confidence threshold (>=75%)
    if (prediction.confidence < MIN_LEG_CONFIDENCE) {
        return {
            prediction_id: predictionId,
            valid: false,
            error: `Confidence ${prediction.confidence}% is below minimum ${MIN_LEG_CONFIDENCE}%`
        };
    }
    
    // Check for volatile markets
    const marketKey = normalizeMarketKey(prediction.market_type);
    if (VOLATILE_MARKETS.has(marketKey)) {
        return {
            prediction_id: predictionId,
            valid: false,
            error: `Market ${prediction.market_type} is not allowed in accumulators`
        };
    }
    
    // Check if prediction is too old (optional)
    const predictionAge = Date.now() - new Date(prediction.created_at).getTime();
    const maxAgeHours = 24; // 24 hours max age
    if (predictionAge > maxAgeHours * 60 * 60 * 1000) {
        return {
            prediction_id: predictionId,
            valid: false,
            error: 'Prediction is too old for accumulator building'
        };
    }
    
    return {
        prediction_id: predictionId,
        valid: true,
        prediction: {
            ...prediction,
            odds: prediction.odds || 1.85 // Default odds if not available
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
    
    // Check all pairwise combinations
    for (let i = 0; i < predictions.length; i++) {
        for (let j = i + 1; j < predictions.length; j++) {
            const predA = predictions[i];
            const predB = predictions[j];
            
            const marketA = normalizeMarketKey(predA.market_type);
            const marketB = normalizeMarketKey(predB.market_type);
            
            // Get correlation from database
            const correlation = await getMarketCorrelation(marketA, marketB);
            maxCorrelation = Math.max(maxCorrelation, correlation);
            
            pairwiseChecks.push({
                leg_a: predA.id,
                market_a: marketA,
                leg_b: predB.id,
                market_b: marketB,
                correlation
            });
            
            if (correlation > MAX_CORRELATION) {
                conflicts.push({
                    leg_a: predA.id,
                    market_a: marketA,
                    leg_b: predB.id,
                    market_b: marketB,
                    correlation
                });
            }
        }
    }
    
    return {
        valid: conflicts.length === 0,
        conflicts,
        maxCorrelation,
        pairwiseChecks,
        volatileMarketsChecked: predictions.length
    };
}

/**
 * Get correlation between two markets from database
 */
async function getMarketCorrelation(marketA, marketB) {
    try {
        const query = `
            SELECT correlation 
            FROM market_correlations 
            WHERE (market_a = $1 AND market_b = $2) 
               OR (market_a = $2 AND market_b = $1)
            LIMIT 1
        `;
        
        const result = await db.query(query, [marketA, marketB]);
        
        if (result.rows.length > 0) {
            return Number(result.rows[0].correlation);
        }
        
        // Default correlation for unknown market pairs
        return 0.0;
    } catch (error) {
        console.error('Error getting market correlation:', error.message);
        return 0.0;
    }
}

/**
 * Calculate ACCA metrics
 */
function calculateAccaMetrics(predictions) {
    // Average confidence
    const averageConfidence = predictions.reduce((sum, pred) => sum + pred.confidence, 0) / predictions.length;
    
    // Combined odds (simplified - would need actual odds data)
    const combinedOdds = predictions.reduce((product, pred) => {
        const odds = pred.odds || 1.85; // Default odds
        return product * odds;
    }, 1.0);
    
    // Estimated return (assuming $1 stake)
    const estimatedReturn = combinedOdds;
    
    // Risk assessment based on confidence distribution
    const riskAssessment = assessAccaRisk(predictions);
    
    return {
        averageConfidence,
        combinedOdds,
        estimatedReturn,
        riskAssessment
    };
}

/**
 * Assess ACCA risk based on confidence distribution
 */
function assessAccaRisk(predictions) {
    const confidences = predictions.map(p => p.confidence);
    const minConfidence = Math.min(...confidences);
    const maxConfidence = Math.max(...confidences);
    const confidenceSpread = maxConfidence - minConfidence;
    
    let riskLevel = 'Low';
    let riskFactors = [];
    
    if (minConfidence < 75) {
        riskLevel = 'Medium';
        riskFactors.push('Some legs below 75% confidence');
    }
    
    if (confidenceSpread > 15) {
        riskLevel = 'High';
        riskFactors.push('Large confidence spread between legs');
    }
    
    if (predictions.length > 8) {
        riskLevel = 'High';
        riskFactors.push('High number of legs increases complexity');
    }
    
    return {
        risk_level: riskLevel,
        risk_factors: riskFactors,
        confidence_spread: confidenceSpread,
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
 * Get user's ACCA history
 */
router.get('/acca/history', requireSupabaseUser, async (req, res) => {
    try {
        const { limit = 10, offset = 0 } = req.query;
        const userId = req.user?.id;
        
        const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 50);
        const offsetNum = Math.max(parseInt(offset) || 0, 0);
        
        const query = `
            SELECT a.id, a.total_confidence, a.combined_odds, a.leg_count, 
                   a.status, a.created_at, a.updated_at
            FROM accas a
            WHERE a.user_id = $1
            ORDER BY a.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        
        const result = await db.query(query, [userId, limitNum, offsetNum]);
        
        res.json({
            accas: result.rows.map(acca => ({
                id: acca.id,
                total_confidence: Number(acca.total_confidence),
                combined_odds: Number(acca.combined_odds),
                leg_count: acca.leg_count,
                status: acca.status,
                created_at: acca.created_at,
                updated_at: acca.updated_at
            })),
            pagination: {
                limit: limitNum,
                offset: offsetNum,
                has_more: result.rows.length === limitNum
            }
        });
        
    } catch (error) {
        console.error('[API/v1/acca] History error:', error.message);
        res.status(500).json({
            error: 'Internal server error',
            status: 'error'
        });
    }
});

/**
 * Get ACCA details with legs
 */
router.get('/acca/:acca_id', requireSupabaseUser, async (req, res) => {
    try {
        const { acca_id } = req.params;
        const userId = req.user?.id;
        
        // Get ACCA details
        const accaQuery = `
            SELECT id, total_confidence, combined_odds, leg_count, status, 
                   created_at, updated_at
            FROM accas
            WHERE id = $1 AND user_id = $2
        `;
        
        const accaResult = await db.query(accaQuery, [acca_id, userId]);
        
        if (accaResult.rows.length === 0) {
            return res.status(404).json({
                error: 'ACCA not found',
                status: 'not_found'
            });
        }
        
        const acca = accaResult.rows[0];
        
        // Get ACCA legs
        const legsQuery = `
            SELECT al.prediction_id, dp.fixture_id, dp.market_type, dp.prediction, 
                   dp.confidence, dp.risk_tier, dp.created_at,
                   f.home_team, f.away_team, f.start_time_utc
            FROM acca_legs al
            JOIN direct1x2_prediction_final dp ON dp.id = al.prediction_id
            LEFT JOIN fixtures f ON f.id::text = dp.fixture_id::text
            WHERE al.acca_id = $1
            ORDER BY dp.confidence DESC
        `;
        
        const legsResult = await db.query(legsQuery, [acca_id]);
        
        res.json({
            acca: {
                id: acca.id,
                total_confidence: Number(acca.total_confidence),
                combined_odds: Number(acca.combined_odds),
                leg_count: acca.leg_count,
                status: acca.status,
                created_at: acca.created_at,
                updated_at: acca.updated_at
            },
            legs: legsResult.rows.map(leg => ({
                prediction_id: leg.prediction_id,
                match_id: leg.match_id,
                market: leg.market_type,
                prediction: leg.prediction,
                confidence: Number(leg.confidence),
                risk_tier: leg.risk_tier,
                fixture: {
                    home_team: leg.home_team,
                    away_team: leg.away_team,
                    start_time_utc: leg.start_time_utc
                }
            }))
        });
        
    } catch (error) {
        console.error('[API/v1/acca] Get details error:', error.message);
        res.status(500).json({
            error: 'Internal server error',
            status: 'error'
        });
    }
});

module.exports = router;
