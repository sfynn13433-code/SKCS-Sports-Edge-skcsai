const axios = require('axios');
const config = require('./config');
const { fetchRapidApiCustom, getRapidApiProviderForSport, getRapidApiHostCandidates } = require('./services/dataProviders');
const { getApiSportsKeyPool, maskKey } = require('./utils/keyPool');
const {
    shouldAllowOddsCall,
    consumeOddsCallSlot,
    applyOddsProviderHeaders
} = require('./services/oddsBudgetService');
const {
    shouldAllow: circuitShouldAllow,
    recordFailure: circuitRecordFailure,
    recordSuccess: circuitRecordSuccess
} = require('./utils/providerCircuitBreaker');

class APISportsClient {
    constructor() {
        this.apiKey = config.apiSportsKey;
    }

    getBaseUrl(sport) {
        const urls = {
            Football:         'https://v3.football.api-sports.io',
            afl:              'https://v1.afl.api-sports.io',
            MLB:         'https://v1.baseball.api-sports.io',
            Basketball:       'https://v1.basketball.api-sports.io',
            cricket:          'https://v1.cricket.api-sports.io',
            formula1:         'https://v1.formula-1.api-sports.io',
            handball:         'https://v1.handball.api-sports.io',
            NHL:           'https://v1.hockey.api-sports.io',
            mma:              'https://v1.mma.api-sports.io',
            nba:              'https://v2.nba.api-sports.io',
            american_Football:'https://v1.american-football.api-sports.io',
            rugby:            'https://v1.rugby.api-sports.io',
            tennis:           'https://v1.tennis.api-sports.io',
            volleyball:       'https://v1.volleyball.api-sports.io'
        };
        return urls[sport] || urls.Football;
    }

