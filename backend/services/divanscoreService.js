'use strict';

const axios = require('axios');

const ENDPOINT = 'teams/get-rankings';

const usageState = {
    dayKey: null,
    usedToday: 0
};

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

function getDivanscoreConfig() {
    const host = String(process.env.DIVANSCORE_RAPIDAPI_HOST || '').trim();
    const baseUrlRaw = String(process.env.DIVANSCORE_BASE_URL || '').trim();
    const baseUrl = baseUrlRaw.replace(/\/+$/, '');
    const apiKey = String(process.env.DIVANSCORE_RAPIDAPI_KEY || '').trim();
    const dailyLimit = toPositiveInt(process.env.DIVANSCORE_DAILY_LIMIT, 10);
    const timeoutMs = toPositiveInt(process.env.DIVANSCORE_TIMEOUT_MS, 8000);
    const enabled = Boolean(apiKey && host && baseUrl);

    return {
        enabled,
        host,
        baseUrl,
        apiKeyPresent: Boolean(apiKey),
        dailyLimit,
        timeoutMs
    };
}

function canUseDivanscore() {
    const config = getDivanscoreConfig();
    if (!config.enabled) return false;
    ensureUsageWindow();
    return usageState.usedToday < config.dailyLimit;
}

function normalizeTeamId(teamId) {
    if (teamId === null || teamId === undefined) return null;
    if (typeof teamId === 'number' && Number.isFinite(teamId)) {
        return String(Math.floor(teamId));
    }
    const value = String(teamId).trim();
    if (!/^\d+$/.test(value)) return null;
    return value;
}

function toNumberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function firstNonEmptyString(values) {
    for (const value of values) {
        const text = String(value || '').trim();
        if (text) return text;
    }
    return null;
}

function normalizeDivanscoreTeamRankings(raw, teamId) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const data = source.data && typeof source.data === 'object' ? source.data : null;

    const candidateObjects = [
        source,
        data,
        source.team,
        source.rankings,
        source.tournament,
        data?.team,
        data?.rankings,
        data?.tournament
    ].filter((item) => item && typeof item === 'object');

    const dataArray = Array.isArray(source.data) ? source.data : [];
    const rankingsArray = Array.isArray(source.rankings) ? source.rankings : [];
    const nestedArrayItem = [dataArray[0], rankingsArray[0]].find((v) => v && typeof v === 'object') || null;
    if (nestedArrayItem) candidateObjects.push(nestedArrayItem);

    const pick = (...keys) => {
        for (const obj of candidateObjects) {
            for (const key of keys) {
                if (obj[key] !== undefined && obj[key] !== null) return obj[key];
            }
        }
        return null;
    };

    const rank = toNumberOrNull(pick('rank', 'position', 'place', 'standing', 'ranking'));
    const rankingName = firstNonEmptyString([
        pick('ranking_name', 'rankingName', 'name', 'title')
    ]);
    const tournamentName = firstNonEmptyString([
        pick('tournament_name', 'tournamentName', 'league_name', 'leagueName', 'competition_name', 'competitionName')
    ]);
    const categoryName = firstNonEmptyString([
        pick('category_name', 'categoryName', 'group_name', 'groupName', 'sport')
    ]);
    const points = toNumberOrNull(pick('points', 'pts', 'score'));

    const rankingAvailable = Number.isFinite(rank)
        || Boolean(rankingName)
        || Boolean(tournamentName)
        || Boolean(categoryName)
        || Number.isFinite(points);

    const rawCompact = {
        status: source.status ?? null,
        message: firstNonEmptyString([source.message, source.error, source.detail]),
        data_type: Array.isArray(source.data) ? 'array' : typeof source.data,
        has_rankings_array: Array.isArray(source.rankings),
        top_level_keys: Object.keys(source).slice(0, 12)
    };

    return {
        team_id: String(teamId),
        provider: 'divanscore',
        ranking_available: rankingAvailable,
        rank,
        ranking_name: rankingName,
        tournament_name: tournamentName,
        category_name: categoryName,
        points,
        raw_compact: rawCompact
    };
}

function mapHttpFailureReason(status) {
    if (status === 401) return 'unauthorized';
    if (status === 403) return 'forbidden';
    if (status === 429) return 'rate_limited';
    if (status >= 500) return 'upstream_error';
    return `http_${status}`;
}

