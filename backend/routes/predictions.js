'use strict';

const express = require('express');
const { query } = require('../db');
const { rebuildFinalOutputs } = require('../services/aiPipeline');
const { requireRole } = require('../utils/auth');
const config = require('../config');
const { createClient } = require('@supabase/supabase-js');
const moment = require('moment-timezone');
const { isValidCombination } = require('../services/conflictEngine');

const { getPlanCapabilities, filterPredictionsForPlan, calculateDailyAllocations } = require('../config/subscriptionMatrix');
const { getPredictionWindow } = require('../utils/dateNormalization');
const { areLegsCompatible } = require('../utils/marketConsistency');

const router = express.Router();

const SPORT_FILTER_MAP = {
    football: [
        'football',
        'soccer_epl',
        'soccer_england_efl_cup',
        'soccer_uefa_champs_league',
        'soccer_spain_la_liga',
        'soccer_germany_bundesliga',
        'soccer_italy_serie_a',
        'soccer_france_ligue_one',
        'soccer_uefa_europa_league'
    ],
    basketball: ['basketball', 'nba', 'basketball_nba', 'basketball_euroleague'],
    nfl: ['nfl', 'american_football', 'americanfootball_nfl'],
    rugby: ['rugby', 'rugbyunion_international', 'rugbyunion_six_nations'],
    hockey: ['hockey', 'icehockey_nhl'],
    baseball: ['baseball', 'baseball_mlb'],
    afl: ['afl', 'aussierules_afl'],
    mma: ['mma', 'mma_mixed_martial_arts'],
    formula1: ['formula1'],
    handball: ['handball'],
    volleyball: ['volleyball'],
    cricket: ['cricket']
};

function startOfWeekUtc(now = new Date()) {
    const current = new Date(now);
    const day = current.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    current.setUTCDate(current.getUTCDate() + diffToMonday);
    current.setUTCHours(0, 0, 0, 0);
    return current;
}

function normalizePredictionSportKey(value) {
    const key = String(value || '').trim().toLowerCase();
    if (!key) return 'unknown';
    if (key.startsWith('soccer_')) return 'football';
    if (key.startsWith('icehockey_')) return 'hockey';
    if (key.startsWith('basketball_')) return 'basketball';
    if (key.startsWith('americanfootball_')) return 'nfl';
    if (key.startsWith('baseball_')) return 'baseball';
    if (key.startsWith('rugbyunion_')) return 'rugby';
    if (key.startsWith('aussierules_')) return 'afl';
    if (key.startsWith('mma_')) return 'mma';
    return key;
}

function getSportFilterValues(sport) {
    const key = String(sport || '').trim().toLowerCase();
    if (!key) return [];
    return SPORT_FILTER_MAP[key] || [key];
}

function predictionMatchesSport(prediction, sportFilterValues) {
    if (!Array.isArray(sportFilterValues) || sportFilterValues.length === 0) return true;
    const allowed = new Set(sportFilterValues.map(normalizePredictionSportKey));
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    if (matches.length === 0) return false;
    return matches.every((match) => allowed.has(normalizePredictionSportKey(match?.sport || '')));
}

function extractTeamNames(predictions) {
    const names = new Set();
    for (const row of predictions) {
        const matches = Array.isArray(row.matches) ? row.matches : [];
        for (const m of matches) {
            const home = m?.home_team || m?.metadata?.home_team || null;
            const away = m?.away_team || m?.metadata?.away_team || null;
            if (home && String(home).trim()) names.add(String(home).trim());
            if (away && String(away).trim()) names.add(String(away).trim());
        }
    }
    return Array.from(names);
}

function buildPlayersByTeam(rows) {
    const map = new Map();
    for (const row of rows) {
        if (!map.has(row.team_id)) map.set(row.team_id, []);
        const list = map.get(row.team_id);
        if (list.length >= 3) continue;
        list.push({
            id: row.id,
            name: row.name,
            position: row.position,
            number: row.number,
            age: row.age,
            photo: row.photo
        });
    }
    return map;
}

