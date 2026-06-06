'use strict';

const {
    getEvent,
    getLineups,
    getOddsComparison,
    getStandings,
    isBzzoiroEnabled,
    listEvents,
    listLeagues
} = require('../../services/bzzoiroApiClient');
const {
    normalizeCompetition,
    normalizeFixture,
    normalizeFixtureDetail,
    normalizeLineups,
    normalizeOddsComparison,
    normalizeStandings
} = require('./bsdNormalizer');

const PROVIDER = 'bsd';
const LANE = 'evaluation';

function disabledEnvelope(reason) {
    return {
        ok: false,
        provider: PROVIDER,
        lane: LANE,
        disabled: true,
        reason: reason || 'BSD provider disabled'
    };
}

function wrapList(normalizer, rows = [], meta = {}) {
    return {
        ok: true,
        provider: PROVIDER,
        lane: LANE,
        count: meta.count ?? rows.length,
        items: rows.map((row) => normalizer(row))
    };
}

/**
 * BSD evaluation adapter — read-only normalization layer.
 * NOT connected to prediction pipelines or canonical ingest.
 */
async function competitions(params = {}) {
    if (!isBzzoiroEnabled()) return disabledEnvelope('ENABLE_BZZOIRO_PROVIDER is not true');

    const res = await listLeagues(params);
    if (!res.ok) {
        return { ok: false, provider: PROVIDER, lane: LANE, reason: res.reason || `HTTP ${res.status}`, items: [] };
    }

    const rows = Array.isArray(res.data?.results) ? res.data.results : [];
    return wrapList(normalizeCompetition, rows, { count: res.data?.count ?? rows.length });
}

async function fixtures(params = {}) {
    if (!isBzzoiroEnabled()) return disabledEnvelope('ENABLE_BZZOIRO_PROVIDER is not true');

    const res = await listEvents(params);
    if (!res.ok) {
        return { ok: false, provider: PROVIDER, lane: LANE, reason: res.reason || `HTTP ${res.status}`, items: [] };
    }

    const rows = Array.isArray(res.data?.results) ? res.data.results : [];
    return wrapList(normalizeFixture, rows, { count: res.data?.count ?? rows.length });
}

async function fixtureDetails(eventId) {
    if (!isBzzoiroEnabled()) return disabledEnvelope('ENABLE_BZZOIRO_PROVIDER is not true');

    const id = String(eventId || '').trim();
    if (!id) return disabledEnvelope('eventId is required');

    const res = await getEvent(id);
    if (!res.ok) {
        return { ok: false, provider: PROVIDER, lane: LANE, reason: res.reason || `HTTP ${res.status}`, item: null };
    }

    return {
        ok: true,
        provider: PROVIDER,
        lane: LANE,
        item: normalizeFixtureDetail(res.data || {})
    };
}

async function standings(leagueId, params = {}) {
    if (!isBzzoiroEnabled()) return disabledEnvelope('ENABLE_BZZOIRO_PROVIDER is not true');

    const id = String(leagueId || '').trim();
    if (!id) return disabledEnvelope('leagueId is required');

    const res = await getStandings(id, params);
    if (!res.ok) {
        return { ok: false, provider: PROVIDER, lane: LANE, reason: res.reason || `HTTP ${res.status}`, data: null };
    }

    return {
        ok: true,
        provider: PROVIDER,
        lane: LANE,
        data: normalizeStandings(res.data || {}, {
            leagueId: id,
            seasonId: params.season_id
        })
    };
}

async function lineups(eventId) {
    if (!isBzzoiroEnabled()) return disabledEnvelope('ENABLE_BZZOIRO_PROVIDER is not true');

    const id = String(eventId || '').trim();
    if (!id) return disabledEnvelope('eventId is required');

    const res = await getLineups(id);
    if (!res.ok) {
        return { ok: false, provider: PROVIDER, lane: LANE, reason: res.reason || `HTTP ${res.status}`, data: null };
    }

    return {
        ok: true,
        provider: PROVIDER,
        lane: LANE,
        data: normalizeLineups(res.data || {}, { eventId: id })
    };
}

async function odds(eventId) {
    if (!isBzzoiroEnabled()) return disabledEnvelope('ENABLE_BZZOIRO_PROVIDER is not true');

    const id = String(eventId || '').trim();
    if (!id) return disabledEnvelope('eventId is required');

    const res = await getOddsComparison(id);
    if (!res.ok) {
        return { ok: false, provider: PROVIDER, lane: LANE, reason: res.reason || `HTTP ${res.status}`, data: null };
    }

    return {
        ok: true,
        provider: PROVIDER,
        lane: LANE,
        data: normalizeOddsComparison(res.data || {}, { eventId: id })
    };
}

module.exports = {
    PROVIDER,
    LANE,
    competitions,
    fixtures,
    fixtureDetails,
    standings,
    lineups,
    odds,
    isBzzoiroEnabled
};
