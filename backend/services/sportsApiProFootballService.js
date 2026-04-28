'use strict';

const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: 'backend/.env', override: false });

const DEFAULT_HOST = 'sportsapi-pro-football-data.p.rapidapi.com';
const DEFAULT_TIMEOUT_MS = 20000;

function getConfig() {
    const host = String(process.env.SPORTSAPI_PRO_FOOTBALL_RAPIDAPI_HOST || DEFAULT_HOST).trim() || DEFAULT_HOST;
    const key = String(
        process.env.SPORTSAPI_PRO_FOOTBALL_RAPIDAPI_KEY
        || process.env.X_RAPIDAPI_KEY
        || process.env.RAPIDAPI_KEY
        || ''
    ).trim();

    if (!key) {
        throw new Error(
            'Missing SportsAPI Pro Football RapidAPI key. Set SPORTSAPI_PRO_FOOTBALL_RAPIDAPI_KEY or X_RAPIDAPI_KEY or RAPIDAPI_KEY.'
        );
    }

    return {
        host,
        key,
        baseUrl: `https://${host}`
    };
}

function extractRateLimit(headers) {
    const source = headers && typeof headers === 'object' ? headers : {};
    const pick = (name) => {
        const lowerName = String(name).toLowerCase();
        const value = source[name] ?? source[lowerName];
        if (value === undefined || value === null || value === '') return null;
        return String(value);
    };

    return {
        requestsLimit: pick('x-ratelimit-requests-limit'),
        requestsRemaining: pick('x-ratelimit-requests-remaining'),
        requestsReset: pick('x-ratelimit-requests-reset'),
        rapidFreeLimit: pick('x-ratelimit-rapid-free-plans-hard-limit-limit'),
        rapidFreeRemaining: pick('x-ratelimit-rapid-free-plans-hard-limit-remaining'),
        rapidFreeReset: pick('x-ratelimit-rapid-free-plans-hard-limit-reset')
    };
}

async function requestSportsApiProFootball(path, params = {}) {
    const endpoint = String(path || '').trim();
    const safeParams = params && typeof params === 'object' ? params : {};

    if (!endpoint || !endpoint.startsWith('/')) {
        return {
            ok: false,
            endpoint: endpoint || null,
            params: safeParams,
            status: null,
            message: 'Endpoint path must begin with "/".',
            rateLimit: null,
            data: null
        };
    }

    const { host, key, baseUrl } = getConfig();

    try {
        const response = await axios.get(`${baseUrl}${endpoint}`, {
            params: safeParams,
            timeout: DEFAULT_TIMEOUT_MS,
            validateStatus: () => true,
            headers: {
                'Content-Type': 'application/json',
                'x-rapidapi-host': host,
                'x-rapidapi-key': key
            }
        });

        const status = Number(response?.status) || null;
        const rateLimit = extractRateLimit(response?.headers);

        if (status >= 200 && status < 300) {
            return {
                ok: true,
                endpoint,
                params: safeParams,
                status,
                rateLimit,
                data: response?.data
            };
        }

        return {
            ok: false,
            endpoint,
            params: safeParams,
            status,
            message: `HTTP ${status || 'unknown'} from provider`,
            rateLimit,
            data: response?.data
        };
    } catch (error) {
        const status = Number(error?.response?.status) || null;
        return {
            ok: false,
            endpoint,
            params: safeParams,
            status,
            message: error?.message || 'Provider request failed',
            rateLimit: extractRateLimit(error?.response?.headers),
            data: error?.response?.data ?? null
        };
    }
}

function healthCheck() {
    return requestSportsApiProFootball('/health', {});
}

function getStatus() {
    return requestSportsApiProFootball('/status', {});
}

function getFixtures(params = {}) {
    return requestSportsApiProFootball('/games/fixtures', params);
}

function getAllScores(params = {}) {
    return requestSportsApiProFootball('/games/allscores', params);
}

function getSuggestions(params = {}) {
    return requestSportsApiProFootball('/games/suggestions', params);
}

function getCurrentGames(params = {}) {
    return requestSportsApiProFootball('/games/current', params);
}

function getH2H(params = {}) {
    return requestSportsApiProFootball('/games/h2h', params);
}

function getResults(params = {}) {
    return requestSportsApiProFootball('/games/results', params);
}

function getGame(params = {}) {
    return requestSportsApiProFootball('/game', params);
}

function getCommentary(params = {}) {
    return requestSportsApiProFootball('/games/commentary', params);
}

function getHighlights(params = {}) {
    return requestSportsApiProFootball('/games/highlights', params);
}

function getPredictions(params = {}) {
    return requestSportsApiProFootball('/games/predictions', params);
}

function getTopCompetitions(params = {}) {
    return requestSportsApiProFootball('/competitions/top', params);
}

function getFeaturedCompetitions(params = {}) {
    return requestSportsApiProFootball('/competitions/featured', params);
}

function getCompetitions(params = {}) {
    return requestSportsApiProFootball('/competitions', params);
}

function getRecentForm(params = {}) {
    return requestSportsApiProFootball('/competitors/recentForm', params);
}

function getTopCompetitors(params = {}) {
    return requestSportsApiProFootball('/competitors/top', params);
}

function getSquads(params = {}) {
    return requestSportsApiProFootball('/squads', params);
}

function getTopAthletes(params = {}) {
    return requestSportsApiProFootball('/athletes/top', params);
}

function getAthleteNextGame(params = {}) {
    return requestSportsApiProFootball('/athletes/nextGame', params);
}

function getAthleteGameLineups(params = {}) {
    return requestSportsApiProFootball('/athletes/games/lineups', params);
}

function getStandings(params = {}) {
    return requestSportsApiProFootball('/standings', params);
}

function getBetTrends(params = {}) {
    return requestSportsApiProFootball('/bets/trends', params);
}

function getBetProposition(params = {}) {
    return requestSportsApiProFootball('/bets/proposition', params);
}

function getBetLines(params = {}) {
    return requestSportsApiProFootball('/bets/lines', params);
}

function getBetTeaser(params = {}) {
    return requestSportsApiProFootball('/bets/teaser', params);
}

function getBetOutrights(params = {}) {
    return requestSportsApiProFootball('/bets/outrights', params);
}

function getStats(params = {}) {
    return requestSportsApiProFootball('/stats', params);
}

function getPreGameStats(params = {}) {
    return requestSportsApiProFootball('/stats/preGame', params);
}

function getGameStats(params = {}) {
    return requestSportsApiProFootball('/games/stats', params);
}

function getTransfers(params = {}) {
    return requestSportsApiProFootball('/transfers', params);
}

function getBrackets(params = {}) {
    return requestSportsApiProFootball('/brackets', params);
}

module.exports = {
    requestSportsApiProFootball,
    healthCheck,
    getStatus,
    getFixtures,
    getAllScores,
    getSuggestions,
    getCurrentGames,
    getH2H,
    getResults,
    getGame,
    getCommentary,
    getHighlights,
    getPredictions,
    getTopCompetitions,
    getFeaturedCompetitions,
    getCompetitions,
    getRecentForm,
    getTopCompetitors,
    getSquads,
    getTopAthletes,
    getAthleteNextGame,
    getAthleteGameLineups,
    getStandings,
    getBetTrends,
    getBetProposition,
    getBetLines,
    getBetTeaser,
    getBetOutrights,
    getStats,
    getPreGameStats,
    getGameStats,
    getTransfers,
    getBrackets
};