function formatUtcDateTime(value) {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    const day = String(parsed.getUTCDate()).padStart(2, '0');
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const year = String(parsed.getUTCFullYear()).slice(-2);
    const hours = String(parsed.getUTCHours()).padStart(2, '0');
    const minutes = String(parsed.getUTCMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function humanizeToken(value) {
    return String(value || '')
        .trim()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeMarketKey(value) {
    return String(value || '').trim().toLowerCase();
}

function humanizePredictionLabel(prediction, market) {
    const normalized = String(prediction || '').trim().toLowerCase();
    const marketKey = normalizeMarketKey(market);
    const explicit = {
        home_win: 'HOME WIN',
        away_win: 'AWAY WIN',
        draw: 'DRAW',
        over: 'OVER',
        under: 'UNDER',
        yes: 'YES',
        no: 'NO',
        '1x': 'DOUBLE CHANCE - 1X',
        x2: 'DOUBLE CHANCE - X2',
        '12': 'DOUBLE CHANCE - 12'
    };

    const goalLineMatch = marketKey.match(/^(over|under)_(\d+)_(\d+)$/);
    if (goalLineMatch) {
        return `${goalLineMatch[1].toUpperCase()} ${goalLineMatch[2]}.${goalLineMatch[3]} GOALS`;
    }
    if (marketKey === 'btts_yes') return 'BTTS - YES';
    if (marketKey === 'btts_no') return 'BTTS - NO';
    if (marketKey === 'corners_under') return 'TOTAL CORNERS UNDER';
    if (marketKey === 'corners_over') return 'TOTAL CORNERS OVER';
    if (marketKey.startsWith('double_chance_')) {
        return `DOUBLE CHANCE - ${marketKey.replace('double_chance_', '').toUpperCase()}`;
    }
    if (explicit[normalized]) return explicit[normalized];
    if (marketKey.includes('double_chance')) return `DOUBLE CHANCE - ${String(prediction || '').toUpperCase()}`;
    return String(prediction || '').toUpperCase();
}

function buildSecondaryMarketDescription(market, fallbackDescription = '') {
    const marketKey = normalizeMarketKey(market);
    const description = String(fallbackDescription || '').trim();
    if (marketKey === 'corners_under' || marketKey === 'corners_over') {
        return description || 'Total corners line unavailable from source';
    }
    return description;
}

function isDisplayFriendlySecondaryMarket(market) {
    const marketKey = normalizeMarketKey(market);
    return marketKey !== 'corners_under' && marketKey !== 'corners_over';
}

function isCompatibleSecondaryMarket(primaryMatch, secondaryMarket) {
    return areLegsCompatible(
        {
            market: primaryMatch?.market,
            prediction: primaryMatch?.prediction
        },
        {
            market: secondaryMarket?.market,
            prediction: secondaryMarket?.prediction
        }
    );
}

function dedupeSecondaryMarkets(items) {
    const seen = new Set();
    const out = [];

    for (const item of items) {
        const marketKey = normalizeMarketKey(item?.market);
        const predictionKey = String(item?.prediction || '').trim().toLowerCase();
        const key = `${marketKey}:${predictionKey}`;
        if (!marketKey || seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }

    return out;
}

function getPredictionPrimaryMatchId(prediction) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const firstMatch = matches[0] || {};
    return String(firstMatch?.match_id || prediction?.match_id || '').trim();
}

function buildSecondaryMarketSummaryItem(prediction) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const firstMatch = matches[0] || {};
    return {
        market: firstMatch?.market || '',
        prediction: firstMatch?.prediction || '',
        confidence: normalizeConfidence(firstMatch?.confidence ?? prediction?.total_confidence ?? 0),
        description: buildSecondaryMarketDescription(firstMatch?.market, firstMatch?.metadata?.market_description || ''),
        label: humanizePredictionLabel(firstMatch?.prediction, firstMatch?.market)
    };
}

function buildSameMatchBuilder(prediction) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    return matches.slice(0, 6).map((match, index) => ({
        index: index + 1,
        market: humanizeToken(match?.market || ''),
        prediction: humanizePredictionLabel(match?.prediction, match?.market),
        confidence: normalizeConfidence(match?.confidence || 0)
    }));
}

function buildFallbackReasoning(prediction, relatedSecondaryMarkets = []) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const firstMatch = matches[0] || {};
    const metadata = firstMatch?.metadata || {};
    const homeTeam = firstMatch?.home_team || metadata?.home_team || 'Home Team';
    const awayTeam = firstMatch?.away_team || metadata?.away_team || 'Away Team';
    const league = metadata?.league || humanizeToken(firstMatch?.sport || '');
    const outcome = humanizePredictionLabel(firstMatch?.prediction, firstMatch?.market);
    const confidence = normalizeConfidence(firstMatch?.confidence ?? prediction?.total_confidence ?? 0);
    const backupSummary = relatedSecondaryMarkets
        .slice(0, 3)
        .map((market) => `${market.label} (${market.confidence}%)`)
        .join(', ');

    if (backupSummary) {
        return `${homeTeam} vs ${awayTeam} leans ${outcome} at ${confidence}% confidence in ${league}. Secondary coverage currently favours ${backupSummary}.`;
    }

    return `${homeTeam} vs ${awayTeam} leans ${outcome} at ${confidence}% confidence in ${league}.`;
}

