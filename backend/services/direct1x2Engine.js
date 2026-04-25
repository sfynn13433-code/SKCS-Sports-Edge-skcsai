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

function stagePayload(stage, label, reason, probabilities) {
    const normalized = normalizeProbabilities(probabilities);
    return {
        stage,
        label,
        reason: String(reason || '').trim(),
        updatedProbabilities: { ...normalized },
        probabilities: { ...normalized }
    };
}

function countKeyPlayersOutBySide(injuries = {}) {
    const home = Math.max(0, toFiniteNumber(injuries?.home?.keyPlayersOut, 0));
    const away = Math.max(0, toFiniteNumber(injuries?.away?.keyPlayersOut, 0));
    return { home, away };
}

function hasUsableContext(matchContext = {}) {
    const weather = matchContext?.weather;
    const injuries = matchContext?.injuries;
    const h2h = matchContext?.h2h;
    const form = matchContext?.form;

    const weatherSeen = weather && typeof weather === 'object' && (
        typeof weather.rain === 'boolean'
        || weather.condition
        || weather.summary
    );
    const injuriesSeen = injuries && typeof injuries === 'object' && (
        Number(injuries?.home?.keyPlayersOut) > 0
        || Number(injuries?.away?.keyPlayersOut) > 0
    );
    const h2hSeen = h2h && typeof h2h === 'object' && (
        typeof h2h.lowScoringTrend === 'boolean'
        || Number.isFinite(Number(h2h.avgGoals))
    );
    const formSeen = form && typeof form === 'object' && (
        Number.isFinite(Number(form.homePointsLast5))
        || Number.isFinite(Number(form.awayPointsLast5))
        || Number.isFinite(Number(form.homeMomentum))
        || Number.isFinite(Number(form.awayMomentum))
    );

    return Boolean(weatherSeen || injuriesSeen || h2hSeen || formSeen);
}

