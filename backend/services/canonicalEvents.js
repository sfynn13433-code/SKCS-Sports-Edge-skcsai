'use strict';

const { query } = require('../db');

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
    return raw?.fixture?.status?.long || raw?.status?.long || raw?.game?.status?.long || item?.status || 'Not Started';
}

async function upsertCanonicalEvents(items = []) {
    const rows = Array.isArray(items) ? items : [];

    for (const item of rows) {
        const providerEventId = extractProviderEventId(item);
        const startTime = extractStartTime(item);
        if (!providerEventId || !startTime) continue;

        const sport = normalizeSport(item?.sport);
        const competitionName = extractCompetitionName(item);
        const season = extractSeason(item);
        const status = extractStatus(item);
        const rawProviderData = item?.raw_provider_data || null;
        const providerName = item?.provider_name || item?.provider || null;

        const existing = await query(
            `
            SELECT id
            FROM canonical_events
            WHERE sport = $1
              AND COALESCE(
                    raw_provider_data->'fixture'->>'id',
                    raw_provider_data->>'id',
                    raw_provider_data->'game'->>'id',
                    raw_provider_data->'fight'->>'id',
                    raw_provider_data->'race'->>'id'
                  ) = $2
            ORDER BY updated_at DESC
            LIMIT 1
            `,
            [sport, providerEventId]
        );

        if (existing.rows.length > 0) {
            await query(
                `
                UPDATE canonical_events
                SET competition_name = $2,
                    season = $3,
                    start_time_utc = $4,
                    status = $5,
                    raw_provider_data = $6::jsonb,
                    provider_name = $7,
                    updated_at = NOW()
                WHERE id = $1
                `,
                [
                    existing.rows[0].id,
                    competitionName,
                    season,
                    startTime,
                    status,
                    JSON.stringify(rawProviderData),
                    providerName
                ]
            );
            continue;
        }

        await query(
            `
            INSERT INTO canonical_events (
                sport,
                competition_name,
                season,
                start_time_utc,
                status,
                raw_provider_data,
                provider_name
            )
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
            `,
            [
                sport,
                competitionName,
                season,
                startTime,
                status,
                JSON.stringify(rawProviderData),
                providerName
            ]
        );
    }
}

module.exports = {
    upsertCanonicalEvents
};
