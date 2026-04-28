'use strict';

require('dotenv').config();
require('dotenv').config({ path: 'backend/.env', override: false });

const axios = require('axios');

const DEFAULT_HOST = 'free-livescore-api.p.rapidapi.com';
const DEFAULT_ENDPOINT = '/livescore-get-events';

function getConfig() {
    const host = String(process.env.FREE_LIVESCORE_RAPIDAPI_HOST || DEFAULT_HOST).trim() || DEFAULT_HOST;
    const key = String(
        process.env.FREE_LIVESCORE_RAPIDAPI_KEY
        || process.env.X_RAPIDAPI_KEY
        || process.env.RAPIDAPI_KEY
        || ''
    ).trim();
    return { host, key };
}

function extractRateLimit(headers) {
    const source = headers && typeof headers === 'object' ? headers : {};
    const get = (name) => {
        const value = source[name] ?? source[String(name).toLowerCase()];
        return value === undefined || value === null || value === '' ? null : String(value);
    };
    return {
        requests_remaining: get('x-ratelimit-requests-remaining'),
        rapid_free_hard_limit_remaining: get('x-ratelimit-rapid-free-plans-hard-limit-remaining')
    };
}

function safeKeys(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : [];
}

function firstArrayInObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    for (const value of Object.values(obj)) {
        if (Array.isArray(value)) return value;
    }
    return null;
}

function pick(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return null;
}

function normalizeFixture(row) {
    const item = row && typeof row === 'object' ? row : {};
    const homeObj = item.HomeTeam || item.Hm || item.home || item.homeTeam || {};
    const awayObj = item.AwayTeam || item.Aw || item.away || item.awayTeam || {};
    const scoreObj = item.Score || item.Scr || item.score || {};
    const stageObj = item.Stage || item.Comp || item.League || item.stage || {};
    const statusObj = item.Status || item.St || item.status || {};

    return {
        match_id: String(pick(item.Eid, item.ID, item.id, item.MatchId, item.EventId) || '') || null,
        kickoff_time: pick(
            item.Esd,
            item.KO,
            item.Start,
            item.startTime,
            item.start_date,
            item.start_time,
            item.Date
        ) || null,
        home_team: pick(homeObj.Nm, homeObj.name, item.HmNm, item.HomeTeamName, item.Home) || null,
        away_team: pick(awayObj.Nm, awayObj.name, item.AwNm, item.AwayTeamName, item.Away) || null,
        competition_or_stage: pick(
            stageObj.Snm,
            stageObj.CompN,
            stageObj.Nm,
            item.Snm,
            item.CompN,
            item.League,
            item.Competition
        ) || null,
        status: pick(statusObj.Name, statusObj.Short, statusObj.Status, item.Eps, item.Status, item.St) || null,
        score: pick(
            item.Tr1,
            item.Tr2,
            item.Scr,
            item.Score,
            scoreObj.fulltime,
            scoreObj.current
        ) || null,
        sport_id: pick(item.Spid, item.SportId, stageObj.Spid) || null,
        provider_ids: {
            event_id: pick(item.Eid, item.ID, item.id, item.MatchId, item.EventId) || null,
            stage_id: pick(item.Sid, stageObj.Sid, item.StageId) || null,
            competition_id: pick(item.CompId, stageObj.CompId, item.LeagueId) || null,
            home_team_id: pick(item.HomeTeamId, item.Hid, homeObj.ID, homeObj.Id) || null,
            away_team_id: pick(item.AwayTeamId, item.Aid, awayObj.ID, awayObj.Id) || null
        },
        raw_keys: safeKeys(item)
    };
}

function evaluateFieldCoverage(fixtures) {
    const fields = [
        'match_id',
        'kickoff_time',
        'home_team',
        'away_team',
        'competition_or_stage',
        'status',
        'score',
        'sport_id',
        'provider_ids.event_id',
        'provider_ids.stage_id',
        'provider_ids.competition_id',
        'provider_ids.home_team_id',
        'provider_ids.away_team_id'
    ];

    const total = fixtures.length;
    const getValue = (obj, path) => path.split('.').reduce((acc, part) => (acc ? acc[part] : null), obj);
    const out = {};

    for (const field of fields) {
        const populated = fixtures.filter((fixture) => {
            const value = getValue(fixture, field);
            return value !== null && value !== undefined && value !== '';
        }).length;
        out[field] = { populated, total };
    }
    return out;
}

async function run() {
    const sportname = String(process.argv[2] || 'soccer').trim() || 'soccer';
    const endpoint = String(process.argv[3] || DEFAULT_ENDPOINT).trim() || DEFAULT_ENDPOINT;
    const { host, key } = getConfig();

    if (!key) {
        throw new Error('Missing FREE_LIVESCORE_RAPIDAPI_KEY / X_RAPIDAPI_KEY / RAPIDAPI_KEY');
    }

    const response = await axios.get(`https://${host}${endpoint}`, {
        timeout: 15000,
        validateStatus: () => true,
        params: { sportname },
        headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-host': host,
            'x-rapidapi-key': key,
            Accept: 'application/json'
        }
    });

    const raw = response.data;
    const responseObj = raw && typeof raw === 'object' ? raw.response : null;
    const responseKeys = safeKeys(responseObj);
    const fixturesSource = Array.isArray(responseObj)
        ? responseObj
        : (Array.isArray(responseObj?.Events) ? responseObj.Events : (firstArrayInObject(responseObj) || []));
    const normalized = fixturesSource.map(normalizeFixture);
    const first3 = normalized.slice(0, 3);
    const coverage = evaluateFieldCoverage(normalized);
    const rateLimit = extractRateLimit(response.headers);

    const safety = [
        coverage.match_id.populated > 0,
        coverage.kickoff_time.populated > 0,
        coverage.home_team.populated > 0,
        coverage.away_team.populated > 0,
        coverage.competition_or_stage.populated > 0,
        coverage.status.populated > 0,
        coverage.sport_id.populated > 0
    ].every(Boolean);

    console.log('Endpoint tested:', endpoint);
    console.log('HTTP status:', response.status);
    console.log('Quota remaining:', rateLimit);
    console.log('Raw top-level keys:', safeKeys(raw));
    console.log('Response keys:', responseKeys);
    console.log('Fixture count discovered:', normalized.length);
    console.log('First 3 fixtures/matches:', first3);
    console.log('Field population:', coverage);
    console.log('Safe as SKCS raw fixture source:', safety ? 'yes' : 'no_or_inconclusive');
}

run().catch((error) => {
    console.error('Test failed:', error?.message || error);
    process.exitCode = 1;
});
