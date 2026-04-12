'use strict';

const { query, withTransaction } = require('../db');
const { validateRawPredictionInput } = require('../utils/validation');
const { filterRawPrediction } = require('./filterEngine');
const { getPredictionInputs } = require('./dataProvider');
const { scoreMatch } = require('./aiScoring');
const { validatePredictionSet, areLegsCompatible } = require('../utils/marketConsistency');
const { detectConflicts } = require('../utils/conflictResolver');
const { isValidCombination } = require('./conflictEngine');
const { scoreMarkets } = require('./marketScoringEngine');
const { validateInsightLegGroup } = require('../utils/insightValidationMatrix');
const {
    calculateTrueComboConfidence,
    calculateTicketCompoundProbability,
    filterExpiredFixtures,
    selectAccaLegs
} = require('../utils/accaLogicEngine');

const MEGA_ACCA_SIZE = 12;
const ACCA_SIZE = 6;
const SAME_MATCH_INSIGHT_TARGET = 6;
const ACCA_MIN_LEG_CONFIDENCE = 80;
const REQUIRED_FOOTBALL_ONLY_ACCAS = 2;
const MIXED_SPORT_TARGETS = new Set(['football', 'hockey', 'mma', 'afl', 'cricket', 'basketball']);

function normalizeTier(tier) {
    if (tier === 'normal' || tier === 'deep') return tier;
    throw new Error(`Invalid tier: ${tier}`);
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function computeTotalConfidence(predictions) {
    if (!predictions.length) return 0;
    const sum = predictions.reduce((acc, p) => acc + (typeof p.confidence === 'number' ? p.confidence : 0), 0);
    return Math.round((sum / predictions.length) * 100) / 100;
}

function computeCompoundConfidence(predictions) {
    return calculateTicketCompoundProbability(predictions);
}

// The weekly single-use insight policy follows the South African business week.
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

function startOfWeekSast(now = new Date()) {
    const current = new Date(now.getTime() + SAST_OFFSET_MS);
    const day = current.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    current.setUTCDate(current.getUTCDate() + diffToMonday);
    current.setUTCHours(0, 0, 0, 0);
    return new Date(current.getTime() - SAST_OFFSET_MS);
}

function endOfWeekSast(now = new Date()) {
    const start = startOfWeekSast(now);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return end;
}

function riskLevelFromConfidence(avgConfidence) {
    if (avgConfidence >= 80) return 'safe';
    if (avgConfidence >= 70) return 'medium';
    return 'medium';
}

function toLeg(p) {
    return {
        match_id: p.match_id,
        sport: p.sport,
        market: p.market,
        pick: p.prediction,
        confidence: p.confidence,
        volatility: p.volatility,
        odds: p.odds,
        metadata: p.metadata
    };
}

function isSmartCombo(p) {
    return p && p.type === 'SMART_COMBO' && Array.isArray(p.legs);
}

function getKickoffTimeFromMetadata(p) {
    const t = p?.metadata?.kickoff || p?.metadata?.kickoff_time || p?.metadata?.match_time || null;
    if (!t) return null;
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
}

function withinDays(from, to, days) {
    const ms = days * 24 * 60 * 60 * 1000;
    return Math.abs(to.getTime() - from.getTime()) <= ms;
}

function withinHours(from, to, hours) {
    const ms = hours * 60 * 60 * 1000;
    return Math.abs(to.getTime() - from.getTime()) <= ms;
}

function buildAccaV2({ tier, candidates, now = new Date() }) {
    const t = normalizeTier(tier);
    const list = Array.isArray(candidates) ? candidates.slice() : [];

    const minLegConfidence = 70;
    const minSize = 4;
    const maxSize = 6;

    // Flatten smart combos into a single "selection" with multiple legs,
    // but count it as ONE combo for the max-1 rule.
    const scored = list
        .map((p) => {
            if (isSmartCombo(p)) {
                const legs = p.legs.map((l) => ({
                    ...l,
                    market: l.market,
                    pick: l.pick,
                    confidence: l.confidence
                }));
                const confidence = typeof p.confidence === 'number' ? p.confidence : computeTotalConfidence(legs);
                return { kind: 'smart_combo', confidence, legs };
            }
            return { kind: 'single', confidence: p.confidence, legs: [toLeg(p)] };
        })
        .filter((x) => typeof x.confidence === 'number' && x.confidence >= minLegConfidence)
        .sort((a, b) => b.confidence - a.confidence);

    const picked = [];
    const usedMatchIds = new Set();
    let smartComboCount = 0;

    for (const item of scored) {
        if (picked.length >= maxSize) break;
        if (item.kind === 'smart_combo') {
            if (smartComboCount >= 1) continue;
        }

        const itemMatchIds = item.legs.map((l) => String(l.match_id || '').trim()).filter(Boolean);
        if (itemMatchIds.length !== item.legs.length) continue;
        if (itemMatchIds.some((id) => usedMatchIds.has(id))) continue;

        // Deep tier: enforce same day + kickoff window (if kickoff available)
        if (t === 'deep') {
            const kickoffs = item.legs.map(getKickoffTimeFromMetadata).filter(Boolean);
            if (kickoffs.length) {
                for (const k of kickoffs) {
                    const sameDay = k.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
                    if (!sameDay) {
                        // Deep must be same day
                        continue;
                    }
                    if (!withinHours(now, k, 2)) {
                        continue;
                    }
                }
            }
        } else {
            // Normal tier: allow within 5 days if kickoff available
            const kickoffs = item.legs.map(getKickoffTimeFromMetadata).filter(Boolean);
            if (kickoffs.length) {
                if (kickoffs.some((k) => !withinDays(now, k, 5))) continue;
            }
        }

        // Conflicts: validate within item + against already picked
        if (!isValidCombination(item.legs)) continue;
        const prospectiveLegs = picked.flatMap((x) => x.legs).concat(item.legs);
        if (!isValidCombination(prospectiveLegs)) continue;

        // Avoid using two markets from same match inside a single ACCA
        // (the "no duplicate matches" rule)
        for (const id of itemMatchIds) usedMatchIds.add(id);
        picked.push(item);
        if (item.kind === 'smart_combo') smartComboCount++;
    }

    if (picked.length < minSize) {
        return {
            ok: false,
            reason: 'not_enough_legs',
            legs: [],
            confidence: 0
        };
    }

    const legs = picked.flatMap((x) => x.legs).slice(0, maxSize);
    const confidence = clamp(computeTotalConfidence(legs), 0, 100);

    return {
        ok: true,
        legs,
        confidence,
        smartComboCount
    };
}

function combinations(arr, k) {
    const out = [];
    function rec(start, picked) {
        if (picked.length === k) {
            out.push(picked.slice());
            return;
        }
        for (let i = start; i < arr.length; i++) {
            picked.push(arr[i]);
            rec(i + 1, picked);
            picked.pop();
        }
    }
    rec(0, []);
    return out;
}

async function getTierRules(tier, client) {
    const t = normalizeTier(tier);
    const res = await client.query(
        `select tier, min_confidence, allowed_markets, max_acca_size, allowed_volatility from tier_rules where tier = $1 limit 1;`,
        [t]
    );
    if (!res.rows.length) throw new Error(`Missing tier_rules for tier=${t}`);
    return res.rows[0];
}

async function getAccaRules(client) {
    const res = await client.query('select rule_name, rule_value from acca_rules;');
    const rules = {};
    for (const row of res.rows) {
        rules[row.rule_name] = row.rule_value;
    }

    return {
        no_same_match: rules.no_same_match !== undefined ? rules.no_same_match : true,
        no_conflicting_markets: rules.no_conflicting_markets !== undefined ? rules.no_conflicting_markets : true,
        max_per_match: rules.max_per_match !== undefined ? rules.max_per_match : 1,
        allow_high_volatility: rules.allow_high_volatility !== undefined ? rules.allow_high_volatility : false
    };
}

function toFinalMatchPayload(p) {
    const metadata = getMetadata(p);
    const kickoff = metadata.match_time || metadata.kickoff || metadata.kickoff_time || null;
    const normalizedSport = normalizeSportKey(p.sport || metadata.sport || metadata.sport_key || '');
    const sportType = getSportTypeLabel(normalizedSport);
    return {
        raw_id: p.raw_id,
        match_id: p.match_id,
        sport: normalizedSport,
        sport_type: sportType,
        home_team: metadata.home_team || null,
        away_team: metadata.away_team || null,
        match_date: kickoff,
        commence_time: kickoff,
        market: p.market,
        prediction: p.prediction,
        confidence: p.confidence,
        volatility: p.volatility,
        odds: p.odds,
        metadata: {
            ...metadata,
            sport_type: sportType,
            weekly_team_lock_applied: true
        }
    };
}

function toScoringMatchPayload(prediction) {
    const metadata = prediction.metadata || {};
    const normalizedSport = normalizeSportKey(prediction.sport || metadata.sport || '');
    return {
        match_id: prediction.match_id,
        sport: normalizedSport,
        home_team: metadata.home_team || null,
        away_team: metadata.away_team || null,
        base_prediction: prediction.prediction || null,
        base_confidence: prediction.confidence,
        raw_provider_data: metadata.raw_provider_data || null
    };
}

function lineToToken(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return String(n).replace('.', '_');
}

function toSecondaryPayload(prediction, marketScore) {
    const normalizedMarket = String(marketScore.market || '').toUpperCase();
    const normalizedPick = String(marketScore.pick || '').toUpperCase();
    const line = Number(marketScore.line);
    const lineToken = lineToToken(line);
    let market = marketScore.legacyMarketHint || marketScore.market;

    if (normalizedMarket === 'DOUBLE_CHANCE') {
        market = `double_chance_${normalizedPick.toLowerCase()}`;
    } else if (normalizedMarket === 'OVER_UNDER_2_5') {
        market = normalizedPick === 'UNDER' ? 'under_2_5' : 'over_2_5';
    } else if (normalizedMarket === 'OVER_UNDER_1_5') {
        market = normalizedPick === 'UNDER' ? 'under_1_5' : 'over_1_5';
    } else if (normalizedMarket === 'BTTS') {
        market = normalizedPick === 'NO' ? 'btts_no' : 'btts_yes';
    } else if (normalizedMarket === 'CORNERS_OVER_UNDER') {
        const side = normalizedPick === 'UNDER' ? 'under' : 'over';
        market = lineToken ? `corners_${side}_${lineToken}` : `corners_${side}`;
    } else if (normalizedMarket === 'YELLOW_CARDS_OVER_UNDER') {
        const side = normalizedPick === 'UNDER' ? 'under' : 'over';
        market = lineToken ? `${side}_${lineToken}_yellows` : (side === 'under' ? 'under_3_5_yellows' : 'over_3_5_yellows');
    }

    return {
        raw_id: prediction.raw_id,
        match_id: prediction.match_id,
        sport: prediction.sport,
        market,
        prediction: marketScore.pick,
        confidence: marketScore.confidence,
        volatility: prediction.volatility,
        odds: prediction.odds,
        metadata: {
            ...(prediction.metadata || {}),
            market_type: marketScore.type,
            market_key: marketScore.market,
            market_description: marketScore.description,
            market_line: Number.isFinite(line) ? line : null,
            market_line_token: lineToken
        }
    };
}

function enforcePerMatchLimit(predictions, maxPerMatch) {
    const counts = new Map();
    const out = [];

    for (const p of predictions) {
        const key = p.match_id;
        const c = counts.get(key) || 0;
        if (c >= maxPerMatch) continue;
        counts.set(key, c + 1);
        out.push(p);
    }

    return out;
}

function getMetadata(prediction) {
    return prediction && typeof prediction.metadata === 'object' && prediction.metadata !== null
        ? prediction.metadata
        : {};
}

function parseKickoff(prediction) {
    const metadata = getMetadata(prediction);
    const value = metadata.match_time || metadata.kickoff || metadata.kickoff_time || prediction.match_date || prediction.commence_time || null;
    if (!value) return null;

    // Force strict parsing
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPublishWindowDays(tier) {
    return tier === 'deep' ? 5 : 7;
}

function normalizeSportKey(value) {
    const sport = String(value || '').trim().toLowerCase();
    if (!sport) return 'unknown';
    if (sport.startsWith('soccer_')) return 'football';
    if (sport.startsWith('icehockey_')) return 'hockey';
    if (sport === 'nhl') return 'hockey';
    if (sport.startsWith('basketball_')) return 'basketball';
    if (sport === 'nba') return 'basketball';
    if (sport.startsWith('americanfootball_')) return 'american_football';
    if (sport === 'nfl') return 'american_football';
    if (sport.startsWith('mma_')) return 'mma';
    if (sport.startsWith('aussierules_')) return 'afl';
    if (sport.startsWith('baseball_')) return 'baseball';
    if (sport.startsWith('rugbyunion_')) return 'rugby';
    return sport;
}

function getSportTypeLabel(sportKey) {
    const key = normalizeSportKey(sportKey);
    if (key === 'football') return 'Football';
    if (key === 'hockey') return 'Ice Hockey';
    if (key === 'mma') return 'Mixed Martial Arts';
    if (key === 'afl') return 'Aussie Rules';
    if (key === 'basketball') return 'Basketball';
    if (key === 'cricket') return 'Cricket';
    if (key === 'american_football') return 'American Football';
    if (key === 'baseball') return 'Baseball';
    if (key === 'rugby') return 'Rugby';
    return key
        .split('_')
        .filter(Boolean)
        .map((part) => part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function isPublishablePrediction(prediction, tier, now = new Date()) {
    const metadata = getMetadata(prediction);

    // Allow test data through
    if (metadata.data_mode === 'test') return true;
    
    // Check prediction source - be more lenient, allow both 'provider' and 'ai_fallback'
    const predictionSource = String(metadata.prediction_source || '').trim().toLowerCase();
    if (predictionSource && predictionSource !== 'provider' && predictionSource !== 'ai_fallback') {
        return false;
    }
    
    // League is important but not critical if we have other metadata
    if (typeof metadata.league !== 'string' || metadata.league.trim().length === 0) {
        // Allow if we have home/away teams
        if (!metadata.home_team || !metadata.away_team) {
            return false;
        }
    }

    const kickoff = parseKickoff(prediction);
    if (!kickoff) {
        console.log(`[accaBuilder] Rejecting prediction for match ${prediction.match_id}: kickoff time missing or invalid.`);
        return false;
    }

    // Strict pre-match rule: only fixtures strictly in the future are valid.
    if (kickoff.getTime() <= now.getTime()) {
        console.log(`[accaBuilder] Rejecting prediction for match ${prediction.match_id}: kickoff ${kickoff.toISOString()} is not strictly in the future.`);
        return false;
    }

    const maxWindowDays = getPublishWindowDays(tier);
    const maxFuture = new Date(now.getTime() + maxWindowDays * 24 * 60 * 60 * 1000);
    return kickoff <= maxFuture;
}

function compareCandidates(a, b, now = new Date()) {
    const kickoffA = parseKickoff(a);
    const kickoffB = parseKickoff(b);
    const upcomingA = kickoffA ? kickoffA >= now : false;
    const upcomingB = kickoffB ? kickoffB >= now : false;

    if (upcomingA !== upcomingB) {
        return upcomingA ? -1 : 1;
    }

    if (kickoffA && kickoffB) {
        const timeDiff = upcomingA && upcomingB
            ? kickoffA.getTime() - kickoffB.getTime()
            : kickoffB.getTime() - kickoffA.getTime();
        if (timeDiff !== 0) return timeDiff;
    } else if (kickoffA) {
        return -1;
    } else if (kickoffB) {
        return 1;
    }

    const confidenceDiff = (Number(b.confidence) || 0) - (Number(a.confidence) || 0);
    if (confidenceDiff !== 0) return confidenceDiff;

    const createdA = new Date(a.created_at || 0).getTime();
    const createdB = new Date(b.created_at || 0).getTime();
    return createdB - createdA;
}

function enforcePerSportLimit(predictions, limitPerSport) {
    const counts = new Map();
    const out = [];

    for (const prediction of predictions) {
        const key = normalizeSportKey(prediction.sport);
        const current = counts.get(key) || 0;
        if (current >= limitPerSport) continue;
        counts.set(key, current + 1);
        out.push(prediction);
    }

    return out;
}

function uniqueBy(rows, keyFn) {
    const seen = new Set();
    const out = [];
    for (const row of rows) {
        const key = keyFn(row);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(row);
    }
    return out;
}

function isSupplementaryDisplayMarket(market) {
    const normalized = String(market || '').trim().toLowerCase();
    if (!normalized) return false;
    return normalized !== 'corners_under' && normalized !== 'corners_over';
}

function isCompatibleWithPrimaryPrediction(prediction, candidate) {
    return areLegsCompatible(
        {
            market: prediction?.market,
            prediction: prediction?.prediction
        },
        {
            market: candidate?.market,
            prediction: candidate?.prediction
        }
    );
}

function toConflictCheckLeg(leg) {
    const marketKey = String(leg?.market || '').trim().toLowerCase();
    const predictionKey = String(leg?.prediction || leg?.pick || '').trim().toLowerCase();
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

function sanitizeSameMatchLegGroup(legs) {
    const out = [];

    for (const leg of legs) {
        const prospective = [...out, leg]
            .map(toConflictCheckLeg)
            .filter(Boolean);

        if (prospective.length > 0 && !isValidCombination(prospective)) {
            continue;
        }

        out.push(leg);
    }

    return out;
}

async function buildDerivedMarkets(prediction, options = {}) {
    const includeTypes = new Set(
        Array.isArray(options.includeTypes) && options.includeTypes.length
            ? options.includeTypes
            : ['secondary', 'advanced']
    );
    const excludeMarkets = new Set(
        (Array.isArray(options.excludeMarkets) ? options.excludeMarkets : [])
            .map((market) => String(market || '').toUpperCase())
    );
    const maxRows = Number.isFinite(options.maxRows) ? options.maxRows : 1;
    const requireDisplayFriendlyMarkets = options.requireDisplayFriendlyMarkets === true;

    return uniqueBy(
        (await scoreMarkets(toScoringMatchPayload(prediction)))
            .filter((market) => includeTypes.has(market.type))
            .filter((market) => !excludeMarkets.has(String(market.market || '').toUpperCase()))
            .sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0))
            .map((market) => toSecondaryPayload(prediction, market))
            .filter((candidate) => isCompatibleWithPrimaryPrediction(prediction, candidate))
            .filter((candidate) => !requireDisplayFriendlyMarkets || isSupplementaryDisplayMarket(candidate.market)),
        (row) => `${row.match_id}:${row.market}`
    ).slice(0, maxRows);
}

async function buildSecondaryCandidates(predictions) {
    const secondary = [];

    for (const prediction of predictions) {
        const primaryLeg = toFinalMatchPayload(prediction);
        const candidates = await buildDerivedMarkets(prediction, {
            includeTypes: ['secondary', 'advanced'],
            requireDisplayFriendlyMarkets: true,
            maxRows: 2
        });

        for (const candidate of candidates) {
            const candidateLeg = toFinalMatchPayload(candidate);
            const validation = validateInsightLegGroup([primaryLeg, candidateLeg]);
            if (!validation.valid) continue;

            secondary.push({
                ...candidate,
                metadata: {
                    ...(candidate.metadata || {}),
                    validation_matrix: validation
                }
            });
        }
    }

    return uniqueBy(secondary, (row) => `${row.match_id}:${row.market}`);
}

async function buildSameMatchCandidates(predictions) {
    const out = [];
    for (const prediction of predictions) {
        const derived = await buildDerivedMarkets(prediction, {
            includeTypes: ['primary', 'secondary', 'advanced'],
            excludeMarkets: ['MATCH_RESULT', 'MATCH_WINNER', 'WINNER', 'RACE_WINNER'],
            maxRows: SAME_MATCH_INSIGHT_TARGET - 1
        });
        if (derived.length === 0) continue;

        const legs = sanitizeSameMatchLegGroup([
            toFinalMatchPayload(prediction),
            ...derived.map(toFinalMatchPayload)
        ]).slice(0, SAME_MATCH_INSIGHT_TARGET);
        if (legs.length < 2) continue;

        const validation = validateInsightLegGroup(legs);
        if (!validation.valid) continue;

        const validatedLegs = legs.map((leg) => ({
            ...leg,
            metadata: {
                ...(leg.metadata || {}),
                validation_matrix: validation
            }
        }));

        out.push({
            match_id: prediction.match_id,
            matches: validatedLegs,
            total_confidence: computeTotalConfidence(validatedLegs),
            risk_level: riskLevelFromConfidence(computeTotalConfidence(validatedLegs))
        });
    }

    return out;
}

function buildMultiCandidates(predictions, maxRows = 16) {
    const direct = predictions.slice(0, 12);
    const combos = [];

    for (let size = 2; size <= 3; size++) {
        for (const combo of combinations(direct, size)) {
            const ids = combo.map((row) => row.match_id);
            if (new Set(ids).size !== ids.length) continue;
            const legs = combo.map(toFinalMatchPayload);
            combos.push({
                match_id: ids.join('|'),
                matches: legs,
                total_confidence: computeTotalConfidence(legs),
                risk_level: riskLevelFromConfidence(computeTotalConfidence(legs))
            });
        }
    }

    return combos
        .sort((a, b) => b.total_confidence - a.total_confidence)
        .slice(0, maxRows);
}

function normalizeMarketForAcca(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function normalizePickForAcca(value) {
    return String(value || '').trim().toLowerCase();
}

function pickToWinnerToken(pick) {
    const token = normalizePickForAcca(pick);
    if (token === 'home' || token === 'team_1' || token === 'player_1' || token === 'fighter_1') return 'home_win';
    if (token === 'away' || token === 'team_2' || token === 'player_2' || token === 'fighter_2') return 'away_win';
    if (token === 'draw') return 'draw';
    return token;
}

function parseGoalLineFromMarketScore(marketScore) {
    const normalized = String(marketScore?.market || '').toUpperCase();
    if (normalized === 'OVER_UNDER_0_5') return 0.5;
    if (normalized === 'OVER_UNDER_1_5') return 1.5;
    if (normalized === 'OVER_UNDER_2_5') return 2.5;
    if (normalized === 'OVER_UNDER_3_5') return 3.5;
    if (normalized === 'OVER_UNDER_4_5') return 4.5;
    if (normalized === 'OVER_UNDER_5_5') return 5.5;
    const line = Number(marketScore?.line);
    return Number.isFinite(line) ? line : null;
}

function parseLineTokenFromPick(pick = '') {
    const token = String(pick || '').trim().toLowerCase();
    const match = token.match(/_(\d+)_(\d+)$/);
    if (!match) return null;
    return `${match[1]}_${match[2]}`;
}

function resolveLineTokenForMarketScore(marketScore, fallback = '2_5') {
    const line = parseGoalLineFromMarketScore(marketScore);
    const fromLine = lineToToken(line);
    if (fromLine) return fromLine;
    const fromPick = parseLineTokenFromPick(marketScore?.pick);
    return fromPick || fallback;
}

function buildAccaCandidateFromMarketScore(prediction, marketScore) {
    const metadata = getMetadata(prediction);
    const sport = normalizeSportKey(prediction.sport || metadata.sport || '');
    const sportType = getSportTypeLabel(sport);
    const normalizedMarket = String(marketScore?.market || '').toUpperCase();
    const pick = String(marketScore?.pick || '').toUpperCase();
    const pickLower = normalizePickForAcca(pick);
    const confidence = Number(marketScore?.confidence);
    if (!Number.isFinite(confidence)) return null;

    let market = normalizeMarketForAcca(marketScore?.market || prediction.market);
    let predictionValue = pickLower;

    if (normalizedMarket === 'MATCH_RESULT') {
        market = '1x2';
        predictionValue = pick === 'DRAW' ? 'draw' : (pick === 'AWAY' ? 'away_win' : 'home_win');
    } else if (normalizedMarket === 'DOUBLE_CHANCE') {
        market = `double_chance_${pickLower}`;
        predictionValue = pickLower;
    } else if (normalizedMarket === 'DRAW_NO_BET') {
        market = pick === 'AWAY' ? 'draw_no_bet_away' : 'draw_no_bet_home';
        predictionValue = pick === 'AWAY' ? 'away' : 'home';
    } else if (normalizedMarket === 'BTTS') {
        market = pick === 'NO' ? 'btts_no' : 'btts_yes';
        predictionValue = pick === 'NO' ? 'no' : 'yes';
    } else if (normalizedMarket.startsWith('OVER_UNDER_')) {
        const line = parseGoalLineFromMarketScore(marketScore);
        const lineToken = lineToToken(line);
        if (lineToken) {
            market = `${pickLower}_${lineToken}`;
        } else if (normalizedMarket === 'OVER_UNDER_2_5') {
            market = pick === 'UNDER' ? 'under_2_5' : 'over_2_5';
        } else if (normalizedMarket === 'OVER_UNDER_1_5') {
            market = pick === 'UNDER' ? 'under_1_5' : 'over_1_5';
        }
        predictionValue = market;
    } else if (normalizedMarket === 'MATCH_WINNER' || normalizedMarket === 'WINNER' || normalizedMarket === 'RACE_WINNER') {
        market = normalizedMarket === 'RACE_WINNER' ? 'race_winner' : 'match_winner';
        predictionValue = pickToWinnerToken(pick);
    } else if (normalizedMarket === 'TOTAL_POINTS') {
        market = `total_points_${pickLower}`;
        predictionValue = pickLower;
    } else if (normalizedMarket === 'TOTAL_GOALS') {
        market = `total_goals_${pickLower}`;
        predictionValue = pickLower;
    } else if (normalizedMarket === 'TEAM_TOTAL_GOALS') {
        const sideMatch = pickLower.match(/^(home|away)_(over|under)$/);
        const lineToken = resolveLineTokenForMarketScore(marketScore, '1_5');
        if (sideMatch) {
            market = `team_total_${sideMatch[1]}_${sideMatch[2]}_${lineToken}`;
            predictionValue = `${sideMatch[1]}_${sideMatch[2]}_${lineToken}`;
        } else {
            market = `team_total_${pickLower}`;
            predictionValue = pickLower;
        }
    } else if (normalizedMarket === 'TOTAL_RUNS') {
        market = `total_runs_${pickLower}`;
        predictionValue = pickLower;
    } else if (normalizedMarket === 'TOTAL_GAMES') {
        market = `total_games_${pickLower}`;
        predictionValue = pickLower;
    } else if (normalizedMarket === 'COMBO_MATCH_RESULT_OVER_UNDER') {
        const comboMatch = pickLower.match(/^(home|away|draw)_(over|under)_(\d+)_(\d+)$/);
        if (comboMatch) {
            market = `combo_${comboMatch[1]}_and_${comboMatch[2]}_${comboMatch[3]}_${comboMatch[4]}`;
            predictionValue = `${comboMatch[1]}+${comboMatch[2]}_${comboMatch[3]}_${comboMatch[4]}`;
        }
    } else if (normalizedMarket === 'COMBO_DC_OVER_UNDER') {
        const comboMatch = pickLower.match(/^(1x|x2|12)_(over|under)_(\d+)_(\d+)$/);
        if (comboMatch) {
            market = `combo_dc_${comboMatch[1]}_and_${comboMatch[2]}_${comboMatch[3]}_${comboMatch[4]}`;
            predictionValue = `${comboMatch[1]}+${comboMatch[2]}_${comboMatch[3]}_${comboMatch[4]}`;
        }
    } else if (normalizedMarket === 'COMBO_BTTS_OVER_UNDER') {
        const comboMatch = pickLower.match(/^(yes|no)_(over|under)_(\d+)_(\d+)$/);
        if (comboMatch) {
            market = `combo_btts_${comboMatch[1]}_and_${comboMatch[2]}_${comboMatch[3]}_${comboMatch[4]}`;
            predictionValue = `${comboMatch[1]}+${comboMatch[2]}_${comboMatch[3]}_${comboMatch[4]}`;
        }
    } else if (normalizedMarket === 'HANDICAP' || normalizedMarket === 'SPREAD' || normalizedMarket === 'SET_HANDICAP') {
        market = normalizeMarketForAcca(marketScore.market);
        predictionValue = pickLower;
    } else if (normalizedMarket === 'EUROPEAN_HANDICAP' || normalizedMarket === 'ASIAN_HANDICAP') {
        market = normalizedMarket === 'EUROPEAN_HANDICAP' ? 'european_handicap' : 'asian_handicap';
        predictionValue = pickLower;
    } else if (normalizedMarket === 'HT_FT') {
        market = `ht_ft_${pickLower}`;
        predictionValue = pickLower;
    } else if (normalizedMarket === 'METHOD') {
        market = 'method_of_victory';
        predictionValue = pickLower;
    } else if (normalizedMarket === 'SET_BETTING' || normalizedMarket === 'MAP_SCORE') {
        market = normalizeMarketForAcca(marketScore.market);
        predictionValue = pickLower;
    } else if (normalizedMarket === 'PODIUM') {
        market = 'podium_finish';
        predictionValue = pickLower;
    } else if (normalizedMarket === 'TOP_10') {
        market = 'top_10_finish';
        predictionValue = pickLower;
    }

    return {
        raw_id: prediction.raw_id,
        match_id: prediction.match_id,
        sport,
        market,
        prediction: predictionValue,
        confidence,
        volatility: prediction.volatility,
        odds: prediction.odds,
        metadata: {
            ...metadata,
            sport_type: sportType,
            market_key: normalizedMarket,
            market_type: marketScore?.type || null,
            market_description: marketScore?.description || null,
            market_line: Number.isFinite(Number(marketScore?.line)) ? Number(marketScore.line) : null,
            source_market_confidence: confidence
        }
    };
}

function buildExpandedFootballGoalLineCandidates(prediction, scoredMarkets = [], minConfidence = ACCA_MIN_LEG_CONFIDENCE) {
    const sport = normalizeSportKey(prediction?.sport);
    if (sport !== 'football') return [];

    const base = scoredMarkets
        .filter((row) => String(row?.market || '').toUpperCase() === 'OVER_UNDER_2_5')
        .sort((a, b) => Number(b?.confidence || 0) - Number(a?.confidence || 0))[0];
    if (!base || !Number.isFinite(Number(base.confidence))) return [];

    const pick = String(base.pick || '').toUpperCase();
    if (pick !== 'OVER' && pick !== 'UNDER') return [];

    const adjustments = pick === 'OVER'
        ? [[3.5, 4], [4.5, 8], [5.5, 12]]
        : [[3.5, 3], [4.5, 5], [5.5, 7]];
    const out = [];

    for (const [line, penalty] of adjustments) {
        const confidence = Math.round((Number(base.confidence) - penalty) * 100) / 100;
        if (confidence < minConfidence) continue;
        const lineToken = lineToToken(line);
        if (!lineToken) continue;
        const market = `${pick.toLowerCase()}_${lineToken}`;
        out.push({
            raw_id: prediction.raw_id,
            match_id: prediction.match_id,
            sport: 'football',
            market,
            prediction: market,
            confidence,
            volatility: prediction.volatility,
            odds: prediction.odds,
            metadata: {
                ...getMetadata(prediction),
                sport_type: getSportTypeLabel('football'),
                market_key: `OVER_UNDER_${lineToken}`,
                market_type: 'secondary',
                market_line: line,
                market_description: `Total goals ${pick.toLowerCase()} ${line}`,
                synthetic_market: true
            }
        });
    }

    return out;
}

function buildFootballComboCandidates(prediction, scoredMarkets = [], minConfidence = ACCA_MIN_LEG_CONFIDENCE) {
    const sport = normalizeSportKey(prediction?.sport);
    if (sport !== 'football') return [];

    const byMarket = new Map();
    for (const market of scoredMarkets) {
        const key = String(market?.market || '').toUpperCase();
        if (!byMarket.has(key)) byMarket.set(key, []);
        byMarket.get(key).push(market);
    }

    for (const rows of byMarket.values()) {
        rows.sort((a, b) => Number(b?.confidence || 0) - Number(a?.confidence || 0));
    }

    const dc = (byMarket.get('DOUBLE_CHANCE') || [])[0] || null;
    const btts = (byMarket.get('BTTS') || [])[0] || null;
    const result = (byMarket.get('MATCH_RESULT') || [])[0] || null;
    const ou25 = (byMarket.get('OVER_UNDER_2_5') || [])[0] || null;
    const preferredGoalMarkets = [
        ...(byMarket.get('OVER_UNDER_2_5') || []),
        ...(byMarket.get('OVER_UNDER_3_5') || []),
        ...(byMarket.get('OVER_UNDER_1_5') || [])
    ].sort((a, b) => Number(b?.confidence || 0) - Number(a?.confidence || 0));
    const ouBest = preferredGoalMarkets[0] || null;

    const out = [];
    if (dc && btts) {
        const comboConfidence = calculateTrueComboConfidence(dc.confidence, btts.confidence, {
            marketA: 'DOUBLE_CHANCE',
            pickA: dc.pick,
            marketB: 'BTTS',
            pickB: btts.pick
        });
        if (comboConfidence >= minConfidence) {
            const dcPick = normalizePickForAcca(dc.pick);
            const bttsPick = normalizePickForAcca(btts.pick);
            out.push({
                raw_id: prediction.raw_id,
                match_id: prediction.match_id,
                sport: 'football',
                market: `combo_dc_${dcPick}_btts_${bttsPick}`,
                prediction: `${dcPick}+${bttsPick}`,
                confidence: comboConfidence,
                volatility: prediction.volatility,
                odds: prediction.odds,
                metadata: {
                    ...getMetadata(prediction),
                    sport_type: getSportTypeLabel('football'),
                    market_key: 'COMBO_DOUBLE_CHANCE_BTTS',
                    market_type: 'advanced',
                    market_description: `Double Chance ${dcPick.toUpperCase()} + BTTS ${bttsPick.toUpperCase()}`,
                    synthetic_market: true
                }
            });
        }
    }

    if (dc && ouBest) {
        const dcPick = normalizePickForAcca(dc.pick);
        const ouPick = normalizePickForAcca(ouBest.pick);
        const lineToken = resolveLineTokenForMarketScore(ouBest, '2_5');
        const comboConfidence = calculateTrueComboConfidence(dc.confidence, ouBest.confidence, {
            marketA: 'DOUBLE_CHANCE',
            pickA: dc.pick,
            marketB: ouBest.market,
            pickB: ouBest.pick
        });
        if (comboConfidence >= minConfidence) {
            out.push({
                raw_id: prediction.raw_id,
                match_id: prediction.match_id,
                sport: 'football',
                market: `combo_dc_${dcPick}_and_${ouPick}_${lineToken}`,
                prediction: `${dcPick}+${ouPick}_${lineToken}`,
                confidence: comboConfidence,
                volatility: prediction.volatility,
                odds: prediction.odds,
                metadata: {
                    ...getMetadata(prediction),
                    sport_type: getSportTypeLabel('football'),
                    market_key: 'COMBO_DC_OVER_UNDER',
                    market_type: 'advanced',
                    market_description: `Double Chance ${dcPick.toUpperCase()} + ${ouPick.toUpperCase()} ${lineToken.replace('_', '.')} Goals`,
                    synthetic_market: true
                }
            });
        }
    }

    if (btts && ouBest) {
        const bttsPick = normalizePickForAcca(btts.pick);
        const ouPick = normalizePickForAcca(ouBest.pick);
        const lineToken = resolveLineTokenForMarketScore(ouBest, '2_5');
        const comboConfidence = calculateTrueComboConfidence(btts.confidence, ouBest.confidence, {
            marketA: 'BTTS',
            pickA: btts.pick,
            marketB: ouBest.market,
            pickB: ouBest.pick
        });
        if (comboConfidence >= minConfidence) {
            out.push({
                raw_id: prediction.raw_id,
                match_id: prediction.match_id,
                sport: 'football',
                market: `combo_btts_${bttsPick}_and_${ouPick}_${lineToken}`,
                prediction: `${bttsPick}+${ouPick}_${lineToken}`,
                confidence: comboConfidence,
                volatility: prediction.volatility,
                odds: prediction.odds,
                metadata: {
                    ...getMetadata(prediction),
                    sport_type: getSportTypeLabel('football'),
                    market_key: 'COMBO_BTTS_OVER_UNDER',
                    market_type: 'advanced',
                    market_description: `BTTS ${bttsPick.toUpperCase()} + ${ouPick.toUpperCase()} ${lineToken.replace('_', '.')} Goals`,
                    synthetic_market: true
                }
            });
        }
    }

    if (result && ou25) {
        const winnerToken = normalizePickForAcca(result.pick);
        const ouPick = normalizePickForAcca(ou25.pick);
        const comboConfidence = calculateTrueComboConfidence(result.confidence, ou25.confidence, {
            marketA: 'MATCH_RESULT',
            pickA: result.pick,
            marketB: 'OVER_UNDER_2_5',
            pickB: ou25.pick
        });
        if (comboConfidence >= minConfidence) {
            out.push({
                raw_id: prediction.raw_id,
                match_id: prediction.match_id,
                sport: 'football',
                market: `combo_${winnerToken}_and_${ouPick}_2_5`,
                prediction: `${winnerToken}+${ouPick}_2_5`,
                confidence: comboConfidence,
                volatility: prediction.volatility,
                odds: prediction.odds,
                metadata: {
                    ...getMetadata(prediction),
                    sport_type: getSportTypeLabel('football'),
                    market_key: 'COMBO_MATCH_RESULT_OU_2_5',
                    market_type: 'advanced',
                    market_description: `Match Result ${winnerToken.toUpperCase()} + ${ouPick.toUpperCase()} 2.5 Goals`,
                    synthetic_market: true
                }
            });
        }
    }

    return out;
}

function normalizedAccaMarketKey(candidate) {
    return normalizeMarketForAcca(candidate?.market || candidate?.metadata?.market_key || '');
}

function isSaferAccumulatorMarket(candidate) {
    const market = normalizedAccaMarketKey(candidate);
    if (!market) return false;
    if (market.startsWith('double_chance_')) return true;
    if (market.startsWith('draw_no_bet_')) return true;
    if (market.startsWith('combo_') || market.startsWith('combo_dc_')) return true;
    if (market.startsWith('team_total_')) return true;
    if (market.includes('handicap')) return true;
    if (market.startsWith('ht_ft_')) return true;
    if (market.startsWith('over_') || market.startsWith('under_')) return true;
    if (market.startsWith('btts_')) return true;
    return false;
}

function accumulatorMarketPriorityScore(candidate) {
    const market = normalizedAccaMarketKey(candidate);
    if (!market) return 0;
    if (market.startsWith('combo_dc_') || market.startsWith('combo_')) return 5;
    if (market.startsWith('double_chance_') || market.startsWith('draw_no_bet_')) return 4;
    if (market.startsWith('under_') || market.startsWith('over_') || market.startsWith('btts_') || market.startsWith('team_total_') || market.includes('handicap') || market.startsWith('ht_ft_')) return 3;
    if (market === 'match_winner') return 2;
    if (market === '1x2') return 1;
    return 2;
}

function parseGoalLineFromAccumulatorMarket(market = '') {
    const normalized = normalizeMarketForAcca(market);
    const match = normalized.match(/(?:^|_)(\d+)_(\d+)$/);
    if (!match) return null;
    const whole = Number(match[1]);
    const decimal = Number(match[2]);
    if (!Number.isFinite(whole) || !Number.isFinite(decimal)) return null;
    return Number(`${whole}.${decimal}`);
}

function isLowValueAccumulatorMarket(candidate) {
    const market = normalizedAccaMarketKey(candidate);
    if (!market) return false;

    const directLowValue = market === 'over_0_5' || market.includes('_over_0_5');
    if (directLowValue) return true;

    if (market.startsWith('over_') || market.includes('_over_')) {
        const line = parseGoalLineFromAccumulatorMarket(market);
        if (Number.isFinite(line) && line <= 1.5) return true;
    }

    return false;
}

function isEscalatedValueAccumulatorMarket(candidate) {
    const market = normalizedAccaMarketKey(candidate);
    if (!market) return false;
    if (market.startsWith('combo_') || market.startsWith('combo_dc_')) return true;
    if (market.startsWith('double_chance_') || market.startsWith('draw_no_bet_')) return true;
    if (market.startsWith('btts_')) return true;
    if (market.startsWith('team_total_')) return true;
    if (market.includes('handicap')) return true;
    if (market.startsWith('ht_ft_')) return true;
    if (market.startsWith('over_') || market.startsWith('under_')) {
        const line = parseGoalLineFromAccumulatorMarket(market);
        return Number.isFinite(line) ? line >= 2.5 : true;
    }
    return false;
}

function applyMinimumValueConstraint(candidatePool, minConfidenceFloor) {
    if (!Array.isArray(candidatePool) || candidatePool.length === 0) return null;
    const best = candidatePool[0];
    if (!best) return null;

    const bestConfidence = Number(best?.confidence || 0);
    if (!isLowValueAccumulatorMarket(best) || bestConfidence < 95) {
        return best;
    }

    const escalatedCandidates = candidatePool
        .filter((candidate) => Number(candidate?.confidence || 0) >= minConfidenceFloor)
        .filter(isEscalatedValueAccumulatorMarket)
        .sort(compareAccaCandidatePreference);

    if (!escalatedCandidates.length) {
        return best;
    }

    const upgraded = escalatedCandidates[0];
    return {
        ...upgraded,
        metadata: {
            ...(upgraded.metadata || {}),
            minimum_value_constraint_applied: true,
            minimum_value_escalated_from: normalizedAccaMarketKey(best)
        }
    };
}

function isComboConditionAccumulatorMarket(candidate) {
    const market = normalizedAccaMarketKey(candidate);
    if (!market) return false;
    return market.startsWith('combo_') || market.startsWith('combo_dc_');
}

function resolveComboConditionCap(size, options = {}) {
    if (Number(size) === ACCA_SIZE) return 2;
    if (Number(size) === MEGA_ACCA_SIZE) return 4;
    if (options.isMega === true) return 4;
    return Infinity;
}

function selectBestAccaCandidateFromPool(candidatePool, minConfidenceFloor) {
    if (!Array.isArray(candidatePool) || candidatePool.length === 0) return null;
    const ranked = candidatePool.slice().sort(compareAccaCandidatePreference);
    const constrained = applyMinimumValueConstraint(ranked, minConfidenceFloor);
    const selected = constrained || ranked[0] || null;
    if (!selected) return null;
    return {
        ...selected,
        metadata: {
            ...(selected.metadata || {}),
            depth_first_full_scoring_applied: true,
            evaluated_market_count: ranked.length
        }
    };
}

function compareAccaCandidatePreference(a, b) {
    const confidenceDiff = Number(b?.confidence || 0) - Number(a?.confidence || 0);
    if (confidenceDiff !== 0) return confidenceDiff;

    const marketPriorityDiff = accumulatorMarketPriorityScore(b) - accumulatorMarketPriorityScore(a);
    if (marketPriorityDiff !== 0) return marketPriorityDiff;

    const saferA = isSaferAccumulatorMarket(a);
    const saferB = isSaferAccumulatorMarket(b);
    if (saferA !== saferB) return saferB ? 1 : -1;

    return compareAccaCandidates(a, b);
}

function compareAccaCandidates(a, b) {
    const confidenceDiff = Number(b?.confidence || 0) - Number(a?.confidence || 0);
    if (confidenceDiff !== 0) return confidenceDiff;
    const kickoffA = parseKickoff(a);
    const kickoffB = parseKickoff(b);
    if (kickoffA && kickoffB) return kickoffA.getTime() - kickoffB.getTime();
    if (kickoffA) return -1;
    if (kickoffB) return 1;
    return 0;
}

function getAccaCandidateFixtureIds(candidate) {
    return predictionFixtureIds(candidate);
}

function deriveAccaMarketType(candidate) {
    const raw = String(candidate?.metadata?.market_key || candidate?.market || '').trim().toLowerCase();
    if (!raw) return 'market';
    if (raw.startsWith('combo_')) return raw;
    if (raw.startsWith('draw_no_bet')) return 'draw_no_bet';
    if (raw.startsWith('double_chance')) return 'double_chance';
    if (raw.startsWith('asian_handicap')) return 'asian_handicap';
    if (raw.startsWith('european_handicap')) return 'european_handicap';
    if (raw.startsWith('team_total')) return 'team_total_goals';
    if (raw.startsWith('btts')) return 'btts';
    if (raw.startsWith('ht_ft')) return 'ht_ft';
    if (raw.startsWith('over_') || raw.startsWith('under_') || raw.startsWith('over_under')) return 'over_under';
    if (raw === '1x2' || raw === 'match_result' || raw === 'match_winner' || raw === 'winner') return '1x2';
    return raw;
}

function buildSelectableFixturePool(candidates, minConfidenceFloor) {
    const byFixture = new Map();

    for (const candidate of Array.isArray(candidates) ? candidates : []) {
        const confidence = Number(candidate?.confidence);
        if (!Number.isFinite(confidence) || confidence < minConfidenceFloor) continue;
        const fixtureIds = getAccaCandidateFixtureIds(candidate);
        const fixtureId = fixtureIds[0];
        if (!fixtureId) continue;

        const metadata = getMetadata(candidate);
        const home = String(metadata?.home_team || candidate?.home_team || '').trim();
        const away = String(metadata?.away_team || candidate?.away_team || '').trim();
        const fixtureName = home && away ? `${home} vs ${away}` : String(candidate?.match_id || fixtureId);

        if (!byFixture.has(fixtureId)) {
            byFixture.set(fixtureId, {
                id: fixtureId,
                name: fixtureName || 'Unknown Match',
                sport: normalizeSportKey(candidate?.sport),
                scoredMarkets: []
            });
        }

        byFixture.get(fixtureId).scoredMarkets.push({
            name: candidate?.market || 'unknown_market',
            prediction: candidate?.prediction || 'unknown',
            confidence,
            type: deriveAccaMarketType(candidate),
            _candidate: candidate
        });
    }

    const fixtures = Array.from(byFixture.values());
    for (const fixture of fixtures) {
        fixture.scoredMarkets.sort((a, b) => Number(b?.confidence || 0) - Number(a?.confidence || 0));
    }

    return fixtures;
}

function resolveSelectedLegCandidate(selectedLeg, fixtures) {
    const fixtureId = String(selectedLeg?.fixture_id || '').trim();
    if (!fixtureId) return null;

    const fixture = (Array.isArray(fixtures) ? fixtures : []).find((entry) => String(entry?.id || '').trim() === fixtureId);
    if (!fixture) return null;

    const marketKey = normalizeMarketForAcca(selectedLeg?.market || '');
    const predictionKey = normalizePickForAcca(selectedLeg?.prediction || '');
    const direct = fixture.scoredMarkets.find((market) =>
        normalizeMarketForAcca(market?.name || '') === marketKey
        && normalizePickForAcca(market?.prediction || '') === predictionKey
    );
    if (direct && direct._candidate) return direct._candidate;

    const fallback = fixture.scoredMarkets.find((market) =>
        normalizeMarketForAcca(market?.name || '') === marketKey
    ) || fixture.scoredMarkets[0];
    return fallback?._candidate || null;
}

function isCandidateUsedGlobally(candidate, globalUsedFixtures) {
    const ids = getAccaCandidateFixtureIds(candidate);
    if (!ids.length) return true;
    return ids.some((fixtureId) => globalUsedFixtures.has(fixtureId));
}

function canReserveCandidate(candidate, globallyUsedFixtureIds, locallyUsedFixtureIds) {
    const ids = getAccaCandidateFixtureIds(candidate);
    if (!ids.length) return false;
    return !ids.some((id) => globallyUsedFixtureIds.has(id) || locallyUsedFixtureIds.has(id));
}

function reserveCandidate(candidate, usedFixtureIds) {
    for (const id of new Set(getAccaCandidateFixtureIds(candidate))) {
        usedFixtureIds.add(id);
    }
}

function finalizeAccumulatorRow(legs, options = {}) {
    const profile = String(options.profile || 'mixed_sport');
    const minLegConfidenceFloor = Number(options.minLegConfidenceFloor || ACCA_MIN_LEG_CONFIDENCE);
    const isMega = options.isMega === true;
    const legCount = Number(legs?.length || 0);
    const ticketLabel = legCount >= MEGA_ACCA_SIZE ? '12 MATCH MEGA ACCA' : '6 MATCH ACCA';

    // Compute diversity breakdown: count market families across legs
    const diversityBreakdown = {};
    legs.forEach((leg) => {
        const marketType = String(leg?.market || leg?.metadata?.market || '').toLowerCase();
        let family = 'other';
        if (marketType.includes('combo')) family = 'combo';
        else if (marketType.includes('double_chance')) family = 'double_chance';
        else if (marketType.includes('draw_no_bet')) family = 'draw_no_bet';
        else if (marketType.includes('team_total')) family = 'team_total';
        else if (marketType.includes('over') || marketType.includes('under')) family = 'totals';
        else if (marketType.includes('btts')) family = 'btts';
        else if (marketType.includes('handicap')) family = 'handicap';
        else if (marketType.includes('half')) family = 'half_time';
        else if (marketType.includes('corner')) family = 'corners';
        else if (marketType.includes('card')) family = 'cards';
        else if (marketType.includes('winner') || marketType === '1x2' || marketType.includes('match_result')) family = 'match_result';
        diversityBreakdown[family] = (diversityBreakdown[family] || 0) + 1;
    });

    const payloadLegs = legs.map((leg) => {
        const finalLeg = toFinalMatchPayload(leg);
        finalLeg.metadata = {
            ...(finalLeg.metadata || {}),
            sport_type: getSportTypeLabel(finalLeg.sport),
            acca_profile: profile,
            acca_profile_label: profile === 'football_only' ? 'Football ACCA' : 'Mixed Sport ACCA',
            acca_ticket_label: ticketLabel,
            min_leg_confidence_floor: minLegConfidenceFloor
        };
        if (isMega) {
            finalLeg.metadata.mega_acca_leg = true;
        }
        return finalLeg;
    });

    const averageLegConfidence = computeTotalConfidence(payloadLegs);
    const totalConfidence = computeCompoundConfidence(payloadLegs);
    const totalTicketProbability = totalConfidence.toFixed(2) + '%';

    const payloadLegsWithConfidenceMeta = payloadLegs.map((leg) => ({
        ...leg,
        metadata: {
            ...(leg.metadata || {}),
            display_label: ticketLabel,
            average_leg_confidence: averageLegConfidence,
            compound_ticket_confidence: totalConfidence,
            total_ticket_probability_display: totalTicketProbability
        }
    }));

    return {
        match_id: payloadLegsWithConfidenceMeta.map((leg) => leg.match_id).filter(Boolean).join('|'),
        matches: payloadLegsWithConfidenceMeta,
        total_confidence: totalConfidence,
        total_ticket_probability: totalConfidence,
        totalTicketProbability: totalTicketProbability,
        ticket_label: ticketLabel,
        display_label: ticketLabel,
        average_leg_confidence: averageLegConfidence,
        diversity_breakdown: diversityBreakdown,
        risk_level: isMega ? 'safe' : riskLevelFromConfidence(totalConfidence)
    };
}

function hasMixedSportCoverage(candidates) {
    const sports = new Set(candidates.map((candidate) => normalizeSportKey(candidate?.sport)));
    const hasNonFootball = Array.from(sports).some((sport) => sport !== 'football');
    const hasTargetSport = Array.from(sports).some((sport) => MIXED_SPORT_TARGETS.has(sport));
    return sports.size >= 2 && hasNonFootball && hasTargetSport;
}

function buildFootballOnlyAccumulatorRow(pool, usedFixtureIds, size, minConfidenceFloor, options = {}) {
    const footballPool = pool
        .filter((candidate) => normalizeSportKey(candidate?.sport) === 'football')
        .filter((candidate) => Number(candidate?.confidence) >= minConfidenceFloor)
        .sort(compareAccaCandidatePreference);
    if (footballPool.length < size) return null;

    const fixtures = buildSelectableFixturePool(footballPool, minConfidenceFloor);
    if (fixtures.length < size) return null;

    const selected = [];
    const localUsed = new Set();
    const stagedGlobalUsed = new Set([...usedFixtureIds]);
    const selectedLegs = selectAccaLegs(fixtures, stagedGlobalUsed, size);

    for (const leg of selectedLegs) {
        if (selected.length >= size) break;
        const candidate = resolveSelectedLegCandidate(leg, fixtures);
        if (!candidate) continue;
        if (isCandidateUsedGlobally(candidate, usedFixtureIds)) continue;
        if (!canReserveCandidate(candidate, usedFixtureIds, localUsed)) continue;
        selected.push(candidate);
        reserveCandidate(candidate, localUsed);
    }

    if (selected.length < size) return null;
    for (const id of localUsed) usedFixtureIds.add(id);
    return finalizeAccumulatorRow(selected, {
        profile: 'football_only',
        minLegConfidenceFloor: minConfidenceFloor
    });
}

function buildMixedAccumulatorRow(pool, usedFixtureIds, size, minConfidenceFloor, options = {}) {
    const sorted = pool
        .filter((candidate) => Number(candidate?.confidence) >= minConfidenceFloor)
        .sort(compareAccaCandidatePreference);
    if (sorted.length < size) return null;

    const football = sorted.filter((candidate) => normalizeSportKey(candidate?.sport) === 'football');
    const nonFootball = sorted.filter((candidate) => normalizeSportKey(candidate?.sport) !== 'football');

    const anchorPairs = [];
    if (football.length && nonFootball.length) {
        for (const f of football.slice(0, 12)) {
            for (const n of nonFootball.slice(0, 24)) {
                const fIds = new Set(getAccaCandidateFixtureIds(f));
                const nIds = getAccaCandidateFixtureIds(n);
                if (nIds.some((id) => fIds.has(id))) continue;
                anchorPairs.push([f, n]);
                break;
            }
            if (anchorPairs.length >= 12) break;
        }
    }

    if (!anchorPairs.length) {
        for (let i = 0; i < sorted.length; i++) {
            for (let j = i + 1; j < sorted.length; j++) {
                const a = sorted[i];
                const b = sorted[j];
                if (normalizeSportKey(a?.sport) === normalizeSportKey(b?.sport)) continue;
                anchorPairs.push([a, b]);
                if (anchorPairs.length >= 12) break;
            }
            if (anchorPairs.length >= 12) break;
        }
    }

    for (const pair of anchorPairs) {
        const selected = [];
        const localUsed = new Set();

        for (const candidate of pair) {
            if (isCandidateUsedGlobally(candidate, usedFixtureIds)) {
                selected.length = 0;
                break;
            }
            if (!canReserveCandidate(candidate, usedFixtureIds, localUsed)) {
                selected.length = 0;
                break;
            }
            selected.push(candidate);
            reserveCandidate(candidate, localUsed);
        }
        if (!selected.length) continue;

        const remainingPool = sorted.filter((candidate) => canReserveCandidate(candidate, usedFixtureIds, localUsed));
        const fixtures = buildSelectableFixturePool(remainingPool, minConfidenceFloor);
        const stagedGlobalUsed = new Set([...usedFixtureIds, ...localUsed]);
        const legsNeeded = Math.max(0, size - selected.length);
        const selectedLegs = selectAccaLegs(fixtures, stagedGlobalUsed, legsNeeded);

        for (const leg of selectedLegs) {
            if (selected.length >= size) break;
            const candidate = resolveSelectedLegCandidate(leg, fixtures);
            if (!candidate) continue;
            if (isCandidateUsedGlobally(candidate, usedFixtureIds)) continue;
            if (!canReserveCandidate(candidate, usedFixtureIds, localUsed)) continue;
            selected.push(candidate);
            reserveCandidate(candidate, localUsed);
        }

        if (selected.length < size) continue;
        if (!hasMixedSportCoverage(selected)) continue;

        for (const id of localUsed) usedFixtureIds.add(id);
        return finalizeAccumulatorRow(selected, {
            profile: 'mixed_sport',
            minLegConfidenceFloor: minConfidenceFloor,
            isMega: options.isMega === true
        });
    }

    return null;
}

async function buildAccaLegCandidatePool(predictions, options = {}) {
    const minConfidenceFloor = Number.isFinite(Number(options.minLegConfidence))
        ? Number(options.minLegConfidence)
        : ACCA_MIN_LEG_CONFIDENCE;
    const byFixture = new Map();

    for (const prediction of Array.isArray(predictions) ? predictions : []) {
        const baseMetadata = getMetadata(prediction);
        const normalizedSport = normalizeSportKey(prediction?.sport || baseMetadata?.sport || '');
        const sportType = getSportTypeLabel(normalizedSport);

        const fixtureIds = getAccaCandidateFixtureIds(prediction);
        const fallbackFixtureId = String(prediction?.match_id || '').trim();
        const fixtureKey = fixtureIds[0] || fallbackFixtureId;
        if (!fixtureKey) continue;

        let scoredMarkets = [];
        try {
            scoredMarkets = await scoreMarkets(toScoringMatchPayload({
                ...prediction,
                sport: normalizedSport
            }));
        } catch (error) {
            console.warn(`[accaBuilder] market scoring skipped for match ${prediction?.match_id || 'unknown'}: ${error.message}`);
            scoredMarkets = [];
        }

        const candidates = [];
        if (Number(prediction?.confidence) >= minConfidenceFloor) {
            candidates.push({
                ...prediction,
                sport: normalizedSport,
                metadata: {
                    ...baseMetadata,
                    sport_type: sportType
                }
            });
        }

        for (const marketScore of scoredMarkets) {
            const mapped = buildAccaCandidateFromMarketScore(
                {
                    ...prediction,
                    sport: normalizedSport
                },
                marketScore
            );
            if (!mapped) continue;
            if (Number(mapped.confidence) < minConfidenceFloor) continue;
            candidates.push(mapped);
        }

        candidates.push(...buildExpandedFootballGoalLineCandidates(prediction, scoredMarkets, minConfidenceFloor));
        candidates.push(...buildFootballComboCandidates(prediction, scoredMarkets, minConfidenceFloor));

        if (!candidates.length) continue;
        const eligibleCandidates = candidates
            .filter((candidate) => Number(candidate?.confidence) >= minConfidenceFloor);
        if (!eligibleCandidates.length) continue;

        const rankedCandidates = eligibleCandidates.slice().sort(compareAccaCandidatePreference);
        const preferred = selectBestAccaCandidateFromPool(rankedCandidates, minConfidenceFloor);
        const orderedCandidates = preferred
            ? [preferred, ...rankedCandidates.filter((candidate) =>
                normalizeMarketForAcca(candidate?.market) !== normalizeMarketForAcca(preferred?.market)
                || normalizePickForAcca(candidate?.prediction) !== normalizePickForAcca(preferred?.prediction)
            )]
            : rankedCandidates;

        const existingCandidates = byFixture.get(fixtureKey) || [];
        const merged = existingCandidates.slice();

        for (const candidate of orderedCandidates) {
            const preparedCandidate = {
                ...candidate,
                metadata: {
                    ...(candidate?.metadata || {}),
                    depth_first_full_scoring_applied: true,
                    evaluated_market_count: rankedCandidates.length
                }
            };
            const signature = `${normalizeMarketForAcca(preparedCandidate?.market)}::${normalizePickForAcca(preparedCandidate?.prediction)}`;
            const existingIndex = merged.findIndex((row) =>
                `${normalizeMarketForAcca(row?.market)}::${normalizePickForAcca(row?.prediction)}` === signature
            );

            if (existingIndex < 0) {
                merged.push(preparedCandidate);
                continue;
            }

            if (compareAccaCandidatePreference(preparedCandidate, merged[existingIndex]) < 0) {
                merged[existingIndex] = preparedCandidate;
            }
        }

        byFixture.set(
            fixtureKey,
            merged
                .filter((candidate) => Number(candidate?.confidence) >= minConfidenceFloor)
                .sort(compareAccaCandidatePreference)
                .slice(0, 18)
        );
    }

    return Array.from(byFixture.values())
        .flat()
        .filter((candidate) => Number(candidate?.confidence) >= minConfidenceFloor)
        .sort(compareAccaCandidates);
}

function buildAcca6Candidates(predictions, maxRows = 6, options = {}) {
    const minConfidenceFloor = Number.isFinite(Number(options.minLegConfidence))
        ? Number(options.minLegConfidence)
        : ACCA_MIN_LEG_CONFIDENCE;
    const globalUsedFixtures = options.globalUsedFixtures instanceof Set ? options.globalUsedFixtures : new Set();
    const sorted = (Array.isArray(predictions) ? predictions : [])
        .filter((candidate) => Number(candidate?.confidence) >= minConfidenceFloor)
        .filter((candidate) => {
            const ids = getAccaCandidateFixtureIds(candidate);
            return ids.length > 0 && !ids.some((id) => globalUsedFixtures.has(id));
        })
        .sort(compareAccaCandidatePreference);
    if (sorted.length < ACCA_SIZE) return [];

    const rows = [];
    const footballTarget = Math.min(REQUIRED_FOOTBALL_ONLY_ACCAS, Math.max(0, Number(maxRows) || 0));

    for (let i = 0; i < footballTarget; i++) {
        const row = buildFootballOnlyAccumulatorRow(
            sorted,
            globalUsedFixtures,
            ACCA_SIZE,
            minConfidenceFloor,
            { isMega: false }
        );
        if (!row) {
            console.warn(`[accaBuilder] ACCA football split warning: requested ${footballTarget} pure football ACCAs but only built ${i}.`);
            return rows;
        }
        rows.push(row);
    }

    while (rows.length < maxRows) {
        const row = buildMixedAccumulatorRow(sorted, globalUsedFixtures, ACCA_SIZE, minConfidenceFloor, { isMega: false });
        if (!row) break;
        rows.push(row);
    }

    return rows;
}

function isCricketFixtureWithinWindow(prediction, expiryCutoff) {
    if (normalizeSportKey(prediction?.sport) !== 'cricket') return true;
    const kickoff = parseKickoff(prediction);
    if (!kickoff) return false;

    // Cricket fixtures can be long-running; use a conservative completion buffer.
    const estimatedCompletion = new Date(kickoff.getTime() + (12 * 60 * 60 * 1000));
    return estimatedCompletion <= expiryCutoff;
}

function resolveMegaAccaThreshold(predictions, options = {}) {
    const configured = Number(options.minLegConfidence ?? process.env.MEGA_ACCA_MIN_LEG_CONFIDENCE ?? ACCA_MIN_LEG_CONFIDENCE);
    const configuredThreshold = Number.isFinite(configured) ? clamp(configured, 60, 99) : ACCA_MIN_LEG_CONFIDENCE;
    const confidenceValues = (Array.isArray(predictions) ? predictions : [])
        .map((prediction) => Number(prediction?.confidence))
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => b - a);

    if (confidenceValues.length < MEGA_ACCA_SIZE) {
        return configuredThreshold;
    }

    const dynamicFloor = confidenceValues[MEGA_ACCA_SIZE - 1];
    if (!Number.isFinite(dynamicFloor) || dynamicFloor >= configuredThreshold) {
        return configuredThreshold;
    }

    return clamp(Math.round(dynamicFloor * 100) / 100, ACCA_MIN_LEG_CONFIDENCE, configuredThreshold);
}

function buildMegaAcca12Candidates(predictions, options = {}) {
    const maxRows = Number.isFinite(options.maxRows) ? options.maxRows : 6;
    const expiryCutoff = options.expiryCutoff instanceof Date ? options.expiryCutoff : null;
    const usedThreshold = resolveMegaAccaThreshold(predictions, options);
    const globalUsedFixtures = options.globalUsedFixtures instanceof Set ? options.globalUsedFixtures : new Set();

    const eligible = predictions
        .filter((prediction) => Number(prediction.confidence) >= usedThreshold)
        .filter((prediction) => {
            const ids = getAccaCandidateFixtureIds(prediction);
            return ids.length > 0 && !ids.some((id) => globalUsedFixtures.has(id));
        })
        .filter((prediction) => !expiryCutoff || isCricketFixtureWithinWindow(prediction, expiryCutoff))
        .sort(compareAccaCandidatePreference)
        .slice();

    // If not enough assets meet the effective floor, abort the Mega ACCA build for this run.
    if (eligible.length < MEGA_ACCA_SIZE) {
        console.log(`[accaBuilder] Mega ACCA: Only ${eligible.length} insights available (need ${MEGA_ACCA_SIZE}). Effective floor ${usedThreshold}% not met.`);
        return [];
    }

    console.log(`[accaBuilder] Mega ACCA: Building Moonshot series with ${eligible.length} eligible insights at ${usedThreshold}% threshold.`);

    const rows = [];
    while (rows.length < maxRows) {
        const row = buildMixedAccumulatorRow(
            eligible,
            globalUsedFixtures,
            MEGA_ACCA_SIZE,
            usedThreshold,
            { isMega: true }
        );
        if (!row) break;
        row.risk_level = 'safe';
        rows.push(row);
    }

    return rows;
}

function normalizeRequestedSports(requestedSports = []) {
    const values = Array.isArray(requestedSports) ? requestedSports : [requestedSports];
    return values
        .map((value) => normalizeSportKey(value))
        .filter((value) => value && value !== 'all');
}

function getPerSportCandidateLimit(requestedSports = []) {
    const sports = normalizeRequestedSports(requestedSports);
    if (sports.length === 1) return 80;
    if (sports.length > 1) return 48;
    return 48;
}

function getCategoryBuildCaps(requestedSports = []) {
    const sports = normalizeRequestedSports(requestedSports);
    if (sports.length === 1) {
        return {
            direct: 24,
            secondary: 12,
            same_match: 6,
            multi: 8,
            acca_6match: 5,
            mega_acca_12: 2
        };
    }

    return {
        direct: 80,
        secondary: 64,
        same_match: 48,
        multi: 24,
        acca_6match: 16,
        mega_acca_12: 8
    };
}

async function loadValidFilteredPredictions(tier, client, options = {}) {
    const t = normalizeTier(tier);
    const requestedSports = normalizeRequestedSports(options.requestedSports);
    const now = options.now instanceof Date ? options.now : new Date();

    const res = await client.query(
        `
        select
            f.raw_id,
            f.tier,
            r.match_id,
            r.sport,
            r.market,
            r.prediction,
            r.confidence,
            r.volatility,
            r.odds,
            r.metadata,
            r.created_at,
            k.kickoff_utc
        from predictions_filtered f
        join predictions_raw r on r.id = f.raw_id
        cross join lateral (
            select coalesce(
                case
                    when coalesce(r.metadata->>'match_time', '') ~ '^\\d{4}-\\d{2}-\\d{2}'
                        then (r.metadata->>'match_time')::timestamptz
                    else null
                end,
                case
                    when coalesce(r.metadata->>'kickoff', '') ~ '^\\d{4}-\\d{2}-\\d{2}'
                        then (r.metadata->>'kickoff')::timestamptz
                    else null
                end,
                case
                    when coalesce(r.metadata->>'kickoff_time', '') ~ '^\\d{4}-\\d{2}-\\d{2}'
                        then (r.metadata->>'kickoff_time')::timestamptz
                    else null
                end
            ) as kickoff_utc
        ) k
        where f.tier = $1
          and f.is_valid = true
          and k.kickoff_utc > $2::timestamptz
        order by r.confidence desc, r.created_at desc;
        `,
        [t, now.toISOString()]
    );

    const futureRows = filterExpiredFixtures(
        res.rows.map((row) => ({
            ...row,
            date: row.kickoff_utc || row?.metadata?.match_time || row?.metadata?.kickoff || row?.metadata?.kickoff_time || null
        }))
    );

    return futureRows
        .filter((row) => requestedSports.length === 0 || requestedSports.includes(normalizeSportKey(row.sport)))
        .filter((row) => isPublishablePrediction(row, t, now))
        .sort((a, b) => compareCandidates(a, b, now));
}

function normalizeTeamToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function normalizeCompetitionToken(value, fallback = 'unknown_competition') {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized || fallback;
}

function extractTeamCompetitionPairsFromMatch(match) {
    const metadata = match?.metadata || {};
    const competition = normalizeCompetitionToken(
        metadata.competition ||
        metadata.league ||
        metadata.tournament ||
        metadata.series ||
        metadata.event ||
        match?.league ||
        match?.sport
    );

    const home = normalizeTeamToken(match?.home_team || metadata.home_team);
    const away = normalizeTeamToken(match?.away_team || metadata.away_team);
    const out = [];

    if (home) out.push({ team: home, competition });
    if (away) out.push({ team: away, competition });
    return out;
}

function addTeamCompetitionPair(map, team, competition) {
    if (!team || !competition) return;
    if (!map.has(team)) map.set(team, new Set());
    map.get(team).add(competition);
}

async function loadWeekLockedTeamCompetitionMap(client, now = new Date()) {
    const weekStart = startOfWeekSast(now);
    const weekEnd = endOfWeekSast(now);
    const res = await client.query(
        `
        WITH latest_week_run AS (
            SELECT MAX(publish_run_id) AS publish_run_id
            FROM predictions_final
            WHERE created_at >= $1
              AND created_at < $2
              AND publish_run_id IS NOT NULL
        )
        SELECT pf.matches
        FROM predictions_final pf
        LEFT JOIN latest_week_run lwr ON TRUE
        WHERE pf.created_at >= $1
          AND pf.created_at < $2
          AND (
              lwr.publish_run_id IS NULL
              OR pf.publish_run_id = lwr.publish_run_id
          )
        `,
        [weekStart.toISOString(), weekEnd.toISOString()]
    );

    const map = new Map();

    for (const row of res.rows) {
        const legs = Array.isArray(row.matches) ? row.matches : [];
        for (const leg of legs) {
            const pairs = extractTeamCompetitionPairsFromMatch(leg);
            for (const pair of pairs) {
                addTeamCompetitionPair(map, pair.team, pair.competition);
            }
        }
    }

    return map;
}

function normalizeFixtureIdentityToken(value, fallback = null) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return normalized || fallback;
}

function buildFixtureIdentityKeys(matchLike, fallbackMetadata = {}) {
    const metadata = matchLike?.metadata || fallbackMetadata || {};
    const home = normalizeTeamToken(matchLike?.home_team || metadata.home_team);
    const away = normalizeTeamToken(matchLike?.away_team || metadata.away_team);
    const kickoff = parseKickoff({
        ...matchLike,
        metadata
    });
    const kickoffDay = kickoff ? kickoff.toISOString().slice(0, 10) : null;
    const competition = normalizeCompetitionToken(
        matchLike?.competition ||
        matchLike?.league ||
        metadata.competition ||
        metadata.league ||
        metadata.tournament ||
        metadata.series ||
        metadata.event ||
        matchLike?.sport ||
        metadata.sport
    );
    const matchId = normalizeFixtureIdentityToken(matchLike?.match_id || metadata.match_id);
    const out = [];

    if (matchId) out.push(`id:${matchId}`);

    if (home && away) {
        if (kickoffDay) {
            out.push(`fixture:${home}_vs_${away}|${kickoffDay}|${competition}`);
        } else {
            out.push(`fixture:${home}_vs_${away}|${competition}`);
            out.push(`fixture:${home}_vs_${away}`);
        }
    }

    return Array.from(new Set(out));
}

function predictionFixtureIds(prediction) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];

    const fromMatches = matches.flatMap((match) => buildFixtureIdentityKeys(match));

    if (fromMatches.length > 0) return fromMatches;

    const metadata = getMetadata(prediction);
    return buildFixtureIdentityKeys(prediction, metadata);
}

