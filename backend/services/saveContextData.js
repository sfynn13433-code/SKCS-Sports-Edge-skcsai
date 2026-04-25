'use strict';

async function saveContextData(supabase, matchId, data) {
    if (!supabase) return { saved: false, reason: 'supabase_unavailable' };

    const safeMatchId = String(matchId || '').trim();
    if (!safeMatchId) return { saved: false, reason: 'match_id_missing' };

    const payload = data && typeof data === 'object' ? data : {};
    const { error } = await supabase.from('match_context_data').insert({
        match_id: safeMatchId,
        injuries: payload.injuries ?? null,
        h2h: payload.h2h ?? null,
        weather: payload.weather ?? null
    });

    if (error) {
        throw new Error(`saveContextData insert failed: ${error.message}`);
    }

    return { saved: true };
}

module.exports = {
    saveContextData
};

