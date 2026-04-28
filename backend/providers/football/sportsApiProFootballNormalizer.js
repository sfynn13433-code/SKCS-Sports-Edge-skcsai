'use strict';

const PROVIDER = 'sportsapi_pro_football';
const SPORT = 'football';
const MAX_DEPTH = 6;

function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function toNumberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function pickFirst(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return null;
}

function collectMatchesDeep(raw, predicate, maxDepth = MAX_DEPTH) {
    const out = [];
    function walk(value, path, depth) {
        if (depth > maxDepth || value === null || value === undefined) return;

        if (Array.isArray(value)) {
            for (let i = 0; i < Math.min(value.length, 200); i += 1) {
                walk(value[i], `${path}[${i}]`, depth + 1);
            }
            return;
        }

        if (!isObject(value)) return;
        if (predicate(value, path)) out.push({ value, path });

        for (const [key, child] of Object.entries(value)) {
            walk(child, path ? `${path}.${key}` : key, depth + 1);
        }
    }
    walk(raw, 'root', 0);
    return out;
}

function extractGameId(raw) {
    const direct = pickFirst(raw?.gameId, raw?.game_id, raw?.id, raw?.matchId, raw?.match_id, raw?.eventId, raw?.event_id);
    if (direct !== undefined && direct !== null && direct !== '') return direct;

    const found = collectMatchesDeep(raw, (obj) => pickFirst(
        obj.gameId, obj.game_id, obj.id, obj.matchId, obj.match_id, obj.eventId, obj.event_id
    ) !== null);
    if (!found.length) return null;
    return pickFirst(
        found[0].value.gameId,
        found[0].value.game_id,
        found[0].value.id,
        found[0].value.matchId,
        found[0].value.match_id,
        found[0].value.eventId,
        found[0].value.event_id
    );
}

function extractFixtureId(raw) {
    const direct = pickFirst(raw?.fixtureId, raw?.fixture_id, raw?.eventId, raw?.event_id);
    if (direct !== undefined && direct !== null && direct !== '') return direct;

    const found = collectMatchesDeep(raw, (obj) => pickFirst(obj.fixtureId, obj.fixture_id) !== null);
    if (!found.length) return null;
    return pickFirst(found[0].value.fixtureId, found[0].value.fixture_id);
}

function extractCompetition(raw) {
    const directId = pickFirst(raw?.competitionId, raw?.competition_id, raw?.leagueId, raw?.league_id, raw?.tournamentId, raw?.stageId);
    const directName = pickFirst(raw?.competitionDisplayName, raw?.competitionName, raw?.leagueName, raw?.tournamentName, raw?.stageName);
    const directObj = pickFirst(raw?.competition, raw?.league, raw?.tournament, raw?.stage, raw?.category);

    if (directId !== null || directName !== null || isObject(directObj)) {
        const obj = isObject(directObj) ? directObj : null;
        return {
            id: pickFirst(directId, obj?.id, null),
            name: pickFirst(directName, obj?.name, obj?.displayName, obj?.shortName, null),
            country: pickFirst(obj?.country, obj?.countryName, null),
            raw: obj
        };
    }

    const found = collectMatchesDeep(raw, (obj) => {
        const keyNames = Object.keys(obj).map((k) => k.toLowerCase());
        return keyNames.includes('competitionid')
            || keyNames.includes('competitionname')
            || keyNames.includes('leaguename')
            || keyNames.includes('tournamentname')
            || keyNames.includes('stageid')
            || keyNames.includes('category');
    });

    if (!found.length) return { id: null, name: null, country: null, raw: null };

    const obj = found[0].value;
    return {
        id: pickFirst(obj.competitionId, obj.competition_id, obj.leagueId, obj.league_id, obj.tournamentId, obj.stageId, obj.id, null),
        name: pickFirst(obj.competitionDisplayName, obj.competitionName, obj.leagueName, obj.tournamentName, obj.stageName, obj.name, obj.displayName, null),
        country: pickFirst(obj.country, obj.countryName, null),
        raw: obj
    };
}

function teamFromItem(item, path, roleHint = null) {
    if (!isObject(item)) {
        return { id: null, name: null, raw: null, path, roleHint };
    }
    return {
        id: pickFirst(item.id, item.competitorId, item.teamId, item.participantId, null),
        name: pickFirst(item.name, item.displayName, item.shortName, item.fullName, item.title, item.competitorName, null),
        raw: item,
        path,
        roleHint
    };
}

