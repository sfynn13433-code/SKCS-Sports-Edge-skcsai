'use strict';

require('dotenv').config();
require('dotenv').config({ path: 'backend/.env', override: false });

const { fetchFootball536Endpoint } = require('../backend/services/football536Service');
const { extractFootball536Fixtures } = require('../backend/services/football536Extractor');

const REQUEST_BUDGET = 12;
const DELAY_MS = 250;

let requestCount = 0;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function toArray(raw) {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== 'object') return [];
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.result)) return raw.result;
    if (Array.isArray(raw.response)) return raw.response;
    if (Array.isArray(raw.items)) return raw.items;
    return [];
}

function toNum(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function toIsoOrNull(value) {
    if (value === undefined || value === null || value === '') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function parseSeasonYear(season) {
    const direct = toNum(season?.year || season?.season_year || season?.seasonYear);
    if (direct) return direct;
    const name = String(season?.name || season?.season_name || '').trim();
    const years = name.match(/\b(19|20)\d{2}\b/g);
    if (!years || years.length === 0) return null;
    return Math.max(...years.map((y) => Number(y)));
}

function parseEndDateTs(season) {
    const endDate = season?.end_date || season?.endDate || season?.to || null;
    if (!endDate) return null;
    const ts = Date.parse(endDate);
    return Number.isFinite(ts) ? ts : null;
}

function seasonRankTuple(season) {
    return [
        parseSeasonYear(season) ?? -1,
        parseEndDateTs(season) ?? -1,
        toNum(season?.id ?? season?.season_id) ?? -1
    ];
}

function compareTupleDesc(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
        const av = a[i] ?? -1;
        const bv = b[i] ?? -1;
        if (av > bv) return -1;
        if (av < bv) return 1;
    }
    return 0;
}

function pickRemaining(rateLimit) {
    if (!rateLimit || typeof rateLimit !== 'object') return null;
    return toNum(
        rateLimit.requestsRemaining
        || rateLimit.requests_remaining
        || rateLimit.rapidFreeHardLimitRemaining
        || rateLimit.rapid_free_hard_limit_remaining
    );
}

async function callEndpoint(endpoint, params) {
    if (requestCount >= REQUEST_BUDGET) {
        return {
            ok: false,
            provider: 'football536',
            endpoint,
            status: null,
            params,
            error: 'request_budget_exceeded',
            details: `Request budget ${REQUEST_BUDGET} reached`,
            rateLimit: null
        };
    }

    requestCount += 1;
    const response = await fetchFootball536Endpoint(endpoint, params);
    await sleep(DELAY_MS);
    return response;
}

function statusBucket(status) {
    const text = String(status || '').trim().toUpperCase();
    if (!text) return 'other';
    if (text.includes('SCHED') || ['NS', 'TIMED', 'NOT_STARTED', 'UPCOMING'].includes(text)) return 'scheduled';
    if (text.includes('FINISH') || text === 'FT') return 'finished';
    if (
        text.includes('LIVE')
        || text.includes('IN_PLAY')
        || ['1H', '2H', 'HT', 'ET', 'PEN', 'BREAK'].includes(text)
    ) return 'live';
    return 'other';
}

function summarizeFixtureSet(response, label, now) {
    const raw = response?.data;
    const normalized = extractFootball536Fixtures(raw);
    const nowTs = now.getTime();
    const nowIso = now.toISOString();

    let earliestTs = null;
    let latestTs = null;
    let pastCount = 0;
    let currentOrFutureCount = 0;
    let invalidDateCount = 0;
    let staleScheduledCount = 0;
    const statusCounts = { SCHEDULED: 0, FINISHED: 0, LIVE: 0, OTHER: 0 };
    let hasFutureScheduledLike = false;
    let hasFutureWithMissingStatus = false;

    for (const fixture of normalized) {
        const ts = fixture?.kickoff_time ? Date.parse(fixture.kickoff_time) : NaN;
        const bucket = statusBucket(fixture?.status || fixture?.status_short);

        if (Number.isFinite(ts)) {
            if (earliestTs === null || ts < earliestTs) earliestTs = ts;
            if (latestTs === null || ts > latestTs) latestTs = ts;

            if (ts >= nowTs) {
                currentOrFutureCount += 1;
                if (bucket === 'scheduled') hasFutureScheduledLike = true;
                if (bucket === 'other') hasFutureWithMissingStatus = true;
            } else {
                pastCount += 1;
                if (bucket === 'scheduled') staleScheduledCount += 1;
            }
        } else {
            invalidDateCount += 1;
        }

        if (bucket === 'scheduled') statusCounts.SCHEDULED += 1;
        else if (bucket === 'finished') statusCounts.FINISHED += 1;
        else if (bucket === 'live') statusCounts.LIVE += 1;
        else statusCounts.OTHER += 1;
    }

    let classification = 'unknown';
    const status = Number(response?.status) || null;
    if (!status) classification = 'unknown';
    else if (status === 400 || status === 404 || status === 422) classification = 'invalid_params';
    else if (status === 429 || status >= 500) classification = 'provider_error';
    else if (status >= 200 && status < 300) {
        if (normalized.length === 0) classification = 'empty_success';
        else if (invalidDateCount === normalized.length) classification = 'inconclusive';
        else if (currentOrFutureCount > 0 && (hasFutureScheduledLike || hasFutureWithMissingStatus)) {
            classification = 'current_upcoming_confirmed';
        } else if (statusCounts.SCHEDULED > 0 && currentOrFutureCount === 0 && pastCount > 0) {
            classification = 'historical_scheduled_stale';
        } else if (currentOrFutureCount === 0 && pastCount > 0 && statusCounts.FINISHED + statusCounts.OTHER + statusCounts.LIVE === normalized.length) {
            classification = 'historical_only';
        } else {
            classification = 'inconclusive';
        }
    }

    const preview = normalized.slice(0, 3).map((f) => ({
        kickoff_time: f.kickoff_time,
        status: f.status,
        home: f.home_team?.name || null,
        away: f.away_team?.name || null,
        league: f.league?.name || null
    }));

    const earliest = earliestTs === null ? null : new Date(earliestTs).toISOString();
    const latest = latestTs === null ? null : new Date(latestTs).toISOString();

    const numberOfElements = toNum(raw?.number_of_elements);
    const totalElements = toNum(raw?.total_elements);

    return {
        label,
        endpoint: response?.endpoint,
        params: response?.params,
        status,
        now_iso: nowIso,
        number_of_elements: numberOfElements,
        total_elements: totalElements,
        normalized_count: normalized.length,
        first_three: preview,
        earliest_date: earliest,
        latest_date: latest,
        past_count: pastCount,
        current_or_future_count: currentOrFutureCount,
        invalid_date_count: invalidDateCount,
        stale_scheduled_count: staleScheduledCount,
        scheduled_status_count: statusCounts.SCHEDULED,
        finished_status_count: statusCounts.FINISHED,
        live_status_count: statusCounts.LIVE,
        status_counts: statusCounts,
        classification,
        remaining: pickRemaining(response?.rateLimit)
    };
}

function selectLeagueIds(leagues) {
    const ids = [];
    const hasId = (target) => leagues.some((l) => toNum(l?.id) === target);
    if (hasId(1)) ids.push(1);
    if (hasId(2) && !ids.includes(2)) ids.push(2);
    for (const league of leagues) {
        const id = toNum(league?.id);
        if (!id || ids.includes(id)) continue;
        ids.push(id);
        if (ids.length >= 3) break;
    }
    return ids;
}

function chooseCurrentLeagueCandidate(selectedLeagueIds, latestSeasonByLeague) {
    const candidates = selectedLeagueIds
        .map((leagueId) => ({
            leagueId,
            season: latestSeasonByLeague.get(leagueId) || null
        }))
        .filter((item) => item.season);

    if (candidates.length === 0) return selectedLeagueIds[0] || null;

    candidates.sort((a, b) => compareTupleDesc(seasonRankTuple(a.season), seasonRankTuple(b.season)));
    return candidates[0].leagueId;
}

async function run() {
    const now = new Date();
    const nowIso = now.toISOString();

    const leagueResponse = await callEndpoint('/leagues', {});
    const leagues = toArray(leagueResponse?.data);
    const first10Leagues = leagues.slice(0, 10).map((l) => ({
        id: toNum(l?.id),
        name: l?.name || null,
        area: l?.area || l?.country || null
    }));

    console.log('Step 1: /leagues first 10');
    console.table(first10Leagues);

    const selectedLeagueIds = selectLeagueIds(leagues);
    console.log('Selected league IDs:', selectedLeagueIds);

    const seasonsByLeague = new Map();
    const latestSeasonByLeague = new Map();

    for (const leagueId of selectedLeagueIds) {
        const seasonsResponse = await callEndpoint('/seasons', { league_id: leagueId });
        const seasons = toArray(seasonsResponse?.data);
        seasonsByLeague.set(leagueId, seasons);

        const sorted = [...seasons].sort((a, b) => compareTupleDesc(seasonRankTuple(a), seasonRankTuple(b)));
        const latest = sorted[0] || null;
        if (latest) latestSeasonByLeague.set(leagueId, latest);

        console.log(`Seasons for league_id=${leagueId}:`);
        console.table(seasons.map((s) => ({
            id: toNum(s?.id ?? s?.season_id),
            name: s?.name || null,
            year: parseSeasonYear(s),
            start_date: s?.start_date || s?.startDate || null,
            end_date: s?.end_date || s?.endDate || null
        })).slice(0, 20));
        console.log('Latest season picked:', latest ? {
            league_id: leagueId,
            season_id: toNum(latest?.id ?? latest?.season_id),
            name: latest?.name || null,
            start_date: latest?.start_date || latest?.startDate || null,
            end_date: latest?.end_date || latest?.endDate || null
        } : null);
    }

    const selectedSeasonIds = [];
    for (const leagueId of selectedLeagueIds) {
        const latest = latestSeasonByLeague.get(leagueId);
        const seasonId = toNum(latest?.id ?? latest?.season_id);
        if (seasonId && !selectedSeasonIds.includes(seasonId)) {
            selectedSeasonIds.push(seasonId);
        }
        if (selectedSeasonIds.length >= 3) break;
    }

    console.log('Selected latest season IDs:', selectedSeasonIds);

    for (const seasonId of selectedSeasonIds.slice(0, 3)) {
        const roundsResponse = await callEndpoint('/rounds', { season_id: seasonId });
        const rounds = toArray(roundsResponse?.data);
        const firstRound = rounds[0] || null;
        const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
        console.log(`Rounds for season_id=${seasonId}: count=${rounds.length}`);
        console.log('first_round:', firstRound ? {
            id: toNum(firstRound?.id ?? firstRound?.round_id),
            name: firstRound?.name || null,
            start_date: firstRound?.start_date || null,
            end_date: firstRound?.end_date || null
        } : null);
        console.log('last_round:', lastRound ? {
            id: toNum(lastRound?.id ?? lastRound?.round_id),
            name: lastRound?.name || null,
            start_date: lastRound?.start_date || null,
            end_date: lastRound?.end_date || null
        } : null);
    }

    const fixtureTests = [];
    fixtureTests.push({ label: 'fixtures_scheduled_today', endpoint: '/fixtures', params: { status: 'SCHEDULED', date_from: 'today' } });

    const currentLeagueCandidate = chooseCurrentLeagueCandidate(selectedLeagueIds, latestSeasonByLeague);
    if (currentLeagueCandidate) {
        fixtureTests.push({ label: 'fixtures_by_league', endpoint: '/fixtures', params: { league_id: currentLeagueCandidate } });
        const latestSeason = latestSeasonByLeague.get(currentLeagueCandidate);
        const latestSeasonId = toNum(latestSeason?.id ?? latestSeason?.season_id);
        if (latestSeasonId) {
            fixtureTests.push({
                label: 'fixtures_by_league_and_season',
                endpoint: '/fixtures',
                params: { league_id: currentLeagueCandidate, season_id: latestSeasonId }
            });
        }
    }

    if (selectedSeasonIds.length > 0) {
        fixtureTests.push({ label: 'fixtures_by_season', endpoint: '/fixtures', params: { season_id: selectedSeasonIds[0] } });
    }

    fixtureTests.push({ label: 'fixtures_scheduled_only', endpoint: '/fixtures', params: { status: 'SCHEDULED' } });

    const dedup = [];
    const seen = new Set();
    for (const test of fixtureTests) {
        const key = `${test.endpoint}|${JSON.stringify(test.params)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        dedup.push(test);
        if (dedup.length >= 5) break;
    }

    const fixtureResults = [];
    for (const test of dedup) {
        const response = await callEndpoint(test.endpoint, test.params);
        const summary = summarizeFixtureSet(response, test.label, now);
        fixtureResults.push(summary);
        console.log(`Fixture test: ${test.label}`);
        console.log('endpoint:', summary.endpoint);
        console.log('params:', summary.params);
        console.log('HTTP status:', summary.status);
        console.log('number_of_elements:', summary.number_of_elements);
        console.log('total_elements:', summary.total_elements);
        console.log('normalized fixture count:', summary.normalized_count);
        console.log('first 3 fixtures:', summary.first_three);
        console.log('now_iso:', summary.now_iso);
        console.log('earliest date:', summary.earliest_date);
        console.log('latest date:', summary.latest_date);
        console.log('past_count:', summary.past_count);
        console.log('current_or_future_count:', summary.current_or_future_count);
        console.log('invalid_date_count:', summary.invalid_date_count);
        console.log('scheduled_status_count:', summary.scheduled_status_count);
        console.log('finished_status_count:', summary.finished_status_count);
        console.log('live_status_count:', summary.live_status_count);
        console.log('stale_scheduled_count:', summary.stale_scheduled_count);
        console.log('status counts:', summary.status_counts);
        console.log('classification:', summary.classification);
    }

    const anyUpcoming = fixtureResults.some((r) => r.classification === 'current_upcoming_confirmed');
    const anyHistoricalOrStale = fixtureResults.some((r) => r.classification === 'historical_only' || r.classification === 'historical_scheduled_stale');
    let finalClassification = 'current_upcoming_not_confirmed';
    if (anyUpcoming) finalClassification = 'current_upcoming_confirmed';
    else if (anyHistoricalOrStale) finalClassification = 'historical_or_stale_fixture_source';

    console.log('\nSummary');
    console.log('now_iso used by script:', nowIso);
    console.log(`total live requests used: ${requestCount}`);
    console.log('selected league IDs:', selectedLeagueIds);
    console.log('selected latest season IDs:', selectedSeasonIds);
    console.table(fixtureResults.map((r) => ({
        label: r.label,
        endpoint: r.endpoint,
        params: JSON.stringify(r.params),
        status: r.status,
        now_iso: r.now_iso,
        number_of_elements: r.number_of_elements,
        total_elements: r.total_elements,
        normalized_count: r.normalized_count,
        earliest_date: r.earliest_date,
        latest_date: r.latest_date,
        past_count: r.past_count,
        current_or_future_count: r.current_or_future_count,
        scheduled_status_count: r.scheduled_status_count,
        finished_status_count: r.finished_status_count,
        stale_scheduled_count: r.stale_scheduled_count,
        classification: r.classification,
        remaining: r.remaining
    })));
    console.log('any fixture date >= now:', fixtureResults.some((r) => r.current_or_future_count > 0));
    console.log('final classification:', finalClassification);
}

run().catch((error) => {
    console.error('Investigation failed:', error?.message || error);
    process.exitCode = 1;
});
