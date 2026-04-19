'use strict';

const { createClient } = require('@supabase/supabase-js');
const { selectSecondaryMarkets } = require('../utils/secondaryMarketSelector');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_KEY
    || process.env.SUPABASE_ANON_KEY
    || ''
).trim();

const supabase = SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
    })
    : null;

function asNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function clampConfidence(value) {
    return Math.max(0, Math.min(100, Math.round(asNumber(value, 0))));
}

function getRiskTier(confidence) {
    const score = clampConfidence(confidence);
    if (score >= 80) return 'HIGH_CONFIDENCE';
    if (score >= 70) return 'MODERATE_RISK';
    if (score >= 59) return 'HIGH_RISK';
    return 'EXTREME_RISK';
}

function toLegacyRiskLevel(confidence) {
    return clampConfidence(confidence) >= 70 ? 'safe' : 'medium';
}

function normalizePrediction(prediction) {
    const key = String(prediction || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (key === 'home' || key === 'home_win' || key === '1') return 'home_win';
    if (key === 'draw' || key === 'x') return 'draw';
    if (key === 'away' || key === 'away_win' || key === '2') return 'away_win';
    return 'home_win';
}

function prettyPrediction(prediction) {
    const normalized = normalizePrediction(prediction);
    if (normalized === 'home_win') return 'HOME WIN';
    if (normalized === 'draw') return 'DRAW';
    return 'AWAY WIN';
}

function generateEdgeMindReport(fixture, confidence, riskTier) {
    const score = clampConfidence(confidence);
    const predictionText = prettyPrediction(fixture?.prediction || fixture?.recommendation);
    const context = String(fixture?.context || 'Core squad status appears stable.').trim();
    const volatility = String(fixture?.volatility || 'Low variability profile').trim();
    const cautionLine = (
        riskTier === 'HIGH_RISK' || riskTier === 'EXTREME_RISK'
    )
        ? 'Stage 4 Decision: Direct 1X2 requires elevated caution; pivot to Secondary Insights for coverage.'
        : 'Stage 4 Decision: Direct 1X2 can be selected with standard stake discipline.';

    return [
        `Stage 1 Baseline: ${predictionText} projects at ${score}% confidence.`,
        `Stage 2 Context: ${context}`,
        `Stage 3 Reality: ${volatility}.`,
        cautionLine
    ].join(' ');
}

function buildMatchesPayload(fixture, confidence, prediction, riskTier, secondaryMarkets) {
    return [{
        fixture_id: String(fixture?.fixture_id || fixture?.id || fixture?.match_id || ''),
        home_team: String(fixture?.home_team || ''),
        away_team: String(fixture?.away_team || ''),
        market: '1X2',
        prediction: normalizePrediction(prediction),
        confidence: clampConfidence(confidence),
        match_date: fixture?.match_date || fixture?.date || fixture?.commence_time || null,
        sport: String(fixture?.sport || 'football'),
        risk_tier: riskTier,
        secondary_markets: secondaryMarkets
    }];
}

async function buildAndStoreDirect1X2(fixture, confidence, prediction, additionalData = {}) {
    if (!supabase) {
        return { success: false, error: new Error('Supabase is not configured (SUPABASE_URL / key missing).') };
    }

    const fixtureId = String(fixture?.fixture_id || fixture?.id || fixture?.match_id || '').trim();
    if (!fixtureId) {
        return { success: false, error: new Error('fixture_id is required') };
    }

    const score = clampConfidence(confidence);
    const normalizedPrediction = normalizePrediction(prediction || fixture?.prediction);
    const riskTier = getRiskTier(score);
    const secondaryMarkets = score < 70 ? selectSecondaryMarkets({ ...fixture, prediction: normalizedPrediction }) : [];
    const edgemindReport = generateEdgeMindReport(
        { ...fixture, prediction: normalizedPrediction },
        score,
        riskTier
    );

    const row = {
        fixture_id: fixtureId,
        sport: String(fixture?.sport || 'football'),
        home_team: String(fixture?.home_team || ''),
        away_team: String(fixture?.away_team || ''),
        confidence: score,
        total_confidence: score,
        risk_tier: riskTier,
        risk_level: toLegacyRiskLevel(score),
        prediction: normalizedPrediction,
        recommendation: prettyPrediction(normalizedPrediction),
        market_type: '1X2',
        tier: 'normal',
        type: 'direct',
        match_date: fixture?.match_date || fixture?.date || fixture?.commence_time || null,
        matches: buildMatchesPayload(fixture, score, normalizedPrediction, riskTier, secondaryMarkets),
        secondary_markets: secondaryMarkets,
        secondary_insights: secondaryMarkets,
        edgemind_report: additionalData?.edgemind_report || edgemindReport,
        created_at: new Date().toISOString()
    };

    const existingResult = await supabase
        .from('direct1x2_prediction_final')
        .select('id')
        .eq('fixture_id', fixtureId)
        .eq('type', 'direct')
        .eq('tier', 'normal')
        .is('publish_run_id', null)
        .limit(1);

    if (existingResult.error) {
        console.error('[direct1x2Builder] lookup failed:', existingResult.error.message);
    }

    const existingId = existingResult?.data?.[0]?.id || null;
    const mutation = existingId
        ? supabase.from('direct1x2_prediction_final').update(row).eq('id', existingId).select('*').single()
        : supabase.from('direct1x2_prediction_final').insert(row).select('*').single();

    const { data, error } = await mutation;
    if (error) {
        console.error('[direct1x2Builder] write failed:', error.message);
        return { success: false, error };
    }

    return { success: true, data, riskTier, secondaryMarkets };
}

module.exports = {
    buildAndStoreDirect1X2,
    generateEdgeMindReport,
    getRiskTier
};
