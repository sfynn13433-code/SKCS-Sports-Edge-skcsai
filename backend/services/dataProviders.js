'use strict';

const { fetchWithCache, isCacheWallReady } = require('./apiCacheService');
const { getRapidApiKeyPool, maskKey } = require('../utils/keyPool');
const RAPIDAPI_BYPASS_CACHE_WALL = ['1', 'true', 'yes'].includes(
    String(process.env.RAPIDAPI_BYPASS_CACHE_WALL || '').trim().toLowerCase()
);

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
    sport_api_Basketball: { hostEnv: 'RAPIDAPI_HOST_SPORT', cacheDurationMinutes: 1440 },
    free_live_Football: { hostEnv: 'RAPIDAPI_HOST_FREE_FOOTBALL', cacheDurationMinutes: 1440 },
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
    Football: 'football_api',
    MLB: 'tank01_mlb',
    Basketball: 'sport_api_nba',
    Basketball: 'sport_api_nba',
    Rugby: 'rugby_live_data',
    NHL: 'icehockeyapi',
    american_Football: 'nfl_api',
    NFL: 'nfl_api',
    F1: 'f1_motorsport',
    Cricket: 'cricket_api',
    Handball: 'allsportsapi',
    Volleyball: 'allsportsapi',
    AFL: 'allsportsapi',
    MMA: 'allsportsapi'
});

const FOOTBALL_NEWS_FALLBACK_LEAGUE = String(
    process.env.FOOTBALL_NEWS_HIGH_VALUE_LEAGUE || '39'
).trim();

const SPORT_HOST_KEY_HINTS = Object.freeze({
    Football: ['FOOTBALL', 'SOCCER', 'LIVESCORE', 'FLASHSCORE', 'SCORE', 'ODDSPEDIA', 'ALLSPORTS', 'ALLSCORES', 'SPORT_RADAR'],
    Basketball: ['BASKETBALL', 'NBA', 'WNBA'],
    Basketball: ['BASKETBALL', 'NBA', 'WNBA'],
    MLB: ['BASEBALL', 'MLB'],
    NHL: ['HOCKEY', 'ICE_HOCKEY', 'NHL'],
    Rugby: ['RUGBY'],
    american_Football: ['NFL', 'AMERICAN_FOOTBALL', 'AMERICANFOOTBALL'],
    NFL: ['NFL', 'AMERICAN_FOOTBALL', 'AMERICANFOOTBALL'],
    Volleyball: ['VOLLEYBALL'],
    Handball: ['HANDBALL'],
    AFL: ['AUSSIE', 'AFL'],
    MMA: ['MMA', 'UFC'],
    F1: ['F1', 'FORMULA', 'MOTOR'],
    Cricket: ['CRICKET'],
    Tennis: ['TENNIS']
});