function roleFromPath(path) {
    const lower = String(path || '').toLowerCase();
    if (lower.includes('home')) return 'home';
    if (lower.includes('away')) return 'away';
    return null;
}

function buildCompetitorMap(raw) {
    const map = new Map();
    const competitorArrays = [];

    const direct = [];
    if (Array.isArray(raw?.competitors)) direct.push({ arr: raw.competitors, path: 'root.competitors' });
    if (Array.isArray(raw?._provider_competitors)) direct.push({ arr: raw._provider_competitors, path: 'root._provider_competitors' });
    if (Array.isArray(raw?.teams)) direct.push({ arr: raw.teams, path: 'root.teams' });
    if (Array.isArray(raw?.participants)) direct.push({ arr: raw.participants, path: 'root.participants' });
    competitorArrays.push(...direct);

    const deep = collectMatchesDeep(raw, (obj) => Array.isArray(obj.competitors) || Array.isArray(obj.teams) || Array.isArray(obj.participants));
    for (const found of deep.slice(0, 10)) {
        const arr = found.value.competitors || found.value.teams || found.value.participants;
        if (Array.isArray(arr)) competitorArrays.push({ arr, path: `${found.path}.${found.value.competitors ? 'competitors' : found.value.teams ? 'teams' : 'participants'}` });
    }

    for (const entry of competitorArrays) {
        entry.arr.forEach((item, idx) => {
            const team = teamFromItem(item, `${entry.path}[${idx}]`, null);
            if (team.id === null) return;
            if (!map.has(team.id)) map.set(team.id, team);
        });
    }
    return map;
}

