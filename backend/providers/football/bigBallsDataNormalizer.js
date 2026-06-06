'use strict';

const { normalizeStatus } = require('../../semantic-layer/registry');

function toStringId(value) {
    if (value === null || value === undefined || value === '') return null;
    return String(value);
}

function toNumberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function mapBbdStatus(rawStatus) {
    const key = String(rawStatus || '').trim().toLowerCase();
    if (key === 'in_progress') return 'inprogress';
    if (key === 'scheduled') return 'scheduled';
    if (key === 'finished') return 'final';
    return rawStatus;
}

function teamNameFromSide(side) {
    if (!side) return null;
    if (typeof side === 'string') return side;
    return side.team_name != null ? String(side.team_name) : (side.name != null ? String(side.name) : null);
}

function goalsFromStored(row = {}) {
    if (row.score && typeof row.score === 'object') {
        return {
            home: toNumberOrNull(row.score.home),
            away: toNumberOrNull(row.score.away)
        };
    }
    const homeLine = Array.isArray(row.linescore?.home) ? row.linescore.home : [];
    const awayLine = Array.isArray(row.linescore?.away) ? row.linescore.away : [];
    if (homeLine.length && awayLine.length) {
        return {
            home: homeLine.reduce((a, b) => a + Number(b || 0), 0),
            away: awayLine.reduce((a, b) => a + Number(b || 0), 0)
        };
    }
    return { home: null, away: null };
}

function normalizeCompetition(raw = {}) {
    return {
        schema_version: 'skcs:bigballsdata:competition:v1',
        provider: 'big_balls_data',
        lane: 'evaluation',
        provider_league_id: toStringId(raw.id),
        CompetitionId: toStringId(raw.id),
        competition_name: raw.name != null ? String(raw.name) : null,
        sport: raw.sport != null ? String(raw.sport) : null,
        country_code: raw.country != null ? String(raw.country) : null,
        confidence: toNumberOrNull(raw._meta?.confidence),
        source_tier: raw._meta?.source != null ? String(raw._meta.source) : null
    };
}

function normalizeScoreRow(raw = {}, context = {}) {
    return normalizeFixture({
        id: raw.match_id,
        match_id: raw.match_id,
        status: raw.status,
        home_score: raw.home,
        away_score: raw.away,
        updated_at: raw.updated_at
    }, { ...context, score_only: true });
}

function normalizeStoredFixture(raw = {}, context = {}) {
    const goals = goalsFromStored(raw);
    const statusRaw = mapBbdStatus(raw.status);
    const homeName = teamNameFromSide(raw.home);
    const awayName = teamNameFromSide(raw.away);
    return {
        schema_version: 'skcs:bigballsdata:fixture-stored:v1',
        provider: 'big_balls_data',
        lane: 'evaluation',
        provider_event_id: toStringId(raw.id),
        GameId: toStringId(raw.id),
        provider_league_id: toStringId(raw.league),
        sport: raw.sport != null ? String(raw.sport) : (context.sport || 'football'),
        HomeTeam: homeName,
        AwayTeam: awayName,
        home_team_name: homeName,
        away_team_name: awayName,
        kickoff_time_utc: raw.kickoff_utc != null ? String(raw.kickoff_utc) : null,
        status_raw: raw.status != null ? String(raw.status) : null,
        MatchStatusNormalized: normalizeStatus(statusRaw),
        HomeGoals: goals.home,
        AwayGoals: goals.away,
        attendance: toNumberOrNull(raw.attendance),
        odds_count: toNumberOrNull(raw.odds_count),
        data_lane: 'stored',
        confidence: toNumberOrNull(context.confidence),
        source_tier: context.source != null ? String(context.source) : null
    };
}

