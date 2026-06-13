'use strict';

const {
    getCallStats,
    getMatch,
    isSoccerDataApiEnabled,
    listCountries,
    listLeagues,
    listMatches,
    listStandings
} = require('../../services/soccerDataApiClient');
const {
    hasUsableOdds,
    normalizeFixture,
    normalizeMatchesPayload,
    passesSkcsFixtureGate
} = require('./soccerDataApiNormalizer');
const {
    resolveFixtureProbeLeague,
    resolveSoccerDataLeague
} = require('../../config/soccerDataLeagueMap');

const PROVIDER = 'soccer_data_api';
const LANE = 'evaluation';

function disabledEnvelope(reason) {
    return {
        ok: false,
        provider: PROVIDER,
        lane: LANE,
        disabled: true,
        reason: reason || 'Soccer Data API provider disabled'
    };
}

async function competitions(params = {}) {
    if (!isSoccerDataApiEnabled()) return disabledEnvelope('ENABLE_SOCCER_DATA_API is not true');

    const countryId = params.country_id || params.countryId;
    const res = countryId
        ? await listLeagues({ country_id: countryId }, params.options || {})
        : await listCountries(params.options || {});

    if (!res.ok) {
        return {
            ok: false,
            provider: PROVIDER,
            lane: LANE,
            reason: res.reason || res.detail || `HTTP ${res.status}`,
            items: [],
            calls_used: res.calls_used
        };
    }

    const results = Array.isArray(res.data?.results) ? res.data.results : [];
    return {
        ok: true,
        provider: PROVIDER,
        lane: LANE,
        count: results.length,
        items: results,
        calls_used: res.calls_used,
        rate: res.rate
    };
}

async function fixtures(params = {}) {
    if (!isSoccerDataApiEnabled()) return disabledEnvelope('ENABLE_SOCCER_DATA_API is not true');

    const leagueId = params.league_id || params.leagueId;
    if (!leagueId) return disabledEnvelope('league_id is required');

    const query = { league_id: leagueId };
    if (params.date) query.date = params.date;
    if (params.season) query.season = params.season;

    const res = await listMatches(query, params.options || {});
    if (!res.ok) {
        return {
            ok: false,
            provider: PROVIDER,
            lane: LANE,
            reason: res.reason || res.detail || `HTTP ${res.status}`,
            items: [],
            calls_used: res.calls_used
        };
    }

    const items = normalizeMatchesPayload(res.data);
    return {
        ok: true,
        provider: PROVIDER,
        lane: LANE,
        count: items.length,
        items,
        calls_used: res.calls_used,
        rate: res.rate
    };
}

async function fixtureDetails(matchId, params = {}) {
    if (!isSoccerDataApiEnabled()) return disabledEnvelope('ENABLE_SOCCER_DATA_API is not true');

    const id = String(matchId || '').replace(/^sda-/, '').trim();
    if (!id) return disabledEnvelope('matchId is required');

    const res = await getMatch(id, params.options || {});
    if (!res.ok) {
        return {
            ok: false,
            provider: PROVIDER,
            lane: LANE,
            reason: res.reason || res.detail || `HTTP ${res.status}`,
            item: null,
            calls_used: res.calls_used
        };
    }

    const mapRow = params.skcs_league_id ? resolveSoccerDataLeague(params.skcs_league_id) : null;
    const item = normalizeFixture(res.data, {
        league_name: res.data?.league?.name || mapRow?.competition,
        country_name: res.data?.league?.country,
        skcs_league_id: mapRow?.skcs_league_id,
        sda_league_id: res.data?.league?.id
    });

    return {
        ok: true,
        provider: PROVIDER,
        lane: LANE,
        item,
        calls_used: res.calls_used,
        rate: res.rate
    };
}

