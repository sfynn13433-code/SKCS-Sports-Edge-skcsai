'use strict';

const axios = require('axios');

const ENDPOINT = 'head-2-head';

const usageState = {
    dayKey: null,
    usedToday: 0
};

const h2hCache = new Map();

function getDayKey() {
    return new Date().toISOString().slice(0, 10);
}

function ensureUsageWindow() {
    const dayKey = getDayKey();
    if (usageState.dayKey !== dayKey) {
        usageState.dayKey = dayKey;
        usageState.usedToday = 0;
    }
}

function toPositiveInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.floor(n));
}

function normalizeTeamId(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return String(Math.floor(value));
    const text = String(value || '').trim();
    if (!/^\d+$/.test(text)) return null;
    return text;
}

function buildCacheKey(teamIdOne, teamIdTwo) {
    const a = String(teamIdOne);
    const b = String(teamIdTwo);
    return [a, b].sort().join(':');
}

function parseScorePair(input) {
    if (typeof input === 'string') {
        const m = input.match(/(-?\d+)\s*-\s*(-?\d+)/);
        if (!m) return { homeScore: null, awayScore: null };
        return { homeScore: Number(m[1]), awayScore: Number(m[2]) };
    }
    if (input && typeof input === 'object') {
        const home = Number(input.home ?? input.homeScore ?? input.home_score ?? input.h);
        const away = Number(input.away ?? input.awayScore ?? input.away_score ?? input.a);
        return {
            homeScore: Number.isFinite(home) ? home : null,
            awayScore: Number.isFinite(away) ? away : null
        };
    }
    return { homeScore: null, awayScore: null };
}

function parseDateValue(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const ms = Date.parse(text);
    if (!Number.isFinite(ms)) return text;
    return new Date(ms).toISOString();
}

function getFootballHighlightsConfig() {
    const host = String(process.env.FOOTBALL_HIGHLIGHTS_RAPIDAPI_HOST || '').trim();
    const baseUrlRaw = String(process.env.FOOTBALL_HIGHLIGHTS_BASE_URL || '').trim();
    const baseUrl = baseUrlRaw.replace(/\/+$/, '');
    const apiKey = String(process.env.FOOTBALL_HIGHLIGHTS_RAPIDAPI_KEY || '').trim();
    const dailyLimit = toPositiveInt(process.env.FOOTBALL_HIGHLIGHTS_DAILY_LIMIT, 60);
    const timeoutMs = toPositiveInt(process.env.FOOTBALL_HIGHLIGHTS_TIMEOUT_MS, 8000);
    const enabled = Boolean(host && baseUrl && apiKey);

    return {
        enabled,
        host,
        baseUrl,
        apiKeyPresent: Boolean(apiKey),
        dailyLimit,
        timeoutMs
    };
}

function canUseFootballHighlights() {
    const config = getFootballHighlightsConfig();
    if (!config.enabled) return false;
    ensureUsageWindow();
    return usageState.usedToday < config.dailyLimit;
}

function firstNonEmptyString(values) {
    for (const value of values) {
        const text = String(value || '').trim();
        if (text) return text;
    }
    return null;
}

function toNumberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function isCompletedStatus(value) {
    const status = String(value || '').trim().toLowerCase();
    if (!status) return false;
    return status.includes('finished')
        || status.includes('full')
        || status === 'ft'
        || status === 'aet'
        || status === 'pen';
}

function resolveArrayFromRaw(raw) {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== 'object') return [];
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.matches)) return raw.matches;
    if (Array.isArray(raw.events)) return raw.events;
    if (Array.isArray(raw.results)) return raw.results;
    return [];
}

