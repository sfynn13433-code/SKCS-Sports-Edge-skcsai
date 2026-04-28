'use strict';

const {
    getCurrentGames,
    getFixtures,
    getResults,
    getAllScores,
    getGame,
    getGameStats,
    getSquads
} = require('../backend/services/sportsApiProFootballService');
const { summarizeSportsApiProFootballResponse } = require('../backend/services/sportsApiProFootballExtractor');

const MAX_TOTAL_CALLS = 16;
const MAX_GAMES = 3;
const MAX_SQUAD_CALLS = 6;
const DELAY_MS = 350;
const MAX_DISCOVERY_DEPTH = 6;

const PARENT_ENDPOINTS = [
    {
        label: 'games_current',
        endpoint: '/games/current',
        params: { sports: 1 },
        execute: () => getCurrentGames({ sports: 1 })
    },
    {
        label: 'games_fixtures',
        endpoint: '/games/fixtures',
        params: { showOdds: false, competitions: 7, competitors: 131 },
        execute: () => getFixtures({ showOdds: false, competitions: 7, competitors: 131 })
    },
    {
        label: 'games_results',
        endpoint: '/games/results',
        params: { showOdds: false, competitors: 131 },
        execute: () => getResults({ showOdds: false, competitors: 131 })
    },
    {
        label: 'games_allscores',
        endpoint: '/games/allscores',
        params: { competitionId: 572, showOdds: false, startDate: '16/01/2025', endDate: '16/01/2025' },
        execute: () => getAllScores({ competitionId: 572, showOdds: false, startDate: '16/01/2025', endDate: '16/01/2025' })
    }
];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function extractCompetitorIdsFromAny(value, out = new Set(), depth = 0) {
    if (depth > MAX_DISCOVERY_DEPTH || value === null || value === undefined) return out;
    if (Array.isArray(value)) {
        for (const item of value.slice(0, 30)) extractCompetitorIdsFromAny(item, out, depth + 1);
        return out;
    }
    if (!isObject(value)) return out;

    const directId = toNumberOrNull(pickFirst(value.competitorId, value.competitor_id));
    if (directId !== null) out.add(directId);

    const idLike = toNumberOrNull(value.id);
    const nameLike = pickFirst(value.name, value.shortName, value.longName, value.symbolicName);
    if (idLike !== null && nameLike) out.add(idLike);

    for (const child of Object.values(value)) extractCompetitorIdsFromAny(child, out, depth + 1);
    return out;
}

function compactPreview(value, depth = 0) {
    if (depth > 2) return '[trimmed-depth]';
    if (Array.isArray(value)) return value.slice(0, 2).map((item) => compactPreview(item, depth + 1));
    if (!isObject(value)) return value;
    const out = {};
    for (const [k, v] of Object.entries(value).slice(0, 10)) out[k] = compactPreview(v, depth + 1);
    return out;
}

function hasFootballContext(rec) {
    const keys = Object.keys(rec).map((k) => String(k).toLowerCase());
    const hasByKey = (arr) => arr.some((k) => keys.includes(String(k).toLowerCase()));
    return hasByKey([
        'competitors', 'competitor', 'home', 'away', 'hometeam', 'awayteam', 'teams', 'participants',
        'competition', 'league', 'tournament', 'stage', 'startTime', 'startDate', 'kickoff', 'date',
        'status', 'score'
    ]);
}