function predictionTeamCompetitionPairs(prediction) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    if (matches.length > 0) {
        return matches.flatMap((match) => extractTeamCompetitionPairsFromMatch(match));
    }

    const metadata = getMetadata(prediction);
    const competition = normalizeCompetitionToken(
        metadata.competition || metadata.league || metadata.tournament || prediction?.sport
    );
    const home = normalizeTeamToken(metadata.home_team);
    const away = normalizeTeamToken(metadata.away_team);

    const out = [];
    if (home) out.push({ team: home, competition });
    if (away) out.push({ team: away, competition });
    return out;
}

function isPredictionTeamAllowed(prediction, historicalTeamCompetitionMap, runTeamCompetitionMap) {
    const pairs = predictionTeamCompetitionPairs(prediction);
    if (!pairs.length) return true;

    for (const pair of pairs) {
        const historicalCompetitions = historicalTeamCompetitionMap.get(pair.team);
        if (historicalCompetitions && historicalCompetitions.has(pair.competition)) {
            return false;
        }

        const runCompetitions = runTeamCompetitionMap.get(pair.team);
        if (runCompetitions && runCompetitions.has(pair.competition)) {
            return false;
        }
    }

    return true;
}

function reservePredictionTeams(prediction, runTeamCompetitionMap) {
    const pairs = predictionTeamCompetitionPairs(prediction);
    for (const pair of pairs) {
        addTeamCompetitionPair(runTeamCompetitionMap, pair.team, pair.competition);
    }
}