    getHostForSport(sport) {
        return this.getBaseUrl(sport).replace(/^https?:\/\//, '');
    }

    getEnvPrefixForSport(sport) {
        const prefixes = {
            Football: 'API_FOOTBALL_KEY',
            Basketball: 'API_BASKETBALL_KEY',
            nba: 'API_NBA_KEY',
            afl: 'API_AFL_KEY',
            MLB: 'API_BASEBALL_KEY',
            cricket: 'API_CRICKET_KEY',
            formula1: 'API_FORMULA1_KEY',
            handball: 'API_HANDBALL_KEY',
            NHL: 'API_HOCKEY_KEY',
            mma: 'API_MMA_KEY',
            american_Football: 'API_NFL_KEY',
            rugby: 'API_RUGBY_KEY',
            tennis: 'API_TENNIS_KEY',
            volleyball: 'API_VOLLEYBALL_KEY'
        };
        return prefixes[sport] || 'API_FOOTBALL_KEY';
    }

    getKeysForSport(sport) {
        return getApiSportsKeyPool({
            sport,
            fallbackKeys: [this.apiKey]
        });
    }

    hasQuotaErrorPayload(data) {
        const errors = data && data.errors ? data.errors : null;
        if (!errors || typeof errors !== 'object') return false;
        return Boolean(errors.requests || errors.token);
    }

    async requestWithRotation(sport, endpoint, params) {
        const baseUrl = this.getBaseUrl(sport);
        const keys = this.getKeysForSport(sport);

        if (!keys.length) {
            throw new Error(`No API keys configured for sport=${sport}`);
        }

        let lastError = null;
        for (let i = 0; i < keys.length; i += 1) {
            const key = keys[i];
            const host = this.getHostForSport(sport);
            const signature = `api-sports|${sport}|${host}|${endpoint}|${i + 1}`;
            if (!circuitShouldAllow(signature)) {
                console.warn(`[API-Sports] ${sport} key ${i + 1}/${keys.length} (${maskKey(key)}) circuit-open; skipping.`);
                continue;
            }
            const headers = {
                'x-apisports-key': key,
                'x-rapidapi-key': key,
                'x-rapidapi-host': host
            };

            try {
                const response = await axios.get(`${baseUrl}/${endpoint}`, {
                    headers,
                    params
                });

                if (this.hasQuotaErrorPayload(response.data)) {
                    console.warn(`[API-Sports] ${sport} key ${i + 1}/${keys.length} (${maskKey(key)}) exhausted. Rotating...`);
                    circuitRecordFailure(signature, 429);
                    lastError = new Error(`Quota/token exhausted for key index ${i + 1}`);
                    continue;
                }

                circuitRecordSuccess(signature);
                return response.data;
            } catch (error) {
                const status = Number(error?.response?.status || 0);
                const payload = error.response && error.response.data ? error.response.data : null;
                if (this.hasQuotaErrorPayload(payload)) {
                    console.warn(`[API-Sports] ${sport} key ${i + 1}/${keys.length} (${maskKey(key)}) exhausted via payload. Rotating...`);
                    circuitRecordFailure(signature, 429);
                    lastError = error;
                    continue;
                }
                if (status === 401 || status === 403 || status === 429) {
                    console.warn(`[API-Sports] ${sport} key ${i + 1}/${keys.length} (${maskKey(key)}) failed with HTTP ${status}. Rotating...`);
                    circuitRecordFailure(signature, status);
                    lastError = error;
                    continue;
                }

                // AI-DISABLED: Prevent burning through all keys on non-rotatable errors (e.g., 500s or Network Timeouts)
                // lastError = error;
                console.error(`[API-Sports] ${sport} encountered non-rotatable error (${status || 'Network/Timeout'}). Failing fast.`);
                throw error;
            }
        }

        throw new Error(
            `[API-Sports] all keys exhausted/failed for ${sport}: ${lastError ? lastError.message : 'unknown error'}`
        );
    }

    getEndpoint(sport) {
        const endpoints = {
            Football:         'fixtures',
            formula1:         'races',
            mma:              'fights'
        };
        return endpoints[sport] || 'games';
    }

    async getFixtures(leagueId, season, options = {}, sport = 'Football') {
        try {
            const endpoint = this.getEndpoint(sport);
            const params = {};

            if (leagueId) params.league = leagueId;
            if (season) params.season = season;
            if (options.from) params.from = options.from;
            if (options.to) params.to = options.to;
            if (options.date) params.date = options.date;
            if (options.page) params.page = options.page;

            console.log(`[API-Sports] ${sport}: ${endpoint}`, params);
            const data = await this.requestWithRotation(sport, endpoint, params);

            console.log(`[API-Sports] ${sport}: results=${data.results || 0}`);
            if (data.errors && Object.keys(data.errors).length > 0) {
                console.warn(`[API-Sports] ${sport} errors:`, data.errors);
            }

            return data;
        } catch (error) {
            console.error(`[API-Sports] ${sport} error:`, error.message);
            if (error.response) {
                console.error('Response data:', error.response.data);
            }
            return null;
        }
    }

    // NEW: Get teams for a league and season
    async getTeams(leagueId, season, sport = 'Football') {
        try {
            const params = { league: leagueId, season };

            console.log(`🌐 Calling API: ${sport}/teams`, params);
            const data = await this.requestWithRotation(sport, 'teams', params);

            if (data.errors && Object.keys(data.errors).length > 0) {
                console.log('⚠️ API errors:', data.errors);
            }
            console.log(`📊 Results count: ${data.results || 0}`);

            return data;
        } catch (error) {
            console.error('❌ API-Sports teams error:', error.message);
            if (error.response) {
                console.error('Response data:', error.response.data);
            }
            return null;
        }
    }

    async getTeamStats(leagueId, season, teamId, sport = 'Football') {
        try {
            return await this.requestWithRotation(sport, 'teams/statistics', {
                league: leagueId,
                season,
                team: teamId
            });
        } catch (error) {
            console.error('API-Sports team stats error:', error.message);
            return null;
        }
    }

    async getInjuries(leagueId, season, sport = 'Football') {
        try {
            return await this.requestWithRotation(sport, 'injuries', {
                league: leagueId,
                season
            });
        } catch (error) {
            console.error('API-Sports injuries error:', error.message);
            return null;
        }
    }

    async getHeadToHead(teamA, teamB, sport = 'Football') {
        try {
            const h2hParam = [teamA, teamB].sort((a, b) => a - b).join('-');
            return await this.requestWithRotation(sport, 'fixtures/headtohead', {
                h2h: h2hParam
            });
        } catch (error) {
            console.error('API-Sports H2H error:', error.message);
            return null;
        }
    }
}

class OddsAPIClient {
    constructor() {
        this.apiKey = config.oddsApiKey;
        this.baseUrl = 'https://api.the-odds-api.com/v4';
    }

