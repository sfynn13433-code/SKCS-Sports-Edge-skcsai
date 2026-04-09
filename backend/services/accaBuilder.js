'use strict';

const { query, withTransaction } = require('../db');
const { validateRawPredictionInput } = require('../utils/validation');
const { filterRawPrediction } = require('./filterEngine');
const { getPredictionInputs } = require('./dataProvider');
const { scoreMatch } = require('./aiScoring');
const { validatePredictionSet } = require('../utils/marketConsistency');
const { detectConflicts } = require('../utils/conflictResolver');
const { isValidCombination } = require('./conflictEngine');
const { scoreMarkets } = require('./marketScoringEngine');

const MEGA_ACCA_SIZE = 12;
const MEGA_ACCA_MIN_CONFIDENCE = 80; // Lowered from 90 to be more achievable
const SAME_MATCH_INSIGHT_TARGET = 6;

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

function startOfWeekUtc(now = new Date()) {
    const current = new Date(now);
    const day = current.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    current.setUTCDate(current.getUTCDate() + diffToMonday);
    current.setUTCHours(0, 0, 0, 0);
    return current;
}

function endOfWeekUtc(now = new Date()) {
    const start = startOfWeekUtc(now);
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
    return {
        raw_id: p.raw_id,
        match_id: p.match_id,
        sport: normalizeSportKey(p.sport),
        home_team: metadata.home_team || null,
        away_team: metadata.away_team || null,
        match_date: kickoff,
        commence_time: kickoff,
        market: p.market,
        prediction: p.prediction,
        confidence: p.confidence,
        volatility: p.volatility,
        odds: p.odds,
        metadata
    };
}

function toScoringMatchPayload(prediction) {
    const metadata = prediction.metadata || {};
    return {
        match_id: prediction.match_id,
        sport: prediction.sport,
        home_team: metadata.home_team || null,
        away_team: metadata.away_team || null
    };
}

function toSecondaryPayload(prediction, marketScore) {
    const normalizedMarket = String(marketScore.market || '').toUpperCase();
    const normalizedPick = String(marketScore.pick || '').toUpperCase();
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
        market = normalizedPick === 'UNDER' ? 'corners_under' : 'corners_over';
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
            market_description: marketScore.description
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
    const value = metadata.match_time || metadata.kickoff || metadata.kickoff_time || null;
    if (!value) return null;
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
    if (sport.startsWith('basketball_')) return 'basketball';
    if (sport.startsWith('americanfootball_')) return 'american_football';
    return sport;
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
    
    // If no kickoff time, still allow if we have confidence
    if (!kickoff) {
        return typeof prediction.confidence === 'number' && prediction.confidence > 0;
    }

    // Do not republish old fixtures onto the live predictions surface.
    // A small grace period allows fixtures that just started to remain visible.
    const staleCutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    if (kickoff < staleCutoff) {
        console.log(`[accaBuilder] Rejecting prediction for match ${prediction.match_id}: kickoff ${kickoff.toISOString()} is older than the live publish window`);
        return false;
    }

    // Extend the publish window to be more generous - allow up to 9 days in future
    const maxWindowDays = getPublishWindowDays(tier);
    const maxFuture = new Date(now.getTime() + (maxWindowDays + 4) * 24 * 60 * 60 * 1000);
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

function buildDerivedMarkets(prediction, options = {}) {
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

    return uniqueBy(
        scoreMarkets(toScoringMatchPayload(prediction))
            .filter((market) => includeTypes.has(market.type))
            .filter((market) => !excludeMarkets.has(String(market.market || '').toUpperCase()))
            .sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0))
            .map((market) => toSecondaryPayload(prediction, market)),
        (row) => `${row.match_id}:${row.market}`
    ).slice(0, maxRows);
}

function buildSecondaryCandidates(predictions) {
    const secondary = [];

    for (const prediction of predictions) {
        secondary.push(...buildDerivedMarkets(prediction, {
            includeTypes: ['secondary', 'advanced'],
            maxRows: 2
        }));
    }

    return uniqueBy(secondary, (row) => `${row.match_id}:${row.market}`);
}

