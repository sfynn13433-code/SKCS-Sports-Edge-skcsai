'use strict';

const axios = require('axios');
const config = require('../config');
const { APISportsClient, OddsAPIClient, SportsDataOrgClient, SportsDataIOClient, RapidAPIClient, CricketDataClient } = require('../apiClients');

const SUPPORTED_LEAGUES = ['4328', '4332', '4331', '4335', '4334', '4387', '4424', '4380', '4391'];
const LEAGUE_SPORT_MAP = {
    '4328': 'football',          // EPL
    '4332': 'football',          // Serie A
    '4331': 'football',          // Bundesliga
    '4335': 'football',          // La Liga
    '4334': 'football',          // Ligue 1
    '4387': 'basketball',        // NBA
    '4424': 'baseball',          // MLB
    '4380': 'hockey',            // NHL
    '4391': 'american_football'  // NFL
};
const THESPORTSDB_SUPPORTED_SPORTS = new Set(Object.values(LEAGUE_SPORT_MAP));

const THESPORTSDB_BASE_URL = 'https://www.thesportsdb.com/api/v1/json';
const THESPORTSDB_DELAY_MS = 500;

const sportsClient = axios.create({
    baseURL: THESPORTSDB_BASE_URL,
    timeout: 15000
});

const SPORT_KEY_MAP = {
    'soccer_epl': 'football',
    'soccer_england_efl_cup': 'football',
    'soccer_uefa_champs_league': 'football',
    'basketball_nba': 'basketball',
    'basketball_euroleague': 'basketball',
    'americanfootball_nfl': 'nfl',
    'icehockey_nhl': 'hockey',
    'baseball_mlb': 'baseball',
    'mma_mixed_martial_arts': 'mma',
    'aussierules_afl': 'afl',
    'rugbyunion_six_nations': 'rugby',
    'rugbyunion_international': 'rugby'
};

function normalizeSportKey(sportKey) {
    return SPORT_KEY_MAP[sportKey] || sportKey;
}

function normalizeMode(mode) {
    if (mode === 'test' || mode === 'live') return mode;
    throw new Error(`Invalid DATA_MODE: ${mode}`);
}

