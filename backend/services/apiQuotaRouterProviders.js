'use strict';

/**
 * Central provider registry for apiQuotaRouter.
 * One place for sport families, provider caps, and aliases.
 */

const SPORT_FAMILIES = Object.freeze({
    football: {
        label: 'Football',
        defaultProviders: ['api_sports_football', 'odds_api'],
        ingestionEnv: null
    },
    cricket: {
        label: 'Cricket',
        defaultProviders: ['cricket_live_line_advance', 'cricapi', 'cricket_api'],
        ingestionEnv: 'CRICKET_INGESTION_ENABLED'
    },
    basketball: {
        label: 'Basketball',
        defaultProviders: ['api_sports_basketball'],
        ingestionEnv: null
    },
    baseball: {
        label: 'Baseball',
        defaultProviders: ['api_sports_baseball'],
        ingestionEnv: null
    },
    hockey: {
        label: 'Hockey',
        defaultProviders: ['api_sports_hockey'],
        ingestionEnv: null
    },
    rugby: {
        label: 'Rugby',
        defaultProviders: ['api_sports_rugby'],
        ingestionEnv: null
    },
    mma: {
        label: 'MMA',
        defaultProviders: ['api_sports_mma'],
        ingestionEnv: null
    },
    nfl: {
        label: 'American Football',
        defaultProviders: ['api_sports_nfl'],
        ingestionEnv: null
    },
    formula1: {
        label: 'Formula 1',
        defaultProviders: ['api_sports_formula1'],
        ingestionEnv: null
    },
    volleyball: {
        label: 'Volleyball',
        defaultProviders: ['api_sports_volleyball'],
        ingestionEnv: null
    },
    handball: {
        label: 'Handball',
        defaultProviders: ['api_sports_handball'],
        ingestionEnv: null
    },
    afl: {
        label: 'AFL',
        defaultProviders: ['api_sports_afl'],
        ingestionEnv: null
    },
    tennis: {
        label: 'Tennis',
        defaultProviders: ['api_sports_tennis'],
        ingestionEnv: null
    }
});

const PROVIDER_ALIASES = Object.freeze({
    'api-sports': 'api_sports_football',
    apisports: 'api_sports_football',
    api_sports: 'api_sports_football',
    'odds-api': 'odds_api',
    theoddsapi: 'odds_api',
    cricket_live_line: 'cricket_live_line_advance',
    cricket_live_line_advance: 'cricket_live_line_advance',
    cricbuzz: 'cricket_api',
    sportsapi_pro: 'sportsapi_pro_football',
    metrx_factory: 'metrx_factory',
    thesportsdb: 'thesportsdb',
    divanscore: 'divanscore',
    big_balls_data: 'big_balls_data',
    bigballs: 'big_balls_data',
    big_balls: 'big_balls_data',
    soccer_data_api: 'soccer_data_api',
    soccerdata: 'soccer_data_api',
    groq: 'groq',
    dolphin: 'dolphin'
});

function apiSportsProviderKey(sportKey) {
    const key = String(sportKey || 'football').trim().toLowerCase();
    const mapped = `api_sports_${key}`;
    if (PROVIDER_REGISTRY_BASE[mapped]) return mapped;
    return 'api_sports_football';
}