function extractGameCandidate(record, path, parentEndpoint, competitorMap, competitionMap) {
    if (!isObject(record)) return null;

    const idValue = pickFirst(
        record.gameId, record.game_id, record.id,
        record.fixtureId, record.fixture_id,
        record.matchId, record.match_id,
        record.eventId, record.event_id
    );
    const gameId = toNumberOrNull(idValue);
    const fixtureId = pickFirst(record.fixtureId, record.fixture_id, record.eventId, record.event_id, null);

    if (gameId === null && !fixtureId) return null;
    if (!hasFootballContext(record)) return null;

    const lowerKeys = Object.keys(record).map((k) => String(k).toLowerCase());
    const hasTeamsContainer = lowerKeys.includes('competitors')
        || lowerKeys.includes('competitor')
        || lowerKeys.includes('home')
        || lowerKeys.includes('away')
        || lowerKeys.includes('teams')
        || lowerKeys.includes('participants')
        || lowerKeys.includes('homecompetitor')
        || lowerKeys.includes('awaycompetitor')
        || lowerKeys.includes('homecompetitorid')
        || lowerKeys.includes('awaycompetitorid');
    const hasCompetitionLike = lowerKeys.includes('competition')
        || lowerKeys.includes('competitionid')
        || lowerKeys.includes('league')
        || lowerKeys.includes('leagueid')
        || lowerKeys.includes('tournament')
        || lowerKeys.includes('tournamentid')
        || lowerKeys.includes('stage')
        || lowerKeys.includes('stageid');
    const hasTemporalLike = lowerKeys.includes('starttime')
        || lowerKeys.includes('startdate')
        || lowerKeys.includes('kickoff')
        || lowerKeys.includes('date')
        || lowerKeys.includes('status')
        || lowerKeys.includes('statustext')
        || lowerKeys.includes('shortstatustext');
    const hasScoreLike = lowerKeys.includes('score')
        || lowerKeys.includes('scores')
        || lowerKeys.includes('result')
        || lowerKeys.includes('goals');

    const competitorIds = Array.from(extractCompetitorIdsFromAny(record));
    const homeId = toNumberOrNull(pickFirst(
        record.homeCompetitorId, record.home_competitor_id, record.homeTeamId, record.home_team_id,
        record.home?.id, record.home?.competitorId
    )) || competitorIds[0] || null;
    const awayId = toNumberOrNull(pickFirst(
        record.awayCompetitorId, record.away_competitor_id, record.awayTeamId, record.away_team_id,
        record.away?.id, record.away?.competitorId
    )) || competitorIds[1] || null;

    const homeName = pickFirst(
        record.homeName, record.homeTeamName, record.home?.name,
        homeId !== null ? competitorMap.get(homeId)?.name : null
    );
    const awayName = pickFirst(
        record.awayName, record.awayTeamName, record.away?.name,
        awayId !== null ? competitorMap.get(awayId)?.name : null
    );

    const competitionId = toNumberOrNull(pickFirst(
        record.competitionId, record.competition_id, record.leagueId, record.league_id,
        record.tournamentId, record.tournament_id, record.stageId, record.stage_id
    ));
    const competitionName = pickFirst(
        record.competitionDisplayName, record.competitionName, record.competition?.name,
        record.leagueName, record.tournamentName, record.stageName,
        competitionId !== null ? competitionMap.get(competitionId)?.name : null
    );

    const startTime = pickFirst(
        record.startTime, record.start_time, record.startDate, record.start_date,
        record.kickoff, record.kickoffTime, record.date, record.scheduled
    );
    const status = pickFirst(
        record.statusText, record.shortStatusText, record.status, record.state
    );
    const score = pickFirst(record.score, record.scores, record.result, record.goals, null);

    const preferredSignal = Boolean(
        hasTeamsContainer
        || (hasCompetitionLike && hasTemporalLike)
        || (hasScoreLike && (hasTeamsContainer || competitorIds.length > 1))
        || (fixtureId && gameId !== null)
    );
    if (!preferredSignal) return null;

    return {
        gameId,
        fixtureId: fixtureId || null,
        homeId,
        awayId,
        homeName: homeName || null,
        awayName: awayName || null,
        competitionId,
        competitionName: competitionName || null,
        startTime: startTime || null,
        status: status || null,
        score: score || null,
        sourceParentEndpoint: parentEndpoint,
        sourcePath: path
    };
}

