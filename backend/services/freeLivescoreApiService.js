'use strict';

const axios = require('axios');

const PROVIDER = 'free_livescore_api';
const ENDPOINT = '/livescore-get-search';
const DEFAULT_HOST = 'free-livescore-api.p.rapidapi.com';
const DEFAULT_TIMEOUT_MS = 15000;

function getFreeLivescoreConfig() {
    const host = String(process.env.FREE_LIVESCORE_RAPIDAPI_HOST || DEFAULT_HOST).trim() || DEFAULT_HOST;
    const key = String(
        process.env.FREE_LIVESCORE_RAPIDAPI_KEY
        || process.env.X_RAPIDAPI_KEY
        || process.env.RAPIDAPI_KEY
        || ''
    ).trim();

    return {
        host,
        key,
        apiKeyPresent: Boolean(key)
    };
}

function extractRateLimitHeaders(headers) {
    const source = headers && typeof headers === 'object' ? headers : {};
    const getHeader = (name) => {
        const value = source[name] ?? source[String(name).toLowerCase()];
        if (value === undefined || value === null || value === '') return null;
        return String(value);
    };

    const requestsLimit = getHeader('x-ratelimit-requests-limit');
    const requestsRemaining = getHeader('x-ratelimit-requests-remaining');
    const requestsReset = getHeader('x-ratelimit-requests-reset');
    const rapidFreeHardLimitLimit = getHeader('x-ratelimit-rapid-free-plans-hard-limit-limit');
    const rapidFreeHardLimitRemaining = getHeader('x-ratelimit-rapid-free-plans-hard-limit-remaining');
    const rapidFreeHardLimitReset = getHeader('x-ratelimit-rapid-free-plans-hard-limit-reset');

    return {
        requests_limit: requestsLimit,
        requests_remaining: requestsRemaining,
        requests_reset: requestsReset,
        rapid_free_hard_limit_limit: rapidFreeHardLimitLimit,
        rapid_free_hard_limit_remaining: rapidFreeHardLimitRemaining,
        rapid_free_hard_limit_reset: rapidFreeHardLimitReset,
        requestsLimit,
        requestsRemaining,
        requestsReset,
        rapidFreeHardLimitLimit,
        rapidFreeHardLimitRemaining,
        rapidFreeHardLimitReset
    };
}

async function fetchFreeLivescoreEndpoint(endpoint, params = {}, options = {}) {
    const { host, key, apiKeyPresent } = getFreeLivescoreConfig();
    const safeEndpoint = String(endpoint || '').trim();
    const safeParams = params && typeof params === 'object' ? params : {};
    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) && Number(options.timeoutMs) > 0
        ? Number(options.timeoutMs)
        : DEFAULT_TIMEOUT_MS;

    if (!safeEndpoint || !safeEndpoint.startsWith('/')) {
        return {
            ok: false,
            provider: PROVIDER,
            endpoint: safeEndpoint || null,
            status: null,
            params: safeParams,
            data: null,
            rateLimit: null,
            error: 'invalid_endpoint',
            details: 'Endpoint must start with "/".'
        };
    }

    if (!apiKeyPresent) {
        return {
            ok: false,
            provider: PROVIDER,
            endpoint: safeEndpoint,
            status: null,
            params: safeParams,
            data: null,
            rateLimit: null,
            error: 'missing_api_key',
            details: 'Set FREE_LIVESCORE_RAPIDAPI_KEY or X_RAPIDAPI_KEY or RAPIDAPI_KEY.'
        };
    }

    try {
        const response = await axios.get(`https://${host}${safeEndpoint}`, {
            timeout: timeoutMs,
            params: safeParams,
            validateStatus: () => true,
            headers: {
                'Content-Type': 'application/json',
                'x-rapidapi-host': host,
                'x-rapidapi-key': key,
                Accept: 'application/json'
            }
        });

        const status = Number(response?.status) || null;
        const rateLimit = extractRateLimitHeaders(response?.headers);
        if (status >= 200 && status < 300) {
            return {
                ok: true,
                provider: PROVIDER,
                endpoint: safeEndpoint,
                status,
                params: safeParams,
                data: response?.data,
                rateLimit,
                error: null,
                details: null
            };
        }

        return {
            ok: false,
            provider: PROVIDER,
            endpoint: safeEndpoint,
            status,
            params: safeParams,
            data: response?.data ?? null,
            rateLimit,
            error: `http_${status || 'unknown'}`,
            details: response?.data || null
        };
    } catch (error) {
        const status = Number(error?.response?.status) || null;
        return {
            ok: false,
            provider: PROVIDER,
            endpoint: safeEndpoint,
            status,
            params: safeParams,
            data: error?.response?.data ?? null,
            rateLimit: extractRateLimitHeaders(error?.response?.headers),
            error: error?.code || error?.name || 'request_failed',
            details: error?.message || null
        };
    }
}

async function fetchFreeLivescoreSearch(options = {}) {
    const params = {
        sportname: String(options.sportname || 'soccer'),
        search: String(options.search || 'romania')
    };
    return fetchFreeLivescoreEndpoint(ENDPOINT, params, options);
}

module.exports = {
    fetchFreeLivescoreSearch,
    fetchFreeLivescoreEndpoint,
    getFreeLivescoreConfig,
    extractRateLimitHeaders
};