    async getOdds(sportKey, regions = 'us', markets = 'h2h') {
        const budget = shouldAllowOddsCall();
        if (!budget.allowed) {
            console.warn(`[OddsAPI] skipped: ${budget.reason}`);
            return null;
        }

        try {
            consumeOddsCallSlot();
            const response = await axios.get(`${this.baseUrl}/sports/${sportKey}/odds`, {
                params: {
                    apiKey: this.apiKey,
                    regions,
                    markets
                }
            });
            applyOddsProviderHeaders(response?.headers || {});
            return response.data;
        } catch (error) {
            applyOddsProviderHeaders(error?.response?.headers || {});
            console.error('Odds API error:', error.message);
            return null;
        }
    }
}

class SportsDataOrgClient {
    constructor() {
        this.token = config.sportsDataOrgToken;
        this.baseUrl = 'https://api.football-data.org/v4';
    }

    getCompetitionCode(sport, leagueCode) {
        const codes = {
            '39': 'PL',
            '40': 'ELC',
            '140': 'PD',
            '141': 'PD',
            '78': 'BL1',
            '79': 'BL1',
            '135': 'SA',
            '136': 'SA',
            '61': 'FL1',
            '62': 'FL1',
            '2': 'CL',
            '3': 'EC',
            '82': 'DED',
            '83': 'DED',
            '71': 'PPL',
            '848': 'BSA',
            '1': 'WC',
        };
        return codes[leagueCode] || null;
    }

    async getFixtures(sport, leagueCode) {
        if (!this.token) {
            throw new Error('FootballData.org: X-Auth-Token not configured');
        }

        const normalizedSport = String(sport || '').trim().toLowerCase();
        if (normalizedSport !== 'Football') {
            console.log(`[FootballData.org] ${sport}: skipped (Football-only provider)`);
            return [];
        }

        const code = this.getCompetitionCode(sport, leagueCode);
        if (!code) {
            console.log(`[FootballData.org] ${sport}: skipped (unsupported league code ${leagueCode || 'n/a'})`);
            return [];
        }
        const url = `${this.baseUrl}/competitions/${code}/matches`;
        const today = new Date().toISOString().slice(0, 10);
        const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        try {
            const response = await axios.get(url, {
                headers: {
                    'X-Auth-Token': this.token,
                },
                params: {
                    dateFrom: today,
                    dateTo: futureDate,
                },
                timeout: 10000,
            });

            const matches = response.data?.matches || [];
            console.log(`[FootballData.org] ${sport} (${code}): returned ${matches.length} matches`);
            return matches;
        } catch (error) {
            console.error(`[FootballData.org] ${sport} error:`, error.message);
            if (error.response) {
                console.error(`[FootballData.org] Response:`, error.response.status, error.response.data);
            }
            return [];
        }
    }

    normalizeFixture(match, sport) {
        if (!match) return null;

        const homeTeam = match.homeTeam?.name || null;
        const awayTeam = match.awayTeam?.name || null;
        const date = match.utcDate || null;
        const status = match.status || null;
        const competition = match.competition?.name || match.competition?.code || null;
        const country = match.area?.name || match.competition?.area?.name || null;
        const venue = null;
        const id = match.id || null;

        return {
            match_id: id ? String(id) : `fdo-${sport}-${homeTeam}-${awayTeam}`,
            sport,
            home_team: homeTeam,
            away_team: awayTeam,
            date,
            status,
            market: '1X2',
            prediction: null,
            confidence: null,
            volatility: null,
            odds: null,
            provider: 'football-data-org',
            provider_name: 'FootballData.org',
            league: competition,
            country,
            venue,
            raw_provider_data: match,
        };
    }
}

class SportsDataIOClient {
    constructor() {
        this.apiKey = config.sportsDataIoKey;
        this.baseUrl = 'https://api.sportsdata.io/v3';
    }