function extractTeams(raw) {
    const inferenceWarnings = [];
    const candidatePaths = [];
    const competitorMap = buildCompetitorMap(raw);

    const directHomeObj = pickFirst(raw?.home, raw?.homeTeam, raw?.home_team, raw?.homeCompetitor, null);
    const directAwayObj = pickFirst(raw?.away, raw?.awayTeam, raw?.away_team, raw?.awayCompetitor, null);
    const homeDirect = teamFromItem(directHomeObj, 'root.home*', 'home');
    const awayDirect = teamFromItem(directAwayObj, 'root.away*', 'away');

    const homeIdDirect = pickFirst(raw?.homeCompetitorId, raw?.home_competitor_id, raw?.homeTeamId, raw?.home_team_id, null);
    const awayIdDirect = pickFirst(raw?.awayCompetitorId, raw?.away_competitor_id, raw?.awayTeamId, raw?.away_team_id, null);
    const homeNameDirect = pickFirst(raw?.homeName, raw?.homeTeamName, raw?.home_team_name, null);
    const awayNameDirect = pickFirst(raw?.awayName, raw?.awayTeamName, raw?.away_team_name, null);

    let home = {
        id: pickFirst(homeIdDirect, homeDirect.id, null),
        name: pickFirst(homeNameDirect, homeDirect.name, null),
        raw: homeDirect.raw,
        path: pickFirst(homeDirect.path, null)
    };
    let away = {
        id: pickFirst(awayIdDirect, awayDirect.id, null),
        name: pickFirst(awayNameDirect, awayDirect.name, null),
        raw: awayDirect.raw,
        path: pickFirst(awayDirect.path, null)
    };

    if (home.id !== null && competitorMap.has(home.id)) {
        const c = competitorMap.get(home.id);
        home = {
            id: pickFirst(home.id, c.id, null),
            name: pickFirst(home.name, c.name, null),
            raw: pickFirst(home.raw, c.raw, null),
            path: pickFirst(home.path, c.path, null)
        };
    }
    if (away.id !== null && competitorMap.has(away.id)) {
        const c = competitorMap.get(away.id);
        away = {
            id: pickFirst(away.id, c.id, null),
            name: pickFirst(away.name, c.name, null),
            raw: pickFirst(away.raw, c.raw, null),
            path: pickFirst(away.path, c.path, null)
        };
    }

    const roleCandidates = collectMatchesDeep(raw, (obj, path) => {
        if (!isObject(obj)) return false;
        const id = pickFirst(obj.id, obj.competitorId, obj.teamId, obj.participantId, null);
        const name = pickFirst(obj.name, obj.displayName, obj.shortName, obj.fullName, obj.title, obj.competitorName, null);
        if (id === null && !name) return false;
        return roleFromPath(path) !== null;
    });

    const homeRoleCandidate = roleCandidates.find((c) => roleFromPath(c.path) === 'home');
    const awayRoleCandidate = roleCandidates.find((c) => roleFromPath(c.path) === 'away');

    if ((home.id === null && !home.name) && homeRoleCandidate) {
        const t = teamFromItem(homeRoleCandidate.value, homeRoleCandidate.path, 'home');
        home = { id: t.id, name: t.name, raw: t.raw, path: t.path };
    }
    if ((away.id === null && !away.name) && awayRoleCandidate) {
        const t = teamFromItem(awayRoleCandidate.value, awayRoleCandidate.path, 'away');
        away = { id: t.id, name: t.name, raw: t.raw, path: t.path };
    }

    if ((home.id === null && !home.name) || (away.id === null && !away.name)) {
        const arrayMatches = collectMatchesDeep(raw, (obj) => Array.isArray(obj.competitors) || Array.isArray(obj.teams) || Array.isArray(obj.participants));
        if (arrayMatches.length) {
            const firstArr = pickFirst(arrayMatches[0].value.competitors, arrayMatches[0].value.teams, arrayMatches[0].value.participants, []);
            const candidates = firstArr.map((item, idx) => teamFromItem(item, `${arrayMatches[0].path}[${idx}]`, null));
            if ((home.id === null && !home.name) && candidates[0]) {
                home = {
                    id: pickFirst(home.id, candidates[0].id, null),
                    name: pickFirst(home.name, candidates[0].name, null),
                    raw: pickFirst(home.raw, candidates[0].raw, null),
                    path: pickFirst(home.path, candidates[0].path, null)
                };
                inferenceWarnings.push('home_team_inferred_from_competitor_array_order');
            }
            if ((away.id === null && !away.name) && candidates[1]) {
                away = {
                    id: pickFirst(away.id, candidates[1].id, null),
                    name: pickFirst(away.name, candidates[1].name, null),
                    raw: pickFirst(away.raw, candidates[1].raw, null),
                    path: pickFirst(away.path, candidates[1].path, null)
                };
                inferenceWarnings.push('away_team_inferred_from_competitor_array_order');
            }
        }
    }

    if (home.path) candidatePaths.push(home.path);
    if (away.path) candidatePaths.push(away.path);
    for (const key of competitorMap.keys()) {
        const c = competitorMap.get(key);
        if (c?.path) {
            candidatePaths.push(c.path);
            if (candidatePaths.length >= 10) break;
        }
    }

    return {
        home,
        away,
        diagnostics: {
            home_path: home.path || null,
            away_path: away.path || null,
            candidate_paths: Array.from(new Set(candidatePaths)).slice(0, 10),
            inference_warnings: inferenceWarnings
        }
    };
}

function extractKickoffTime(raw) {
    const direct = pickFirst(
        raw?.startTime, raw?.startDate, raw?.startTimestamp, raw?.kickoff, raw?.kickoffTime,
        raw?.date, raw?.time, raw?.scheduled, raw?.gameTime, raw?.matchTime
    );
    if (direct !== null) return String(direct);

    const found = collectMatchesDeep(raw, (obj) => pickFirst(
        obj.startTime, obj.startDate, obj.startTimestamp, obj.kickoff, obj.kickoffTime,
        obj.date, obj.time, obj.scheduled, obj.gameTime, obj.matchTime
    ) !== null);
    if (!found.length) return null;

    return String(pickFirst(
        found[0].value.startTime, found[0].value.startDate, found[0].value.startTimestamp,
        found[0].value.kickoff, found[0].value.kickoffTime, found[0].value.date,
        found[0].value.time, found[0].value.scheduled, found[0].value.gameTime, found[0].value.matchTime
    ));
}