function humanizeCompetitionLabel(value) {
    const key = String(value || '').trim();
    if (!key) return null;

    const aliases = {
        soccer_epl: 'Premier League',
        soccer_england_efl_cup: 'EFL Cup',
        soccer_uefa_champs_league: 'UEFA Champions League',
        soccer_uefa_europa_league: 'UEFA Europa League',
        soccer_spain_la_liga: 'La Liga',
        soccer_germany_bundesliga: 'Bundesliga',
        soccer_italy_serie_a: 'Serie A',
        soccer_france_ligue_one: 'Ligue 1',
        basketball_nba: 'NBA',
        basketball_euroleague: 'EuroLeague',
        americanfootball_nfl: 'NFL',
        icehockey_nhl: 'NHL',
        baseball_mlb: 'MLB',
        mma_mixed_martial_arts: 'MMA',
        aussierules_afl: 'AFL',
        rugbyunion_international: 'International Rugby',
        rugbyunion_six_nations: 'Six Nations'
    };

    if (aliases[key]) return aliases[key];

    return key
        .split('_')
        .filter(Boolean)
        .map(part => part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveInt(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const rounded = Math.floor(n);
    return Math.max(min, Math.min(max, rounded));
}

function normalizeRequestedSport(sport) {
    const key = String(sport || '').trim().toLowerCase();
    if (!key) return null;
    if (key === 'nba') return 'basketball';
    if (key === 'mlb') return 'baseball';
    if (key === 'nhl') return 'hockey';
    if (key === 'nfl') return 'american_football';
    if (key === 'motorsport') return 'formula1';
    if (key === 'formula-1' || key === 'formula_1') return 'formula1';
    if (key === 'american-football') return 'american_football';
    return key;
}

function dedupePredictionInputs(rows) {
    const out = [];
    const seen = new Set();
    for (const row of Array.isArray(rows) ? rows : []) {
        if (!row) continue;
        const sport = normalizeRequestedSport(row.sport) || String(row.sport || '').trim().toLowerCase();
        const matchId = String(row.match_id || '').trim();
        const kickoff = String(row.date || row.commence_time || row.kickoff || row.match_time || '').trim();
        if (!sport || !matchId) continue;
        const key = `${sport}|${matchId}|${kickoff}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(row);
    }
    return out;
}

function normalizeTheSportsDbStartTime(event) {
    const timestamp = String(event?.strTimestamp || '').trim();
    if (timestamp) {
        const parsedTimestamp = new Date(timestamp);
        if (!Number.isNaN(parsedTimestamp.getTime())) {
            return parsedTimestamp.toISOString();
        }
    }

    const dateValue = String(event?.dateEvent || '').trim();
    const timeValue = String(event?.strTime || '').trim();
    if (dateValue && timeValue) {
        const composed = new Date(`${dateValue}T${timeValue}`);
        if (!Number.isNaN(composed.getTime())) {
            return composed.toISOString();
        }
    }

    if (dateValue) {
        const dateOnly = new Date(`${dateValue}T00:00:00Z`);
        if (!Number.isNaN(dateOnly.getTime())) {
            return dateOnly.toISOString();
        }
    }

    return null;
}

function mapTheSportsDbFixture(event, fallbackLeagueId) {
    const leagueId = String(event?.idLeague || fallbackLeagueId || '').trim();
    const fixtureId = String(event?.idEvent || '').trim();

    if (!leagueId || !fixtureId) return null;

    const homeTeam = event?.strHomeTeam || null;
    const awayTeam = event?.strAwayTeam || null;
    if (!homeTeam || !awayTeam) {
        console.warn(`[dataProvider] Skipping TheSportsDB fixture ${fixtureId}: missing team name (home=${homeTeam}, away=${awayTeam})`);
        return null;
    }

    return {
        fixture_id: fixtureId,
        league_id: leagueId,
        home_team: homeTeam,
        away_team: awayTeam,
        start_time: normalizeTheSportsDbStartTime(event),
        status: 'NS',
        league_name: event?.strLeague || event?.strLeagueAlternate || null,
        country: event?.strCountry || null,
        home_logo: event?.strHomeTeamBadge || event?.strHomeBadge || event?.strHomeLogo || null,
        away_logo: event?.strAwayTeamBadge || event?.strAwayBadge || event?.strAwayLogo || null,
        sport: LEAGUE_SPORT_MAP[leagueId] || 'football',
        raw_provider_data: event
    };
}

function toPredictionInputFromSportsDbFixture(fixture) {
    return {
        match_id: `tsdb-${fixture.fixture_id}`,
        sport: fixture.sport || 'football',
        home_team: fixture.home_team,
        away_team: fixture.away_team,
        date: fixture.start_time,
        status: fixture.status,
        market: '1X2',
        prediction: null,
        confidence: null,
        volatility: null,
        odds: null,
        provider: 'the-sports-db',
        provider_name: 'TheSportsDB',
        league: fixture.league_name || null,
        country: fixture.country || null,
        league_id: fixture.league_id,
        home_logo: fixture.home_logo || null,
        away_logo: fixture.away_logo || null,
        raw_provider_data: fixture.raw_provider_data || null
    };
}

async function fetchUpcomingFixtures(options = {}) {
    const sportsDbKey = String(config.sportsDbKey || '').trim();
    if (!sportsDbKey) {
        throw new Error('TheSportsDB key is missing (SPORTS_DB_KEY)');
    }

    const requestedLeagueIds = Array.isArray(options.leagueIds) && options.leagueIds.length > 0
        ? options.leagueIds.map((id) => String(id || '').trim()).filter(Boolean)
        : SUPPORTED_LEAGUES;
    const uniqueLeagueIds = [...new Set(requestedLeagueIds)];

    const out = [];

    for (let i = 0; i < uniqueLeagueIds.length; i++) {
        const leagueId = uniqueLeagueIds[i];
        try {
            const response = await sportsClient.get(`/${sportsDbKey}/eventsnextleague.php`, {
                params: { id: leagueId }
            });
            const events = Array.isArray(response.data?.events) ? response.data.events : [];
            const mapped = events
                .map((event) => mapTheSportsDbFixture(event, leagueId))
                .filter(Boolean);

            out.push(...mapped);
            console.log(`[dataProvider] TheSportsDB league=${leagueId} fixtures=${mapped.length}`);
        } catch (error) {
            console.error(`[dataProvider] TheSportsDB league=${leagueId} failed:`, error.message);
        }

        if (i < uniqueLeagueIds.length - 1) {
            await sleep(THESPORTSDB_DELAY_MS);
        }
    }

    return out;
}

function derivePredictionFromH2HOutcomes(event) {
    const bookmakers = Array.isArray(event?.bookmakers) ? event.bookmakers : [];

    for (const bookmaker of bookmakers) {
        const markets = Array.isArray(bookmaker?.markets) ? bookmaker.markets : [];
        const h2h = markets.find((market) => market?.key === 'h2h');
        const outcomes = Array.isArray(h2h?.outcomes) ? h2h.outcomes : [];
        if (outcomes.length < 2) continue;

        const ranked = outcomes
            .filter((outcome) => typeof outcome?.price === 'number' && Number.isFinite(outcome.price))
            .sort((a, b) => a.price - b.price);

        const best = ranked[0];
        const second = ranked[1] || null;
        if (!best) continue;

        const bestName = String(best.name || '').trim();
        const prediction = bestName === event.home_team
            ? 'home_win'
            : bestName === event.away_team
                ? 'away_win'
                : null;

        if (!prediction) continue;

        const gap = second ? Math.max(0, second.price - best.price) : 0.2;
        const confidence = Math.max(55, Math.min(92, 57 + gap * 40));
        const volatility = confidence >= 72 ? 'low' : confidence >= 64 ? 'medium' : 'high';

        return {
            prediction,
            confidence: Math.round(confidence * 100) / 100,
            volatility,
            bookmaker: bookmaker.title || null
        };
    }

    return null;
}

function buildTestData() {
    // 8 deterministic test entries
    return [
        { match_id: 'test-001', sport: 'football', home_team: 'Arsenal', away_team: 'Chelsea', market: '1X2', prediction: 'home_win', odds: 1.85 },
        { match_id: 'test-002', sport: 'football', home_team: 'Liverpool', away_team: 'Everton', market: 'double_chance', prediction: 'home_or_draw', odds: 1.25 },
        { match_id: 'test-003', sport: 'football', home_team: 'Barcelona', away_team: 'Atletico', market: 'over_2_5', prediction: 'over_2_5', odds: 1.95 },
        { match_id: 'test-004', sport: 'football', home_team: 'Inter', away_team: 'Juventus', market: 'btts_yes', prediction: 'btts_yes', odds: 1.90 },
        { match_id: 'test-005', sport: 'basketball', home_team: 'Lakers', away_team: 'Warriors', market: '1X2', prediction: 'home_win', odds: 1.70 },
        { match_id: 'test-006', sport: 'football', home_team: 'PSG', away_team: 'Marseille', market: 'over_2_5', prediction: 'over_2_5', odds: 1.80 },
        { match_id: 'test-007', sport: 'football', home_team: 'Bayern', away_team: 'Dortmund', market: 'btts_yes', prediction: 'btts_yes', odds: 1.75 },
        { match_id: 'test-008', sport: 'football', home_team: 'Ajax', away_team: 'Feyenoord', market: 'double_chance', prediction: 'home_or_draw', odds: 1.35 }
    ].map(p => ({
        ...p,
        confidence: null,
        volatility: null
    }));
}

async function fetchOddsData(sportKey) {
    const client = new OddsAPIClient();
    const data = await client.getOdds(sportKey);
    if (!data) return [];

    const normalizedSport = normalizeSportKey(sportKey);

    const out = [];
    for (const event of data) {
        const homeTeam = event.home_team || null;
        const awayTeam = event.away_team || null;
        if (!homeTeam || !awayTeam) {
            console.warn(`[dataProvider] Skipping OddsAPI event ${event.id}: missing team name (home=${homeTeam}, away=${awayTeam})`);
            continue;
        }

        const marketView = derivePredictionFromH2HOutcomes(event);
        out.push({
        match_id: `odds-${event.id}`,
        sport: normalizedSport,
        home_team: homeTeam,
        away_team: awayTeam,
        date: event.commence_time || null,
        market: '1X2',
        prediction: marketView?.prediction || null,
        confidence: marketView?.confidence || null,
        volatility: marketView?.volatility || null,
        odds: null,
        provider: 'odds-api',
        provider_name: 'odds-api',
        league: event.sport_title || humanizeCompetitionLabel(sportKey),
        bookmaker: marketView?.bookmaker || null,
        raw_provider_data: event
        });
    }

    return out;
}

async function fetchSportsDataOrg(sport, leagueCode) {
    const client = new SportsDataOrgClient();
    const data = await client.getFixtures(sport, leagueCode);
    if (!data || data.length === 0) return [];

    return data.map(match => client.normalizeFixture(match, sport));
}

async function fetchSportsDataIO(sport) {
    const client = new SportsDataIOClient();
    const data = await client.getFixtures(sport);
    if (!data || data.length === 0) return [];

    return data.map(game => client.normalizeFixture(game, sport));
}

async function fetchRapidAPI(sport, leagueId, season) {
    const client = new RapidAPIClient();
    const data = await client.getFixtures(sport, leagueId, season);
    if (!data || data.length === 0) return [];

    return data.map(f => client.normalizeFixture(f, sport));
}

async function fetchCricketData() {
    const client = new CricketDataClient();
    const data = await client.getFixtures();
    if (!data || data.length === 0) return [];

    return data.map(match => client.normalizeFixture(match));
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function futureStr(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

function normalizeFixture(f, sport) {
    // Football v3 format
    if (f?.fixture?.id) {
        const homeTeam = f.teams?.home?.name || null;
        const awayTeam = f.teams?.away?.name || null;
        if (!homeTeam || !awayTeam) {
            console.warn(`[dataProvider] Skipping fixture ${f.fixture.id}: missing team name (home=${homeTeam}, away=${awayTeam})`);
            return null;
        }
        return {
            match_id: String(f.fixture.id),
            sport,
            home_team: homeTeam,
            away_team: awayTeam,
            date: f.fixture?.date || null,
            status: f.fixture?.status?.short || null,
            market: '1X2',
            prediction: null,
            confidence: null,
            volatility: null,
        odds: null,
        provider: 'api-sports',
        provider_name: 'api-sports',
        league: f.league?.name || null,
        country: f.league?.country || null,
        round: f.league?.round || null,
        venue: f.fixture?.venue?.name || null,
        raw_provider_data: f
    };
    }
    // Other sports v1/v2 format (games, races, fights)
    const id = f.id || f.game?.id || f.fight?.id || f.race?.id;
    const home = f.teams?.home?.name || f.players?.home?.name || f.competitors?.[0]?.name || null;
    const away = f.teams?.away?.name || f.players?.away?.name || f.competitors?.[1]?.name || null;
    const date = f.date || f.game?.date || f.fight?.date || f.race?.date || null;
    const status = f.status?.short || f.game?.status?.short || null;
    const league = f.league?.name || f.competition?.name || f.tournament?.name || humanizeCompetitionLabel(sport);
    const country = f.league?.country || f.country || f.competition?.country || null;
    const venue = f.venue?.name || f.game?.venue?.name || f.race?.circuit?.name || null;

    if (!home || !away) {
        console.warn(`[dataProvider] Skipping fixture: missing team name (home=${home}, away=${away})`);
        return null;
    }

    return {
        match_id: id ? String(id) : `live-${sport}-${home}-${away}`,
        sport,
        home_team: home,
        away_team: away,
        date,
        status,
        market: '1X2',
        prediction: null,
        confidence: null,
        volatility: null,
        odds: null,
        provider: 'api-sports',
        provider_name: 'api-sports',
        league,
        country,
        venue,
        stage: f.stage || f.competition?.stage || f.tournament?.stage || null,
        raw_provider_data: f
    };
}

async function buildLiveData(options = {}) {
    const sport = options.sport || 'football';
    const leagueId = options.leagueId || null;
    const season = options.season || null;
    const today = todayStr();
    const requestedWindowDays = Number(options.windowDays ?? process.env.LIVE_FETCH_WINDOW_DAYS ?? 3);
    const windowDays = Number.isFinite(requestedWindowDays)
        ? parsePositiveInt(requestedWindowDays, 3, 1, 14)
        : 3;
    const windowEnd = futureStr(windowDays);
    const maxFixturesPerSource = parsePositiveInt(
        process.env.LIVE_MAX_FIXTURES_PER_SOURCE,
        600,
        80,
        2000
    );
    const requestedLeagueId = leagueId ? String(leagueId).trim() : null;
    const isSupportedLeagueId = requestedLeagueId ? SUPPORTED_LEAGUES.includes(requestedLeagueId) : false;
    const requestedSport = normalizeRequestedSport(sport);
    const includeAllSports = String(sport || '').toLowerCase() === 'all';
    const shouldFetchAllLeagues = !requestedLeagueId || String(sport || '').toLowerCase() === 'all';
    const useTheSportsDbForSport = includeAllSports
        || !requestedSport
        || THESPORTSDB_SUPPORTED_SPORTS.has(requestedSport);
    const leagueIdsForSportsDb = useTheSportsDbForSport && shouldFetchAllLeagues
        ? SUPPORTED_LEAGUES
        : (useTheSportsDbForSport && isSupportedLeagueId ? [requestedLeagueId] : []);

    const client = new APISportsClient();

    // --- Source 0: TheSportsDB (primary for supported multi-league ingestion) ---
    if (leagueIdsForSportsDb.length > 0) {
        try {
            console.log(`[dataProvider] ${sport}: fetching TheSportsDB leagues=${leagueIdsForSportsDb.join(',')}`);
            const fixtures = await fetchUpcomingFixtures({ leagueIds: leagueIdsForSportsDb });
            const filteredFixtures = fixtures.filter((fixture) => (
                includeAllSports || !requestedSport || normalizeRequestedSport(fixture.sport) === requestedSport
            ));

            if (filteredFixtures.length > 0) {
                const out = dedupePredictionInputs(filteredFixtures
                    .slice(0, maxFixturesPerSource)
                    .map(toPredictionInputFromSportsDbFixture));
                console.log(`[dataProvider] ${sport}: TheSportsDB fetched=${filteredFixtures.length} returned=${out.length}`);
                if (out.length > 0) return out;
            }

            console.warn(`[dataProvider] ${sport}: 0 fixtures from TheSportsDB`);
        } catch (error) {
            console.error(`[dataProvider] ${sport}: TheSportsDB error:`, error.message);
        }
    }

    // --- Source 1: API-Sports (primary) ---
    try {
        const queryOpts = { from: today, to: windowEnd };

        console.log(`[dataProvider] ${sport}: Fetching fixtures for league=${leagueId}, season=${season}, dateRange=${today} to ${windowEnd} (${windowDays * 24}h window)`);
        
        let data = await client.getFixtures(leagueId, season, queryOpts, sport);
        let fixtures = data?.response || [];

        if (fixtures.length === 0 && sport !== 'football') {
            console.log(`[dataProvider] ${sport}: No fixtures found with date range, trying single-day query`);
            data = await client.getFixtures(leagueId, season, { date: today }, sport);
            fixtures = data?.response || [];
        }

        if (fixtures.length > 0) {
            const out = dedupePredictionInputs(
                fixtures
                    .slice(0, maxFixturesPerSource)
                    .map(f => normalizeFixture(f, sport))
                    .filter(Boolean)
            );
            console.log(`[dataProvider] ${sport}: API-Sports fetched=${fixtures.length} returned=${out.length}`);
            if (out.length > 0) return out;
        }

        console.warn(`[dataProvider] ${sport}: 0 fixtures from API-Sports`);
    } catch (error) {
        console.error(`[dataProvider] ${sport}: API-Sports ERROR:`, error.message);
    }

    // --- Source 2: Odds API (fallback) ---
    const oddsKey = options.oddsKey;
    if (oddsKey) {
        try {
            console.log(`[dataProvider] ${sport}: trying Odds API fallback (${oddsKey})`);
            const oddsData = await fetchOddsData(oddsKey);
            if (oddsData.length > 0) {
                const out = dedupePredictionInputs(oddsData);
                console.log(`[dataProvider] ${sport}: Odds API returned ${out.length} events`);
                if (out.length > 0) return out;
            }
        } catch (oddsErr) {
            console.error(`[dataProvider] ${sport}: Odds API fallback failed:`, oddsErr.message);
        }
    }

    // --- Source 3: FootballData.org (fallback) ---
    if (normalizeRequestedSport(sport) === 'football') {
        try {
            console.log(`[dataProvider] ${sport}: trying FootballData.org fallback`);
            const sdoData = await fetchSportsDataOrg(sport, leagueId);
            if (sdoData.length > 0) {
                const out = dedupePredictionInputs(sdoData);
                console.log(`[dataProvider] ${sport}: FootballData.org returned ${out.length} events`);
                if (out.length > 0) return out;
            }
        } catch (sdoErr) {
            console.error(`[dataProvider] ${sport}: FootballData.org fallback failed:`, sdoErr.message);
        }
    }

    // --- Source 4: SportsData.io (fallback) ---
    try {
        console.log(`[dataProvider] ${sport}: trying SportsData.io fallback`);
        const sdiData = await fetchSportsDataIO(sport);
        if (sdiData.length > 0) {
            const out = dedupePredictionInputs(sdiData);
            console.log(`[dataProvider] ${sport}: SportsData.io returned ${out.length} events`);
            if (out.length > 0) return out;
        }
    } catch (sdiErr) {
        console.error(`[dataProvider] ${sport}: SportsData.io fallback failed:`, sdiErr.message);
    }

    // --- Source 5: RapidAPI (fallback) ---
    try {
        console.log(`[dataProvider] ${sport}: trying RapidAPI fallback`);
        const rapidData = await fetchRapidAPI(sport, leagueId, season);
        if (rapidData.length > 0) {
            const out = dedupePredictionInputs(rapidData);
            console.log(`[dataProvider] ${sport}: RapidAPI returned ${out.length} events`);
            if (out.length > 0) return out;
        }
    } catch (rapidErr) {
        console.error(`[dataProvider] ${sport}: RapidAPI fallback failed:`, rapidErr.message);
    }

    // --- Source 6: CricketData (cricket-specific fallback) ---
    if (sport === 'cricket') {
        try {
            console.log(`[dataProvider] cricket: trying CricketData API fallback`);
            const cricketData = await fetchCricketData();
            if (cricketData.length > 0) {
                const out = dedupePredictionInputs(cricketData);
                console.log(`[dataProvider] cricket: CricketData API returned ${out.length} events`);
                if (out.length > 0) return out;
            }
        } catch (cricketErr) {
            console.error(`[dataProvider] cricket: CricketData API fallback failed:`, cricketErr.message);
        }
    }

    console.warn(`[dataProvider] ${sport}: All data sources exhausted, returning empty`);
    return [];
}

async function getPredictionInputs(options = {}) {
    const mode = normalizeMode(config.DATA_MODE);

    if (mode === 'test') {
        const data = buildTestData();
        console.log('[dataProvider] mode=test returned=%s', data.length);
        return { mode, predictions: data };
    }

    const data = await buildLiveData(options);
    return { mode, predictions: data };
}

module.exports = {
    SUPPORTED_LEAGUES,
    fetchUpcomingFixtures,
    getPredictionInputs,
    buildLiveData
};