function filterAvailablePredictions(predictions, usedFixtureIds, historicalTeamCompetitionMap, runTeamCompetitionMap) {
    return predictions.filter((prediction) => {
        const ids = predictionFixtureIds(prediction);
        if (!ids.length || ids.some((id) => usedFixtureIds.has(id))) return false;
        return isPredictionTeamAllowed(prediction, historicalTeamCompetitionMap, runTeamCompetitionMap);
    });
}

function reservePredictionFixtures(prediction, usedFixtureIds) {
    for (const id of new Set(predictionFixtureIds(prediction))) {
        usedFixtureIds.add(id);
    }
}

function takeAvailablePredictions(predictions, usedFixtureIds, historicalTeamCompetitionMap, runTeamCompetitionMap, limit = Infinity) {
    const out = [];

    for (const prediction of predictions) {
        if (out.length >= limit) break;
        const ids = predictionFixtureIds(prediction);
        if (!ids.length || ids.some((id) => usedFixtureIds.has(id))) continue;
        if (!isPredictionTeamAllowed(prediction, historicalTeamCompetitionMap, runTeamCompetitionMap)) continue;
        out.push(prediction);
        reservePredictionFixtures(prediction, usedFixtureIds);
        reservePredictionTeams(prediction, runTeamCompetitionMap);
    }

    return out;
}

