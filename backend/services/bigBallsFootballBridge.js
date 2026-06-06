'use strict';

const { resolveBigBallsFootballLeague } = require('../config/bigBallsLeagueMap');
const {
    isBigBallsDataEnabled,
    listMatches,
    listStoredMatches,
    unwrapFieldBundle
} = require('./bigBallsDataApiClient');

function isBigBallsPrimaryFootball() {
    return String(process.env.BIG_BALLS_PRIMARY_FOOTBALL || '').trim() === 'true'
        && isBigBallsDataEnabled();
}

function parseKickoffMs(value) {
    if (!value) return null;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
}

function inDateWindow(kickoffUtc, fromDate, toDate) {
    const ms = parseKickoffMs(kickoffUtc);
    if (ms === null) return true;
    const fromMs = Date.parse(`${fromDate}T00:00:00.000Z`);
    const toMs = Date.parse(`${toDate}T23:59:59.999Z`);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return true;
    return ms >= fromMs && ms <= toMs;
}

function goalsFromStored(row = {}) {
    if (row.score && typeof row.score === 'object') {
        return { home: row.score.home ?? null, away: row.score.away ?? null };
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

function toPredictionInputFromBigBalls(row = {}, mapRow = {}) {
    const stored = row.id && (row.home?.name || row.away?.name);
    if (stored) {
        const goals = goalsFromStored(row);
        return {
            match_id: `bbd-${row.id}`,
            sport: 'football',
            home_team: row.home?.name || null,
            away_team: row.away?.name || null,
            date: row.kickoff_utc || null,
            status: row.status || null,
            market: '1X2',
            prediction: null,
            confidence: null,
            volatility: null,
            odds: null,
            provider: 'big_balls_data',
            provider_name: 'Big Balls Data',
            league: row.league || mapRow.competition || null,
            country: mapRow.country || null,
            league_id: mapRow.skcs_league_id || null,
            home_score: goals.home,
            away_score: goals.away,
            raw_provider_data: row
        };
    }

    const matchId = row.match_id || row.id;
    return {
        match_id: matchId ? `bbd-${matchId}` : null,
        sport: 'football',
        home_team: row.home_team || row.home?.team_name || null,
        away_team: row.away_team || row.away?.team_name || null,
        date: row.start_time || row.updated_at || null,
        status: row.status || null,
        market: '1X2',
        prediction: null,
        confidence: null,
        volatility: null,
        odds: null,
        provider: 'big_balls_data',
        provider_name: 'Big Balls Data',
        league: mapRow.competition || null,
        league_id: mapRow.skcs_league_id || null,
        home_score: row.home ?? row.home_score ?? null,
        away_score: row.away ?? row.away_score ?? null,
        raw_provider_data: row
    };
}

async function fetchBigBallsFootballFixtures(options = {}) {
    if (!isBigBallsPrimaryFootball()) return [];

    const leagueId = String(options.leagueId || '').trim();
    const mapRow = resolveBigBallsFootballLeague(leagueId);
    if (!mapRow) {
        console.warn(`[bigBallsFootballBridge] No BBD mapping for leagueId=${leagueId}`);
        return [];
    }

    const fromDate = options.fromDate;
    const toDate = options.toDate;
    const limit = Number(options.limit) || 50;
    const rows = [];

    const stored = await listStoredMatches({
        sport: 'football',
        league: mapRow.bbd_alias,
        limit
    });
    if (stored.ok && Array.isArray(stored.data)) {
        for (const item of stored.data) {
            if (!inDateWindow(item.kickoff_utc, fromDate, toDate)) continue;
            const mapped = toPredictionInputFromBigBalls(item, mapRow);
            if (mapped.match_id && mapped.home_team && mapped.away_team) rows.push(mapped);
        }
    }

    const live = await listMatches({
        sport: 'football',
        league: mapRow.bbd_alias,
        limit
    });
    if (live.ok) {
        const scoreRows = unwrapFieldBundle(live.data, 'scores') || [];
        for (const item of scoreRows) {
            const kickoff = item.start_time || item.updated_at || item.kickoff_utc;
            if (!inDateWindow(kickoff, fromDate, toDate)) continue;
            const mapped = toPredictionInputFromBigBalls(item, mapRow);
            if (mapped.match_id && mapped.home_team && mapped.away_team) rows.push(mapped);
        }
    }

    const deduped = [];
    const seen = new Set();
    for (const row of rows) {
        const key = `${row.home_team}|${row.away_team}|${row.date || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(row);
    }

    console.log(`[bigBallsFootballBridge] league=${mapRow.competition} alias=${mapRow.bbd_alias} fixtures=${deduped.length}`);
    return deduped;
}

module.exports = {
    fetchBigBallsFootballFixtures,
    isBigBallsPrimaryFootball,
    toPredictionInputFromBigBalls
};
