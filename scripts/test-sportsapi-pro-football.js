'use strict';

const {
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
    getTransfers
} = require('../backend/services/sportsApiProFootballService');
const { summarizeSportsApiProFootballResponse } = require('../backend/services/sportsApiProFootballExtractor');

const PROVIDER_HOST = 'sportsapi-pro-football-data.p.rapidapi.com';
const DELAY_MS = 350;

const CALLS = [
    { label: 'health', endpoint: '/health', params: {}, execute: () => healthCheck() },
    { label: 'status', endpoint: '/status', params: {}, execute: () => getStatus() },
    {
        label: 'games_fixtures',
        endpoint: '/games/fixtures',
        params: { showOdds: false, competitions: 7, competitors: 131 },
        execute: () => getFixtures({ showOdds: false, competitions: 7, competitors: 131 })
    },
    {
        label: 'games_allscores',
        endpoint: '/games/allscores',
        params: { competitionId: 572, showOdds: false, startDate: '16/01/2025', endDate: '16/01/2025' },
        execute: () => getAllScores({ competitionId: 572, showOdds: false, startDate: '16/01/2025', endDate: '16/01/2025' })
    },
    {
        label: 'games_suggestions',
        endpoint: '/games/suggestions',
        params: { games: 4284115, feedBy: 1 },
        execute: () => getSuggestions({ games: 4284115, feedBy: 1 })
    },
    {
        label: 'games_current',
        endpoint: '/games/current',
        params: { sports: 1 },
        execute: () => getCurrentGames({ sports: 1 })
    },
    {
        label: 'games_h2h',
        endpoint: '/games/h2h',
        params: { homeCompetitorId: 131, awayCompetitorId: 132 },
        execute: () => getH2H({ homeCompetitorId: 131, awayCompetitorId: 132 })
    },
    {
        label: 'games_results',
        endpoint: '/games/results',
        params: { showOdds: false, competitors: 131 },
        execute: () => getResults({ showOdds: false, competitors: 131 })
    },
    {
        label: 'game_detail',
        endpoint: '/game',
        params: { gameId: 4284115 },
        execute: () => getGame({ gameId: 4284115 })
    },
    {
        label: 'games_commentary',
        endpoint: '/games/commentary',
        params: { isFinished: true, isLive: false, fixtureId: '63-110-9', gameId: 4284115, filter: 'all' },
        execute: () => getCommentary({ isFinished: true, isLive: false, fixtureId: '63-110-9', gameId: 4284115, filter: 'all' })
    },
    {
        label: 'games_highlights',
        endpoint: '/games/highlights',
        params: { competitors: 110 },
        execute: () => getHighlights({ competitors: 110 })
    },
    {
        label: 'games_predictions',
        endpoint: '/games/predictions',
        params: { topBookmaker: 14, sports: 1 },
        execute: () => getPredictions({ topBookmaker: 14, sports: 1 })
    },
    {
        label: 'competitions_top',
        endpoint: '/competitions/top',
        params: { limit: 20, sports: 1 },
        execute: () => getTopCompetitions({ limit: 20, sports: 1 })
    },
    {
        label: 'competitions_featured',
        endpoint: '/competitions/featured',
        params: { sports: 1, type: 'standings' },
        execute: () => getFeaturedCompetitions({ sports: 1, type: 'standings' })
    },
    {
        label: 'competitions',
        endpoint: '/competitions',
        params: { sports: 1 },
        execute: () => getCompetitions({ sports: 1 })
    },
    {
        label: 'competitors_recentForm',
        endpoint: '/competitors/recentForm',
        params: { numOfGames: 5, competitor: 131 },
        execute: () => getRecentForm({ numOfGames: 5, competitor: 131 })
    },
    {
        label: 'competitors_top',
        endpoint: '/competitors/top',
        params: { limit: 20, sports: 1 },
        execute: () => getTopCompetitors({ limit: 20, sports: 1 })
    },
    {
        label: 'squads',
        endpoint: '/squads',
        params: { competitors: 131 },
        execute: () => getSquads({ competitors: 131 })
    },
    {
        label: 'athletes_top',
        endpoint: '/athletes/top',
        params: { sports: 1, limit: 20 },
        execute: () => getTopAthletes({ sports: 1, limit: 20 })
    },
    {
        label: 'athletes_nextGame',
        endpoint: '/athletes/nextGame',
        params: { topBookmaker: 14, athletes: 65760, fullDetails: true },
        execute: () => getAthleteNextGame({ topBookmaker: 14, athletes: 65760, fullDetails: true })
    },
    {
        label: 'athletes_games_lineups',
        endpoint: '/athletes/games/lineups',
        params: { athleteId: 80392, gameId: 4609054 },
        execute: () => getAthleteGameLineups({ athleteId: 80392, gameId: 4609054 })
    },
    {
        label: 'standings',
        endpoint: '/standings',
        params: { competitionId: 572 },
        execute: () => getStandings({ competitionId: 572 })
    },
    {
        label: 'bets_trends',
        endpoint: '/bets/trends',
        params: { date: '16/01/2025', topBookmaker: 14, sportType: 1, isTop: true },
        execute: () => getBetTrends({ date: '16/01/2025', topBookmaker: 14, sportType: 1, isTop: true })
    },
    {
        label: 'bets_proposition',
        endpoint: '/bets/proposition',
        params: { topBookmakerId: 14, gameId: 4284115 },
        execute: () => getBetProposition({ topBookmakerId: 14, gameId: 4284115 })
    },
    {
        label: 'bets_lines',
        endpoint: '/bets/lines',
        params: { gameId: 4284115, topBookmaker: 14 },
        execute: () => getBetLines({ gameId: 4284115, topBookmaker: 14 })
    },
    {
        label: 'bets_teaser',
        endpoint: '/bets/teaser',
        params: { gameId: 4284115, topBookmaker: 14 },
        execute: () => getBetTeaser({ gameId: 4284115, topBookmaker: 14 })
    },
    {
        label: 'bets_outrights',
        endpoint: '/bets/outrights',
        params: { competitions: '7,572', topBookmaker: 14 },
        execute: () => getBetOutrights({ competitions: '7,572', topBookmaker: 14 })
    },
    {
        label: 'stats',
        endpoint: '/stats',
        params: { competitions: 7, phaseNum: -1, withSeasons: true },
        execute: () => getStats({ competitions: 7, phaseNum: -1, withSeasons: true })
    },
    {
        label: 'stats_preGame',
        endpoint: '/stats/preGame',
        params: { topBookmaker: 14, game: 4609054, onlyMajor: true },
        execute: () => getPreGameStats({ topBookmaker: 14, game: 4609054, onlyMajor: true })
    },
    {
        label: 'games_stats',
        endpoint: '/games/stats',
        params: { filterId: -1, gameId: 4284115, onlyIsMajor: false },
        execute: () => getGameStats({ filterId: -1, gameId: 4284115, onlyIsMajor: false })
    },
    {
        label: 'transfers',
        endpoint: '/transfers',
        params: { competitions: 7, competitors: 110, limit: 10, onlyConfirmed: false },
        execute: () => getTransfers({ competitions: 7, competitors: 110, limit: 10, onlyConfirmed: false })
    }
];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyFailure(response) {
    const status = Number(response?.status) || null;
    const text = JSON.stringify(response?.data || response?.message || '').toLowerCase();

    if (status === 401 || status === 403 || text.includes('unauthorized') || text.includes('api key') || text.includes('forbidden')) {
        return 'auth_or_key';
    }
    if (
        text.includes('subscription')
        || text.includes('plan')
        || text.includes('quota')
        || text.includes('permission')
        || text.includes('upgrade')
    ) {
        return 'subscription_or_plan';
    }
    if (status === 400 || status === 422) return 'bad_params';
    if (status === 404) return 'not_found';
    if (status === 429) return 'rate_limited';
    if (status >= 500) return 'provider_server_error';
    return 'unknown_failure';
}

function toNumberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function pickMin(current, candidate) {
    if (candidate === null) return current;
    if (current === null) return candidate;
    return Math.min(current, candidate);
}

function hasAnySuccess(results, labels) {
    const rows = results.filter((row) => labels.includes(row.classification));
    if (!rows.length) return 'unknown';
    return rows.some((row) => row.ok) ? 'yes' : 'unknown';
}

async function run() {
    console.log('=== SKCS SPORTSAPI PRO FOOTBALL FULL ISOLATED SCOUT START ===');
    console.log(`Provider: ${PROVIDER_HOST}`);
    console.log('Planned unique calls: 31');
    console.log('No DB writes. No pipeline wiring.');

    const plannedCalls = CALLS.length;
    const results = [];
    let lowestRemaining = null;
    let lowestHardRemaining = null;

    for (let i = 0; i < CALLS.length; i += 1) {
        const call = CALLS[i];
        const index = i + 1;
        console.log(`\n[${index}/31] ${call.label} ${call.endpoint} ${JSON.stringify(call.params)}`);

        let response;
        try {
            response = await call.execute();
        } catch (error) {
            const message = String(error?.message || error || 'Unknown local error');
            if (message.includes('Missing SportsAPI Pro Football RapidAPI key')) {
                console.error(message);
                process.exitCode = 1;
                return;
            }
            console.error(`Local script failure on ${call.label}: ${message}`);
            process.exitCode = 1;
            return;
        }

        const summary = summarizeSportsApiProFootballResponse(call.label, response);
        const failureClassification = summary.ok ? null : classifyFailure(response);
        const requestsRemaining = toNumberOrNull(summary.rateLimit?.requestsRemaining);
        const hardRemaining = toNumberOrNull(summary.rateLimit?.rapidFreeRemaining);
        lowestRemaining = pickMin(lowestRemaining, requestsRemaining);
        lowestHardRemaining = pickMin(lowestHardRemaining, hardRemaining);

        console.log(`ok: ${summary.ok}`);
        console.log(`HTTP status: ${summary.status}`);
        if (!summary.ok) {
            console.log(`failure classification: ${failureClassification}`);
        }
        console.log(`rate-limit remaining: ${requestsRemaining === null ? 'unknown' : requestsRemaining}`);
        console.log(`extractor classification: ${summary.classification}`);
        console.log('detection flags:', JSON.stringify(summary.detectionFlags, null, 2));
        console.log('preview:', JSON.stringify(summary.preview, null, 2));

        results.push({
            label: call.label,
            endpoint: call.endpoint,
            ok: summary.ok,
            status: summary.status,
            failureClassification,
            classification: summary.classification,
            role: summary.role,
            flags: summary.detectionFlags
        });

        if (i < CALLS.length - 1) {
            await sleep(DELAY_MS);
        }
    }

    const successfulCalls = results.filter((item) => item.ok).length;
    const failedCalls = results.filter((item) => !item.ok).length;

    console.log('\n=== SKCS SPORTSAPI PRO FOOTBALL FULL ISOLATED SCOUT SUMMARY ===');
    console.log(`Total planned calls: 31`);
    console.log(`Total attempted calls: ${results.length}`);
    console.log(`Successful calls: ${successfulCalls}`);
    console.log(`Failed calls: ${failedCalls}`);
    console.log(`Rate-limit remaining lowest seen: ${lowestRemaining === null ? 'unknown' : lowestRemaining}`);
    console.log(`Hard-limit remaining lowest seen: ${lowestHardRemaining === null ? 'unknown' : lowestHardRemaining}`);

    console.log('\nEndpoint usefulness table:');
    console.table(results.map((item) => ({
        label: item.label,
        ok: item.ok ? 'ok' : 'fail',
        status: item.status,
        classification: item.classification,
        role: item.role,
        'fixtureId/gameId': item.flags.hasFixtureId || item.flags.hasGameId ? 'yes' : 'no',
        'startTime/date': item.flags.hasStartTime || item.flags.hasDate ? 'yes' : 'no',
        status_flag: item.flags.hasStatus ? 'yes' : 'no',
        'teams/competitors': item.flags.hasHomeAwayTeams || item.flags.hasCompetitors ? 'yes' : 'no',
        competition: item.flags.hasCompetition || item.flags.hasLeagueOrTournament ? 'yes' : 'no',
        score: item.flags.hasScore ? 'yes' : 'no',
        'standings/rank': item.flags.hasStandings || item.flags.hasRank ? 'yes' : 'no',
        'form/h2h': item.flags.hasForm || item.flags.hasH2H ? 'yes' : 'no',
        'squad/athletes/lineup': item.flags.hasSquad || item.flags.hasAthletes || item.flags.hasLineup ? 'yes' : 'no',
        'odds/markets/bookmaker': item.flags.hasOdds || item.flags.hasMarkets || item.flags.hasBookmaker ? 'yes' : 'no',
        prediction: item.flags.hasPrediction ? 'yes' : 'no',
        stats: item.flags.hasStats ? 'yes' : 'no',
        'transfers/brackets': item.flags.hasTransfers || item.flags.hasBracket ? 'yes' : 'no'
    })));

    console.log('\nProvider role recommendation:');
    console.log(`- approved_current_fixture_source: ${hasAnySuccess(results, ['fixture_candidate', 'current_games_candidate'])}`);
    console.log(`- approved_historical_results_source: ${hasAnySuccess(results, ['historical_results_candidate'])}`);
    console.log(`- approved_single_game_detail_source: ${hasAnySuccess(results, ['single_game_detail_candidate'])}`);
    console.log(`- approved_h2h_source: ${hasAnySuccess(results, ['h2h_candidate'])}`);
    console.log(`- approved_standings_source: ${hasAnySuccess(results, ['standings_candidate'])}`);
    console.log(`- approved_squad_lineup_source: ${hasAnySuccess(results, ['squad_candidate', 'lineup_candidate'])}`);
    console.log(`- approved_odds_lines_source: ${hasAnySuccess(results, ['odds_lines_candidate', 'bet_trends_candidate'])}`);
    console.log(`- approved_prediction_source: no until reviewed manually`);
    console.log(`- approved_stats_source: ${hasAnySuccess(results, ['stats_candidate'])}`);
    console.log(`- approved_entity_mapping_source: ${hasAnySuccess(results, ['competition_mapping', 'competitor_mapping', 'entity_mapping_only', 'athlete_mapping'])}`);

    console.log('Review decision: DO NOT WIRE YET. Inspect output first.');

    if (results.length === plannedCalls) {
        process.exitCode = 0;
        return;
    }
    process.exitCode = 1;
}

run().catch((error) => {
    const message = String(error?.message || error || 'Unknown local error');
    if (message.includes('Missing SportsAPI Pro Football RapidAPI key')) {
        console.error(message);
        process.exitCode = 1;
        return;
    }
    console.error(`Local script failure: ${message}`);
    process.exitCode = 1;
});

