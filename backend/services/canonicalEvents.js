'use strict';

const { createClient } = require('@supabase/supabase-js');

// Supabase client for Universal Intake Valve
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

function normalizeSport(value) {
    const key = String(value || '').trim().toLowerCase();
    if (!key) return 'unknown';

    if (key === 'soccer' || key === 'football' || key.startsWith('soccer_')) return 'Football';
    if (key === 'nba' || key === 'basketball' || key.startsWith('basketball_')) return 'Basketball';
    if (key === 'nfl' || key === 'american_football' || key.startsWith('americanfootball_')) return 'NFL';
    if (key === 'nhl' || key === 'hockey' || key.startsWith('icehockey_')) return 'NHL';
    if (key === 'mlb' || key === 'baseball' || key.startsWith('baseball_')) return 'MLB';
    if (key === 'rugby' || key.startsWith('rugbyunion_')) return 'Rugby';
    if (key === 'afl' || key.startsWith('aussierules_')) return 'AFL';
    if (key === 'volleyball') return 'Volleyball';
    if (key === 'handball') return 'Handball';
    if (key === 'f1' || key === 'formula1') return 'F1';
    if (key === 'mma') return 'MMA';
    if (key === 'golf') return 'Golf';
    if (key === 'boxing') return 'Boxing';
    if (key === 'tennis') return 'Tennis';
    if (key === 'cricket') return 'Cricket';
    if (key === 'esports') return 'Esports';
    if (key === 'darts') return 'Darts';

    return value;
}

function extractProviderEventId(item) {
    const raw = item?.raw_provider_data || {};
    const direct = item?.match_id || raw?.fixture?.id || raw?.id || raw?.game?.id || raw?.fight?.id || raw?.race?.id || null;
    return direct === null || typeof direct === 'undefined' ? null : String(direct);
}

function extractCompetitionName(item) {
    const raw = item?.raw_provider_data || {};
    return item?.league || raw?.league?.name || raw?.competition?.name || raw?.tournament?.name || 'Unknown Competition';
}

function extractSeason(item) {
    const raw = item?.raw_provider_data || {};
    const explicit = raw?.league?.season || raw?.season || item?.season || null;
    if (explicit !== null && typeof explicit !== 'undefined' && String(explicit).trim()) {
        return String(explicit);
    }

    const kickoff = item?.date || raw?.fixture?.date || raw?.date || raw?.game?.date || raw?.fight?.date || raw?.race?.date || null;
    if (kickoff) {
        const parsed = new Date(kickoff);
        if (!Number.isNaN(parsed.getTime())) {
            return String(parsed.getUTCFullYear());
        }
    }

    return 'unknown';
}

function extractStartTime(item) {
    const raw = item?.raw_provider_data || {};
    return item?.date || raw?.fixture?.date || raw?.date || raw?.game?.date || raw?.fight?.date || raw?.race?.date || null;
}

function extractStatus(item) {
    const raw = item?.raw_provider_data || {};
    return raw?.fixture?.status?.short || raw?.fixture?.status?.long || raw?.status?.long || raw?.game?.status?.long || item?.status || 'Not Started';
}

function extractProviderName(item) {
    return item?.provider_name || item?.provider || 'unknown';
}

async function upsertCanonicalEvents(items = []) {
    if (!supabase) {
        console.error('[canonicalEvents] Supabase client not initialized — cannot ingest events');
        return;
    }

    const rows = Array.isArray(items) ? items : [];

    for (const item of rows) {
        const providerEventId = extractProviderEventId(item);
        const startTime = extractStartTime(item);
        if (!providerEventId || !startTime) continue;

        // Map the chaotic API data to our clean variables
        const cleanData = {
            p_provider_name: extractProviderName(item),
            p_provider_event_id: providerEventId,
            p_sport: normalizeSport(item?.sport),
            p_competition_name: extractCompetitionName(item),
            p_season: extractSeason(item),
            p_start_time_utc: new Date(startTime).toISOString(),
            p_status: extractStatus(item),
            p_raw_payload: item?.raw_provider_data || item
        };

        // Push it through the Universal Intake Valve
        const { error } = await supabase.rpc('upsert_canonical_event', cleanData);

        if (error) {
            console.error(`❌ Failed to ingest match ${cleanData.p_provider_event_id}:`, error.message);
        } else {
            console.log(`✅ Match ${cleanData.p_provider_event_id} safely landed in canonical_events.`);
        }
    }
}

module.exports = {
    upsertCanonicalEvents
};
