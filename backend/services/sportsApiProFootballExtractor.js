'use strict';

function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function hasAny(keys, terms) {
    for (const term of terms) {
        if (keys.has(String(term).toLowerCase())) return true;
    }
    return false;
}

function detectArrayCandidates(data) {
    const out = [];

    function sampleKeys(arr) {
        const keys = new Set();
        for (const item of arr.slice(0, 3)) {
            if (isObject(item)) {
                for (const key of Object.keys(item)) keys.add(key);
            }
        }
        return Array.from(keys).slice(0, 15);
    }

    function walk(value, path, depth) {
        if (depth > 4 || out.length >= 10) return;

        if (Array.isArray(value)) {
            out.push({
                path,
                length: value.length,
                sampleKeys: sampleKeys(value)
            });

            for (let i = 0; i < Math.min(value.length, 3); i += 1) {
                walk(value[i], `${path}[${i}]`, depth + 1);
                if (out.length >= 10) return;
            }
            return;
        }

        if (!isObject(value)) return;

        for (const [key, child] of Object.entries(value)) {
            walk(child, path ? `${path}.${key}` : key, depth + 1);
            if (out.length >= 10) return;
        }
    }

    walk(data, 'root', 0);
    return out;
}

function countNestedKeys(data, maxDepth = 4) {
    const counts = {};

    function walk(value, depth) {
        if (depth > maxDepth) return;

        if (Array.isArray(value)) {
            for (const item of value.slice(0, 30)) {
                walk(item, depth + 1);
            }
            return;
        }

        if (!isObject(value)) return;

        for (const [key, child] of Object.entries(value)) {
            counts[key] = (counts[key] || 0) + 1;
            walk(child, depth + 1);
        }
    }

    walk(data, 0);
    return counts;
}

function trimPreview(value, depth, maxItems) {
    if (depth > 3) return '[trimmed-depth]';

    if (Array.isArray(value)) {
        return value.slice(0, maxItems).map((item) => trimPreview(item, depth + 1, maxItems));
    }

    if (!isObject(value)) return value;

    const out = {};
    for (const [key, child] of Object.entries(value).slice(0, 12)) {
        out[key] = trimPreview(child, depth + 1, maxItems);
    }
    return out;
}

function extractPreview(data, maxItems = 3) {
    if (data === undefined || data === null) return null;
    return trimPreview(data, 0, maxItems);
}

function collectLowerKeys(data, maxDepth = 4) {
    const keys = new Set();

    function walk(value, depth) {
        if (depth > maxDepth) return;

        if (Array.isArray(value)) {
            for (const item of value.slice(0, 30)) walk(item, depth + 1);
            return;
        }

        if (!isObject(value)) return;

        for (const [key, child] of Object.entries(value)) {
            keys.add(String(key).toLowerCase());
            walk(child, depth + 1);
        }
    }

    walk(data, 0);
    return keys;
}