async function fetchTeamRankingsFallback(teamId, options = {}) {
    const normalizedTeamId = normalizeTeamId(teamId);
    if (!normalizedTeamId) {
        console.log('[DIVANSCORE] skipped: missing_team_id');
        return {
            ok: false,
            skipped: true,
            reason: 'missing_team_id',
            data: null
        };
    }

    const config = getDivanscoreConfig();
    if (!config.enabled) {
        console.log('[DIVANSCORE] skipped: divanscore_disabled');
        return {
            ok: false,
            skipped: true,
            reason: 'divanscore_disabled',
            data: null
        };
    }

    ensureUsageWindow();
    if (usageState.usedToday >= config.dailyLimit) {
        console.log('[DIVANSCORE] skipped: daily_budget_reached');
        return {
            ok: false,
            skipped: true,
            reason: 'daily_budget_reached',
            data: null
        };
    }

    const timeoutMs = toPositiveInt(options.timeoutMs, config.timeoutMs);
    const url = `${config.baseUrl}/${ENDPOINT}?teamId=${encodeURIComponent(normalizedTeamId)}`;

    usageState.usedToday += 1;
    console.log(`[DIVANSCORE] request: endpoint=${ENDPOINT} teamId=${normalizedTeamId}`);

    try {
        const response = await axios.get(url, {
            timeout: timeoutMs,
            validateStatus: () => true,
            headers: {
                'Content-Type': 'application/json',
                'x-rapidapi-host': config.host,
                'x-rapidapi-key': String(process.env.DIVANSCORE_RAPIDAPI_KEY || '').trim()
            }
        });

        if (!response || typeof response !== 'object') {
            console.log(`[DIVANSCORE] failed: endpoint=${ENDPOINT} teamId=${normalizedTeamId} reason=invalid_response`);
            return {
                ok: false,
                skipped: false,
                reason: 'invalid_response',
                source: 'divanscore',
                endpoint: ENDPOINT,
                teamId: normalizedTeamId,
                data: null
            };
        }

        if (response.status < 200 || response.status >= 300) {
            const reason = mapHttpFailureReason(response.status);
            console.log(`[DIVANSCORE] failed: endpoint=${ENDPOINT} teamId=${normalizedTeamId} reason=${reason}`);
            return {
                ok: false,
                skipped: false,
                reason,
                source: 'divanscore',
                endpoint: ENDPOINT,
                teamId: normalizedTeamId,
                data: null
            };
        }

        const raw = response.data;
        if (!raw || typeof raw !== 'object') {
            console.log(`[DIVANSCORE] failed: endpoint=${ENDPOINT} teamId=${normalizedTeamId} reason=invalid_json`);
            return {
                ok: false,
                skipped: false,
                reason: 'invalid_json',
                source: 'divanscore',
                endpoint: ENDPOINT,
                teamId: normalizedTeamId,
                data: null
            };
        }

        const normalized = normalizeDivanscoreTeamRankings(raw, normalizedTeamId);
        if (!normalized.ranking_available) {
            console.log(`[DIVANSCORE] failed: endpoint=${ENDPOINT} teamId=${normalizedTeamId} reason=empty_result`);
            return {
                ok: false,
                skipped: false,
                reason: 'empty_result',
                source: 'divanscore',
                endpoint: ENDPOINT,
                teamId: normalizedTeamId,
                data: null
            };
        }

        console.log(`[DIVANSCORE] success: endpoint=${ENDPOINT} teamId=${normalizedTeamId}`);
        return {
            ok: true,
            skipped: false,
            reason: null,
            source: 'divanscore',
            endpoint: ENDPOINT,
            teamId: normalizedTeamId,
            raw,
            data: normalized
        };
    } catch (error) {
        const code = String(error?.code || '').toUpperCase();
        const reason = code.includes('TIMEOUT') || code === 'ECONNABORTED'
            ? 'timeout'
            : 'request_failed';
        console.log(`[DIVANSCORE] failed: endpoint=${ENDPOINT} teamId=${normalizedTeamId} reason=${reason}`);
        return {
            ok: false,
            skipped: false,
            reason,
            source: 'divanscore',
            endpoint: ENDPOINT,
            teamId: normalizedTeamId,
            data: null
        };
    }
}

function getDivanscoreUsageState() {
    ensureUsageWindow();
    const { dailyLimit } = getDivanscoreConfig();
    const remainingToday = Math.max(0, dailyLimit - usageState.usedToday);
    return {
        usedToday: usageState.usedToday,
        dailyLimit,
        remainingToday
    };
}

function resetDivanscoreUsageForTests() {
    usageState.dayKey = getDayKey();
    usageState.usedToday = 0;
}

module.exports = {
    getDivanscoreConfig,
    canUseDivanscore,
    fetchTeamRankingsFallback,
    normalizeDivanscoreTeamRankings,
    getDivanscoreUsageState,
    resetDivanscoreUsageForTests
};
