'use strict';

const { mergeTier1SchemaIntoContext } = require('./tier1SchemaProfile');

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
    const normalizedSport = String(payload.sport || payload.match_sport || payload?.metadata?.sport || '').trim();
    const safePayload = {
        match_id: safeMatchId,
        injuries: payload.injuries ?? {},
        h2h: mergeTier1SchemaIntoContext(payload.h2h ?? {}, normalizedSport),
        weather: payload.weather ?? {}
    };

    const existingRes = await supabase
        .from('match_context_data')
        .select('match_id')
        .eq('match_id', safeMatchId)
        .limit(1);

    if (existingRes.error) {
        throw new Error(`saveContextData precheck failed: ${existingRes.error.message}`);
    }

    if (Array.isArray(existingRes.data) && existingRes.data.length > 0) {
        return { saved: false, reason: 'already_exists' };
    }

    const primaryInsert = await supabase.from('match_context_data').insert(safePayload);
    if (!primaryInsert.error) {
        return { saved: true };
    }

    if (isDuplicateKeyError(primaryInsert.error)) {
        return { saved: false, reason: 'already_exists' };
    }

    const fallbackInsert = await supabase.from('match_context_data').insert({
        match_id: safeMatchId,
        injuries: {},
        h2h: {},
        weather: {}
    });

    if (!fallbackInsert.error || isDuplicateKeyError(fallbackInsert.error)) {
        return { saved: !fallbackInsert.error };
    }

    throw new Error(`saveContextData insert failed: ${fallbackInsert.error.message}`);
}

module.exports = {
    saveContextData
};
