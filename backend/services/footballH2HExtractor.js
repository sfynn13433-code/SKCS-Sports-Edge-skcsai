'use strict';

function clampNumber(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
}

function safeDivide(numerator, denominator) {
    const n = Number(numerator);
    const d = Number(denominator);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return 0;
    return n / d;
}

function buildH2HSignal(h2hData) {
    const source = h2hData && typeof h2hData === 'object' ? h2hData : {};
    const summary = source.summary && typeof source.summary === 'object' ? source.summary : {};
    const completed = Number(source.completed_match_count);
    const completedMatchCount = Number.isFinite(completed) ? completed : 0;
    const matchCount = Number(source.match_count);
    const safeMatchCount = Number.isFinite(matchCount) ? matchCount : 0;
    const notes = [];

    if (completedMatchCount < 3) {
        return {
            available: false,
            match_count: safeMatchCount,
            h2h_edge_team_id: summary.h2h_edge_team_id || null,
            h2h_edge_label: completedMatchCount > 0 ? 'INSUFFICIENT_DATA' : 'INSUFFICIENT_DATA',
            draw_rate: safeDivide(summary.draws, Math.max(1, completedMatchCount)),
            btts_rate: safeDivide(summary.btts_count, Math.max(1, completedMatchCount)),
            over_1_5_rate: safeDivide(summary.over_1_5_count, Math.max(1, completedMatchCount)),
            over_2_5_rate: safeDivide(summary.over_2_5_count, Math.max(1, completedMatchCount)),
            volatility_hint: 'INSUFFICIENT_DATA',
            confidence_adjustment: 0,
            notes: ['insufficient_completed_h2h_sample']
        };
    }

    const drawRate = safeDivide(summary.draws, completedMatchCount);
    const bttsRate = safeDivide(summary.btts_count, completedMatchCount);
    const over15Rate = safeDivide(summary.over_1_5_count, completedMatchCount);
    const over25Rate = safeDivide(summary.over_2_5_count, completedMatchCount);
    const edgeLabel = String(summary.h2h_edge_label || '').trim() || 'BALANCED';

    let confidenceAdjustment = 0;
    let volatilityScore = 50;

    if (drawRate >= 0.45) {
        volatilityScore += 14;
        confidenceAdjustment -= 2;
        notes.push('high_draw_rate');
    } else if (drawRate >= 0.30) {
        volatilityScore += 7;
        confidenceAdjustment -= 1;
        notes.push('moderate_draw_rate');
    }

    if (edgeLabel === 'BALANCED') {
        volatilityScore += 10;
        confidenceAdjustment -= 1;
        notes.push('balanced_h2h');
    } else if (edgeLabel === 'TEAM_ONE_EDGE' || edgeLabel === 'TEAM_TWO_EDGE') {
        volatilityScore -= 8;
        confidenceAdjustment += 2;
        notes.push('clear_h2h_edge');
    }

    if (bttsRate >= 0.7) {
        volatilityScore += 3;
        notes.push('high_btts_rate');
    }

    if (over15Rate >= 0.7 && over25Rate >= 0.55) {
        confidenceAdjustment += 1;
        notes.push('consistent_goal_pattern');
    }

    volatilityScore = clampNumber(volatilityScore, 0, 100);
    confidenceAdjustment = clampNumber(confidenceAdjustment, -4, 4);

    let volatilityHint = 'MEDIUM';
    if (volatilityScore >= 60) volatilityHint = 'HIGH';
    else if (volatilityScore <= 35) volatilityHint = 'LOW';

    return {
        available: true,
        match_count: safeMatchCount,
        h2h_edge_team_id: summary.h2h_edge_team_id || null,
        h2h_edge_label: edgeLabel,
        draw_rate: Math.round(drawRate * 1000) / 1000,
        btts_rate: Math.round(bttsRate * 1000) / 1000,
        over_1_5_rate: Math.round(over15Rate * 1000) / 1000,
        over_2_5_rate: Math.round(over25Rate * 1000) / 1000,
        volatility_hint: volatilityHint,
        confidence_adjustment: confidenceAdjustment,
        notes
    };
}

function getH2HVolatilityAdjustment(h2hSignal) {
    const signal = h2hSignal && typeof h2hSignal === 'object' ? h2hSignal : {};
    let adjustment = 0;

    if (signal.available !== true) adjustment += 4;

    const drawRate = Number(signal.draw_rate);
    if (Number.isFinite(drawRate)) {
        if (drawRate >= 0.45) adjustment += 5;
        else if (drawRate >= 0.30) adjustment += 3;
    }

    const edgeLabel = String(signal.h2h_edge_label || '').trim().toUpperCase();
    if (edgeLabel === 'BALANCED') adjustment += 4;
    if (edgeLabel === 'TEAM_ONE_EDGE' || edgeLabel === 'TEAM_TWO_EDGE') adjustment -= 3;

    const volatilityHint = String(signal.volatility_hint || '').trim().toUpperCase();
    if (volatilityHint === 'HIGH') adjustment += 3;
    else if (volatilityHint === 'LOW') adjustment -= 1;

    return clampNumber(Math.round(adjustment), -10, +15);
}

module.exports = {
    buildH2HSignal,
    getH2HVolatilityAdjustment
};
