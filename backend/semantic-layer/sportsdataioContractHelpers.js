'use strict';

const { normalizeStatus } = require('./registry');

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toTrimmedString(value) {
    return String(value === undefined || value === null ? '' : value).trim();
}

function toNumberOrNull(value) {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function normalizeDateOnly(value) {
    const text = toTrimmedString(value);
    if (!text) return null;
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const iso = `${match[1]}-${match[2]}-${match[3]}`;
    const parsed = new Date(`${iso}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? null : iso;
}

function normalizeDateTimeUtc(value) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
}

function readField(source, paths) {
    if (!isObject(source)) return undefined;
    for (const path of Array.isArray(paths) ? paths : [paths]) {
        const parts = String(path || '').split('.');
        let current = source;
        let found = true;
        for (const part of parts) {
            if (!current || typeof current !== 'object' || !(part in current)) {
                found = false;
                break;
            }
            current = current[part];
        }
        if (found && current !== undefined && current !== null && current !== '') return current;
    }
    return undefined;
}

function resolveSportsDataIOIdentity(game = {}) {
    const globalGameId = toNumberOrNull(readField(game, [
        'GlobalGameId',
        'globalGameId',
        'global_game_id'
    ]));

    const gameId = toNumberOrNull(readField(game, [
        'GameID',
        'GameId',
        'gameId',
        'game_id',
        'id'
    ]));

    const canonicalId = globalGameId !== null ? String(globalGameId) : (gameId !== null ? String(gameId) : null);

    return {
        canonical_id: canonicalId,
        canonical_id_source: globalGameId !== null ? 'GlobalGameId' : (gameId !== null ? 'GameID' : null),
        global_game_id: globalGameId,
        game_id: gameId,
        is_canonical: Boolean(canonicalId)
    };
}

function resolveSportsDataIOStatus(game = {}) {
    const rawStatus = toTrimmedString(readField(game, [
        'Status',
        'status',
        'GameStatus',
        'gameStatus',
        'StatusDescription'
    ]));

    const normalized = normalizeStatus(rawStatus);
    const isClosed = Boolean(readField(game, [
        'IsClosed',
        'isClosed',
        'Closed',
        'closed'
    ]));

    return {
        status_raw: rawStatus || null,
        status_normalized: normalized,
        is_closed: isClosed,
        status_quality: isClosed ? 'verified_final' : (normalized === 'Unknown' ? 'unmapped' : 'provisional')
    };
}

function getSportsDataIOMaturity(game = {}, options = {}) {
    const now = options.now ? new Date(options.now) : new Date();
    const updatedAt = normalizeDateTimeUtc(readField(game, ['UpdatedUtc', 'UpdatedUTC', 'Updated', 'updated', 'updated_at']));
    const isClosed = Boolean(readField(game, ['IsClosed', 'isClosed', 'Closed', 'closed']));

    let dataMaturityScore = 0;
    if (isClosed) dataMaturityScore += 60;
    if (updatedAt) {
        const diffMs = Math.max(0, now.getTime() - new Date(updatedAt).getTime());
        if (diffMs >= 60 * 60 * 1000) dataMaturityScore += 20;
        else if (diffMs >= 10 * 60 * 1000) dataMaturityScore += 12;
        else if (diffMs >= 60 * 1000) dataMaturityScore += 6;
    }
    if (readField(game, ['GlobalGameId', 'globalGameId', 'global_game_id'])) dataMaturityScore += 10;
    if (readField(game, ['GameID', 'GameId', 'gameId', 'game_id', 'id'])) dataMaturityScore += 10;
    dataMaturityScore = Math.max(0, Math.min(100, dataMaturityScore));

    return {
        is_closed: isClosed,
        updated_at_utc: updatedAt,
        data_maturity_score: dataMaturityScore,
        freshness_class: isClosed ? 'final_verified' : (updatedAt ? 'live_or_recent' : 'unknown'),
        mutation_risk: isClosed ? 'low' : 'high'
    };
}

function filterActiveMemberships(memberships = [], asOfDate = new Date()) {
    const reference = new Date(asOfDate);
    if (Number.isNaN(reference.getTime())) return [];

    return (Array.isArray(memberships) ? memberships : []).filter((membership) => {
        if (!isObject(membership)) return false;
        if (membership.Active !== undefined && membership.Active !== null && membership.Active !== true) return false;

        const start = membership.StartDate || membership.startDate || membership.start_date || null;
        const end = membership.EndDate || membership.endDate || membership.end_date || null;
        const startDate = start ? new Date(start) : null;
        const endDate = end ? new Date(end) : null;
        if (startDate && !Number.isNaN(startDate.getTime()) && reference < startDate) return false;
        if (endDate && !Number.isNaN(endDate.getTime()) && reference > endDate) return false;
        return true;
    });
}

function resolveContextualJersey(player = {}, memberships = [], asOfDate = new Date()) {
    const activeMemberships = filterActiveMemberships(memberships, asOfDate);
    const directJersey = readField(player, ['Jersey', 'jersey', 'shirt_number', 'shirtNumber']);
    if (directJersey !== undefined && directJersey !== null && directJersey !== '') {
        return String(directJersey).trim();
    }

    for (const membership of activeMemberships) {
        const jersey = readField(membership, ['Jersey', 'jersey']);
        if (jersey !== undefined && jersey !== null && jersey !== '') {
            return String(jersey).trim();
        }
    }

    return null;
}

function extractRawExtensions(source = {}, allowedKeys = []) {
    if (!isObject(source)) return {};
    const allowed = new Set((Array.isArray(allowedKeys) ? allowedKeys : []).map((key) => String(key)));
    const out = {};
    for (const [key, value] of Object.entries(source)) {
        if (allowed.has(key)) continue;
        out[key] = value;
    }
    return out;
}

function buildSportsDataIOContractView(game = {}, options = {}) {
    const identity = resolveSportsDataIOIdentity(game);
    const status = resolveSportsDataIOStatus(game);
    const maturity = getSportsDataIOMaturity(game, options);
    const date = normalizeDateOnly(readField(game, ['Date', 'date', 'GameDate', 'gameDate']));
    const dateTime = normalizeDateTimeUtc(readField(game, ['DateTime', 'dateTime', 'StartDate', 'startDate', 'start_time']));
    const homeTeamId = toNumberOrNull(readField(game, ['HomeTeamId', 'homeTeamId', 'home_team_id', 'GlobalHomeTeamId']));
    const awayTeamId = toNumberOrNull(readField(game, ['AwayTeamId', 'awayTeamId', 'away_team_id', 'GlobalAwayTeamId']));
    const competitionId = readField(game, ['CompetitionId', 'competitionId', 'competition_id', 'LeagueId', 'leagueId', 'League']);
    const competition = toTrimmedString(competitionId) || null;

    return {
        canonical_id: identity.canonical_id,
        canonical_id_source: identity.canonical_id_source,
        global_game_id: identity.global_game_id,
        game_id: identity.game_id,
        competition,
        date,
        date_time_utc: dateTime,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        ...status,
        ...maturity,
        raw_extensions: extractRawExtensions(game, [
            'GlobalGameId',
            'globalGameId',
            'global_game_id',
            'GameID',
            'GameId',
            'gameId',
            'game_id',
            'id',
            'Status',
            'status',
            'GameStatus',
            'gameStatus',
            'StatusDescription',
            'IsClosed',
            'isClosed',
            'Closed',
            'closed',
            'Updated',
            'UpdatedUtc',
            'UpdatedUTC',
            'updated',
            'updated_at',
            'Date',
            'date',
            'DateTime',
            'dateTime',
            'StartDate',
            'startDate',
            'start_time'
        ])
    };
}

module.exports = {
    buildSportsDataIOContractView,
    extractRawExtensions,
    filterActiveMemberships,
    getSportsDataIOMaturity,
    normalizeDateOnly,
    normalizeDateTimeUtc,
    resolveContextualJersey,
    resolveSportsDataIOIdentity,
    resolveSportsDataIOStatus
};
