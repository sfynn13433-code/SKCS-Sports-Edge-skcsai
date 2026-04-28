'use strict';

const axios = require('axios');

function getMetrxConfig() {
    const key =
        process.env.METRX_FACTORY_RAPIDAPI_KEY
        || process.env.X_RAPIDAPI_KEY
        || process.env.RAPIDAPI_KEY;

    const host =
        process.env.METRX_FACTORY_RAPIDAPI_HOST
        || 'metrx-factory.p.rapidapi.com';

    if (!key) {
        return {
            ok: false,
            error: 'missing_metrx_factory_api_key',
            message:
                'Missing METRX_FACTORY_RAPIDAPI_KEY, X_RAPIDAPI_KEY, or RAPIDAPI_KEY'
        };
    }

    return {
        ok: true,
        key,
        host,
        baseURL: `https://${host}`
    };
}

function extractRateLimitHeaders(headers = {}) {
    const lower = {};
    for (const [key, value] of Object.entries(headers || {})) {
        lower[String(key).toLowerCase()] = value;
    }

    return {
        requestsLimit: lower['x-ratelimit-requests-limit'] || null,
        requestsRemaining: lower['x-ratelimit-requests-remaining'] || null,
        requestsReset: lower['x-ratelimit-requests-reset'] || null,
        hardLimit:
            lower['x-ratelimit-rapid-free-plans-hard-limit-limit'] || null,
        hardRemaining:
            lower['x-ratelimit-rapid-free-plans-hard-limit-remaining'] || null,
        hardReset:
            lower['x-ratelimit-rapid-free-plans-hard-limit-reset'] || null
    };
}

async function fetchTopMatchMetrics(options = {}) {
    const config = getMetrxConfig();
    const endpoint = '/v1/match-metrics/top';

    if (!config.ok) {
        return {
            ok: false,
            provider: 'metrx_factory',
            endpoint,
            status: null,
            error: config.error,
            details: config.message,
            rateLimit: null
        };
    }

    const params = {};

    if (options.rawParams && typeof options.rawParams === 'object') {
        Object.assign(params, options.rawParams);
    }

    if (options.limit !== undefined && options.limit !== null) {
        params.limit = options.limit;
    }

    if (options.competitionId !== undefined && options.competitionId !== null) {
        params.competitionId = options.competitionId;
    }

    if (options.date !== undefined && options.date !== null) {
        params.date = options.date;
    }

    try {
        const response = await axios.get(`${config.baseURL}${endpoint}`, {
            params,
            timeout: 15000,
            headers: {
                'x-rapidapi-host': config.host,
                'x-rapidapi-key': config.key,
                Accept: 'application/json'
            }
        });

        return {
            ok: true,
            provider: 'metrx_factory',
            endpoint,
            status: response.status,
            data: response.data,
            rateLimit: extractRateLimitHeaders(response.headers)
        };
    } catch (error) {
        const status = error.response?.status || null;
        const headers = error.response?.headers || {};
        const providerData = error.response?.data;

        return {
            ok: false,
            provider: 'metrx_factory',
            endpoint,
            status,
            error: error.code || error.message || 'metrx_factory_request_failed',
            details:
                providerData && typeof providerData === 'object'
                    ? JSON.stringify(providerData).slice(0, 1000)
                    : String(providerData || error.message || 'Unknown error').slice(0, 1000),
            rateLimit: extractRateLimitHeaders(headers)
        };
    }
}

module.exports = {
    fetchTopMatchMetrics,
    getMetrxConfig,
    extractRateLimitHeaders
};
