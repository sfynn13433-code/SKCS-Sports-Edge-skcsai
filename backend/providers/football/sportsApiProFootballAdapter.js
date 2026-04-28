'use strict';

const {
    getCurrentGames,
    getGame,
    getGameStats,
    getSquads
} = require('../../services/sportsApiProFootballService');
const {
    normalizeCurrentGame,
    normalizeGameDetail,
    normalizeGameStats,
    normalizeSquad
} = require('./sportsApiProFootballNormalizer');

const PROVIDER = 'sportsapi_pro_football';
const MAX_DEPTH = 6;
const FALLBACK_SAMPLE_GAME_IDS = [4685424, 4697882, 4703495];

function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function pickFirst(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return null;
}

function isSportsApiProFootballEnabled() {
    return String(process.env.ENABLE_SPORTSAPI_PRO_FOOTBALL || '').trim() === 'true';
}

function disabledResponse() {
    return {
        ok: false,
        disabled: true,
        reason: 'ENABLE_SPORTSAPI_PRO_FOOTBALL is not true'
    };
}

function compactPreview(data) {
    if (!data || typeof data !== 'object') return data || null;
    const out = {};
    for (const [key, value] of Object.entries(data).slice(0, 8)) {
        if (Array.isArray(value)) {
            out[key] = `array(${value.length})`;
        } else if (value && typeof value === 'object') {
            out[key] = Object.keys(value).slice(0, 8);
        } else {
            out[key] = value;
        }
    }
    return out;
}

