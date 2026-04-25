const moment = require('moment-timezone');
const { query } = require('../db');
const { evaluateDirect1x2 } = require('../services/direct1x2Engine');
const { normalizePlanId, getPlan } = require('../config/subscriptionPlans');
const {
    getPlanCapabilities,
    filterPredictionsForPlan,
    calculateDailyAllocations
} = require('../config/subscriptionMatrix');
const {
    normalizeMarketKey,
    areMarketsConflicting,
    DIRECT_MARKETS_ALLOWED,
    SAFE_MARKETS_ALLOWED,
    DIRECT_CONFIDENCE_MIN,
    SAFE_CONFIDENCE_MIN,
    ACCA_CONFIDENCE_MIN
} = require('../services/marketIntelligence');

const TZ = 'Africa/Johannesburg';
const MAX_DB_ROWS = 4000;
const DEFAULT_SINGLE_COUNT = 6;
const ACCA_DEFAULT_SIZE = 6;
const ACCA_MEGA_SIZE = 12;
const ACTIVE_DEPLOYMENT_SPORT = 'football';
const DISABLED_SPORT_REPLY = 'That sport is currently being prepared and will be available soon.';
const LIMITED_CONTEXT_REPLY = 'Limited contextual data available. This insight is mainly based on baseline probability and market/statistical structure.';
const BOT_ACCA_CONFIDENCE_MIN = Math.max(ACCA_CONFIDENCE_MIN, Number(process.env.BOT_ACCA_CONFIDENCE_MIN || 70));
const VISIBLE_WINDOW_HOURS = (() => {
    const raw = Number(process.env.EDGEMIND_VISIBLE_WINDOW_HOURS || 72);
    if (!Number.isFinite(raw)) return 72;
    return Math.max(24, Math.min(168, Math.floor(raw)));
})();

const ACCA_SPORTS = new Set([
    'football'
]);

const SAFE_MARKET_PATTERNS = Object.freeze([
    /^(over|under)_\d+_\d+_(points|runs|games)$/,
    /^(over|under)_\d+_\d+_(corners|cards)$/,
    /^(corners|cards|yellow_cards|red_cards)_(over|under)_\d+_\d+$/,
    /^total_(points|runs|games)_(over|under)(?:_\d+_\d+)?$/
]);

const SPORT_ALIASES = Object.freeze({
    soccer: 'football',
    football: 'football',
    nba: 'basketball',
    nfl: 'american_football',
    'american football': 'american_football',
    'formula 1': 'formula1',
    f1: 'formula1',
    motorsport: 'formula1',
    tennis: 'tennis',
    basketball: 'basketball',
    rugby: 'rugby',
    cricket: 'cricket',
    baseball: 'baseball',
    hockey: 'hockey'
});

function normalizeText(value) {
    return String(value || '').trim();
}

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSport(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'unknown';
    if (raw.startsWith('soccer_')) return 'football';
    if (raw.startsWith('icehockey_')) return 'hockey';
    if (raw.startsWith('basketball_')) return 'basketball';
    if (raw.startsWith('rugbyunion_')) return 'rugby';
    if (raw.startsWith('baseball_')) return 'baseball';
    if (raw.startsWith('tennis_')) return 'tennis';
    if (raw.startsWith('cricket_')) return 'cricket';
    if (raw.startsWith('americanfootball_')) return 'american_football';
    if (raw === 'nhl') return 'hockey';
    if (raw === 'nba') return 'basketball';
    if (raw === 'nfl') return 'american_football';
    return SPORT_ALIASES[raw] || raw;
}

function isDeploymentSportEnabled(value) {
    return normalizeSport(value) === ACTIVE_DEPLOYMENT_SPORT;
}

function normalizeInsightTierLabel(value) {
    const tier = String(value || '').trim().toLowerCase();
    if (!tier) return null;
    if (tier === 'core' || tier === 'normal') return 'core';
    if (tier === 'elite' || tier === 'deep') return 'elite';
    if (tier === 'vip') return 'vip';
    return null;
}

function normalizeAccessTokenToTier(value) {
    const token = String(value || '').trim().toLowerCase();
    if (!token) return null;
    if (token === 'vip' || token === 'vip_30day' || token.includes('deep_vip') || token.endsWith('_vip')) return 'vip';
    if (token === 'elite' || token === 'deep' || token.startsWith('elite_') || token.startsWith('deep_')) return 'elite';
    if (token === 'core' || token === 'normal' || token === 'core_free' || token.startsWith('core_')) return 'core';
    return null;
}

function resolveHighestAccessTier(user) {
    if (user?.is_admin === true || user?.isAdmin === true || user?.is_test_user === true) return 'vip';

    const access = new Set(
        (Array.isArray(user?.access_tiers) ? user.access_tiers : [])
            .map(normalizeAccessTokenToTier)
            .filter(Boolean)
    );
    if (!access.size) {
        const fallback = normalizeAccessTokenToTier(user?.plan_id);
        if (fallback) access.add(fallback);
    }

    if (access.has('vip')) return 'vip';
    if (access.has('elite')) return 'elite';
    if (access.has('core')) return 'core';
    return 'core';
}