function normalizeHeadToHeadMatches(raw, teamIdOne, teamIdTwo) {
    const t1 = String(teamIdOne);
    const t2 = String(teamIdTwo);
    const matches = resolveArrayFromRaw(raw);

    const normalizedMatches = matches.map((match) => {
        const source = match && typeof match === 'object' ? match : {};
        const homeTeam = source.homeTeam || source.home_team || source.teams?.home || {};
        const awayTeam = source.awayTeam || source.away_team || source.teams?.away || {};
        const homeTeamId = String(
            homeTeam.id
            ?? source.homeTeamId
            ?? source.home_team_id
            ?? source.teams?.home?.id
            ?? ''
        ).trim() || null;
        const awayTeamId = String(
            awayTeam.id
            ?? source.awayTeamId
            ?? source.away_team_id
            ?? source.teams?.away?.id
            ?? ''
        ).trim() || null;

        const state = source.state && typeof source.state === 'object' ? source.state : {};
        const scoreSource = state.score?.current
            ?? source.score?.current
            ?? source.score
            ?? source.result
            ?? null;
        const score = parseScorePair(scoreSource);
        const totalGoals = Number.isFinite(score.homeScore) && Number.isFinite(score.awayScore)
            ? score.homeScore + score.awayScore
            : null;

        let winnerTeamId = null;
        let isDraw = false;
        if (Number.isFinite(score.homeScore) && Number.isFinite(score.awayScore)) {
            if (score.homeScore > score.awayScore) winnerTeamId = homeTeamId;
            else if (score.awayScore > score.homeScore) winnerTeamId = awayTeamId;
            else isDraw = true;
        }

        const status = firstNonEmptyString([
            source.status,
            source.state?.status,
            source.state?.type,
            source.state?.description
        ]);
        const completed = isCompletedStatus(status) || (Number.isFinite(score.homeScore) && Number.isFinite(score.awayScore));

        return {
            match_id: firstNonEmptyString([source.id, source.matchId, source.fixtureId]),
            date: parseDateValue(firstNonEmptyString([source.startingAt, source.date, source.kickoff, source.time])),
            season: firstNonEmptyString([
                source.season?.name,
                source.season?.id,
                source.seasonName,
                source.seasonId
            ]),
            country_name: firstNonEmptyString([
                source.country?.name,
                source.tournament?.category?.country?.name
            ]),
            league_id: firstNonEmptyString([
                source.tournament?.id,
                source.uniqueTournament?.id,
                source.league?.id
            ]),
            league_name: firstNonEmptyString([
                source.tournament?.name,
                source.uniqueTournament?.name,
                source.league?.name
            ]),
            round: firstNonEmptyString([
                source.roundInfo?.round,
                source.roundInfo?.name,
                source.round
            ]),
            home_team_id: homeTeamId,
            home_team_name: firstNonEmptyString([homeTeam.name, source.homeTeamName, source.home_team_name]),
            away_team_id: awayTeamId,
            away_team_name: firstNonEmptyString([awayTeam.name, source.awayTeamName, source.away_team_name]),
            home_score: score.homeScore,
            away_score: score.awayScore,
            total_goals: totalGoals,
            winner_team_id: winnerTeamId,
            is_draw: isDraw,
            status: status || null,
            _completed: completed
        };
    });

    const completedMatches = normalizedMatches.filter((m) => m._completed);
    let teamOneWins = 0;
    let teamTwoWins = 0;
    let draws = 0;
    let totalGoalsSum = 0;
    let withGoals = 0;
    let bttsCount = 0;
    let over15Count = 0;
    let over25Count = 0;

    for (const match of completedMatches) {
        if (match.winner_team_id === t1) teamOneWins += 1;
        else if (match.winner_team_id === t2) teamTwoWins += 1;
        else if (match.is_draw) draws += 1;

        if (Number.isFinite(match.total_goals)) {
            totalGoalsSum += match.total_goals;
            withGoals += 1;
            if (match.total_goals > 1.5) over15Count += 1;
            if (match.total_goals > 2.5) over25Count += 1;
        }

        if (Number.isFinite(match.home_score) && Number.isFinite(match.away_score)
            && match.home_score >= 1 && match.away_score >= 1) {
            bttsCount += 1;
        }
    }

    const edgeDiff = teamOneWins - teamTwoWins;
    let h2hEdgeTeamId = null;
    let h2hEdgeLabel = 'INSUFFICIENT_DATA';
    if (completedMatches.length >= 3) {
        if (edgeDiff >= 2) {
            h2hEdgeTeamId = t1;
            h2hEdgeLabel = 'TEAM_ONE_EDGE';
        } else if (edgeDiff <= -2) {
            h2hEdgeTeamId = t2;
            h2hEdgeLabel = 'TEAM_TWO_EDGE';
        } else {
            h2hEdgeLabel = 'BALANCED';
        }
    }

    const latest = completedMatches
        .slice()
        .sort((a, b) => Date.parse(b.date || '') - Date.parse(a.date || ''))
        .find(Boolean) || null;

    return {
        provider: 'football_highlights',
        endpoint: ENDPOINT,
        team_id_one: t1,
        team_id_two: t2,
        matches_available: normalizedMatches.length > 0,
        match_count: normalizedMatches.length,
        completed_match_count: completedMatches.length,
        recent_matches: normalizedMatches
            .slice()
            .sort((a, b) => Date.parse(b.date || '') - Date.parse(a.date || ''))
            .slice(0, 10)
            .map(({ _completed, ...safe }) => safe),
        summary: {
            team_one_wins: teamOneWins,
            team_two_wins: teamTwoWins,
            draws,
            avg_total_goals: withGoals > 0 ? Math.round((totalGoalsSum / withGoals) * 100) / 100 : null,
            btts_count: bttsCount,
            over_1_5_count: over15Count,
            over_2_5_count: over25Count,
            latest_result: latest
                ? {
                    match_id: latest.match_id,
                    date: latest.date,
                    home_team_id: latest.home_team_id,
                    away_team_id: latest.away_team_id,
                    home_score: latest.home_score,
                    away_score: latest.away_score,
                    winner_team_id: latest.winner_team_id,
                    is_draw: latest.is_draw
                }
                : null,
            h2h_edge_team_id: h2hEdgeTeamId,
            h2h_edge_label: h2hEdgeLabel
        }
    };
}

