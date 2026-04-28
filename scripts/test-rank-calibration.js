'use strict';

const assert = require('assert');
const {
    buildPredictionFromRank,
    calibrateRankConfidence
} = require('../backend/services/footballRankExtractor');

function testStrongGapHighProbability() {
    const result = calibrateRankConfidence({
        probability: 0.82,
        market: 'HOME_WIN',
        rank_gap: 14,
        home_rank: 2,
        away_rank: 16,
        homeWin: 0.82,
        draw: 0.10,
        awayWin: 0.08,
        over15: 0.78,
        over25: 0.70,
        btts: 0.61
    });

    assert.ok(result.confidence >= 75, 'expected strong confidence for strong rank signal');
    assert.ok(result.volatility_score <= 59, 'expected low/medium volatility for strong rank signal');
}

function testSmallGapWeakProbability() {
    const result = calibrateRankConfidence({
        probability: 0.56,
        market: 'DRAW',
        rank_gap: 1,
        home_rank: 9,
        away_rank: 10,
        homeWin: 0.31,
        draw: 0.56,
        awayWin: 0.13
    });

    assert.ok(result.confidence <= 68, 'expected lower confidence for weak/small-gap signal');
    assert.ok(result.volatility_score >= 30, 'expected medium/high volatility for weak/small-gap signal');
}

function testMissingRankFieldsPenalty() {
    const result = calibrateRankConfidence({
        probability: 0.64,
        market: 'HOME_WIN',
        homeWin: 0.64,
        draw: 0.22,
        awayWin: 0.14
    });

    assert.ok(result.confidence <= 72, 'expected confidence reduction when rank fields are missing');
    assert.ok(result.volatility_score >= 45, 'expected higher volatility when rank fields are missing');
}

function testConfidenceBounds() {
    const low = calibrateRankConfidence({
        probability: 0.05,
        market: 'DRAW'
    });
    const high = calibrateRankConfidence({
        probability: 0.99,
        market: 'HOME_WIN',
        rank_gap: 20,
        home_rank: 1,
        away_rank: 21,
        homeWin: 0.99,
        draw: 0.005,
        awayWin: 0.005,
        over15: 0.90,
        over25: 0.82,
        btts: 0.60
    });

    assert.ok(low.confidence >= 55, 'confidence should never drop below 55');
    assert.ok(high.confidence <= 92, 'confidence should never exceed 92');
}

function testPredictionShape() {
    const prediction = buildPredictionFromRank({
        homeWin: 0.69,
        draw: 0.20,
        awayWin: 0.11,
        over25: 0.66,
        over15: 0.73,
        btts: 0.54,
        rank_gap: 7,
        home_rank: 3,
        away_rank: 10
    });

    assert.ok(prediction && typeof prediction === 'object', 'prediction must exist');
    assert.ok(['HOME_WIN', 'DRAW', 'AWAY_WIN'].includes(prediction.market), 'primary market shape must be valid');
    assert.ok(Number.isFinite(prediction.confidence), 'prediction must include confidence');
    assert.ok(typeof prediction.confidence_band === 'string', 'prediction must include confidence band');
    assert.ok(Number.isFinite(prediction.volatility_score), 'prediction must include volatility score');
    assert.ok(typeof prediction.volatility_label === 'string', 'prediction must include volatility label');
}

function testAiPipelineLoad() {
    // eslint-disable-next-line global-require
    const pipeline = require('../backend/services/aiPipeline');
    assert.ok(pipeline && typeof pipeline === 'object', 'aiPipeline module should load');
}

function run() {
    testStrongGapHighProbability();
    testSmallGapWeakProbability();
    testMissingRankFieldsPenalty();
    testConfidenceBounds();
    testPredictionShape();
    console.log('✅ rank confidence calibration tests passed');

    testAiPipelineLoad();
    console.log('✅ aiPipeline module load passed');
}

run();
