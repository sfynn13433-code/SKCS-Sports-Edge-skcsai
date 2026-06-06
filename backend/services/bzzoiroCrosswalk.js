'use strict';

const { APISportsClient, getSoccerSeasonYear } = require('../apiClients');
const { listEvents, listLeagues } = require('./bzzoiroApiClient');

const TIER1_CROSSWALK_TARGETS = Object.freeze([
    { apisportsId: '39', competition: 'Premier League', bsdLeagueId: '1', bsdHints: ['premier league', 'epl', 'england'] },
    { apisportsId: '140', competition: 'La Liga', bsdLeagueId: '3', bsdHints: ['la liga', 'primera division', 'spain primera'] },
    { apisportsId: '78', competition: 'Bundesliga', bsdLeagueId: '5', bsdHints: ['bundesliga', 'germany'] },
    { apisportsId: '135', competition: 'Serie A', bsdLeagueId: '4', bsdHints: ['serie a', 'italy'] },
    { apisportsId: '61', competition: 'Ligue 1', bsdLeagueId: '6', bsdHints: ['ligue 1', 'france'] },
    { apisportsId: '3', competition: 'UEFA Champions League', bsdLeagueId: '7', bsdHints: ['champions league', 'uefa champions'] },
    { apisportsId: '98', competition: 'J1 League', bsdLeagueId: '49', bsdHints: ['j1 league', 'j.league', 'japan'] },
    { apisportsId: '169', competition: 'Chinese Super League', bsdLeagueId: '52', bsdHints: ['chinese super', 'china super'] },
    { apisportsId: '253', competition: 'MLS', bsdLeagueId: '18', bsdHints: ['major league soccer', 'mls', 'usa mls'] },
    { apisportsId: '71', competition: 'Brasileirão Série A', bsdLeagueId: '9', bsdHints: ['brasileir', 'serie a brazil', 'brazil serie a'] }
]);