function extractCurrentGameRecords(raw) {
    const records = [];

    const competitorMap = new Map();
    const competitionMap = new Map();
    if (Array.isArray(raw?.competitors)) {
        raw.competitors.forEach((c, idx) => {
            const id = pickFirst(c?.id, c?.competitorId);
            if (id !== null && id !== undefined) {
                competitorMap.set(id, { ...c, _sourcePath: `root.competitors[${idx}]` });
            }
        });
    }
    if (Array.isArray(raw?.competitions)) {
        raw.competitions.forEach((c, idx) => {
            const id = pickFirst(c?.id, c?.competitionId);
            if (id !== null && id !== undefined) {
                competitionMap.set(id, { ...c, _sourcePath: `root.competitions[${idx}]` });
            }
        });
    }

    const explicitGames = Array.isArray(raw?.games) ? raw.games : [];
    if (explicitGames.length) {
        explicitGames.forEach((g, idx) => {
            const homeId = pickFirst(g?.homeCompetitorId, g?.homeTeamId, g?.home?.id, g?.homeCompetitor?.id);
            const awayId = pickFirst(g?.awayCompetitorId, g?.awayTeamId, g?.away?.id, g?.awayCompetitor?.id);
            const competitionId = pickFirst(g?.competitionId, g?.leagueId, g?.tournamentId);
            const enriched = {
                ...g,
                home: pickFirst(g?.home, g?.homeTeam, g?.homeCompetitor, homeId !== null && homeId !== undefined ? competitorMap.get(homeId) : null),
                away: pickFirst(g?.away, g?.awayTeam, g?.awayCompetitor, awayId !== null && awayId !== undefined ? competitorMap.get(awayId) : null),
                competition: pickFirst(g?.competition, competitionId !== null && competitionId !== undefined ? competitionMap.get(competitionId) : null),
                _provider_competitors: Array.isArray(raw?.competitors) ? raw.competitors : []
            };
            records.push({ raw: enriched, path: `root.games[${idx}]` });
        });
    }

    function looksGameLike(obj) {
        const hasId = pickFirst(obj.gameId, obj.game_id, obj.id, obj.fixtureId, obj.fixture_id, obj.matchId, obj.match_id, obj.eventId, obj.event_id) !== null;
        if (!hasId) return false;

        const keys = Object.keys(obj).map((k) => k.toLowerCase());
        const hasContext = keys.includes('homecompetitorid')
            || keys.includes('awaycompetitorid')
            || keys.includes('statustext')
            || keys.includes('competitionid')
            || keys.includes('starttime')
            || keys.includes('home')
            || keys.includes('away')
            || keys.includes('competitors')
            || keys.includes('teams')
            || keys.includes('participants')
            || keys.includes('status')
            || keys.includes('score');
        return hasContext;
    }

    function walk(value, path, depth) {
        if (depth > MAX_DEPTH || records.length >= 100 || value === null || value === undefined) return;
        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i += 1) {
                walk(value[i], `${path}[${i}]`, depth + 1);
            }
            return;
        }
        if (!isObject(value)) return;

        if (looksGameLike(value)) {
            records.push({ raw: value, path });
        }

        for (const [k, child] of Object.entries(value)) {
            walk(child, `${path}.${k}`, depth + 1);
        }
    }

    if (!explicitGames.length) {
        walk(raw, 'root', 0);
    }

    const deduped = [];
    const seen = new Set();
    for (const item of records) {
        const normalized = normalizeCurrentGame(item.raw, item.path);
        const key = normalized.provider_game_id !== null
            ? `g:${normalized.provider_game_id}`
            : `f:${normalized.provider_fixture_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(normalized);
    }
    return deduped;
}

async function fetchCurrentFootballGames(options = {}) {
    if (!isSportsApiProFootballEnabled()) {
        return {
            ...disabledResponse(),
            games: []
        };
    }

    const response = await getCurrentGames({ sports: 1 });
    const games = response?.ok ? extractCurrentGameRecords(response?.data) : [];

    return {
        ok: Boolean(response?.ok),
        disabled: false,
        sourceEndpoint: '/games/current',
        count: games.length,
        games,
        rateLimit: response?.rateLimit || null,
        rawPreview: compactPreview(response?.data),
        rawStatus: response?.status ?? null,
        options
    };
}

async function fetchGameDetail(gameId) {
    if (!isSportsApiProFootballEnabled()) {
        return {
            ...disabledResponse(),
            gameId,
            detail: null
        };
    }

    if (gameId === null || gameId === undefined || gameId === '') {
        return {
            ok: false,
            disabled: false,
            gameId,
            detail: null,
            status: null,
            message: 'Missing gameId'
        };
    }

    const response = await getGame({ gameId });
    const detail = response?.ok ? normalizeGameDetail(response?.data, null) : null;
    return {
        ok: Boolean(response?.ok),
        disabled: false,
        gameId,
        detail,
        status: response?.status ?? null,
        rateLimit: response?.rateLimit || null,
        message: response?.message || null
    };
}

async function fetchGameStats(gameId) {
    if (!isSportsApiProFootballEnabled()) {
        return {
            ...disabledResponse(),
            gameId,
            stats: null
        };
    }

    if (gameId === null || gameId === undefined || gameId === '') {
        return {
            ok: false,
            disabled: false,
            gameId,
            stats: null,
            status: null,
            message: 'Missing gameId'
        };
    }

    const response = await getGameStats({
        filterId: -1,
        gameId,
        onlyIsMajor: false
    });
    const stats = response?.ok ? normalizeGameStats(response?.data, gameId) : null;
    return {
        ok: Boolean(response?.ok),
        disabled: false,
        gameId,
        stats,
        status: response?.status ?? null,
        rateLimit: response?.rateLimit || null,
        message: response?.message || null
    };
}

async function fetchSquadsForCompetitors(competitorIds = []) {
    if (!isSportsApiProFootballEnabled()) {
        return {
            ...disabledResponse(),
            squads: []
        };
    }

    const uniqueIds = Array.from(new Set((Array.isArray(competitorIds) ? competitorIds : []).filter((id) => id !== null && id !== undefined))).slice(0, 20);
    const squads = [];
    const warnings = [];

    for (const competitorId of uniqueIds) {
        const response = await getSquads({ competitors: competitorId });
        if (!response?.ok) {
            warnings.push(`squad_fetch_failed:${competitorId}:${response?.status ?? 'unknown'}`);
            squads.push({
                ok: false,
                competitor_id: competitorId,
                status: response?.status ?? null,
                squad: null
            });
            continue;
        }
        squads.push({
            ok: true,
            competitor_id: competitorId,
            status: response?.status ?? null,
            squad: normalizeSquad(response?.data, competitorId),
            rateLimit: response?.rateLimit || null
        });
    }

    return {
        ok: true,
        disabled: false,
        count: squads.length,
        squads,
        warnings
    };
}

async function buildFootballGameContext(gameIdOrNormalizedGame) {
    if (!isSportsApiProFootballEnabled()) {
        return {
            ...disabledResponse(),
            provider: PROVIDER,
            normalizedGame: null,
            detail: null,
            stats: null,
            squads: [],
            joinability: {
                detailJoined: false,
                statsJoined: false,
                squadsJoined: false,
                competitorIdsFound: 0,
                kickoffConfirmed: false,
                statusConfirmed: false,
                competitionConfirmed: false,
                teamsConfirmed: false
            },
            warnings: []
        };
    }

    const warnings = [];
    const gameId = typeof gameIdOrNormalizedGame === 'object'
        ? gameIdOrNormalizedGame?.provider_game_id
        : gameIdOrNormalizedGame;
    const normalizedGame = typeof gameIdOrNormalizedGame === 'object'
        ? gameIdOrNormalizedGame
        : {
            provider: PROVIDER,
            provider_game_id: pickFirst(gameId, null),
            provider_fixture_id: null,
            sport: 'football',
            kickoff_time: null,
            status: null,
            competition: { id: null, name: null, country: null, raw: null },
            home_team: { id: null, name: null, raw: null },
            away_team: { id: null, name: null, raw: null },
            score: { home: null, away: null, raw: null },
            competitor_ids: [],
            source_path: null,
            raw: null
        };

    if (gameId === null || gameId === undefined || gameId === '') {
        warnings.push('missing_game_id');
        return {
            ok: false,
            provider: PROVIDER,
            gameId: null,
            normalizedGame,
            detail: null,
            stats: null,
            squads: [],
            joinability: {
                detailJoined: false,
                statsJoined: false,
                squadsJoined: false,
                competitorIdsFound: Array.isArray(normalizedGame?.competitor_ids) ? normalizedGame.competitor_ids.length : 0,
                kickoffConfirmed: Boolean(normalizedGame?.kickoff_time),
                statusConfirmed: Boolean(normalizedGame?.status),
                competitionConfirmed: Boolean(normalizedGame?.competition?.id || normalizedGame?.competition?.name),
                teamsConfirmed: Boolean(normalizedGame?.home_team?.name && normalizedGame?.away_team?.name)
            },
            warnings
        };
    }

    const detailResp = await getGame({ gameId });
    const detail = detailResp?.ok ? normalizeGameDetail(detailResp?.data, normalizedGame) : null;
    if (!detailResp?.ok) warnings.push(`detail_fetch_failed:${detailResp?.status ?? 'unknown'}`);

    const statsResp = await getGameStats({ filterId: -1, gameId, onlyIsMajor: false });
    const stats = statsResp?.ok ? normalizeGameStats(statsResp?.data, gameId) : null;
    if (!statsResp?.ok) warnings.push(`stats_fetch_failed:${statsResp?.status ?? 'unknown'}`);

    const competitorIds = Array.from(new Set([
        ...(Array.isArray(normalizedGame?.competitor_ids) ? normalizedGame.competitor_ids : []),
        ...(Array.isArray(detail?.competitor_ids) ? detail.competitor_ids : []),
        normalizedGame?.home_team?.id,
        normalizedGame?.away_team?.id,
        detail?.home_team?.id,
        detail?.away_team?.id
    ].filter((id) => id !== null && id !== undefined))).slice(0, 20);

    const squadResp = await fetchSquadsForCompetitors(competitorIds);
    if (!squadResp?.ok) warnings.push('squads_fetch_failed');
    if (Array.isArray(squadResp?.warnings) && squadResp.warnings.length) warnings.push(...squadResp.warnings);

    const effective = detail || normalizedGame;
    return {
        ok: Boolean(detailResp?.ok || statsResp?.ok || (squadResp?.count || 0) > 0),
        provider: PROVIDER,
        gameId,
        normalizedGame,
        detail,
        stats,
        squads: Array.isArray(squadResp?.squads) ? squadResp.squads : [],
        joinability: {
            detailJoined: Boolean(detailResp?.ok && detail),
            statsJoined: Boolean(statsResp?.ok && stats),
            squadsJoined: Array.isArray(squadResp?.squads) && squadResp.squads.some((s) => s.ok),
            competitorIdsFound: competitorIds.length,
            kickoffConfirmed: Boolean(effective?.kickoff_time),
            statusConfirmed: Boolean(effective?.status),
            competitionConfirmed: Boolean(effective?.competition?.id || effective?.competition?.name),
            teamsConfirmed: Boolean(effective?.home_team?.name && effective?.away_team?.name)
        },
        warnings
    };
}

async function discoverAndBuildSampleContexts(limit = 3) {
    if (!isSportsApiProFootballEnabled()) {
        return {
            ...disabledResponse(),
            currentGamesNormalizedCount: 0,
            contexts: []
        };
    }

    const cappedLimit = Math.min(Math.max(Number(limit) || 3, 1), 3);
    const warnings = [];
    let callBudget = 13;

    if (callBudget < 1) {
        return {
            ok: false,
            disabled: false,
            reason: 'call_budget_exhausted',
            currentGamesNormalizedCount: 0,
            contexts: [],
            warnings
        };
    }

    callBudget -= 1;
    const currentResp = await fetchCurrentFootballGames({ mode: 'adapter_sample' });
    const games = Array.isArray(currentResp?.games) ? currentResp.games : [];
    let selected = games
        .filter((g) => g?.provider_game_id !== null && g?.provider_game_id !== undefined && g?.provider_game_id !== '')
        .slice(0, cappedLimit);

    if (!selected.length) {
        warnings.push('current_games_empty_or_unavailable_using_fallback_sample_game_ids');
        selected = FALLBACK_SAMPLE_GAME_IDS.slice(0, cappedLimit).map((gameId) => ({
            provider: PROVIDER,
            provider_game_id: gameId,
            provider_fixture_id: null,
            sport: 'football',
            kickoff_time: null,
            status: null,
            competition: { id: null, name: null, country: null, raw: null },
            home_team: { id: null, name: null, raw: null },
            away_team: { id: null, name: null, raw: null },
            score: { home: null, away: null, raw: null },
            competitor_ids: [],
            source_path: 'fallback.seed_game_id',
            team_diagnostics: {
                home_path: null,
                away_path: null,
                candidate_paths: ['fallback.seed_game_id'],
                inference_warnings: []
            },
            warnings: ['seeded_from_fallback_due_to_current_unavailable'],
            raw: null
        }));
    }

    const contexts = [];
    for (const game of selected) {
        if (callBudget < 3) {
            warnings.push(`skipped_context_for_game_${game.provider_game_id}_due_to_budget`);
            continue;
        }

        const contextWarnings = [];
        const gameId = game.provider_game_id;

        callBudget -= 1;
        const detailResp = await fetchGameDetail(gameId);
        const detail = detailResp?.ok ? normalizeGameDetail(detailResp?.detail?.raw || detailResp?.detail || null, game) : null;
        if (!detailResp?.ok) contextWarnings.push(`detail_fetch_failed:${detailResp?.status ?? 'unknown'}`);

        callBudget -= 1;
        const statsResp = await fetchGameStats(gameId);
        const stats = statsResp?.ok ? statsResp?.stats : null;
        if (!statsResp?.ok) contextWarnings.push(`stats_fetch_failed:${statsResp?.status ?? 'unknown'}`);

        const competitorIds = Array.from(new Set([
            ...(Array.isArray(game?.competitor_ids) ? game.competitor_ids : []),
            ...(Array.isArray(detail?.competitor_ids) ? detail.competitor_ids : []),
            game?.home_team?.id,
            game?.away_team?.id,
            detail?.home_team?.id,
            detail?.away_team?.id
        ].filter((id) => id !== null && id !== undefined))).slice(0, 2);

        let squads = [];
        if (competitorIds.length && callBudget > 0) {
            const squadAllowedCount = Math.min(2, competitorIds.length, callBudget);
            callBudget -= squadAllowedCount;
            const squadResp = await fetchSquadsForCompetitors(competitorIds.slice(0, squadAllowedCount));
            squads = Array.isArray(squadResp?.squads) ? squadResp.squads : [];
            if (Array.isArray(squadResp?.warnings) && squadResp.warnings.length) {
                contextWarnings.push(...squadResp.warnings);
            }
        }

        const effective = detail || game;
        contexts.push({
            ok: Boolean(detailResp?.ok || statsResp?.ok || squads.some((s) => s.ok)),
            provider: PROVIDER,
            gameId,
            normalizedGame: game,
            detail,
            stats,
            squads,
            joinability: {
                detailJoined: Boolean(detailResp?.ok && detail),
                statsJoined: Boolean(statsResp?.ok && stats),
                squadsJoined: squads.some((s) => s.ok),
                competitorIdsFound: competitorIds.length,
                kickoffConfirmed: Boolean(effective?.kickoff_time),
                statusConfirmed: Boolean(effective?.status),
                competitionConfirmed: Boolean(effective?.competition?.id || effective?.competition?.name),
                teamsConfirmed: Boolean(effective?.home_team?.name && effective?.away_team?.name)
            },
            warnings: contextWarnings
        });
    }

    return {
        ok: Boolean(currentResp?.ok),
        disabled: false,
        provider: PROVIDER,
        currentGamesNormalizedCount: games.length,
        selectedGameIds: selected.map((g) => g.provider_game_id),
        contexts,
        rateLimit: currentResp?.rateLimit || null,
        sourceEndpoint: '/games/current',
        callBudgetRemaining: callBudget,
        warnings
    };
}

module.exports = {
    isSportsApiProFootballEnabled,
    fetchCurrentFootballGames,
    fetchGameDetail,
    fetchGameStats,
    fetchSquadsForCompetitors,
    buildFootballGameContext,
    discoverAndBuildSampleContexts
};
