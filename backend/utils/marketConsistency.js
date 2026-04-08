'use strict';

// Football outcome universe
const OUTCOMES = {
    H: 'H', // home
    D: 'D', // draw
    A: 'A'  // away
};

function normMarket(m) {
    return String(m || '').trim().toLowerCase();
}

function normPick(p) {
    return String(p || '').trim().toUpperCase();
}

function outcomeSetForLeg(market, pick) {
    const m = normMarket(market);
    const p = normPick(pick);

    // 1X2 / match result
    if (m === '1x2' || m === 'match_result' || m === 'match result') {
        if (p === 'HOME WIN' || p === 'HOME_WIN' || p === 'HOME') return new Set([OUTCOMES.H]);
        if (p === 'AWAY WIN' || p === 'AWAY_WIN' || p === 'AWAY') return new Set([OUTCOMES.A]);
        if (p === 'DRAW' || p === 'X') return new Set([OUTCOMES.D]);
    }

    // double chance
    if (m.includes('double_chance') || m === 'double chance') {
        if (p === '1X') return new Set([OUTCOMES.H, OUTCOMES.D]);
        if (p === 'X2') return new Set([OUTCOMES.D, OUTCOMES.A]);
        if (p === '12') return new Set([OUTCOMES.H, OUTCOMES.A]);
    }

    // Unknown/non-result market: cannot infer, treat as compatible by default
    return null;
}

function areLegsCompatible(legA, legB) {
    const setA = outcomeSetForLeg(legA.market, legA.pick ?? legA.prediction);
    const setB = outcomeSetForLeg(legB.market, legB.pick ?? legB.prediction);

    // If one is non-result, we don't block here.
    if (!setA || !setB) return true;

    for (const x of setA) if (setB.has(x)) return true;
    return false;
}

function doubleChanceFromBaseline(baseline) {
    const home = Number(baseline.home || 0);
    const draw = Number(baseline.draw || 0);
    const away = Number(baseline.away || 0);

    return {
        '1X': home + draw,
        'X2': draw + away,
        '12': home + away
    };
}

function sanitizeSameMatchLegs(legs) {
    const out = [];
    for (const leg of legs) {
        // only accept leg if compatible with all already accepted legs
        if (out.every((kept) => areLegsCompatible({ market: kept.market, prediction: kept.prediction }, { market: leg.market, prediction: leg.prediction }))) {
            out.push(leg);
        }
    }
    return out;
}

function validatePredictionSet(predictions) {
    const conflicts = [];
    const validPredictions = [];

    for (let i = 0; i < predictions.length; i++) {
        const current = predictions[i];
        let hasConflict = false;

        for (let j = 0; j < validPredictions.length; j++) {
            const existing = validPredictions[j];
            
            if (!areLegsCompatible(
                { market: current.market, prediction: current.prediction },
                { market: existing.market, prediction: existing.prediction }
            )) {
                conflicts.push({
                    prediction_a: current,
                    prediction_b: existing,
                    reason: 'Outcome sets are incompatible'
                });
                hasConflict = true;
                break;
            }
        }

        if (!hasConflict) {
            validPredictions.push(current);
        }
    }

    return {
        valid: validPredictions,
        conflicts,
        is_valid: conflicts.length === 0
    };
}

module.exports = {
    outcomeSetForLeg,
    areLegsCompatible,
    doubleChanceFromBaseline,
    sanitizeSameMatchLegs,
    validatePredictionSet,
    OUTCOMES
};
