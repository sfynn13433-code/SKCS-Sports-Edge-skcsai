'use strict';

const { normalizeStatus } = require('../../semantic-layer/registry');
const {
    normalizeLineups,
    normalizeOddsComparison
} = require('./bzzoiroNormalizer');

function toStringId(value) {
    if (value === null || value === undefined || value === '') return null;
    return String(value);
}

function toNumberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function mapBsdStatus(rawStatus) {
    const key = String(rawStatus || '').trim().toLowerCase();
    if (key === 'notstarted') return 'scheduled';
    if (key === 'finished') return 'final';
    if (key === 'inprogress') return 'inprogress';
    return rawStatus;
}

function normalizeCompetition(raw = {}) {
    const season = raw.current_season && typeof raw.current_season === 'object' ? raw.current_season : null;
    return {
        schema_version: 'skcs:bsd:competition:v1',
        provider: 'bsd',
        lane: 'evaluation',
        provider_league_id: toStringId(raw.id),
        CompetitionId: toStringId(raw.id),
        competition_name: raw.name != null ? String(raw.name) : null,
        country_name: raw.country != null ? String(raw.country) : null,
        is_women: raw.is_women === true,
        competition_active: raw.is_active === true,
        provider_season_id: season ? toStringId(season.id) : null,
        season_name: season?.name != null ? String(season.name) : null,
        season_year: toNumberOrNull(season?.year),
        season_start_date: season?.start_date != null ? String(season.start_date) : null,
        season_end_date: season?.end_date != null ? String(season.end_date) : null
    };
}

function normalizeFixture(raw = {}) {
    const statusRaw = mapBsdStatus(raw.status);
    const homeName = raw.home_team != null
        ? String(raw.home_team)
        : (raw.home_team_name != null ? String(raw.home_team_name) : null);
    const awayName = raw.away_team != null
        ? String(raw.away_team)
        : (raw.away_team_name != null ? String(raw.away_team_name) : null);

    return {
        schema_version: 'skcs:bsd:fixture:v1',
        provider: 'bsd',
        lane: 'evaluation',
        provider_event_id: toStringId(raw.id),
        GameId: toStringId(raw.id),
        provider_league_id: toStringId(raw.league_id),
        provider_season_id: toStringId(raw.season_id),
        provider_home_team_id: toStringId(raw.home_team_id),
        provider_away_team_id: toStringId(raw.away_team_id),
        HomeTeam: homeName,
        AwayTeam: awayName,
        home_team_name: homeName,
        away_team_name: awayName,
        kickoff_time_utc: raw.event_date != null ? String(raw.event_date) : null,
        status_raw: raw.status != null ? String(raw.status) : null,
        MatchStatusNormalized: normalizeStatus(statusRaw),
        HomeGoals: toNumberOrNull(raw.home_score),
        AwayGoals: toNumberOrNull(raw.away_score),
        home_score_ht: toNumberOrNull(raw.home_score_ht),
        away_score_ht: toNumberOrNull(raw.away_score_ht),
        round_number: toNumberOrNull(raw.round_number),
        round_name: raw.round_name != null ? String(raw.round_name) : null,
        group_name: raw.group_name != null ? String(raw.group_name) : null,
        venue_id: toStringId(raw.venue_id),
        current_minute: toNumberOrNull(raw.current_minute)
    };
}

function normalizeFixtureDetail(raw = {}) {
    const base = normalizeFixture(raw);
    return {
        ...base,
        schema_version: 'skcs:bsd:fixture-detail:v1',
        home_coach_id: toStringId(raw.home_coach_id),
        away_coach_id: toStringId(raw.away_coach_id),
        referee_id: toStringId(raw.referee_id),
        is_local_derby: raw.is_local_derby === true,
        is_neutral_ground: raw.is_neutral_ground === true,
        travel_distance_km: toNumberOrNull(raw.travel_distance_km),
        weather: raw.weather && typeof raw.weather === 'object' ? {
            code: raw.weather.code,
            description: raw.weather.description,
            wind_speed: toNumberOrNull(raw.weather.wind_speed),
            temperature_c: toNumberOrNull(raw.weather.temperature_c)
        } : null,
        head_to_head: raw.head_to_head && typeof raw.head_to_head === 'object' ? raw.head_to_head : null,
        highlights_count: Array.isArray(raw.highlights) ? raw.highlights.length : 0,
        live_websocket: raw.live_websocket === true
    };
}

function normalizeStandingRow(raw = {}) {
    return {
        position: toNumberOrNull(raw.position),
        provider_team_id: toStringId(raw.team_id),
        team_name: raw.team_name != null ? String(raw.team_name) : null,
        played: toNumberOrNull(raw.played),
        won: toNumberOrNull(raw.won),
        drawn: toNumberOrNull(raw.drawn),
        lost: toNumberOrNull(raw.lost),
        goals_for: toNumberOrNull(raw.gf),
        goals_against: toNumberOrNull(raw.ga),
        goal_difference: toNumberOrNull(raw.gd),
        points: toNumberOrNull(raw.pts),
        form: raw.form != null ? String(raw.form) : null,
        live: raw.live === true,
        xgf: toNumberOrNull(raw.xgf),
        xga: toNumberOrNull(raw.xga),
        xgd: toNumberOrNull(raw.xgd),
        xg_games: toNumberOrNull(raw.xg_games)
    };
}

function isStandingRow(row) {
    return row && typeof row === 'object' && row.team_id != null;
}

function normalizeStandings(raw = {}, context = {}) {
    const groups = [];

    if (raw.groups && typeof raw.groups === 'object' && !Array.isArray(raw.groups)) {
        for (const [groupName, rows] of Object.entries(raw.groups)) {
            groups.push({
                group_name: groupName,
                rows: (Array.isArray(rows) ? rows : []).map(normalizeStandingRow)
            });
        }
    } else if (Array.isArray(raw.standings) && raw.standings.length && isStandingRow(raw.standings[0])) {
        groups.push({
            group_name: null,
            rows: raw.standings.map(normalizeStandingRow)
        });
    } else if (Array.isArray(raw.groups)) {
        raw.groups.forEach((group) => {
            groups.push({
                group_name: group.group_name != null ? String(group.group_name) : null,
                rows: (Array.isArray(group.standings) ? group.standings : []).map(normalizeStandingRow)
            });
        });
    } else if (Array.isArray(raw.results)) {
        groups.push({
            group_name: null,
            rows: raw.results.map(normalizeStandingRow)
        });
    } else if (Array.isArray(raw)) {
        groups.push({
            group_name: null,
            rows: raw.map(normalizeStandingRow)
        });
    }

    return {
        schema_version: 'skcs:bsd:standings:v1',
        provider: 'bsd',
        lane: 'evaluation',
        provider_league_id: toStringId(context.leagueId),
        provider_season_id: toStringId(context.seasonId || raw.season_id),
        groups
    };
}

module.exports = {
    normalizeCompetition,
    normalizeFixture,
    normalizeFixtureDetail,
    normalizeLineups,
    normalizeOddsComparison,
    normalizeStandings
};
