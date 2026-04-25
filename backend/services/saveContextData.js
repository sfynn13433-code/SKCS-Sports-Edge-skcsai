'use strict';

let contextInsertProbeCompleted = false;

function isDuplicateKeyError(error) {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('duplicate key') || message.includes('unique constraint');
}

async function runContextInsertProbe(supabase) {
    if (contextInsertProbeCompleted) return;
    if (String(process.env.SKCS_CONTEXT_INSERT_TEST || '').trim() !== '1') return;

    const { error } = await supabase.from('match_context_data').insert({
        match_id: 'test_match',
        injuries: { test: true },
        h2h: null,
        weather: null
    });

    if (error && !isDuplicateKeyError(error)) {
        throw new Error(`saveContextData probe insert failed: ${error.message}`);
    }

    contextInsertProbeCompleted = true;
}

async function saveContextData(supabase, matchId, data) {
    if (!supabase) return { saved: false, reason: 'supabase_unavailable' };

    const safeMatchId = String(matchId || '').trim();
    if (!safeMatchId) return { saved: false, reason: 'match_id_missing' };

    await runContextInsertProbe(supabase);
    console.log('Saving context for match:', safeMatchId);

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