    async getFixtures(sport) {
        if (!this.apiKey) {
            console.log(`[SportsData.io] ${sport}: skipped (missing SPORTSDATA_IO_KEY or SPORTS_DB_KEY)`);
            return [];
        }

        const sportMap = {
            Football: 'soccer',
            nba: 'nba',
            Basketball: 'basketball',
            nfl: 'nfl',
            american_Football: 'nfl',
            mlb: 'mlb',
            MLB: 'mlb',
            nhl: 'hockey',
            NHL: 'hockey',
        };

        const sportEndpoint = sportMap[sport];
        if (!sportEndpoint) {
            console.log(`[SportsData.io] ${sport}: skipped (unsupported sport mapping)`);
            return [];
        }
        const today = new Date().toISOString().slice(0, 10);
        const url = `${this.baseUrl}/${sportEndpoint}/scores/json/SchedulesByDate`;

        try {
            const response = await axios.get(url, {
                headers: {
                    'Ocp-Apim-Subscription-Key': this.apiKey,
                },
                params: {
                    date: today,
                },
                timeout: 10000,
            });

            console.log(`[SportsData.io] ${sport}: returned ${Array.isArray(response.data) ? response.data.length : 0} games`);
            return response.data || [];
        } catch (error) {
            console.error(`[SportsData.io] ${sport} error:`, error.message);
            if (error.response) {
                console.error(`[SportsData.io] Response:`, error.response.status, error.response.data);
            }
            return [];
        }
    }

    normalizeFixture(game, sport) {
        if (!game) return null;

        const homeTeam = game.HomeTeamName || null;
        const awayTeam = game.AwayTeamName || null;
        const date = game.DateTime || game.Date || null;
        const status = game.Status || null;
        const league = game.League || null;
        const country = game.Country || game.LeagueName || null;
        const venue = game.StadiumDetails?.Name || null;
        const id = game.GameID || null;

        return {
            match_id: id ? String(id) : `sdi-${sport}-${homeTeam}-${awayTeam}`,
            sport,
            home_team: homeTeam,
            away_team: awayTeam,
            date,
            status,
            market: '1X2',
            prediction: null,
            confidence: null,
            volatility: null,
            odds: null,
            provider: 'sportsdata-io',
            provider_name: 'SportsData.io',
            league,
            country,
            venue,
            raw_provider_data: game,
        };
    }
}

class RapidAPIClient {
    constructor() {
        this.apiKey = config.rapidApiKey;
        this.baseUrl = 'https://v3.football.api-sports.io';
        this.host = 'v3.football.api-sports.io';
    }

    getBaseUrlForSport(sport) {
        const urls = {
            Football: 'https://v3.football.api-sports.io',
            Basketball: 'https://v1.basketball.api-sports.io',
            MLB: 'https://v1.baseball.api-sports.io',
            NHL: 'https://v1.hockey.api-sports.io',
            rugby: 'https://v1.rugby.api-sports.io',
            american_Football: 'https://v1.american-football.api-sports.io',
            volleyball: 'https://v1.volleyball.api-sports.io',
            handball: 'https://v1.handball.api-sports.io',
            afl: 'https://v1.afl.api-sports.io',
            nba: 'https://v2.nba.api-sports.io',
            mma: 'https://v1.mma.api-sports.io',
            formula1: 'https://v1.formula-1.api-sports.io',
            cricket: 'https://v1.cricket.api-sports.io',
        };
        return urls[sport] || urls.Football;
    }

    getHostForSport(sport) {
        return this.getBaseUrlForSport(sport).replace(/^https?:\/\//, '');
    }

    getEndpointForSport(sport) {
        const endpoints = {
            Football: 'fixtures',
            Basketball: 'games',
            MLB: 'games',
            NHL: 'games',
            rugby: 'games',
            american_Football: 'games',
            volleyball: 'games',
            handball: 'games',
            afl: 'games',
            nba: 'games',
            mma: 'fights',
            formula1: 'races',
            cricket: 'fixtures',
        };
        return endpoints[sport] || 'fixtures';
    }

    async getFixtures(sport, leagueId, season) {
        const baseUrl = this.getBaseUrlForSport(sport);
        const host = this.getHostForSport(sport);
        const endpoint = this.getEndpointForSport(sport);
        const providerName = getRapidApiProviderForSport(sport);
        const hosts = getRapidApiHostCandidates({
            providerName,
            sport,
            defaultHost: host
        });
        const params = {};

        if (leagueId) params.league = leagueId;
        if (season) params.season = season;

        try {
            const payload = await fetchRapidApiCustom({
                providerName,
                endpointUrl: `${baseUrl}/${endpoint}`,
                host,
                hosts,
                sport,
                params
            });

            const fixtures = Array.isArray(payload?.response)
                ? payload.response
                : Array.isArray(payload?.data)
                    ? payload.data
                    : Array.isArray(payload)
                        ? payload
                        : [];

            console.log(`[RapidAPI] ${sport}: provider=${providerName}, returned ${fixtures.length} fixtures`);
            return fixtures;
        } catch (error) {
            console.error(`[RapidAPI] ${sport} error:`, error.message);
            return [];
        }
    }

    normalizeFixture(f, sport) {
        if (!f) return null;

        const id = f.fixture?.id || f.id || null;
        const homeTeam = f.teams?.home?.name || f.home_team || null;
        const awayTeam = f.teams?.away?.name || f.away_team || null;
        const date = f.fixture?.date || f.date || null;
        const status = f.fixture?.status?.short || f.status || null;
        const league = f.league?.name || f.league || null;
        const country = f.league?.country || f.country || null;
        const venue = f.fixture?.venue?.name || null;

        return {
            match_id: id ? String(id) : `rapidapi-${sport}-${homeTeam}-${awayTeam}`,
            sport,
            home_team: homeTeam,
            away_team: awayTeam,
            date,
            status,
            market: '1X2',
            prediction: null,
            confidence: null,
            volatility: null,
            odds: null,
            provider: 'rapidapi',
            provider_name: 'RapidAPI',
            league,
            country,
            venue,
            raw_provider_data: f,
        };
    }
}

class CricketDataClient {
    constructor() {
        this.apiKey = config.cricketDataApiKey;
        this.baseUrl = 'https://api.cricapi.com/v1';
    }

