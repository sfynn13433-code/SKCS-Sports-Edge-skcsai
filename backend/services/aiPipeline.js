'use strict';

const { query, withTransaction } = require('../db');
const { validateRawPredictionInput } = require('../utils/validation');
const { filterRawPrediction } = require('./filterEngine');
const { buildFinalForTier } = require('./accaBuilder');
const { getPredictionInputs } = require('./dataProvider');
const { scoreMatch } = require('./aiScoring');
const { buildMatchContext } = require('./normalizerService');
const {
    buildCandidateMarkets,
    selectDirectSecondarySameMatch
} = require('./marketIntelligence');
const { evaluateDirect1x2 } = require('./direct1x2Engine');
const pipelineLogger = require('../utils/pipelineLogger');
const enrichFixtureWithContext = require('../src/services/contextIntelligence/aiPipeline');
const adjustProbability = require('../src/services/contextIntelligence/adjustProbability');

let isRunning = false;
const ACTIVE_DEPLOYMENT_SPORT = 'football';

function normalizeSport(sport) {
    if (typeof sport !== 'string' || sport.trim().length === 0) throw new Error('sport must be a non-empty string');
    return sport.trim().toLowerCase();
}

function normalizeSportForDeployment(value) {
    const key = String(value || '').trim().toLowerCase();
    if (!key) return 'unknown';
    if (key === 'soccer' || key === 'football' || key.startsWith('soccer_') || key.startsWith('football_')) return 'football';
    if (key.startsWith('americanfootball_')) return 'american_football';
    if (key === 'nba' || key.startsWith('basketball_')) return 'basketball';
    if (key === 'nhl' || key.startsWith('icehockey_')) return 'hockey';
    if (key.startsWith('rugbyunion_')) return 'rugby';
    return key;
}

function isDeploymentSportEnabled(value) {
    return normalizeSportForDeployment(value) === ACTIVE_DEPLOYMENT_SPORT;
}

function normalizePrediction(prediction) {
    const value = String(prediction || '').trim().toLowerCase();
    if (!value) return null;

    const aliases = {
        home: 'home_win',
        away: 'away_win',
        home_win: 'home_win',
        away_win: 'away_win',
        draw: 'draw'
    };

    return aliases[value] || value;
}

function ensureArray(value) {
    return Array.isArray(value) ? value : [];
}

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function toProbability(confidencePercent) {
    const n = Number(confidencePercent);
    if (!Number.isFinite(n)) return 0.5;
    return clamp(n, 0, 100) / 100;
}

function toConfidencePercent(probability) {
    const n = Number(probability);
    if (!Number.isFinite(n)) return 50;
    return Math.round(clamp(n, 0, 1) * 10000) / 100;
}

function normalizeMarketKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
}

function isPrimaryMatchOutcomeMarket(value) {
    const key = normalizeMarketKey(value);
    return key === 'home_win'
        || key === 'away_win'
        || key === 'draw'
        || key === '1x2'
        || key === 'match_winner'
        || key === 'match_result';
}

function riskLevelFromConfidence(confidence) {
    const n = Number(confidence);
    if (!Number.isFinite(n)) return 'unsafe';
    if (n >= 80) return 'safe';
    if (n >= 70) return 'good';
    if (n >= 59) return 'fair';
    return 'unsafe';
}

function transparencyFlagsForRiskLevel(riskLevel) {
    if (riskLevel === 'unsafe') {
        return {
            warning_banner: 'Primary match outcome is below our 58% safety threshold (Unsafe).',
            action_advice: 'We advise moving to the Secondary Insights below for a safer position.'
        };
    }
    if (riskLevel === 'fair') {
        return {
            warning_banner: 'Fair chance, but high volatility. Exercise caution.',
            action_advice: 'Consider utilizing the Secondary Insights below for a safer position.'
        };
    }
    if (riskLevel === 'good') {
        return {
            warning_banner: 'Higher probability of occurring, but standard sports volatility applies.',
            action_advice: 'Play responsibly.'
        };
    }
    return {
        warning_banner: null,
        action_advice: 'Premium Safe Insight. High confidence mathematical projection.'
    };
}

function normalizeCandidateConfidencePercent(candidate) {
    const confidence = Number(candidate?.confidence);
    if (Number.isFinite(confidence)) {
        if (confidence <= 1) {
            return Math.round(clamp(confidence, 0, 1) * 10000) / 100;
        }
        return Math.round(clamp(confidence, 0, 100) * 100) / 100;
    }
    const probability = Number(candidate?.probability);
    if (!Number.isFinite(probability)) return null;
    if (probability <= 1) {
        return Math.round(clamp(probability, 0, 1) * 10000) / 100;
    }
    return Math.round(clamp(probability, 0, 100) * 100) / 100;
}

const SECONDARY_PIVOT_MARKETS = Object.freeze(new Set([
    'over_0_5',
    'double_chance_1x',
    'double_chance_x2',
    'double_chance_12',
    'draw_no_bet_home',
    'draw_no_bet_away',
    'over_1_5',
    'over_2_5',
    'over_3_5',
    'over_4_5',
    'over_5_5',
    'over_6_5',
    'under_2_5',
    'under_3_5',
    'under_4_5',
    'under_5_5',
    'under_6_5',
    'home_over_0_5',
    'away_over_0_5',
    'home_over_1_5',
    'away_over_1_5',
    'btts_yes',
    'btts_no',
    'btts_over_2_5',
    'btts_under_3_5',
    'home_win_btts_yes',
    'away_win_btts_yes',
    'home_win_btts_no',
    'away_win_btts_no',
    'over_0_5_first_half',
    'under_1_5_first_half',
    'first_half_draw',
    'home_win_either_half',
    'away_win_either_half',
    'win_either_half'
]));

