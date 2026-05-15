// API v1 ACCA Builder Endpoint with Production Logging
// POST /api/v1/acca/build with comprehensive monitoring

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { validate_acca_correlations } = require('../../db'); // From correlation schema
const { requireSupabaseUser } = require('../../middleware/supabaseJwt');

// Constants from Master Rulebook
const MAX_CORRELATION = 0.5;
const MIN_LEG_CONFIDENCE = 75;
const MAX_ACCA_LEGS = 12;
const VOLATILE_MARKETS = new Set([
    'correct_score', 'first_goalscorer', 'last_goalscorer', 'red_cards',
    'red_cards_over_0_5', 'red_cards_under_0_5', 'time_of_first_goal'
]);

// Logging function for ACCA build attempts
async function logAccaBuild(userId, legCount, status, rejectionReason, maxCorrelation, minConfidence, avgConfidence, combinedOdds, responseTime) {
    try {
        await db.query(`
            INSERT INTO acca_build_log (
                user_id, leg_count, status, rejection_reason, max_correlation_found,
                min_confidence_found, total_confidence_avg, combined_odds, response_time_ms
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [userId, legCount, status, rejectionReason, maxCorrelation, minConfidence, avgConfidence, combinedOdds, responseTime]);
    } catch (error) {
        console.error('Failed to log ACCA build:', error.message);
        // Don't fail the request if logging fails
    }
}

// Logging function for user behavior
async function logUserBehavior(userId, action, details, sessionId = null) {
    try {
        await db.query(`
            INSERT INTO user_behavior_analytics (user_id, action, action_details, session_id)
            VALUES ($1, $2, $3, $4)
        `, [userId, action, JSON.stringify(details), sessionId]);
    } catch (error) {
        console.error('Failed to log user behavior:', error.message);
        // Don't fail the request if logging fails
    }
}

// Function to update correlation usage
async function updateCorrelationUsage(marketA, marketB, correlation) {
    try {
        await db.query(`
            INSERT INTO market_correlation_usage (market_a, market_b, correlation_value, usage_count)
            VALUES ($1, $2, $3, 1)
            ON CONFLICT (market_a, market_b) 
            DO UPDATE SET 
                usage_count = market_correlation_usage.usage_count + 1,
                last_used = NOW()
        `, [marketA, marketB, correlation]);
    } catch (error) {
        console.error('Failed to update correlation usage:', error.message);
        // Don't fail the request if logging fails
    }
}

/**
 * Build accumulator with validation according to Master Rulebook
 * With comprehensive logging and monitoring
 */
router.post('/acca/build', requireSupabaseUser, async (req, res) => {
    const startTime = Date.now();
    const { prediction_ids } = req.body;
    const userId = req.user?.id;
    const sessionId = req.session?.id || req.headers['x-session-id'];
    
    try {
        if (!prediction_ids || !Array.isArray(prediction_ids)) {
            const responseTime = Date.now() - startTime;
            await logAccaBuild(userId, 0, 'rejected', 'invalid_request', null, null, null, null, responseTime);
            
            return res.status(400).json({
                error: 'prediction_ids array is required',
                status: 'error'
            });
        }
        
        if (prediction_ids.length < 2) {
            const responseTime = Date.now() - startTime;
            await logAccaBuild(userId, prediction_ids.length, 'rejected', 'too_few_legs', null, null, null, null, responseTime);
            
            return res.status(400).json({
                error: 'Accumulator must have at least 2 legs',
                status: 'error'
            });
        }
        
        if (prediction_ids.length > MAX_ACCA_LEGS) {
            const responseTime = Date.now() - startTime;
            await logAccaBuild(userId, prediction_ids.length, 'rejected', 'too_many_legs', null, null, null, null, responseTime);
            
            return res.status(400).json({
                error: `Accumulator cannot have more than ${MAX_ACCA_LEGS} legs`,
                status: 'error'
            });
        }
        
        // Validate each prediction
        const validationResults = [];
        const validPredictions = [];
        let minConfidence = null;
        let maxConfidence = null;
        
        for (const predictionId of prediction_ids) {
            try {
                const validation = await validateAccaLeg(predictionId);
                validationResults.push(validation);
                
                if (validation.valid) {
                    validPredictions.push(validation.prediction);
                    
                    // Track confidence range
                    const conf = validation.prediction.confidence;
                    if (minConfidence === null || conf < minConfidence) minConfidence = conf;
                    if (maxConfidence === null || conf > maxConfidence) maxConfidence = conf;
                }
            } catch (error) {
                validationResults.push({
                    prediction_id: predictionId,
                    valid: false,
                    error: 'Prediction not found or invalid',
                    details: error.message
                });
            }
        }
        
        // Check if all predictions are valid
        const invalidPredictions = validationResults.filter(r => !r.valid);
        if (invalidPredictions.length > 0) {
            const responseTime = Date.now() - startTime;
            await logAccaBuild(userId, prediction_ids.length, 'rejected', 'invalid_predictions', null, minConfidence, null, null, responseTime);
            
            // Log user behavior
            await logUserBehavior(userId, 'build_acca', {
                prediction_ids,
                leg_count: prediction_ids.length,
                success: false,
                reason: 'invalid_predictions',
                invalid_count: invalidPredictions.length
            }, sessionId);
            
            return res.status(400).json({
                error: 'Some predictions failed validation',
                status: 'validation_failed',
                invalid_predictions: invalidPredictions,
                valid_count: validPredictions.length,
                total_requested: prediction_ids.length
            });
        }
        
        // Validate correlations between all legs
        const correlationValidation = await validateAccaCorrelations(validPredictions);
        
        // Log correlation usage
        for (const check of correlationValidation.pairwiseChecks) {
            await updateCorrelationUsage(check.market_a, check.market_b, check.correlation);
        }
        
        if (!correlationValidation.valid) {
            const responseTime = Date.now() - startTime;
            await logAccaBuild(userId, validPredictions.length, 'rejected', 'correlation', correlationValidation.maxCorrelation, minConfidence, null, null, responseTime);
            
            // Log user behavior
            await logUserBehavior(userId, 'build_acca', {
                prediction_ids,
                leg_count: validPredictions.length,
                success: false,
                reason: 'correlation_conflict',
                max_correlation: correlationValidation.maxCorrelation,
                conflicts: correlationValidation.conflicts.length
            }, sessionId);
            
            return res.status(400).json({
                error: 'Accumulator legs contain markets with correlation > 0.5',
                status: 'correlation_conflict',
                conflicts: correlationValidation.conflicts,
                max_correlation: correlationValidation.maxCorrelation
            });
        }
        
        // Calculate combined odds and confidence
        const accaMetrics = calculateAccaMetrics(validPredictions);
        
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
            validPredictions.length
        ]);
        
        const newAcca = accaResult.rows[0];
        
        // Add legs to ACCA
        for (const prediction of validPredictions) {
            const legQuery = `
                INSERT INTO acca_legs (acca_id, prediction_id, created_at)
                VALUES ($1, $2, NOW())
            `;
            await db.query(legQuery, [newAcca.id, prediction.id]);
        }
        
        const responseTime = Date.now() - startTime;
        
        // Log successful ACCA build
        await logAccaBuild(userId, validPredictions.length, 'success', null, correlationValidation.maxCorrelation, minConfidence, accaMetrics.averageConfidence, accaMetrics.combinedOdds, responseTime);
        
        // Log user behavior
        await logUserBehavior(userId, 'build_acca', {
            acca_id: newAcca.id,
            prediction_ids,
            leg_count: validPredictions.length,
            success: true,
            total_confidence: accaMetrics.averageConfidence,
            combined_odds: accaMetrics.combinedOdds,
            max_correlation: correlationValidation.maxCorrelation,
            response_time_ms: responseTime
        }, sessionId);
        
        // Return complete ACCA details
        res.status(201).json({
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
            legs: validPredictions.map(pred => ({
                prediction_id: pred.id,
                match_id: pred.match_id,
                market: pred.market_type,
                prediction: pred.prediction,
                confidence: Number(pred.confidence),
                risk_tier: pred.risk_tier,
                odds: pred.odds,
                fixture: {
                    home_team: pred.home_team,
                    away_team: pred.away_team,
                    start_time_utc: pred.start_time_utc
                }
            })),
            validation_summary: {
                total_validated: prediction_ids.length,
                passed_validation: validPredictions.length,
                correlation_checks: correlationValidation.pairwiseChecks,
                max_correlation_found: correlationValidation.maxCorrelation,
                volatile_markets_checked: correlationValidation.volatileMarketsChecked,
                response_time_ms: responseTime
            }
        });
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        // Log unexpected error
        await logAccaBuild(userId, prediction_ids?.length || 0, 'error', 'system_error', null, null, null, null, responseTime);
        
        // Log user behavior
        await logUserBehavior(userId, 'build_acca', {
            prediction_ids,
            success: false,
            error: error.message,
            response_time_ms: responseTime
        }, sessionId);
        
        console.error('[API/v1/acca] Build error:', error.message);
        res.status(500).json({
            error: 'Internal server error',
            status: 'error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * Validate individual ACCA leg
 */
async function validateAccaLeg(predictionId) {
    const query = `
        SELECT dp.id, dp.match_id, dp.market_type, dp.prediction, dp.confidence, 
               dp.risk_tier, dp.is_published, dp.created_at,
               f.home_team, f.away_team, f.start_time_utc
        FROM direct1x2_prediction_final dp
        LEFT JOIN fixtures f ON f.id::text = dp.match_id::text
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
    
    if (minConfidence < 80) {
        riskLevel = 'Medium';
        riskFactors.push('Some legs below 80% confidence');
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
 * Get user's ACCA history with logging
 */
router.get('/acca/history', requireSupabaseUser, async (req, res) => {
    const startTime = Date.now();
    const { limit = 10, offset = 0 } = req.query;
    const userId = req.user?.id;
    const sessionId = req.session?.id || req.headers['x-session-id'];
    
    try {
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
        
        const responseTime = Date.now() - startTime;
        
        // Log history view
        await logUserBehavior(userId, 'view_acca_history', {
            limit: limitNum,
            offset: offsetNum,
            results_count: result.rows.length,
            response_time_ms: responseTime,
            success: true
        }, sessionId);
        
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
            },
            metadata: {
                response_time_ms: responseTime
            }
        });
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        // Log history error
        await logUserBehavior(userId, 'view_acca_history', {
            limit,
            offset,
            success: false,
            error: error.message,
            response_time_ms: responseTime
        }, sessionId);
        
        console.error('[API/v1/acca] History error:', error.message);
        res.status(500).json({
            error: 'Internal server error',
            status: 'error'
        });
    }
});

/**
 * Get ACCA details with legs and logging
 */
router.get('/acca/:acca_id', requireSupabaseUser, async (req, res) => {
    const startTime = Date.now();
    const { acca_id } = req.params;
    const userId = req.user?.id;
    const sessionId = req.session?.id || req.headers['x-session-id'];
    
    try {
        // Get ACCA details
        const accaQuery = `
            SELECT id, total_confidence, combined_odds, leg_count, status, 
                   created_at, updated_at
            FROM accas
            WHERE id = $1 AND user_id = $2
        `;
        
        const accaResult = await db.query(accaQuery, [acca_id, userId]);
        
        if (accaResult.rows.length === 0) {
            const responseTime = Date.now() - startTime;
            
            // Log failed access
            await logUserBehavior(userId, 'view_acca_details', {
                acca_id,
                success: false,
                reason: 'not_found',
                response_time_ms: responseTime
            }, sessionId);
            
            return res.status(404).json({
                error: 'ACCA not found',
                status: 'not_found'
            });
        }
        
        const acca = accaResult.rows[0];
        
        // Get ACCA legs
        const legsQuery = `
            SELECT al.prediction_id, dp.match_id, dp.market_type, dp.prediction, 
                   dp.confidence, dp.risk_tier, dp.created_at,
                   f.home_team, f.away_team, f.start_time_utc
            FROM acca_legs al
            JOIN direct1x2_prediction_final dp ON dp.id = al.prediction_id
            LEFT JOIN fixtures f ON f.id::text = dp.match_id::text
            WHERE al.acca_id = $1
            ORDER BY dp.confidence DESC
        `;
        
        const legsResult = await db.query(legsQuery, [acca_id]);
        
        const responseTime = Date.now() - startTime;
        
        // Log successful access
        await logUserBehavior(userId, 'view_acca_details', {
            acca_id,
            leg_count: legsResult.rows.length,
            success: true,
            response_time_ms: responseTime
        }, sessionId);
        
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
            })),
            metadata: {
                response_time_ms: responseTime
            }
        });
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        // Log error
        await logUserBehavior(userId, 'view_acca_details', {
            accca_id,
            success: false,
            error: error.message,
            response_time_ms: responseTime
        }, sessionId);
        
        console.error('[API/v1/acca] Get details error:', error.message);
        res.status(500).json({
            error: 'Internal server error',
            status: 'error'
        });
    }
});

module.exports = router;