    async request(endpoint, params = {}) {
        if (!this.apiKey) {
            throw new Error('CricketData: CRICKETDATA_API_KEY not configured');
        }

        try {
            const response = await axios.get(`${this.baseUrl}/${endpoint}`, {
                params: {
                    apikey: this.apiKey,
                    ...params
                },
                timeout: 10000
            });

            if (response.data?.status !== 'success') {
                const reason = response.data?.reason || response.data?.message || 'unknown error';
                throw new Error(`CricketData ${endpoint} failed: ${reason}`);
            }

            return response.data?.data;
        } catch (error) {
            console.error(`[CricketData] ${endpoint} error:`, error.message);
            if (error.response) {
                console.error(`[CricketData] ${endpoint} response:`, error.response.status, error.response.data);
            }
            return null;
        }
    }

    async getFixtures() {
        const data = await this.request('matches', { offset: 0 });
        const rows = Array.isArray(data) ? data : [];
        console.log(`[CricketData] fixtures returned ${rows.length} matches`);
        return rows;
    }

    async getCurrentMatches(offset = 0) {
        const data = await this.request('currentMatches', { offset });
        const rows = Array.isArray(data) ? data : [];
        console.log(`[CricketData] currentMatches returned ${rows.length} matches`);
        return rows;
    }

    async getMatchInfo(matchId) {
        const id = String(matchId || '').trim();
        if (!id) return null;
        const data = await this.request('match_info', { id });
        return data && typeof data === 'object' ? data : null;
    }

    async getSeriesPointsTable(seriesId) {
        const id = String(seriesId || '').trim();
        if (!id) return null;
        const data = await this.request('series_pointsTable', { id });
        return data && typeof data === 'object' ? data : null;
    }

    async getSeriesSquad(seriesId) {
        const id = String(seriesId || '').trim();
        if (!id) return null;
        const data = await this.request('series_squad', { id });
        return data && typeof data === 'object' ? data : null;
    }

    normalizeFixture(match) {
        if (!match) return null;

        const id = match.id || match.match_id || null;
        const teams = match.teams || [];
        const homeTeam = teams[0] || match.team1 || null;
        const awayTeam = teams[1] || match.team2 || null;
        const date = match.dateTimeGMT || match.date || null;
        const status = match.matchStarted ? (match.matchEnded ? 'finished' : 'live') : 'scheduled';
        const league = match.name || match.tournament || null;
        const venue = match.venue || null;

        return {
            match_id: id ? String(id) : `cricket-${homeTeam}-${awayTeam}`,
            sport: 'cricket',
            home_team: homeTeam,
            away_team: awayTeam,
            date,
            status,
            market: 'match_winner',
            prediction: null,
            confidence: null,
            volatility: null,
            odds: null,
            provider: 'cricketdata',
            provider_name: 'CricketData API',
            league,
            venue,
            raw_provider_data: match,
        };
    }
}

module.exports = { APISportsClient, OddsAPIClient, SportsDataOrgClient, SportsDataIOClient, RapidAPIClient, CricketDataClient };