function extractStatus(raw) {
    const direct = pickFirst(
        raw?.status, raw?.gameStatus, raw?.state, raw?.liveStatus, raw?.period,
        raw?.statusText, raw?.shortStatusText, raw?.isLive, raw?.isFinished
    );
    if (direct !== null) return String(direct);

    const found = collectMatchesDeep(raw, (obj) => pickFirst(
        obj.status, obj.gameStatus, obj.state, obj.liveStatus, obj.period,
        obj.statusText, obj.shortStatusText, obj.isLive, obj.isFinished
    ) !== null);
    if (!found.length) return null;

    return String(pickFirst(
        found[0].value.status, found[0].value.gameStatus, found[0].value.state, found[0].value.liveStatus,
        found[0].value.period, found[0].value.statusText, found[0].value.shortStatusText,
        found[0].value.isLive, found[0].value.isFinished
    ));
}

function extractScore(raw) {
    const scoreRaw = pickFirst(raw?.score, raw?.scores, raw?.result, raw?.goals, null);
    const fromRaw = (obj) => ({
        home: toNumberOrNull(pickFirst(obj?.home, obj?.homeScore, obj?.home_score, obj?.for)),
        away: toNumberOrNull(pickFirst(obj?.away, obj?.awayScore, obj?.away_score, obj?.against)),
        raw: obj && typeof obj === 'object' ? obj : null
    });

    if (scoreRaw !== null) return fromRaw(scoreRaw);

    const found = collectMatchesDeep(raw, (obj) => pickFirst(obj.score, obj.scores, obj.result, obj.goals) !== null);
    if (found.length) {
        const obj = pickFirst(found[0].value.score, found[0].value.scores, found[0].value.result, found[0].value.goals);
        return fromRaw(obj);
    }

    return {
        home: toNumberOrNull(pickFirst(raw?.homeScore, raw?.home_score)),
        away: toNumberOrNull(pickFirst(raw?.awayScore, raw?.away_score)),
        raw: null
    };
}

function extractCompetitorIds(raw) {
    const ids = new Set();

    function walk(value, depth) {
        if (depth > MAX_DEPTH || value === null || value === undefined) return;
        if (Array.isArray(value)) {
            for (const item of value.slice(0, 200)) walk(item, depth + 1);
            return;
        }
        if (!isObject(value)) return;

        const id = pickFirst(value.competitorId, value.teamId, value.participantId);
        if (id !== null) ids.add(id);

        if (value.id !== undefined && value.id !== null) {
            const nameLike = pickFirst(value.name, value.displayName, value.shortName, value.fullName, value.title, value.competitorName);
            if (nameLike) ids.add(value.id);
        }

        for (const child of Object.values(value)) walk(child, depth + 1);
    }

    walk(raw, 0);
    return Array.from(ids);
}

function normalizeCurrentGame(rawGame, sourcePath = null) {
    const competition = extractCompetition(rawGame);
    const teams = extractTeams(rawGame);
    const score = extractScore(rawGame);
    const warnings = [
        ...(Array.isArray(teams?.diagnostics?.inference_warnings) ? teams.diagnostics.inference_warnings : [])
    ];

    return {
        provider: PROVIDER,
        provider_game_id: pickFirst(extractGameId(rawGame), null),
        provider_fixture_id: pickFirst(extractFixtureId(rawGame), null),
        sport: SPORT,
        kickoff_time: extractKickoffTime(rawGame),
        status: extractStatus(rawGame),
        competition: {
            id: pickFirst(competition.id, null),
            name: pickFirst(competition.name, null),
            country: pickFirst(competition.country, null),
            raw: competition.raw
        },
        home_team: {
            id: pickFirst(teams.home.id, null),
            name: pickFirst(teams.home.name, null),
            raw: teams.home.raw
        },
        away_team: {
            id: pickFirst(teams.away.id, null),
            name: pickFirst(teams.away.name, null),
            raw: teams.away.raw
        },
        score: {
            home: pickFirst(score.home, null),
            away: pickFirst(score.away, null),
            raw: score.raw
        },
        competitor_ids: extractCompetitorIds(rawGame),
        source_path: sourcePath,
        team_diagnostics: {
            home_path: teams?.diagnostics?.home_path || null,
            away_path: teams?.diagnostics?.away_path || null,
            candidate_paths: teams?.diagnostics?.candidate_paths || [],
            inference_warnings: teams?.diagnostics?.inference_warnings || []
        },
        warnings,
        raw: rawGame || null
    };
}