function buildFallbackPipelineData(prediction, relatedSecondaryMarkets = []) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const firstMatch = matches[0] || {};
    const metadata = firstMatch?.metadata || {};
    const homeTeam = firstMatch?.home_team || metadata?.home_team || 'Home Team';
    const awayTeam = firstMatch?.away_team || metadata?.away_team || 'Away Team';
    const competition = metadata?.league || humanizeToken(firstMatch?.sport || '');
    const outcome = humanizePredictionLabel(firstMatch?.prediction, firstMatch?.market);
    const confidence = normalizeConfidence(firstMatch?.confidence ?? prediction?.total_confidence ?? 0);
    const volatility = humanizeToken(firstMatch?.volatility || prediction?.risk_level || 'medium');
    const backupSummary = relatedSecondaryMarkets
        .slice(0, 3)
        .map((market) => market.label)
        .join(', ');

    return {
        elite_6_stage: {
            stage_1_collection: `${competition} market inputs collected for ${homeTeam} vs ${awayTeam}.`,
            stage_2_baseline: `${outcome} is the leading baseline edge at ${confidence}% confidence.`,
            stage_3_context: backupSummary
                ? `Related secondary coverage is available: ${backupSummary}.`
                : 'No linked secondary coverage is currently attached to this fixture.',
            stage_4_reality: `${volatility} volatility profile on the published market set.`,
            stage_5_decision: `Primary market retained as ${outcome}.`,
            stage_6_final: `Final published edge remains ${outcome}.`
        },
        core_4_stage: {
            stage_1_baseline: `${outcome} is the leading baseline edge at ${confidence}% confidence.`,
            stage_2_context: backupSummary
                ? `Secondary coverage is available: ${backupSummary}.`
                : 'No linked secondary coverage is currently attached to this fixture.',
            stage_3_reality: `${volatility} volatility profile on the published market set.`,
            stage_4_final: `Final published edge remains ${outcome}.`
        }
    };
}

