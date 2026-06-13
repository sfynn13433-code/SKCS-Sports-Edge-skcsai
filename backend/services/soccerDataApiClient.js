'use strict';

const axios = require('axios');
const config = require('../config');

const DEFAULT_BASE_URL = 'https://api.soccerdataapi.com';

const callStats = {
    total: 0,
    lastResetAt: new Date().toISOString(),
    lastHeaders: null,
    lastDetail: null
};

function getBaseUrl() {
    return String(
        config.soccerDataBaseUrl
        || process.env.SOCCER_DATA_BASE_URL
        || DEFAULT_BASE_URL
    ).trim().replace(/\/$/, '');
}

function isSoccerDataApiEnabled() {
    return String(process.env.ENABLE_SOCCER_DATA_API || '').trim() === 'true';
}

function getApiToken() {
    return String(
        config.soccerDataApiKey
        || process.env.SOCCER_DATA_API_KEY
        || process.env.SOCCERDATA_API_TOKEN
        || ''
    ).trim();
}

function getCallStats() {
    return { ...callStats };
}

function resetCallStats() {
    callStats.total = 0;
    callStats.lastResetAt = new Date().toISOString();
    callStats.lastHeaders = null;
    callStats.lastDetail = null;
}

function extractRateHints(headers = {}) {
    const normalized = {};
    for (const [key, value] of Object.entries(headers)) {
        const lower = String(key).toLowerCase();
        if (
            lower.includes('rate')
            || lower.includes('limit')
            || lower.includes('remaining')
            || lower.includes('retry')
        ) {
            normalized[lower] = value;
        }
    }
    return normalized;
}

async function request(path, params = {}, options = {}) {
    const maxCalls = Number(options.maxCalls);
    if (Number.isFinite(maxCalls) && maxCalls > 0 && callStats.total >= maxCalls) {
        return {
            ok: false,
            budget_exceeded: true,
            reason: `call_budget_exceeded (${callStats.total}/${maxCalls})`,
            data: null,
            calls_used: callStats.total
        };
    }

    if (!isSoccerDataApiEnabled()) {
        return {
            ok: false,
            disabled: true,
            reason: 'ENABLE_SOCCER_DATA_API is not true',
            data: null
        };
    }

    const token = getApiToken();
    if (!token) {
        return {
            ok: false,
            disabled: true,
            reason: 'SOCCER_DATA_API_KEY is missing',
            data: null
        };
    }

    const started = Date.now();
    const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
    const query = {
        ...params,
        auth_token: params.auth_token || token
    };

    try {
        const response = await axios.get(url, {
            params: query,
            timeout: options.timeout || 20000,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'Accept-Encoding': 'gzip'
            },
            decompress: true,
            validateStatus: () => true
        });

        callStats.total += 1;
        callStats.lastHeaders = extractRateHints(response.headers || {});

        const body = response.data && typeof response.data === 'object' ? response.data : {};
        const detail = typeof body.detail === 'string' ? body.detail : null;
        const throttled = detail && /throttl/i.test(detail);
        const invalidToken = detail && /invalid token/i.test(detail);
        const ok = response.status >= 200 && response.status < 300 && !detail;

        callStats.lastDetail = detail;

        return {
            ok,
            throttled,
            invalid_token: invalidToken,
            status: response.status,
            latency_ms: Date.now() - started,
            detail,
            rate: callStats.lastHeaders,
            data: body,
            calls_used: callStats.total
        };
    } catch (error) {
        callStats.total += 1;
        return {
            ok: false,
            status: 0,
            latency_ms: Date.now() - started,
            reason: error.code || error.message,
            data: null,
            calls_used: callStats.total
        };
    }
}

function listMatches(params = {}, options = {}) {
    return request('/matches/', params, options);
}

function getMatch(matchId, options = {}) {
    return request('/match/', { match_id: matchId }, options);
}

function listLiveScores(options = {}) {
    return request('/livescores/', {}, options);
}

function listStandings(leagueId, options = {}) {
    return request('/standing/', { league_id: leagueId }, options);
}

function listLeagues(params = {}, options = {}) {
    return request('/league/', params, options);
}

function listCountries(options = {}) {
    return request('/country/', {}, options);
}

module.exports = {
    getBaseUrl,
    isSoccerDataApiEnabled,
    getApiToken,
    getCallStats,
    resetCallStats,
    request,
    listMatches,
    getMatch,
    listLiveScores,
    listStandings,
    listLeagues,
    listCountries
};