function normalizeHost(value) {
    const raw = String(value || '').split('#')[0].trim();
    if (!raw) return '';
    return raw
        .replace(/^https?:\/\//i, '')
        .replace(/\/+$/, '')
        .trim();
}

function uniqueHosts(values) {
    const out = [];
    const seen = new Set();
    for (const raw of Array.isArray(values) ? values : []) {
        const host = normalizeHost(raw);
        if (!host) continue;
        const key = host.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(host);
    }
    return out;
}

function parseCsvHosts(value) {
    return String(value || '')
        .split(',')
        .map((part) => normalizeHost(part))
        .filter(Boolean);
}

function getAllRapidApiHostEntries() {
    const out = [];
    for (const [key, value] of Object.entries(process.env)) {
        if (!/^RAPIDAPI_HOST_/i.test(String(key || ''))) continue;
        const host = normalizeHost(value);
        if (!host) continue;
        out.push({ key: String(key || '').toUpperCase(), host });
    }
    return out;
}

function normalizeSportToken(sport) {
    const key = String(sport || '').trim().toLowerCase();
    if (!key) return '';
    if (key === 'soccer' || key === 'football' || key.startsWith('soccer_')) return 'Football';
    if (key === 'nba' || key === 'basketball' || key.startsWith('basketball_')) return 'Basketball';
    if (key === 'nfl' || key === 'american_football' || key.startsWith('americanfootball_')) return 'NFL';
    if (key === 'nhl' || key === 'hockey' || key.startsWith('icehockey_')) return 'NHL';
    if (key === 'mlb' || key === 'baseball' || key.startsWith('baseball_')) return 'MLB';
    if (key === 'rugby' || key.startsWith('rugbyunion_')) return 'Rugby';
    if (key === 'afl' || key.startsWith('aussierules_')) return 'AFL';
    if (key === 'volleyball') return 'Volleyball';
    if (key === 'handball') return 'Handball';
    if (key === 'f1' || key === 'formula1') return 'F1';
    if (key === 'mma') return 'MMA';
    if (key === 'golf') return 'Golf';
    if (key === 'boxing') return 'Boxing';
    if (key === 'tennis') return 'Tennis';
    if (key === 'cricket') return 'Cricket';
    if (key === 'esports') return 'Esports';
    if (key === 'darts') return 'Darts';
    return key;
}

function hostKeyMatchesSport(hostKey, sport) {
    const token = normalizeSportToken(sport);
    if (!token) return false;
    const hints = SPORT_HOST_KEY_HINTS[token] || [];
    if (!hints.length) return false;
    const normalizedKey = String(hostKey || '').toUpperCase();
    return hints.some((hint) => normalizedKey.includes(hint));
}

function parseHostFallbackLimit() {
    const raw = Number(process.env.RAPIDAPI_HOST_FALLBACK_LIMIT || 40);
    if (!Number.isFinite(raw)) return 40;
    return Math.max(1, Math.min(200, Math.floor(raw)));
}

function getRapidApiKey() {
    const keys = getRapidApiKeyPool();
    return keys[0] || '';
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
    return normalizeHost(process.env[provider.hostEnv]);
}

function getRapidApiProviderForSport(sport) {
    const key = String(sport || '').trim().toLowerCase();
    return SPORT_PROVIDER_MAP[key] || 'football_api';
}

function getRapidApiHostCandidates(options = {}) {
    const providerName = String(options.providerName || '').trim();
    const sport = normalizeSportToken(options.sport || options.sportKey || '');
    const explicitHosts = Array.isArray(options.hosts) ? options.hosts : [];
    const defaultHost = normalizeHost(options.defaultHost || '');

    const provider = PROVIDER_CONFIG[providerName] || null;
    const providerHost = provider ? normalizeHost(process.env[provider.hostEnv]) : '';

    const sportUpper = String(sport || '').toUpperCase();
    const envPinnedHosts = [
        ...parseCsvHosts(process.env.RAPIDAPI_HOSTS_ACTIVE),
        ...parseCsvHosts(process.env.RAPIDAPI_HOSTS_ACTIVE_ALL),
        ...(sportUpper ? parseCsvHosts(process.env[`RAPIDAPI_HOSTS_ACTIVE_${sportUpper}`]) : []),
        ...(sportUpper ? parseCsvHosts(process.env[`RAPIDAPI_${sportUpper}_HOSTS`]) : [])
    ];

    const allHostEntries = getAllRapidApiHostEntries();
    const sportMatchedHosts = sport
        ? allHostEntries
            .filter((entry) => hostKeyMatchesSport(entry.key, sport))
            .map((entry) => entry.host)
        : [];
    const allConfiguredHosts = allHostEntries.map((entry) => entry.host);

    const ordered = uniqueHosts([
        ...explicitHosts,
        ...envPinnedHosts,
        defaultHost,
        providerHost,
        ...sportMatchedHosts,
        ...allConfiguredHosts
    ]);

    return ordered.slice(0, parseHostFallbackLimit());
}

function endpointPathFromUrl(endpointUrl) {
    const text = String(endpointUrl || '').trim();
    if (!text) return '/';
    if (!/^https?:\/\//i.test(text)) {
        return text.startsWith('/') ? text : `/${text}`;
    }
    try {
        const parsed = new URL(text);
        const path = `${parsed.pathname || ''}${parsed.search || ''}`;
        if (!path) return '/';
        return path.startsWith('/') ? path : `/${path}`;
    } catch (_error) {
        return '/';
    }
}

function hostFromEndpointUrl(endpointUrl) {
    const text = String(endpointUrl || '').trim();
    if (!text || !/^https?:\/\//i.test(text)) return '';
    try {
        return normalizeHost(new URL(text).host);
    } catch (_error) {
        return '';
    }
}

async function fetchRapidApiProvider(providerName, endpointPath, params = {}, options = {}) {
    const provider = getProviderConfig(providerName);
    const rapidApiKeys = getRapidApiKeyPool();

    if (!rapidApiKeys.length) {
        console.warn(`[dataProviders] RapidAPI key missing. Skipping provider ${providerName}.`);
        return null;
    }
    if (!isCacheWallReady() && !RAPIDAPI_BYPASS_CACHE_WALL) {
        console.warn(`[dataProviders] Cache wall unavailable for ${providerName}. Set RAPIDAPI_BYPASS_CACHE_WALL=true to allow uncached fallback.`);
        return null;
    }

    const cacheDurationMinutes = Number.isFinite(options.cacheDurationMinutes)
        ? options.cacheDurationMinutes
        : provider.cacheDurationMinutes;
    const hosts = getRapidApiHostCandidates({
        providerName,
        sport: options.sport,
        defaultHost: getProviderHost(providerName),
        hosts: options.hosts
    });

    if (!hosts.length) {
        throw new Error(`Missing RapidAPI host candidates for provider ${providerName}`);
    }

    for (let hostIdx = 0; hostIdx < hosts.length; hostIdx += 1) {
        const host = hosts[hostIdx];
        const endpointUrl = toEndpointUrl(host, endpointPath);
        for (let i = 0; i < rapidApiKeys.length; i += 1) {
            const key = rapidApiKeys[i];
            const payload = await fetchWithCache(
                providerName,
                endpointUrl,
                {
                    'x-rapidapi-key': key,
                    'x-rapidapi-host': host
                },
                params,
                cacheDurationMinutes
            );
            if (payload) return payload;
            console.warn(`[dataProviders] ${providerName}: host ${hostIdx + 1}/${hosts.length} key ${i + 1}/${rapidApiKeys.length} (${maskKey(key)}) returned empty payload. Rotating...`);
        }
    }

    return null;
}

async function fetchRapidApiCustom(options = {}) {
    const providerName = String(options.providerName || '').trim();
    const endpointUrl = String(options.endpointUrl || '').trim();
    const host = normalizeHost(options.host || '');
    const params = options.params && typeof options.params === 'object' ? options.params : {};

    if (!providerName) {
        throw new Error('fetchRapidApiCustom requires providerName');
    }
    if (!endpointUrl && !host) {
        throw new Error('fetchRapidApiCustom requires endpointUrl and/or host');
    }

    const rapidApiKeys = getRapidApiKeyPool();
    if (!rapidApiKeys.length) {
        console.warn(`[dataProviders] RapidAPI key missing. Skipping provider ${providerName}.`);
        return null;
    }
    if (!isCacheWallReady() && !RAPIDAPI_BYPASS_CACHE_WALL) {
        console.warn(`[dataProviders] Cache wall unavailable for ${providerName}. Set RAPIDAPI_BYPASS_CACHE_WALL=true to allow uncached fallback.`);
        return null;
    }

    const provider = PROVIDER_CONFIG[providerName];
    const cacheDurationMinutes = Number.isFinite(options.cacheDurationMinutes)
        ? options.cacheDurationMinutes
        : (provider ? provider.cacheDurationMinutes : 1440);
    const endpointPath = endpointPathFromUrl(endpointUrl);
    const defaultHost = host || hostFromEndpointUrl(endpointUrl);
    const hosts = getRapidApiHostCandidates({
        providerName,
        sport: options.sport,
        defaultHost,
        hosts: options.hosts
    });

    if (!hosts.length) {
        console.warn(`[dataProviders] ${providerName}: no host candidates available. Skipping request.`);
        return null;
    }

    for (let hostIdx = 0; hostIdx < hosts.length; hostIdx += 1) {
        const candidateHost = hosts[hostIdx];
        const candidateEndpointUrl = toEndpointUrl(candidateHost, endpointPath);
        for (let i = 0; i < rapidApiKeys.length; i += 1) {
            const key = rapidApiKeys[i];
            const payload = await fetchWithCache(
                providerName,
                candidateEndpointUrl,
                {
                    'x-rapidapi-key': key,
                    'x-rapidapi-host': candidateHost
                },
                params,
                cacheDurationMinutes
            );
            if (payload) return payload;
            console.warn(`[dataProviders] ${providerName}: host ${hostIdx + 1}/${hosts.length} key ${i + 1}/${rapidApiKeys.length} (${maskKey(key)}) returned empty payload. Rotating...`);
        }
    }

    return null;
}

async function fetchRapidApiBySport(sport, endpointPath, params = {}, options = {}) {
    const providerName = getRapidApiProviderForSport(sport);
    return fetchRapidApiProvider(providerName, endpointPath, params, { ...options, sport });
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
    const hasRapidApiKey = getRapidApiKeyPool().length > 0;

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
    getRapidApiHostCandidates,
    assertRapidApiCacheWallReady
};
