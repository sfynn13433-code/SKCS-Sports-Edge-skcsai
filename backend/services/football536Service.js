'use strict';

const axios = require('axios');

const PROVIDER = 'football536';
const DEFAULT_HOST = 'football536.p.rapidapi.com';
const DEFAULT_TIMEOUT_MS = 15000;

function getFootball536Config() {
    const host = String(process.env.FOOTBALL536_RAPIDAPI_HOST || DEFAULT_HOST).trim() || DEFAULT_HOST;
    const key = String(
        process.env.FOOTBALL536_RAPIDAPI_KEY
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
    const getHeader = (...names) => {
        for (const name of names) {
            const value = source[name] ?? source[String(name).toLowerCase()];
            if (value !== undefined && value !== null && value !== '') return String(value);
        }
        return null;
    };

    const requestsLimit = getHeader('x-ratelimit-requests-limit', 'x-ratelimit-limit');
    const requestsRemaining = getHeader('x-ratelimit-requests-remaining', 'x-ratelimit-remaining');
    const requestsReset = getHeader('x-ratelimit-requests-reset', 'x-ratelimit-reset');
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

async function fetchFootball536Endpoint(endpoint, params = {}, options = {}) {
    const { host, key, apiKeyPresent } = getFootball536Config();
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
            error: 'invalid_endpoint',
            details: 'Endpoint must start with "/".',
            rateLimit: null
        };
    }

    if (!apiKeyPresent) {
        return {
            ok: false,
            provider: PROVIDER,
            endpoint: safeEndpoint,
            status: null,
            params: safeParams,
            error: 'missing_api_key',
            details: 'Set FOOTBALL536_RAPIDAPI_KEY or X_RAPIDAPI_KEY or RAPIDAPI_KEY.',
            rateLimit: null
        };
    }

    try {
        const response = await axios.get(`https://${host}${safeEndpoint}`, {
            timeout: timeoutMs,
            params: safeParams,
            validateStatus: () => true,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'x-rapidapi-host': host,
                'x-rapidapi-key': key
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
                rateLimit
            };
        }

        return {
            ok: false,
            provider: PROVIDER,
            endpoint: safeEndpoint,
            status,
            params: safeParams,
            error: `http_${status || 'unknown'}`,
            details: response?.data || null,
            rateLimit
        };
    } catch (error) {
        const status = Number(error?.response?.status) || null;
        return {
            ok: false,
            provider: PROVIDER,
            endpoint: safeEndpoint,
            status,
            params: safeParams,
            error: error?.code || error?.name || 'request_failed',
            details: error?.message || null,
            rateLimit: extractRateLimitHeaders(error?.response?.headers)
        };
    }
}

module.exports = {
    getFootball536Config,
    extractRateLimitHeaders,
    fetchFootball536Endpoint
};
