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
const pipelineLogger = require('../utils/pipelineLogger');
const enrichFixtureWithContext = require('../src/services/contextIntelligence/aiPipeline');
const adjustProbability = require('../src/services/contextIntelligence/adjustProbability');
const { resolveDecision } = require('../src/services/marketRouter/waterfall');

let isRunning = false;

function normalizeSport(sport) {
    if (typeof sport !== 'string' || sport.trim().length === 0) throw new Error('sport must be a non-empty string');
    return sport.trim().toLowerCase();
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

function normalizeContextSignals(value) {
    const source = value && typeof value === 'object' ? value : {};
    const read = (key) => {
        const n = Number(source[key]);
        if (!Number.isFinite(n)) return 0;
        return clamp(n, 0, 1);
    };
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
        lineup_uncertainty_risk: read('lineup_uncertainty_risk')
    };
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

    const sport = normalizeSport(matchContext?.sport || item.sport || 'football');
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
    const waterfallDecision = resolveDecision(waterfallProbabilities);

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

    if (waterfallDecision.status === 'no_bet' && !marketSelections.direct) {
        console.log('[aiPipeline] no-bet fixture skipped match_id=%s phase=%s', match_id, waterfallDecision.phase);
        pipelineLogger.rejectionAdd({
            run_id: telemetryRunId,
            sport,
            bucket: 'publish_skip',
            metadata: {
                match_id,
                reason: 'waterfall_no_bet'
            }
        });
        pipelineLogger.rejectionAdd({
            run_id: telemetryRunId,
            sport,
            bucket: 'low_confidence',
            metadata: { match_id }
        });
        return null;
    }

    const selectedDirect = marketSelections.direct || null;
    const selectedSecondary = marketSelections.secondary || null;
    const market = selectedDirect?.market || waterfallDecision.market || requestedMarket;
    const routedPrediction = selectedDirect?.prediction || waterfallDecision.prediction || fallbackPredictionForMarket(market, prediction);
    const confidenceProbability = selectedDirect?.probability || waterfallDecision.confidence_probability || p_adj;
    const confidence = Math.max(80, toConfidencePercent(confidenceProbability));
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
            market_intelligence: {
                direct_market: selectedDirect,
                secondary_market: selectedSecondary,
                same_match: marketSelections.same_match,
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
                phase: selectedDirect ? 'market_intelligence_tiered' : waterfallDecision.phase,
                status: selectedDirect ? 'locked' : waterfallDecision.status,
                final_recommendation: {
                    market: selectedDirect ? toTitleCase(selectedDirect.market) : (waterfallDecision.display_market || toTitleCase(market)),
                    confidence
                },
                engine_log: ensureArray(waterfallDecision.engine_log),
                probabilities: waterfallDecision.probabilities || {},
                insights: uiInsights
            },
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

async function runPipelineForMatches({ matches, telemetry = {} }) {
    if (!Array.isArray(matches) || matches.length === 0) {
        throw new Error('matches must be a non-empty array');
    }

    if (isRunning) {
        console.warn('[aiPipeline] blocked: pipeline already running');
        return { mode: 'manual', inserted: [], filtered: [], filtered_valid: 0, filtered_invalid: 0, error: 'Pipeline already running' };
    }

    isRunning = true;

    try {
        return await withTransaction(async (client) => {
            const inserted = [];
            let normalValid = 0;
            let normalInvalid = 0;

        console.log('[aiPipeline] manual matches input count=%s', matches.length);

        for (const item of matches) {
            const raw = await buildRawPredictionFromProviderItem({
                ...item,
                data_mode: 'manual',
                telemetry
            });
            if (!raw) continue;
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

    if (isRunning) {
        console.warn('[aiPipeline] blocked: pipeline already running');
        return { mode, inserted: [], filtered: [], filtered_valid: 0, filtered_invalid: 0, error: 'Pipeline already running' };
    }

    isRunning = true;

    try {
        return await withTransaction(async (client) => {
            const inserted = [];

        console.log('[aiPipeline] DATA_MODE=%s provider_items=%s', mode, predictions.length);

        for (const item of predictions) {
            const raw = await buildRawPredictionFromProviderItem({
                ...item,
                data_mode: mode
            });
            if (!raw) continue;

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
                filtered_invalid: filteredInvalid
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
            JSON.stringify(options.metadata || {})
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
                metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
            WHERE id = $1
            `,
            [
                publishRun.id,
                JSON.stringify({ summary })
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
                error_message = $2
            WHERE id = $1
            `,
            [publishRun.id, error.message]
        );
        throw error;
    }
}

module.exports = {
    runPipelineForMatches,
    runPipelineFromConfiguredDataMode,
    rebuildFinalOutputs
};
