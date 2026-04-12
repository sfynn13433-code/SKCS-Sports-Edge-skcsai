'use strict';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function toProb(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return clamp(n, 0, 1);
}

function toPct(probability) {
    return Math.round(toProb(probability) * 100);
}

function normalizeProbabilities(input = {}) {
    const homeWin = toProb(input.home_win, 0);
    const awayWin = toProb(input.away_win, 0);
    const draw = toProb(input.draw, clamp(1 - homeWin - awayWin, 0, 1));

    const doubleChance1X = toProb(input.double_chance_1x, clamp(homeWin + draw, 0, 1));
    const doubleChanceX2 = toProb(input.double_chance_x2, clamp(awayWin + draw, 0, 1));
    const dnbHome = toProb(input.draw_no_bet_home, homeWin);
    const dnbAway = toProb(input.draw_no_bet_away, awayWin);

    const over15 = toProb(input.over_1_5, 0);
    const under45 = toProb(input.under_4_5, 0);

    return {
        home_win: homeWin,
        away_win: awayWin,
        draw,
        double_chance_1x: doubleChance1X,
        double_chance_x2: doubleChanceX2,
        draw_no_bet_home: dnbHome,
        draw_no_bet_away: dnbAway,
        over_1_5: over15,
        under_4_5: under45
    };
}

function resolveDecision(probabilitiesInput = {}) {
    const probabilities = normalizeProbabilities(probabilitiesInput);
    const engine_log = [];

    // Phase 1: 1x2 Apex Test
    const apex = [
        { market: '1X2', prediction: 'home_win', display_market: 'Home Win (1)', value: probabilities.home_win },
        { market: '1X2', prediction: 'away_win', display_market: 'Away Win (2)', value: probabilities.away_win }
    ].sort((a, b) => b.value - a.value)[0];

    if (apex.value >= 0.75) {
        engine_log.push(`Phase 1: ${apex.display_market} locked at ${toPct(apex.value)}% (>= 75% threshold).`);
        return {
            status: 'locked',
            phase: 'phase_1_apex',
            market: apex.market,
            prediction: apex.prediction,
            display_market: apex.display_market,
            confidence_probability: apex.value,
            confidence: toPct(apex.value),
            engine_log,
            probabilities
        };
    }
    engine_log.push(`Phase 1: ${apex.display_market} rejected (Calculated at ${toPct(apex.value)}% - Below 75% threshold).`);

    // Phase 2: Core Safe Pivot
    const safePivot = [
        { market: 'double_chance_1x', prediction: '1x', display_market: 'Double Chance - 1X', value: probabilities.double_chance_1x },
        { market: 'double_chance_x2', prediction: 'x2', display_market: 'Double Chance - X2', value: probabilities.double_chance_x2 },
        { market: 'draw_no_bet_home', prediction: 'home', display_market: 'Draw No Bet - Home', value: probabilities.draw_no_bet_home },
        { market: 'draw_no_bet_away', prediction: 'away', display_market: 'Draw No Bet - Away', value: probabilities.draw_no_bet_away }
    ].sort((a, b) => b.value - a.value)[0];

    if (safePivot.value >= 0.85) {
        engine_log.push(`Phase 2: Pivot to Safe Market. ${safePivot.display_market} locked at ${toPct(safePivot.value)}% confidence.`);
        return {
            status: 'locked',
            phase: 'phase_2_safe_pivot',
            market: safePivot.market,
            prediction: safePivot.prediction,
            display_market: safePivot.display_market,
            confidence_probability: safePivot.value,
            confidence: toPct(safePivot.value),
            engine_log,
            probabilities
        };
    }
    engine_log.push(`Phase 2: Safe pivot rejected (${safePivot.display_market} at ${toPct(safePivot.value)}% - Below 85% threshold).`);

    // Phase 3: Defensive Floor
    const defensive = [
        { market: 'over_1_5', prediction: 'over', display_market: 'Over 1.5 Goals', value: probabilities.over_1_5 },
        { market: 'under_4_5', prediction: 'under', display_market: 'Under 4.5 Goals', value: probabilities.under_4_5 }
    ].sort((a, b) => b.value - a.value)[0];

    if (defensive.value >= 0.90) {
        engine_log.push(`Phase 3: Defensive floor engaged. ${defensive.display_market} locked at ${toPct(defensive.value)}% confidence.`);
        return {
            status: 'locked',
            phase: 'phase_3_defensive_floor',
            market: defensive.market,
            prediction: defensive.prediction,
            display_market: defensive.display_market,
            confidence_probability: defensive.value,
            confidence: toPct(defensive.value),
            engine_log,
            probabilities
        };
    }

    engine_log.push(`Phase 3: Defensive floor rejected (${defensive.display_market} at ${toPct(defensive.value)}% - Below 90% threshold).`);
    engine_log.push('Result: NO BET (all waterfall phases failed threshold checks).');
    return {
        status: 'no_bet',
        phase: 'phase_3_no_bet',
        market: null,
        prediction: null,
        display_market: 'NO BET',
        confidence_probability: defensive.value,
        confidence: toPct(defensive.value),
        engine_log,
        probabilities
    };
}

module.exports = {
    resolveDecision
};