function buildMapsFromParentData(data) {
    const competitorMap = new Map();
    const competitionMap = new Map();

    function walk(value, depth) {
        if (depth > MAX_DISCOVERY_DEPTH || value === null || value === undefined) return;
        if (Array.isArray(value)) {
            for (const item of value.slice(0, 100)) walk(item, depth + 1);
            return;
        }
        if (!isObject(value)) return;

        const id = toNumberOrNull(value.id);
        if (id !== null) {
            const name = pickFirst(value.name, value.shortName, value.longName, value.competitionDisplayName);
            if (name) {
                const lowerKeys = Object.keys(value).map((k) => k.toLowerCase());
                if (lowerKeys.includes('countryid') || lowerKeys.includes('sportid')) {
                    if (!competitionMap.has(id) && (lowerKeys.includes('hasstandings') || lowerKeys.includes('hasbrackets') || lowerKeys.includes('currentstagenum') || lowerKeys.includes('seasonnum'))) {
                        competitionMap.set(id, { id, name });
                    }
                }
                if (!competitorMap.has(id) && (lowerKeys.includes('symbolicname') || lowerKeys.includes('maincompetitionid') || lowerKeys.includes('hassquad'))) {
                    competitorMap.set(id, { id, name });
                }
            }
        }

        for (const child of Object.values(value)) walk(child, depth + 1);
    }

    walk(data, 0);
    return { competitorMap, competitionMap };
}

function discoverGameCandidates(parentData, endpoint, neededCount, globalSeenIds) {
    const { competitorMap, competitionMap } = buildMapsFromParentData(parentData);
    const candidates = [];

    function walk(value, path, depth) {
        if (depth > MAX_DISCOVERY_DEPTH || candidates.length >= neededCount) return;

        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i += 1) {
                walk(value[i], `${path}[${i}]`, depth + 1);
                if (candidates.length >= neededCount) return;
            }
            return;
        }

        if (!isObject(value)) return;

        const candidate = extractGameCandidate(value, path, endpoint, competitorMap, competitionMap);
        if (candidate) {
            const dedupeKey = candidate.gameId !== null ? `gid:${candidate.gameId}` : `fid:${candidate.fixtureId}`;
            if (!globalSeenIds.has(dedupeKey)) {
                globalSeenIds.add(dedupeKey);
                candidates.push(candidate);
            }
        }

        for (const [k, child] of Object.entries(value)) {
            walk(child, `${path}.${k}`, depth + 1);
            if (candidates.length >= neededCount) return;
        }
    }

    walk(parentData, 'root', 0);
    return candidates;
}