async function insertFinalRow({ publish_run_id, tier, type, matches, total_confidence, risk_level }, client) {
    const res = await client.query(
        `
        insert into predictions_final (publish_run_id, tier, type, matches, total_confidence, risk_level)
        values ($1, $2, $3, $4::jsonb, $5, $6)
        returning *;
        `,
        [publish_run_id || null, tier, type, JSON.stringify(matches), total_confidence, risk_level]
    );

    return res.rows[0];
}

async function buildFinalForTier(tier, options = {}) {
    const t = normalizeTier(tier);
    const publishRunId = options.publishRunId || null;
    const now = options.now instanceof Date ? options.now : new Date();

    return withTransaction(async (client) => {
        await getTierRules(t, client);
        const accaRules = await getAccaRules(client);

        const valid = await loadValidFilteredPredictions(t, client, {
            requestedSports: options.requestedSports,
            now
        });
        const weekLockedTeamCompetitionMap = await loadWeekLockedTeamCompetitionMap(client, now);
        const runTeamCompetitionMap = new Map();
        const globalUsedFixtures = new Set();
        const perMatchLimited = enforcePerMatchLimit(valid, accaRules.max_per_match);
        const perSportLimited = enforcePerSportLimit(
            perMatchLimited,
            getPerSportCandidateLimit(options.requestedSports)
        );
        const categoryBuildCaps = getCategoryBuildCaps(options.requestedSports);

        // Limit candidates to prevent combinatorial explosion and timeouts
        const MAX_ACCA_CANDIDATES = 320;
        const limitedCandidates = perSportLimited.slice(0, MAX_ACCA_CANDIDATES);
        const baseAccaInput = filterAvailablePredictions(
            limitedCandidates,
            globalUsedFixtures,
            weekLockedTeamCompetitionMap,
            runTeamCompetitionMap
        );
        let accaMarketCandidates = await buildAccaLegCandidatePool(
            baseAccaInput,
            { minLegConfidence: ACCA_MIN_LEG_CONFIDENCE }
        );

        const minimumFootballFixturePool = REQUIRED_FOOTBALL_ONLY_ACCAS * ACCA_SIZE;
        const footballCandidateCount = accaMarketCandidates
            .filter((candidate) => normalizeSportKey(candidate?.sport) === 'football')
            .length;

        if (footballCandidateCount < minimumFootballFixturePool) {
            console.warn(
                `[accaBuilder] ACCA pool warning: only ${footballCandidateCount} football fixtures after weekly locks (need ${minimumFootballFixturePool}). Falling back to run-only lock scope for ACCA generation.`
            );
            accaMarketCandidates = await buildAccaLegCandidatePool(
                filterAvailablePredictions(limitedCandidates, globalUsedFixtures, new Map(), runTeamCompetitionMap),
                { minLegConfidence: ACCA_MIN_LEG_CONFIDENCE }
            );
        }

        // -------------------------------------------------------------------------
        // 1. 6-LEG ACCA LAYER (Pure Football first, then Mixed)
        // -------------------------------------------------------------------------
        const accaRows = [];
        const accaSelections = buildAcca6Candidates(
            filterAvailablePredictions(accaMarketCandidates, globalUsedFixtures, weekLockedTeamCompetitionMap, runTeamCompetitionMap),
            categoryBuildCaps.acca_6match,
            {
                minLegConfidence: ACCA_MIN_LEG_CONFIDENCE,
                globalUsedFixtures
            }
        );
        for (const row of accaSelections) {
            reservePredictionFixtures(row, globalUsedFixtures);
            reservePredictionTeams(row, runTeamCompetitionMap);
            const inserted = await insertFinalRow({
                publish_run_id: publishRunId,
                tier: t,
                type: 'acca_6match',
                matches: row.matches,
                total_confidence: row.total_confidence,
                risk_level: row.risk_level
            }, client);
            accaRows.push(inserted);
        }

        // -------------------------------------------------------------------------
        // 2. THE MEGA ACCA RESERVATION LAYER
        // -------------------------------------------------------------------------
        const megaAccaRows = [];
        const megaSelections = buildMegaAcca12Candidates(
            filterAvailablePredictions(accaMarketCandidates, globalUsedFixtures, weekLockedTeamCompetitionMap, runTeamCompetitionMap),
            {
                maxRows: categoryBuildCaps.mega_acca_12,
                minLegConfidence: ACCA_MIN_LEG_CONFIDENCE,
                globalUsedFixtures,
                // Subscription temporal gate
                expiryCutoff: new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000))
            }
        );
        for (const row of megaSelections) {
            reservePredictionFixtures(row, globalUsedFixtures);
            reservePredictionTeams(row, runTeamCompetitionMap);
            const inserted = await insertFinalRow({
                publish_run_id: publishRunId,
                tier: t,
                type: 'mega_acca_12',
                matches: row.matches,
                total_confidence: row.total_confidence,
                risk_level: row.risk_level
            }, client);
            megaAccaRows.push(inserted);
        }

        // -------------------------------------------------------------------------
        // 3. MULTI LAYER (Third Priority)
        // -------------------------------------------------------------------------
        const multiRows = [];
        const multiSelections = takeAvailablePredictions(
            buildMultiCandidates(filterAvailablePredictions(limitedCandidates, globalUsedFixtures, weekLockedTeamCompetitionMap, runTeamCompetitionMap)),
            globalUsedFixtures,
            weekLockedTeamCompetitionMap,
            runTeamCompetitionMap,
            categoryBuildCaps.multi
        );
        for (const row of multiSelections) {
            const inserted = await insertFinalRow({
                publish_run_id: publishRunId,
                tier: t,
                type: 'multi',
                matches: row.matches,
                total_confidence: row.total_confidence,
                risk_level: row.risk_level
            }, client);
            multiRows.push(inserted);
        }

        // -------------------------------------------------------------------------
        // 4. SAME MATCH LAYER (Fourth Priority)
        // -------------------------------------------------------------------------
        const sameMatchRows = [];
        const sameMatchSelections = takeAvailablePredictions(
            await buildSameMatchCandidates(filterAvailablePredictions(limitedCandidates, globalUsedFixtures, weekLockedTeamCompetitionMap, runTeamCompetitionMap)),
            globalUsedFixtures,
            weekLockedTeamCompetitionMap,
            runTeamCompetitionMap,
            categoryBuildCaps.same_match
        );
        for (const row of sameMatchSelections) {
            const inserted = await insertFinalRow({
                publish_run_id: publishRunId,
                tier: t,
                type: 'same_match',
                matches: row.matches,
                total_confidence: row.total_confidence,
                risk_level: row.risk_level
            }, client);
            sameMatchRows.push(inserted);
        }

        // -------------------------------------------------------------------------
        // 5. SECONDARY LAYER (Fifth Priority)
        // -------------------------------------------------------------------------
        const secondaryRows = [];
        const secondarySelections = takeAvailablePredictions(
            await buildSecondaryCandidates(filterAvailablePredictions(limitedCandidates, globalUsedFixtures, weekLockedTeamCompetitionMap, runTeamCompetitionMap)),
            globalUsedFixtures,
            weekLockedTeamCompetitionMap,
            runTeamCompetitionMap,
            categoryBuildCaps.secondary
        );
        for (const prediction of secondarySelections) {
            const matches = [toFinalMatchPayload(prediction)];
            const total = computeTotalConfidence(matches);
            const row = await insertFinalRow({
                publish_run_id: publishRunId,
                tier: t,
                type: 'secondary',
                matches,
                total_confidence: total,
                risk_level: riskLevelFromConfidence(total)
            }, client);
            secondaryRows.push(row);
        }

        // -------------------------------------------------------------------------
        // 6. DIRECT LAYER (Last Priority - sweeps leftovers)
        // -------------------------------------------------------------------------
        const directRows = [];
        const directSelections = takeAvailablePredictions(
            limitedCandidates,
            globalUsedFixtures,
            weekLockedTeamCompetitionMap,
            runTeamCompetitionMap,
            categoryBuildCaps.direct
        );
        for (const prediction of directSelections) {
            const matches = [toFinalMatchPayload(prediction)];
            const total = computeTotalConfidence(matches);
            const row = await insertFinalRow({
                publish_run_id: publishRunId,
                tier: t,
                type: 'direct',
                matches,
                total_confidence: total,
                risk_level: riskLevelFromConfidence(total)
            }, client);
            directRows.push(row);
        }

        console.log('[accaBuilder] tier=%s week_locked=%s direct=%s secondary=%s same_match=%s multi=%s acca_6match=%s mega_acca_12=%s',
            t,
            weekLockedTeamCompetitionMap.size,
            directRows.length,
            secondaryRows.length,
            sameMatchRows.length,
            multiRows.length,
            accaRows.length,
            megaAccaRows.length
        );


        // TEMPORARY DIAGNOSTICS: Stabilization pass — remove after one clean deploy cycle
        const allAccaCards = [...accaRows, ...megaAccaRows];
        const allFixtureKeys = [];
        let cardsWithFakeMath = 0;
        const cardDiagnostics = allAccaCards.map((card) => {
            const cardMatches = card.matches || [];
            const fixtureKeys = cardMatches.map((m) => m.match_id).filter(Boolean);
            allFixtureKeys.push(...fixtureKeys);
            const avgConf = Number(card.average_leg_confidence || 0);
            const totalConf = Number(card.total_confidence || 0);
            const isHonest = totalConf <= avgConf || avgConf === 0;
            if (!isHonest) cardsWithFakeMath++;
            return {
                type: card.type,
                legs: cardMatches.length,
                avgConfidence: avgConf,
                totalConfidence: totalConf,
                honest: isHonest,
                displayLabel: card.display_label || card.ticket_label || 'UNKNOWN',
                diversityBreakdown: card.diversity_breakdown || null,
            };
        });
        const uniqueFixtureKeys = new Set(allFixtureKeys);
        const duplicateFixtureCount = allFixtureKeys.length - uniqueFixtureKeys.size;

        console.log('[accaBuilder DIAGNOSTICS] tier=%s', t);
        console.log('[accaBuilder DIAGNOSTICS] raw_fixtures_in=%s upcoming_after_filter=%s', valid.length, perSportLimited.length);
        console.log('[accaBuilder DIAGNOSTICS] acca_cards_built=%s duplicate_fixture_keys=%s cards_with_fake_math=%s', allAccaCards.length, duplicateFixtureCount, cardsWithFakeMath);
        console.log('[accaBuilder DIAGNOSTICS] card_details=%s', JSON.stringify(cardDiagnostics));
        const avgVsTotal = allAccaCards.map((c) => ({ legs: (c.matches || []).length, avg: Number(c.average_leg_confidence || 0), total: Number(c.total_confidence || 0) }));
        console.log('[accaBuilder DIAGNOSTICS] avg_vs_total=%s', JSON.stringify(avgVsTotal));
        // END TEMPORARY DIAGNOSTICS

        return {
            tier: t,
            direct: directRows,
            secondary: secondaryRows,
            same_match: sameMatchRows,
            multi: multiRows,
            acca_6match: accaRows,
            mega_acca_12: megaAccaRows
        };
    });
}

module.exports = { buildFinalForTier, buildAccaV2 };