function normalizeGameDetail(rawGameDetail, fallbackGame = null) {
    const normalized = normalizeCurrentGame(rawGameDetail, pickFirst(fallbackGame?.source_path, null));
    const mergedWarnings = [
        ...(Array.isArray(normalized?.warnings) ? normalized.warnings : []),
        ...(Array.isArray(fallbackGame?.warnings) ? fallbackGame.warnings : [])
    ];
    const teamDiagnostics = {
        home_path: pickFirst(normalized?.team_diagnostics?.home_path, fallbackGame?.team_diagnostics?.home_path, null),
        away_path: pickFirst(normalized?.team_diagnostics?.away_path, fallbackGame?.team_diagnostics?.away_path, null),
        candidate_paths: Array.from(new Set([
            ...(Array.isArray(normalized?.team_diagnostics?.candidate_paths) ? normalized.team_diagnostics.candidate_paths : []),
            ...(Array.isArray(fallbackGame?.team_diagnostics?.candidate_paths) ? fallbackGame.team_diagnostics.candidate_paths : [])
        ])).slice(0, 20),
        inference_warnings: Array.from(new Set([
            ...(Array.isArray(normalized?.team_diagnostics?.inference_warnings) ? normalized.team_diagnostics.inference_warnings : []),
            ...(Array.isArray(fallbackGame?.team_diagnostics?.inference_warnings) ? fallbackGame.team_diagnostics.inference_warnings : [])
        ]))
    };

    return {
        ...normalized,
        provider_game_id: pickFirst(normalized.provider_game_id, fallbackGame?.provider_game_id, null),
        provider_fixture_id: pickFirst(normalized.provider_fixture_id, fallbackGame?.provider_fixture_id, null),
        kickoff_time: pickFirst(normalized.kickoff_time, fallbackGame?.kickoff_time, null),
        status: pickFirst(normalized.status, fallbackGame?.status, null),
        competition: {
            id: pickFirst(normalized.competition?.id, fallbackGame?.competition?.id, null),
            name: pickFirst(normalized.competition?.name, fallbackGame?.competition?.name, null),
            country: pickFirst(normalized.competition?.country, fallbackGame?.competition?.country, null),
            raw: pickFirst(normalized.competition?.raw, fallbackGame?.competition?.raw, null)
        },
        home_team: {
            id: pickFirst(normalized.home_team?.id, fallbackGame?.home_team?.id, null),
            name: pickFirst(normalized.home_team?.name, fallbackGame?.home_team?.name, null),
            raw: pickFirst(normalized.home_team?.raw, fallbackGame?.home_team?.raw, null)
        },
        away_team: {
            id: pickFirst(normalized.away_team?.id, fallbackGame?.away_team?.id, null),
            name: pickFirst(normalized.away_team?.name, fallbackGame?.away_team?.name, null),
            raw: pickFirst(normalized.away_team?.raw, fallbackGame?.away_team?.raw, null)
        },
        competitor_ids: Array.from(new Set([
            ...normalized.competitor_ids,
            ...(Array.isArray(fallbackGame?.competitor_ids) ? fallbackGame.competitor_ids : [])
        ])),
        team_diagnostics: teamDiagnostics,
        warnings: Array.from(new Set(mergedWarnings)),
        raw: rawGameDetail || null
    };
}

function normalizeGameStats(rawStats, gameId) {
    return {
        provider: PROVIDER,
        provider_game_id: pickFirst(gameId, extractGameId(rawStats), null),
        stats_present: Boolean(rawStats),
        raw: rawStats || null
    };
}

function normalizeSquad(rawSquad, competitorId) {
    const ids = extractCompetitorIds(rawSquad);
    const athletes = collectMatchesDeep(rawSquad, (obj) => {
        const keys = Object.keys(obj).map((k) => k.toLowerCase());
        return keys.includes('athlete') || keys.includes('athletes') || keys.includes('player') || keys.includes('players');
    });

    return {
        provider: PROVIDER,
        competitor_id: pickFirst(competitorId, ids[0], null),
        athlete_like_sections: athletes.length,
        raw: rawSquad || null
    };
}

module.exports = {
    normalizeCurrentGame,
    normalizeGameDetail,
    normalizeGameStats,
    normalizeSquad,
    extractGameId,
    extractFixtureId,
    extractCompetition,
    extractTeams,
    extractKickoffTime,
    extractStatus,
    extractScore,
    extractCompetitorIds
};