function extractFromGameDetail(data) {
    const game = isObject(data?.game) ? data.game : (isObject(data) ? data : {});
    const competitors = Array.isArray(data?.competitors) ? data.competitors : [];
    const competitions = Array.isArray(data?.competitions) ? data.competitions : [];
    const gameCompetitors = Array.isArray(data?.gameCompetitors) ? data.gameCompetitors : [];

    const competitorById = new Map();
    for (const c of competitors) {
        const id = toNumberOrNull(c?.id);
        if (id !== null) competitorById.set(id, c);
    }

    const homeLink = gameCompetitors.find((gc) => String(gc?.qualifier || '').toLowerCase().includes('home'))
        || gameCompetitors.find((gc) => Number(gc?.order) === 1)
        || gameCompetitors[0]
        || null;
    const awayLink = gameCompetitors.find((gc) => String(gc?.qualifier || '').toLowerCase().includes('away'))
        || gameCompetitors.find((gc) => Number(gc?.order) === 2)
        || gameCompetitors[1]
        || null;

    const homeId = toNumberOrNull(pickFirst(game.homeCompetitorId, game.homeTeamId, homeLink?.competitorId, homeLink?.id));
    const awayId = toNumberOrNull(pickFirst(game.awayCompetitorId, game.awayTeamId, awayLink?.competitorId, awayLink?.id));
    const competitionId = toNumberOrNull(pickFirst(game.competitionId, game.leagueId, competitions[0]?.id));
    const competitionObj = competitions.find((c) => toNumberOrNull(c?.id) === competitionId) || competitions[0] || null;

    return {
        gameId: toNumberOrNull(pickFirst(game.gameId, game.id, data?.gameId, data?.id)),
        fixtureId: pickFirst(game.fixtureId, game.fixture_id, game.eventId, data?.fixtureId, data?.fixture_id, null),
        homeId,
        awayId,
        homeName: pickFirst(game.homeName, game.homeTeamName, homeId !== null ? competitorById.get(homeId)?.name : null),
        awayName: pickFirst(game.awayName, game.awayTeamName, awayId !== null ? competitorById.get(awayId)?.name : null),
        competitionId,
        competitionName: pickFirst(game.competitionDisplayName, game.competitionName, competitionObj?.name, competitionObj?.shortName),
        startTime: pickFirst(game.startTime, game.startDate, game.kickoffTime, game.date),
        status: pickFirst(game.statusText, game.shortStatusText, game.status, game.state),
        score: pickFirst(game.score, game.result, data?.score, null),
        lineupIndicator: Boolean(data?.lineup || data?.lineups || data?.gameLineups),
        squadIndicator: Boolean(data?.squad || data?.squads || data?.athletes)
    };
}

function extractStatsJoinSignal(data, expectedGameId) {
    if (!data) return false;
    let foundStats = false;
    let foundMatchingId = false;

    function walk(value, depth) {
        if (depth > MAX_DISCOVERY_DEPTH) return;
        if (Array.isArray(value)) {
            for (const item of value.slice(0, 50)) walk(item, depth + 1);
            return;
        }
        if (!isObject(value)) return;

        const gameId = toNumberOrNull(pickFirst(value.gameId, value.id, value.matchId));
        if (gameId !== null && expectedGameId !== null && gameId === expectedGameId) foundMatchingId = true;
        if (value.stats || value.statistics || value.metrics) foundStats = true;

        for (const child of Object.values(value)) walk(child, depth + 1);
    }

    walk(data, 0);
    return foundStats || foundMatchingId;
}

function squadHasCompetitorSignal(data, competitorId) {
    if (!data) return false;
    let found = false;

    function walk(value, depth) {
        if (depth > MAX_DISCOVERY_DEPTH || found) return;
        if (Array.isArray(value)) {
            for (const item of value.slice(0, 50)) walk(item, depth + 1);
            return;
        }
        if (!isObject(value)) return;

        const id = toNumberOrNull(pickFirst(value.competitorId, value.id));
        if (id !== null && competitorId !== null && id === competitorId) {
            found = true;
            return;
        }
        if (value.squad || value.players || value.athletes) {
            found = true;
            return;
        }

        for (const child of Object.values(value)) walk(child, depth + 1);
    }

    walk(data, 0);
    return found;
}

