'use strict';

const { query, withTransaction } = require('../db');
const { validateRawPredictionInput } = require('../utils/validation');
const { filterRawPrediction } = require('./filterEngine');
const { buildFinalForTier } = require('./accaBuilder');
const { getPredictionInputs } = require('./dataProvider');
const { scoreMatch } = require('./aiScoring');
const enrichFixtureWithContext = require('../src/services/contextIntelligence/aiPipeline');
const adjustProbability = require('../src/services/contextIntelligence/adjustProbability');

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
        stability_risk: read('stability_risk')
    };
}

function buildContextFixture(item, matchId, sport) {
    const metadata = item?.metadata && typeof item.metadata === 'object' ? item.metadata : {};
    const rawProviderData = item?.raw_provider_data && typeof item.raw_provider_data === 'object'
        ? item.raw_provider_data
        : {};

    return {
        match_id: matchId,
        sport,
        home_team: item.home_team || metadata.home_team || null,
        away_team: item.away_team || metadata.away_team || null,
        competition: item.league || item.competition || metadata.league || metadata.competition || null,
        location:
            item.location ||
            item.venue ||
            metadata.venue ||
            rawProviderData?.venue?.name ||
            rawProviderData?.venue?.city ||
            metadata.city ||
            'London',
        kickoffTime:
            item.date ||
            item.commence_time ||
            item.kickoff ||
            item.match_time ||
            metadata.match_time ||
            metadata.kickoff ||
            new Date().toISOString(),
        teamData:
            item.teamData ||
            metadata.teamData ||
            rawProviderData.teamData ||
            {
                injuries: [],
                suspensions: [],
                expectedXI: { reliability: 1 }
            },
        teamDiscipline:
            item.teamDiscipline ||
            metadata.teamDiscipline ||
            rawProviderData.teamDiscipline ||
            {
                redCards: { last5Games: 0 },
                yellowCardThreats: [],
                bans: []
            },
        teamContext:
            item.teamContext ||
            metadata.teamContext ||
            rawProviderData.teamContext ||
            {
                coachConflict: false,
                execInstability: false,
                playerLegalIssues: [],
                fanViolence: false
            }
    };
}

async function buildRawPredictionFromProviderItem(item) {
    const match_id = String(item.match_id || item.id || '').trim();
    if (!match_id) throw new Error('match_id missing in provider item');

    const sport = normalizeSport(item.sport);
    const market = String(item.market || '1X2').trim();

    const scoring = await scoreMatch({
        match_id,
        sport,
        home_team: item.home_team || null,
        away_team: item.away_team || null,
        prediction: item.prediction || null,
        confidence: item.confidence,
        raw_provider_data: item.raw_provider_data || null,
        metadata: item.metadata || null
    });

    const providerPrediction = normalizePrediction(item.prediction);
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
        : scoring.confidence;
    const p_base = toProbability(baselineConfidence);
    let contextEnriched = null;

    try {
        contextEnriched = await enrichFixtureWithContext(buildContextFixture(item, match_id, sport));
    } catch (contextErr) {
        console.warn('[aiPipeline] context enrichment failed for match_id=%s: %s', match_id, contextErr.message);
    }

    const contextSignals = normalizeContextSignals(contextEnriched?.contextSignals);
    const p_adj = adjustProbability(p_base, contextSignals);
    const confidence = toConfidencePercent(p_adj);
    const volatility = item.volatility || scoring.volatility;
    const aiSource = scoring.source || null; // 'dolphin', 'fallback', 'odds', etc.
    const aiReasoning = scoring.reasoning || null;

    const raw = {
        match_id,
        sport,
        market,
        prediction,
        confidence,
        volatility,
        odds: item.odds !== undefined ? item.odds : null,
        metadata: {
            source: 'aiPipeline:v2-provider+aiScoring',
            data_mode: item.data_mode || null,
            prediction_source: predictionSource,
            ai_source: aiSource,
            ai_reasoning: aiReasoning,
            provider: item.provider || null,
            bookmaker: item.bookmaker || null,
            home_team: item.home_team || null,
            away_team: item.away_team || null,
            match_time: item.date || item.commence_time || item.kickoff || item.match_time || null,
            league: item.league || null,
            tournament: item.tournament || null,
            stage: item.stage || item.round || null,
            venue: item.venue || null,
            country: item.country || null,
            context_intelligence: {
                status: contextEnriched?.context_status || 'unavailable',
                cache_key: contextEnriched?.context_cache_key || null,
                last_verified: contextEnriched?.context_last_verified || null,
                signals: contextSignals,
                insights: contextEnriched?.contextInsights || null,
                p_base,
                p_adj,
                confidence_base_pct: Math.round(toProbability(baselineConfidence) * 10000) / 100,
                confidence_adj_pct: confidence
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

    validateRawPredictionInput(raw);
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

async function runPipelineForMatches({ matches }) {
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

        console.log('[aiPipeline] manual matches input count=%s', matches.length);

        for (const item of matches) {
            const raw = await buildRawPredictionFromProviderItem({
                ...item,
                data_mode: 'manual'
            });
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

        console.log('[aiPipeline] inserted_raw=%s filtered_valid=%s filtered_invalid=%s', inserted.length, filteredValid, filteredInvalid);

            return {
                mode: 'manual',
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
            requestedSports
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