function mapHttpFailureReason(statusCode) {
    if (statusCode === 401) return 'unauthorized';
    if (statusCode === 403) return 'forbidden';
    if (statusCode === 429) return 'rate_limited';
    if (statusCode >= 500) return 'upstream_error';
    return `http_${statusCode}`;
}

async function fetchHeadToHeadFallback(teamIdOne, teamIdTwo, options = {}) {
    const t1 = normalizeTeamId(teamIdOne);
    const t2 = normalizeTeamId(teamIdTwo);
    if (!t1 || !t2) {
        console.log('[FOOTBALL_HIGHLIGHTS] skipped: missing_team_id');
        return {
            ok: false,
            skipped: true,
            reason: 'missing_team_id',
            data: null
        };
    }

    if (t1 === t2) {
        console.log('[FOOTBALL_HIGHLIGHTS] skipped: same_team_id');
        return {
            ok: false,
            skipped: true,
            reason: 'same_team_id',
            data: null
        };
    }

    const config = getFootballHighlightsConfig();
    if (!config.enabled) {
        console.log('[FOOTBALL_HIGHLIGHTS] skipped: football_highlights_disabled');
        return {
            ok: false,
            skipped: true,
            reason: 'football_highlights_disabled',
            data: null
        };
    }

    const cacheKey = buildCacheKey(t1, t2);
    if (!options.forceRefresh && h2hCache.has(cacheKey)) {
        const cached = h2hCache.get(cacheKey);
        return {
            ok: true,
            skipped: false,
            reason: null,
            source: 'football_highlights',
            endpoint: ENDPOINT,
            teamIdOne: t1,
            teamIdTwo: t2,
            raw: cached.raw,
            data: cached.data
        };
    }

    ensureUsageWindow();
    if (usageState.usedToday >= config.dailyLimit) {
        console.log('[FOOTBALL_HIGHLIGHTS] skipped: daily_budget_reached');
        return {
            ok: false,
            skipped: true,
            reason: 'daily_budget_reached',
            data: null
        };
    }

    const timeoutMs = toPositiveInt(options.timeoutMs, config.timeoutMs);
    const url = `${config.baseUrl}/${ENDPOINT}?teamIdOne=${encodeURIComponent(t1)}&teamIdTwo=${encodeURIComponent(t2)}`;

    usageState.usedToday += 1;
    console.log(`[FOOTBALL_HIGHLIGHTS] request: endpoint=${ENDPOINT} teamIdOne=${t1} teamIdTwo=${t2}`);

    try {
        const response = await axios.get(url, {
            timeout: timeoutMs,
            validateStatus: () => true,
            headers: {
                'Content-Type': 'application/json',
                'x-rapidapi-host': config.host,
                'x-rapidapi-key': String(process.env.FOOTBALL_HIGHLIGHTS_RAPIDAPI_KEY || '').trim()
            }
        });

        if (!response || typeof response !== 'object') {
            console.log(`[FOOTBALL_HIGHLIGHTS] failed: endpoint=${ENDPOINT} teamIdOne=${t1} teamIdTwo=${t2} reason=invalid_response`);
            return {
                ok: false,
                skipped: false,
                reason: 'invalid_response',
                source: 'football_highlights',
                endpoint: ENDPOINT,
                teamIdOne: t1,
                teamIdTwo: t2,
                data: null
            };
        }

        if (response.status < 200 || response.status >= 300) {
            const reason = mapHttpFailureReason(response.status);
            console.log(`[FOOTBALL_HIGHLIGHTS] failed: endpoint=${ENDPOINT} teamIdOne=${t1} teamIdTwo=${t2} reason=${reason}`);
            return {
                ok: false,
                skipped: false,
                reason,
                source: 'football_highlights',
                endpoint: ENDPOINT,
                teamIdOne: t1,
                teamIdTwo: t2,
                data: null
            };
        }

        const raw = response.data;
        if (!raw || (typeof raw !== 'object' && !Array.isArray(raw))) {
            console.log(`[FOOTBALL_HIGHLIGHTS] failed: endpoint=${ENDPOINT} teamIdOne=${t1} teamIdTwo=${t2} reason=invalid_json`);
            return {
                ok: false,
                skipped: false,
                reason: 'invalid_json',
                source: 'football_highlights',
                endpoint: ENDPOINT,
                teamIdOne: t1,
                teamIdTwo: t2,
                data: null
            };
        }

        const normalized = normalizeHeadToHeadMatches(raw, t1, t2);
        if (!normalized.matches_available || normalized.match_count === 0) {
            console.log(`[FOOTBALL_HIGHLIGHTS] failed: endpoint=${ENDPOINT} teamIdOne=${t1} teamIdTwo=${t2} reason=empty_result`);
            return {
                ok: false,
                skipped: false,
                reason: 'empty_result',
                source: 'football_highlights',
                endpoint: ENDPOINT,
                teamIdOne: t1,
                teamIdTwo: t2,
                data: null
            };
        }

        h2hCache.set(cacheKey, { raw, data: normalized });
        console.log(`[FOOTBALL_HIGHLIGHTS] success: endpoint=${ENDPOINT} teamIdOne=${t1} teamIdTwo=${t2}`);
        return {
            ok: true,
            skipped: false,
            reason: null,
            source: 'football_highlights',
            endpoint: ENDPOINT,
            teamIdOne: t1,
            teamIdTwo: t2,
            raw,
            data: normalized
        };
    } catch (error) {
        const code = String(error?.code || '').toUpperCase();
        const reason = code.includes('TIMEOUT') || code === 'ECONNABORTED'
            ? 'timeout'
            : 'request_failed';
        console.log(`[FOOTBALL_HIGHLIGHTS] failed: endpoint=${ENDPOINT} teamIdOne=${t1} teamIdTwo=${t2} reason=${reason}`);
        return {
            ok: false,
            skipped: false,
            reason,
            source: 'football_highlights',
            endpoint: ENDPOINT,
            teamIdOne: t1,
            teamIdTwo: t2,
            data: null
        };
    }
}

function getFootballHighlightsUsageState() {
    ensureUsageWindow();
    const config = getFootballHighlightsConfig();
    return {
        usedToday: usageState.usedToday,
        dailyLimit: config.dailyLimit,
        remainingToday: Math.max(0, config.dailyLimit - usageState.usedToday)
    };
}

function resetFootballHighlightsUsageForTests() {
    usageState.dayKey = getDayKey();
    usageState.usedToday = 0;
    h2hCache.clear();
}

module.exports = {
    getFootballHighlightsConfig,
    canUseFootballHighlights,
    fetchHeadToHeadFallback,
    normalizeHeadToHeadMatches,
    getFootballHighlightsUsageState,
    resetFootballHighlightsUsageForTests
};