function evaluateDirect1x2(matchContext = {}) {
    const baseProb = matchContext?.baseProb || {};
    const volatilityScore = clamp01(matchContext?.volatilityScore);
    const weather = matchContext?.weather && typeof matchContext.weather === 'object'
        ? matchContext.weather
        : null;
    const injuries = matchContext?.injuries && typeof matchContext.injuries === 'object'
        ? matchContext.injuries
        : {};
    const h2h = matchContext?.h2h && typeof matchContext.h2h === 'object'
        ? matchContext.h2h
        : null;
    const form = matchContext?.form && typeof matchContext.form === 'object'
        ? matchContext.form
        : null;
    const limitedContext = !hasUsableContext(matchContext);

    let probabilities = normalizeProbabilities(baseProb);
    const stages = [];

    stages.push(stagePayload(
        1,
        'Raw Data',
        'Raw probabilities from baseline model.',
        probabilities
    ));

    let stage2Reason = 'No weather context available — no probability shift.';
    if (weather) {
        const conditionText = String(weather.condition || weather.summary || '').toLowerCase();
        const rainFlag = weather.rain === true
            || conditionText.includes('rain')
            || conditionText.includes('shower')
            || conditionText.includes('drizzle')
            || conditionText.includes('storm');

        if (rainFlag) {
            probabilities.draw += 0.03;
            probabilities.home -= 0.015;
            probabilities.away -= 0.015;
            stage2Reason = 'Rain expected — slower tempo increases draw likelihood.';
        } else {
            stage2Reason = 'Weather context stable — no draw inflation triggered.';
        }
    }
    probabilities = normalizeProbabilities(probabilities);
    stages.push(stagePayload(2, 'Weather', stage2Reason, probabilities));

    const keyPlayersOut = countKeyPlayersOutBySide(injuries);
    let stage3Reason = 'No key-player injury signal detected — no injury adjustment.';
    if (keyPlayersOut.home > 0) {
        probabilities.home -= 0.05;
        probabilities.draw += 0.03;
        probabilities.away += 0.02;
        stage3Reason = 'Home team missing key players — attacking strength reduced.';
    } else if (keyPlayersOut.away > 0) {
        probabilities.away -= 0.05;
        probabilities.draw += 0.03;
        probabilities.home += 0.02;
        stage3Reason = 'Away team missing key players — away attacking strength reduced.';
    }
    probabilities = normalizeProbabilities(probabilities);
    stages.push(stagePayload(3, 'Injuries', stage3Reason, probabilities));

    let stage4Reasons = [];
    if (h2h?.lowScoringTrend === true) {
        probabilities.draw += 0.02;
        probabilities.home -= 0.01;
        probabilities.away -= 0.01;
        stage4Reasons.push('Recent head-to-head matches show low scoring trends.');
    }

    const homePointsLast5 = toFiniteNumber(form?.homePointsLast5, NaN);
    const awayPointsLast5 = toFiniteNumber(form?.awayPointsLast5, NaN);
    const homeMomentum = toFiniteNumber(form?.homeMomentum, NaN);
    const awayMomentum = toFiniteNumber(form?.awayMomentum, NaN);
    const pointsDelta = Number.isFinite(homePointsLast5) && Number.isFinite(awayPointsLast5)
        ? homePointsLast5 - awayPointsLast5
        : NaN;
    const momentumDelta = Number.isFinite(homeMomentum) && Number.isFinite(awayMomentum)
        ? homeMomentum - awayMomentum
        : NaN;

    if (Number.isFinite(pointsDelta)) {
        if (pointsDelta >= 4) {
            probabilities.home += 0.02;
            probabilities.away -= 0.02;
            stage4Reasons.push('Home recent form trend is stronger over the last 5 fixtures.');
        } else if (pointsDelta <= -4) {
            probabilities.away += 0.02;
            probabilities.home -= 0.02;
            stage4Reasons.push('Away recent form trend is stronger over the last 5 fixtures.');
        }
    } else if (Number.isFinite(momentumDelta)) {
        if (momentumDelta >= 0.25) {
            probabilities.home += 0.015;
            probabilities.away -= 0.015;
            stage4Reasons.push('Home momentum trend is stronger in current form indicators.');
        } else if (momentumDelta <= -0.25) {
            probabilities.away += 0.015;
            probabilities.home -= 0.015;
            stage4Reasons.push('Away momentum trend is stronger in current form indicators.');
        }
    }

    if (!stage4Reasons.length) {
        stage4Reasons.push('No strong H2H/form trend detected — baseline balance retained.');
    }

    probabilities = normalizeProbabilities(probabilities);
    stages.push(stagePayload(4, 'H2H & Form', stage4Reasons.join(' '), probabilities));

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
        tier = 'EXTREME_CAUTION';
        secondaryRequired = true;
    } else if (confidence >= 60 && confidence <= 79) {
        tier = 'MODERATE_HIGH_CAUTION';
        secondaryRequired = true;
    } else if (confidence >= 80) {
        tier = 'STRONG';
        secondaryRequired = true;
        accaEligible = true;
    }

    if (volatilityScore > 0.7) {
        tier = 'EXTREME_CAUTION';
        secondaryRequired = true;
        accaEligible = false;
    }

    let stage5Reason = `Volatility score ${volatilityScore.toFixed(2)} — no override applied.`;
    if (volatilityScore > 0.7) {
        stage5Reason = `Volatility score ${volatilityScore.toFixed(2)} — high volatility override applied (tier forced to EXTREME CAUTION).`;
    }
    stages.push(stagePayload(5, 'Volatility Check', stage5Reason, probabilities));

    const finalReason = `Final insight: ${outcome} at ${confidence}% confidence (${tier}).`;
    stages.push(stagePayload(6, 'Final Insight', finalReason, probabilities));

    return {
        market: '1X2',
        outcome,
        confidence,
        tier,
        stages,
        secondaryRequired,
        accaEligible,
        volatilityScore,
        limitedContext
    };
}

module.exports = {
    evaluateDirect1x2
};
