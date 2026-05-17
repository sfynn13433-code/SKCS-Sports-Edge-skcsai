'use strict';

const express = require('express');
const { query } = require('../db');
const { rebuildFinalOutputs } = require('../services/aiPipeline');
const { requireRole } = require('../utils/auth');
const { requireSupabaseUser } = require('../middleware/supabaseJwt');
const config = require('../config');
const { getPlan, normalizePlanId } = require('../config/subscriptionPlans');
const { getPlanCapabilities, filterPredictionsForPlan, calculateDailyAllocations, getMegaAccaDailyAllocation } = require('../config/subscriptionMatrix');
const { getPredictionWindow } = require('../utils/dateNormalization');
const { areLegsCompatible } = require('../utils/marketConsistency');
const { getCardDescriptor } = require('../utils/insightEngine');
const { buildContextInsightsFromMetadata } = require('../utils/contextInsights');
const { enrichWithWeather } = require('../utils/weather');
const { enrichWithAvailability } = require('../utils/availability');
const { filterPredictionsByUsagePolicy, markFixtureUsed } = require('../utils/insightUsage');
const moment = require('moment-timezone');
const { normalizeActiveSportToken } = require('../config/activeSports');
const { getRiskColor, getRiskTierLabel } = require('../services/masterRulebookRiskClassification');

const ACTIVE_DEPLOYMENT_SPORT = 'Football';

// Enhanced prediction response structure with new intelligence fields
const decoratePredictionWithIntelligence = (prediction, intelligenceData = null) => {
    const decorated = { ...prediction };
    
    if (intelligenceData) {
        decorated.edge_data = intelligenceData.edge_data || null;
        decorated.live_momentum = intelligenceData.live_momentum || null;
        decorated.intelligence_sources = intelligenceData.sources || [];
        decorated.last_intelligence_update = intelligenceData.news_timestamp || null;
    }
    
    return decorated;
};

const router = express.Router();

const SPORT_FILTER_MAP = {
    Football: [
        'Football',
        'football',
        'soccer',
        'soccer_epl',
        'soccer_england_efl_cup',
        'soccer_uefa_champs_league',
        'soccer_spain_la_liga',
        'soccer_germany_bundesliga',
        'soccer_italy_serie_a',
        'soccer_france_ligue_one',
        'soccer_uefa_europa_league',
        'soccer_germany_bundesliga_2',
        'soccer_italy_serie_b',
        'soccer_france_ligue_two',
        'soccer_uefa_champions_league',
        'soccer_uefa_europa_conference_league',
        'soccer_uefa_europa_conference_league_qualifiers',
        'soccer_uefa_supercup',
        'soccer_world_cup',
        'soccer_world_cup_qualifiers'
    ],
    Basketball: ['Basketball', 'basketball', 'nba', 'basketball_nba', 'basketball_euroleague'],
    NFL: ['NFL', 'nfl', 'american_football', 'americanfootball_nfl'],
    Rugby: ['Rugby', 'rugby', 'rugbyunion_international', 'rugbyunion_six_nations'],
    NHL: ['NHL', 'nhl', 'hockey', 'icehockey_nhl'],
    MLB: ['MLB', 'mlb', 'baseball', 'baseball_mlb'],
    AFL: ['AFL', 'afl', 'aussierules_afl'],
    MMA: ['MMA', 'mma', 'mma_mixed_martial_arts'],
    F1: ['F1', 'formula1'],
    Handball: ['Handball', 'handball'],
    Volleyball: ['Volleyball', 'volleyball'],
    Cricket: ['Cricket', 'cricket']
};