function normalizeFixture(raw = {}, context = {}) {
    const statusRaw = mapBbdStatus(raw.status);
    const homeName = teamNameFromSide(raw.home);
    const awayName = teamNameFromSide(raw.away);
    const score = raw.score && typeof raw.score === 'object' ? raw.score : null;

    return {
        schema_version: 'skcs:bigballsdata:fixture:v1',
        provider: 'big_balls_data',
        lane: 'evaluation',
        provider_event_id: toStringId(raw.id || raw.match_id),
        GameId: toStringId(raw.id || raw.match_id),
        provider_league_id: toStringId(raw.league_id || context.league_id),
        sport: raw.sport != null ? String(raw.sport) : (context.sport || 'football'),
        season: raw.season != null ? String(raw.season) : null,
        HomeTeam: homeName,
        AwayTeam: awayName,
        home_team_name: homeName,
        away_team_name: awayName,
        provider_home_team_id: toStringId(raw.home?.team_id),
        provider_away_team_id: toStringId(raw.away?.team_id),
        kickoff_time_utc: raw.start_time != null ? String(raw.start_time) : null,
        status_raw: raw.status != null ? String(raw.status) : null,
        MatchStatusNormalized: normalizeStatus(statusRaw),
        HomeGoals: toNumberOrNull(score?.home ?? raw.home_score),
        AwayGoals: toNumberOrNull(score?.away ?? raw.away_score),
        venue: raw.venue != null ? String(raw.venue) : null,
        confidence: toNumberOrNull(context.confidence ?? raw._meta?.confidence),
        source_tier: context.source != null ? String(context.source) : null,
        score_only: context.score_only === true
    };
}

function normalizeFixtureDetail(raw = {}, context = {}) {
    const base = normalizeFixture(raw, context);
    const fields = raw._fields && typeof raw._fields === 'object' ? raw._fields : null;
    return {
        ...base,
        schema_version: 'skcs:bigballsdata:fixture-detail:v1',
        field_bundle: fields,
        updated_at: raw.updated_at != null ? String(raw.updated_at) : null
    };
}

function normalizeStandingRow(raw = {}) {
    return {
        position: toNumberOrNull(raw.position ?? raw.rank),
        provider_team_id: toStringId(raw.team_id),
        team_name: raw.team_name != null ? String(raw.team_name) : null,
        played: toNumberOrNull(raw.played ?? raw.games_played),
        won: toNumberOrNull(raw.won ?? raw.wins),
        drawn: toNumberOrNull(raw.drawn ?? raw.draws),
        lost: toNumberOrNull(raw.lost ?? raw.losses),
        goals_for: toNumberOrNull(raw.goals_for ?? raw.gf),
        goals_against: toNumberOrNull(raw.goals_against ?? raw.ga),
        goal_difference: toNumberOrNull(raw.goal_difference ?? raw.gd),
        points: toNumberOrNull(raw.points ?? raw.pts),
        form: raw.form != null ? String(raw.form) : null
    };
}

function normalizeStandings(raw = {}, context = {}) {
    let source = raw;
    if (raw.standings && typeof raw.standings === 'object') {
        source = raw.standings.value || raw.standings;
    }
    const rows = Array.isArray(source)
        ? source
        : (Array.isArray(source?.rows) ? source.rows : (Array.isArray(raw.rows) ? raw.rows : []));
    return {
        schema_version: 'skcs:bigballsdata:standings:v1',
        provider: 'big_balls_data',
        lane: 'evaluation',
        provider_league_id: toStringId(context.league_id),
        sport: context.sport || 'football',
        season: context.season != null ? String(context.season) : null,
        rows: rows.map(normalizeStandingRow),
        confidence: toNumberOrNull(context.confidence),
        source_tier: context.source != null ? String(context.source) : null
    };
}

function normalizeOddsBundle(raw = {}, context = {}) {
    const selections = Array.isArray(raw.selections) ? raw.selections : [];
    return {
        schema_version: 'skcs:bigballsdata:odds:v1',
        provider: 'big_balls_data',
        lane: 'evaluation',
        provider_event_id: toStringId(raw.match_id || context.match_id),
        market: raw.market != null ? String(raw.market) : null,
        selections: selections.map((row) => ({
            outcome_code: row.name != null ? String(row.name) : null,
            odds_decimal: toNumberOrNull(row.decimal_odds),
            line: toNumberOrNull(row.line)
        })),
        updated_at: raw.updated_at != null ? String(raw.updated_at) : null,
        confidence: toNumberOrNull(context.confidence)
    };
}

function normalizeLineupsFromFields(fieldBundle = {}, context = {}) {
    const lineups = fieldBundle?.lineups?.value ?? fieldBundle?.lineups ?? null;
    return {
        schema_version: 'skcs:bigballsdata:lineups:v1',
        provider: 'big_balls_data',
        lane: 'evaluation',
        provider_event_id: toStringId(context.match_id),
        lineups,
        confidence: toNumberOrNull(fieldBundle?.lineups?.confidence ?? context.confidence)
    };
}

module.exports = {
    normalizeCompetition,
    normalizeFixture,
    normalizeFixtureDetail,
    normalizeLineupsFromFields,
    normalizeOddsBundle,
    normalizeScoreRow,
    normalizeStandings,
    normalizeStoredFixture
};