function attachRelatedPredictionArtifacts(predictions) {
    const secondaryByMatchId = new Map();
    const sameMatchByMatchId = new Map();

    for (const prediction of predictions) {
        const primaryMatchId = getPredictionPrimaryMatchId(prediction);
        if (!primaryMatchId) continue;

        const sectionType = inferSectionType(prediction);
        if (sectionType === 'secondary') {
            if (!secondaryByMatchId.has(primaryMatchId)) {
                secondaryByMatchId.set(primaryMatchId, []);
            }
            secondaryByMatchId.get(primaryMatchId).push(buildSecondaryMarketSummaryItem(prediction));
        } else if (sectionType === 'same_match') {
            sameMatchByMatchId.set(primaryMatchId, buildSameMatchBuilder(prediction));
        }
    }

    return predictions.map((prediction) => {
        const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
        if (!matches.length) return prediction;

        const sectionType = inferSectionType(prediction);
        const primaryMatchId = getPredictionPrimaryMatchId(prediction);
        const firstMatch = matches[0] || {};
        const remainingMatches = matches.slice(1);
        const relatedSecondaryMarkets = dedupeSecondaryMarkets(
            (secondaryByMatchId.get(primaryMatchId) || [])
                .filter((market) => isCompatibleSecondaryMarket(firstMatch, market))
                .filter((market) => isDisplayFriendlySecondaryMarket(market.market))
        ).slice(0, 3);
        const relatedSameMatchBuilder = sameMatchByMatchId.get(primaryMatchId) || [];
        const metadata = {
            ...(firstMatch?.metadata || {})
        };

        if (sectionType === 'direct') {
            metadata.secondary_markets = relatedSecondaryMarkets;
            if (!Array.isArray(metadata.same_match_builder) || metadata.same_match_builder.length === 0) {
                metadata.same_match_builder = relatedSameMatchBuilder;
            }
        }

        if (!String(metadata.reasoning || '').trim()) {
            metadata.reasoning = buildFallbackReasoning(prediction, relatedSecondaryMarkets);
        }

        if (!metadata.pipeline_data || typeof metadata.pipeline_data !== 'object') {
            metadata.pipeline_data = buildFallbackPipelineData(prediction, relatedSecondaryMarkets);
        }

        return {
            ...prediction,
            matches: [
                {
                    ...firstMatch,
                    metadata
                },
                ...remainingMatches
            ]
        };
    });
}

function normalizeConfidence(confidence) {
    if (typeof confidence !== 'number' || Number.isNaN(confidence)) return 0;
    return Math.max(0, Math.min(100, Math.round(confidence)));
}

function normalizeOdds(odds) {
    if (typeof odds !== 'number' || Number.isNaN(odds)) return null;
    return Math.max(1.01, Math.round(odds * 100) / 100);
}

function enrichMatchMetadata(match, prediction) {
    const fallbackOutcome = String(prediction?.prediction || prediction?.label || 'unknown').toUpperCase();
    const fallbackReasoning = String(prediction?.reasoning || prediction?.model_reasoning || '').trim();

    return {
        ...match,
        prediction_details: {
            outcome: fallbackOutcome,
            reasoning: fallbackReasoning
        }
    };
}

function inferSectionType(prediction) {
    const explicit = String(prediction?.section_type || prediction?.type || '').trim().toLowerCase();
    if (explicit) return explicit;

    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const uniqueMatchIds = new Set(
        matches.map((match) => String(match?.match_id || '').trim()).filter(Boolean)
    );
    const firstMarket = String(matches[0]?.market || '').trim().toLowerCase();

    if (matches.length > 1 && uniqueMatchIds.size === 1) return 'same_match';
    if (matches.length >= 12) return 'mega_acca_12';
    if (matches.length >= 6) return 'acca_6match';
    if (matches.length >= 2) return 'multi';
    if (matches.length === 1 && firstMarket && firstMarket !== '1x2' && firstMarket !== 'match_result') {
        return 'secondary';
    }
    return 'direct';
}

function parseMatchKickoff(match) {
    const value =
        match?.commence_time ||
        match?.match_date ||
        match?.metadata?.match_time ||
        match?.metadata?.kickoff ||
        match?.metadata?.kickoff_time ||
        null;

    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function predictionMatchesWindow(prediction, windowStart, windowEnd) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    if (matches.length === 0) return false;

    const kickoffs = matches
        .map((match) => parseMatchKickoff(match))
        .filter(Boolean);

    if (kickoffs.length === 0) return true;
    return kickoffs.every((kickoff) => kickoff >= windowStart && kickoff <= windowEnd);
}

function getPredictionPrimaryKickoff(prediction) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const kickoffs = matches
        .map((match) => parseMatchKickoff(match))
        .filter(Boolean)
        .sort((a, b) => a.getTime() - b.getTime());

    return kickoffs[0] || null;
}

