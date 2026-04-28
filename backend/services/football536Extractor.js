'use strict';

function objectKeys(obj) {
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? Object.keys(obj) : [];
}

function safeJsonPreview(obj, maxChars = 1500) {
    let text;
    try {
        text = JSON.stringify(obj, null, 2);
    } catch (error) {
        text = String(obj);
    }
    if (!text) return '';
    return text.length <= maxChars ? text : `${text.slice(0, maxChars)}...<truncated>`;
}

function sampleKeys(value) {
    if (Array.isArray(value)) {
        const firstObject = value.find((item) => item && typeof item === 'object' && !Array.isArray(item));
        return objectKeys(firstObject);
    }
    return objectKeys(value);
}

function containsAny(keys, candidates) {
    const set = new Set((keys || []).map((key) => String(key || '').toLowerCase()));
    return (candidates || []).some((candidate) => set.has(String(candidate || '').toLowerCase()));
}

function pickFirstDefined(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return null;
}

function toStringOrNull(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text : null;
}

function toNumberOrNull(value) {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function toBooleanOrNull(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
        if (value === 1) return true;
        if (value === 0) return false;
    }
    const text = String(value).trim().toLowerCase();
    if (!text) return null;
    if (['true', '1', 'yes', 'y'].includes(text)) return true;
    if (['false', '0', 'no', 'n'].includes(text)) return false;
    return null;
}

function normalizeFootball536Fixture(row) {
    const source = row && typeof row === 'object' ? row : {};
    const league = source.league || source.competition || source.tournament || source.stage || {};
    const season = source.season || {};
    const round = source.round || {};
    const home = source.home_team || source.homeTeam || source.home || source.teams?.home || {};
    const away = source.away_team || source.awayTeam || source.away || source.teams?.away || {};
    const goals = source.goals || {};
    const score = source.score || source.scores || {};
    const halftime = score.halftime || score.half_time || source.halftime || {};
    const fulltime = score.fulltime || score.full_time || source.fulltime || {};
    const venue = source.venue || source.stadium || {};

    const fixtureId = toStringOrNull(
        pickFirstDefined(
            source.id,
            source.fixture_id,
            source.fixtureId,
            source.event_id,
            source.eventId,
            source.match_id,
            source.matchId
        )
    );
    const leagueId = toStringOrNull(
        pickFirstDefined(
            league.id,
            source.league_id,
            source.leagueId,
            source.competition_id,
            source.competitionId
        )
    );
    const seasonId = toStringOrNull(
        pickFirstDefined(
            season.id,
            source.season_id,
            source.seasonId,
            league.season_id,
            league.seasonId
        )
    );
    const roundId = toStringOrNull(
        pickFirstDefined(
            round.id,
            source.round_id,
            source.roundId,
            league.round_id,
            league.roundId
        )
    );
    const homeTeamId = toStringOrNull(
        pickFirstDefined(
            home.id,
            home.team_id,
            home.teamId,
            source.home_team_id,
            source.homeTeamId
        )
    );
    const awayTeamId = toStringOrNull(
        pickFirstDefined(
            away.id,
            away.team_id,
            away.teamId,
            source.away_team_id,
            source.awayTeamId
        )
    );

    const homeScore = toNumberOrNull(
        pickFirstDefined(
            score.home,
            score.home_score,
            source.home_score,
            source.home_goals,
            source.homeGoals,
            goals.home
        )
    );
    const awayScore = toNumberOrNull(
        pickFirstDefined(
            score.away,
            score.away_score,
            source.away_score,
            source.away_goals,
            source.awayGoals,
            goals.away
        )
    );
    const goalsHome = toNumberOrNull(
        pickFirstDefined(
            goals.home,
            source.home_goals,
            source.homeGoals,
            score.home
        )
    );
    const goalsAway = toNumberOrNull(
        pickFirstDefined(
            goals.away,
            source.away_goals,
            source.awayGoals,
            score.away
        )
    );

    return {
        provider: 'football536',
        provider_fixture_id: fixtureId,
        provider_ids: {
            fixture_id: fixtureId,
            league_id: leagueId,
            season_id: seasonId,
            round_id: roundId,
            home_team_id: homeTeamId,
            away_team_id: awayTeamId
        },
        kickoff_time: toStringOrNull(
            pickFirstDefined(
                source.start_time,
                source.startTime,
                source.kickoff,
                source.kickoff_time,
                source.date,
                source.utc_date,
                source.utcDate,
                source.timestamp
            )
        ),
        status: toStringOrNull(
            pickFirstDefined(
                source.status,
                source.status_name,
                source.statusName,
                source.fixture_status,
                source.state
            )
        ),
        status_short: toStringOrNull(
            pickFirstDefined(
                source.status_short,
                source.statusShort,
                source.short_status,
                source.shortStatus
            )
        ),
        league: {
            id: leagueId,
            name: toStringOrNull(
                pickFirstDefined(
                    league.name,
                    league.league_name,
                    league.leagueName,
                    source.league_name,
                    source.leagueName,
                    source.competition_name,
                    source.competitionName
                )
            ),
            country: toStringOrNull(
                pickFirstDefined(
                    league.country,
                    league.country_name,
                    source.country,
                    source.country_name
                )
            ),
            season_id: seasonId,
            round_id: roundId,
            round_name: toStringOrNull(
                pickFirstDefined(
                    round.name,
                    source.round_name,
                    source.roundName,
                    typeof source.round === 'string' ? source.round : null
                )
            )
        },
        home_team: {
            id: homeTeamId,
            name: toStringOrNull(
                pickFirstDefined(
                    home.name,
                    home.team_name,
                    home.teamName,
                    source.home_team_name,
                    source.homeTeamName,
                    typeof source.home === 'string' ? source.home : null
                )
            ),
            logo: toStringOrNull(
                pickFirstDefined(
                    home.logo,
                    home.image,
                    home.img,
                    source.home_team_logo,
                    source.homeTeamLogo
                )
            )
        },
        away_team: {
            id: awayTeamId,
            name: toStringOrNull(
                pickFirstDefined(
                    away.name,
                    away.team_name,
                    away.teamName,
                    source.away_team_name,
                    source.awayTeamName,
                    typeof source.away === 'string' ? source.away : null
                )
            ),
            logo: toStringOrNull(
                pickFirstDefined(
                    away.logo,
                    away.image,
                    away.img,
                    source.away_team_logo,
                    source.awayTeamLogo
                )
            )
        },
        score: {
            home: homeScore,
            away: awayScore,
            halftime_home: toNumberOrNull(
                pickFirstDefined(
                    halftime.home,
                    halftime.home_score,
                    source.halftime_home,
                    source.halftimeHome
                )
            ),
            halftime_away: toNumberOrNull(
                pickFirstDefined(
                    halftime.away,
                    halftime.away_score,
                    source.halftime_away,
                    source.halftimeAway
                )
            ),
            fulltime_home: toNumberOrNull(
                pickFirstDefined(
                    fulltime.home,
                    fulltime.home_score,
                    source.fulltime_home,
                    source.fulltimeHome
                )
            ),
            fulltime_away: toNumberOrNull(
                pickFirstDefined(
                    fulltime.away,
                    fulltime.away_score,
                    source.fulltime_away,
                    source.fulltimeAway
                )
            )
        },
        goals: {
            home: goalsHome,
            away: goalsAway
        },
        venue: {
            id: toStringOrNull(
                pickFirstDefined(
                    venue.id,
                    source.venue_id,
                    source.stadium_id
                )
            ),
            name: toStringOrNull(
                pickFirstDefined(
                    venue.name,
                    venue.stadium_name,
                    source.venue_name,
                    source.stadium_name
                )
            ),
            city: toStringOrNull(
                pickFirstDefined(
                    venue.city,
                    source.venue_city,
                    source.city
                )
            )
        },
        raw_keys: objectKeys(source),
        nested_keys: {
            league: objectKeys(league),
            season: objectKeys(season),
            round: objectKeys(round),
            home: objectKeys(home),
            away: objectKeys(away),
            goals: objectKeys(goals),
            score: objectKeys(score),
            venue: objectKeys(venue)
        }
    };
}