function isAllowedSecondaryPivotMarket(marketKey) {
    const key = normalizeMarketKey(marketKey);
    if (!key) return false;
    // AI-DISABLED: Strict rules explicitly allow 'over_0_5' in Goals Totals
    // if (key === 'over_0_5' || key === 'under_0_5') return false;
    if (key === 'under_0_5') return false;
    if (key.includes('red_cards')) return false;
    if (SECONDARY_PIVOT_MARKETS.has(key)) return true;

    if (/^corners_(over|under)_(6|7|8|9|10|11|12)_5$/.test(key)) return true;
    if (/^yellow_cards_(over|under)_(1|2|3|4|5|6)_5$/.test(key)) return true;
    if (/^cards_(over|under)_(1|2|3|4|5|6)_5$/.test(key)) return true;

    return false;
}

function buildSecondaryInsights(candidates, selectedMarket) {
    const selectedKey = normalizeMarketKey(selectedMarket);
    const deduped = new Map();
    const minSecondaryConfidence = 76;

    ensureArray(candidates)
        .map((candidate) => {
            const confidence = normalizeCandidateConfidencePercent(candidate);
            return {
                market: normalizeMarketKey(candidate?.market),
                prediction: candidate?.prediction || null,
                confidence,
                probability: Number.isFinite(Number(candidate?.probability))
                    ? Number(candidate.probability)
                    : (Number.isFinite(confidence) ? confidence / 100 : null),
                category: candidate?.category || null,
                priority_tier: candidate?.priority_tier || null
            };
        })
        .filter((candidate) => {
            if (!candidate.market) return false;
            if (candidate.market === selectedKey) return false;
            if (!isAllowedSecondaryPivotMarket(candidate.market)) return false;
            return Number.isFinite(candidate.confidence) && candidate.confidence >= minSecondaryConfidence;
        })
        .forEach((candidate) => {
            const existing = deduped.get(candidate.market);
            if (!existing || Number(candidate.confidence || 0) > Number(existing.confidence || 0)) {
                deduped.set(candidate.market, candidate);
            }
        });

    return Array.from(deduped.values())
        .sort((a, b) => {
            const confidenceDiff = Number(b.confidence || 0) - Number(a.confidence || 0);
            if (confidenceDiff !== 0) return confidenceDiff;
            return Number(a.priority_tier || 99) - Number(b.priority_tier || 99);
        })
        .slice(0, 4);
}

function normalizeContextSignals(value) {
    const source = value && typeof value === 'object' ? value : {};
    const read = (key) => {
        const n = Number(source[key]);
        if (!Number.isFinite(n)) return 0;
        return clamp(n, 0, 1);
    };
    const sourceMarketAdjustments = isObject(source.market_adjustments)
        ? source.market_adjustments
        : (isObject(source.marketAdjustments) ? source.marketAdjustments : {});
    const marketAdjustments = {};
    for (const [key, valueRaw] of Object.entries(sourceMarketAdjustments)) {
        const valueNum = Number(valueRaw);
        if (Number.isFinite(valueNum)) {
            marketAdjustments[key] = valueNum;
        }
    }

    return {
        weather_risk: read('weather_risk'),
        availability_risk: read('availability_risk'),
        discipline_risk: read('discipline_risk'),
        stability_risk: read('stability_risk'),
        travel_fatigue_risk: read('travel_fatigue_risk'),
        fixture_congestion_risk: read('fixture_congestion_risk'),
        derby_risk: read('derby_risk'),
        rotation_risk: read('rotation_risk'),
        market_movement_risk: read('market_movement_risk'),
        lineup_uncertainty_risk: read('lineup_uncertainty_risk'),
        market_adjustments: marketAdjustments
    };
}

function buildDirect1x2ContextAdjustments(contextSignals) {
    const source = isObject(contextSignals) ? contextSignals : {};
    const riskToAdjustment = (riskValue) => {
        const risk = clamp(Number(riskValue) || 0, 0, 1);
        const drawShift = risk * 0.04;
        const sideShift = drawShift / 2;
        return {
            home: -sideShift,
            draw: drawShift,
            away: -sideShift
        };
    };

    return {
        weather: riskToAdjustment(source.weather_risk),
        availability: riskToAdjustment(source.availability_risk),
        discipline: riskToAdjustment(source.discipline_risk),
        stability: riskToAdjustment(source.stability_risk)
    };
}

function computeDirect1x2VolatilityScore(contextSignals) {
    const source = isObject(contextSignals) ? contextSignals : {};
    const volatilitySignals = [
        source.weather_risk,
        source.availability_risk,
        source.discipline_risk,
        source.stability_risk,
        source.travel_fatigue_risk,
        source.fixture_congestion_risk,
        source.derby_risk,
        source.rotation_risk,
        source.market_movement_risk,
        source.lineup_uncertainty_risk
    ].map((value) => clamp(Number(value) || 0, 0, 1));

    if (!volatilitySignals.length) return 0;
    const average = volatilitySignals.reduce((sum, value) => sum + value, 0) / volatilitySignals.length;
    return clamp(average, 0, 1);
}