function comparePredictionsForDisplay(a, b, now = new Date()) {
    const kickoffA = getPredictionPrimaryKickoff(a);
    const kickoffB = getPredictionPrimaryKickoff(b);
    const upcomingA = kickoffA ? kickoffA >= now : false;
    const upcomingB = kickoffB ? kickoffB >= now : false;

    if (upcomingA !== upcomingB) {
        return upcomingA ? -1 : 1;
    }

    if (kickoffA && kickoffB) {
        if (upcomingA && upcomingB) {
            return kickoffA.getTime() - kickoffB.getTime();
        }
        return kickoffB.getTime() - kickoffA.getTime();
    }

    const createdA = new Date(a.created_at || 0).getTime();
    const createdB = new Date(b.created_at || 0).getTime();
    return createdB - createdA;
}

function enrichPredictionDetails(prediction) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const firstMatch = matches[0] || {};
    const firstMetadata = firstMatch?.metadata || {};
    const matchDetails = firstMatch?.prediction_details || {};

    const fallbackOutcome =
        matchDetails.outcome ||
        firstMatch?.prediction ||
        prediction?.prediction ||
        prediction?.section_type ||
        prediction?.type ||
        'PREDICTION';

    const fallbackReasoning =
        matchDetails.reasoning ||
        firstMetadata.reasoning ||
        firstMetadata.model_reasoning ||
        prediction?.reasoning ||
        prediction?.model_reasoning ||
        '';

    return {
        ...prediction,
        section_type: inferSectionType(prediction),
        prediction_details: {
            ...(prediction?.prediction_details || {}),
            outcome: String(fallbackOutcome).trim(),
            reasoning: String(fallbackReasoning).trim()
        }
    };
}

function buildPredictionSignature(prediction) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const legs = matches.map((match) => [
        String(match?.match_id || '').trim(),
        normalizeMarketKey(match?.market),
        String(match?.prediction || '').trim().toLowerCase()
    ].join(':')).join('|');

    return [
        String(prediction?.tier || '').trim().toLowerCase(),
        inferSectionType(prediction),
        legs
    ].join('::');
}

function dedupePredictions(predictions) {
    const seen = new Set();
    const out = [];

    for (const prediction of predictions) {
        const signature = buildPredictionSignature(prediction);
        if (!signature || seen.has(signature)) continue;
        seen.add(signature);
        out.push(prediction);
    }

    return out;
}

function filterConflictingSecondaryPredictions(predictions) {
    const directByMatchId = new Map();

    for (const prediction of predictions) {
        if (inferSectionType(prediction) !== 'direct') continue;
        const matchId = getPredictionPrimaryMatchId(prediction);
        const firstMatch = Array.isArray(prediction?.matches) ? prediction.matches[0] : null;
        if (!matchId || !firstMatch) continue;
        directByMatchId.set(matchId, firstMatch);
    }

    return predictions.filter((prediction) => {
        if (inferSectionType(prediction) !== 'secondary') return true;
        const matchId = getPredictionPrimaryMatchId(prediction);
        const firstMatch = Array.isArray(prediction?.matches) ? prediction.matches[0] : null;
        const directMatch = directByMatchId.get(matchId);
        if (!matchId || !firstMatch || !directMatch) return true;
        return isCompatibleSecondaryMarket(directMatch, firstMatch);
    });
}

function toConflictCheckLeg(match) {
    const marketKey = normalizeMarketKey(match?.market);
    const predictionKey = String(match?.prediction || '').trim().toLowerCase();
    if (!marketKey || !predictionKey) return null;

    if (marketKey === '1x2') {
        return { market: '1X2', prediction: predictionKey };
    }
    if (marketKey.startsWith('double_chance_')) {
        const mappedPrediction = predictionKey === '1x'
            ? 'home_or_draw'
            : predictionKey === 'x2'
                ? 'draw_or_away'
                : predictionKey === '12'
                    ? 'home_or_away'
                    : predictionKey;
        return { market: 'DOUBLE_CHANCE', prediction: mappedPrediction };
    }
    if (marketKey === 'under_1_5' || marketKey === 'over_1_5') {
        return { market: 'OVER_UNDER_1_5', prediction: predictionKey };
    }
    if (marketKey === 'under_2_5' || marketKey === 'over_2_5') {
        return { market: 'OVER_UNDER_2_5', prediction: predictionKey };
    }
    if (marketKey === 'btts_yes' || marketKey === 'btts_no') {
        return { market: 'BTTS', prediction: predictionKey === 'yes' ? 'yes' : 'no' };
    }

    return { market: marketKey.toUpperCase(), prediction: predictionKey };
}