function extractFootball536Fixtures(raw) {
    let fixtures = [];

    if (Array.isArray(raw)) fixtures = raw;
    else if (raw && typeof raw === 'object') {
        if (Array.isArray(raw.data)) fixtures = raw.data;
        else if (Array.isArray(raw.result)) fixtures = raw.result;
        else if (Array.isArray(raw.response)) fixtures = raw.response;
        else if (Array.isArray(raw.fixtures)) fixtures = raw.fixtures;
    }

    if (!Array.isArray(fixtures)) return [];
    return fixtures.map((row) => normalizeFootball536Fixture(row));
}

function findArraysDeep(obj, maxDepth = 3) {
    const out = [];
    const source = obj;

    function walk(value, path, depth) {
        if (depth > maxDepth) return;
        if (Array.isArray(value)) {
            out.push({
                path,
                count: value.length,
                sample_keys: sampleKeys(value)
            });
            return;
        }
        if (!value || typeof value !== 'object') return;
        for (const [key, child] of Object.entries(value)) {
            const nextPath = path ? `${path}.${key}` : key;
            walk(child, nextPath, depth + 1);
        }
    }

    walk(source, 'root', 0);
    return out;
}

function extractFootball536Shape(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const response = source.response && typeof source.response === 'object' ? source.response : {};
    const data = source.data && typeof source.data === 'object' ? source.data : {};
    const result = source.result && typeof source.result === 'object' ? source.result : {};

    const arrayPaths = findArraysDeep(raw, 3);
    const countGuess = arrayPaths.reduce((max, item) => Math.max(max, Number(item?.count) || 0), 0);

    return {
        raw_top_level_keys: Array.isArray(raw) ? [] : objectKeys(source),
        response_keys: objectKeys(response),
        data_keys: objectKeys(data),
        result_keys: objectKeys(result),
        array_paths: arrayPaths,
        count_guess: countGuess,
        safe_preview: safeJsonPreview(raw, 1500)
    };
}