function normalizeTeamName(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(fc|cf|sc|afc|fk|sv|vfb|tsv|ac)\b/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseKickoffMs(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function teamPairKey(home, away) {
    const h = normalizeTeamName(home);
    const a = normalizeTeamName(away);
    return `${h}|${a}`;
}

function teamsLooselyMatch(homeA, awayA, homeB, awayB) {
    const keyA = teamPairKey(homeA, awayA);
    const keyB = teamPairKey(homeB, awayB);
    if (keyA === keyB) return true;

    const hA = normalizeTeamName(homeA);
    const aA = normalizeTeamName(awayA);
    const hB = normalizeTeamName(homeB);
    const aB = normalizeTeamName(awayB);

    const direct = (hA === hB && aA === aB);
    const swapped = (hA === aB && aA === hB);
    if (direct || swapped) return true;

    const includes = (left, right) => left.includes(right) || right.includes(left);
    return includes(hA, hB) && includes(aA, aB);
}

function normalizeBsdEvent(row = {}) {
    return {
        provider: 'bzzoiro',
        provider_event_id: String(row.id),
        provider_league_id: row.league_id != null ? String(row.league_id) : null,
        home_team: row.home_team || row.home_team_name || null,
        away_team: row.away_team || row.away_team_name || null,
        kickoff_ms: parseKickoffMs(row.event_date || row.start_time || row.kickoff),
        status: row.status || null
    };
}

function normalizeApiSportsFixture(row = {}) {
    return {
        provider: 'api-sports',
        provider_event_id: String(row.fixture?.id || ''),
        provider_league_id: row.league?.id != null ? String(row.league.id) : null,
        home_team: row.teams?.home?.name || null,
        away_team: row.teams?.away?.name || null,
        kickoff_ms: parseKickoffMs(row.fixture?.date),
        status: row.fixture?.status?.short || row.fixture?.status?.long || null
    };
}

function kickoffDeltaMinutes(a, b) {
    if (a == null || b == null) return null;
    return Math.round(Math.abs(a - b) / 60000);
}

function matchFixtureSets(bsdEvents, apiEvents, options = {}) {
    const maxKickoffDeltaMin = Number.isFinite(Number(options.maxKickoffDeltaMin))
        ? Number(options.maxKickoffDeltaMin)
        : 180;

    const apiPool = [...apiEvents];
    const matches = [];
    const bsdOnly = [];
    const usedApi = new Set();

    for (const bsd of bsdEvents) {
        let best = null;
        let bestIdx = -1;

        for (let i = 0; i < apiPool.length; i += 1) {
            if (usedApi.has(i)) continue;
            const api = apiPool[i];
            if (!teamsLooselyMatch(bsd.home_team, bsd.away_team, api.home_team, api.away_team)) {
                continue;
            }

            const delta = kickoffDeltaMinutes(bsd.kickoff_ms, api.kickoff_ms);
            if (delta != null && delta > maxKickoffDeltaMin) continue;

            if (!best || (delta != null && (best.delta == null || delta < best.delta))) {
                best = { api, delta };
                bestIdx = i;
            }
        }

        if (best) {
            usedApi.add(bestIdx);
            matches.push({
                bsd_event_id: bsd.provider_event_id,
                apisports_fixture_id: best.api.provider_event_id,
                home_team: bsd.home_team,
                away_team: bsd.away_team,
                kickoff_delta_minutes: best.delta,
                bsd_status: bsd.status,
                apisports_status: best.api.status
            });
        } else {
            bsdOnly.push(bsd);
        }
    }

    const apisportsOnly = apiPool.filter((_, idx) => !usedApi.has(idx));

    return { matches, bsdOnly, apisportsOnly };
}

function scoreLeagueName(leagueName, hints = []) {
    const normalized = String(leagueName || '').trim().toLowerCase();
    if (!normalized) return 0;
    let score = 0;
    for (const hint of hints) {
        const h = String(hint || '').trim().toLowerCase();
        if (!h) continue;
        if (normalized === h) score += 10;
        else if (normalized.includes(h)) score += 5;
    }
    return score;
}

async function fetchAllBsdLeagues() {
    const rows = [];
    let offset = 0;
    const limit = 200;

    while (true) {
        const res = await listLeagues({ limit, offset, is_active: true });
        if (!res.ok) throw new Error(res.reason || 'listLeagues failed');
        const batch = Array.isArray(res.data?.results) ? res.data.results : [];
        rows.push(...batch);
        if (batch.length < limit) break;
        offset += limit;
        if (offset > 2000) break;
    }

    return rows;
}

function resolveBsdLeagueMap(bsdLeagues, targets = TIER1_CROSSWALK_TARGETS) {
    return targets.map((target) => {
        let best = null;
        for (const league of bsdLeagues) {
            const score = scoreLeagueName(league.name, target.bsdHints);
            if (!best || score > best.score) {
                best = { league, score };
            }
        }

        const resolvedId = best?.score >= 5 ? String(best.league.id) : null;
        const fallbackId = target.bsdLeagueId ? String(target.bsdLeagueId) : null;

        return {
            apisports_league_id: target.apisportsId,
            competition: target.competition,
            bsd_league_id: resolvedId || fallbackId,
            bsd_league_name: best?.league?.name || target.competition,
            match_score: best?.score || (fallbackId ? 10 : 0),
            mapping_source: resolvedId ? 'live_name_match' : (fallbackId ? 'verified_static_map' : 'unresolved')
        };
    });
}

async function fetchBsdEventsForLeague(leagueId, dateFrom, dateTo) {
    const rows = [];
    let offset = 0;
    const limit = 200;

    while (true) {
        const res = await listEvents({
            league_id: leagueId,
            date_from: dateFrom,
            date_to: dateTo,
            limit,
            offset
        });
        if (!res.ok) throw new Error(res.reason || `listEvents failed for league ${leagueId}`);
        const batch = Array.isArray(res.data?.results) ? res.data.results : [];
        rows.push(...batch.map(normalizeBsdEvent));
        if (batch.length < limit) break;
        offset += limit;
        if (offset > 1000) break;
    }

    return rows;
}

async function fetchApiSportsFixtures(leagueId, dateFrom, dateTo, season) {
    const client = new APISportsClient();
    try {
        const data = await client.getFixtures(leagueId, season, { from: dateFrom, to: dateTo }, 'Football');
        const rows = Array.isArray(data?.response) ? data.response : [];
        return { ok: true, events: rows.map(normalizeApiSportsFixture), error: null };
    } catch (error) {
        const message = error?.message || String(error);
        const quotaBlocked = /quota|blocked|exhausted/i.test(message);
        return {
            ok: false,
            events: [],
            error: message,
            quota_blocked: quotaBlocked
        };
    }
}

async function runLeagueCrosswalk({ leagueTarget, dateFrom, dateTo, season, maxKickoffDeltaMin }) {
    const bsdLeagueId = leagueTarget.bsd_league_id;
    if (!bsdLeagueId) {
        return {
            competition: leagueTarget.competition,
            apisports_league_id: leagueTarget.apisports_league_id,
            bsd_league_id: null,
            skipped: true,
            reason: 'No BSD league mapping resolved'
        };
    }

    const [bsdEvents, apiResult] = await Promise.all([
        fetchBsdEventsForLeague(bsdLeagueId, dateFrom, dateTo),
        fetchApiSportsFixtures(leagueTarget.apisports_league_id, dateFrom, dateTo, season)
    ]);

    const apiEvents = apiResult.events || [];
    if (!apiResult.ok) {
        return {
            competition: leagueTarget.competition,
            apisports_league_id: leagueTarget.apisports_league_id,
            bsd_league_id: bsdLeagueId,
            bsd_league_name: leagueTarget.bsd_league_name,
            window: { date_from: dateFrom, date_to: dateTo },
            skipped: true,
            reason: apiResult.error,
            quota_blocked: Boolean(apiResult.quota_blocked),
            counts: {
                bsd_events: bsdEvents.length,
                apisports_fixtures: 0,
                matched: 0,
                bsd_only: bsdEvents.length,
                apisports_only: 0
            },
            sample_bsd_only: bsdEvents.slice(0, 3).map((row) => ({
                event_id: row.provider_event_id,
                home_team: row.home_team,
                away_team: row.away_team
            }))
        };
    }

    const result = matchFixtureSets(bsdEvents, apiEvents, { maxKickoffDeltaMin });
    const matched = result.matches.length;
    const denominator = Math.max(apiEvents.length, 1);

    return {
        competition: leagueTarget.competition,
        apisports_league_id: leagueTarget.apisports_league_id,
        bsd_league_id: bsdLeagueId,
        bsd_league_name: leagueTarget.bsd_league_name,
        window: { date_from: dateFrom, date_to: dateTo },
        counts: {
            bsd_events: bsdEvents.length,
            apisports_fixtures: apiEvents.length,
            matched,
            bsd_only: result.bsdOnly.length,
            apisports_only: result.apisportsOnly.length
        },
        match_rate_pct: Math.round((matched / denominator) * 100),
        kickoff_deltas_minutes: result.matches
            .map((row) => row.kickoff_delta_minutes)
            .filter((v) => v != null),
        sample_matches: result.matches.slice(0, 5),
        sample_bsd_only: result.bsdOnly.slice(0, 3).map((row) => ({
            event_id: row.provider_event_id,
            home_team: row.home_team,
            away_team: row.away_team
        })),
        sample_apisports_only: result.apisportsOnly.slice(0, 3).map((row) => ({
            fixture_id: row.provider_event_id,
            home_team: row.home_team,
            away_team: row.away_team
        }))
    };
}

function shiftIsoDate(dateString, offsetDays) {
    const date = new Date(`${dateString}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
}

module.exports = {
    TIER1_CROSSWALK_TARGETS,
    fetchAllBsdLeagues,
    resolveBsdLeagueMap,
    runLeagueCrosswalk,
    normalizeTeamName,
    matchFixtureSets,
    shiftIsoDate,
    getSoccerSeasonYear
};