function detectFixtureUsefulness(data) {
    const keys = collectLowerKeys(data, 4);

    const hasFixtureId = hasAny(keys, ['fixtureid', 'fixture_id', 'matchid', 'match_id', 'eventid', 'event_id']);
    const hasGameId = hasAny(keys, ['gameid', 'game_id', 'id']);
    const hasStartTime = hasAny(keys, ['starttime', 'starttimestamp', 'kickoff', 'kickofftime', 'scheduled']);
    const hasDate = hasAny(keys, ['date', 'startdate', 'gamedate', 'datetime', 'time']);
    const hasStatus = hasAny(keys, ['status', 'gamestatus', 'state', 'live', 'period', 'isfinished', 'islive']);
    const hasHomeAwayTeams = hasAny(keys, ['home', 'away', 'hometeam', 'awayteam', 'teams']);
    const hasCompetitors = hasAny(keys, ['competitor', 'competitors', 'participants', 'athletecompetitor']);
    const hasCompetition = hasAny(keys, ['competition', 'competitions']);
    const hasLeagueOrTournament = hasAny(keys, ['league', 'tournament', 'stage']);
    const hasScore = hasAny(keys, ['score', 'scores', 'result', 'results', 'goals', 'points']);
    const hasStandings = hasAny(keys, ['standings', 'table']);
    const hasRank = hasAny(keys, ['rank', 'position', 'standing']);
    const hasForm = hasAny(keys, ['form', 'recentform', 'wins', 'losses', 'draws']);
    const hasH2H = hasAny(keys, ['h2h', 'headtohead', 'head_to_head']);
    const hasSquad = hasAny(keys, ['squad', 'squads', 'roster']);
    const hasAthletes = hasAny(keys, ['athlete', 'athletes', 'player', 'players']);
    const hasLineup = hasAny(keys, ['lineup', 'lineups', 'starting', 'bench', 'formation']);
    const hasEvents = hasAny(keys, ['events', 'event', 'timeline', 'minute']);
    const hasCommentary = hasAny(keys, ['commentary', 'comment', 'narrative']);
    const hasHighlights = hasAny(keys, ['highlights', 'highlight', 'video', 'clip']);
    const hasOdds = hasAny(keys, ['odds', 'od']);
    const hasMarkets = hasAny(keys, ['market', 'markets', 'line', 'lines']);
    const hasBookmaker = hasAny(keys, ['bookmaker', 'bookmakers']);
    const hasPrediction = hasAny(keys, ['prediction', 'predictions', 'forecast', 'probability', 'winprobability']);
    const hasStats = hasAny(keys, ['stats', 'statistics', 'metric', 'metrics', 'xg', 'pregame']);
    const hasTransfers = hasAny(keys, ['transfer', 'transfers', 'fromclub', 'toclub']);
    const hasBracket = hasAny(keys, ['bracket', 'brackets', 'round', 'seed', 'knockout']);

    return {
        hasFixtureId,
        hasGameId,
        hasStartTime,
        hasDate,
        hasStatus,
        hasHomeAwayTeams,
        hasCompetitors,
        hasCompetition,
        hasLeagueOrTournament,
        hasScore,
        hasStandings,
        hasRank,
        hasForm,
        hasH2H,
        hasSquad,
        hasAthletes,
        hasLineup,
        hasEvents,
        hasCommentary,
        hasHighlights,
        hasOdds,
        hasMarkets,
        hasBookmaker,
        hasPrediction,
        hasStats,
        hasTransfers,
        hasBracket
    };
}

function classifyEndpoint(label, flags) {
    const normalized = String(label || '').toLowerCase();

    if (normalized === 'health' || normalized === 'status') return 'account_health';
    if (normalized.includes('standings') && (flags.hasStandings || flags.hasRank)) return 'standings_candidate';
    if (normalized.includes('h2h') && (flags.hasH2H || flags.hasHomeAwayTeams || flags.hasCompetitors)) return 'h2h_candidate';
    if (normalized.includes('current') && (flags.hasStatus || flags.hasStartTime || flags.hasDate)) return 'current_games_candidate';
    if (normalized.includes('results') || (flags.hasScore && (flags.hasDate || flags.hasStartTime))) return 'historical_results_candidate';
    if (normalized.includes('game_detail') || (normalized === 'game' || normalized.includes('game_')) && flags.hasGameId) {
        return 'single_game_detail_candidate';
    }
    if (normalized.includes('fixtures') && (flags.hasStartTime || flags.hasDate) && (flags.hasCompetitors || flags.hasHomeAwayTeams)) {
        return 'fixture_candidate';
    }
    if (normalized.includes('competition')) return 'competition_mapping';
    if (normalized.includes('competitor')) {
        return flags.hasForm || flags.hasH2H ? 'h2h_candidate' : 'competitor_mapping';
    }
    if (normalized.includes('squad')) return 'squad_candidate';
    if (normalized.includes('athlete')) {
        if (flags.hasLineup) return 'lineup_candidate';
        return 'athlete_mapping';
    }
    if (normalized.includes('lineup') || flags.hasLineup) return 'lineup_candidate';
    if (normalized.includes('commentary') || flags.hasCommentary || flags.hasEvents) return 'commentary_candidate';
    if (normalized.includes('highlight') || flags.hasHighlights) return 'highlights_candidate';
    if (normalized.includes('prediction') || flags.hasPrediction) return 'prediction_provider_candidate';
    if (normalized.includes('trends')) return 'bet_trends_candidate';
    if (normalized.includes('bets') && (flags.hasOdds || flags.hasMarkets || flags.hasBookmaker)) return 'odds_lines_candidate';
    if (normalized.includes('stats') || flags.hasStats) return 'stats_candidate';
    if (normalized.includes('transfer') || flags.hasTransfers) return 'transfer_candidate';
    if (normalized.includes('bracket') || flags.hasBracket) return 'bracket_candidate';

    if ((flags.hasCompetitors || flags.hasCompetition || flags.hasLeagueOrTournament) && !(flags.hasStartTime || flags.hasDate)) {
        return 'entity_mapping_only';
    }

    if ((flags.hasStartTime || flags.hasDate) && (flags.hasCompetitors || flags.hasHomeAwayTeams)) {
        return 'fixture_candidate';
    }

    return 'unknown';
}