function firstNonEmptyArray(arrays) {
    for (const item of arrays) {
        if (Array.isArray(item) && item.length > 0) return item;
    }
    return [];
}

function getArrayCandidates(raw) {
    if (Array.isArray(raw)) return raw;
    const source = raw && typeof raw === 'object' ? raw : {};
    const response = source.response && typeof source.response === 'object' ? source.response : null;
    const data = source.data && typeof source.data === 'object' ? source.data : null;
    const result = source.result && typeof source.result === 'object' ? source.result : null;

    const arrays = [
        source.items,
        source.results,
        source.leagues,
        source.fixtures,
        source.matches,
        source.teams,
        source.squads,
        source.seasons,
        source.rounds,
        response?.items,
        response?.results,
        response?.leagues,
        response?.fixtures,
        response?.matches,
        response?.teams,
        response?.squads,
        response?.seasons,
        response?.rounds,
        data?.items,
        data?.results,
        data?.leagues,
        data?.fixtures,
        data?.matches,
        data?.teams,
        data?.squads,
        data?.seasons,
        data?.rounds,
        result?.items,
        result?.results,
        result?.leagues,
        result?.fixtures,
        result?.matches,
        result?.teams,
        result?.squads,
        result?.seasons,
        result?.rounds
    ];

    const first = firstNonEmptyArray(arrays);
    if (first.length > 0) return first;

    const deepArrays = findArraysDeep(raw, 3);
    const deepFirst = deepArrays.find((item) => Number(item?.count) > 0);
    if (deepFirst) {
        const path = String(deepFirst.path || '').replace(/^root\.?/, '');
        if (!path) return [];
        return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), raw) || [];
    }
    return [];
}

function collectRepresentativeKeys(raw) {
    const arrays = getArrayCandidates(raw);
    const arrayKeys = sampleKeys(arrays);
    const sourceKeys = objectKeys(raw);
    const merged = new Set([...arrayKeys, ...sourceKeys]);

    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const nestedObjects = [raw.response, raw.data, raw.result].filter((v) => v && typeof v === 'object');
        for (const nested of nestedObjects) {
            for (const key of objectKeys(nested)) {
                merged.add(key);
            }
        }
    }
    return Array.from(merged);
}

function classifyFootball536Payload(raw, label) {
    const normalizedLabel = String(label || '').trim().toLowerCase();
    const shape = extractFootball536Shape(raw);
    const keys = collectRepresentativeKeys(raw);
    const hasArrays = shape.array_paths.some((item) => Number(item?.count) > 0);
    const hasObjects = keys.length > 0;

    if (!hasArrays && !hasObjects) return 'empty_success';

    const leagueLike = containsAny(keys, ['id', 'name', 'league', 'country', 'slug', 'seasons', 'sport']);
    const fixtureLike = containsAny(keys, [
        'id',
        'fixture_id',
        'match_id',
        'event_id',
        'home',
        'away',
        'home_team',
        'away_team',
        'date',
        'start_time',
        'kickoff',
        'status',
        'score',
        'league',
        'season',
        'round'
    ]);
    const teamLike = containsAny(keys, ['id', 'team_id', 'name', 'short_name', 'logo', 'country']);
    const squadLike = containsAny(keys, ['player_id', 'id', 'name', 'position', 'number', 'age', 'nationality']);
    const seasonLike = containsAny(keys, ['season_id', 'id', 'name', 'year', 'start_date', 'end_date']);
    const roundLike = containsAny(keys, ['round_id', 'id', 'name', 'number', 'start_date', 'end_date']);
    const playerLike = containsAny(keys, ['player_id', 'id', 'name', 'position', 'nationality', 'date_of_birth']);

    if (normalizedLabel.includes('list leagues') && leagueLike) return 'confirmed_league_source';
    if (normalizedLabel.includes('upcoming fixtures') && fixtureLike) return 'confirmed_fixture_source';
    if (normalizedLabel.includes('fixtures by league') && fixtureLike) return 'confirmed_fixture_source';
    if (normalizedLabel.includes('teams by season') && teamLike) return 'confirmed_team_source';
    if (normalizedLabel.includes('squad by team') && squadLike) return 'confirmed_squad_source';
    if (normalizedLabel.includes('league by id') && leagueLike) return 'confirmed_league_detail_source';
    if (normalizedLabel.includes('seasons by league') && seasonLike) return 'confirmed_season_source';
    if (normalizedLabel.includes('rounds by season') && roundLike) return 'confirmed_round_source';
    if (normalizedLabel.includes('player by id') && playerLike) return 'confirmed_player_source';

    return hasArrays || hasObjects ? 'valid_but_unknown_shape' : 'empty_success';
}

module.exports = {
    extractFootball536Shape,
    findArraysDeep,
    classifyFootball536Payload,
    extractFootball536Fixtures,
    normalizeFootball536Fixture,
    pickFirstDefined,
    toStringOrNull,
    toNumberOrNull,
    toBooleanOrNull
};