function toTitleCase(text) {
    return String(text || '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toNormalizationInput(item) {
    if (!isObject(item)) return null;

    if (isObject(item.match_info) && isObject(item.sharp_odds) && isObject(item.contextual_intelligence)) {
        return item;
    }

    if (isObject(item.match) && isObject(item.odds)) {
        return item;
    }

    const rawProviderData = isObject(item.raw_provider_data) ? item.raw_provider_data : {};
    const match = {
        ...rawProviderData,
        ...item
    };
    const odds = isObject(item.odds)
        ? item.odds
        : (isObject(rawProviderData.odds) ? rawProviderData.odds : {});

    return {
        ...item,
        match,
        odds
    };
}

function safeTeamData(teamData) {
    const payload = teamData && typeof teamData === 'object' ? teamData : {};
    return {
        injuries: ensureArray(payload.injuries),
        suspensions: ensureArray(payload.suspensions),
        expectedXI: {
            reliability: Number.isFinite(Number(payload.expectedXI?.reliability))
                ? Number(payload.expectedXI.reliability)
                : 1
        }
    };
}

function deriveWaterfallProbabilities(predictionKey, pAdj, matchContext = {}) {
    const pFav = clamp(toProb(pAdj), 0.10, 0.95);

    let home = 0.33;
    let away = 0.33;
    let draw = 0.34;

    if (predictionKey === 'home_win') {
        home = pFav;
        const rem = 1 - home;
        away = rem * 0.58;
        draw = rem * 0.42;
    } else if (predictionKey === 'away_win') {
        away = pFav;
        const rem = 1 - away;
        home = rem * 0.58;
        draw = rem * 0.42;
    } else {
        draw = pFav;
        const rem = 1 - draw;
        home = rem * 0.5;
        away = rem * 0.5;
    }

    const doubleChance1X = clamp(home + draw, 0, 1);
    const doubleChanceX2 = clamp(away + draw, 0, 1);

    const dnbDenom = Math.max(home + away, 0.0001);
    const dnbHome = clamp(home / dnbDenom, 0, 1);
    const dnbAway = clamp(away / dnbDenom, 0, 1);

    const over15 = clamp(Math.max(home, away) + 0.18, 0.55, 0.98);
    const under45 = clamp(0.92 - Math.abs(home - away) * 0.12 + draw * 0.06, 0.55, 0.98);

    const fallback = {
        home_win: home,
        away_win: away,
        draw,
        double_chance_1x: doubleChance1X,
        double_chance_x2: doubleChanceX2,
        draw_no_bet_home: dnbHome,
        draw_no_bet_away: dnbAway,
        over_1_5: over15,
        under_4_5: under45
    };

    const sharpOdds = matchContext && typeof matchContext.sharp_odds === 'object' ? matchContext.sharp_odds : {};
    const merged = { ...fallback };
    for (const [key, value] of Object.entries(sharpOdds)) {
        const prob = toProb(value);
        if (prob > 0) merged[key] = prob;
    }

    if (!merged.over_2_5) merged.over_2_5 = clamp((merged.over_1_5 || over15) - 0.12, 0.30, 0.90);
    if (!merged.over_3_5) merged.over_3_5 = clamp((merged.over_2_5 || merged.over_1_5 || over15) - 0.16, 0.15, 0.82);
    if (!merged.under_3_5) merged.under_3_5 = clamp(1 - merged.over_3_5 + 0.08, 0.20, 0.95);
    if (!merged.under_2_5) merged.under_2_5 = clamp(1 - merged.over_2_5, 0.10, 0.90);
    if (!merged.double_chance_12) merged.double_chance_12 = clamp((merged.home_win || home) + (merged.away_win || away), 0, 1);
    if (!merged.home_over_0_5) merged.home_over_0_5 = clamp((merged.home_win || home) + 0.18, 0.48, 0.95);
    if (!merged.away_over_0_5) merged.away_over_0_5 = clamp((merged.away_win || away) + 0.16, 0.44, 0.94);
    if (!merged.home_over_1_5) merged.home_over_1_5 = clamp(merged.home_over_0_5 - 0.20, 0.12, 0.86);
    if (!merged.away_over_1_5) merged.away_over_1_5 = clamp(merged.away_over_0_5 - 0.20, 0.10, 0.84);
    if (!merged.btts_yes) merged.btts_yes = clamp(((merged.home_over_0_5 + merged.away_over_0_5) / 2) - 0.06, 0.24, 0.88);
    if (!merged.btts_no) merged.btts_no = clamp(1 - merged.btts_yes, 0.12, 0.90);
    if (!merged.double_chance_over_1_5) {
        merged.double_chance_over_1_5 = clamp(
            Math.max(merged.double_chance_1x || 0, merged.double_chance_x2 || 0, merged.double_chance_12 || 0) * (merged.over_1_5 || over15),
            0.30,
            0.98
        );
    }
    if (!merged.double_chance_under_3_5) {
        merged.double_chance_under_3_5 = clamp(
            Math.max(merged.double_chance_1x || 0, merged.double_chance_x2 || 0, merged.double_chance_12 || 0) * (merged.under_3_5 || 0.70),
            0.25,
            0.96
        );
    }

    return merged;
}

function toProb(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return clamp(n, 0, 1);
}

function countKeyAbsences(teamData) {
    const safe = safeTeamData(teamData);
    const keyInjuries = safe.injuries.filter((p) => Boolean(p?.isKeyPlayer)).length;
    const keySuspensions = safe.suspensions.filter((p) => Boolean(p?.isKeyPlayer)).length;
    return keyInjuries + keySuspensions;
}

function riskBand(value) {
    const risk = clamp(Number(value) || 0, 0, 1);
    if (risk >= 0.7) return 'High Risk';
    if (risk >= 0.4) return 'Medium Risk';
    return 'Low Risk';
}

function buildUiInsights(contextFixture, contextSignals) {
    const weatherRisk = clamp(Number(contextSignals.weather_risk) || 0, 0, 1);
    const availabilityRisk = clamp(Number(contextSignals.availability_risk) || 0, 0, 1);
    const stabilityRisk = clamp(Number(contextSignals.stability_risk) || 0, 0, 1);
    const teamName = String(contextFixture.home_team || 'Team').trim() || 'Team';
    const keyAbsences = countKeyAbsences(contextFixture.teamData);

    const weather = weatherRisk > 0.3
        ? `Adverse weather risk (${Math.round(weatherRisk * 100)}%)`
        : 'Weather conditions stable';
    const availability = keyAbsences > 0
        ? `${teamName} missing ${keyAbsences} key player${keyAbsences === 1 ? '' : 's'}`
        : `Squad availability stable (${Math.round((1 - availabilityRisk) * 100)}%)`;
    const stability = `${teamName}: ${riskBand(stabilityRisk)}`;

    return { weather, availability, stability };
}

function buildContextFixture(matchContext, item, sport) {
    const info = matchContext?.match_info || {};
    const context = matchContext?.contextual_intelligence || {};
    return {
        ...matchContext,
        id: info.match_id || item?.match_id || item?.id || null,
        match_id: info.match_id || item?.match_id || item?.id || null,
        sport,
        home_team: info.home_team || item?.home_team || null,
        away_team: info.away_team || item?.away_team || null,
        competition: info.league || item?.league || item?.competition || null,
        location: info.venue || item?.venue || item?.location || null,
        kickoffTime: info.kickoff || item?.date || item?.kickoff || new Date().toISOString(),
        teamData: {
            injuries: ensureArray(context.injuries),
            suspensions: ensureArray(context.suspensions),
            expectedXI: {
                reliability: context.lineup_confirmed ? 0.95 : 0.65
            }
        },
        teamDiscipline: {
            redCards: { last5Games: 0 },
            yellowCardThreats: [],
            bans: ensureArray(context.suspensions)
        },
        teamContext: {
            coachConflict: Boolean(context.coach_conflict),
            execInstability: Boolean(context.boardroom_instability),
            playerLegalIssues: ensureArray(context.public_incidents),
            fanViolence: false,
            morale: context.morale
        }
    };
}

function fallbackPredictionForMarket(market, defaultPrediction = 'home_win') {
    const key = String(market || '').trim().toLowerCase();
    if (key.startsWith('double_chance_')) return key.replace('double_chance_', '');
    if (key.startsWith('draw_no_bet_')) return key.endsWith('_away') ? 'away' : 'home';
    if (key === 'home_win') return 'home_win';
    if (key === 'away_win') return 'away_win';
    if (key === 'draw') return 'draw';
    if (key === 'btts_yes') return 'yes';
    if (key === 'btts_no') return 'no';
    if (key.includes('team_to_score_first_home')) return 'home';
    if (key.includes('team_to_score_first_away')) return 'away';
    if (key.includes('over')) return 'over';
    if (key.includes('under')) return 'under';
    return defaultPrediction;
}

function sanitizeMatchContextForStorage(matchContext) {
    const source = matchContext && typeof matchContext === 'object' ? matchContext : {};
    return {
        match_info: { ...(source.match_info || {}) },
        sharp_odds: { ...(source.sharp_odds || {}) },
        contextual_intelligence: { ...(source.contextual_intelligence || {}) }
    };
}

function volatilityFromRiskProfile(riskProfile, fallbackVolatility) {
    if (!riskProfile || typeof riskProfile !== 'object') {
        return fallbackVolatility || 'medium';
    }
    const aggregate = Number(riskProfile.aggregate_risk || 0);
    if (aggregate >= 0.67) return 'high';
    if (aggregate >= 0.38) return 'medium';
    return 'low';
}

async function buildRawPredictionFromProviderItem(item) {
    const telemetry = isObject(item?.telemetry) ? item.telemetry : {};
    const telemetryRunId = telemetry.run_id || null;
    const normalizationInput = toNormalizationInput(item);
    const matchContext = buildMatchContext(normalizationInput);
    if (!matchContext) {
        pipelineLogger.rejectionAdd({
            run_id: telemetryRunId,
            sport: item?.sport || telemetry?.sport || 'unknown',
            bucket: 'legacy_schema_reject',
            metadata: {
                reason: 'buildMatchContext_returned_null',
                match_id: item?.match_id || null
            }
        });
        return null;
    }
    const matchInfo = matchContext?.match_info || {};

    const match_id = String(matchInfo.match_id || item.match_id || item.id || '').trim();
    if (!match_id) throw new Error('match_id missing in provider item');

    const sport = normalizeSportForDeployment(matchContext?.sport || item.sport || 'football');
    if (!isDeploymentSportEnabled(sport)) {
        pipelineLogger.rejectionAdd({
            run_id: telemetryRunId,
            sport: sport || 'unknown',
            bucket: 'sport_phase_block',
            metadata: {
                match_id,
                reason: 'phase_1_football_only'
            }
        });
        return null;
    }
    const requestedMarket = String(item.market || '1X2').trim();
    pipelineLogger.stageAdd({
        run_id: telemetryRunId,
        sport,
        stage: 'normalized_count',
        count: 1
    });

    const scoring = await scoreMatch({
        match_id,
        sport,
        home_team: matchInfo.home_team || item.home_team || null,
        away_team: matchInfo.away_team || item.away_team || null,
        prediction: item.prediction || null,
        confidence: item.confidence,
        raw_provider_data: item.raw_provider_data || matchContext.raw_provider_data || null,
        metadata: item.metadata || matchContext.metadata || null
    });

    const providerPrediction = normalizePrediction(item.prediction || matchContext.prediction);
    const predictionSource = providerPrediction ? 'provider' : 'ai_fallback';
    const fallbackPrediction = scoring.winner === 'home'
        ? 'home_win'
        : scoring.winner === 'away'
            ? 'away_win'
            : scoring.winner === 'draw'
                ? 'draw'
                : 'home_win';
    const prediction = providerPrediction || fallbackPrediction;
    const baselineConfidence = typeof item.confidence === 'number' && Number.isFinite(item.confidence)
        ? item.confidence
        : (Number.isFinite(Number(scoring.confidence)) ? Number(scoring.confidence) : 62);
    const p_base = toProbability(baselineConfidence);
    const contextFixture = buildContextFixture(matchContext, item, sport);
    let contextEnriched = null;

    try {
        contextEnriched = await enrichFixtureWithContext(contextFixture);
    } catch (contextErr) {
        console.warn('[aiPipeline] context enrichment failed for match_id=%s: %s', match_id, contextErr.message);
    }
    pipelineLogger.stageAdd({
        run_id: telemetryRunId,
        sport,
        stage: 'enriched_count',
        count: 1
    });
    if (!contextEnriched?.contextual_intelligence && !contextFixture?.contextual_intelligence) {
        pipelineLogger.rejectionAdd({
            run_id: telemetryRunId,
            sport,
            bucket: 'missing_context',
            metadata: { match_id }
        });
    }

    const contextSignals = normalizeContextSignals(contextEnriched?.contextSignals);
    const p_adj = adjustProbability(p_base, contextSignals);
    const effectiveMatchContext = contextEnriched || contextFixture;
    const storableMatchContext = sanitizeMatchContextForStorage(effectiveMatchContext);
    const waterfallProbabilities = deriveWaterfallProbabilities(prediction, p_adj, effectiveMatchContext);
    const direct1x2Evaluation = evaluateDirect1x2({
        baseProb: {
            home: waterfallProbabilities.home_win,
            draw: waterfallProbabilities.draw,
            away: waterfallProbabilities.away_win
        },
        contextAdjustments: buildDirect1x2ContextAdjustments(contextSignals),
        volatilityScore: computeDirect1x2VolatilityScore(contextSignals)
    });
    if (direct1x2Evaluation.confidence < 45) {
        pipelineLogger.rejectionAdd({
            run_id: telemetryRunId,
            sport,
            bucket: 'validation_reject',
            reason: 'low_confidence',
            metadata: {
                match_id,
                confidence: direct1x2Evaluation.confidence,
                tier: direct1x2Evaluation.tier
            }
        });
        return { rejected: true, reason: 'low_confidence' };
    }
    const marketIntelligence = buildCandidateMarkets(
        waterfallProbabilities,
        effectiveMatchContext,
        {
            contextSignals,
            telemetry: {
                run_id: telemetryRunId,
                sport
            }
        }
    );
    pipelineLogger.stageAdd({
        run_id: telemetryRunId,
        sport,
        stage: 'market_scored_count',
        count: 1
    });
    const marketSelections = selectDirectSecondarySameMatch(
        marketIntelligence.candidates,
        effectiveMatchContext,
        {
            contextSignals,
            riskProfile: marketIntelligence.risk_profile,
            telemetry: {
                run_id: telemetryRunId,
                sport
            }
        }
    );
    if (marketSelections?.direct || marketSelections?.secondary) {
        pipelineLogger.stageAdd({
            run_id: telemetryRunId,
            sport,
            stage: 'post_conflict_count',
            count: 1
        });
    } else {
        pipelineLogger.rejectionAdd({
            run_id: telemetryRunId,
            sport,
            bucket: 'conflict_reject',
            metadata: { match_id }
        });
    }
    if (marketIntelligence.risk_profile?.reject) {
        console.log('[aiPipeline] risk-rejection fixture skipped match_id=%s aggregate_risk=%s', match_id, marketIntelligence.risk_profile.aggregate_risk);
        pipelineLogger.rejectionAdd({
            run_id: telemetryRunId,
            sport,
            bucket: 'validation_reject',
            metadata: {
                match_id,
                reason: 'risk_profile_reject'
            }
        });
        return null;
    }

    const selectedDirect = marketSelections.direct || null;
    const selectedSecondary = marketSelections.secondary || null;
    const market = selectedDirect?.market || requestedMarket;
    const routedPrediction = selectedDirect?.prediction || direct1x2Evaluation.outcome || prediction || fallbackPredictionForMarket(market, prediction);
    const confidenceProbabilityRaw = selectedDirect?.probability || (direct1x2Evaluation.confidence / 100) || p_adj;
    const confidenceProbability = adjustProbability.applyMarketAdjustment(
        confidenceProbabilityRaw,
        market,
        contextSignals.market_adjustments
    );
    const confidence = toConfidencePercent(confidenceProbability);
    const riskLevel = isPrimaryMatchOutcomeMarket(market)
        ? riskLevelFromConfidence(confidence)
        : 'good';
    const transparencyFlags = transparencyFlagsForRiskLevel(riskLevel);
    const secondaryInsights = (direct1x2Evaluation.secondaryRequired || riskLevel === 'fair' || riskLevel === 'unsafe')
        ? buildSecondaryInsights(marketIntelligence.candidates, market)
        : [];
    const volatility = item.volatility || scoring.volatility || volatilityFromRiskProfile(marketIntelligence.risk_profile, 'medium');
    const aiSource = scoring.source || null; // 'dolphin', 'fallback', 'odds', etc.
    const aiReasoning = scoring.reasoning || null;
    const uiInsights = buildUiInsights(contextFixture, contextSignals);

    const raw = {
        match_id,
        sport,
        market,
        prediction: routedPrediction,
        confidence,
        volatility,
        odds: item.odds !== undefined ? item.odds : null,
        metadata: {
            source: 'aiPipeline:v3-normalized+market-intelligence',
            data_mode: item.data_mode || null,
            prediction_source: predictionSource,
            ai_source: aiSource,
            ai_reasoning: aiReasoning,
            provider: item.provider || matchContext.provider || null,
            bookmaker: item.bookmaker || null,
            home_team: matchInfo.home_team || item.home_team || null,
            away_team: matchInfo.away_team || item.away_team || null,
            match_time: matchInfo.kickoff || item.date || item.commence_time || item.kickoff || item.match_time || null,
            league: matchInfo.league || item.league || null,
            tournament: item.tournament || null,
            stage: item.stage || item.round || null,
            venue: matchInfo.venue || item.venue || null,
            country: matchInfo.country || item.country || null,
            base_market: requestedMarket,
            base_prediction: prediction,
            normalized_match_context: true,
            match_context: storableMatchContext,
            context_intelligence: {
                status: contextEnriched?.context_status || 'unavailable',
                last_verified: new Date().toISOString(),
                signals: contextSignals,
                insights: {
                    weather: { summary: uiInsights.weather },
                    availability: { summary: uiInsights.availability },
                    stability: { summary: uiInsights.stability },
                    discipline: {}
                },
                p_base,
                p_adj,
                confidence_base_pct: Math.round(toProbability(baselineConfidence) * 10000) / 100,
                confidence_adj_pct: confidence
            },
            direct_1x2_engine: {
                market: direct1x2Evaluation.market,
                outcome: direct1x2Evaluation.outcome,
                confidence: direct1x2Evaluation.confidence,
                tier: direct1x2Evaluation.tier,
                secondary_required: direct1x2Evaluation.secondaryRequired,
                acca_eligible: direct1x2Evaluation.accaEligible,
                volatility_score: direct1x2Evaluation.volatilityScore,
                stages: direct1x2Evaluation.stages
            },
            market_intelligence: {
                direct_1x2: {
                    outcome: direct1x2Evaluation.outcome,
                    confidence: direct1x2Evaluation.confidence,
                    tier: direct1x2Evaluation.tier
                },
                direct_market: selectedDirect,
                secondary_market: selectedSecondary,
                rule_of_4_markets: marketSelections.rule_of_4_markets || [],
                same_match: marketSelections.same_match,
                secondary_insights: secondaryInsights,
                risk_profile: marketIntelligence.risk_profile,
                ranked_markets: ensureArray(marketIntelligence.candidates)
                    .slice(0, 20)
                    .map((candidate) => ({
                        market: candidate.market,
                        prediction: candidate.prediction,
                        confidence: candidate.confidence,
                        probability: candidate.probability,
                        score: candidate.score,
                        priority_tier: candidate.priority_tier,
                        category: candidate.category
                    }))
            },
            market_router: {
                phase: selectedDirect ? 'market_intelligence_tiered' : 'primary_outcome_backbone',
                status: 'locked',
                final_recommendation: {
                    market: toTitleCase(market),
                    confidence
                },
                engine_log: [
                    `Primary outcome retained: ${toTitleCase(market)} at ${confidence}% confidence.`,
                    `Direct 1X2 tier: ${direct1x2Evaluation.tier} (${direct1x2Evaluation.confidence}%).`,
                    'Defensive floor market mutation disabled for transparency.'
                ],
                probabilities: waterfallProbabilities || {},
                insights: uiInsights
            },
            risk_level: riskLevel,
            secondary_insights: secondaryInsights,
            transparency_flags: transparencyFlags,
            ai: predictionSource === 'ai_fallback'
                ? {
                    winner: scoring.winner,
                    source: aiSource,
                    reasoning: aiReasoning
                }
                : null
        }
    };

    try {
        validateRawPredictionInput(raw);
    } catch (validationError) {
        pipelineLogger.rejectionAdd({
            run_id: telemetryRunId,
            sport,
            bucket: 'validation_reject',
            reason: validationError.message,
            metadata: { match_id }
        });
        throw validationError;
    }
    pipelineLogger.stageAdd({
        run_id: telemetryRunId,
        sport,
        stage: 'post_validation_count',
        count: 1
    });
    return raw;
}

async function insertRawPrediction(pred, client) {
    const metadata = pred && typeof pred.metadata === 'object' && pred.metadata !== null
        ? pred.metadata
        : {};
    const kickoff = String(
        metadata.match_time
        || metadata.kickoff
        || metadata.kickoff_time
        || ''
    ).trim();

    if (kickoff) {
        const existingRes = await client.query(
            `
            select *
            from predictions_raw
            where match_id = $1
              and sport = $2
              and market = $3
              and coalesce(metadata->>'match_time', metadata->>'kickoff', metadata->>'kickoff_time', '') = $4
              and created_at >= now() - interval '21 days'
            order by created_at desc
            limit 1;
            `,
            [
                pred.match_id,
                pred.sport,
                pred.market,
                kickoff
            ]
        );

        if (existingRes.rows.length) {
            const existing = existingRes.rows[0];
            const refreshed = await client.query(
                `
                update predictions_raw
                set prediction = $2,
                    confidence = $3,
                    volatility = $4,
                    odds = $5,
                    metadata = $6::jsonb,
                    created_at = now()
                where id = $1
                returning *;
                `,
                [
                    existing.id,
                    pred.prediction,
                    pred.confidence,
                    pred.volatility,
                    pred.odds,
                    JSON.stringify(metadata)
                ]
            );
            return refreshed.rows[0];
        }
    }

    const res = await client.query(
        `
        insert into predictions_raw
            (match_id, sport, market, prediction, confidence, volatility, odds, metadata)
        values
            ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        returning *;
        `,
        [
            pred.match_id,
            pred.sport,
            pred.market,
            pred.prediction,
            pred.confidence,
            pred.volatility,
            pred.odds,
            JSON.stringify(pred.metadata || {})
        ]
    );

    return res.rows[0];
}

function rawDedupeKey(raw) {
    const metadata = raw && typeof raw.metadata === 'object' && raw.metadata !== null
        ? raw.metadata
        : {};
    const kickoff = String(
        metadata.match_time
        || metadata.kickoff
        || metadata.kickoff_time
        || raw?.date
        || ''
    ).trim();
    return [
        String(raw?.sport || '').trim().toLowerCase(),
        String(raw?.match_id || '').trim(),
        String(raw?.market || '').trim().toLowerCase(),
        kickoff
    ].join('|');
}

async function runPipelineForMatches({ matches, telemetry = {} }) {
    if (!Array.isArray(matches) || matches.length === 0) {
        throw new Error('matches must be a non-empty array');
    }

    const eligibleMatches = matches.filter((item) =>
        isDeploymentSportEnabled(
            item?.sport
            || item?.match_info?.sport
            || item?.match?.sport
            || item?.raw_provider_data?.sport
            || ACTIVE_DEPLOYMENT_SPORT
        )
    );

    if (!eligibleMatches.length) {
        console.log('[aiPipeline] all input matches were skipped by phase-1 football-only sport gate');
        return {
            mode: 'manual',
            inserted: [],
            filtered: [],
            filtered_valid: 0,
            filtered_invalid: 0,
            skipped_non_football: matches.length
        };
    }

    if (isRunning) {
        console.warn('[aiPipeline] blocked: pipeline already running');
        return { mode: 'manual', inserted: [], filtered: [], filtered_valid: 0, filtered_invalid: 0, error: 'Pipeline already running' };
    }

    isRunning = true;

    try {
        return await withTransaction(async (client) => {
            const inserted = [];
            const seenRawKeys = new Set();
            let normalValid = 0;
            let normalInvalid = 0;

        console.log('[aiPipeline] manual matches input count=%s eligible_football=%s', matches.length, eligibleMatches.length);

        for (const item of eligibleMatches) {
            const raw = await buildRawPredictionFromProviderItem({
                ...item,
                data_mode: 'manual',
                telemetry
            });
            if (!raw || raw.rejected) continue;
            if (!isDeploymentSportEnabled(raw.sport)) continue;
            const dedupeKey = rawDedupeKey(raw);
            if (seenRawKeys.has(dedupeKey)) continue;
            seenRawKeys.add(dedupeKey);
            const row = await insertRawPrediction(raw, client);
            inserted.push(row);
        }

        const filtered = [];
        let filteredValid = 0;
        let filteredInvalid = 0;

        for (const row of inserted) {
            const n = await filterRawPrediction({ rawId: row.id, tier: 'normal' }, client);
            const d = await filterRawPrediction({ rawId: row.id, tier: 'deep' }, client);
            filtered.push(n, d);
            if (n?.is_valid) {
                normalValid += 1;
            } else {
                normalInvalid += 1;
                pipelineLogger.rejectionAdd({
                    run_id: telemetry?.run_id || null,
                    sport: row?.sport || telemetry?.sport || 'unknown',
                    bucket: 'validation_reject',
                    reason: n?.reject_reason || null,
                    metadata: {
                        raw_id: row?.id || null,
                        tier: 'normal'
                    }
                });
            }
        }

        for (const f of filtered) {
            if (f.is_valid) filteredValid++;
            else filteredInvalid++;
        }

        pipelineLogger.stageSet({
            run_id: telemetry?.run_id || null,
            sport: telemetry?.sport || 'unknown',
            stage: 'post_validation_count',
            count: normalValid
        });

        console.log('[aiPipeline] inserted_raw=%s filtered_valid=%s filtered_invalid=%s', inserted.length, filteredValid, filteredInvalid);

            return {
                mode: 'manual',
                inserted,
                filtered,
                filtered_valid: filteredValid,
                filtered_invalid: filteredInvalid,
                skipped_non_football: Math.max(0, matches.length - eligibleMatches.length),
                telemetry: {
                    normal_valid: normalValid,
                    normal_invalid: normalInvalid
                }
            };
        });
    } finally {
        isRunning = false;
    }
}

async function runPipelineFromConfiguredDataMode() {
    const { mode, predictions } = await getPredictionInputs();
    const eligiblePredictions = (Array.isArray(predictions) ? predictions : []).filter((item) =>
        isDeploymentSportEnabled(
            item?.sport
            || item?.match_info?.sport
            || item?.match?.sport
            || item?.raw_provider_data?.sport
            || ACTIVE_DEPLOYMENT_SPORT
        )
    );

    if (isRunning) {
        console.warn('[aiPipeline] blocked: pipeline already running');
        return { mode, inserted: [], filtered: [], filtered_valid: 0, filtered_invalid: 0, error: 'Pipeline already running' };
    }

    isRunning = true;

    try {
        return await withTransaction(async (client) => {
            const inserted = [];
            const seenRawKeys = new Set();

        console.log('[aiPipeline] DATA_MODE=%s provider_items=%s eligible_football=%s', mode, predictions.length, eligiblePredictions.length);

        for (const item of eligiblePredictions) {
            const raw = await buildRawPredictionFromProviderItem({
                ...item,
                data_mode: mode
            });
            if (!raw || raw.rejected) continue;
            if (!isDeploymentSportEnabled(raw.sport)) continue;
            const dedupeKey = rawDedupeKey(raw);
            if (seenRawKeys.has(dedupeKey)) continue;
            seenRawKeys.add(dedupeKey);

            const row = await insertRawPrediction(raw, client);
            inserted.push(row);
        }

        const filtered = [];
        let filteredValid = 0;
        let filteredInvalid = 0;

        for (const row of inserted) {
            const n = await filterRawPrediction({ rawId: row.id, tier: 'normal' }, client);
            const d = await filterRawPrediction({ rawId: row.id, tier: 'deep' }, client);
            filtered.push(n, d);
        }

        for (const f of filtered) {
            if (f.is_valid) filteredValid++;
            else filteredInvalid++;
        }

        console.log('[aiPipeline] mode=%s inserted_raw=%s filtered_valid=%s filtered_invalid=%s', mode, inserted.length, filteredValid, filteredInvalid);

            return {
                mode,
                inserted,
                filtered,
                filtered_valid: filteredValid,
                filtered_invalid: filteredInvalid,
                skipped_non_football: Math.max(0, predictions.length - eligiblePredictions.length)
            };
        });
    } finally {
        isRunning = false;
    }
}

async function rebuildFinalOutputs(options = {}) {
    const requestedSports = Array.isArray(options.requestedSports)
        ? options.requestedSports
        : (options.requestedSports ? [options.requestedSports] : []);
    const triggerSource = String(options.triggerSource || 'manual');
    const runScope = requestedSports.length ? requestedSports.join(',') : 'all';
    const staleRunHours = Math.max(1, Number(process.env.SKCS_STALE_RUN_HOURS || 2));

    await query(
        `
        UPDATE prediction_publish_runs
        SET
            status = 'failed',
            completed_at = COALESCE(completed_at, NOW()),
            error_message = CASE
                WHEN COALESCE(error_message, '') = '' THEN
                    CONCAT('Auto-closed stale running publish run by rebuild (> ', $1::text, 'h).')
                ELSE error_message
            END,
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                'stale_auto_closed_at', NOW(),
                'stale_threshold_hours', $1::int
            )
        WHERE status = 'running'
          AND started_at < NOW() - make_interval(hours => $1::int)
        `,
        [staleRunHours]
    );

    const runRes = await query(
        `
        INSERT INTO prediction_publish_runs (
            trigger_source,
            requested_sports,
            run_scope,
            status,
            notes,
            metadata
        )
        VALUES ($1, $2::text[], $3, 'running', $4, $5::jsonb)
        RETURNING *;
        `,
        [
            triggerSource,
            requestedSports,
            runScope,
            options.notes || null,
            JSON.stringify({
                ...(options.metadata || {}),
                rebuild_started_at: new Date().toISOString(),
                stale_run_hours: staleRunHours
            })
        ]
    );

    const publishRun = runRes.rows[0];

    try {
        const buildOptions = {
            publishRunId: publishRun.id,
            requestedSports,
            telemetryRunId: options.telemetryRunId || null
        };
        const deep = await buildFinalForTier('deep', buildOptions);
        const normal = await buildFinalForTier('normal', buildOptions);
        const summary = {
            normal: {
                direct: normal?.direct?.length || 0,
                secondary: normal?.secondary?.length || 0,
                same_match: normal?.same_match?.length || 0,
                multi: normal?.multi?.length || 0,
                acca_6match: normal?.acca_6match?.length || 0,
                mega_acca_12: normal?.mega_acca_12?.length || 0
            },
            deep: {
                direct: deep?.direct?.length || 0,
                secondary: deep?.secondary?.length || 0,
                same_match: deep?.same_match?.length || 0,
                multi: deep?.multi?.length || 0,
                acca_6match: deep?.acca_6match?.length || 0,
                mega_acca_12: deep?.mega_acca_12?.length || 0
            }
        };

        await query(
            `
            UPDATE prediction_publish_runs
            SET status = 'completed',
                completed_at = NOW(),
                error_message = NULL,
                metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
            WHERE id = $1
            `,
            [
                publishRun.id,
                JSON.stringify({
                    summary,
                    rebuild_completed_at: new Date().toISOString()
                })
            ]
        );

        return {
            publish_run: {
                id: publishRun.id,
                trigger_source: publishRun.trigger_source,
                requested_sports: publishRun.requested_sports,
                status: 'completed'
            },
            normal,
            deep
        };
    } catch (error) {
        await query(
            `
            UPDATE prediction_publish_runs
            SET status = 'failed',
                completed_at = NOW(),
                error_message = $2,
                metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
            WHERE id = $1
            `,
            [
                publishRun.id,
                error.message,
                JSON.stringify({
                    rebuild_failed_at: new Date().toISOString(),
                    failure_name: error?.name || 'Error'
                })
            ]
        );
        throw error;
    }
}

module.exports = {
    runPipelineForMatches,
    runPipelineFromConfiguredDataMode,
    rebuildFinalOutputs
};
