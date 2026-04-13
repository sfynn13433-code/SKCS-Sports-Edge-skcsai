'use strict';

const { fetchWithCache, isCacheWallReady } = require('./apiCacheService');

const PROVIDER_CONFIG = Object.freeze({
    football_api: { hostEnv: 'RAPIDAPI_HOST_FOOTBALL_API', cacheDurationMinutes: 10 },

    tank01_mlb: { hostEnv: 'RAPIDAPI_HOST_TANK01_MLB', cacheDurationMinutes: 60 },

    allscores: { hostEnv: 'RAPIDAPI_HOST_ALLSCORES', cacheDurationMinutes: 480 },

    allsportsapi: { hostEnv: 'RAPIDAPI_HOST_ALLSPORTS', cacheDurationMinutes: 720 },
    rugby_live_data: { hostEnv: 'RAPIDAPI_HOST_RUGBY', cacheDurationMinutes: 720 },
    pinnacle_odds: { hostEnv: 'RAPIDAPI_HOST_PINNACLE_ODDS', cacheDurationMinutes: 720 },
    icehockeyapi: { hostEnv: 'RAPIDAPI_HOST_ICE_HOCKEY', cacheDurationMinutes: 720 },
    cricket_api: { hostEnv: 'RAPIDAPI_HOST_CRICKET_API', cacheDurationMinutes: 720 },

    sofascore: { hostEnv: 'RAPIDAPI_HOST_SOFASCORE', cacheDurationMinutes: 1440 },
    cricbuzz: { hostEnv: 'RAPIDAPI_HOST_CRICBUZZ', cacheDurationMinutes: 1440 },
    tennis_api: { hostEnv: 'RAPIDAPI_HOST_TENNIS', cacheDurationMinutes: 1440 },
    sport_api_nba: { hostEnv: 'RAPIDAPI_HOST_SPORT', cacheDurationMinutes: 1440 },
    free_live_football: { hostEnv: 'RAPIDAPI_HOST_FREE_FOOTBALL', cacheDurationMinutes: 1440 },
    today_prediction: { hostEnv: 'RAPIDAPI_HOST_TODAY_PREDICTION', cacheDurationMinutes: 1440 },
    flashlive: { hostEnv: 'RAPIDAPI_HOST_FLASHLIVE', cacheDurationMinutes: 1440 },
    livescore: { hostEnv: 'RAPIDAPI_HOST_LIVESCORE', cacheDurationMinutes: 1440 },
    newsnow: { hostEnv: 'RAPIDAPI_HOST_NEWSNOW', cacheDurationMinutes: 1440 },
    nfl_api: { hostEnv: 'RAPIDAPI_HOST_NFL', cacheDurationMinutes: 1440 },
    f1_motorsport: { hostEnv: 'RAPIDAPI_HOST_F1', cacheDurationMinutes: 1440 },
    wec_news: { hostEnv: 'RAPIDAPI_HOST_WEC_NEWS', cacheDurationMinutes: 1440 },
    espn: { hostEnv: 'RAPIDAPI_HOST_ESPN', cacheDurationMinutes: 1440 },
    os_sports_perform: { hostEnv: 'RAPIDAPI_HOST_OS_SPORTS_PERFORM', cacheDurationMinutes: 1440 },
    football_news_api: { hostEnv: 'RAPIDAPI_HOST_FOOTBALL_NEWS', cacheDurationMinutes: 1440 }
});

const SPORT_PROVIDER_MAP = Object.freeze({
    football: 'football_api',
    baseball: 'tank01_mlb',
    basketball: 'sport_api_nba',
    nba: 'sport_api_nba',
    rugby: 'rugby_live_data',
    hockey: 'icehockeyapi',
    american_football: 'nfl_api',
    nfl: 'nfl_api',
    formula1: 'f1_motorsport',
    cricket: 'cricket_api',
    handball: 'allsportsapi',
    volleyball: 'allsportsapi',
    afl: 'allsportsapi',
    mma: 'allsportsapi'
});

const FOOTBALL_NEWS_FALLBACK_LEAGUE = String(
    process.env.FOOTBALL_NEWS_HIGH_VALUE_LEAGUE || '39'
).trim();

function getRapidApiKey() {
    return String(process.env.X_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY || '').trim();
}

function toEndpointUrl(host, endpointPath) {
    const path = String(endpointPath || '').trim();
    if (!path) {
        return `https://${host}`;
    }
    if (/^https?:\/\//i.test(path)) {
        return path;
    }
    return `https://${host}${path.startsWith('/') ? path : `/${path}`}`;
}

