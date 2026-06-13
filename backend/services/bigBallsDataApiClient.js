'use strict';

const axios = require('axios');
const config = require('../config');

const DEFAULT_BASE_URL = 'https://api.bigballsports.com';
const LEGACY_BASE_URL = 'https://api.bigballsdata.com';
const FALLBACK_BASE_URL = 'https://bbsgateway-production.up.railway.app';

// BSD pagination contract — exceeding 200 causes HTTP 400
const BSD_MAX_LIMIT = 200;
const BSD_DEFAULT_LIMIT = 50;
const BSD_MAX_PAGES = 20; // safety ceiling for paginated retrieval

function clampLimit(n) {
    return Math.min(Math.max(1, Number(n) || BSD_DEFAULT_LIMIT), BSD_MAX_LIMIT);
}

function getBaseUrl() {
    const configured = String(
        config.bigBallsBaseUrl
        || process.env.BIG_BALLS_BASE_URL
        || ''
    ).trim().replace(/\/$/, '');
    return configured || DEFAULT_BASE_URL;
}

function getBaseUrlCandidates() {
    const configured = getBaseUrl();
    const chain = [configured, LEGACY_BASE_URL, FALLBACK_BASE_URL];
    return [...new Set(chain.filter(Boolean))];
}

function isBigBallsDataEnabled() {
    return String(process.env.ENABLE_BIG_BALLS_DATA_PROVIDER || '').trim() === 'true';
}

function getApiKey() {
    return String(
        config.bigBallsDataApiKey
        || process.env.BIG_BALLS_DATA_API_KEY
        || process.env.BBS_API_KEY
        || ''
    ).trim();
}

function buildHeaders() {
    const key = getApiKey();
    if (!key) return {};
    return { Authorization: `Bearer ${key}` };
}

function extractRateHeaders(headers = {}) {
    return {
        limit_minute: headers['x-ratelimit-limit-minute'] || null,
        remaining_minute: headers['x-ratelimit-remaining-minute'] || null,
        limit_day: headers['x-ratelimit-limit-day'] || null,
        remaining_day: headers['x-ratelimit-remaining-day'] || null,
        reset: headers['x-ratelimit-reset'] || null
    };
}

async function request(path, params = {}, options = {}) {
    const started = Date.now();
    const bases = options.baseUrl ? [options.baseUrl] : getBaseUrlCandidates();

    if (!isBigBallsDataEnabled()) {
        return {
            ok: false,
            disabled: true,
            reason: 'ENABLE_BIG_BALLS_DATA_PROVIDER is not true',
            data: null,
            latency_ms: 0
        };
    }

    const key = getApiKey();
    if (!key) {
        return {
            ok: false,
            disabled: true,
            reason: 'BIG_BALLS_DATA_API_KEY is missing',
            data: null,
            latency_ms: 0
        };
    }

    let lastResult = null;
    for (const baseUrl of bases) {
        const url = `${baseUrl}${path}`;
        try {
            const response = await axios.get(url, {
                headers: buildHeaders(),
                params,
                timeout: options.timeout || 20000,
                validateStatus: () => true
            });

            const envelope = response.data && typeof response.data === 'object' ? response.data : {};
            const ok = response.status >= 200 && response.status < 300 && !envelope.error;
            const result = {
                ok,
                disabled: false,
                status: response.status,
                latency_ms: Date.now() - started,
                base_url_used: baseUrl,
                rate: extractRateHeaders(response.headers),
                meta: envelope.meta || null,
                error: envelope.error || null,
                data: envelope.data ?? null
            };

            if (ok || (response.status >= 400 && response.status < 500)) {
                return result;
            }
            lastResult = result;
        } catch (error) {
            lastResult = {
                ok: false,
                disabled: false,
                status: 0,
                latency_ms: Date.now() - started,
                base_url_used: baseUrl,
                reason: error.code || error.message,
                data: null
            };
        }
    }

    return lastResult || {
        ok: false,
        disabled: false,
        status: 0,
        latency_ms: Date.now() - started,
        reason: 'All Big Balls base URLs failed',
        data: null
    };
}

async function listSports() {
    return request('/v1/sports');
}

async function listLeagues(params = {}) {
    return request('/v1/leagues', params);
}

async function getLeague(id, params = {}) {
    return request(`/v1/leagues/${encodeURIComponent(id)}`, params);
}

async function listMatches(params = {}) {
    return request('/v1/matches', { ...params, limit: clampLimit(params.limit) });
}

async function getMatch(id, params = {}) {
    return request(`/v1/matches/${encodeURIComponent(id)}`, params);
}

async function getMatchOdds(id, params = {}) {
    return request(`/v1/matches/${encodeURIComponent(id)}/odds`, params);
}

async function getStandings(params = {}) {
    return request('/v1/standings', params);
}

async function listStoredMatches(params = {}) {
    return request('/v1/stored/matches', { ...params, limit: clampLimit(params.limit) });
}

async function getStoredMatch(id, params = {}) {
    return request(`/v1/stored/matches/${encodeURIComponent(id)}`, params);
}

function unwrapFieldBundle(data, fieldName) {
    if (!data || typeof data !== 'object') return null;
    if (fieldName && data[fieldName] && typeof data[fieldName] === 'object') {
        return data[fieldName].value ?? data[fieldName];
    }
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.value)) return data.value;
    if (Array.isArray(data.scores?.value)) return data.scores.value;
    return null;
}

/**
 * Paginated bulk retrieval — iterates pages until a page returns fewer than
 * `limit` rows or the safety ceiling is reached.
 *
 * @param {string} path - API path (e.g. '/v1/matches')
 * @param {object} params - Query params (must include sport or league)
 * @param {object} [options] - Passed through to request()
 * @returns {Promise<{ok: boolean, pages: number, allData: Array, lastResult: object}>}
 */
async function requestAllPages(path, params = {}, options = {}) {
    const limit = clampLimit(params.limit);
    const allData = [];
    let page = 1;
    let lastResult = null;

    while (page <= BSD_MAX_PAGES) {
        const pageParams = { ...params, limit, page };
        const result = await request(path, pageParams, options);
        lastResult = result;

        if (!result.ok) break;

        const batch = Array.isArray(result.data) ? result.data : [];
        allData.push(...batch);

        // Fewer than limit means this is the last page
        if (batch.length < limit) break;
        page += 1;
    }

    return {
        ok: allData.length > 0 || (lastResult && lastResult.ok),
        pages: page,
        allData,
        lastResult
    };
}

module.exports = {
    BSD_DEFAULT_LIMIT,
    BSD_MAX_LIMIT,
    BSD_MAX_PAGES,
    DEFAULT_BASE_URL,
    FALLBACK_BASE_URL,
    LEGACY_BASE_URL,
    clampLimit,
    getBaseUrl,
    getBaseUrlCandidates,
    getApiKey,
    getLeague,
    getMatch,
    getMatchOdds,
    getStandings,
    getStoredMatch,
    isBigBallsDataEnabled,
    listLeagues,
    listMatches,
    listSports,
    listStoredMatches,
    request,
    requestAllPages,
    unwrapFieldBundle
};
