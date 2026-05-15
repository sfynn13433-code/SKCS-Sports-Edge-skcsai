// API v1 Predictions Endpoint with Production Logging
// GET /api/v1/matches/:match_id/predictions with comprehensive monitoring

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { selectSecondaryMarkets } = require('../../services/safeHavenSelector');
const { requireSupabaseUser } = require('../../middleware/supabaseJwt');

// Logging function for prediction requests
async function logPredictionRequest(matchId, userId, mainConfidence, mainRiskTier, fallbackUsed, secondaryCount, responseTime) {
    try {
        await db.query(`
            INSERT INTO prediction_request_log (
                match_id, user_id, main_confidence, main_risk_tier, 
                fallback_used, secondary_count, response_time_ms
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [matchId, userId, mainConfidence, mainRiskTier, fallbackUsed, secondaryCount, responseTime]);
    } catch (error) {
        console.error('Failed to log prediction request:', error.message);
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

/**
 * Get match predictions with main market and secondary insights
 * Implements Safe Haven fallback logic from Master Rulebook with comprehensive logging
 */
router.get('/matches/:match_id/predictions', requireSupabaseUser, async (req, res) => {
    const startTime = Date.now();
    const { match_id } = req.params;
    const userId = req.user?.id;
    const sessionId = req.session?.id || req.headers['x-session-id'];
    
    try {
        if (!match_id) {
            return res.status(400).json({
                error: 'match_id is required',
                status: 'error'
            });
        }

        // Get main prediction (1X2 market)
        const mainQuery = `
            SELECT id, market_type, prediction, confidence, risk_tier, 
                   edgemind_report, created_at, is_published
            FROM direct1x2_prediction_final
            WHERE id::text = $1 AND market_type = '1X2' AND is_published = true
            ORDER BY created_at DESC
            LIMIT 1
        `;
        
        const mainResult = await db.query(mainQuery, [match_id]);
        
        if (mainResult.rows.length === 0) {
            // Log failed request
            const responseTime = Date.now() - startTime;
            await logUserBehavior(userId, 'view_predictions', { 
                match_id, 
                success: false, 
                reason: 'no_predictions' 
            }, sessionId);
            
            return res.status(404).json({
                error: 'No predictions found for this match',
                status: 'not_found'
            });
        }
        
        const main = mainResult.rows[0];
        
        // Check if main confidence is too low (Extreme Risk)
        if (main.confidence < 30) {
            const responseTime = Date.now() - startTime;
            await logUserBehavior(userId, 'view_predictions', { 
                match_id, 
                success: false, 
                reason: 'extreme_risk',
                confidence: main.confidence 
            }, sessionId);
            
            return res.status(404).json({
                error: 'Main prediction confidence too low for publication',
                status: 'extreme_risk'
            });
        }
        
        // Get all market predictions for this match
        const allMarketsQuery = `
            SELECT id, market_type, prediction, confidence, risk_tier,
                   edgemind_report, created_at, is_published
            FROM direct1x2_prediction_final
            WHERE id::text = $1 AND is_published = true
            ORDER BY confidence DESC
        `;
        
        const allMarketsResult = await db.query(allMarketsQuery, [match_id]);
        const allMarkets = allMarketsResult.rows;
        
        // Select secondary markets using Safe Haven logic
        const secondarySelection = selectSecondaryMarkets(main.confidence, allMarkets);
        
        // Log prediction request
        const responseTime = Date.now() - startTime;
        await logPredictionRequest(
            match_id, 
            userId, 
            main.confidence, 
            main.risk_tier, 
            secondarySelection.safeHavenTriggered, 
            secondarySelection.secondary.length, 
            responseTime
        );
        
        // Log user behavior
        await logUserBehavior(userId, 'view_predictions', {
            match_id,
            main_confidence: main.confidence,
            main_risk_tier: main.risk_tier,
            fallback_used: secondarySelection.safeHavenTriggered,
            secondary_count: secondarySelection.secondary.length,
            success: true
        }, sessionId);
        
        // Format response
        const response = {
            match_id,
            main: {
                market: '1X2',
                prediction: main.prediction,
                confidence: Number(main.confidence),
                risk_tier: main.risk_tier,
                color: getRiskColor(main.confidence),
                edgemind_report: main.edgemind_report,
                created_at: main.created_at
            },
            secondary: secondarySelection.secondary.map(market => ({
                market: market.market_type || market.market,
                prediction: market.prediction,
                confidence: Number(market.confidence),
                risk_tier: getRiskLevel(market.confidence),
                color: getRiskColor(market.confidence),
                source: market.source || 'database'
            })),
            safe_haven_fallback_triggered: secondarySelection.safeHavenTriggered,
            fallback_message: secondarySelection.fallbackMessage,
            metadata: {
                total_markets_analyzed: allMarkets.length,
                high_confidence_secondary_count: allMarkets.filter(m => 
                    m.market_type !== '1X2' && m.confidence >= 80
                ).length,
                safe_haven_candidates_count: secondarySelection.secondary.length,
                response_time_ms: responseTime,
                user_access: {
                    user_id: userId,
                    can_view_acca: true, // Based on subscription tier
                    can_view_secondary: true
                }
            }
        };
        
        res.json(response);
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        // Log error
        await logUserBehavior(userId, 'view_predictions', {
            match_id,
            success: false,
            error: error.message,
            response_time_ms: responseTime
        }, sessionId);
        
        console.error('[API/v1/predictions] Error:', error.message);
        res.status(500).json({
            error: 'Internal server error',
            status: 'error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * Get multiple match predictions (batch endpoint) with logging
 */
router.get('/predictions/batch', requireSupabaseUser, async (req, res) => {
    const startTime = Date.now();
    const { match_ids } = req.query;
    const userId = req.user?.id;
    const sessionId = req.session?.id || req.headers['x-session-id'];
    
    try {
        if (!match_ids) {
            return res.status(400).json({
                error: 'match_ids parameter is required',
                status: 'error'
            });
        }
        
        const matchIdArray = match_ids.split(',').map(id => id.trim()).filter(id => id);
        
        if (matchIdArray.length === 0 || matchIdArray.length > 50) {
            return res.status(400).json({
                error: 'Provide between 1 and 50 match IDs',
                status: 'error'
            });
        }
        
        const results = {};
        let successCount = 0;
        let failureCount = 0;
        
        for (const matchId of matchIdArray) {
            try {
                // Get main prediction
                const mainQuery = `
                    SELECT id, market_type, prediction, confidence, risk_tier,
                           edgemind_report, created_at, is_published
                    FROM direct1x2_prediction_final
                    WHERE id::text = $1 AND market_type = '1X2' AND is_published = true
                    ORDER BY created_at DESC
                    LIMIT 1
                `;
                
                const mainResult = await db.query(mainQuery, [matchId]);
                
                if (mainResult.rows.length === 0 || mainResult.rows[0].confidence < 30) {
                    results[matchId] = { status: 'not_available' };
                    failureCount++;
                    continue;
                }
                
                const main = mainResult.rows[0];
                
                // Get all markets
                const allMarketsQuery = `
                    SELECT id, market_type, prediction, confidence, risk_tier,
                           edgemind_report, created_at, is_published
                    FROM direct1x2_prediction_final
                    WHERE id::text = $1 AND is_published = true
                    ORDER BY confidence DESC
                `;
                
                const allMarketsResult = await db.query(allMarketsQuery, [matchId]);
                const allMarkets = allMarketsResult.rows;
                
                // Select secondary markets
                const secondarySelection = selectSecondaryMarkets(main.confidence, allMarkets);
                
                results[matchId] = {
                    main: {
                        market: '1X2',
                        prediction: main.prediction,
                        confidence: Number(main.confidence),
                        risk_tier: main.risk_tier,
                        color: getRiskColor(main.confidence)
                    },
                    secondary: secondarySelection.secondary.map(market => ({
                        market: market.market_type || market.market,
                        prediction: market.prediction,
                        confidence: Number(market.confidence),
                        risk_tier: getRiskLevel(market.confidence),
                        color: getRiskColor(market.confidence)
                    })),
                    safe_haven_fallback_triggered: secondarySelection.safeHavenTriggered,
                    status: 'available'
                };
                
                successCount++;
                
            } catch (matchError) {
                console.error(`[API/v1/predictions] Error for match ${matchId}:`, matchError.message);
                results[matchId] = { status: 'error', error: 'Failed to load predictions' };
                failureCount++;
            }
        }
        
        const responseTime = Date.now() - startTime;
        
        // Log batch request
        await logUserBehavior(userId, 'view_predictions_batch', {
            match_ids: matchIdArray,
            success_count: successCount,
            failure_count: failureCount,
            response_time_ms: responseTime,
            success: true
        }, sessionId);
        
        res.json({
            results,
            summary: {
                total_requested: matchIdArray.length,
                available: successCount,
                not_available: failureCount,
                errors: 0,
                response_time_ms: responseTime
            }
        });
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        // Log batch error
        await logUserBehavior(userId, 'view_predictions_batch', {
            match_ids: match_ids?.split(',') || [],
            success: false,
            error: error.message,
            response_time_ms: responseTime
        }, sessionId);
        
        console.error('[API/v1/predictions] Batch error:', error.message);
        res.status(500).json({
            error: 'Internal server error',
            status: 'error'
        });
    }
});

/**
 * Get user's prediction history with logging
 */
router.get('/predictions/history', requireSupabaseUser, async (req, res) => {
    const startTime = Date.now();
    const { limit = 10, offset = 0 } = req.query;
    const userId = req.user?.id;
    const sessionId = req.session?.id || req.headers['x-session-id'];
    
    try {
        const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
        const offsetNum = Math.max(parseInt(offset) || 0, 0);
        
        // This would need to be implemented based on user prediction tracking
        const historyQuery = `
            SELECT dp.id, dp.match_id, dp.market_type, dp.prediction, 
                   dp.confidence, dp.risk_tier, dp.created_at,
                   f.home_team, f.away_team, f.start_time_utc
            FROM direct1x2_prediction_final dp
            LEFT JOIN fixtures f ON f.id::text = dp.match_id::text
            WHERE dp.is_published = true
            ORDER BY dp.created_at DESC
            LIMIT $1 OFFSET $2
        `;
        
        const historyResult = await db.query(historyQuery, [limitNum, offsetNum]);
        
        const responseTime = Date.now() - startTime;
        
        // Log history view
        await logUserBehavior(userId, 'view_prediction_history', {
            limit: limitNum,
            offset: offsetNum,
            results_count: historyResult.rows.length,
            response_time_ms: responseTime,
            success: true
        }, sessionId);
        
        res.json({
            predictions: historyResult.rows.map(pred => ({
                match_id: pred.match_id,
                market: pred.market_type,
                prediction: pred.prediction,
                confidence: Number(pred.confidence),
                risk_tier: pred.risk_tier,
                color: getRiskColor(pred.confidence),
                created_at: pred.created_at,
                fixture: {
                    home_team: pred.home_team,
                    away_team: pred.away_team,
                    start_time_utc: pred.start_time_utc
                }
            })),
            pagination: {
                limit: limitNum,
                offset: offsetNum,
                has_more: historyResult.rows.length === limitNum
            },
            metadata: {
                response_time_ms: responseTime
            }
        });
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        // Log history error
        await logUserBehavior(userId, 'view_prediction_history', {
            limit,
            offset,
            success: false,
            error: error.message,
            response_time_ms: responseTime
        }, sessionId);
        
        console.error('[API/v1/predictions] History error:', error.message);
        res.status(500).json({
            error: 'Internal server error',
            status: 'error'
        });
    }
});

// Helper functions
function getRiskLevel(confidence) {
    if (confidence >= 75) return 'Low Risk';
    if (confidence >= 55) return 'Medium Risk';
    if (confidence >= 30) return 'High Risk';
    return 'Extreme Risk';
}

function getRiskColor(confidence) {
    if (confidence >= 75) return 'green';
    if (confidence >= 55) return 'yellow';
    if (confidence >= 30) return 'orange';
    return 'red'; // Extreme risk (not shown)
}

module.exports = router;
