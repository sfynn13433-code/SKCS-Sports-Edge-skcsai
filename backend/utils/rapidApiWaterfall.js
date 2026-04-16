'use strict';

const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY;

// Import cache utilities
const { cachedAxios, CACHE_TTL } = require('./apiCache');

const TIER_1_HOSTS = [
    'football-hub.p.rapidapi.com',
    'football-api.p.rapidapi.com',
    'totalcorner.p.rapidapi.com',
    'rimble-raw-data.p.rapidapi.com',
    'sports-odds-apis.p.rapidapi.com',
    'pinnacle-odds.p.rapidapi.com'
];

const TIER_2_HOSTS = [
    'allsportsapi2.p.rapidapi.com',
    'sofascore.p.rapidapi.com',
    'cricbuzz-cricket.p.rapidapi.com',
    'flashlive-sports.p.rapidapi.com',
    'livescore6.p.rapidapi.com'
];

const TIER_3_HOSTS = [
    'football-news.p.rapidapi.com',
    'newsnow.p.rapidapi.com',
    'espn.p.rapidapi.com',
    'sport-radar-api.p.rapidapi.com',
    'mma-rankings.p.rapidapi.com'
];

async function fetchWithWaterfall(endpoint, params = {}, tier = 'TIER_1', timeoutMs = 5000) {
    if (!RAPIDAPI_KEY) {
        throw new Error('RAPIDAPI_KEY is missing from environment variables.');
    }

    let hosts;
    switch (tier.toUpperCase()) {
        case 'TIER_1':
        case 'TIER1':
        case '1':
            hosts = TIER_1_HOSTS;
            break;
        case 'TIER_2':
        case 'TIER2':
        case '2':
            hosts = TIER_2_HOSTS;
            break;
        case 'TIER_3':
        case 'TIER3':
        case '3':
            hosts = TIER_3_HOSTS;
            break;
        default:
            hosts = TIER_1_HOSTS;
    }

    const lastError = null;

    for (let i = 0; i < hosts.length; i++) {
        const host = hosts[i];
        
        // Check cache before making request
        const cacheKey = `${host}${endpoint}?${Object.entries(params).sort().map(([k,v]) => `${k}=${v}`).join('&')}`;
        
        try {
            console.log(`[Waterfall-${tier}] Attempting: ${host}${endpoint}`);
            
            // Use cached axios call
            const result = await cachedAxios({
                url: `https://${host}${endpoint}`,
                params,
                headers: {
                    'x-rapidapi-key': RAPIDAPI_KEY,
                    'x-rapidapi-host': host
                },
                timeout: timeoutMs
            }, host);

            if (result.data) {
                const fromMsg = result.fromCache ? ' (FROM CACHE)' : '';
                console.log(`[Waterfall-${tier}] Success via ${host}${fromMsg}!`);
                return { data: result.data, host };
            }
        } catch (error) {
            const status = error.response?.status || 'TIMEOUT/NETWORK';
            console.warn(`[Waterfall-${tier}] ${host} failed (${status}): ${error.message}`);
            lastError = error;
        }
    }

    throw new Error(`[Waterfall-${tier}] FATAL: All ${hosts.length} hosts failed. Last error: ${lastError?.message || 'Unknown'}`);
}

async function fetchLiveScores(date = null) {
    const params = date ? { date } : {};
    try {
        return await fetchWithWaterfall('/fixtures', params, 'TIER_1', 8000);
    } catch (err) {
        console.error('[LiveScores] Waterfall failed:', err.message);
        return null;
    }
}

async function fetchOdds(sport = 'soccer', region = 'eu') {
    try {
        return await fetchWithWaterfall('/odds', { sport, region }, 'TIER_1', 8000);
    } catch (err) {
        console.error('[Odds] Waterfall failed:', err.message);
        return null;
    }
}

async function fetchFixtures(sport = 'soccer') {
    try {
        return await fetchWithWaterfall('/v1/fixtures', { sport }, 'TIER_2', 10000);
    } catch (err) {
        console.error('[Fixtures] Waterfall failed:', err.message);
        return null;
    }
}

async function fetchNews(query = 'football') {
    try {
        return await fetchWithWaterfall('/v1/news', { query }, 'TIER_3', 10000);
    } catch (err) {
        console.error('[News] Waterfall failed:', err.message);
        return null;
    }
}

module.exports = {
    fetchWithWaterfall,
    fetchLiveScores,
    fetchOdds,
    fetchFixtures,
    fetchNews,
    TIER_1_HOSTS,
    TIER_2_HOSTS,
    TIER_3_HOSTS
};