async function run() {
    console.log('=== SKCS SPORTSAPI PRO FOOTBALL JOINABILITY TEST V2 START ===');

    let callsAttempted = 0;
    const call = async (label, fn) => {
        if (callsAttempted >= MAX_TOTAL_CALLS) {
            return {
                ok: false,
                status: null,
                message: `Skipped ${label}; max call limit reached.`,
                data: null
            };
        }
        callsAttempted += 1;
        const response = await fn();
        await sleep(DELAY_MS);
        return response;
    };

    const parentEndpointsAttempted = [];
    const parentDiscoveryDiagnostics = [];
    const selectedGames = [];
    const seenGameKeys = new Set();
    let firstParentProducingGames = null;

    for (const parent of PARENT_ENDPOINTS) {
        if (selectedGames.length >= MAX_GAMES) break;

        const response = await call(parent.label, parent.execute);
        parentEndpointsAttempted.push(parent.endpoint);

        const summary = summarizeSportsApiProFootballResponse(parent.label, response);
        const rootKeys = summary?.shape?.rootKeys || [];
        const arrayPaths = (summary?.shape?.arrayCandidates || []).map((a) => a.path);
        const preview = compactPreview(summary?.preview ?? response?.data);

        console.log(`\n[Parent] ${parent.endpoint} params=${JSON.stringify(parent.params)}`);
        console.log(`ok=${Boolean(response?.ok)} status=${response?.status ?? null}`);
        console.log(`root keys: ${JSON.stringify(rootKeys)}`);
        console.log(`array candidate paths: ${JSON.stringify(arrayPaths)}`);
        console.log(`preview: ${JSON.stringify(preview)}`);

        let foundHere = [];
        if (response?.ok && response?.data) {
            foundHere = discoverGameCandidates(
                response.data,
                parent.endpoint,
                MAX_GAMES - selectedGames.length,
                seenGameKeys
            );
            selectedGames.push(...foundHere);
        }

        parentDiscoveryDiagnostics.push({
            endpoint: parent.endpoint,
            ok: Boolean(response?.ok),
            status: response?.status ?? null,
            foundCount: foundHere.length
        });

        console.log(`game-like candidates discovered from ${parent.endpoint}: ${foundHere.length}`);
        if (!firstParentProducingGames && foundHere.length > 0) firstParentProducingGames = parent.endpoint;
    }

    console.log(`\nSelected games after parent discovery: ${selectedGames.length}`);
    selectedGames.forEach((g, idx) => {
        console.log(
            `[Game ${idx + 1}] gameId=${g.gameId ?? 'n/a'} fixtureId=${g.fixtureId ?? 'n/a'} `
            + `home=${g.homeName || g.homeId || 'n/a'} away=${g.awayName || g.awayId || 'n/a'} `
            + `competition=${g.competitionName || g.competitionId || 'n/a'} start=${g.startTime || 'n/a'} `
            + `status=${g.status || 'n/a'} source=${g.sourceParentEndpoint} path=${g.sourcePath}`
        );
    });

    if (selectedGames.length === 0) {
        console.log('\nNo game-like records found across all parent endpoints after depth-6 scan.');
        console.log('Parent diagnostics:', JSON.stringify(parentDiscoveryDiagnostics, null, 2));
        console.log('\n=== SKCS SPORTSAPI PRO FOOTBALL JOINABILITY TEST V2 SUMMARY ===');
        console.log(`Total calls attempted: ${callsAttempted}`);
        console.log(`Parent endpoints attempted: ${parentEndpointsAttempted.join(', ')}`);
        console.log(`Parent endpoint that produced selected games: none`);
        console.log(`Selected games count: 0`);
        console.log('Selected game IDs: none');
        console.log('Selected game source paths: none');
        console.log('/game join success count: 0');
        console.log('/games/stats join success count: 0');
        console.log('/squads join success count: 0');
        console.log('Competitor IDs found? no');
        console.log('Game IDs stable across endpoints? unknown');
        console.log('Start date/time confirmed? unknown');
        console.log('Status confirmed? unknown');
        console.log('Competition confirmed? unknown');
        console.log('Team names confirmed? unknown');
        console.log('Stats joinable by gameId? unknown');
        console.log('Squads joinable by competitorId? unknown');
        console.log('Provider role recommendation:');
        console.log('- approved_as_primary_current_fixture_source: unknown');
        console.log('- approved_as_game_detail_source: unknown');
        console.log('- approved_as_stats_enrichment_source: unknown');
        console.log('- approved_as_squad_enrichment_source: unknown');
        console.log('- provider_predictions_allowed: no');
        console.log('- production_wiring_allowed_now: no');
        console.log('Review decision: DO NOT WIRE YET. Joinability V2 output must be reviewed first.');
        process.exitCode = 0;
        return;
    }

    const gameJoinResults = [];
    const statsJoinResults = [];
    const competitorIds = new Set();

    for (const selected of selectedGames) {
        if (selected.homeId !== null && selected.homeId !== undefined) competitorIds.add(selected.homeId);
        if (selected.awayId !== null && selected.awayId !== undefined) competitorIds.add(selected.awayId);

        if (selected.gameId === null) {
            gameJoinResults.push({
                parentGameId: null,
                ok: false,
                status: null,
                detail: null,
                skipped: true
            });
            statsJoinResults.push({
                gameId: null,
                ok: false,
                status: null,
                joinable: false,
                skipped: true
            });
            continue;
        }

        const gameResp = await call(`game_detail_${selected.gameId}`, () => getGame({ gameId: selected.gameId }));
        const gameOk = Boolean(gameResp?.ok);
        const detail = gameOk ? extractFromGameDetail(gameResp?.data) : null;

        if (detail?.homeId !== null && detail?.homeId !== undefined) competitorIds.add(detail.homeId);
        if (detail?.awayId !== null && detail?.awayId !== undefined) competitorIds.add(detail.awayId);

        gameJoinResults.push({
            parentGameId: selected.gameId,
            ok: gameOk,
            status: gameResp?.status ?? null,
            detail,
            skipped: false
        });

        const statsResp = await call(`game_stats_${selected.gameId}`, () => getGameStats({
            filterId: -1,
            gameId: selected.gameId,
            onlyIsMajor: false
        }));
        const statsOk = Boolean(statsResp?.ok);
        const statsJoinable = statsOk ? extractStatsJoinSignal(statsResp?.data, selected.gameId) : false;

        statsJoinResults.push({
            gameId: selected.gameId,
            ok: statsOk,
            status: statsResp?.status ?? null,
            joinable: statsJoinable,
            skipped: false
        });
    }

    const uniqueCompetitors = Array.from(competitorIds).filter((id) => id !== null).slice(0, MAX_SQUAD_CALLS);
    const squadJoinResults = [];
    for (const competitorId of uniqueCompetitors) {
        const squadResp = await call(`squad_${competitorId}`, () => getSquads({ competitors: competitorId }));
        const squadOk = Boolean(squadResp?.ok);
        const squadJoinable = squadOk ? squadHasCompetitorSignal(squadResp?.data, competitorId) : false;
        squadJoinResults.push({
            competitorId,
            ok: squadOk,
            status: squadResp?.status ?? null,
            joinable: squadJoinable
        });
    }

    const gameJoinSuccessCount = gameJoinResults.filter((r) => r.ok && r.detail && r.detail.gameId !== null).length;
    const statsJoinSuccessCount = statsJoinResults.filter((r) => r.ok && r.joinable).length;
    const squadsJoinSuccessCount = squadJoinResults.filter((r) => r.ok && r.joinable).length;

    const stableGameIds = gameJoinResults.filter((r) => !r.skipped).length
        ? gameJoinResults.filter((r) => !r.skipped).every((r) => r.detail && r.detail.gameId !== null && r.parentGameId === r.detail.gameId)
        : null;

    const startConfirmed = gameJoinResults.some((r) => r.detail?.startTime) ? 'yes' : (gameJoinResults.length ? 'no' : 'unknown');
    const statusConfirmed = gameJoinResults.some((r) => r.detail?.status) ? 'yes' : (gameJoinResults.length ? 'no' : 'unknown');
    const competitionConfirmed = gameJoinResults.some((r) => r.detail?.competitionId || r.detail?.competitionName) ? 'yes' : (gameJoinResults.length ? 'no' : 'unknown');
    const teamsConfirmed = gameJoinResults.some((r) => r.detail?.homeName || r.detail?.awayName || r.detail?.homeId || r.detail?.awayId) ? 'yes' : (gameJoinResults.length ? 'no' : 'unknown');
    const statsJoinableState = statsJoinResults.length ? (statsJoinResults.some((r) => r.joinable) ? 'yes' : 'no') : 'unknown';
    const squadsJoinableState = squadJoinResults.length ? (squadJoinResults.some((r) => r.joinable) ? 'yes' : 'no') : 'unknown';

    const providerRole = {
        approved_as_primary_current_fixture_source: selectedGames.length > 0 && gameJoinSuccessCount > 0 ? 'yes' : (selectedGames.length > 0 ? 'unknown' : 'no'),
        approved_as_game_detail_source: gameJoinSuccessCount > 0 ? 'yes' : (gameJoinResults.length ? 'unknown' : 'no'),
        approved_as_stats_enrichment_source: statsJoinSuccessCount > 0 ? 'yes' : (statsJoinResults.length ? 'unknown' : 'no'),
        approved_as_squad_enrichment_source: squadsJoinSuccessCount > 0 ? 'yes' : (squadJoinResults.length ? 'unknown' : 'no'),
        provider_predictions_allowed: 'no',
        production_wiring_allowed_now: 'no'
    };

    console.log('\n=== SKCS SPORTSAPI PRO FOOTBALL JOINABILITY TEST V2 SUMMARY ===');
    console.log(`Total calls attempted: ${callsAttempted}`);
    console.log(`Parent endpoints attempted: ${parentEndpointsAttempted.join(', ')}`);
    console.log(`Parent endpoint that produced selected games: ${firstParentProducingGames || 'none'}`);
    console.log(`Selected games count: ${selectedGames.length}`);
    console.log(`Selected game IDs: ${selectedGames.map((g) => (g.gameId !== null ? g.gameId : `fixture:${g.fixtureId || 'n/a'}`)).join(', ')}`);
    console.log(`Selected game source paths: ${selectedGames.map((g) => `${g.sourceParentEndpoint}:${g.sourcePath}`).join(' | ')}`);
    console.log(`/game join success count: ${gameJoinSuccessCount}`);
    console.log(`/games/stats join success count: ${statsJoinSuccessCount}`);
    console.log(`/squads join success count: ${squadsJoinSuccessCount}`);
    console.log(`Competitor IDs found? ${uniqueCompetitors.length > 0 ? 'yes' : 'no'}`);
    console.log(`Game IDs stable across endpoints? ${stableGameIds === null ? 'unknown' : (stableGameIds ? 'yes' : 'no')}`);
    console.log(`Start date/time confirmed? ${startConfirmed}`);
    console.log(`Status confirmed? ${statusConfirmed}`);
    console.log(`Competition confirmed? ${competitionConfirmed}`);
    console.log(`Team names confirmed? ${teamsConfirmed}`);
    console.log(`Stats joinable by gameId? ${statsJoinableState}`);
    console.log(`Squads joinable by competitorId? ${squadsJoinableState}`);
    console.log('Provider role recommendation:');
    console.log(`- approved_as_primary_current_fixture_source: ${providerRole.approved_as_primary_current_fixture_source}`);
    console.log(`- approved_as_game_detail_source: ${providerRole.approved_as_game_detail_source}`);
    console.log(`- approved_as_stats_enrichment_source: ${providerRole.approved_as_stats_enrichment_source}`);
    console.log(`- approved_as_squad_enrichment_source: ${providerRole.approved_as_squad_enrichment_source}`);
    console.log(`- provider_predictions_allowed: ${providerRole.provider_predictions_allowed}`);
    console.log(`- production_wiring_allowed_now: ${providerRole.production_wiring_allowed_now}`);
    console.log('Review decision: DO NOT WIRE YET. Joinability V2 output must be reviewed first.');
    process.exitCode = 0;
}

run().catch((error) => {
    const message = String(error?.message || error || 'Unknown local error');
    if (message.includes('Missing SportsAPI Pro Football RapidAPI key')) {
        console.error(message);
    } else {
        console.error(`Joinability V2 test failed: ${message}`);
    }
    process.exitCode = 1;
});
