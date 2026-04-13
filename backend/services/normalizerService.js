'use strict';

const SHARP_ODDS_KEYS = Object.freeze([
    'home_win',
    'draw',
    'away_win',
    'double_chance_1x',
    'double_chance_x2',
    'double_chance_12',
    'draw_no_bet_home',
    'draw_no_bet_away',
    'over_0_5',
    'over_1_5',
    'over_2_5',
    'over_3_5',
    'under_2_5',
    'under_3_5',
    'under_4_5',
    'home_over_0_5',
    'away_over_0_5',
    'home_over_1_5',
    'away_over_1_5',
    'btts_yes',
    'btts_no',
    'btts_over_2_5',
    'btts_under_3_5',
    'home_win_btts_yes',
    'away_win_btts_yes',
    'home_win_btts_no',
    'away_win_btts_no',
    'home_win_under_4_5',
    'away_win_under_4_5',
    'home_win_over_1_5',
    'away_win_over_1_5',
    'double_chance_over_1_5',
    'double_chance_under_3_5',
    'over_0_5_first_half',
    'under_1_5_first_half',
    'first_half_draw',
    'home_win_either_half',
    'away_win_either_half',
    'win_either_half',
    'team_to_score_first_home',
    'team_to_score_first_away'
]);

const MATCH_INFO_TEMPLATE = Object.freeze({
    match_id: null,
    league: null,
    country: null,
    season: null,
    kickoff: null,
    venue: null,
    home_team: null,
    away_team: null,
    home_team_id: null,
    away_team_id: null,
    referee: null,
    timezone: null
});

const SHARP_ODDS_TEMPLATE = Object.freeze(
    SHARP_ODDS_KEYS.reduce((acc, key) => {
        acc[key] = null;
        return acc;
    }, {})
);

const CONTEXT_TEMPLATE = Object.freeze({
    weather: null,
    injuries: [],
    suspensions: [],
    expected_lineups: [],
    confirmed_lineups: [],
    lineup_confirmed: false,
    morale: null,
    coach_conflict: false,
    boardroom_instability: false,
    discipline_risk: null,
    travel_fatigue: null,
    motivation_factor: null,
    fixture_congestion: null,
    derby_risk: null,
    rotation_risk: null,
    public_incidents: [],
    market_movement: null
});

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value, fallback = null) {
    const next = String(value === undefined || value === null ? '' : value).trim();
    return next.length ? next : fallback;
}

function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
}

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function toBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const key = value.trim().toLowerCase();
        if (!key) return fallback;
        if (key === 'true' || key === 'yes' || key === '1' || key === 'confirmed') return true;
        if (key === 'false' || key === 'no' || key === '0' || key === 'unconfirmed') return false;
    }
    return fallback;
}

function toIsoString(value) {
    if (!value) return null;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
}

function clampProbability(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (n > 1 && n <= 100) return Math.max(0, Math.min(1, n / 100));
    return Math.max(0, Math.min(1, n));
}

function getPath(source, path) {
    if (!source || !path) return undefined;
    const parts = Array.isArray(path) ? path : String(path).split('.');
    let current = source;
    for (const part of parts) {
        if (!current || typeof current !== 'object') return undefined;
        if (!(part in current)) return undefined;
        current = current[part];
    }
    return current;
}