async function standings(params = {}) {
    if (!isSoccerDataApiEnabled()) return disabledEnvelope('ENABLE_SOCCER_DATA_API is not true');

    const leagueId = params.league_id || params.leagueId;
    if (!leagueId) return disabledEnvelope('league_id is required');

    const res = await listStandings(leagueId, params.options || {});
    if (!res.ok) {
        return {
            ok: false,
            provider: PROVIDER,
            lane: LANE,
            reason: res.reason || res.detail || `HTTP ${res.status}`,
            items: [],
            calls_used: res.calls_used
        };
    }

    const stage = Array.isArray(res.data?.stage) ? res.data.stage : [];
    const items = stage.flatMap((block) => Array.isArray(block.standings) ? block.standings : []);
    return {
        ok: true,
        provider: PROVIDER,
        lane: LANE,
        count: items.length,
        season: res.data?.season || null,
        items,
        calls_used: res.calls_used,
        rate: res.rate
    };
}

async function healthSummary(options = {}) {
    const maxCalls = Number(options.maxCalls) || 6;
    const epl = resolveSoccerDataLeague('4328');
    const fixtureProbe = resolveFixtureProbeLeague();
    const fixtureLeagueId = options.fixture_league_id || fixtureProbe.sda_league_id;

    const checks = [];

    const fixturesRes = await fixtures({ league_id: fixtureLeagueId, options: { maxCalls } });
    const sample = fixturesRes.items?.find((row) => passesSkcsFixtureGate(row)) || fixturesRes.items?.[0] || null;
    checks.push({
        label: 'fixtures',
        ok: fixturesRes.ok,
        reason: fixturesRes.reason,
        count: fixturesRes.count,
        probe_league_id: fixtureLeagueId,
        probe_competition: fixtureProbe.competition,
        calls_used: fixturesRes.calls_used
    });

    if (fixturesRes.ok && sample?.sda_match_id && getCallStats().total < maxCalls) {
        const detail = await fixtureDetails(sample.sda_match_id, {
            skcs_league_id: fixtureProbe.skcs_league_id,
            options: { maxCalls }
        });
        checks.push({
            label: 'fixtureDetails',
            ok: detail.ok && passesSkcsFixtureGate(detail.item),
            reason: detail.reason,
            has_odds: hasUsableOdds(detail.item),
            probe_league_id: fixtureLeagueId,
            calls_used: detail.calls_used
        });
    } else {
        checks.push({
            label: 'fixtureDetails',
            ok: false,
            reason: fixturesRes.ok ? 'no sample match in probe league' : fixturesRes.reason,
            has_odds: false,
            probe_league_id: fixtureLeagueId
        });
    }

    if (getCallStats().total < maxCalls) {
        const stand = await standings({ league_id: epl?.sda_league_id || 228, options: { maxCalls } });
        checks.push({
            label: 'standings',
            ok: stand.ok,
            reason: stand.reason,
            count: stand.count,
            probe_league_id: epl?.sda_league_id || 228,
            note: 'metadata only — European season ended',
            calls_used: stand.calls_used
        });
    }

    if (getCallStats().total < maxCalls) {
        const leagues = await competitions({ country_id: 8, options: { maxCalls } });
        checks.push({
            label: 'leagues',
            ok: leagues.ok,
            reason: leagues.reason,
            count: leagues.count,
            probe_country_id: 8,
            note: 'league discovery only — no fixture probe',
            calls_used: leagues.calls_used
        });
    }

    const passed = checks.filter((c) => c.ok).length;
    return {
        provider: PROVIDER,
        fixture_probe: fixtureProbe,
        checks,
        summary: {
            passed,
            total: checks.length,
            pass_rate_pct: checks.length ? Math.round((passed / checks.length) * 100) : 0
        }
    };
}

module.exports = {
    PROVIDER,
    isSoccerDataApiEnabled,
    competitions,
    fixtures,
    fixtureDetails,
    standings,
    healthSummary,
    hasUsableOdds,
    passesSkcsFixtureGate
};
