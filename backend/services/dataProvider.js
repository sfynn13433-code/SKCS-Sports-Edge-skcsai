'use strict';

const config = require('../config');
const { APISportsClient, OddsAPIClient, SportsDataOrgClient, SportsDataIOClient, RapidAPIClient, CricketDataClient } = require('../apiClients');

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

    return data.map(event => {
        const marketView = derivePredictionFromH2HOutcomes(event);
        return {
        match_id: `odds-${event.id}`,
        sport: normalizedSport,
        home_team: event.home_team,
        away_team: event.away_team,
        date: event.commence_time || null,
        market: '1X2',
        prediction: marketView?.prediction || null,
        confidence: marketView?.confidence || null,
        volatility: marketView?.volatility || null,
        odds: null,
        provider: 'odds-api',
        provider_name: 'odds-api',
        league: event.sport_title || humanizeCompetitionLabel(sportKey),
        bookmaker: marketView?.bookmaker || null
        ,
        raw_provider_data: event
    };
    });
}

async function fetchSportsDataOrg(sport) {
    const client = new SportsDataOrgClient();
    const data = await client.getFixtures(sport);
    if (!data || data.length === 0) return [];

    return data.map(game => client.normalizeFixture(game, sport));
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
        return {
            match_id: String(f.fixture.id),
            sport,
            home_team: f.teams?.home?.name || null,
            away_team: f.teams?.away?.name || null,
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
    const venue = f.venue?.name || f.game?.venue?.name || f.race?.circuit?.name || null;

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
    const windowEnd = futureStr(7);
    const maxFixturesPerSource = 80;

    const client = new APISportsClient();

    // --- Source 1: API-Sports (primary) ---
    try {
        const queryOpts = { from: today, to: windowEnd };

        console.log(`[dataProvider] ${sport}: Fetching fixtures for league=${leagueId}, season=${season}, dateRange=${today} to ${windowEnd}`);
        
        let data = await client.getFixtures(leagueId, season, queryOpts, sport);
        let fixtures = data?.response || [];

        if (fixtures.length === 0 && sport !== 'football') {
            console.log(`[dataProvider] ${sport}: No fixtures found with date range, trying single-day query`);
            data = await client.getFixtures(leagueId, season, { date: today }, sport);
            fixtures = data?.response || [];
        }

        if (fixtures.length > 0) {
            const out = fixtures.slice(0, maxFixturesPerSource).map(f => normalizeFixture(f, sport));
            console.log(`[dataProvider] ${sport}: API-Sports fetched=${fixtures.length} returned=${out.length}`);
            return out;
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
                console.log(`[dataProvider] ${sport}: Odds API returned ${oddsData.length} events`);
                return oddsData;
            }
        } catch (oddsErr) {
            console.error(`[dataProvider] ${sport}: Odds API fallback failed:`, oddsErr.message);
        }
    }

    // --- Source 3: SportsData.org (fallback) ---
    try {
        console.log(`[dataProvider] ${sport}: trying SportsData.org fallback`);
        const sdoData = await fetchSportsDataOrg(sport);
        if (sdoData.length > 0) {
            console.log(`[dataProvider] ${sport}: SportsData.org returned ${sdoData.length} events`);
            return sdoData;
        }
    } catch (sdoErr) {
        console.error(`[dataProvider] ${sport}: SportsData.org fallback failed:`, sdoErr.message);
    }

    // --- Source 4: SportsData.io (fallback) ---
    try {
        console.log(`[dataProvider] ${sport}: trying SportsData.io fallback`);
        const sdiData = await fetchSportsDataIO(sport);
        if (sdiData.length > 0) {
            console.log(`[dataProvider] ${sport}: SportsData.io returned ${sdiData.length} events`);
            return sdiData;
        }
    } catch (sdiErr) {
        console.error(`[dataProvider] ${sport}: SportsData.io fallback failed:`, sdiErr.message);
    }

    // --- Source 5: RapidAPI (fallback) ---
    try {
        console.log(`[dataProvider] ${sport}: trying RapidAPI fallback`);
        const rapidData = await fetchRapidAPI(sport, leagueId, season);
        if (rapidData.length > 0) {
            console.log(`[dataProvider] ${sport}: RapidAPI returned ${rapidData.length} events`);
            return rapidData;
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
                console.log(`[dataProvider] cricket: CricketData API returned ${cricketData.length} events`);
                return cricketData;
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
    getPredictionInputs,
    buildLiveData
};
