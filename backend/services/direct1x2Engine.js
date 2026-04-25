'use strict';

function toFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function clamp01(value) {
    return Math.max(0, Math.min(1, toFiniteNumber(value, 0)));
}

function normalizeProbabilities(probabilities) {
    const safe = {
        home: Math.max(0, toFiniteNumber(probabilities?.home, 0)),
        draw: Math.max(0, toFiniteNumber(probabilities?.draw, 0)),
        away: Math.max(0, toFiniteNumber(probabilities?.away, 0))
    };

    const total = safe.home + safe.draw + safe.away;
    if (total <= 0) {
        return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
    }

    return {
        home: safe.home / total,
        draw: safe.draw / total,
        away: safe.away / total
    };
}

function evaluateDirect1x2(matchContext = {}) {
    const baseProb = matchContext?.baseProb || {};
    const contextAdjustments = (matchContext?.contextAdjustments && typeof matchContext.contextAdjustments === 'object')
        ? matchContext.contextAdjustments
        : {};
    const volatilityScore = clamp01(matchContext?.volatilityScore);

    let probabilities = normalizeProbabilities(baseProb);
    const stages = [];

    stages.push({
        stage: 1,
        label: 'Raw Data',
        probabilities: { ...probabilities }
    });

    const factors = ['weather', 'availability', 'discipline', 'stability'];
    factors.forEach((factor, index) => {
        const adjustment = contextAdjustments[factor];
        if (!adjustment || typeof adjustment !== 'object') return;

        probabilities.home += toFiniteNumber(adjustment.home, 0);
        probabilities.draw += toFiniteNumber(adjustment.draw, 0);
        probabilities.away += toFiniteNumber(adjustment.away, 0);

        stages.push({
            stage: index + 2,
            label: factor,
            probabilities: { ...probabilities }
        });
    });

    probabilities = normalizeProbabilities(probabilities);

    let outcome = 'home_win';
    let confidence = probabilities.home;

    if (probabilities.draw > confidence) {
        outcome = 'draw';
        confidence = probabilities.draw;
    }

    if (probabilities.away > confidence) {
        outcome = 'away_win';
        confidence = probabilities.away;
    }

    confidence = Math.round(confidence * 100);

    let tier = 'REJECT';
    let secondaryRequired = false;
    let accaEligible = false;

    if (confidence >= 45 && confidence <= 59) {
        tier = 'LOW';
        secondaryRequired = true;
    } else if (confidence >= 60 && confidence <= 79) {
        tier = 'MODERATE';
        secondaryRequired = true;
    } else if (confidence >= 80) {
        tier = 'HIGH';
        secondaryRequired = false;
        accaEligible = true;
    }

    if (volatilityScore > 0.7) {
        tier = 'LOW';
        secondaryRequired = true;
        accaEligible = false;
    }

    return {
        market: '1X2',
        outcome,
        confidence,
        tier,
        stages,
        secondaryRequired,
        accaEligible,
        volatilityScore
    };
}

module.exports = {
    evaluateDirect1x2
};