function getProviderConfig(providerName) {
    const config = PROVIDER_CONFIG[providerName];
    if (!config) {
        throw new Error(`Unknown RapidAPI provider: ${providerName}`);
    }
    return config;
}

function getProviderHost(providerName) {
    const provider = getProviderConfig(providerName);
    const host = String(process.env[provider.hostEnv] || '').trim();
    if (!host) {
        throw new Error(`Missing host env for provider ${providerName}: ${provider.hostEnv}`);
    }
    return host;
}

function getRapidApiProviderForSport(sport) {
    const key = String(sport || '').trim().toLowerCase();
    return SPORT_PROVIDER_MAP[key] || 'football_api';
}

async function fetchRapidApiProvider(providerName, endpointPath, params = {}, options = {}) {
    const provider = getProviderConfig(providerName);
    const host = getProviderHost(providerName);
    const rapidApiKey = getRapidApiKey();

    if (!rapidApiKey) {
        console.warn(`[dataProviders] RapidAPI key missing. Skipping provider ${providerName}.`);
        return null;
    }

    const endpointUrl = toEndpointUrl(host, endpointPath);
    const headers = {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': host
    };
    const cacheDurationMinutes = Number.isFinite(options.cacheDurationMinutes)
        ? options.cacheDurationMinutes
        : provider.cacheDurationMinutes;

    return fetchWithCache(providerName, endpointUrl, headers, params, cacheDurationMinutes);
}

async function fetchRapidApiCustom(options = {}) {
    const providerName = String(options.providerName || '').trim();
    const endpointUrl = String(options.endpointUrl || '').trim();
    const host = String(options.host || '').trim();
    const params = options.params && typeof options.params === 'object' ? options.params : {};

    if (!providerName) {
        throw new Error('fetchRapidApiCustom requires providerName');
    }
    if (!endpointUrl || !host) {
        throw new Error('fetchRapidApiCustom requires endpointUrl and host');
    }

    const rapidApiKey = getRapidApiKey();
    if (!rapidApiKey) {
        console.warn(`[dataProviders] RapidAPI key missing. Skipping provider ${providerName}.`);
        return null;
    }

    const provider = PROVIDER_CONFIG[providerName];
    const cacheDurationMinutes = Number.isFinite(options.cacheDurationMinutes)
        ? options.cacheDurationMinutes
        : (provider ? provider.cacheDurationMinutes : 1440);

    return fetchWithCache(
        providerName,
        endpointUrl,
        {
            'x-rapidapi-key': rapidApiKey,
            'x-rapidapi-host': host
        },
        params,
        cacheDurationMinutes
    );
}

async function fetchRapidApiBySport(sport, endpointPath, params = {}, options = {}) {
    const providerName = getRapidApiProviderForSport(sport);
    return fetchRapidApiProvider(providerName, endpointPath, params, options);
}

/**
 * DANGER-ALERT GUARD:
 * This fallback endpoint must only run for one fixed, high-value league once per 24h.
 */
async function fetchFootballNewsLeagueFallback(params = {}, endpointPath = '/news/league') {
    const safeParams = {
        ...(params && typeof params === 'object' ? params : {}),
        league: FOOTBALL_NEWS_FALLBACK_LEAGUE
    };

    if (safeParams.league_id) {
        delete safeParams.league_id;
    }

    return fetchRapidApiProvider(
        'football_news_api',
        endpointPath,
        safeParams,
        { cacheDurationMinutes: 1440 }
    );
}

function assertRapidApiCacheWallReady() {
    const hasCacheWall = isCacheWallReady();
    const hasRapidApiKey = Boolean(getRapidApiKey());

    if (!hasCacheWall) {
        console.warn('[dataProviders] Supabase cache wall not configured. RapidAPI requests will be blocked.');
    }
    if (!hasRapidApiKey) {
        console.warn('[dataProviders] RapidAPI key not configured. RapidAPI requests will be skipped.');
    }

    return hasCacheWall && hasRapidApiKey;
}

module.exports = {
    PROVIDER_CONFIG,
    SPORT_PROVIDER_MAP,
    FOOTBALL_NEWS_FALLBACK_LEAGUE,
    fetchRapidApiProvider,
    fetchRapidApiCustom,
    fetchRapidApiBySport,
    fetchFootballNewsLeagueFallback,
    getRapidApiProviderForSport,
    assertRapidApiCacheWallReady
};