const PROVIDER_REGISTRY_BASE = Object.freeze({
    cricket_live_line_advance: {
        providerName: 'cricket_live_line_advance',
        family: 'cricket',
        dailyLimit: Number(process.env.CRICKET_LIVE_LINE_DAILY_LIMIT) || 40,
        perMinuteLimit: Number(process.env.CRICKET_LIVE_LINE_PER_MINUTE_LIMIT) || 4,
        failClosed: true,
        usesOddsBudget: false
    },
    cricket_api: {
        providerName: 'cricket_api',
        family: 'cricket',
        dailyLimit: Number(process.env.CRICKET_API_DAILY_LIMIT) || 50,
        perMinuteLimit: Number(process.env.CRICKET_API_PER_MINUTE_LIMIT) || 5,
        failClosed: true,
        usesOddsBudget: false
    },
    cricapi: {
        providerName: 'cricapi',
        family: 'cricket',
        dailyLimit: Number(process.env.CRICAPI_DAILY_LIMIT) || 100,
        perMinuteLimit: Number(process.env.CRICAPI_PER_MINUTE_LIMIT) || 10,
        failClosed: true,
        usesOddsBudget: false
    },
    api_sports_football: {
        providerName: 'api_sports_football',
        family: 'football',
        dailyLimit: Number(process.env.API_SPORTS_FOOTBALL_DAILY_LIMIT) || 100,
        // API-Sports free plan: 10 requests/minute (not 20).
        perMinuteLimit: Number(process.env.API_SPORTS_FOOTBALL_PER_MINUTE_LIMIT) || 10,
        failClosed: false,
        usesOddsBudget: false
    },
    api_sports_basketball: {
        providerName: 'api_sports_basketball',
        family: 'basketball',
        dailyLimit: Number(process.env.API_SPORTS_DAILY_LIMIT) || 100,
        perMinuteLimit: Number(process.env.API_SPORTS_PER_MINUTE_LIMIT) || 10,
        failClosed: false,
        usesOddsBudget: false
    },
    api_sports_baseball: {
        providerName: 'api_sports_baseball',
        family: 'baseball',
        dailyLimit: Number(process.env.API_SPORTS_DAILY_LIMIT) || 100,
        perMinuteLimit: Number(process.env.API_SPORTS_PER_MINUTE_LIMIT) || 10,
        failClosed: false,
        usesOddsBudget: false
    },
    api_sports_hockey: {
        providerName: 'api_sports_hockey',
        family: 'hockey',
        dailyLimit: Number(process.env.API_SPORTS_DAILY_LIMIT) || 100,
        perMinuteLimit: Number(process.env.API_SPORTS_PER_MINUTE_LIMIT) || 10,
        failClosed: false,
        usesOddsBudget: false
    },
    api_sports_rugby: {
        providerName: 'api_sports_rugby',
        family: 'rugby',
        dailyLimit: Number(process.env.API_SPORTS_DAILY_LIMIT) || 100,
        perMinuteLimit: Number(process.env.API_SPORTS_PER_MINUTE_LIMIT) || 10,
        failClosed: false,
        usesOddsBudget: false
    },
    api_sports_mma: {
        providerName: 'api_sports_mma',
        family: 'mma',
        dailyLimit: Number(process.env.API_SPORTS_DAILY_LIMIT) || 100,
        perMinuteLimit: Number(process.env.API_SPORTS_PER_MINUTE_LIMIT) || 10,
        failClosed: false,
        usesOddsBudget: false
    },
    api_sports_nfl: {
        providerName: 'api_sports_nfl',
        family: 'nfl',
        dailyLimit: Number(process.env.API_SPORTS_DAILY_LIMIT) || 100,
        perMinuteLimit: Number(process.env.API_SPORTS_PER_MINUTE_LIMIT) || 10,
        failClosed: false,
        usesOddsBudget: false
    },
    api_sports_formula1: {
        providerName: 'api_sports_formula1',
        family: 'formula1',
        dailyLimit: Number(process.env.API_SPORTS_DAILY_LIMIT) || 100,
        perMinuteLimit: Number(process.env.API_SPORTS_PER_MINUTE_LIMIT) || 10,
        failClosed: false,
        usesOddsBudget: false
    },
    api_sports_volleyball: {
        providerName: 'api_sports_volleyball',
        family: 'volleyball',
        dailyLimit: Number(process.env.API_SPORTS_DAILY_LIMIT) || 100,
        perMinuteLimit: Number(process.env.API_SPORTS_PER_MINUTE_LIMIT) || 10,
        failClosed: false,
        usesOddsBudget: false
    },
    api_sports_handball: {
        providerName: 'api_sports_handball',
        family: 'handball',
        dailyLimit: Number(process.env.API_SPORTS_DAILY_LIMIT) || 100,
        perMinuteLimit: Number(process.env.API_SPORTS_PER_MINUTE_LIMIT) || 10,
        failClosed: false,
        usesOddsBudget: false
    },
    api_sports_afl: {
        providerName: 'api_sports_afl',
        family: 'afl',
        dailyLimit: Number(process.env.API_SPORTS_DAILY_LIMIT) || 100,
        perMinuteLimit: Number(process.env.API_SPORTS_PER_MINUTE_LIMIT) || 10,
        failClosed: false,
        usesOddsBudget: false
    },
    api_sports_tennis: {
        providerName: 'api_sports_tennis',
        family: 'tennis',
        dailyLimit: Number(process.env.API_SPORTS_DAILY_LIMIT) || 100,
        perMinuteLimit: Number(process.env.API_SPORTS_PER_MINUTE_LIMIT) || 10,
        failClosed: false,
        usesOddsBudget: false
    },
    odds_api: {
        providerName: 'odds_api',
        family: 'football',
        dailyLimit: null,
        perMinuteLimit: null,
        failClosed: false,
        usesOddsBudget: true
    },
    sportsapi_pro_football: {
        providerName: 'sportsapi_pro_football',
        family: 'football',
        dailyLimit: Number(process.env.SPORTSAPI_PRO_DAILY_LIMIT) || 200,
        perMinuteLimit: Number(process.env.SPORTSAPI_PRO_PER_MINUTE_LIMIT) || 10,
        failClosed: false,
        usesOddsBudget: false
    },
    metrx_factory: {
        providerName: 'metrx_factory',
        family: 'football',
        dailyLimit: Number(process.env.METRX_FACTORY_DAILY_LIMIT) || 100,
        perMinuteLimit: Number(process.env.METRX_FACTORY_PER_MINUTE_LIMIT) || 5,
        failClosed: false,
        usesOddsBudget: false
    },
    thesportsdb: {
        providerName: 'thesportsdb',
        family: 'football',
        dailyLimit: Number(process.env.THESPORTSDB_DAILY_LIMIT) || 500,
        perMinuteLimit: null,
        failClosed: false,
        usesOddsBudget: false
    },
    divanscore: {
        providerName: 'divanscore',
        family: 'football',
        dailyLimit: Number(process.env.DIVANSCORE_DAILY_LIMIT) || 100,
        perMinuteLimit: null,
        failClosed: false,
        usesOddsBudget: false
    },
    big_balls_data: {
        providerName: 'big_balls_data',
        family: 'football',
        dailyLimit: Number(process.env.BIG_BALLS_DAILY_LIMIT) || 1000,
        perMinuteLimit: Number(process.env.BIG_BALLS_PER_MINUTE_LIMIT) || 100,
        failClosed: true,
        usesOddsBudget: false
    },
    soccer_data_api: {
        providerName: 'soccer_data_api',
        family: 'football',
        dailyLimit: Number(process.env.SOCCER_DATA_HARD_DAILY_CAP) || 75,
        perMinuteLimit: Number(process.env.SOCCER_DATA_PER_MINUTE_LIMIT) || 2,
        failClosed: true,
        usesOddsBudget: false
    }
});

function normalizeProviderKey(provider) {
    const raw = String(provider || '').trim().toLowerCase().replace(/\s+/g, '_');
    return PROVIDER_ALIASES[raw] || raw;
}

function getProviderConfig(providerKey) {
    const key = normalizeProviderKey(providerKey);
    return PROVIDER_REGISTRY_BASE[key] || null;
}

function getFamilyForProvider(providerKey) {
    const config = getProviderConfig(providerKey);
    return config?.family || null;
}

module.exports = {
    SPORT_FAMILIES,
    PROVIDER_ALIASES,
    PROVIDER_REGISTRY_BASE,
    apiSportsProviderKey,
    normalizeProviderKey,
    getProviderConfig,
    getFamilyForProvider
};
