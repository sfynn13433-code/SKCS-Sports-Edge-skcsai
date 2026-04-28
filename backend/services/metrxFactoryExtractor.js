'use strict';

function pickFirstDefined(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return null;
}

function toNumberOrNull(value) {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function toStringOrNull(value) {
    if (value === undefined || value === null || value === '') return null;
    return String(value);
}

function findArrayPayload(raw) {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== 'object') return [];

    const candidates = [
        raw.result,
        raw.data,
        raw.matches,
        raw.results,
        raw.items,
        raw.response,
        raw.data?.result,
        raw.data?.matches,
        raw.data?.results,
        raw.data?.items,
        raw.data?.response
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate;
    }
    return [];
}

function extractMetrxMatchMetric(item = {}) {
    const match = item.match || item.fixture || item.event || item;
    const performance = item.performance || item.metrics || item.statistic || item;
    const scores = item.scores || item.score || {};

    const competition =
        match.competition ||
        match.league ||
        item.competition ||
        item.league ||
        {};

    const homeTeam =
        match.homeTeam ||
        match.home_team ||
        match.home ||
        item.homeTeam ||
        item.home_team ||
        item.home ||
        {};

    const awayTeam =
        match.awayTeam ||
        match.away_team ||
        match.away ||
        item.awayTeam ||
        item.away_team ||
        item.away ||
        {};

    const providerMatchId = toStringOrNull(
        pickFirstDefined(
            match.id,
            match.match_id,
            match.matchId,
            match.fixture_id,
            match.fixtureId,
            match.provider_match_id,
            item.id,
            item.match_id,
            item.matchId,
            item.fixture_id,
            item.fixtureId
        )
    );

    const startTime = toStringOrNull(
        pickFirstDefined(
            match.startTime,
            match.start_time,
            match.kickoff,
            match.kickoff_time,
            match.match_time,
            match.date,
            match.utcDate,
            match.timestamp,
            item.startTime,
            item.start_time,
            item.kickoff,
            item.kickoff_time,
            item.match_time,
            item.date
        )
    );

    return {
        provider: 'metrx_factory',
        provider_match_id: providerMatchId,
        start_time: startTime,
        competition: {
            id: toStringOrNull(
                pickFirstDefined(
                    competition.id,
                    match.competitionId,
                    match.competition_id,
                    match.leagueId,
                    match.league_id,
                    item.competitionId,
                    item.competition_id,
                    item.leagueId,
                    item.league_id
                )
            ),
            name: toStringOrNull(
                pickFirstDefined(
                    competition.name,
                    competition.shortName,
                    competition.short_name,
                    match.competitionName,
                    match.competition_name,
                    match.leagueName,
                    match.league_name,
                    item.competitionName,
                    item.competition_name,
                    item.leagueName,
                    item.league_name
                )
            ),
            short_name: toStringOrNull(
                pickFirstDefined(
                    competition.shortName,
                    competition.short_name,
                    match.competitionShortName,
                    match.competition_short_name,
                    match.shortName,
                    item.competitionShortName,
                    item.competition_short_name,
                    item.shortName
                )
            ),
            performance_index: toNumberOrNull(
                pickFirstDefined(
                    performance.performanceIndex,
                    performance.performance_index,
                    performance.index,
                    performance.mainIndex,
                    performance.main_index,
                    competition.performanceIndex,
                    competition.performance_index,
                    item.performanceIndex,
                    item.performance_index
                )
            ),
            rank: toNumberOrNull(
                pickFirstDefined(
                    performance.rank,
                    performance.competitionRank,
                    performance.competition_rank,
                    competition.rank,
                    item.competitionRank,
                    item.competition_rank,
                    item.rank
                )
            )
        },
        home_team: {
            id: toStringOrNull(
                pickFirstDefined(
                    homeTeam.id,
                    homeTeam.teamId,
                    homeTeam.team_id,
                    match.homeTeamId,
                    match.home_team_id,
                    item.homeTeamId,
                    item.home_team_id
                )
            ),
            name: toStringOrNull(
                pickFirstDefined(
                    homeTeam.name,
                    homeTeam.shortName,
                    homeTeam.short_name,
                    match.homeTeamName,
                    match.home_team_name,
                    match.home_name,
                    item.homeTeamName,
                    item.home_team_name,
                    item.home_name,
                    item.home?.name,
                    typeof match.home === 'string' ? match.home : null,
                    typeof item.home === 'string' ? item.home : null
                )
            )
        },
        away_team: {
            id: toStringOrNull(
                pickFirstDefined(
                    awayTeam.id,
                    awayTeam.teamId,
                    awayTeam.team_id,
                    match.awayTeamId,
                    match.away_team_id,
                    item.awayTeamId,
                    item.away_team_id
                )
            ),
            name: toStringOrNull(
                pickFirstDefined(
                    awayTeam.name,
                    awayTeam.shortName,
                    awayTeam.short_name,
                    match.awayTeamName,
                    match.away_team_name,
                    match.away_name,
                    item.awayTeamName,
                    item.away_team_name,
                    item.away_name,
                    item.away?.name,
                    typeof match.away === 'string' ? match.away : null,
                    typeof item.away === 'string' ? item.away : null
                )
            )
        },
        metrics: {
            expected_goals_home: toNumberOrNull(
                pickFirstDefined(
                    performance.expectedGoalsHome,
                    performance.expected_goals_home,
                    performance.xgHome,
                    performance.xg_home,
                    performance.homeExpectedGoals,
                    performance.home_expected_goals,
                    performance.expectedGoals?.home,
                    performance.expected_goals?.home,
                    item.expectedGoalsHome,
                    item.expected_goals_home,
                    item.xgHome,
                    item.xg_home,
                    item.homeExpectedGoals,
                    item.home_expected_goals
                )
            ),
            expected_goals_away: toNumberOrNull(
                pickFirstDefined(
                    performance.expectedGoalsAway,
                    performance.expected_goals_away,
                    performance.xgAway,
                    performance.xg_away,
                    performance.awayExpectedGoals,
                    performance.away_expected_goals,
                    performance.expectedGoals?.away,
                    performance.expected_goals?.away,
                    item.expectedGoalsAway,
                    item.expected_goals_away,
                    item.xgAway,
                    item.xg_away,
                    item.awayExpectedGoals,
                    item.away_expected_goals
                )
            ),
            xg_quality: toNumberOrNull(
                pickFirstDefined(
                    performance.xgQuality,
                    performance.xg_quality,
                    performance.expectedGoalsQuality,
                    performance.expected_goals_quality,
                    performance.quality,
                    item.xgQuality,
                    item.xg_quality,
                    item.expectedGoalsQuality,
                    item.expected_goals_quality
                )
            ),
            expected_venue_advantage: toNumberOrNull(
                pickFirstDefined(
                    performance.expectedVenueAdvantage,
                    performance.expected_venue_advantage,
                    performance.venueAdvantage,
                    performance.venue_advantage,
                    performance.homeAdvantage,
                    performance.home_advantage,
                    item.expectedVenueAdvantage,
                    item.expected_venue_advantage,
                    item.venueAdvantage,
                    item.venue_advantage
                )
            ),
            expected_handicap_line: toNumberOrNull(
                pickFirstDefined(
                    performance.expectedHandicapLine,
                    performance.expected_handicap_line,
                    performance.handicapLine,
                    performance.handicap_line,
                    performance.handicap,
                    item.expectedHandicapLine,
                    item.expected_handicap_line,
                    item.handicapLine,
                    item.handicap_line
                )
            ),
            expected_points_line: toNumberOrNull(
                pickFirstDefined(
                    performance.expectedPointsLine,
                    performance.expected_points_line,
                    performance.pointsLine,
                    performance.points_line,
                    performance.points,
                    item.expectedPointsLine,
                    item.expected_points_line,
                    item.pointsLine,
                    item.points_line
                )
            ),
            expected_total_line: toNumberOrNull(
                pickFirstDefined(
                    performance.expectedTotalLine,
                    performance.expected_total_line,
                    performance.totalLine,
                    performance.total_line,
                    performance.expectedTotalsLine,
                    performance.expected_totals_line,
                    performance.totalsLine,
                    performance.totals_line,
                    performance.total,
                    item.expectedTotalLine,
                    item.expected_total_line,
                    item.totalLine,
                    item.total_line,
                    item.expectedTotalsLine,
                    item.expected_totals_line
                )
            ),
            odds_quality: toNumberOrNull(
                pickFirstDefined(
                    performance.oddsQuality,
                    performance.odds_quality,
                    performance.marketOddsQuality,
                    performance.market_odds_quality,
                    performance.odds?.quality,
                    performance.marketOdds?.quality,
                    item.oddsQuality,
                    item.odds_quality,
                    item.marketOddsQuality,
                    item.market_odds_quality
                )
            )
        },
        scores: {
            home: toNumberOrNull(
                pickFirstDefined(
                    scores.home,
                    scores.homeScore,
                    scores.home_score,
                    scores.home_goals,
                    scores.homeGoals
                )
            ),
            away: toNumberOrNull(
                pickFirstDefined(
                    scores.away,
                    scores.awayScore,
                    scores.away_score,
                    scores.away_goals,
                    scores.awayGoals
                )
            )
        },
        raw_keys: Object.keys(item || {}),
        nested_keys: {
            match: Object.keys(match || {}),
            performance: Object.keys(performance || {}),
            scores: Object.keys(scores || {})
        }
    };
}

function extractMetrxTopMatches(raw) {
    const rows = findArrayPayload(raw);
    return rows.map(extractMetrxMatchMetric);
}

module.exports = {
    extractMetrxTopMatches,
    extractMetrxMatchMetric,
    pickFirstDefined,
    toNumberOrNull,
    toStringOrNull
};