// Get predictions with enhanced intelligence data
router.get('/', requireSupabaseUser, async (req, res) => {
    try {
        const {
            includeAll = false,
            isAdminAudit = false
        } = req.query;
        const requestedSport = normalizeActiveSportToken(req.query?.sport || ACTIVE_DEPLOYMENT_SPORT);

        const planId = normalizePlanId(req.query?.plan_id || req.user?.plan_id || 'core_30day');
        const plan = getPlan(planId);
        const now = moment().tz('Africa/Johannesburg');

        console.log('[predictions-enhanced] Request received:', {
            planId,
            plan: plan.name,
            userTier: req.user?.plan_tier || 'unknown'
        });

        // Query predictions with intelligence data
        const { rows: predictions } = await query(`
            SELECT 
                p.*,
                pi.espn_entity_id,
                pi.headline,
                pi.description,
                pi.news_timestamp,
                pi.volatility_score,
                pi.edge_data,
                pi.live_momentum,
                pi.created_at as intelligence_created_at
            FROM predictions_filtered p
            LEFT JOIN public_intelligence pi ON p.espn_entity_id = pi.espns_entity_id
            WHERE p.sport = $1
            ORDER BY p.created_at DESC
        `, [requestedSport]);

        console.log(`[predictions-enhanced] Found ${predictions.length} predictions with intelligence data`);

        // Enrich predictions with intelligence data
        const predictionsWithIntelligence = predictions.map(prediction => {
            const intelligenceData = {
                espns_entity_id: prediction.espns_entity_id,
                headline: prediction.headline,
                description: prediction.description,
                news_timestamp: prediction.news_timestamp,
                volatility_score: prediction.volatility_score,
                edge_data: prediction.edge_data,
                live_momentum: prediction.live_momentum,
                sources: prediction.sources || [],
                last_intelligence_update: prediction.intelligence_created_at
            };
            
            return decoratePredictionWithIntelligence(prediction, intelligenceData);
        });

        const scopedWithTiming = predictionsWithIntelligence.map((prediction) => 
            decoratePredictionWithTiming(prediction, now));

        const stageCounts = {
            hydrated_rows: predictions.length,
            sport_filtered_rows: predictions.length, // sport filtered in SQL
            display_filtered_rows: predictions.length, // no extra display filter here
            upcoming_gate_rows: predictions.length,
            stale_gate_rows: predictions.length,
            window_gate_rows: predictions.length,
            scoped_rows: scopedWithTiming.length,
            plan_filtered_rows: 0,
            subscription_tier_filtered_rows: 0,
            elite_floor_rows: 0
        };

        const planFilteredPredictions = (includeAll || isAdminAudit)
            ? scopedWithTiming.slice(0, 2500)
            : filterPredictionsForPlan(
                scopedWithTiming,
                planId,
                now,
                {
                    enforceUniqueAssetWindow: false,
                    subscriptionStart: req.user?.official_start_time || null
                }
            );

        stageCounts.plan_filtered_rows = planFilteredPredictions.length;
        stageCounts.elite_floor_rows = 0; // TODO: Implement elite floor logic for enhanced predictions

        const subscriptionTierFilteredPredictions = (isAdminAudit || includeAll)
            ? planFilteredPredictions
            : planFilteredPredictions.filter((prediction) => isTierVisibleForView(prediction.tier, req.user?.access_tiers || []));

        stageCounts.subscription_tier_filtered_rows = subscriptionTierFilteredPredictions.length;

        const displayFloor = 30;
        const displayFilteredPredictions = subscriptionTierFilteredPredictions.filter((p) => {
            const t = String(p?.section_type || p?.type || '').toLowerCase();
            const conf = Number.isFinite(p?.confidence)
                ? Number(p.confidence)
                : (Number.isFinite(p?.total_confidence)
                    ? Number(p.total_confidence)
                    : (Array.isArray(p?.matches) && p.matches.length
                        ? Number(p.matches[0]?.confidence)
                        : NaN));
            if (t === 'secondary') return true;
            if (t === 'direct' || t === 'single' || !t) return !Number.isNaN(conf) ? conf >= displayFloor : true;
            return true;
        });
        stageCounts.display_filtered_rows = displayFilteredPredictions.length;

        // Apply weather and availability enrichment
        const predictionsWithWeather = await enrichWithWeather(displayFilteredPredictions);
        const predictionsEnriched = await enrichWithAvailability(predictionsWithWeather);

        const finalPredictions = predictionsEnriched.map((p) => {
            const t = String(p?.section_type || p?.type || '').toLowerCase();
            let conf = Number.isFinite(p?.confidence) ? Number(p.confidence) : NaN;
            if (!Number.isFinite(conf) && Number.isFinite(p?.total_confidence)) conf = Number(p.total_confidence);
            if (!Number.isFinite(conf) && Array.isArray(p?.matches) && p.matches.length) conf = Number(p.matches[0]?.confidence);
            const risk_label_ui = getRiskTierLabel(conf);
            const risk_color_ui = getRiskColor(conf);
            return { ...p, risk_label_ui, risk_color_ui };
        });

        const todayName = moment.tz('Africa/Johannesburg').format('dddd').toLowerCase();
        const dailyLimits = calculateDailyAllocations(planId, todayName, {
            subscriptionStart: req.user?.official_start_time || null,
            predictions: scopedWithTiming
        });

        const dropCounts = {
            sport_filter_excluded: Math.max(0, stageCounts.hydrated_rows - stageCounts.sport_filtered_rows),
            display_filter_excluded: Math.max(0, stageCounts.sport_filtered_rows - stageCounts.display_filtered_rows),
            upcoming_gate_excluded: Math.max(0, stageCounts.display_filtered_rows - stageCounts.upcoming_gate_rows),
            stale_gate_excluded: Math.max(0, stageCounts.display_filtered_rows - stageCounts.window_gate_rows),
            date_window_excluded: Math.max(0, stageCounts.display_filtered_rows - stageCounts.window_gate_rows),
            plan_filter_excluded: Math.max(0, stageCounts.scoped_rows - stageCounts.plan_filtered_rows),
            subscription_tier_excluded: Math.max(0, stageCounts.scoped_rows - stageCounts.subscription_tier_filtered_rows),
            elite_floor_excluded: Math.max(0, stageCounts.scoped_rows - stageCounts.elite_floor_rows)
        };

        // Enhanced response structure with intelligence fields
        const response = {
            plan_id: planId,
            sport: requestedSport,
            source: 'enhanced_predictions_with_intelligence',
            publish_run_source: null,
            include_all: includeAll,
            admin_audit: isAdminAudit,
            subscription_view_tier: req.user?.access_tiers || [],
            user_access_tiers: Array.isArray(req.user?.access_tiers) ? req.user.access_tiers : [],
            day: todayName,
            history_days: 30, // TODO: Make configurable
            window_days: 7,
            daily_limits: dailyLimits,
            plan_meta: {
                id: planCapabilities.plan_id,
                name: plan.name,
                tier: planCapabilities.tier,
                duration_days: planCapabilities.duration_days,
                mega_acca_allocation: planCapabilities.capabilities?.mega_acca_allocation || 0,
                mega_acca_daily_allocation: megaAccaDailyAllocation,
                mega_acca_constraints: planCapabilities.capabilities?.mega_acca_constraints || null,
                mega_acca_policy: planCapabilities.capabilities?.mega_acca_policy || null
            },
            read_path_diagnostics: {
                server_now_utc: now.toISOString(),
                server_now_sast: moment.tz(now, 'Africa/Johannesburg').format(),
                include_all: includeAll,
                gate_config: {
                    upcoming_grace_minutes: 15,
                    acca_started_lookback_hours: 6,
                    acca_window_lookback_hours: 72,
                    acca_window_lookback_hours: 168,
                    elite_confidence_floor: 75, // Enhanced predictions use higher floor
                    elite_floor_enforced: false
                },
                db_counts: {
                    predictions_with_intelligence: predictions.length,
                    predictions_enriched: predictionsEnriched.length
                },
                stage_counts: stageCounts,
                drop_counts: dropCounts
            },
            count: finalPredictions.length,
            predictions: finalPredictions
        };

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
        return res.status(200).json(response);
        
    } catch (err) {
        console.error('[predictions-enhanced] Route Error:', err);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: err.message 
        });
    }
});

module.exports = router;