function summarizeSportsApiProFootballResponse(label, response) {
    const data = response?.data;
    const nestedKeyCounts = countNestedKeys(data, 4);
    const rootType = Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data;
    const rootKeys = isObject(data) ? Object.keys(data) : [];
    const arrayCandidates = detectArrayCandidates(data);
    const detectionFlags = detectFixtureUsefulness(data);
    const classification = classifyEndpoint(label, detectionFlags);

    const notes = [];
    if (data === undefined || data === null) {
        notes.push('No response data returned.');
    } else {
        if (detectionFlags.hasStartTime || detectionFlags.hasDate) notes.push('Start date/time detected');
        if (detectionFlags.hasHomeAwayTeams || detectionFlags.hasCompetitors) notes.push('Teams/competitors detected');
        if (detectionFlags.hasStatus) notes.push('Status/live-state detected');
        if (detectionFlags.hasScore) notes.push('Score/result detected');
        if (detectionFlags.hasStandings || detectionFlags.hasRank) notes.push('Standings/rank detected');
        if (detectionFlags.hasH2H || detectionFlags.hasForm) notes.push('H2H/form detected');
        if (detectionFlags.hasSquad || detectionFlags.hasAthletes) notes.push('Squad/player/athlete detected');
        if (detectionFlags.hasLineup) notes.push('Lineup detected');
        if (detectionFlags.hasCommentary || detectionFlags.hasEvents) notes.push('Commentary/events detected');
        if (detectionFlags.hasOdds || detectionFlags.hasMarkets || detectionFlags.hasBookmaker) {
            notes.push('Odds/markets/bookmaker detected');
        }
        if (detectionFlags.hasPrediction) {
            notes.push('Prediction-like fields detected; must remain isolated until reviewed');
        }
        if (detectionFlags.hasStats) notes.push('Stats fields detected');
        if (detectionFlags.hasTransfers) notes.push('Transfers detected');
        if (detectionFlags.hasBracket) notes.push('Bracket structure detected');
    }

    if (notes.length === 0) notes.push('No obvious useful keys detected');

    return {
        label,
        ok: Boolean(response?.ok),
        status: response?.status ?? null,
        rateLimit: response?.rateLimit || null,
        classification,
        role: classification,
        shape: {
            rootType,
            rootKeys,
            arrayCandidates,
            nestedKeyCounts
        },
        preview: extractPreview(data, 3),
        detectionFlags,
        fixtureUsefulness: detectionFlags,
        providerDataQualityNotes: notes
    };
}

module.exports = {
    summarizeSportsApiProFootballResponse,
    detectArrayCandidates,
    countNestedKeys,
    extractPreview,
    detectFixtureUsefulness
};