function planRank(planId) {
    const normalized = normalizePlanId(planId);
    if (!normalized) return 0;
    const plan = getPlan(normalized);
    if (!plan) return 0;
    let tierWeight = 0;
    if (normalized.includes('deep_vip') || normalized === 'vip_30day') tierWeight = 3;
    else if (plan.tier === 'elite') tierWeight = 2;
    else if (plan.tier === 'core') tierWeight = 1;
    return (tierWeight * 1000) + Number(plan.days || 0);
}

function resolveBestKnownPlanId(user) {
    const fromSubscriptions = (Array.isArray(user?.subscription_plan_ids) ? user.subscription_plan_ids : [])
        .map((planId) => normalizePlanId(planId))
        .filter(Boolean)
        .sort((a, b) => planRank(b) - planRank(a));
    if (fromSubscriptions.length > 0) return fromSubscriptions[0];

    const fromProfile = normalizePlanId(user?.plan_id);
    if (fromProfile) return fromProfile;

    const highest = resolveHighestAccessTier(user);
    if (highest === 'vip') return 'elite_30day_deep_vip';
    if (highest === 'elite') return 'elite_14day_deep_pro';
    return normalizePlanId('CORE_FREE') || 'core_4day_sprint';
}

function resolveQueryTiers(highestTier, isAdmin) {
    if (isAdmin) return ['normal', 'core', 'deep', 'elite', 'vip'];
    if (highestTier === 'vip') return ['normal', 'core', 'deep', 'elite', 'vip'];
    if (highestTier === 'elite') return ['normal', 'core', 'deep', 'elite'];
    return ['normal', 'core'];
}

