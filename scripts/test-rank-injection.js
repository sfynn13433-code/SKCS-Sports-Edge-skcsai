'use strict';

const { extractRankData, buildPredictionFromRank } = require('../backend/services/footballRankExtractor');

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeRankPrimaryMarket(market) {
    const key = String(market || '').trim().toUpperCase();
    if (key === 'HOME_WIN') return 'home_win';
    if (key === 'DRAW') return 'draw';
    if (key === 'AWAY_WIN') return 'away_win';
    return null;
}

function applyRankInjection(match, basePrediction) {
    const rankData = extractRankData(match);
    if (!rankData) {
        return {
            ...basePrediction,
            source: 'fallback_original',
            rankApplied: false
        };
    }

    const rankPrediction = buildPredictionFromRank(rankData);
    if (!rankPrediction || !Number.isFinite(Number(rankPrediction.probability))) {
        return {
            ...basePrediction,
            source: 'fallback_original',
            rankApplied: false
        };
    }

    const market = normalizeRankPrimaryMarket(rankPrediction.market) || basePrediction.primary_market;
    const confidence = Number.isFinite(Number(rankPrediction.confidence))
        ? clamp(Math.round(Number(rankPrediction.confidence)), 0, 100)
        : clamp(Math.round(Number(rankPrediction.probability) * 100), 0, 100);
    const volatility = Number.isFinite(Number(rankPrediction.volatility))
        ? clamp(Math.round(Number(rankPrediction.volatility)), 0, 100)
        : 50;

    return {
        ...basePrediction,
        primary_market: market,
        confidence,
        volatility,
        secondary_market: rankPrediction.secondary || null,
        source: 'rank_data',
        rankApplied: true
    };
}

const withRank = {
    fixture_id: 'F-1001',
    rank_htw_ft: 0.61,
    rank_drw_ft: 0.21,
    rank_atw_ft: 0.18,
    rank_to_15_ft: 0.74,
    rank_to_25_ft: 0.68,
    rank_btts_ft: 0.58
};

const withoutRank = {
    fixture_id: 'F-1002',
    home_team: 'Alpha',
    away_team: 'Beta'
};

const basePrediction = {
    primary_market: 'draw',
    confidence: 57,
    secondary_market: null
};

const result = [
    {
        fixture_id: withRank.fixture_id,
        before: {
            ...basePrediction,
            confidence: clamp(Math.round(Number(withRank.rank_htw_ft) * 100), 0, 100)
        },
        output: applyRankInjection(withRank, basePrediction)
    },
    {
        fixture_id: withoutRank.fixture_id,
        before: basePrediction,
        output: applyRankInjection(withoutRank, basePrediction)
    }
];

console.log(JSON.stringify(result, null, 2));