function buildSameMatchCandidates(predictions) {
    const out = [];
    for (const prediction of predictions) {
        const derived = buildDerivedMarkets(prediction, {
            includeTypes: ['primary', 'secondary', 'advanced'],
            excludeMarkets: ['MATCH_RESULT', 'MATCH_WINNER', 'WINNER', 'RACE_WINNER'],
            maxRows: SAME_MATCH_INSIGHT_TARGET - 1
        });
        if (derived.length === 0) continue;

        const legs = [toFinalMatchPayload(prediction), ...derived.map(toFinalMatchPayload)];
        out.push({
            match_id: prediction.match_id,
            matches: legs,
            total_confidence: computeTotalConfidence(legs),
            risk_level: riskLevelFromConfidence(computeTotalConfidence(legs))
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

function buildAcca6Candidates(predictions, maxRows = 6) {
    const direct = predictions.slice(0, 18);
    if (direct.length < 6) return [];

    const rows = [];
    for (let start = 0; start <= direct.length - 6 && rows.length < maxRows; start++) {
        const combo = direct.slice(start, start + 6);
        const ids = combo.map((row) => row.match_id);
        if (new Set(ids).size !== ids.length) continue;
        const legs = combo.map(toFinalMatchPayload);
        rows.push({
            match_id: ids.join('|'),
            matches: legs,
            total_confidence: computeTotalConfidence(legs),
            risk_level: riskLevelFromConfidence(computeTotalConfidence(legs))
        });
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

function buildMegaAcca12Candidates(predictions, options = {}) {
    const maxRows = Number.isFinite(options.maxRows) ? options.maxRows : 6;
    const expiryCutoff = options.expiryCutoff instanceof Date ? options.expiryCutoff : null;
    
    // Try multiple confidence thresholds to ensure we can build mega ACCAs
    const confidenceThresholds = [MEGA_ACCA_MIN_CONFIDENCE, 85, 80, 75, 70];
    let eligible = [];
    let usedThreshold = MEGA_ACCA_MIN_CONFIDENCE;
    
    for (const threshold of confidenceThresholds) {
        eligible = predictions
            .filter((prediction) => Number(prediction.confidence) >= threshold)
            .filter((prediction) => !expiryCutoff || isCricketFixtureWithinWindow(prediction, expiryCutoff))
            .slice();
        
        if (eligible.length >= MEGA_ACCA_SIZE) {
            usedThreshold = threshold;
            break;
        }
    }
    
    // If still not enough, return empty
    if (eligible.length < MEGA_ACCA_SIZE) {
        console.log(`[accaBuilder] Mega ACCA: Only ${eligible.length} predictions available (need ${MEGA_ACCA_SIZE}), threshold was ${usedThreshold}%`);
        return [];
    }
    
    console.log(`[accaBuilder] Mega ACCA: Building with ${eligible.length} eligible predictions at ${usedThreshold}% threshold`);

    const rows = [];
    for (let start = 0; start <= eligible.length - MEGA_ACCA_SIZE && rows.length < maxRows; start++) {
        const combo = eligible.slice(start, start + MEGA_ACCA_SIZE);
        const ids = combo.map((row) => row.match_id);
        if (new Set(ids).size !== ids.length) continue;
        const legs = combo.map((row) => ({
            ...toFinalMatchPayload(row),
            metadata: {
                ...getMetadata(row),
                mega_acca_leg: true,
                min_leg_confidence_floor: usedThreshold
            }
        }));
        rows.push({
            match_id: ids.join('|'),
            matches: legs,
            total_confidence: computeTotalConfidence(legs),
            risk_level: usedThreshold >= 90 ? 'safe' : 'medium'
        });
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
    if (sports.length === 1) return 24;
    if (sports.length > 1) return 8;
    return 8;
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
            r.created_at
        from predictions_filtered f
        join predictions_raw r on r.id = f.raw_id
        where f.tier = $1 and f.is_valid = true
        order by r.confidence desc, r.created_at desc;
        `,
        [t]
    );

    return res.rows
        .filter((row) => requestedSports.length === 0 || requestedSports.includes(normalizeSportKey(row.sport)))
        .filter((row) => isPublishablePrediction(row, t, now))
        .sort((a, b) => compareCandidates(a, b, now));
}

async function loadWeekLockedFixtureIds(client, now = new Date()) {
    const weekStart = startOfWeekUtc(now);
    const weekEnd = endOfWeekUtc(now);
    const res = await client.query(
        `
        SELECT DISTINCT NULLIF(TRIM(match_leg->>'match_id'), '') AS match_id
        FROM predictions_final pf
        CROSS JOIN LATERAL jsonb_array_elements(pf.matches) AS match_leg
        WHERE pf.created_at >= $1
          AND pf.created_at < $2
          AND NULLIF(TRIM(match_leg->>'match_id'), '') IS NOT NULL
        `,
        [weekStart.toISOString(), weekEnd.toISOString()]
    );

    return new Set(res.rows.map((row) => String(row.match_id).trim()).filter(Boolean));
}

function predictionFixtureIds(prediction) {
    const matches = Array.isArray(prediction?.matches) ? prediction.matches : [];
    const fromMatches = matches
        .map((match) => String(match?.match_id || '').trim())
        .filter(Boolean);
    if (fromMatches.length > 0) return fromMatches;

    const directId = String(prediction?.match_id || '').trim();
    return directId ? [directId] : [];
}

function filterAvailablePredictions(predictions, usedFixtureIds) {
    return predictions.filter((prediction) => {
        const ids = predictionFixtureIds(prediction);
        return ids.length > 0 && ids.every((id) => !usedFixtureIds.has(id));
    });
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
        const perMatchLimited = enforcePerMatchLimit(valid, accaRules.max_per_match);
        const perSportLimited = enforcePerSportLimit(
            perMatchLimited,
            getPerSportCandidateLimit(options.requestedSports)
        );
        const categoryBuildCaps = getCategoryBuildCaps(options.requestedSports);

        // Limit candidates to prevent combinatorial explosion and timeouts
        const MAX_ACCA_CANDIDATES = 120;
        const limitedCandidates = perSportLimited.slice(0, MAX_ACCA_CANDIDATES);
        const secondaryCandidates = buildSecondaryCandidates(limitedCandidates);

        const megaAccaRows = [];
        const megaCandidates = buildMegaAcca12Candidates(limitedCandidates, {
            maxRows: categoryBuildCaps.mega_acca_12,
            expiryCutoff: new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000))
        });
        for (const row of megaCandidates) {
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

        const secondaryRows = [];
        for (const prediction of secondaryCandidates.slice(0, categoryBuildCaps.secondary)) {
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

        const directRows = [];
        for (const p of limitedCandidates.slice(0, categoryBuildCaps.direct)) {
            const matches = [toFinalMatchPayload(p)];
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

        const sameMatchRows = [];
        for (const row of buildSameMatchCandidates(limitedCandidates).slice(0, categoryBuildCaps.same_match)) {
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

        const accaRows = [];
        for (const row of buildAcca6Candidates(
            limitedCandidates.filter((p) => p.volatility === 'low')
        ).slice(0, categoryBuildCaps.acca_6match)) {
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

        const multiRows = [];
        for (const row of buildMultiCandidates(limitedCandidates).slice(0, categoryBuildCaps.multi)) {
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

        console.log('[accaBuilder] tier=%s direct=%s secondary=%s same_match=%s multi=%s acca_6match=%s mega_acca_12=%s',
            t,
            directRows.length,
            secondaryRows.length,
            sameMatchRows.length,
            multiRows.length,
            accaRows.length,
            megaAccaRows.length
        );

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