function parseKickoff(match) {
    const raw =
        match?.kickoff_time ||
        match?.commence_time ||
        match?.match_date ||
        match?.metadata?.match_time ||
        match?.metadata?.kickoff ||
        match?.metadata?.kickoff_time ||
        null;
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isKickoffInVisibleWindow(kickoff, nowTz) {
    if (!(kickoff instanceof Date) || Number.isNaN(kickoff.getTime())) return false;
    const kickoffTz = moment(kickoff).tz(TZ);
    const windowStart = nowTz.clone().startOf('day');
    const windowEnd = windowStart.clone().add(VISIBLE_WINDOW_HOURS, 'hours');
    return kickoffTz.isSameOrAfter(windowStart) && kickoffTz.isBefore(windowEnd);
}

function inferSectionType(prediction) {
    const explicit = String(prediction?.section_type || prediction?.type || '').trim().toLowerCase();
    if (explicit && explicit !== 'prediction') return explicit;

    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    if (matches.length >= 12) return 'mega_acca_12';
    if (matches.length >= 6) return 'acca_6match';
    if (matches.length >= 2) {
        const ids = new Set(matches.map((m) => String(m?.match_id || '').trim()).filter(Boolean));
        return ids.size === 1 ? 'same_match' : 'multi';
    }

    const firstMarket = normalizeMarketKey(matches[0]?.market || '');
    if (matches.length === 1 && firstMarket && !DIRECT_MARKETS_ALLOWED.has(firstMarket)) {
        return 'secondary';
    }
    return 'direct';
}

function normalizeSectionOutput(sectionType) {
    const key = String(sectionType || '').trim().toLowerCase();
    if (key === 'mega_acca_12') return 'mega';
    if (key === 'acca_6match') return 'acca';
    if (key === 'direct') return 'direct';
    return 'singles';
}

function isSafeMarketAllowed(market) {
    const key = normalizeMarketKey(market);
    if (!key) return false;
    if (SAFE_MARKETS_ALLOWED.has(key)) return true;
    return SAFE_MARKET_PATTERNS.some((pattern) => pattern.test(key));
}

function isAccaMarketAllowed(market) {
    const key = normalizeMarketKey(market);
    return DIRECT_MARKETS_ALLOWED.has(key) || isSafeMarketAllowed(key);
}

function displayMarket(market) {
    return String(market || '')
        .replace(/_/g, ' ')
        .trim()
        .toUpperCase();
}

function normalizeTeamKey(team) {
    return String(team || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, '')
        .replace(/\s+/g, ' ');
}

function parseRequestedTeams(message, bodyTeams) {
    if (Array.isArray(bodyTeams) && bodyTeams.length) {
        return bodyTeams
            .map((team) => normalizeText(team))
            .filter(Boolean);
    }

    const text = String(message || '').trim();
    const regexes = [
        /from these teams[:\-]?\s*(.+)$/i,
        /build from[:\-]?\s*(.+)$/i
    ];
    for (const regex of regexes) {
        const hit = text.match(regex);
        if (!hit || !hit[1]) continue;
        return hit[1]
            .split(/,| and |&|;/i)
            .map((team) => normalizeText(team))
            .filter(Boolean);
    }
    return [];
}

function parseSportPreference(message) {
    const text = String(message || '').toLowerCase();
    if (text.includes('use all sports')) return [];

    const onlyMatch = text.match(/use only ([a-z ]+)/i);
    if (onlyMatch && onlyMatch[1]) {
        const key = normalizeSport(onlyMatch[1]);
        return key ? [key] : [];
    }

    const out = [];
    for (const sport of Object.keys(SPORT_ALIASES)) {
        if (text.includes(sport)) out.push(normalizeSport(sport));
    }
    return Array.from(new Set(out));
}

function asksForDisabledSport(message, preferredSports = []) {
    const text = String(message || '').toLowerCase();
    if (text.includes('all sports') || text.includes('multi-sport') || text.includes('multisport')) {
        return true;
    }

    if (preferredSports.some((sport) => !isDeploymentSportEnabled(sport))) {
        return true;
    }

    const disabledTokens = [
        'tennis',
        'basketball',
        'nba',
        'rugby',
        'cricket',
        'baseball',
        'hockey',
        'nfl',
        'american football',
        'mma',
        'afl',
        'volleyball',
        'handball',
        'formula 1',
        'motorsport',
        'f1'
    ];

    return disabledTokens.some((token) => text.includes(token));
}

function detectIntent(message) {
    const text = String(message || '').toLowerCase();
    const asksAcca = text.includes('acca');
    const asksDirect = text.includes('best direct') || text.includes('direct picks') || text.includes('direct markets');
    const asksSafe = text.includes('safe acca') || text.includes('safest bets') || text.includes('safe bets');
    const asksSummary = text.includes('what can i bet today') || text.includes('build from my subscription');
    const focusCorners = text.includes('corners');
    const focusCards = text.includes('cards');
    const focusBtts = text.includes('btts');
    const focusTotals = text.includes('over under') || text.includes('over/under') || text.includes('over under');
    const mega = text.includes('12 leg') || text.includes('12-leg') || text.includes('mega');
    const addMoreLegs = text.includes('add more legs');
    const safer =
        text.includes('make safer') ||
        text.includes('remove risky') ||
        text.includes('safe acca') ||
        text.includes('safest');
    const aggressive = text.includes('make aggressive') || text.includes('aggressive');

    let mode = 'best';
    if (asksSummary) mode = 'summary';
    else if (asksAcca) mode = 'acca';
    else if (asksDirect) mode = 'direct';
    else if (asksSafe) mode = 'safe';
    else if (focusCorners || focusCards || focusBtts || focusTotals) mode = 'market_focus';
    else if (text.includes('best bets today') || text.includes('safest bets today')) mode = 'safe';

    const focus = focusCorners
        ? 'corners'
        : focusCards
            ? 'cards'
            : focusBtts
                ? 'btts'
                : focusTotals
                    ? 'totals'
                    : null;

    return {
        mode,
        mega,
        addMoreLegs,
        safer,
        aggressive,
        focus,
        rawText: text
    };
}

function candidateComparator(a, b) {
    const confDelta = Number(b?.confidence || 0) - Number(a?.confidence || 0);
    if (confDelta !== 0) return confDelta;
    const kickA = parseKickoff(a) || new Date(0);
    const kickB = parseKickoff(b) || new Date(0);
    return kickA.getTime() - kickB.getTime();
}

function selectOnePickPerMatch(candidates, limit) {
    const out = [];
    const usedMatches = new Set();

    for (const candidate of candidates) {
        const matchId = String(candidate?.match_id || '').trim();
        if (!matchId || usedMatches.has(matchId)) continue;
        if (out.some((row) => row.match_id === matchId && areMarketsConflicting(row, candidate))) continue;
        out.push(candidate);
        usedMatches.add(matchId);
        if (out.length >= limit) break;
    }

    return out;
}

function normalizeProbabilityTriplet(probabilities) {
    const safe = {
        home: Math.max(0, Number(probabilities?.home ?? 0)),
        draw: Math.max(0, Number(probabilities?.draw ?? 0)),
        away: Math.max(0, Number(probabilities?.away ?? 0))
    };
    const total = safe.home + safe.draw + safe.away;
    if (total <= 0) return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
    return {
        home: safe.home / total,
        draw: safe.draw / total,
        away: safe.away / total
    };
}

function formatProbabilitiesInline(probabilities) {
    const p = normalizeProbabilityTriplet(probabilities);
    const homePct = Math.round(p.home * 100);
    const drawPct = Math.round(p.draw * 100);
    const awayPct = Math.max(0, 100 - homePct - drawPct);
    return `HOME ${homePct}% | DRAW ${drawPct}% | AWAY ${awayPct}%`;
}

function parseStageOneBaseline(metadata, pick) {
    const stageBaseline = metadata?.pipeline_data?.stage_1_baseline;
    if (isObject(stageBaseline)) {
        const home = Number(stageBaseline.home);
        const draw = Number(stageBaseline.draw);
        const away = Number(stageBaseline.away);
        if (Number.isFinite(home) && Number.isFinite(draw) && Number.isFinite(away)) {
            return normalizeProbabilityTriplet({
                home: home > 1 ? home / 100 : home,
                draw: draw > 1 ? draw / 100 : draw,
                away: away > 1 ? away / 100 : away
            });
        }
    }

    const confidence = Math.max(0, Math.min(100, Number(pick?.confidence || 0))) / 100;
    const prediction = String(pick?.prediction || '').trim().toLowerCase();
    if (prediction === 'home_win') return normalizeProbabilityTriplet({ home: confidence, draw: (1 - confidence) * 0.45, away: (1 - confidence) * 0.55 });
    if (prediction === 'away_win') return normalizeProbabilityTriplet({ away: confidence, draw: (1 - confidence) * 0.45, home: (1 - confidence) * 0.55 });
    if (prediction === 'draw') return normalizeProbabilityTriplet({ draw: confidence, home: (1 - confidence) * 0.5, away: (1 - confidence) * 0.5 });
    return normalizeProbabilityTriplet({ home: 1 / 3, draw: 1 / 3, away: 1 / 3 });
}

function buildRealtimeDirectEvaluationFromMetadata(metadata, pick) {
    const matchContext = isObject(metadata?.match_context) ? metadata.match_context : {};
    const contextual = isObject(matchContext?.contextual_intelligence)
        ? matchContext.contextual_intelligence
        : {};
    const signals = isObject(metadata?.context_intelligence?.signals)
        ? metadata.context_intelligence.signals
        : {};
    const weather = contextual.weather || null;
    const homeTeamKey = normalizeTeamKey(pick?.home_team);
    const awayTeamKey = normalizeTeamKey(pick?.away_team);
    const countKeyAbsences = (entries, side) => {
        const list = Array.isArray(entries) ? entries : [];
        let count = 0;
        for (const entry of list) {
            if (!isObject(entry)) continue;
            const isKey = entry.isKeyPlayer === true
                || entry.is_key_player === true
                || String(entry.priority || entry.importance || '').trim().toLowerCase() === 'key'
                || String(entry.role || '').trim().toLowerCase() === 'starter';
            if (!isKey) continue;

            const teamSide = String(entry.side || entry.team_side || entry.home_away || '').trim().toLowerCase();
            if ((side === 'home' && (teamSide === 'home' || teamSide === 'h'))
                || (side === 'away' && (teamSide === 'away' || teamSide === 'a'))) {
                count += 1;
                continue;
            }

            const teamName = normalizeTeamKey(entry.team || entry.team_name);
            if (side === 'home' && teamName && teamName === homeTeamKey) count += 1;
            if (side === 'away' && teamName && teamName === awayTeamKey) count += 1;
        }
        return count;
    };
    const injuries = {
        home: {
            keyPlayersOut: countKeyAbsences(contextual.injuries, 'home') + countKeyAbsences(contextual.suspensions, 'home')
        },
        away: {
            keyPlayersOut: countKeyAbsences(contextual.injuries, 'away') + countKeyAbsences(contextual.suspensions, 'away')
        }
    };
    const form = isObject(metadata?.form) ? metadata.form : (isObject(metadata?.raw_provider_data?.form) ? metadata.raw_provider_data.form : null);
    const h2h = isObject(metadata?.h2h) ? metadata.h2h : (isObject(metadata?.raw_provider_data?.h2h) ? metadata.raw_provider_data.h2h : null);
    const volatilityScore = (() => {
        const values = [
            Number(signals.weather_risk),
            Number(signals.availability_risk),
            Number(signals.discipline_risk),
            Number(signals.stability_risk),
            Number(signals.travel_fatigue_risk),
            Number(signals.fixture_congestion_risk),
            Number(signals.derby_risk),
            Number(signals.rotation_risk),
            Number(signals.market_movement_risk),
            Number(signals.lineup_uncertainty_risk)
        ].filter((value) => Number.isFinite(value));
        if (!values.length) return 0;
        const avg = values.reduce((sum, value) => sum + Math.max(0, Math.min(1, value)), 0) / values.length;
        return Math.max(0, Math.min(1, avg));
    })();

    const evaluation = evaluateDirect1x2({
        baseProb: parseStageOneBaseline(metadata, pick),
        injuries,
        weather,
        h2h,
        form,
        volatilityScore
    });
    return evaluation;
}

function getStageByNumber(stages, stageNumber) {
    return (Array.isArray(stages) ? stages : []).find((stage) => Number(stage?.stage) === Number(stageNumber)) || null;
}

function directTierLabelForConfidence(confidence) {
    const score = Number(confidence);
    if (!Number.isFinite(score)) return 'UNKNOWN';
    if (score >= 80) return 'STRONG';
    if (score >= 60) return 'MODERATE / HIGH CAUTION';
    if (score >= 45) return 'EXTREME CAUTION';
    return 'REJECT';
}

function buildStageBlockForPick(pick) {
    const metadata = isObject(pick?.metadata) ? pick.metadata : {};
    const storedEngine = isObject(metadata?.direct_1x2_engine) ? metadata.direct_1x2_engine : null;
    const storedStages = Array.isArray(storedEngine?.stages) ? storedEngine.stages : [];
    const hasUsableStoredReasons = storedStages.length >= 6 && storedStages.some((stage) => String(stage?.reason || '').trim().length > 0);
    const evaluation = hasUsableStoredReasons
        ? {
            ...storedEngine,
            volatilityScore: Number(storedEngine?.volatilityScore ?? storedEngine?.volatility_score ?? 0),
            limitedContext: storedEngine?.limitedContext === true || storedEngine?.limited_context === true,
            stages: storedStages
        }
        : buildRealtimeDirectEvaluationFromMetadata(metadata, pick);

    if (!evaluation || evaluation.limitedContext === true) {
        return LIMITED_CONTEXT_REPLY;
    }

    const stage1 = getStageByNumber(evaluation.stages, 1);
    const stage2 = getStageByNumber(evaluation.stages, 2);
    const stage3 = getStageByNumber(evaluation.stages, 3);
    const stage4 = getStageByNumber(evaluation.stages, 4);
    const stage5 = getStageByNumber(evaluation.stages, 5);
    const stage6 = getStageByNumber(evaluation.stages, 6);
    const stage1Probabilities = stage1?.updatedProbabilities || stage1?.probabilities || parseStageOneBaseline(metadata, pick);
    const finalConfidence = Math.round(Number(evaluation?.confidence || pick?.confidence || 0));
    const finalTier = directTierLabelForConfidence(finalConfidence);
    const stage6Secondary = 'Secondary recommendation: review all 4 lower-variance alternatives.';
    const stage6Default = `Final confidence tier: ${finalTier} (${finalConfidence}%). ${stage6Secondary}`;

    const lines = [
        'Stage 1:',
        `Raw probabilities: ${formatProbabilitiesInline(stage1Probabilities)}`,
        'Stage 2:',
        stage2?.reason || 'No weather adjustment applied.',
        'Stage 3:',
        stage3?.reason || 'No injury adjustment applied.',
        'Stage 4:',
        stage4?.reason || 'No H2H/form adjustment applied.',
        'Stage 5:',
        stage5?.reason || `Volatility check complete (score ${Number(evaluation?.volatilityScore || 0).toFixed(2)}).`,
        'Stage 6:',
        stage6?.reason
            ? `${stage6.reason} ${stage6Secondary}`.trim()
            : stage6Default
    ];
    return lines.join('\n');
}

function formatSelections(title, selections, notes = [], options = {}) {
    const includeStages = options?.includeStages !== false;
    const lines = [title, ''];
    for (const pick of selections) {
        lines.push(`${pick.home_team} vs ${pick.away_team}`);
        lines.push(displayMarket(pick.market));
        lines.push(`${Math.round(Number(pick.confidence || 0))}%`);
        if (includeStages) {
            lines.push(buildStageBlockForPick(pick));
        }
        lines.push('');
    }
    if (notes.length) {
        lines.push(...notes);
    }
    return lines.join('\n').trim();
}

function formatDailyLimits(dailyLimits) {
    if (!dailyLimits || typeof dailyLimits !== 'object') return 'No daily limits found.';
    const entries = Object.entries(dailyLimits).filter(([, value]) => Number(value) > 0);
    if (!entries.length) return 'No daily limits found.';
    return entries
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
}

function buildMarketFocusFilter(focus) {
    if (focus === 'corners') return (market) => market.includes('corner');
    if (focus === 'cards') return (market) => market.includes('card');
    if (focus === 'btts') return (market) => market.startsWith('btts');
    if (focus === 'totals') return (market) => market.startsWith('over_') || market.startsWith('under_') || market.includes('total_');
    return () => true;
}

async function fetchPredictionRows(queryTiers, isAdmin) {
    const runRes = await query(
        `SELECT id
         FROM prediction_publish_runs
         WHERE status = 'completed'
         ORDER BY created_at DESC
         LIMIT 1`
    );
    const latestRunId = runRes?.rows?.[0]?.id || null;

    if (latestRunId && isAdmin) {
        const rowsRes = await query(
            `SELECT *
             FROM direct1x2_prediction_final
             WHERE publish_run_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [latestRunId, MAX_DB_ROWS]
        );
        return Array.isArray(rowsRes?.rows) ? rowsRes.rows : [];
    }

    if (latestRunId) {
        const rowsRes = await query(
            `SELECT *
             FROM direct1x2_prediction_final
             WHERE publish_run_id = $1
               AND LOWER(COALESCE(tier, 'normal')) = ANY($2::text[])
             ORDER BY created_at DESC
             LIMIT $3`,
            [latestRunId, queryTiers, MAX_DB_ROWS]
        );
        return Array.isArray(rowsRes?.rows) ? rowsRes.rows : [];
    }

    const fallbackRes = await query(
        `SELECT *
         FROM direct1x2_prediction_final
         WHERE LOWER(COALESCE(tier, 'normal')) = ANY($1::text[])
         ORDER BY created_at DESC
         LIMIT $2`,
        [queryTiers, MAX_DB_ROWS]
    );
    return Array.isArray(fallbackRes?.rows) ? fallbackRes.rows : [];
}

async function buildDatasetForUser(user) {
    const now = new Date();
    const nowTz = moment(now).tz(TZ);
    const isAdmin = user?.is_admin === true || user?.isAdmin === true;
    const highestTier = resolveHighestAccessTier(user);
    const planId = resolveBestKnownPlanId(user);
    const planCapabilities = getPlanCapabilities(planId);
    const dayName = nowTz.format('dddd').toLowerCase();
    const dailyLimits = calculateDailyAllocations(planId, dayName) || {};
    const queryTiers = resolveQueryTiers(highestTier, isAdmin);

    const rows = await fetchPredictionRows(queryTiers, isAdmin);
    const visibleRows = isAdmin
        ? rows
        : filterPredictionsForPlan(rows, planId, now, {
            enforceUniqueAssetWindow: false,
            subscriptionStart: user?.official_start_time || null
        });

    const availableMatchesById = new Map();
    const availableSports = new Set();
    const availableMarkets = new Set();
    const confidenceScores = {};
    const visibleSelections = [];
    const candidates = [];

    for (const row of visibleRows) {
        const sectionType = inferSectionType(row);
        const section = normalizeSectionOutput(sectionType);
        const tier = normalizeInsightTierLabel(row?.tier) || 'core';
        
        // Handle single matches natively using top-level columns if present
        if (row.type !== 'multi' && row.type !== 'acca' && row.type !== 'acca_6match' && row.type !== 'mega_acca_12' && row.type !== 'same_match') {
            const matchId = String(row.fixture_id || row.matches?.[0]?.fixture_id || row.matches?.[0]?.match_id || '').trim();
            if (!matchId) continue;
            
            const kickoff = parseKickoff(row.matches?.[0] || row);
            const rowCreatedAt = row?.created_at ? new Date(row.created_at) : null;
            const availabilityTime = kickoff || (row.match_date ? new Date(row.match_date) : rowCreatedAt);
            if (!isKickoffInVisibleWindow(availabilityTime, nowTz)) continue;
            
            const sport = normalizeSport(row.sport || row.matches?.[0]?.sport || 'football');
            if (!isDeploymentSportEnabled(sport)) continue;
            const market = normalizeMarketKey(row.market_type || row.matches?.[0]?.market || '');
            if (!market) continue;
            
            const confidenceRaw = Number(row.confidence || row.matches?.[0]?.confidence);
            const totalRaw = Number(row.total_confidence);
            const confidence = Number.isFinite(confidenceRaw) ? confidenceRaw : (Number.isFinite(totalRaw) ? totalRaw : 0);
            
            const homeTeam = normalizeText(row.home_team || row.matches?.[0]?.home_team || 'Unknown Home');
            const awayTeam = normalizeText(row.away_team || row.matches?.[0]?.away_team || 'Unknown Away');
            const candidateMetadata = isObject(row?.matches?.[0]?.metadata)
                ? row.matches[0].metadata
                : (isObject(row?.metadata) ? row.metadata : {});
            
            const candidate = {
                tier,
                section,
                sport,
                confidence,
                match_id: matchId,
                market,
                prediction: normalizeText(row.prediction || row.matches?.[0]?.prediction || ''),
                home_team: homeTeam,
                away_team: awayTeam,
                kickoff_time: availabilityTime ? availabilityTime.toISOString() : null,
                metadata: candidateMetadata,
                edgemind_report: normalizeText(
                    row?.edgemind_report
                    || row?.matches?.[0]?.edgemind_report
                    || candidateMetadata?.edgemind_report
                ) || null
            };

            candidates.push(candidate);
            availableSports.add(sport);
            availableMarkets.add(market);
            confidenceScores[matchId] = Math.max(Number(confidenceScores[matchId] || 0), Number(confidence || 0));

            if (!availableMatchesById.has(matchId)) {
                availableMatchesById.set(matchId, {
                    match_id: matchId,
                    sport,
                    home_team: homeTeam,
                    away_team: awayTeam,
                    kickoff_time: availabilityTime ? availabilityTime.toISOString() : null
                });
            }

            visibleSelections.push({
                tier,
                section,
                sport,
                confidence,
                match_id: matchId,
                market
            });
            continue;
        }

        const matches = Array.isArray(row?.matches) ? row.matches : [];
        for (const match of matches) {
            const matchId = String(match?.match_id || match?.fixture_id || row?.fixture_id || '').trim();
            if (!matchId) continue;

            const kickoff = parseKickoff(match);
            const rowCreatedAt = row?.created_at ? new Date(row.created_at) : null;
            const availabilityTime = kickoff || rowCreatedAt;
            if (!isKickoffInVisibleWindow(availabilityTime, nowTz)) continue;

            const sport = normalizeSport(
                match?.sport ||
                row?.sport ||
                match?.metadata?.sport ||
                match?.metadata?.sport_type ||
                'football'
            );
            if (!isDeploymentSportEnabled(sport)) continue;
            const market = normalizeMarketKey(match?.market || row?.market_type || '');
            if (!market) continue;

            const confidenceRaw = Number(match?.confidence);
            const totalRaw = Number(row?.total_confidence);
            const confidence = Number.isFinite(confidenceRaw)
                ? confidenceRaw
                : (Number.isFinite(totalRaw) ? totalRaw : 0);

            const homeTeam = normalizeText(match?.home_team || match?.metadata?.home_team || row?.home_team || 'Unknown Home');
            const awayTeam = normalizeText(match?.away_team || match?.metadata?.away_team || row?.away_team || 'Unknown Away');
            const candidateMetadata = isObject(match?.metadata)
                ? match.metadata
                : (isObject(row?.metadata) ? row.metadata : {});

            const candidate = {
                tier,
                section,
                sport,
                confidence,
                match_id: matchId,
                market,
                prediction: normalizeText(match?.prediction || row?.prediction || ''),
                home_team: homeTeam,
                away_team: awayTeam,
                kickoff_time: availabilityTime ? availabilityTime.toISOString() : null,
                metadata: candidateMetadata,
                edgemind_report: normalizeText(
                    match?.edgemind_report
                    || row?.edgemind_report
                    || candidateMetadata?.edgemind_report
                ) || null
            };

            candidates.push(candidate);
            availableSports.add(sport);
            availableMarkets.add(market);
            confidenceScores[matchId] = Math.max(Number(confidenceScores[matchId] || 0), Number(confidence || 0));

            if (!availableMatchesById.has(matchId)) {
                availableMatchesById.set(matchId, {
                    match_id: matchId,
                    sport,
                    home_team: homeTeam,
                    away_team: awayTeam,
                    kickoff_time: availabilityTime ? availabilityTime.toISOString() : null
                });
            }

            visibleSelections.push({
                tier,
                section,
                sport,
                confidence,
                match_id: matchId,
                market
            });
        }
    }

    return {
        planId,
        highestTier,
        isAdmin,
        planCapabilities,
        now,
        nowTz,
        candidates: candidates.sort(candidateComparator),
        AvailableMatchesToday: Array.from(availableMatchesById.values()),
        AvailableSportsToday: Array.from(availableSports).sort(),
        UserSubscriptionTier: highestTier,
        AvailableMarkets: Array.from(availableMarkets).sort(),
        ConfidenceScores: confidenceScores,
        DailyLimits: dailyLimits,
        VisibleSelections: visibleSelections
    };
}

function applyTeamFilter(candidates, requestedTeams) {
    if (!requestedTeams.length) return { filtered: candidates, missingTeams: [] };

    const requestedMap = new Map(requestedTeams.map((team) => [normalizeTeamKey(team), team]));
    const availableTeamKeys = new Set();
    for (const row of candidates) {
        availableTeamKeys.add(normalizeTeamKey(row.home_team));
        availableTeamKeys.add(normalizeTeamKey(row.away_team));
    }

    const missingTeams = [];
    for (const [normalized, original] of requestedMap.entries()) {
        if (!availableTeamKeys.has(normalized)) {
            missingTeams.push(original);
        }
    }

    const filtered = candidates.filter((row) => {
        const home = normalizeTeamKey(row.home_team);
        const away = normalizeTeamKey(row.away_team);
        return requestedMap.has(home) || requestedMap.has(away);
    });

    return { filtered, missingTeams };
}

function applySportFilter(candidates, preferredSports) {
    if (!preferredSports.length) return candidates;
    const normalizedSet = new Set(preferredSports.map((sport) => normalizeSport(sport)));
    return candidates.filter((row) => normalizedSet.has(normalizeSport(row.sport)));
}

function buildCandidatePool(dataset, intent, requestedTeams, preferredSports) {
    let pool = dataset.candidates.slice();
    pool = applySportFilter(pool, preferredSports);

    const teamFiltered = applyTeamFilter(pool, requestedTeams);
    pool = teamFiltered.filtered;

    if (intent.mode === 'direct') {
        pool = pool.filter((row) =>
            DIRECT_MARKETS_ALLOWED.has(normalizeMarketKey(row.market)) &&
            Number(row.confidence || 0) >= DIRECT_CONFIDENCE_MIN
        );
    } else if (intent.mode === 'safe' || intent.mode === 'market_focus') {
        pool = pool.filter((row) =>
            isSafeMarketAllowed(row.market) &&
            Number(row.confidence || 0) >= SAFE_CONFIDENCE_MIN
        );
    } else {
        pool = pool.filter((row) =>
            (DIRECT_MARKETS_ALLOWED.has(normalizeMarketKey(row.market)) || isSafeMarketAllowed(row.market)) &&
            Number(row.confidence || 0) >= SAFE_CONFIDENCE_MIN
        );
    }

    if (intent.mode === 'market_focus') {
        const filterFn = buildMarketFocusFilter(intent.focus);
        pool = pool.filter((row) => filterFn(normalizeMarketKey(row.market)));
    }

    return {
        pool: pool.sort(candidateComparator),
        missingTeams: teamFiltered.missingTeams
    };
}

function buildAccaPool(dataset, intent, requestedTeams, preferredSports) {
    let sportFilter = preferredSports.slice();
    const notes = [];
    if (!sportFilter.length) {
        sportFilter = [ACTIVE_DEPLOYMENT_SPORT];
    }

    let pool = dataset.candidates
        .filter((row) => ACCA_SPORTS.has(normalizeSport(row.sport)))
        .filter((row) =>
            isAccaMarketAllowed(row.market) &&
            Number(row.confidence || 0) >= BOT_ACCA_CONFIDENCE_MIN
        );

    if (intent.safer) {
        pool = pool.filter((row) => isSafeMarketAllowed(row.market));
    }

    pool = applySportFilter(pool, sportFilter);
    const teamFiltered = applyTeamFilter(pool, requestedTeams);
    pool = teamFiltered.filtered;

    return {
        pool: pool.sort(candidateComparator),
        missingTeams: teamFiltered.missingTeams,
        notes
    };
}

function buildSummaryResponse(dataset) {
    const lines = [
        'EDGE MIND DATA SNAPSHOT',
        '',
        `Subscription Tier: ${String(dataset.UserSubscriptionTier || 'core').toUpperCase()}`,
        `Available Matches (Next ${VISIBLE_WINDOW_HOURS}h): ${dataset.AvailableMatchesToday.length}`,
        `Available Sports (Next ${VISIBLE_WINDOW_HOURS}h): ${dataset.AvailableSportsToday.join(', ') || 'none'}`,
        `Available Markets: ${dataset.AvailableMarkets.slice(0, 30).map(displayMarket).join(', ') || 'none'}`,
        `Daily Limits: ${formatDailyLimits(dataset.DailyLimits)}`
    ];
    return lines.join('\n');
}

function responseNoData(dataset) {
    return [
        `No visible matches are available in the next ${VISIBLE_WINDOW_HOURS} hours in your dataset.`,
        `Subscription Tier: ${String(dataset.UserSubscriptionTier || 'core').toUpperCase()}`,
        `Available Sports (Next ${VISIBLE_WINDOW_HOURS}h): ${dataset.AvailableSportsToday.join(', ') || 'none'}`
    ].join('\n');
}

async function generateBotResponse(req, res) {
    const message = normalizeText(req.body?.message);
    if (!message) {
        return res.status(400).json({
            success: false,
            error: 'Message is required.'
        });
    }

    try {
        const dataset = await buildDatasetForUser(req.user);
        if (!dataset.AvailableMatchesToday.length) {
            const reply = responseNoData(dataset);
            return res.status(200).json({
                success: true,
                reply,
                response: reply
            });
        }

        const intent = detectIntent(message);
        const requestedTeams = parseRequestedTeams(message, req.body?.teams || req.body?.selectedTeams);
        const preferredSports = parseSportPreference(message);
        const notes = [];

        if (asksForDisabledSport(message, preferredSports)) {
            return res.status(200).json({
                success: true,
                reply: DISABLED_SPORT_REPLY,
                response: DISABLED_SPORT_REPLY
            });
        }

        if (intent.mode === 'summary') {
            const reply = buildSummaryResponse(dataset);
            return res.status(200).json({
                success: true,
                reply,
                response: reply
            });
        }

        if (intent.mode === 'acca') {
            const accaPool = buildAccaPool(dataset, intent, requestedTeams, preferredSports);
            notes.push(...accaPool.notes);
            if (accaPool.missingTeams.length > 0) {
                notes.push(`Some teams are not available in the next ${VISIBLE_WINDOW_HOURS}h window. I will use available matches.`);
            }

            let targetSize = intent.mega ? ACCA_MEGA_SIZE : ACCA_DEFAULT_SIZE;
            if (intent.addMoreLegs) targetSize += 2;
            targetSize = Math.max(2, targetSize);

            const uniqueMatchCount = new Set(accaPool.pool.map((row) => row.match_id)).size;
            if (uniqueMatchCount < targetSize) {
                targetSize = uniqueMatchCount;
            }
            if (targetSize <= 0) {
                const reply = `No ACCA-eligible picks are available in the next ${VISIBLE_WINDOW_HOURS} hours in your visible dataset.`;
                return res.status(200).json({ success: true, reply, response: reply });
            }

            const selected = selectOnePickPerMatch(accaPool.pool, targetSize);

            if (selected.length < 2) {
                const reply = `No ACCA-eligible picks are available in the next ${VISIBLE_WINDOW_HOURS} hours in your visible dataset.`;
                return res.status(200).json({ success: true, reply, response: reply });
            }

            if (selected.length < (intent.mega ? ACCA_MEGA_SIZE : ACCA_DEFAULT_SIZE)) {
                notes.push(`Insufficient eligible matches for full size. Built ${selected.length} legs.`);
            }

            const title = intent.mega
                ? `MEGA ACCA (${selected.length} LEGS)`
                : `ACCA (${selected.length} LEGS)`;
            const reply = formatSelections(title, selected, notes);

            return res.status(200).json({
                success: true,
                reply,
                response: reply
            });
        }

        const poolResult = buildCandidatePool(dataset, intent, requestedTeams, preferredSports);
        if (poolResult.missingTeams.length > 0) {
            notes.push(`Some teams are not available in the next ${VISIBLE_WINDOW_HOURS}h window. I will use available matches.`);
        }
        if (intent.safer) {
            notes.push('Safer mode applied: lower-risk markets prioritized.');
        }
        if (intent.aggressive) {
            notes.push('Aggressive mode applied: highest-confidence mixed candidates selected.');
        }

        const count = Math.max(1, Number(req.body?.limit || DEFAULT_SINGLE_COUNT));
        const selected = selectOnePickPerMatch(poolResult.pool, count);

        if (!selected.length) {
            const reply = `No eligible picks are available in the next ${VISIBLE_WINDOW_HOURS} hours in your visible dataset.`;
            return res.status(200).json({ success: true, reply, response: reply });
        }

        let title = 'BEST PICKS TODAY';
        if (intent.mode === 'direct') title = `DIRECT MARKETS (${selected.length})`;
        if (intent.mode === 'safe') title = `SAFE PICKS (${selected.length})`;
        if (intent.mode === 'market_focus') {
            const focusLabel = intent.focus ? intent.focus.toUpperCase() : 'MARKET';
            title = `${focusLabel} PICKS (${selected.length})`;
        }

        const reply = formatSelections(title, selected, notes);
        return res.status(200).json({
            success: true,
            reply,
            response: reply
        });
    } catch (error) {
        console.error('[edgemind] deterministic engine error:', error);
        return res.status(500).json({
            success: false,
            error: `Failed to build Edge Mind response from the next ${VISIBLE_WINDOW_HOURS}h dataset window.`
        });
    }
}

module.exports = {
    generateBotResponse
};