function sanitizeSameMatchMatchesForDisplay(matches) {
    const out = [];

    for (const match of matches) {
        const prospective = [...out, match]
            .map(toConflictCheckLeg)
            .filter(Boolean);

        if (prospective.length > 0 && !isValidCombination(prospective)) {
            continue;
        }

        out.push(match);
    }

    return out;
}

function sanitizePredictionForDisplay(prediction) {
    if (inferSectionType(prediction) !== 'same_match') return prediction;

    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const sanitizedMatches = sanitizeSameMatchMatchesForDisplay(matches);
    if (!sanitizedMatches.length) return prediction;

    return {
        ...prediction,
        matches: sanitizedMatches
    };
}

async function getLatestRelevantPublishRunId(requestedSport) {
    const sportKey = normalizePredictionSportKey(requestedSport || '');

    if (!sportKey) {
        const latestRunRes = await query(
            `
            SELECT id
            FROM prediction_publish_runs
            WHERE status = 'completed'
              AND (
                requested_sports IS NULL
                OR cardinality(requested_sports) = 0
                OR 'all' = ANY(requested_sports)
              )
            ORDER BY id DESC
            LIMIT 1
            `
        );
        return latestRunRes.rows[0]?.id || null;
    }

    const latestRunRes = await query(
        `
        SELECT id
        FROM prediction_publish_runs
        WHERE status = 'completed'
          AND (
            requested_sports IS NULL
            OR cardinality(requested_sports) = 0
            OR 'all' = ANY(requested_sports)
            OR $1 = ANY(requested_sports)
          )
        ORDER BY
          CASE
            WHEN requested_sports IS NOT NULL AND $1 = ANY(requested_sports) THEN 0
            WHEN requested_sports IS NULL OR cardinality(requested_sports) = 0 OR 'all' = ANY(requested_sports) THEN 1
            ELSE 2
          END,
          id DESC
        LIMIT 1
        `,
        [sportKey]
    );
    return latestRunRes.rows[0]?.id || null;
}

