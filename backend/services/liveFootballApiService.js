'use strict';

const axios = require('axios');

const PROVIDER = 'live_football_api';
const DEFAULT_HOST = 'live-football-api.p.rapidapi.com';
const DEFAULT_TIMEOUT_MS = 15000;

function getLiveFootballApiConfig() {
    const host = String(process.env.LIVE_FOOTBALL_API_RAPIDAPI_HOST || DEFAULT_HOST).trim() || DEFAULT_HOST;
    const key = String(
        process.env.LIVE_FOOTBALL_API_RAPIDAPI_KEY
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
        const lowerName = String(name).toLowerCase();
        const value = source[name] ?? source[lowerName];
        if (value === undefined || value === null || value === '') return null;
        return String(value);
    };

    const providerDayLimit = getHeader('x-rate-limit-day');
    const providerHourLimit = getHeader('x-rate-limit-hour');
    const providerMinuteLimit = getHeader('x-rate-limit-minute');
    const providerDayRemaining = getHeader('x-rate-remaining-day');
    const providerHourRemaining = getHeader('x-rate-remaining-hour');
    const providerMinuteRemaining = getHeader('x-rate-remaining-minute');
    const providerDayReset = getHeader('x-rate-reset-day');
    const providerHourReset = getHeader('x-rate-reset-hour');
    const providerMinuteReset = getHeader('x-rate-reset-minute');
    const rapidHardLimit = getHeader('x-ratelimit-rapid-free-plans-hard-limit-limit');
    const rapidHardRemaining = getHeader('x-ratelimit-rapid-free-plans-hard-limit-remaining');
    const rapidHardReset = getHeader('x-ratelimit-rapid-free-plans-hard-limit-reset');
    const rapidRequestsLimit = getHeader('x-ratelimit-requests-limit');
    const rapidRequestsRemaining = getHeader('x-ratelimit-requests-remaining');
    const rapidRequestsReset = getHeader('x-ratelimit-requests-reset');

    return {
        'x-rate-limit-day': providerDayLimit,
        'x-rate-limit-hour': providerHourLimit,
        'x-rate-limit-minute': providerMinuteLimit,
        'x-rate-remaining-day': providerDayRemaining,
        'x-rate-remaining-hour': providerHourRemaining,
        'x-rate-remaining-minute': providerMinuteRemaining,
        'x-rate-reset-day': providerDayReset,
        'x-rate-reset-hour': providerHourReset,
        'x-rate-reset-minute': providerMinuteReset,
        'x-ratelimit-rapid-free-plans-hard-limit-limit': rapidHardLimit,
        'x-ratelimit-rapid-free-plans-hard-limit-remaining': rapidHardRemaining,
        'x-ratelimit-rapid-free-plans-hard-limit-reset': rapidHardReset,
        'x-ratelimit-requests-limit': rapidRequestsLimit,
        'x-ratelimit-requests-remaining': rapidRequestsRemaining,
        'x-ratelimit-requests-reset': rapidRequestsReset,
        providerDayLimit,
        providerHourLimit,
        providerMinuteLimit,
        providerDayRemaining,
        providerHourRemaining,
        providerMinuteRemaining,
        providerDayReset,
        providerHourReset,
        providerMinuteReset,
        rapidHardLimit,
        rapidHardRemaining,
        rapidHardReset,
        rapidRequestsLimit,
        rapidRequestsRemaining,
        rapidRequestsReset
    };
}

function normalizeErrorDetails(details) {
    if (details === undefined || details === null) return null;
    if (typeof details === 'string') return details.slice(0, 2000);

    try {
        return JSON.stringify(details).slice(0, 2000);
    } catch (error) {
        return 'Unable to serialize provider error details';
    }
}

async function fetchLiveFootballApiEndpoint(endpoint, params = {}, options = {}) {
    const { host, key, apiKeyPresent } = getLiveFootballApiConfig();
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
            details: 'Set LIVE_FOOTBALL_API_RAPIDAPI_KEY or X_RAPIDAPI_KEY or RAPIDAPI_KEY.',
            rateLimit: null
        };
    }

    try {
        const response = await axios.get(`https://${host}${safeEndpoint}`, {
            params: safeParams,
            timeout: timeoutMs,
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
            details: normalizeErrorDetails(response?.data),
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
            details: normalizeErrorDetails(error?.response?.data || error?.message),
            rateLimit: extractRateLimitHeaders(error?.response?.headers)
        };
    }
}

module.exports = {
    getLiveFootballApiConfig,
    extractRateLimitHeaders,
    fetchLiveFootballApiEndpoint
};