function pickFirst(source, paths, fallback = null) {
    for (const path of paths) {
        const value = getPath(source, path);
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return fallback;
}

function pickFirstWithMatch(source, paths, fallback = null) {
    const expandedPaths = [];
    for (const path of paths) {
        const stringPath = Array.isArray(path) ? path.join('.') : String(path);
        expandedPaths.push(stringPath);
        expandedPaths.push(`match.${stringPath}`);
    }
    return pickFirst(source, expandedPaths, fallback);
}

function buildFallbackMatchId(raw, matchInfo) {
    const explicit = normalizeString(
        pickFirst(raw, [
            'match_id',
            'id',
            'fixture.id',
            'event.id',
            'game.id',
            'raw_provider_data.fixture.id',
            'raw_provider_data.id'
        ])
    );
    if (explicit) return explicit;

    const home = normalizeString(matchInfo.home_team, 'home');
    const away = normalizeString(matchInfo.away_team, 'away');
    const kickoff = normalizeString(matchInfo.kickoff, 'unknown');
    return `${home}__${away}__${kickoff}`.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function normalizeProvider(raw) {
    const provider = normalizeString(
        pickFirstWithMatch(raw, [
            'provider',
            'provider_name',
            'metadata.provider',
            'metadata.provider_name',
            'raw_provider_data.provider',
            'raw_provider_data.provider_name'
        ]),
        'unknown'
    );
    return provider.toLowerCase();
}

function normalizeSport(raw) {
    const key = normalizeString(
        pickFirstWithMatch(raw, ['sport', 'metadata.sport', 'raw_provider_data.sport']),
        'football'
    ).toLowerCase();
    if (key === 'soccer' || key.startsWith('soccer_')) return 'football';
    if (key === 'nba') return 'basketball';
    if (key === 'nfl') return 'american_football';
    if (key === 'mlb') return 'baseball';
    if (key === 'nhl') return 'hockey';
    return key;
}

function buildMatchInfo(raw) {
    const providerPayload = isObject(raw.raw_provider_data) ? raw.raw_provider_data : raw;
    const matchInfo = { ...MATCH_INFO_TEMPLATE };

    matchInfo.league = normalizeString(
        pickFirstWithMatch(raw, [
            'league',
            'competition',
            'tournament',
            'league_name',
            'metadata.league',
            'metadata.competition',
            'raw_provider_data.league.name',
            'raw_provider_data.competition.name',
            'raw_provider_data.tournament.name',
            'raw_provider_data.league'
        ])
    );

    matchInfo.country = normalizeString(
        pickFirstWithMatch(raw, [
            'country',
            'metadata.country',
            'raw_provider_data.league.country',
            'raw_provider_data.country'
        ])
    );

    matchInfo.season = normalizeString(
        pickFirstWithMatch(raw, [
            'season',
            'metadata.season',
            'raw_provider_data.league.season',
            'raw_provider_data.season'
        ])
    );

    matchInfo.kickoff = toIsoString(
        pickFirstWithMatch(raw, [
            'date',
            'kickoff',
            'kickoff_time',
            'match_time',
            'commence_time',
            'metadata.match_time',
            'metadata.kickoff',
            'raw_provider_data.fixture.date',
            'raw_provider_data.utcDate',
            'raw_provider_data.date',
            'raw_provider_data.game.date',
            'raw_provider_data.strTimestamp'
        ])
    );

    matchInfo.venue = normalizeString(
        pickFirstWithMatch(raw, [
            'venue',
            'location',
            'metadata.venue',
            'raw_provider_data.fixture.venue.name',
            'raw_provider_data.venue.name',
            'raw_provider_data.venue',
            'raw_provider_data.StadiumDetails.Name',
            'raw_provider_data.strVenue'
        ])
    );

    matchInfo.home_team = normalizeString(
        pickFirstWithMatch(raw, [
            'home_team',
            'homeTeam',
            'metadata.home_team',
            'raw_provider_data.teams.home.name',
            'raw_provider_data.home_team',
            'raw_provider_data.homeTeam.name',
            'raw_provider_data.homeTeam',
            'raw_provider_data.strHomeTeam',
            'raw_provider_data.HomeTeamName'
        ])
    );

    matchInfo.away_team = normalizeString(
        pickFirstWithMatch(raw, [
            'away_team',
            'awayTeam',
            'metadata.away_team',
            'raw_provider_data.teams.away.name',
            'raw_provider_data.away_team',
            'raw_provider_data.awayTeam.name',
            'raw_provider_data.awayTeam',
            'raw_provider_data.strAwayTeam',
            'raw_provider_data.AwayTeamName'
        ])
    );

    matchInfo.home_team_id = normalizeString(
        pickFirstWithMatch(raw, [
            'home_team_id',
            'metadata.home_team_id',
            'raw_provider_data.teams.home.id',
            'raw_provider_data.homeTeam.id',
            'raw_provider_data.HomeTeamID'
        ])
    );

    matchInfo.away_team_id = normalizeString(
        pickFirstWithMatch(raw, [
            'away_team_id',
            'metadata.away_team_id',
            'raw_provider_data.teams.away.id',
            'raw_provider_data.awayTeam.id',
            'raw_provider_data.AwayTeamID'
        ])
    );

    matchInfo.referee = normalizeString(
        pickFirstWithMatch(raw, [
            'referee',
            'metadata.referee',
            'raw_provider_data.fixture.referee',
            'raw_provider_data.referee'
        ])
    );

    matchInfo.timezone = normalizeString(
        pickFirstWithMatch(raw, [
            'timezone',
            'metadata.timezone',
            'raw_provider_data.fixture.timezone',
            'raw_provider_data.timezone'
        ])
    );

    matchInfo.match_id = normalizeString(
        pickFirstWithMatch(raw, [
            'match_id',
            'id',
            'fixture_id',
            'metadata.match_id',
            'raw_provider_data.fixture.id',
            'raw_provider_data.id',
            'raw_provider_data.game.id',
            'raw_provider_data.event.id',
            'raw_provider_data.GameID',
            'raw_provider_data.idEvent'
        ])
    );

    if (!matchInfo.match_id) {
        matchInfo.match_id = buildFallbackMatchId(providerPayload, matchInfo);
    }

    return matchInfo;
}

function parseBookmakerMarkets(raw) {
    const providerPayload = isObject(raw.raw_provider_data) ? raw.raw_provider_data : raw;
    const bookmakers = normalizeArray(providerPayload.bookmakers);
    if (!bookmakers.length) return [];

    const markets = [];
    for (const bookmaker of bookmakers) {
        const rows = normalizeArray(bookmaker?.markets);
        for (const market of rows) {
            markets.push({
                key: normalizeString(market?.key, '').toLowerCase(),
                outcomes: normalizeArray(market?.outcomes),
                point: market?.point
            });
        }
    }
    return markets;
}

function priceFromOutcome(outcome) {
    const value = toNumber(outcome?.price);
    if (value === null) return null;
    if (value <= 0) return null;
    return value;
}

function probabilityFromDecimalOdds(price) {
    const odds = toNumber(price);
    if (odds === null || odds <= 1) return null;
    return clampProbability(1 / odds);
}

function mapH2HProbabilities(matchInfo, markets, sharpOdds) {
    const h2h = markets.find((row) => row.key === 'h2h');
    if (!h2h) return;

    const home = normalizeString(matchInfo.home_team, '').toLowerCase();
    const away = normalizeString(matchInfo.away_team, '').toLowerCase();

    for (const outcome of h2h.outcomes) {
        const name = normalizeString(outcome?.name, '').toLowerCase();
        const prob = probabilityFromDecimalOdds(priceFromOutcome(outcome));
        if (prob === null) continue;
        if (home && name === home) sharpOdds.home_win = prob;
        else if (away && name === away) sharpOdds.away_win = prob;
        else if (name === 'draw' || name === 'x') sharpOdds.draw = prob;
    }
}

function mapTotalsProbabilities(markets, sharpOdds) {
    for (const market of markets) {
        if (market.key !== 'totals') continue;
        const line = toNumber(market.point);
        if (line === null) continue;
        for (const outcome of market.outcomes) {
            const name = normalizeString(outcome?.name, '').toLowerCase();
            const prob = probabilityFromDecimalOdds(priceFromOutcome(outcome));
            if (prob === null) continue;

            const lineToken = String(line).replace('.', '_');
            if (name === 'over') {
                const key = `over_${lineToken}`;
                if (key in sharpOdds) sharpOdds[key] = prob;
            } else if (name === 'under') {
                const key = `under_${lineToken}`;
                if (key in sharpOdds) sharpOdds[key] = prob;
            }
        }
    }
}

function fillDerivedOdds(sharpOdds) {
    const home = clampProbability(sharpOdds.home_win);
    const draw = clampProbability(sharpOdds.draw);
    const away = clampProbability(sharpOdds.away_win);

    if (sharpOdds.double_chance_1x === null && home !== null && draw !== null) {
        sharpOdds.double_chance_1x = clampProbability(home + draw);
    }
    if (sharpOdds.double_chance_x2 === null && away !== null && draw !== null) {
        sharpOdds.double_chance_x2 = clampProbability(away + draw);
    }
    if (sharpOdds.double_chance_12 === null && home !== null && away !== null) {
        sharpOdds.double_chance_12 = clampProbability(home + away);
    }

    const dnbDenominator = home !== null && away !== null ? home + away : null;
    if (dnbDenominator && dnbDenominator > 0) {
        if (sharpOdds.draw_no_bet_home === null && home !== null) {
            sharpOdds.draw_no_bet_home = clampProbability(home / dnbDenominator);
        }
        if (sharpOdds.draw_no_bet_away === null && away !== null) {
            sharpOdds.draw_no_bet_away = clampProbability(away / dnbDenominator);
        }
    }

    if (sharpOdds.over_0_5 === null && sharpOdds.over_1_5 !== null) {
        sharpOdds.over_0_5 = clampProbability(Math.max(sharpOdds.over_1_5, 0.85));
    }
    if (sharpOdds.under_4_5 === null && sharpOdds.under_3_5 !== null) {
        sharpOdds.under_4_5 = clampProbability(Math.max(sharpOdds.under_3_5, 0.82));
    }

    if (sharpOdds.home_over_0_5 === null && home !== null) {
        sharpOdds.home_over_0_5 = clampProbability(Math.max(0.5, home + 0.18));
    }
    if (sharpOdds.away_over_0_5 === null && away !== null) {
        sharpOdds.away_over_0_5 = clampProbability(Math.max(0.42, away + 0.16));
    }
    if (sharpOdds.home_over_1_5 === null && sharpOdds.home_over_0_5 !== null) {
        sharpOdds.home_over_1_5 = clampProbability(sharpOdds.home_over_0_5 - 0.18);
    }
    if (sharpOdds.away_over_1_5 === null && sharpOdds.away_over_0_5 !== null) {
        sharpOdds.away_over_1_5 = clampProbability(sharpOdds.away_over_0_5 - 0.18);
    }

    if (sharpOdds.btts_yes === null && sharpOdds.home_over_0_5 !== null && sharpOdds.away_over_0_5 !== null) {
        sharpOdds.btts_yes = clampProbability((sharpOdds.home_over_0_5 + sharpOdds.away_over_0_5) / 2 - 0.08);
    }
    if (sharpOdds.btts_no === null && sharpOdds.btts_yes !== null) {
        sharpOdds.btts_no = clampProbability(1 - sharpOdds.btts_yes);
    }

    if (sharpOdds.btts_over_2_5 === null && sharpOdds.btts_yes !== null && sharpOdds.over_2_5 !== null) {
        sharpOdds.btts_over_2_5 = clampProbability(sharpOdds.btts_yes * sharpOdds.over_2_5);
    }
    if (sharpOdds.btts_under_3_5 === null && sharpOdds.btts_yes !== null && sharpOdds.under_3_5 !== null) {
        sharpOdds.btts_under_3_5 = clampProbability(sharpOdds.btts_yes * sharpOdds.under_3_5);
    }

    if (sharpOdds.home_win_btts_yes === null && home !== null && sharpOdds.btts_yes !== null) {
        sharpOdds.home_win_btts_yes = clampProbability(home * sharpOdds.btts_yes);
    }
    if (sharpOdds.away_win_btts_yes === null && away !== null && sharpOdds.btts_yes !== null) {
        sharpOdds.away_win_btts_yes = clampProbability(away * sharpOdds.btts_yes);
    }
    if (sharpOdds.home_win_btts_no === null && home !== null && sharpOdds.btts_no !== null) {
        sharpOdds.home_win_btts_no = clampProbability(home * sharpOdds.btts_no);
    }
    if (sharpOdds.away_win_btts_no === null && away !== null && sharpOdds.btts_no !== null) {
        sharpOdds.away_win_btts_no = clampProbability(away * sharpOdds.btts_no);
    }

    if (sharpOdds.home_win_under_4_5 === null && home !== null && sharpOdds.under_4_5 !== null) {
        sharpOdds.home_win_under_4_5 = clampProbability(home * sharpOdds.under_4_5);
    }
    if (sharpOdds.away_win_under_4_5 === null && away !== null && sharpOdds.under_4_5 !== null) {
        sharpOdds.away_win_under_4_5 = clampProbability(away * sharpOdds.under_4_5);
    }
    if (sharpOdds.home_win_over_1_5 === null && home !== null && sharpOdds.over_1_5 !== null) {
        sharpOdds.home_win_over_1_5 = clampProbability(home * sharpOdds.over_1_5);
    }
    if (sharpOdds.away_win_over_1_5 === null && away !== null && sharpOdds.over_1_5 !== null) {
        sharpOdds.away_win_over_1_5 = clampProbability(away * sharpOdds.over_1_5);
    }

    if (sharpOdds.double_chance_over_1_5 === null && sharpOdds.over_1_5 !== null) {
        const dc = Math.max(
            sharpOdds.double_chance_1x || 0,
            sharpOdds.double_chance_x2 || 0,
            sharpOdds.double_chance_12 || 0
        );
        if (dc > 0) sharpOdds.double_chance_over_1_5 = clampProbability(dc * sharpOdds.over_1_5);
    }
    if (sharpOdds.double_chance_under_3_5 === null && sharpOdds.under_3_5 !== null) {
        const dc = Math.max(
            sharpOdds.double_chance_1x || 0,
            sharpOdds.double_chance_x2 || 0,
            sharpOdds.double_chance_12 || 0
        );
        if (dc > 0) sharpOdds.double_chance_under_3_5 = clampProbability(dc * sharpOdds.under_3_5);
    }

    if (sharpOdds.over_0_5_first_half === null && sharpOdds.over_1_5 !== null) {
        sharpOdds.over_0_5_first_half = clampProbability(Math.min(0.95, sharpOdds.over_1_5 + 0.07));
    }
    if (sharpOdds.under_1_5_first_half === null && sharpOdds.under_3_5 !== null) {
        sharpOdds.under_1_5_first_half = clampProbability(Math.min(0.95, sharpOdds.under_3_5 + 0.04));
    }
    if (sharpOdds.first_half_draw === null && draw !== null) {
        sharpOdds.first_half_draw = clampProbability(Math.min(0.75, draw + 0.18));
    }

    if (sharpOdds.home_win_either_half === null && home !== null) {
        sharpOdds.home_win_either_half = clampProbability(Math.min(0.95, home + 0.12));
    }
    if (sharpOdds.away_win_either_half === null && away !== null) {
        sharpOdds.away_win_either_half = clampProbability(Math.min(0.95, away + 0.12));
    }
    if (sharpOdds.win_either_half === null && home !== null && away !== null) {
        sharpOdds.win_either_half = clampProbability(Math.min(0.98, home + away + 0.08));
    }
    if (sharpOdds.team_to_score_first_home === null && sharpOdds.home_over_0_5 !== null) {
        sharpOdds.team_to_score_first_home = clampProbability(sharpOdds.home_over_0_5 - 0.04);
    }
    if (sharpOdds.team_to_score_first_away === null && sharpOdds.away_over_0_5 !== null) {
        sharpOdds.team_to_score_first_away = clampProbability(sharpOdds.away_over_0_5 - 0.04);
    }
}

function buildSharpOdds(raw, matchInfo) {
    const sharpOdds = { ...SHARP_ODDS_TEMPLATE };
    const providerPayload = isObject(raw.raw_provider_data) ? raw.raw_provider_data : raw;

    for (const key of SHARP_ODDS_KEYS) {
        const direct = clampProbability(pickFirst(raw, [key, `sharp_odds.${key}`, `metadata.sharp_odds.${key}`]));
        if (direct !== null) sharpOdds[key] = direct;
    }

    const markets = parseBookmakerMarkets(raw);
    if (markets.length) {
        mapH2HProbabilities(matchInfo, markets, sharpOdds);
        mapTotalsProbabilities(markets, sharpOdds);
    }

    const implied = isObject(providerPayload?.implied_probabilities)
        ? providerPayload.implied_probabilities
        : isObject(providerPayload?.probabilities)
            ? providerPayload.probabilities
            : null;
    if (implied) {
        for (const key of SHARP_ODDS_KEYS) {
            if (sharpOdds[key] !== null) continue;
            const value = clampProbability(implied[key]);
            if (value !== null) sharpOdds[key] = value;
        }
    }

    fillDerivedOdds(sharpOdds);
    return sharpOdds;
}

function normalizeContextRisk(rawValue) {
    const n = toNumber(rawValue);
    if (n === null) return null;
    if (n > 1 && n <= 100) return Math.max(0, Math.min(1, n / 100));
    return Math.max(0, Math.min(1, n));
}

function normalizeWeather(value) {
    if (isObject(value)) {
        const risk = normalizeContextRisk(
            value.risk ?? value.weather_risk ?? value.severity ?? value.intensity
        );
        return {
            ...value,
            risk
        };
    }
    if (typeof value === 'string') {
        const key = value.trim().toLowerCase();
        if (!key) return null;
        return { summary: value, risk: null };
    }
    return value ?? null;
}

function buildContextualIntelligence(raw) {
    const contextualIntelligence = { ...CONTEXT_TEMPLATE };
    const providerPayload = isObject(raw.raw_provider_data) ? raw.raw_provider_data : raw;
    const metadata = isObject(raw.metadata) ? raw.metadata : {};
    const contextSource = isObject(raw.contextual_intelligence)
        ? raw.contextual_intelligence
        : isObject(metadata.contextual_intelligence)
            ? metadata.contextual_intelligence
            : isObject(metadata.context_intelligence)
                ? metadata.context_intelligence
                : {};

    contextualIntelligence.weather = normalizeWeather(
        pickFirst(raw, [
            'contextual_intelligence.weather',
            'metadata.contextual_intelligence.weather',
            'metadata.context_intelligence.insights.weather',
            'raw_provider_data.weather',
            'weather'
        ])
    );

    contextualIntelligence.injuries = normalizeArray(
        pickFirst(raw, [
            'contextual_intelligence.injuries',
            'teamData.injuries',
            'metadata.teamData.injuries',
            'raw_provider_data.teamData.injuries',
            'raw_provider_data.injuries'
        ], [])
    );

    contextualIntelligence.suspensions = normalizeArray(
        pickFirst(raw, [
            'contextual_intelligence.suspensions',
            'teamData.suspensions',
            'metadata.teamData.suspensions',
            'raw_provider_data.teamData.suspensions',
            'raw_provider_data.suspensions'
        ], [])
    );

    contextualIntelligence.expected_lineups = normalizeArray(
        pickFirst(raw, [
            'contextual_intelligence.expected_lineups',
            'raw_provider_data.expected_lineups',
            'raw_provider_data.lineups.expected',
            'metadata.expected_lineups'
        ], [])
    );

    contextualIntelligence.confirmed_lineups = normalizeArray(
        pickFirst(raw, [
            'contextual_intelligence.confirmed_lineups',
            'raw_provider_data.confirmed_lineups',
            'raw_provider_data.lineups.confirmed',
            'metadata.confirmed_lineups'
        ], [])
    );

    contextualIntelligence.lineup_confirmed = toBoolean(
        pickFirst(raw, [
            'contextual_intelligence.lineup_confirmed',
            'metadata.contextual_intelligence.lineup_confirmed',
            'metadata.context_intelligence.lineup_confirmed',
            'raw_provider_data.lineup_confirmed'
        ], false),
        false
    );

    if (!contextualIntelligence.lineup_confirmed && contextualIntelligence.confirmed_lineups.length > 0) {
        contextualIntelligence.lineup_confirmed = true;
    }

    contextualIntelligence.morale = pickFirst(raw, [
        'contextual_intelligence.morale',
        'metadata.contextual_intelligence.morale',
        'raw_provider_data.morale'
    ], null);

    contextualIntelligence.coach_conflict = toBoolean(
        pickFirst(raw, [
            'contextual_intelligence.coach_conflict',
            'teamContext.coachConflict',
            'metadata.teamContext.coachConflict',
            'raw_provider_data.teamContext.coachConflict'
        ], false),
        false
    );

    contextualIntelligence.boardroom_instability = toBoolean(
        pickFirst(raw, [
            'contextual_intelligence.boardroom_instability',
            'teamContext.execInstability',
            'metadata.teamContext.execInstability',
            'raw_provider_data.teamContext.execInstability'
        ], false),
        false
    );

    contextualIntelligence.discipline_risk = normalizeContextRisk(
        pickFirst(raw, [
            'contextual_intelligence.discipline_risk',
            'metadata.context_intelligence.signals.discipline_risk',
            'raw_provider_data.discipline_risk'
        ])
    );

    contextualIntelligence.travel_fatigue = normalizeContextRisk(
        pickFirst(raw, ['contextual_intelligence.travel_fatigue', 'raw_provider_data.travel_fatigue'])
    );

    contextualIntelligence.motivation_factor = pickFirst(raw, [
        'contextual_intelligence.motivation_factor',
        'raw_provider_data.motivation_factor'
    ], null);

    contextualIntelligence.fixture_congestion = normalizeContextRisk(
        pickFirst(raw, ['contextual_intelligence.fixture_congestion', 'raw_provider_data.fixture_congestion'])
    );

    contextualIntelligence.derby_risk = normalizeContextRisk(
        pickFirst(raw, ['contextual_intelligence.derby_risk', 'raw_provider_data.derby_risk'])
    );

    contextualIntelligence.rotation_risk = normalizeContextRisk(
        pickFirst(raw, ['contextual_intelligence.rotation_risk', 'raw_provider_data.rotation_risk'])
    );

    contextualIntelligence.public_incidents = normalizeArray(
        pickFirst(raw, [
            'contextual_intelligence.public_incidents',
            'teamContext.playerLegalIssues',
            'metadata.teamContext.playerLegalIssues',
            'raw_provider_data.teamContext.playerLegalIssues'
        ], [])
    );

    contextualIntelligence.market_movement = pickFirst(raw, [
        'contextual_intelligence.market_movement',
        'metadata.contextual_intelligence.market_movement',
        'raw_provider_data.market_movement',
        'raw_provider_data.odds_movement'
    ], null);

    const legacySignals = isObject(contextSource.signals) ? contextSource.signals : {};
    if (contextualIntelligence.discipline_risk === null) {
        contextualIntelligence.discipline_risk = normalizeContextRisk(legacySignals.discipline_risk);
    }
    if (!contextualIntelligence.weather && isObject(contextSource.insights?.weather)) {
        contextualIntelligence.weather = normalizeWeather(contextSource.insights.weather);
    }
    if (contextualIntelligence.derby_risk === null) {
        contextualIntelligence.derby_risk = normalizeContextRisk(legacySignals.stability_risk);
    }

    return contextualIntelligence;
}

function isMatchContext(candidate) {
    return isObject(candidate)
        && isObject(candidate.match_info)
        && isObject(candidate.sharp_odds)
        && isObject(candidate.contextual_intelligence);
}

function buildCompatibilityPayload(raw, matchContext, provider, sport) {
    const metadata = isObject(raw?.metadata) ? raw.metadata : {};
    const mergedMetadata = {
        ...metadata,
        provider,
        match_context: matchContext,
        normalized_match_context: true
    };

    return {
        match_id: matchContext.match_info.match_id,
        sport,
        home_team: matchContext.match_info.home_team,
        away_team: matchContext.match_info.away_team,
        date: matchContext.match_info.kickoff,
        kickoff: matchContext.match_info.kickoff,
        match_time: matchContext.match_info.kickoff,
        league: matchContext.match_info.league,
        country: matchContext.match_info.country,
        season: matchContext.match_info.season,
        venue: matchContext.match_info.venue,
        timezone: matchContext.match_info.timezone,
        market: normalizeString(raw?.market, '1X2'),
        prediction: normalizeString(raw?.prediction, null),
        confidence: toNumber(raw?.confidence),
        volatility: normalizeString(raw?.volatility, null),
        odds: toNumber(raw?.odds),
        provider: normalizeString(raw?.provider, provider),
        provider_name: normalizeString(raw?.provider_name, provider),
        metadata: mergedMetadata,
        raw_provider_data: isObject(raw?.raw_provider_data) ? raw.raw_provider_data : raw
    };
}

function buildMatchContext(rawMatch) {
    if (!rawMatch) return null;

    const safeRaw = isObject(rawMatch) ? rawMatch : {};

    if (isMatchContext(safeRaw)) {
        return {
            ...safeRaw,
            match_info: { ...MATCH_INFO_TEMPLATE, ...safeRaw.match_info },
            sharp_odds: { ...SHARP_ODDS_TEMPLATE, ...safeRaw.sharp_odds },
            contextual_intelligence: { ...CONTEXT_TEMPLATE, ...safeRaw.contextual_intelligence }
        };
    }

    if (!rawMatch || !rawMatch.match || !rawMatch.odds) {
        return null; // reject legacy rows
    }

    const provider = normalizeProvider(safeRaw);
    const sport = normalizeSport(safeRaw);
    const matchInfo = buildMatchInfo(safeRaw);
    const sharpOdds = buildSharpOdds(safeRaw, matchInfo);
    const contextualIntelligence = buildContextualIntelligence(safeRaw);

    const matchContext = {
        match_info: matchInfo,
        sharp_odds: sharpOdds,
        contextual_intelligence: contextualIntelligence
    };

    return {
        ...buildCompatibilityPayload(safeRaw, matchContext, provider, sport),
        ...matchContext
    };
}

module.exports = {
    SHARP_ODDS_KEYS,
    buildMatchContext,
    isMatchContext
};
