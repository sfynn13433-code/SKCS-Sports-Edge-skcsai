'use strict';

function safeString(value, fallback = null) {
    if (value === undefined || value === null) return fallback;
    const text = String(value).trim();
    return text.length ? text : fallback;
}

function pickFirst(match, keys, fallback = null) {
    for (const key of keys) {
        const value = match?.[key];
        if (value === undefined || value === null) continue;
        if (String(value).trim() === '') continue;
        return value;
    }
    return fallback;
}

function pickFirstPath(source, paths, fallback = null) {
    for (const path of paths) {
        const parts = String(path || '').split('.').filter(Boolean);
        let cursor = source;
        let missing = false;
        for (const part of parts) {
            if (!cursor || typeof cursor !== 'object' || !(part in cursor)) {
                missing = true;
                break;
            }
            cursor = cursor[part];
        }
        if (missing) continue;
        if (cursor === undefined || cursor === null) continue;
        if (String(cursor).trim() === '') continue;
        return cursor;
    }
    return fallback;
}

function normalizeTimestamp(match) {
    const rawTime = pickFirst(match, [
        'timestamp',
        'time',
        'start_time',
        'kickoff',
        'date',
        'datetime'
    ]);
    if (!rawTime) return null;

    if (typeof rawTime === 'number') {
        const milliseconds = rawTime > 9999999999 ? rawTime : rawTime * 1000;
        const date = new Date(milliseconds);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    if (/^\d+$/.test(String(rawTime))) {
        const numeric = Number(rawTime);
        const milliseconds = numeric > 9999999999 ? numeric : numeric * 1000;
        const date = new Date(milliseconds);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    const date = new Date(rawTime);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeSportSRCMatch(match, sport) {
    const provider = 'sportsrc';
    const providerFixtureId = safeString(
        pickFirst(match, ['id', 'match_id', 'fixture_id', 'event_id'])
    );
    if (!providerFixtureId) {
        return null;
    }

    const homeTeam = safeString(
        pickFirstPath(match, [
            'teams.home.name',
            'home.name'
        ]) || pickFirst(match, [
            'home_team_name',
            'home_team',
            'home',
            'team_home',
            'homeName'
        ])
    );
    const awayTeam = safeString(
        pickFirstPath(match, [
            'teams.away.name',
            'away.name'
        ]) || pickFirst(match, [
            'away_team_name',
            'away_team',
            'away',
            'team_away',
            'awayName'
        ])
    );
    if (!homeTeam || !awayTeam) {
        return null;
    }

    const kickoffTime = normalizeTimestamp(match);
    const fixtureKey = `${provider}:${sport}:${providerFixtureId}`;

    return {
        provider,
        provider_fixture_id: providerFixtureId,
        match_id: providerFixtureId,
        fixture_key: fixtureKey,
        sport,
        league: safeString(
            pickFirstPath(match, ['league.name']) || pickFirst(match, ['league_name', 'league', 'competition', 'competition_name']),
            'General'
        ),
        competition_id: safeString(pickFirst(match, ['competition_id', 'league_id'])),
        season: safeString(pickFirst(match, ['season'])),
        round: safeString(pickFirst(match, ['round'])),
        home_team: homeTeam,
        away_team: awayTeam,
        home_team_id: safeString(
            pickFirstPath(match, ['teams.home.id', 'home.id']) || pickFirst(match, ['home_id', 'home_team_id'])
        ),
        away_team_id: safeString(
            pickFirstPath(match, ['teams.away.id', 'away.id']) || pickFirst(match, ['away_id', 'away_team_id'])
        ),
        kickoff_time: kickoffTime,
        status: safeString(pickFirst(match, ['status', 'match_status']), 'upcoming'),
        venue: safeString(pickFirst(match, ['venue', 'stadium']), 'TBD'),
        country: safeString(pickFirst(match, ['country', 'country_name']), 'Unknown'),
        source_quality: 'fixture_only',
        raw_payload: match,
        updated_at: new Date().toISOString()
    };
}

module.exports = {
    normalizeSportSRCMatch
};