// GET /api/predictions
// Default tier = deep (elite pool); subscription limits use /api/user/predictions
router.get('/', requireRole('user'), async (req, res) => {
    try {
        // NEW: Use subscription matrix instead of tier
        const planId = req.query.plan_id || 'elite_30day_deep_vip';
        const sport = req.query.sport;
        const sportFilterValues = getSportFilterValues(sport);
        const futureWindowDays = Math.max(1, Math.min(14, Number(req.query.window_days) || 7));
        const historyWindowDays = Math.max(0, Math.min(14, Number(req.query.history_days) || 0));

        console.log(`[PREDICTIONS] Request for Plan: ${planId}, Sport: ${sport || 'all'}`);

        // Get plan capabilities from subscription matrix
        const planCapabilities = getPlanCapabilities(planId);
        if (!planCapabilities) {
            return res.status(400).json({ error: 'Invalid plan ID' });
        }

        const now = new Date();
        const latestPublishRunId = await getLatestRelevantPublishRunId(sport);
        let predictions = [];
        try {
            if (!latestPublishRunId) {
                throw new Error(`No completed publish run found for sport=${sport || 'all'}`);
            }

            let queryStr = `
                SELECT pf.id, pf.publish_run_id, pf.tier, pf.type, pf.matches, pf.total_confidence, pf.risk_level, pf.created_at
                FROM predictions_final pf
                WHERE tier IN (${planCapabilities.tiers.map(t => `'${t}'`).join(',')})
                  AND pf.publish_run_id = $1
            `;
            const queryParams = [latestPublishRunId];

            queryStr += ` ORDER BY created_at DESC LIMIT 2000;`;

            const dbRes = await query(queryStr, queryParams);
            predictions = dbRes.rows || [];
        } catch (dbErr) {
            console.error('[predictions] primary DB query failed, falling back to Supabase:', dbErr.message);
        }

        // If DB returned no predictions, attempt Supabase fallback (useful when Supabase is the source)
        try {
            if ((!predictions || predictions.length === 0) && config.supabase && config.supabase.url && config.supabase.anonKey) {
                console.log('[predictions] DB empty - attempting Supabase fallback');
                const sb = createClient(config.supabase.url, config.supabase.anonKey);
                const { data: runs, error: runsError } = await sb
                    .from('prediction_publish_runs')
                    .select('id, requested_sports')
                    .eq('status', 'completed')
                    .order('id', { ascending: false })
                    .limit(50);

                const latestSupabaseRun = !runsError && Array.isArray(runs)
                    ? runs.find((row) => {
                        const requested = Array.isArray(row.requested_sports) ? row.requested_sports.map(normalizePredictionSportKey) : [];
                        if (!sport) return requested.length === 0 || requested.includes('all');
                        return requested.length === 0 || requested.includes('all') || requested.includes(normalizePredictionSportKey(sport));
                    })
                    : null;

                const { data, error } = latestSupabaseRun
                    ? await sb
                        .from('predictions_final')
                        .select('*')
                        .eq('publish_run_id', latestSupabaseRun.id)
                        .order('created_at', { ascending: false })
                        .limit(2000)
                    : { data: null, error: runsError };

                if (!error && Array.isArray(data) && data.length > 0) {
                    // Filter Supabase rows by plan capabilities and sport
                    const filtered = data.filter(r => {
                        try {
                            // Check if prediction tier is in plan's allowed tiers
                            const rowTier = String(r.tier || 'normal');
                            if (!planCapabilities.tiers.includes(rowTier)) return false;
                            return true;
                        } catch (e) {
                            return false;
                        }
                    });
                    predictions = filtered;
                } else if (error) {
                    console.warn('[predictions] Supabase fallback error:', error.message || error);
                }
            }
        } catch (fbErr) {
            console.warn('[predictions] Supabase fallback failed:', fbErr.message || fbErr);
        }

        const teamNames = extractTeamNames(predictions).map(n => n.toLowerCase());
        const teamInfoByName = new Map();

        if (teamNames.length > 0) {
            try {
                const teamRes = await query(
                    `
                    SELECT
                        t.id,
                        t.name,
                        NULL::text AS logo,
                        t.location AS country,
                        NULL::int AS league_id,
                        NULL::text AS league_name,
                        NULL::text AS league_country,
                        NULL::text AS league_season,
                        s.sport_key AS sport_id,
                        s.sport_key AS sport_slug,
                        s.title AS sport_name
                    FROM teams t
                    LEFT JOIN sports s ON s.sport_key = t.sport_key
                    WHERE LOWER(t.name) = ANY($1::text[])
                    `,
                    [teamNames]
                );

                const teamIds = [];
                for (const row of teamRes.rows) {
                    teamIds.push(row.id);
                }

                const playersByTeam = new Map();
                if (teamIds.length > 0) {
                    const playersRes = await query(
                        `
                        SELECT id, team_id, full_name AS name, NULL::int AS age, NULL::int AS number, position, NULL::text AS photo
                        FROM players
                        WHERE team_id = ANY($1::int[])
                        ORDER BY team_id, name ASC
                        `,
                        [teamIds]
                    );
                    const grouped = buildPlayersByTeam(playersRes.rows);
                    for (const [teamId, players] of grouped.entries()) {
                        playersByTeam.set(teamId, players);
                    }
                }

                for (const row of teamRes.rows) {
                    teamInfoByName.set(String(row.name).toLowerCase(), {
                        id: row.id,
                        name: row.name,
                        logo: row.logo,
                        country: row.country,
                        league: {
                            id: row.league_id,
                            name: row.league_name,
                            country: row.league_country,
                            season: row.league_season
                        },
                        sport: {
                            id: row.sport_id,
                            slug: row.sport_slug,
                            name: row.sport_name
                        },
                        players: playersByTeam.get(row.id) || []
                    });
                }
            } catch (enrichErr) {
                console.warn('[predictions] enrichment skipped:', enrichErr.message);
            }
        }

        const enrichedPredictions = predictions.map((row) => {
            const matches = Array.isArray(row.matches) ? row.matches : [];
            const enrichedMatches = matches.map((m) => {
                const home = m?.home_team || m?.metadata?.home_team || null;
                const away = m?.away_team || m?.metadata?.away_team || null;
                const homeKey = home ? String(home).toLowerCase() : null;
                const awayKey = away ? String(away).toLowerCase() : null;
                return {
                    ...enrichMatchMetadata(m, row),
                    home_team_info: homeKey ? (teamInfoByName.get(homeKey) || null) : null,
                    away_team_info: awayKey ? (teamInfoByName.get(awayKey) || null) : null
                };
            });
            return {
                ...row,
                matches: enrichedMatches
            };
        }).map(enrichPredictionDetails);
        const hydratedPredictions = attachRelatedPredictionArtifacts(
            filterConflictingSecondaryPredictions(dedupePredictions(enrichedPredictions))
                .map(sanitizePredictionForDisplay)
        );

        const windowStart = new Date(now.getTime() - historyWindowDays * 24 * 60 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + futureWindowDays * 24 * 60 * 60 * 1000);

        const scopedPredictions = hydratedPredictions
            .filter((prediction) => predictionMatchesWindow(prediction, windowStart, windowEnd))
            .filter((prediction) => predictionMatchesSport(prediction, sportFilterValues))
            .filter((prediction) => {
                if (inferSectionType(prediction) !== 'secondary') return true;
                const firstMatch = Array.isArray(prediction?.matches) ? prediction.matches[0] : null;
                return isDisplayFriendlySecondaryMarket(firstMatch?.market);
            })
            .sort((a, b) => comparePredictionsForDisplay(a, b, now));

        const planFilteredPredictions = filterPredictionsForPlan(
            scopedPredictions,
            planId,
            now,
            { enforceUniqueAssetWindow: false }
        );
        const todayName = moment.tz('Africa/Johannesburg').format('dddd').toLowerCase();
        const dailyLimits = calculateDailyAllocations(planId, todayName);

        res.status(200).json({
            plan_id: planId,
            sport: sport || 'all',
            day: todayName,
            history_days: historyWindowDays,
            window_days: futureWindowDays,
            daily_limits: dailyLimits,
            plan_meta: {
                id: planCapabilities.plan_id,
                name: planCapabilities.name,
                tier: planCapabilities.tier,
                duration_days: planCapabilities.duration_days,
                mega_acca_allocation: planCapabilities.capabilities?.mega_acca_allocation || 0,
                mega_acca_constraints: planCapabilities.capabilities?.mega_acca_constraints || null
            },
            count: planFilteredPredictions.length,
            predictions: planFilteredPredictions
        });
    } catch (err) {
        console.error('[predictions] Route Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Deterministic rebuild endpoint (useful for scheduled jobs)
router.post('/rebuild', requireRole('admin'), async (_req, res) => {
    try {
        console.log('[predictions] Manual rebuild of final outputs requested...');
        const result = await rebuildFinalOutputs();
        res.status(200).json({ ok: true, message: "Final outputs rebuilt successfully", data: result });
    } catch (err) {
        console.error('[predictions] rebuild error:', err);
        res.status(500).json({ error: 'Rebuild failed', details: err.message });
    }
});

// Clear test data from raw and filtered tables
router.post('/clear-test', requireRole('admin'), async (_req, res) => {
    try {
        console.log('[predictions] Clearing test data...');
        // Delete test data from predictions_filtered first (foreign key constraint)
        await query(`DELETE FROM predictions_filtered WHERE raw_id IN (SELECT id FROM predictions_raw WHERE metadata->>'data_mode' = 'test')`);
        // Delete test data from predictions_raw
        const rawResult = await query(`DELETE FROM predictions_raw WHERE metadata->>'data_mode' = 'test'`);
        // Clear predictions_final (will be rebuilt)
        await query(`DELETE FROM predictions_final`);
        res.status(200).json({ 
            ok: true, 
            message: "Test data cleared. Run /rebuild to regenerate final outputs.",
            deleted_raw: rawResult.rowCount 
        });
    } catch (err) {
        console.error('[predictions] clear-test error:', err);
        res.status(500).json({ error: 'Clear failed', details: err.message });
    }
});

module.exports = router;
