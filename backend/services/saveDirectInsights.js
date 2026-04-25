'use strict';

function asNumber(value, fallback = null) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

async function saveDirectInsight(supabase, matchId, result) {
    if (!supabase) return { saved: false, reason: 'supabase_unavailable' };

    const safeMatchId = String(matchId || '').trim();
    if (!safeMatchId) return { saved: false, reason: 'match_id_missing' };

    const payload = result && typeof result === 'object' ? result : {};
    const mainRow = {
        match_id: safeMatchId,
        outcome: String(payload.outcome || '').trim().toLowerCase() || null,
        confidence: asNumber(payload.confidence, null),
        tier: String(payload.tier || '').trim().toUpperCase() || null,
        volatility: asNumber(payload.volatilityScore, null),
        secondary_required: Boolean(payload.secondaryRequired),
        acca_eligible: Boolean(payload.accaEligible)
    };

    const { error: mainError } = await supabase
        .from('direct_1x2_insights')
        .insert(mainRow);
    if (mainError) {
        throw new Error(`saveDirectInsight main insert failed: ${mainError.message}`);
    }

    const stages = Array.isArray(payload.stages) ? payload.stages : [];
    for (const stage of stages) {
        const safeStage = stage && typeof stage === 'object' ? stage : {};
        const probs = safeStage.updatedProbabilities && typeof safeStage.updatedProbabilities === 'object'
            ? safeStage.updatedProbabilities
            : (safeStage.probabilities && typeof safeStage.probabilities === 'object'
                ? safeStage.probabilities
                : {});
        const label = String(safeStage.label || safeStage.reason || '').trim();
        const stageNumber = asNumber(safeStage.stage, null);
        if (!Number.isFinite(stageNumber)) continue;
        const { error: stageError } = await supabase
            .from('direct_1x2_stages')
            .insert({
                match_id: safeMatchId,
                stage_number: stageNumber,
                stage_label: label || null,
                home_prob: asNumber(probs.home, null),
                draw_prob: asNumber(probs.draw, null),
                away_prob: asNumber(probs.away, null)
            });

        if (stageError) {
            throw new Error(`saveDirectInsight stage insert failed: ${stageError.message}`);
        }
    }

    return { saved: true, stageCount: stages.length };
}

module.exports = {
    saveDirectInsight
};
